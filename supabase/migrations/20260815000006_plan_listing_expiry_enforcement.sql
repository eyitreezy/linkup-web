-- Unified plan listing expiration + backend enforcement for offers, joins, and invitations.

CREATE OR REPLACE FUNCTION public.plan_is_listing_expired(p_plan public.plans)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
AS $$
  SELECT
    COALESCE(p_plan.is_expired, false)
    OR (
      COALESCE(p_plan.is_mood_plan, false)
      AND p_plan.mood_expires_at IS NOT NULL
      AND p_plan.mood_expires_at <= NOW()
    )
    OR (
      NOT COALESCE(p_plan.is_mood_plan, false)
      AND p_plan.active_expires_at IS NOT NULL
      AND p_plan.active_expires_at <= NOW()
    );
$$;

GRANT EXECUTE ON FUNCTION public.plan_is_listing_expired(public.plans) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.trg_enforce_plan_listing_active()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  _plan public.plans%ROWTYPE;
BEGIN
  SELECT * INTO _plan FROM public.plans WHERE id = NEW.plan_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'plan_not_found';
  END IF;
  IF public.plan_is_listing_expired(_plan) THEN
    RAISE EXCEPTION 'plan_listing_expired';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS plan_offers_listing_active ON public.plan_offers;
CREATE TRIGGER plan_offers_listing_active
  BEFORE INSERT ON public.plan_offers
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_enforce_plan_listing_active();

DROP TRIGGER IF EXISTS plan_join_requests_listing_active ON public.plan_join_requests;
CREATE TRIGGER plan_join_requests_listing_active
  BEFORE INSERT ON public.plan_join_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_enforce_plan_listing_active();

DROP TRIGGER IF EXISTS plan_invitations_listing_active ON public.plan_invitations;
CREATE TRIGGER plan_invitations_listing_active
  BEFORE INSERT ON public.plan_invitations
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_enforce_plan_listing_active();

-- Block guest/host counter rounds once listing window has ended.
CREATE OR REPLACE FUNCTION public.trg_enforce_plan_listing_active_on_offer_update()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  _plan public.plans%ROWTYPE;
BEGIN
  IF NEW.status IS NOT DISTINCT FROM OLD.status
     AND NEW.current_amount_cents IS NOT DISTINCT FROM OLD.current_amount_cents THEN
    RETURN NEW;
  END IF;

  SELECT * INTO _plan FROM public.plans WHERE id = NEW.plan_id;
  IF public.plan_is_listing_expired(_plan) THEN
    RAISE EXCEPTION 'plan_listing_expired';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS plan_offers_listing_active_update ON public.plan_offers;
CREATE TRIGGER plan_offers_listing_active_update
  BEFORE UPDATE ON public.plan_offers
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_enforce_plan_listing_active_on_offer_update();
