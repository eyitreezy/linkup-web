-- MatchMaker connection misalignment reports and 90-day multi-connection review queue.

CREATE TABLE IF NOT EXISTS public.matchmaker_connection_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  connection_id UUID NOT NULL REFERENCES public.matchmaker_connections(id) ON DELETE CASCADE,
  reporter_id UUID NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
  reported_user_id UUID NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
  reason_code TEXT NOT NULL,
  explanation TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT matchmaker_connection_reports_reason CHECK (
    reason_code IN (
      'explicit_content',
      'pressure_coercion',
      'financial_scam',
      'not_sincere',
      'other'
    )
  ),
  CONSTRAINT matchmaker_connection_reports_explanation_len CHECK (
    explanation IS NULL OR char_length(explanation) <= 200
  ),
  UNIQUE (connection_id, reporter_id)
);

CREATE INDEX IF NOT EXISTS idx_mm_connection_reports_reported_user
  ON public.matchmaker_connection_reports (reported_user_id, created_at DESC);

ALTER TABLE public.matchmaker_connection_reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS matchmaker_connection_reports_admin ON public.matchmaker_connection_reports;
CREATE POLICY matchmaker_connection_reports_admin ON public.matchmaker_connection_reports
  FOR SELECT
  USING (public.is_admin(auth.uid()));

CREATE TABLE IF NOT EXISTS public.matchmaker_misalignment_review_queue (
  reported_user_id UUID PRIMARY KEY REFERENCES public.profiles(user_id) ON DELETE CASCADE,
  flag_raised_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  distinct_connection_count INT NOT NULL,
  review_status TEXT NOT NULL DEFAULT 'pending',
  reviewed_at TIMESTAMPTZ NULL,
  reviewed_by UUID NULL REFERENCES public.profiles(user_id),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT matchmaker_misalignment_review_status CHECK (
    review_status IN ('pending', 'confirmed', 'not_confirmed')
  )
);

ALTER TABLE public.matchmaker_misalignment_review_queue ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS matchmaker_misalignment_review_admin ON public.matchmaker_misalignment_review_queue;
CREATE POLICY matchmaker_misalignment_review_admin ON public.matchmaker_misalignment_review_queue
  FOR ALL
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

CREATE OR REPLACE FUNCTION public.matchmaker_submit_connection_report(
  p_connection_id UUID,
  p_reason_code TEXT,
  p_explanation TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user UUID := auth.uid();
  v_conn public.matchmaker_connections%ROWTYPE;
  v_reported UUID;
  v_explanation TEXT;
  v_distinct INT;
  v_inserted INT;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  SELECT * INTO v_conn FROM public.matchmaker_connections
  WHERE id = p_connection_id
    AND (user_a_id = v_user OR user_b_id = v_user)
    AND status IN ('active', 'paused', 'ended');

  IF v_conn.id IS NULL THEN
    RAISE EXCEPTION 'not_participant';
  END IF;

  IF p_reason_code NOT IN (
    'explicit_content',
    'pressure_coercion',
    'financial_scam',
    'not_sincere',
    'other'
  ) THEN
    RAISE EXCEPTION 'invalid_reason';
  END IF;

  v_explanation := NULLIF(TRIM(p_explanation), '');
  IF v_explanation IS NOT NULL AND char_length(v_explanation) > 200 THEN
    RAISE EXCEPTION 'explanation_too_long';
  END IF;

  v_reported := CASE WHEN v_conn.user_a_id = v_user THEN v_conn.user_b_id ELSE v_conn.user_a_id END;

  INSERT INTO public.matchmaker_connection_reports (
    connection_id, reporter_id, reported_user_id, reason_code, explanation
  )
  VALUES (p_connection_id, v_user, v_reported, p_reason_code, v_explanation)
  ON CONFLICT (connection_id, reporter_id) DO NOTHING;

  GET DIAGNOSTICS v_inserted = ROW_COUNT;
  IF v_inserted = 0 THEN
    RETURN jsonb_build_object('ok', true, 'duplicate', true);
  END IF;

  SELECT COUNT(DISTINCT connection_id)::INT INTO v_distinct
  FROM public.matchmaker_connection_reports
  WHERE reported_user_id = v_reported
    AND created_at >= NOW() - INTERVAL '90 days';

  IF v_distinct >= 2 THEN
    INSERT INTO public.matchmaker_misalignment_review_queue (
      reported_user_id, flag_raised_at, distinct_connection_count, review_status, updated_at
    )
    VALUES (v_reported, NOW(), v_distinct, 'pending', NOW())
    ON CONFLICT (reported_user_id) DO UPDATE SET
      distinct_connection_count = EXCLUDED.distinct_connection_count,
      flag_raised_at = CASE
        WHEN matchmaker_misalignment_review_queue.review_status = 'pending'
        THEN matchmaker_misalignment_review_queue.flag_raised_at
        ELSE NOW()
      END,
      review_status = CASE
        WHEN matchmaker_misalignment_review_queue.review_status = 'confirmed' THEN 'confirmed'
        ELSE 'pending'
      END,
      updated_at = NOW();
  END IF;

  RETURN jsonb_build_object('ok', true, 'duplicate', false);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_review_matchmaker_misalignment(
  p_reported_user_id UUID,
  p_confirmed BOOLEAN
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin UUID := auth.uid();
BEGIN
  IF NOT public.is_admin(v_admin) THEN
    RAISE EXCEPTION 'not_admin';
  END IF;

  UPDATE public.matchmaker_misalignment_review_queue
  SET
    review_status = CASE WHEN p_confirmed THEN 'confirmed' ELSE 'not_confirmed' END,
    reviewed_at = NOW(),
    reviewed_by = v_admin,
    updated_at = NOW()
  WHERE reported_user_id = p_reported_user_id;

  IF p_confirmed THEN
    INSERT INTO public.matchmaker_cooldowns (user_id, cooldown_until, reason)
    VALUES (p_reported_user_id, NOW() + INTERVAL '3650 days', 'misalignment')
    ON CONFLICT (user_id) DO UPDATE SET
      cooldown_until = EXCLUDED.cooldown_until,
      reason = EXCLUDED.reason,
      created_at = NOW();

    UPDATE public.matchmaker_intents
    SET pool_visible = false
    WHERE user_id = p_reported_user_id AND is_active = true;
  END IF;

  RETURN jsonb_build_object('ok', true);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_list_matchmaker_misalignment_queue()
RETURNS SETOF public.matchmaker_misalignment_review_queue
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT q.*
  FROM public.matchmaker_misalignment_review_queue q
  WHERE public.is_admin(auth.uid())
  ORDER BY q.flag_raised_at DESC;
$$;

GRANT EXECUTE ON FUNCTION public.matchmaker_submit_connection_report(UUID, TEXT, TEXT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_review_matchmaker_misalignment(UUID, BOOLEAN) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_list_matchmaker_misalignment_queue() TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';
