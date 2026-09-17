-- MatchMaker schema: tables, RLS, RPCs, cron jobs, and column additions.

-- ---------------------------------------------------------------------------
-- 1.1 Profiles — communication style (onboarding / Gate 4)
-- ---------------------------------------------------------------------------
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS communication_style TEXT NULL;

COMMENT ON COLUMN public.profiles.communication_style IS
  'MatchMaker communication preference: daily | few_times_week | flexible';

-- ---------------------------------------------------------------------------
-- 1.2 Plans + conversations — MatchMaker linkage
-- ---------------------------------------------------------------------------
ALTER TABLE public.plans
  ADD COLUMN IF NOT EXISTS matchmaker_connection_id UUID NULL;

ALTER TABLE public.conversations
  ADD COLUMN IF NOT EXISTS matchmaker_connection_id UUID NULL;

CREATE INDEX IF NOT EXISTS idx_plans_matchmaker_connection
  ON public.plans (matchmaker_connection_id)
  WHERE matchmaker_connection_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_conversations_matchmaker_connection
  ON public.conversations (matchmaker_connection_id)
  WHERE matchmaker_connection_id IS NOT NULL;

-- ---------------------------------------------------------------------------
-- 1.3 MatchMaker tables
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.matchmaker_intents (
  user_id UUID PRIMARY KEY REFERENCES public.profiles(user_id) ON DELETE CASCADE,
  declared_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  is_active BOOLEAN NOT NULL DEFAULT true,
  last_reaffirmed_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS public.matchmaker_values (
  user_id UUID PRIMARY KEY REFERENCES public.profiles(user_id) ON DELETE CASCADE,
  faith TEXT NULL,
  family_goals TEXT NOT NULL,
  pace_preference TEXT NOT NULL,
  communication_frequency TEXT NULL,
  dealbreakers JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.matchmaker_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_a_id UUID NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
  user_b_id UUID NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'active',
  connected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  first_message_at TIMESTAMPTZ NULL,
  plan_unlock_at TIMESTAMPTZ NULL,
  ended_at TIMESTAMPTZ NULL,
  ended_by UUID NULL REFERENCES public.profiles(user_id),
  end_reason TEXT NULL,
  first_plan_created_at TIMESTAMPTZ NULL,
  paused_at TIMESTAMPTZ NULL,
  CHECK (user_a_id <> user_b_id),
  CHECK (status IN ('active', 'ended', 'paused'))
);

CREATE UNIQUE INDEX IF NOT EXISTS matchmaker_connections_user_a_active
  ON public.matchmaker_connections (user_a_id)
  WHERE status = 'active';

CREATE UNIQUE INDEX IF NOT EXISTS matchmaker_connections_user_b_active
  ON public.matchmaker_connections (user_b_id)
  WHERE status = 'active';

CREATE TABLE IF NOT EXISTS public.matchmaker_interests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  from_user_id UUID NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
  to_user_id UUID NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
  expressed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  status TEXT NOT NULL DEFAULT 'pending',
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '30 days'),
  CHECK (from_user_id <> to_user_id),
  CHECK (status IN ('pending', 'accepted', 'passed', 'expired')),
  UNIQUE (from_user_id, to_user_id)
);

CREATE TABLE IF NOT EXISTS public.matchmaker_ready_signals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  connection_id UUID NOT NULL REFERENCES public.matchmaker_connections(id) ON DELETE CASCADE,
  signalling_user_id UUID NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
  signalled_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (connection_id, signalling_user_id)
);

CREATE TABLE IF NOT EXISTS public.matchmaker_shared_activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  connection_id UUID NOT NULL REFERENCES public.matchmaker_connections(id) ON DELETE CASCADE,
  week_number INT NOT NULL DEFAULT 1,
  questions JSONB NOT NULL DEFAULT '[]'::jsonb,
  user_a_answers JSONB NULL,
  user_b_answers JSONB NULL,
  a_submitted_at TIMESTAMPTZ NULL,
  b_submitted_at TIMESTAMPTZ NULL,
  revealed_at TIMESTAMPTZ NULL,
  UNIQUE (connection_id, week_number)
);

