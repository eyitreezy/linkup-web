/**
 * Enable Supabase Realtime on tables used by offers, plan management, admin queues,
 * discover feed, and wallet.
 */
DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOREACH tbl IN ARRAY ARRAY[
    'plan_offers',
    'plans',
    'verification_requests',
    'reports',
    'moderation_logs',
    'disputes',
    'escrow_disputes',
    'support_tickets',
    'wallet_ledger',
    'goodwill_credits'
  ]
  LOOP
    EXECUTE format('ALTER TABLE public.%I REPLICA IDENTITY FULL', tbl);
  END LOOP;
END $$;

DO $$
DECLARE
  tbl TEXT;
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    FOREACH tbl IN ARRAY ARRAY[
      'plan_offers',
      'plans',
      'verification_requests',
      'reports',
      'moderation_logs',
      'disputes',
      'escrow_disputes',
      'support_tickets',
      'wallet_ledger',
      'goodwill_credits'
    ]
    LOOP
      IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables
        WHERE pubname = 'supabase_realtime'
          AND schemaname = 'public'
          AND tablename = tbl
      ) THEN
        EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', tbl);
      END IF;
    END LOOP;
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
