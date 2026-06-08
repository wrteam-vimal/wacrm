-- ============================================================
-- 032_realtime_replica_identity.sql
--
-- Sets REPLICA IDENTITY FULL on the tables used by Supabase Realtime
-- so that UPDATE and DELETE events carry the full old-row payload.
--
-- Without FULL:
--   - PostgreSQL only includes the PRIMARY KEY in the old record.
--   - Supabase Realtime cannot evaluate server-side filters on the
--     old row (e.g. `account_id=eq.<id>`), which breaks UPDATE/DELETE
--     events when explicit filters are used.
--   - INSERT events are unaffected (old row is empty by definition).
--
-- With FULL:
--   - All columns are included in both old and new records for every
--     change event, so server-side filters work reliably on every
--     event type.
--
-- Note: REPLICA IDENTITY FULL has a small WAL overhead but is the
-- recommended setting for tables subscribed via Supabase Realtime.
-- ============================================================

ALTER TABLE public.messages REPLICA IDENTITY FULL;
ALTER TABLE public.conversations REPLICA IDENTITY FULL;
