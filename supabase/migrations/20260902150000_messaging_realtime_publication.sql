/**
 * Enable Supabase Realtime on messaging, read receipts, notifications,
 * and negotiation round tables used by client postgres_changes subscriptions.
 */
DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOREACH tbl IN ARRAY ARRAY[
    'messages',
    'conversation_reads',
    'notifications',
    'plan_offer_rounds',
    'group_chat_members',
    'message_user_deletions'
  ]
  LOOP
    IF EXISTS (
      SELECT 1 FROM pg_tables
      WHERE schemaname = 'public' AND tablename = tbl
    ) THEN
      EXECUTE format('ALTER TABLE public.%I REPLICA IDENTITY FULL', tbl);
    END IF;
  END LOOP;
END $$;

DO $$
DECLARE
  tbl TEXT;
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    FOREACH tbl IN ARRAY ARRAY[
      'messages',
      'conversation_reads',
      'notifications',
      'plan_offer_rounds',
      'group_chat_members',
      'message_user_deletions'
    ]
    LOOP
      IF EXISTS (
        SELECT 1 FROM pg_tables
        WHERE schemaname = 'public' AND tablename = tbl
      )
      AND NOT EXISTS (
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