CREATE TABLE IF NOT EXISTS public.matchmaker_reflection_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  connection_id UUID NOT NULL REFERENCES public.matchmaker_connections(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
  post_meetup_feeling TEXT NULL,
  post_meetup_quality TEXT NULL,
  reflection_period_text TEXT NULL,
  healing_answers JSONB NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (connection_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.matchmaker_nudges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  connection_id UUID NOT NULL REFERENCES public.matchmaker_connections(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
  nudge_type TEXT NOT NULL,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (connection_id, user_id, nudge_type)
);

CREATE TABLE IF NOT EXISTS public.matchmaker_exclusions (
  user_a_id UUID NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
  user_b_id UUID NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
  excluded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_a_id, user_b_id),
  CHECK (user_a_id <> user_b_id)
);

CREATE TABLE IF NOT EXISTS public.matchmaker_cooldowns (
  user_id UUID PRIMARY KEY REFERENCES public.profiles(user_id) ON DELETE CASCADE,
  cooldown_until TIMESTAMPTZ NOT NULL,
  reason TEXT NOT NULL DEFAULT 'rapid_cycler',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- FK from plans/conversations after matchmaker_connections exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'plans_matchmaker_connection_id_fkey'
  ) THEN
    ALTER TABLE public.plans
      ADD CONSTRAINT plans_matchmaker_connection_id_fkey
      FOREIGN KEY (matchmaker_connection_id)
      REFERENCES public.matchmaker_connections(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'conversations_matchmaker_connection_id_fkey'
  ) THEN
    ALTER TABLE public.conversations
      ADD CONSTRAINT conversations_matchmaker_connection_id_fkey
      FOREIGN KEY (matchmaker_connection_id)
      REFERENCES public.matchmaker_connections(id) ON DELETE SET NULL;
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.matchmaker_user_has_gold_access(p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.users u
    WHERE u.id = p_user_id
      AND (
        (
          u.subscription_tier IN ('GOLD', 'PLATINUM')
          AND u.subscription_expires_at IS NOT NULL
          AND u.subscription_expires_at > NOW()
        )
        OR (
          u.gold_trial_expires_at IS NOT NULL
          AND u.gold_trial_expires_at > NOW()
        )
      )
  );
$$;

CREATE OR REPLACE FUNCTION public.matchmaker_profile_is_pool_eligible(p profiles)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
AS $$
  SELECT
    p.gender IN ('male', 'female')
    AND COALESCE(NULLIF(trim(p.display_name), ''), NULL) IS NOT NULL
    AND COALESCE(NULLIF(trim(p.bio), ''), NULL) IS NOT NULL
    AND p.latitude IS NOT NULL
    AND p.longitude IS NOT NULL
    AND COALESCE(array_length(p.photo_urls, 1), 0) > 0
    AND jsonb_typeof(p.preferences->'interests') = 'array'
    AND jsonb_array_length(p.preferences->'interests') > 0;
$$;

CREATE OR REPLACE FUNCTION public.matchmaker_get_or_create_conversation(
  p_user_a UUID,
  p_user_b UUID,
  p_connection_id UUID
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_a UUID := LEAST(p_user_a, p_user_b);
  v_b UUID := GREATEST(p_user_a, p_user_b);
  v_id UUID;
BEGIN
  SELECT id INTO v_id
  FROM public.conversations
  WHERE user_a = v_a AND user_b = v_b
  LIMIT 1;

  IF v_id IS NOT NULL THEN
    UPDATE public.conversations
    SET matchmaker_connection_id = COALESCE(matchmaker_connection_id, p_connection_id)
    WHERE id = v_id;
    RETURN v_id;
  END IF;

  INSERT INTO public.conversations (user_a, user_b, matchmaker_connection_id)
  VALUES (v_a, v_b, p_connection_id)
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.matchmaker_user_has_gold_access(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.matchmaker_user_has_gold_access(UUID) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.matchmaker_get_or_create_conversation(UUID, UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.matchmaker_get_or_create_conversation(UUID, UUID, UUID) TO service_role;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
ALTER TABLE public.matchmaker_intents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.matchmaker_values ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.matchmaker_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.matchmaker_interests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.matchmaker_ready_signals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.matchmaker_shared_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.matchmaker_reflection_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.matchmaker_nudges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.matchmaker_exclusions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.matchmaker_cooldowns ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS matchmaker_intents_own ON public.matchmaker_intents;
CREATE POLICY matchmaker_intents_own ON public.matchmaker_intents
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS matchmaker_values_own ON public.matchmaker_values;
CREATE POLICY matchmaker_values_own ON public.matchmaker_values
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ended_by / end_reason: column-level revoke for authenticated
REVOKE ALL ON public.matchmaker_connections FROM authenticated;
GRANT SELECT (
  id, user_a_id, user_b_id, status, connected_at,
  first_message_at, plan_unlock_at, ended_at, first_plan_created_at, paused_at
) ON public.matchmaker_connections TO authenticated;

DROP POLICY IF EXISTS matchmaker_connections_participant ON public.matchmaker_connections;
CREATE POLICY matchmaker_connections_participant ON public.matchmaker_connections
  FOR SELECT TO authenticated
  USING (auth.uid() = user_a_id OR auth.uid() = user_b_id);

DROP POLICY IF EXISTS matchmaker_connections_insert_rpc_only ON public.matchmaker_connections;
CREATE POLICY matchmaker_connections_insert_rpc_only ON public.matchmaker_connections
  FOR INSERT TO authenticated
  WITH CHECK (false);

DROP POLICY IF EXISTS matchmaker_connections_update_rpc_only ON public.matchmaker_connections;
CREATE POLICY matchmaker_connections_update_rpc_only ON public.matchmaker_connections
  FOR UPDATE TO authenticated
  USING (false);

DROP POLICY IF EXISTS matchmaker_interests_sender ON public.matchmaker_interests;
CREATE POLICY matchmaker_interests_sender ON public.matchmaker_interests
  FOR SELECT TO authenticated
  USING (auth.uid() = from_user_id);

DROP POLICY IF EXISTS matchmaker_interests_receiver ON public.matchmaker_interests;
CREATE POLICY matchmaker_interests_receiver ON public.matchmaker_interests
  FOR SELECT TO authenticated
  USING (auth.uid() = to_user_id);

DROP POLICY IF EXISTS matchmaker_interests_insert_own ON public.matchmaker_interests;
CREATE POLICY matchmaker_interests_insert_own ON public.matchmaker_interests
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = from_user_id);

DROP POLICY IF EXISTS matchmaker_interests_update_participant ON public.matchmaker_interests;
CREATE POLICY matchmaker_interests_update_participant ON public.matchmaker_interests
  FOR UPDATE TO authenticated
  USING (auth.uid() = from_user_id OR auth.uid() = to_user_id);

DROP POLICY IF EXISTS matchmaker_ready_signals_participant ON public.matchmaker_ready_signals;
CREATE POLICY matchmaker_ready_signals_participant ON public.matchmaker_ready_signals
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.matchmaker_connections mc
      WHERE mc.id = connection_id
        AND (mc.user_a_id = auth.uid() OR mc.user_b_id = auth.uid())
    )
  );

DROP POLICY IF EXISTS matchmaker_activity_participant ON public.matchmaker_shared_activities;
CREATE POLICY matchmaker_activity_participant ON public.matchmaker_shared_activities
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.matchmaker_connections mc
      WHERE mc.id = connection_id
        AND (mc.user_a_id = auth.uid() OR mc.user_b_id = auth.uid())
    )
  );

