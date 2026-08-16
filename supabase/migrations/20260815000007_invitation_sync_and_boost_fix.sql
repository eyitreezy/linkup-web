-- Link pending email invitations to authenticated users (once) and repair boost/escrow triggers.

-- ---------------------------------------------------------------------------
-- Escrow trigger comparisons: always use ::text (20260622000001 repair, idempotent)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.tr_financial_log_escrow()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.amount_cents IS NOT NULL AND NEW.amount_cents > 0 THEN
      PERFORM public.append_financial_event(
        NEW.payer_id,
        'escrow_created',
        NEW.amount_cents,
        'escrow:' || NEW.id::text || ':created',
        jsonb_build_object('plan_id', NEW.plan_id)
      );
    END IF;
  ELSIF TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status THEN
    IF NEW.status::text = 'funded' THEN
      PERFORM public.append_financial_event(
        NEW.payer_id,
        'escrow_funded',
        NEW.amount_cents,
        'escrow:' || NEW.id::text || ':funded',
        jsonb_build_object('paystack_reference', NEW.paystack_reference)
      );
    ELSIF NEW.status::text = 'released' THEN
      PERFORM public.append_financial_event(
        NEW.payee_id,
        'escrow_released',
        COALESCE(NEW.amount_cents, 0) - COALESCE(NEW.platform_fee_cents, 0),
        'escrow:' || NEW.id::text || ':released',
        jsonb_build_object('fee', NEW.platform_fee_cents)
      );
    ELSIF NEW.status::text = 'disputed' THEN
      PERFORM public.append_financial_event(
        NEW.payer_id,
        'escrow_disputed',
        NEW.amount_cents,
        'escrow:' || NEW.id::text || ':disputed',
        '{}'::jsonb
      );
    END IF;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE OR REPLACE FUNCTION public.trg_escrow_try_activate_group_split()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status::text IN ('funded', 'active')
     AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM NEW.status) THEN
    PERFORM public.try_activate_group_split_plan(NEW.plan_id);
  END IF;
  RETURN NEW;
END;
$$;

