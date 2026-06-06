-- ============================================================
-- 026_webhook_logs.sql — System Logs feature
--
-- Creates the webhook_logs table to capture Meta webhook requests,
-- signature validations, decryption statuses, and execution errors.
-- ============================================================

CREATE TABLE IF NOT EXISTS webhook_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID REFERENCES accounts(id) ON DELETE CASCADE,
  phone_number_id TEXT,
  event_type TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL CHECK (status IN ('success', 'failed')),
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for fast queries ordered by date
CREATE INDEX IF NOT EXISTS idx_webhook_logs_account_created
  ON webhook_logs(account_id, created_at DESC);

-- Enable RLS
ALTER TABLE webhook_logs ENABLE ROW LEVEL SECURITY;

-- Allow account members to view logs of their account
DROP POLICY IF EXISTS webhook_logs_select ON webhook_logs;
CREATE POLICY webhook_logs_select ON webhook_logs FOR SELECT
  USING (is_account_member(account_id));