DROP POLICY IF EXISTS matchmaker_reflection_own ON public.matchmaker_reflection_responses;
CREATE POLICY matchmaker_reflection_own ON public.matchmaker_reflection_responses
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS matchmaker_exclusions_own ON public.matchmaker_exclusions;
CREATE POLICY matchmaker_exclusions_own ON public.matchmaker_exclusions
  FOR SELECT TO authenticated
  USING (auth.uid() = user_a_id OR auth.uid() = user_b_id);

DROP POLICY IF EXISTS matchmaker_cooldowns_own ON public.matchmaker_cooldowns;
CREATE POLICY matchmaker_cooldowns_own ON public.matchmaker_cooldowns
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- RPCs
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.matchmaker_get_gate_state()
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user UUID := auth.uid();
  v_verification TEXT;
  v_intent BOOLEAN;
  v_values BOOLEAN;
  v_cooldown TIMESTAMPTZ;
  v_connection_id UUID;
  v_connection_status TEXT;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  IF NOT public.matchmaker_user_has_gold_access(v_user) THEN
    RETURN jsonb_build_object('gate', 'subscription');
  END IF;

  SELECT verification_status INTO v_verification
  FROM public.users WHERE id = v_user;

  IF COALESCE(v_verification, 'unverified') <> 'verified' THEN
    RETURN jsonb_build_object('gate', 'kyc');
  END IF;

  SELECT cooldown_until INTO v_cooldown
  FROM public.matchmaker_cooldowns
  WHERE user_id = v_user AND cooldown_until > NOW();

  IF v_cooldown IS NOT NULL THEN
    RETURN jsonb_build_object('gate', 'cooldown', 'cooldown_until', v_cooldown);
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.matchmaker_intents
    WHERE user_id = v_user AND is_active = true
  ) INTO v_intent;

  IF NOT v_intent THEN
    RETURN jsonb_build_object('gate', 'intent');
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.matchmaker_values WHERE user_id = v_user
  ) INTO v_values;

  IF NOT v_values THEN
    RETURN jsonb_build_object('gate', 'values');
  END IF;

  SELECT id, status INTO v_connection_id, v_connection_status
  FROM public.matchmaker_connections
  WHERE (user_a_id = v_user OR user_b_id = v_user)
    AND status IN ('active', 'paused')
  ORDER BY connected_at DESC
  LIMIT 1;

  IF v_connection_id IS NOT NULL THEN
    RETURN jsonb_build_object(
      'gate', 'connection',
      'connection_id', v_connection_id,
      'connection_status', v_connection_status
    );
  END IF;

  RETURN jsonb_build_object('gate', 'pool');
