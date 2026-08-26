-- After host removes a guest, revert plan to awaiting_payment until the full group
-- roster is filled again and every slot is funded.

CREATE OR REPLACE FUNCTION public.revalidate_group_plan_activation(p_plan_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _plan public.plans%ROWTYPE;
  _roster_full BOOLEAN;
  _all_funded BOOLEAN;
BEGIN
  SELECT * INTO _plan FROM public.plans WHERE id = p_plan_id;
  IF NOT FOUND OR NOT COALESCE(_plan.is_group_plan, false) THEN
    RETURN;
  END IF;

  IF _plan.status NOT IN ('active', 'awaiting_payment') THEN
    RETURN;
  END IF;

  _roster_full := COALESCE(_plan.accepted_guest_count, 0) >= COALESCE(_plan.max_guests, 0);

  _all_funded := NOT EXISTS (
    SELECT 1
    FROM public.escrow_transactions e
    WHERE e.plan_id = p_plan_id
      AND e.status NOT IN ('cancelled', 'refunded')
      AND NOT public.escrow_funding_complete(e)
  )
  AND EXISTS (
    SELECT 1
    FROM public.escrow_transactions e
    WHERE e.plan_id = p_plan_id
      AND e.status NOT IN ('cancelled', 'refunded')
  );

  IF NOT _roster_full OR NOT _all_funded THEN
    UPDATE public.plans
    SET status = 'awaiting_payment', updated_at = NOW()
    WHERE id = p_plan_id AND status = 'active';
    RETURN;
  END IF;

  IF _plan.status = 'awaiting_payment' THEN
    PERFORM public.try_activate_group_split_plan(p_plan_id);
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.submit_group_host_remove_guest(
  p_plan_id UUID,
  p_guest_user_id UUID,
  p_reason_type TEXT DEFAULT NULL,
  p_reason_text TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _host_id UUID := auth.uid();
  _plan public.plans%ROWTYPE;
  _escrow public.escrow_transactions%ROWTYPE;
  _slot_cents BIGINT := 0;
  _new_share BIGINT;
  _refund JSONB;
  _was_accepted BOOLEAN := false;
  _plan_title TEXT;
  _refund_cents INT := 0;
BEGIN
  IF _host_id IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  IF p_guest_user_id IS NULL OR p_guest_user_id = _host_id THEN
    RAISE EXCEPTION 'invalid_guest';
  END IF;

  SELECT * INTO _plan
  FROM public.plans
  WHERE id = p_plan_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'plan_not_found';
  END IF;

  IF _plan.creator_id <> _host_id THEN
    RAISE EXCEPTION 'not_plan_host';
  END IF;

  IF NOT COALESCE(_plan.is_group_plan, false) THEN
    RAISE EXCEPTION 'not_group_plan';
  END IF;

  IF _plan.status IN ('cancelled', 'completed') THEN
    RAISE EXCEPTION 'plan_not_removable';
  END IF;

  _was_accepted := EXISTS (
    SELECT 1 FROM public.plan_invitations
    WHERE plan_id = p_plan_id AND invitee_user_id = p_guest_user_id AND status = 'accepted'
  )
  OR EXISTS (
    SELECT 1 FROM public.plan_join_requests
    WHERE plan_id = p_plan_id AND requester_id = p_guest_user_id AND status = 'approved'
  )
  OR EXISTS (
    SELECT 1 FROM public.plan_offers
    WHERE plan_id = p_plan_id AND bidder_id = p_guest_user_id AND status = 'accepted'
  );

  IF NOT _was_accepted
    AND NOT EXISTS (
      SELECT 1 FROM public.plan_invitations
      WHERE plan_id = p_plan_id AND invitee_user_id = p_guest_user_id AND status = 'pending'
    )
    AND NOT EXISTS (
      SELECT 1 FROM public.plan_join_requests
      WHERE plan_id = p_plan_id AND requester_id = p_guest_user_id AND status = 'pending'
    )
    AND NOT EXISTS (
      SELECT 1 FROM public.plan_offers
      WHERE plan_id = p_plan_id
        AND bidder_id = p_guest_user_id
        AND status IN ('pending', 'countered', 'countered_by_host', 'countered_by_guest')
    ) THEN
    RAISE EXCEPTION 'guest_not_on_plan';
  END IF;

  SELECT * INTO _escrow
  FROM public.escrow_transactions
  WHERE plan_id = p_plan_id
    AND guest_id = p_guest_user_id
    AND status NOT IN ('cancelled', 'refunded')
  ORDER BY created_at DESC
  LIMIT 1;

  IF FOUND THEN
    _slot_cents := GREATEST(0, COALESCE(_escrow.guest_share_cents, _escrow.amount_cents, 0)::BIGINT);
  END IF;

  _refund := public._refund_group_guest_escrow(p_plan_id, p_guest_user_id, false);
  _refund_cents := COALESCE((_refund->>'amount_cents')::INT, 0);

  UPDATE public.plan_invitations
  SET
    status = 'declined',
    slot_held = FALSE,
    responded_at = NOW(),
    decline_reason = COALESCE(NULLIF(trim(p_reason_type), ''), 'host_removed'),
    decline_reason_other = CASE
      WHEN COALESCE(p_reason_type, '') = 'other' THEN NULLIF(trim(p_reason_text), '')
      ELSE NULL
    END
  WHERE plan_id = p_plan_id
    AND invitee_user_id = p_guest_user_id
    AND status IN ('pending', 'accepted');

  UPDATE public.plan_join_requests
  SET status = 'declined', updated_at = NOW(), responded_at = NOW()
  WHERE plan_id = p_plan_id
    AND requester_id = p_guest_user_id
    AND status IN ('pending', 'approved');

  UPDATE public.plan_offers
  SET status = 'declined', updated_at = NOW()
  WHERE plan_id = p_plan_id
    AND bidder_id = p_guest_user_id
    AND status IN ('pending', 'accepted', 'countered', 'countered_by_host', 'countered_by_guest');

  IF _was_accepted THEN
    _new_share := COALESCE(_plan.current_suggested_share_cents, 0)::BIGINT;
    IF public.is_group_split_dynamic_plan(_plan) THEN
      BEGIN
        _new_share := public.calculate_group_suggested_share(p_plan_id)::BIGINT;
      EXCEPTION
        WHEN numeric_value_out_of_range OR division_by_zero THEN
          _new_share := COALESCE(_plan.current_suggested_share_cents, 0)::BIGINT;
      END;
    END IF;

    UPDATE public.plans
    SET
      accepted_guest_count = GREATEST(0, COALESCE(accepted_guest_count, 0) - 1),
      accepted_guest_amounts_sum_cents = GREATEST(
        0,
        COALESCE(accepted_guest_amounts_sum_cents, 0)::BIGINT - _slot_cents
      )::INT,
      current_suggested_share_cents = LEAST(GREATEST(COALESCE(_new_share, 0), 0), 2147483647)::INT,
      updated_at = NOW()
    WHERE id = p_plan_id;
  ELSE
    UPDATE public.plans
    SET updated_at = NOW()
    WHERE id = p_plan_id;
  END IF;

  PERFORM public.revalidate_group_plan_activation(p_plan_id);

  _plan_title := COALESCE(NULLIF(trim(_plan.title), ''), 'your group plan');

  PERFORM public.create_notification(
    p_guest_user_id,
    'group_plan_guest_removed',
    'Removed from group plan',
    format(
      'The host removed you from "%s".%s',
      _plan_title,
      CASE
        WHEN _refund_cents > 0 THEN ' Your contribution has been refunded to your wallet.'
        ELSE ''
      END
    ),
    jsonb_build_object('href', '/plan/' || p_plan_id::text, 'planId', p_plan_id::text),
    'high',
    NULL
  );

  RETURN jsonb_build_object(
    'removed', true,
    'guest_user_id', p_guest_user_id,
    'reason_type', p_reason_type,
    'reason_text', p_reason_text,
    'refund', _refund
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.revalidate_group_plan_activation(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.submit_group_host_remove_guest(UUID, UUID, TEXT, TEXT) TO authenticated;

NOTIFY pgrst, 'reload schema';
