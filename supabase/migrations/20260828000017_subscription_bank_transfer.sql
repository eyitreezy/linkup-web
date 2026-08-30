-- Subscription bank transfer sessions (mirrors escrow virtual_account_sessions pattern).

CREATE TABLE IF NOT EXISTS public.subscription_bank_transfer_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  tier TEXT NOT NULL CHECK (tier IN ('SILVER', 'GOLD', 'PLATINUM')),
  billing_cycle TEXT NOT NULL CHECK (billing_cycle IN ('monthly', 'annual')),
  amount_cents INT NOT NULL CHECK (amount_cents > 0),
  tx_ref TEXT NOT NULL UNIQUE,
  account_number TEXT NOT NULL,
  bank_name TEXT NOT NULL,
  bank_code TEXT NOT NULL DEFAULT '035',
  flutterwave_order_ref TEXT NOT NULL,
  refund_account_id UUID REFERENCES public.user_payment_accounts(id) ON DELETE SET NULL,
  one_time_refund_bank_code TEXT,
  one_time_refund_account_number TEXT,
  one_time_refund_account_name TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'funded', 'expired')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  activated_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS subscription_bank_transfer_sessions_user_idx
  ON public.subscription_bank_transfer_sessions (user_id, created_at DESC);

ALTER TABLE public.subscription_bank_transfer_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS subscription_bank_transfer_sessions_select_own ON public.subscription_bank_transfer_sessions;
CREATE POLICY subscription_bank_transfer_sessions_select_own
  ON public.subscription_bank_transfer_sessions
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public._subscription_tier_price_cents(
  p_tier TEXT,
  p_billing_cycle TEXT
)
RETURNS INT
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  IF p_tier = 'SILVER' AND p_billing_cycle = 'monthly' THEN RETURN 100000; END IF;
  IF p_tier = 'SILVER' AND p_billing_cycle = 'annual' THEN RETURN 1000000; END IF;
  IF p_tier = 'GOLD' AND p_billing_cycle = 'monthly' THEN RETURN 150000; END IF;
  IF p_tier = 'GOLD' AND p_billing_cycle = 'annual' THEN RETURN 1500000; END IF;
  IF p_tier = 'PLATINUM' AND p_billing_cycle = 'monthly' THEN RETURN 300000; END IF;
  IF p_tier = 'PLATINUM' AND p_billing_cycle = 'annual' THEN RETURN 3000000; END IF;
  RETURN 0;
END;
$$;

CREATE OR REPLACE FUNCTION public._activate_subscription_from_bank_transfer_session(
  p_session public.subscription_bank_transfer_sessions
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _user public.users%ROWTYPE;
  _from_tier TEXT;
  _expires TIMESTAMPTZ;
  _had_active BOOLEAN;
  _expected INT;
BEGIN
  IF p_session.status <> 'funded' THEN
    RETURN FALSE;
  END IF;

  IF p_session.activated_at IS NOT NULL THEN
    RETURN TRUE;
  END IF;

  _expected := public._subscription_tier_price_cents(p_session.tier, p_session.billing_cycle);
  IF _expected > 0 AND p_session.amount_cents <> _expected THEN
    RAISE EXCEPTION 'payment_amount_mismatch';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.subscription_events
    WHERE user_id = p_session.user_id
      AND flutterwave_reference = p_session.tx_ref
      AND event_type = 'payment_succeeded'
  ) THEN
    UPDATE public.subscription_bank_transfer_sessions
    SET activated_at = COALESCE(activated_at, NOW())
    WHERE id = p_session.id;
    RETURN TRUE;
  END IF;

  SELECT * INTO _user FROM public.users WHERE id = p_session.user_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;

  _from_tier := COALESCE(_user.subscription_tier::text, 'FREE');
  _had_active :=
    _from_tier <> 'FREE'
    AND _user.subscription_expires_at IS NOT NULL
    AND _user.subscription_expires_at > NOW();

  IF p_session.billing_cycle = 'monthly' THEN
    _expires := NOW() + INTERVAL '1 month';
  ELSE
    _expires := NOW() + INTERVAL '1 year';
  END IF;

  UPDATE public.users
  SET
    subscription_tier = p_session.tier,
    billing_cycle = p_session.billing_cycle,
    subscription_expires_at = _expires,
    subscription_status = 'active',
    has_been_silver_subscriber = CASE WHEN p_session.tier = 'SILVER' THEN TRUE ELSE has_been_silver_subscriber END,
    updated_at = NOW()
  WHERE id = p_session.user_id;

  INSERT INTO public.subscription_events (
    user_id, event_type, from_tier, to_tier, billing_cycle, amount_ngn, flutterwave_reference, metadata
  ) VALUES (
    p_session.user_id,
    'payment_succeeded',
    _from_tier,
    p_session.tier,
    p_session.billing_cycle,
    (p_session.amount_cents / 100)::INT,
    p_session.tx_ref,
    jsonb_build_object('payment_method', 'bank_transfer', 'session_id', p_session.id)
  );

  INSERT INTO public.subscription_events (
    user_id, event_type, from_tier, to_tier, billing_cycle, amount_ngn, flutterwave_reference
  ) VALUES (
    p_session.user_id,
    CASE WHEN _had_active THEN 'subscription_renewed' ELSE 'subscription_created' END,
    _from_tier,
    p_session.tier,
    p_session.billing_cycle,
    (p_session.amount_cents / 100)::INT,
    p_session.tx_ref
  );

  UPDATE public.subscription_bank_transfer_sessions
  SET activated_at = NOW()
  WHERE id = p_session.id;

  RETURN TRUE;