END;
$$;

CREATE OR REPLACE FUNCTION public.matchmaker_express_interest(p_to_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_from UUID := auth.uid();
  v_mutual_interest public.matchmaker_interests%ROWTYPE;
  v_new_connection_id UUID;
  v_user_a UUID;
  v_user_b UUID;
BEGIN
  IF v_from IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  IF p_to_user_id = v_from THEN
    RAISE EXCEPTION 'invalid_target';
  END IF;

  INSERT INTO public.matchmaker_interests (from_user_id, to_user_id, status)
  VALUES (v_from, p_to_user_id, 'pending')
  ON CONFLICT (from_user_id, to_user_id) DO NOTHING;

  SELECT * INTO v_mutual_interest
  FROM public.matchmaker_interests
  WHERE from_user_id = p_to_user_id
    AND to_user_id = v_from
    AND status = 'pending';

  IF v_mutual_interest.id IS NULL THEN
    RETURN jsonb_build_object('matched', false);
  END IF;

  v_user_a := LEAST(v_from, p_to_user_id);
  v_user_b := GREATEST(v_from, p_to_user_id);

  INSERT INTO public.matchmaker_connections (user_a_id, user_b_id, status)
  VALUES (v_user_a, v_user_b, 'active')
  RETURNING id INTO v_new_connection_id;

  UPDATE public.matchmaker_interests SET status = 'accepted'
  WHERE (from_user_id = v_from AND to_user_id = p_to_user_id)
     OR (from_user_id = p_to_user_id AND to_user_id = v_from);

  INSERT INTO public.matchmaker_exclusions (user_a_id, user_b_id)
  VALUES (v_user_a, v_user_b)
  ON CONFLICT DO NOTHING;

  PERFORM public.matchmaker_get_or_create_conversation(v_user_a, v_user_b, v_new_connection_id);

  PERFORM public.create_notification(
    v_from,
    'matchmaker_mutual_connection',
    'New MatchMaker connection',
    'You have a new MatchMaker connection.',
    jsonb_build_object('connection_id', v_new_connection_id, 'href', '/matchmaker/connection/' || v_new_connection_id::text),
    'high',
    'matchmaker_mutual:' || v_new_connection_id::text || ':' || v_from::text
  );

  PERFORM public.create_notification(
    p_to_user_id,
    'matchmaker_mutual_connection',
    'New MatchMaker connection',
    'You have a new MatchMaker connection.',
    jsonb_build_object('connection_id', v_new_connection_id, 'href', '/matchmaker/connection/' || v_new_connection_id::text),
    'high',
    'matchmaker_mutual:' || v_new_connection_id::text || ':' || p_to_user_id::text
  );

  RETURN jsonb_build_object('matched', true, 'connection_id', v_new_connection_id);
EXCEPTION
  WHEN unique_violation THEN
    SELECT id INTO v_new_connection_id
    FROM public.matchmaker_connections
    WHERE user_a_id = v_user_a AND user_b_id = v_user_b AND status = 'active'
    LIMIT 1;

    RETURN jsonb_build_object('matched', true, 'connection_id', v_new_connection_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.matchmaker_end_connection(
  p_connection_id UUID,
  p_reason TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user UUID := auth.uid();
  v_conn public.matchmaker_connections%ROWTYPE;
  v_sub_threshold BOOLEAN;
  v_recent_sub_threshold INT;
  v_partner UUID;
BEGIN
  SELECT * INTO v_conn FROM public.matchmaker_connections
  WHERE id = p_connection_id
    AND (user_a_id = v_user OR user_b_id = v_user)
    AND status IN ('active', 'paused');

  IF v_conn.id IS NULL THEN
    RAISE EXCEPTION 'connection_not_found';
  END IF;

  v_sub_threshold := (
    v_conn.first_message_at IS NULL
    OR v_conn.plan_unlock_at IS NULL
    OR v_conn.plan_unlock_at > NOW()
  );

  UPDATE public.matchmaker_connections SET
    status = 'ended',
    ended_at = NOW(),
    ended_by = v_user,
    end_reason = p_reason
  WHERE id = p_connection_id;

  v_partner := CASE WHEN v_conn.user_a_id = v_user THEN v_conn.user_b_id ELSE v_conn.user_a_id END;

  PERFORM public.create_notification(
    v_partner,
    'matchmaker_connection_ended',
    'Connection ended',
    'This connection has ended.',
    jsonb_build_object('href', '/matchmaker/reflect'),
    'medium',
    'matchmaker_ended:' || p_connection_id::text || ':' || v_partner::text
  );

  IF v_sub_threshold THEN
    SELECT COUNT(*) INTO v_recent_sub_threshold
    FROM public.matchmaker_connections
    WHERE (user_a_id = v_user OR user_b_id = v_user)
      AND status = 'ended'
      AND ended_at > NOW() - INTERVAL '60 days'
      AND (
        first_message_at IS NULL
        OR plan_unlock_at IS NULL
        OR plan_unlock_at > ended_at
      );

    IF v_recent_sub_threshold >= 3 THEN
      INSERT INTO public.matchmaker_cooldowns (user_id, cooldown_until, reason)
      VALUES (v_user, NOW() + INTERVAL '30 days', 'rapid_cycler')
      ON CONFLICT (user_id) DO UPDATE SET
        cooldown_until = EXCLUDED.cooldown_until,
        reason = EXCLUDED.reason,
        created_at = NOW();
    END IF;
  END IF;

  UPDATE public.matchmaker_interests
  SET status = 'expired'
  WHERE status = 'pending'
    AND (
      (from_user_id = v_conn.user_a_id AND to_user_id = v_conn.user_b_id)
      OR (from_user_id = v_conn.user_b_id AND to_user_id = v_conn.user_a_id)
    );

  UPDATE public.matchmaker_interests mi
  SET status = 'expired'
  WHERE mi.status = 'pending'
    AND EXISTS (
      SELECT 1 FROM public.matchmaker_exclusions me
      WHERE (me.user_a_id = mi.from_user_id AND me.user_b_id = mi.to_user_id)
         OR (me.user_a_id = mi.to_user_id AND me.user_b_id = mi.from_user_id)
    );
END;
$$;

CREATE OR REPLACE FUNCTION public.matchmaker_record_first_message(p_connection_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.matchmaker_connections SET
    first_message_at = NOW(),
    plan_unlock_at = NOW() + INTERVAL '21 days'
  WHERE id = p_connection_id
    AND first_message_at IS NULL
    AND (user_a_id = auth.uid() OR user_b_id = auth.uid())
    AND status = 'active';
END;
$$;

CREATE OR REPLACE FUNCTION public.matchmaker_send_ready_signal(p_connection_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user UUID := auth.uid();
  v_conn public.matchmaker_connections%ROWTYPE;
  v_partner UUID;
  v_days_left INT;
  v_name TEXT;
BEGIN
  SELECT * INTO v_conn FROM public.matchmaker_connections
  WHERE id = p_connection_id
    AND (user_a_id = v_user OR user_b_id = v_user)
    AND status = 'active';

  IF v_conn.id IS NULL THEN
    RAISE EXCEPTION 'connection_not_found';
  END IF;

  IF v_conn.connected_at > NOW() - INTERVAL '10 days' THEN
    RAISE EXCEPTION 'too_early';
  END IF;

  INSERT INTO public.matchmaker_ready_signals (connection_id, signalling_user_id)
  VALUES (p_connection_id, v_user)
  ON CONFLICT (connection_id, signalling_user_id) DO NOTHING;

  v_partner := CASE WHEN v_conn.user_a_id = v_user THEN v_conn.user_b_id ELSE v_conn.user_a_id END;

  SELECT display_name INTO v_name FROM public.profiles WHERE user_id = v_user;

  v_days_left := GREATEST(
    0,
    COALESCE(
      EXTRACT(DAY FROM (v_conn.plan_unlock_at - NOW()))::INT,
      21
    )
  );

  PERFORM public.create_notification(
    v_partner,
    'matchmaker_ready_signal',
    COALESCE(v_name, 'Your match') || ' feels ready to meet',
    'No pressure — your plan window opens in ' || v_days_left::text || ' days. Keep the conversation going.',
    jsonb_build_object(
      'connection_id', p_connection_id,
      'href', '/messages'
    ),
    'medium',
    'matchmaker_ready:' || p_connection_id::text || ':' || v_user::text
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.matchmaker_submit_activity_answer(
  p_connection_id UUID,
  p_week_number INT,
  p_answers JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user UUID := auth.uid();
  v_conn public.matchmaker_connections%ROWTYPE;
  v_activity public.matchmaker_shared_activities%ROWTYPE;
  v_is_user_a BOOLEAN;
BEGIN
  SELECT * INTO v_conn FROM public.matchmaker_connections
  WHERE id = p_connection_id
    AND (user_a_id = v_user OR user_b_id = v_user)
    AND status = 'active';

  IF v_conn.id IS NULL THEN RAISE EXCEPTION 'not_participant'; END IF;

  v_is_user_a := v_conn.user_a_id = v_user;

  SELECT * INTO v_activity FROM public.matchmaker_shared_activities
  WHERE connection_id = p_connection_id AND week_number = p_week_number;

  IF v_activity.id IS NULL THEN
    INSERT INTO public.matchmaker_shared_activities (
      connection_id, week_number,
      user_a_answers, user_b_answers,
      a_submitted_at, b_submitted_at
    )
    VALUES (
      p_connection_id, p_week_number,
      CASE WHEN v_is_user_a THEN p_answers ELSE NULL END,
      CASE WHEN NOT v_is_user_a THEN p_answers ELSE NULL END,
      CASE WHEN v_is_user_a THEN NOW() ELSE NULL END,
      CASE WHEN NOT v_is_user_a THEN NOW() ELSE NULL END
    );
  ELSE
    IF v_is_user_a AND v_activity.user_a_answers IS NULL THEN
      UPDATE public.matchmaker_shared_activities
      SET user_a_answers = p_answers, a_submitted_at = NOW()
      WHERE id = v_activity.id;
    ELSIF NOT v_is_user_a AND v_activity.user_b_answers IS NULL THEN
      UPDATE public.matchmaker_shared_activities
      SET user_b_answers = p_answers, b_submitted_at = NOW()
      WHERE id = v_activity.id;
    END IF;
  END IF;

  SELECT * INTO v_activity FROM public.matchmaker_shared_activities
  WHERE connection_id = p_connection_id AND week_number = p_week_number;

  IF v_activity.user_a_answers IS NOT NULL
     AND v_activity.user_b_answers IS NOT NULL
     AND v_activity.revealed_at IS NULL THEN
    UPDATE public.matchmaker_shared_activities SET revealed_at = NOW()
    WHERE id = v_activity.id
    RETURNING * INTO v_activity;

    PERFORM public.create_notification(
      v_conn.user_a_id,
      'matchmaker_activity_revealed',
      'Shared activity ready',
      'Answers revealed — see what you both said.',
      jsonb_build_object('connection_id', p_connection_id, 'href', '/matchmaker/connection/' || p_connection_id::text || '/activity'),
      'medium',
      'matchmaker_activity:' || v_activity.id::text || ':a'
    );

    PERFORM public.create_notification(
      v_conn.user_b_id,
      'matchmaker_activity_revealed',
      'Shared activity ready',
      'Answers revealed — see what you both said.',
      jsonb_build_object('connection_id', p_connection_id, 'href', '/matchmaker/connection/' || p_connection_id::text || '/activity'),
      'medium',
      'matchmaker_activity:' || v_activity.id::text || ':b'
    );

    RETURN jsonb_build_object('revealed', true);
  END IF;

  RETURN jsonb_build_object('revealed', false);
END;
$$;

CREATE OR REPLACE FUNCTION public.matchmaker_get_pool(p_limit INT DEFAULT 12)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user UUID := auth.uid();
  v_viewer public.profiles%ROWTYPE;
  v_target_gender TEXT;
  v_rows JSONB;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;

  SELECT * INTO v_viewer FROM public.profiles WHERE user_id = v_user;

  IF v_viewer.gender = 'female' THEN
    v_target_gender := 'male';
  ELSIF v_viewer.gender = 'male' THEN
    v_target_gender := 'female';
  ELSE
    RETURN '[]'::jsonb;
  END IF;

  SELECT COALESCE(jsonb_agg(row_to_json(t)), '[]'::jsonb) INTO v_rows
  FROM (
    SELECT
      p.user_id,
      p.display_name,
      p.birth_date,
      p.location_label,
      p.photo_urls,
      p.primary_photo_url,
      p.avatar_url,
      p.preferences,
      p.communication_style,
      p.latitude,
      p.longitude,
      p.verified_badge
    FROM public.profiles p
    INNER JOIN public.users u ON u.id = p.user_id
    WHERE p.user_id <> v_user
      AND p.gender = v_target_gender
      AND u.verification_status = 'verified'
      AND public.matchmaker_user_has_gold_access(p.user_id)
      AND public.matchmaker_profile_is_pool_eligible(p)
      AND EXISTS (SELECT 1 FROM public.matchmaker_intents mi WHERE mi.user_id = p.user_id AND mi.is_active)
      AND EXISTS (SELECT 1 FROM public.matchmaker_values mv WHERE mv.user_id = p.user_id)
      AND NOT EXISTS (
        SELECT 1 FROM public.matchmaker_exclusions me
        WHERE (me.user_a_id = v_user AND me.user_b_id = p.user_id)
           OR (me.user_a_id = p.user_id AND me.user_b_id = v_user)
      )
      AND NOT EXISTS (
        SELECT 1 FROM public.matchmaker_connections mc
        WHERE mc.status IN ('active', 'paused')
          AND (mc.user_a_id = p.user_id OR mc.user_b_id = p.user_id)
      )
    ORDER BY p.updated_at DESC NULLS LAST
    LIMIT GREATEST(1, LEAST(p_limit, 50))
  ) t;

  RETURN v_rows;
END;
$$;

CREATE OR REPLACE FUNCTION public.matchmaker_send_day10_nudges()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  conn RECORD;
  participant UUID;
  v_nudge_id UUID;
BEGIN
  FOR conn IN
    SELECT mc.id, mc.user_a_id, mc.user_b_id
    FROM public.matchmaker_connections mc
    WHERE mc.status = 'active'
      AND mc.connected_at <= NOW() - INTERVAL '10 days'
      AND mc.connected_at > NOW() - INTERVAL '11 days'
  LOOP
    FOREACH participant IN ARRAY ARRAY[conn.user_a_id, conn.user_b_id]
    LOOP
      v_nudge_id := NULL;
      INSERT INTO public.matchmaker_nudges (connection_id, user_id, nudge_type)
      VALUES (conn.id, participant, 'day_10_checkin')
      ON CONFLICT DO NOTHING
      RETURNING id INTO v_nudge_id;

      IF v_nudge_id IS NOT NULL THEN
        PERFORM public.create_notification(
          participant,
          'matchmaker_day10_nudge',
          'How is your connection going?',
          'You have been connected for 10 days. How is the conversation going?',
          jsonb_build_object(
            'connection_id', conn.id,
            'href', '/matchmaker/connection/' || conn.id::text
          ),
          'medium',
          'matchmaker_day10:' || conn.id::text || ':' || participant::text
        );
      END IF;
    END LOOP;
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION public.matchmaker_send_day21_unlocks()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT mc.id, mc.user_a_id, mc.user_b_id
    FROM public.matchmaker_connections mc
    WHERE mc.status = 'active'
      AND mc.plan_unlock_at IS NOT NULL
      AND mc.plan_unlock_at <= NOW()
  LOOP
    PERFORM public.create_notification(
      r.user_a_id,
      'matchmaker_plan_unlocked',
      'Plan window open',
      'Your MatchMaker plan window is now open.',
      jsonb_build_object('connection_id', r.id, 'href', '/matchmaker/connection/' || r.id::text),
      'high',
      'matchmaker_day21:' || r.id::text || ':' || r.user_a_id::text
    );

    INSERT INTO public.matchmaker_nudges (connection_id, user_id, nudge_type)
    VALUES (r.id, r.user_a_id, 'day_21_unlock')
    ON CONFLICT DO NOTHING;

    PERFORM public.create_notification(
      r.user_b_id,
      'matchmaker_plan_unlocked',
      'Plan window open',
      'Your MatchMaker plan window is now open.',
      jsonb_build_object('connection_id', r.id, 'href', '/matchmaker/connection/' || r.id::text),
      'high',
      'matchmaker_day21:' || r.id::text || ':' || r.user_b_id::text
    );

    INSERT INTO public.matchmaker_nudges (connection_id, user_id, nudge_type)
    VALUES (r.id, r.user_b_id, 'day_21_unlock')
    ON CONFLICT DO NOTHING;
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION public.matchmaker_pause_expired_subscriptions()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT mc.id, mc.user_a_id, mc.user_b_id
    FROM public.matchmaker_connections mc
    WHERE mc.status = 'active'
      AND (
        NOT public.matchmaker_user_has_gold_access(mc.user_a_id)
        OR NOT public.matchmaker_user_has_gold_access(mc.user_b_id)
      )
  LOOP
    UPDATE public.matchmaker_connections
    SET status = 'paused', paused_at = COALESCE(paused_at, NOW())
    WHERE id = r.id AND status = 'active';
  END LOOP;

  FOR r IN
    SELECT mc.id
    FROM public.matchmaker_connections mc
    WHERE mc.status = 'paused'
      AND mc.paused_at IS NOT NULL
      AND mc.paused_at < NOW() - INTERVAL '14 days'
      AND (
        NOT public.matchmaker_user_has_gold_access(mc.user_a_id)
        OR NOT public.matchmaker_user_has_gold_access(mc.user_b_id)
      )
  LOOP
    UPDATE public.matchmaker_connections
    SET status = 'ended', ended_at = NOW(), end_reason = 'subscription_lapse'
    WHERE id = r.id;
  END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION public.matchmaker_get_gate_state() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.matchmaker_express_interest(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.matchmaker_end_connection(UUID, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.matchmaker_record_first_message(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.matchmaker_send_ready_signal(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.matchmaker_submit_activity_answer(UUID, INT, JSONB) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.matchmaker_get_pool(INT) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.matchmaker_get_gate_state() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.matchmaker_express_interest(UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.matchmaker_end_connection(UUID, TEXT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.matchmaker_record_first_message(UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.matchmaker_send_ready_signal(UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.matchmaker_submit_activity_answer(UUID, INT, JSONB) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.matchmaker_get_pool(INT) TO authenticated, service_role;

GRANT EXECUTE ON FUNCTION public.matchmaker_send_day10_nudges() TO service_role;
GRANT EXECUTE ON FUNCTION public.matchmaker_send_day21_unlocks() TO service_role;
GRANT EXECUTE ON FUNCTION public.matchmaker_pause_expired_subscriptions() TO service_role;

-- Realtime publication
ALTER TABLE public.matchmaker_connections REPLICA IDENTITY FULL;
ALTER TABLE public.matchmaker_shared_activities REPLICA IDENTITY FULL;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.matchmaker_connections;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.matchmaker_shared_activities;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Cron jobs
SELECT cron.schedule(
  'matchmaker-day10-nudge',
  '0 9 * * *',
  $$SELECT public.matchmaker_send_day10_nudges();$$
);

SELECT cron.schedule(
  'matchmaker-day21-unlock',
  '*/15 * * * *',
  $$SELECT public.matchmaker_send_day21_unlocks();$$
);

SELECT cron.schedule(
  'matchmaker-subscription-pause',
  '0 * * * *',
  $$SELECT public.matchmaker_pause_expired_subscriptions();$$
);

NOTIFY pgrst, 'reload schema';
