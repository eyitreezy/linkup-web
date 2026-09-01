-- Pre-expiry warning notifications at 24h, 12h, 6h, 3h, and 2h before meetup.

CREATE TABLE IF NOT EXISTS public.plan_expiry_warnings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id UUID NOT NULL REFERENCES public.plans(id) ON DELETE CASCADE,
  warning_hours INT NOT NULL,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(plan_id, warning_hours)
);

ALTER TABLE public.plan_expiry_warnings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_role_all" ON public.plan_expiry_warnings;
CREATE POLICY "service_role_all" ON public.plan_expiry_warnings
  FOR ALL USING (auth.role() = 'service_role');

CREATE OR REPLACE FUNCTION public.send_plan_expiry_warnings()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _plan RECORD;
  _hours_until NUMERIC;
  _warning_hour INT;
  _warning_hours INT[] := ARRAY[24, 12, 6, 3, 2];
  _message TEXT;
BEGIN
  FOR _plan IN
    SELECT p.id, p.creator_id, p.title,
           COALESCE(p.agreed_scheduled_at, p.scheduled_at) AS meetup_at
    FROM public.plans p
    WHERE
      p.status IN ('negotiating', 'agreed', 'awaiting_payment', 'active')
      AND COALESCE(p.agreed_scheduled_at, p.scheduled_at) IS NOT NULL
      AND COALESCE(p.agreed_scheduled_at, p.scheduled_at) > NOW()
      AND COALESCE(p.is_expired, false) = false
  LOOP
    _hours_until := EXTRACT(EPOCH FROM (_plan.meetup_at - NOW())) / 3600;

    FOREACH _warning_hour IN ARRAY _warning_hours LOOP
      IF _hours_until <= _warning_hour AND _hours_until > (_warning_hour - 0.5) THEN
        IF NOT EXISTS (
          SELECT 1 FROM public.plan_expiry_warnings
          WHERE plan_id = _plan.id AND warning_hours = _warning_hour
        ) THEN
          INSERT INTO public.plan_expiry_warnings (plan_id, warning_hours)
          VALUES (_plan.id, _warning_hour)
          ON CONFLICT DO NOTHING;

          _message := CASE _warning_hour
            WHEN 24 THEN 'Your meetup is in 24 hours. Make sure everything is confirmed.'
            WHEN 12 THEN 'Your meetup is in 12 hours. Everyone should be ready.'
            WHEN 6  THEN 'Your meetup is 6 hours away.'
            WHEN 3  THEN 'Your meetup starts in 3 hours.'
            WHEN 2  THEN 'Your meetup starts in 2 hours. Last chance to confirm.'
            ELSE 'Your meetup is approaching.'
          END;

          PERFORM public.create_notification(
            _plan.creator_id,
            'plan_reminder',
            'Meetup reminder (' || _warning_hour || 'h to go)',
            _message,
            jsonb_build_object('planId', _plan.id, 'href', '/plan/' || _plan.id),
            'medium',
            NULL
          );
        END IF;
      END IF;
    END LOOP;
  END LOOP;
END;
$$;

SELECT cron.schedule(
  'send-plan-expiry-warnings',
  '*/30 * * * *',
  $$SELECT public.send_plan_expiry_warnings()$$
);

GRANT EXECUTE ON FUNCTION public.send_plan_expiry_warnings() TO service_role;

NOTIFY pgrst, 'reload schema';
