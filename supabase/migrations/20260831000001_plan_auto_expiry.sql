-- Auto-expire overdue plans and apply cancellation refunds (service-role cron job).

CREATE OR REPLACE FUNCTION public.apply_plan_cancellation(
  p_plan_id UUID,
  p_action TEXT DEFAULT 'host_no_contact'
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _plan public.plans%ROWTYPE;
  _terms JSONB;
  _host_refund_pct INT;
  _guest UUID;
  _goodwill TEXT;
  _goodwill_base INT;
  _goodwill_amt INT;
  _no_show BOOLEAN;
BEGIN
  SELECT * INTO _plan FROM public.plans WHERE id = p_plan_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN;
  END IF;

  _no_show := p_action IN ('host_no_contact', 'no_show_no_contact', 'no_show');

  UPDATE public.escrow_transactions
  SET status = 'cancelled', updated_at = NOW()
  WHERE plan_id = p_plan_id
    AND status = 'pending_funding';

  IF COALESCE(_plan.is_group_plan, false) THEN
    _terms := public.get_cancellation_terms(p_plan_id, 'host', _no_show);
    _host_refund_pct := COALESCE((_terms->>'canceller_refund_percent')::int, 100);
    _goodwill := COALESCE(_terms->>'other_party_goodwill_credit', 'none');
    _goodwill_base := public._group_cancellation_goodwill_base(_plan, _goodwill);

    PERFORM public._refund_all_group_plan_guest_escrows(p_plan_id, true);
    PERFORM public._refund_group_host_escrow(p_plan_id, _host_refund_pct, true);

    FOR _guest IN
      SELECT DISTINCT guest_id
      FROM (
        SELECT po.bidder_id AS guest_id
        FROM public.plan_offers po
        WHERE po.plan_id = p_plan_id
          AND po.status = 'accepted'::public.offer_status
        UNION
        SELECT jr.requester_id AS guest_id
        FROM public.plan_join_requests jr
        WHERE jr.plan_id = p_plan_id
          AND jr.status = 'approved'
      ) guests
      WHERE guest_id IS NOT NULL
    LOOP
      IF _goodwill_base > 0 THEN
        _goodwill_amt := public.goodwill_credit_amount(_guest, _goodwill_base);
        IF _goodwill_amt > 0 THEN
          PERFORM public._goodwill_issue_internal(
            _guest,
            _goodwill_amt,
            'cancellation',
            p_plan_id::text || ':guest:' || _guest::text
          );
        END IF;
      END IF;
    END LOOP;
  ELSE
    _terms := public.get_cancellation_terms(p_plan_id, 'host', _no_show);
    _host_refund_pct := COALESCE((_terms->>'canceller_refund_percent')::int, 100);

    PERFORM public._refund_all_group_plan_guest_escrows(p_plan_id, true);
    PERFORM public._refund_group_host_escrow(p_plan_id, _host_refund_pct, true);
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.auto_expire_overdue_plans()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _plan RECORD;
BEGIN
  FOR _plan IN
    SELECT id, status, scheduled_at, agreed_scheduled_at, creator_id,
           is_group_plan, escrow_pattern, host_escrow_id
    FROM public.plans
    WHERE
      status IN ('negotiating', 'agreed', 'awaiting_payment')
      AND COALESCE(agreed_scheduled_at, scheduled_at) IS NOT NULL
      AND COALESCE(agreed_scheduled_at, scheduled_at) < NOW()
      AND COALESCE(is_expired, false) = false
  LOOP
    UPDATE public.plans
    SET status = 'expired', is_expired = true, updated_at = NOW()
    WHERE id = _plan.id;

    PERFORM public.create_notification(
      _plan.creator_id,
      'plan_expired',
      'Your plan has expired',
      'The scheduled time has passed without confirmation. Escrow funds will be refunded per the cancellation policy.',
      jsonb_build_object('planId', _plan.id, 'href', '/plan/' || _plan.id),
      'high',
      NULL
    );

    BEGIN
      PERFORM public.apply_plan_cancellation(_plan.id, 'host_no_contact');
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING '[auto_expire] cancellation failed for plan %: %', _plan.id, SQLERRM;
    END;
  END LOOP;
END;
$$;

SELECT cron.schedule(
  'auto-expire-overdue-plans',
  '*/30 * * * *',
  $$SELECT public.auto_expire_overdue_plans()$$
);

GRANT EXECUTE ON FUNCTION public.apply_plan_cancellation(UUID, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.auto_expire_overdue_plans() TO service_role;

NOTIFY pgrst, 'reload schema';