-- ---------------------------------------------------------------------------
-- Plan boost: single RPC (quota + plan update, ownership validated server-side)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.activate_plan_boost(
  p_plan_id UUID,
  p_hours INT DEFAULT 24
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
DECLARE
  _user_id UUID := auth.uid();
  _plan public.plans%ROWTYPE;
  _hours INT;
  _kind TEXT;
  _until TIMESTAMPTZ;
BEGIN
  IF _user_id IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '28000';
  END IF;

  _hours := CASE WHEN COALESCE(p_hours, 24) >= 72 THEN 72 ELSE 24 END;
  _kind := CASE WHEN _hours >= 72 THEN 'boosts_72hr' ELSE 'boosts_24hr' END;

  SELECT * INTO _plan
  FROM public.plans
  WHERE id = p_plan_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'plan_not_found';
  END IF;

  IF _plan.creator_id IS DISTINCT FROM _user_id AND NOT public.is_admin(_user_id) THEN
    RAISE EXCEPTION 'not_plan_creator';
  END IF;

  IF _plan.boosted_until IS NOT NULL AND _plan.boosted_until > NOW() THEN
    RAISE EXCEPTION 'boost_already_active';
  END IF;

  IF public.plan_is_listing_expired(_plan) THEN
    RAISE EXCEPTION 'plan_listing_expired';
  END IF;

  IF COALESCE(_plan.is_mood_plan, false)
     AND _plan.mood_expires_at IS NOT NULL
     AND _plan.mood_expires_at <= NOW() THEN
    RAISE EXCEPTION 'mood_plan_closed';
  END IF;

  PERFORM public.record_boost_usage(_kind);

  _until := NOW() + (_hours || ' hours')::INTERVAL;

  UPDATE public.plans
  SET
    boosted_until = _until,
    spotlight_enabled = TRUE,
    updated_at = NOW()
  WHERE id = p_plan_id;

  RETURN jsonb_build_object(
    'ok', true,
    'boostedUntil', _until,
    'hours', _hours
  );
END;
$$;

REVOKE ALL ON FUNCTION public.activate_plan_boost(UUID, INT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.activate_plan_boost(UUID, INT) TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Sync pending email invitations after signup/login (idempotent notifications)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.sync_pending_plan_invitations_for_user(p_token UUID DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
DECLARE
  _user_id UUID := auth.uid();
  _email TEXT;
  _invitation public.plan_invitations%ROWTYPE;
  _host_name TEXT;
  _plan_title TEXT;
  _linked INT := 0;
  _notified INT := 0;
BEGIN
  IF _user_id IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '28000';
  END IF;

  SELECT lower(trim(u.email)) INTO _email
  FROM public.users u
  WHERE u.id = _user_id;

  FOR _invitation IN
    SELECT pi.*
    FROM public.plan_invitations pi
    WHERE pi.status = 'pending'
      AND pi.expires_at > NOW()
      AND (
        (p_token IS NOT NULL AND pi.invitation_token = p_token)
        OR (
          _email IS NOT NULL
          AND pi.invitee_email IS NOT NULL
          AND lower(trim(pi.invitee_email)) = _email
          AND (pi.invitee_user_id IS NULL OR pi.invitee_user_id = _user_id)
        )
      )
    FOR UPDATE
  LOOP
    IF _invitation.invitee_user_id IS NOT NULL
       AND _invitation.invitee_user_id IS DISTINCT FROM _user_id THEN
      CONTINUE;
    END IF;

    IF _invitation.invitee_user_id IS NULL THEN
      UPDATE public.plan_invitations
      SET invitee_user_id = _user_id
      WHERE id = _invitation.id;
      _linked := _linked + 1;
    END IF;

    IF NOT EXISTS (
      SELECT 1
      FROM public.notifications n
      WHERE n.user_id = _user_id
        AND n.dedupe_key = 'plan_invitation_received:' || _invitation.id::text
    ) THEN
      SELECT display_name INTO _host_name
      FROM public.profiles
      WHERE user_id = _invitation.host_id;

      SELECT title INTO _plan_title
      FROM public.plans
      WHERE id = _invitation.plan_id;

      PERFORM public.create_notification(
        _user_id,
        'plan_invitation_received',
        'You have been invited to a meetup',
        format(
          '%s invited you to join %s. Verify your identity to respond.',
          COALESCE(_host_name, 'Someone'),
          COALESCE(NULLIF(trim(_plan_title), ''), 'a group plan')
        ),
        jsonb_build_object(
          'href', '/plan/' || _invitation.plan_id::text || '/invitation/' || _invitation.id::text,
          'planId', _invitation.plan_id::text,
          'invitationId', _invitation.id::text,
          'hostName', _host_name
        ),
        'medium',
        'plan_invitation_received:' || _invitation.id::text
      );
      _notified := _notified + 1;
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'linked', _linked,
    'notified', _notified
  );
END;
$$;

REVOKE ALL ON FUNCTION public.sync_pending_plan_invitations_for_user(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sync_pending_plan_invitations_for_user(UUID) TO authenticated;

CREATE OR REPLACE FUNCTION public.link_invitation_after_signup(p_token UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
DECLARE
  _result JSONB;
  _invitation public.plan_invitations%ROWTYPE;
BEGIN
  _result := public.sync_pending_plan_invitations_for_user(p_token);

  SELECT * INTO _invitation
  FROM public.plan_invitations
  WHERE invitation_token = p_token
    AND status = 'pending'
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('linked', false) || COALESCE(_result, '{}'::jsonb);
  END IF;

  RETURN jsonb_build_object(
    'linked', true,
    'planId', _invitation.plan_id,
    'invitationId', _invitation.id
  ) || COALESCE(_result, '{}'::jsonb);
END;
$$;

REVOKE ALL ON FUNCTION public.link_invitation_after_signup(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.link_invitation_after_signup(UUID) TO authenticated;
