-- ============================================================
-- 027_system_errors.sql — Website & System Errors logging feature
--
-- Creates the system_errors table to capture runtime website errors,
-- API route exceptions, client-side failures, and console errors.
-- ============================================================

CREATE TABLE IF NOT EXISTS system_errors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID REFERENCES accounts(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  error_message TEXT NOT NULL,
  stack_trace TEXT,
  url TEXT,
  component TEXT,
  severity TEXT NOT NULL DEFAULT 'error' CHECK (severity IN ('info', 'warning', 'error', 'critical')),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for queries ordered by date
CREATE INDEX IF NOT EXISTS idx_system_errors_account_created
  ON system_errors(account_id, created_at DESC);

-- Enable RLS
ALTER TABLE system_errors ENABLE ROW LEVEL SECURITY;

-- Allow account members to view logs of their account
DROP POLICY IF EXISTS system_errors_select ON system_errors;
CREATE POLICY system_errors_select ON system_errors FOR SELECT
  USING (is_account_member(account_id));

-- Allow admins/owners to clear system errors
DROP POLICY IF EXISTS system_errors_delete ON system_errors;
CREATE POLICY system_errors_delete ON system_errors FOR DELETE
  USING (is_account_member(account_id, 'admin'));

-- Allow insert from anyone (so client errors can be posted)
DROP POLICY IF EXISTS system_errors_insert ON system_errors;
CREATE POLICY system_errors_insert ON system_errors FOR INSERT
  WITH CHECK (true);

-- Add delete policy for webhook_logs so client-side clear action works
DROP POLICY IF EXISTS webhook_logs_delete ON webhook_logs;
CREATE POLICY webhook_logs_delete ON webhook_logs FOR DELETE
  USING (is_account_member(account_id, 'admin'));
