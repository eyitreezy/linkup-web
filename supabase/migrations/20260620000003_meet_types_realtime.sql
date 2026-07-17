/**
 * Enable Supabase Realtime on meet_types (admin panel + user picker live updates).
 */
ALTER TABLE public.meet_types REPLICA IDENTITY FULL;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime'
        AND schemaname = 'public'
        AND tablename = 'meet_types'
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.meet_types;
    END IF;
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