END;
$$;

CREATE OR REPLACE FUNCTION public.check_subscription_bank_transfer_funded(p_session_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _session public.subscription_bank_transfer_sessions%ROWTYPE;
BEGIN
  SELECT * INTO _session
  FROM public.subscription_bank_transfer_sessions
  WHERE id = p_session_id
    AND user_id = auth.uid();

  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;

  IF _session.status = 'funded' THEN
    PERFORM public._activate_subscription_from_bank_transfer_session(_session);
    RETURN TRUE;
  END IF;

  RETURN FALSE;
END;
$$;

CREATE OR REPLACE FUNCTION public.sync_subscription_from_bank_transfer(p_session_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _session public.subscription_bank_transfer_sessions%ROWTYPE;
BEGIN
  SELECT * INTO _session
  FROM public.subscription_bank_transfer_sessions
  WHERE id = p_session_id
    AND user_id = auth.uid()
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;

  IF _session.status = 'funded' THEN
    RETURN public._activate_subscription_from_bank_transfer_session(_session);
  END IF;

  RETURN FALSE;
END;
$$;

CREATE OR REPLACE FUNCTION public.confirm_sandbox_subscription_bank_transfer(p_session_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _session public.subscription_bank_transfer_sessions%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN FALSE;
  END IF;

  SELECT * INTO _session
  FROM public.subscription_bank_transfer_sessions
  WHERE id = p_session_id
    AND user_id = auth.uid()
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'session_not_found';
  END IF;

  IF lower(trim(COALESCE(_session.bank_name, ''))) NOT LIKE '%mock%'
    AND lower(trim(COALESCE(_session.bank_name, ''))) NOT LIKE '%test%'
    AND lower(trim(COALESCE(_session.bank_name, ''))) <> 'virtual bank' THEN
    RAISE EXCEPTION 'sandbox_only';
  END IF;

  IF _session.status = 'expired'
    OR (_session.expires_at IS NOT NULL AND _session.expires_at < NOW()) THEN
    RAISE EXCEPTION 'session_expired';
  END IF;

  UPDATE public.subscription_bank_transfer_sessions
  SET status = 'funded'
  WHERE id = p_session_id;

  SELECT * INTO _session FROM public.subscription_bank_transfer_sessions WHERE id = p_session_id;
  RETURN public._activate_subscription_from_bank_transfer_session(_session);
END;
$$;

GRANT EXECUTE ON FUNCTION public.check_subscription_bank_transfer_funded(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.sync_subscription_from_bank_transfer(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.confirm_sandbox_subscription_bank_transfer(UUID) TO authenticated;
