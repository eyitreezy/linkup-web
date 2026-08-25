-- Group split plans (escrow pattern B) were missing host cancellation matrix rows,
-- causing get_cancellation_terms to raise no_matrix_entry_found.

INSERT INTO public.cancellation_matrix (
  plan_type, escrow_pattern, timing_band, cancelling_party,
  canceller_refund_percent, other_party_penalty_percent,
  other_party_goodwill_credit, trust_strikes,
  visibility_reduction_percent, visibility_reduction_days,
  creation_hold_days, requires_admin_review, early_cancel_count_threshold
) VALUES
  ('group', 'B', '72h_plus', 'host', 100, 0, 'none', 0, 0, 0, 0, false, 3),
  ('group', 'B', '48_72h', 'host', 80, 20, 'standard', 1, 20, 30, 0, false, null),
  ('group', 'B', '24_48h', 'host', 70, 30, 'standard', 1, 40, 30, 7, false, null),
  ('group', 'B', 'within_24h', 'host', 60, 40, 'enhanced', 2, 0, 0, 14, true, null),
  ('group', 'B', 'no_show_emergency', 'host', 65, 35, 'standard', 1, 0, 0, 0, false, null),
  ('group', 'B', 'no_show_no_contact', 'host', 50, 50, 'enhanced', 2, 0, 0, 0, true, null),
  ('group', 'C', '72h_plus', 'host', 100, 0, 'none', 0, 0, 0, 0, false, 3),
  ('group', 'C', '48_72h', 'host', 80, 20, 'standard', 1, 20, 30, 0, false, null),
  ('group', 'C', '24_48h', 'host', 70, 30, 'standard', 1, 40, 30, 7, false, null),
  ('group', 'C', 'within_24h', 'host', 60, 40, 'enhanced', 2, 0, 0, 14, true, null),
  ('group', 'C', 'no_show_emergency', 'host', 65, 35, 'standard', 1, 0, 0, 0, false, null),
  ('group', 'C', 'no_show_no_contact', 'host', 50, 50, 'enhanced', 2, 0, 0, 0, true, null)
ON CONFLICT DO NOTHING;

-- Defensive fallback: pattern B/C group host lookups may reuse group A host band if a row is missing.
CREATE OR REPLACE FUNCTION public.get_cancellation_terms(
  p_plan_id UUID,
  p_cancelling_party TEXT DEFAULT 'host',
  p_no_show BOOLEAN DEFAULT false
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _plan public.plans%ROWTYPE;
  _hours_until NUMERIC;
  _timing_band TEXT;
  _matrix public.cancellation_matrix%ROWTYPE;
  _plan_type TEXT;
  _pattern TEXT;
BEGIN
  SELECT * INTO _plan FROM public.plans WHERE id = p_plan_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'plan_not_found'; END IF;

  _hours_until := EXTRACT(EPOCH FROM (COALESCE(_plan.agreed_scheduled_at, _plan.scheduled_at, NOW()) - NOW())) / 3600;
  _timing_band := public._cancellation_timing_band(_hours_until, p_no_show);
  _plan_type := public._plan_type_label(_plan);
  _pattern := COALESCE(_plan.escrow_pattern, 'A');

  SELECT * INTO _matrix
  FROM public.cancellation_matrix
  WHERE plan_type = _plan_type
    AND escrow_pattern = _pattern
    AND timing_band = _timing_band
    AND cancelling_party IN (p_cancelling_party, 'either')
  ORDER BY CASE WHEN cancelling_party = p_cancelling_party THEN 0 ELSE 1 END
  LIMIT 1;

  IF NOT FOUND AND _plan_type = 'group' AND _pattern IN ('B', 'C') AND p_cancelling_party = 'host' THEN
    SELECT * INTO _matrix
    FROM public.cancellation_matrix
    WHERE plan_type = 'group'
      AND escrow_pattern = 'A'
      AND timing_band = _timing_band
      AND cancelling_party = 'host'
    LIMIT 1;
  END IF;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'no_matrix_entry_found';
  END IF;

  RETURN jsonb_build_object(
    'timing_band', _timing_band,
    'hours_until_meetup', ROUND(_hours_until::NUMERIC, 1),
    'canceller_refund_percent', _matrix.canceller_refund_percent,
    'other_party_penalty_percent', _matrix.other_party_penalty_percent,
    'other_party_goodwill_credit', _matrix.other_party_goodwill_credit,
    'trust_strikes', _matrix.trust_strikes,
    'visibility_reduction_percent', _matrix.visibility_reduction_percent,
    'visibility_reduction_days', _matrix.visibility_reduction_days,
    'creation_hold_days', _matrix.creation_hold_days,
    'requires_admin_review', _matrix.requires_admin_review,
    'escrow_pattern', _pattern,
    'plan_type', _plan_type,
    'is_group_plan', COALESCE(_plan.is_group_plan, false)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_cancellation_terms(UUID, TEXT, BOOLEAN) TO authenticated;

NOTIFY pgrst, 'reload schema';
