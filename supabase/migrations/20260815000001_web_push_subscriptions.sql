CREATE TABLE IF NOT EXISTS public.web_push_subscriptions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint      TEXT NOT NULL,
  p256dh        TEXT NOT NULL,
  auth          TEXT NOT NULL,
  user_agent    TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_used_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, endpoint)
);

ALTER TABLE public.web_push_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_manage_own_subscriptions"
  ON public.web_push_subscriptions FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "service_role_all"
  ON public.web_push_subscriptions FOR ALL
  USING (auth.role() = 'service_role');

CREATE INDEX idx_web_push_user ON public.web_push_subscriptions(user_id);
