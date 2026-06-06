import { supabaseAdmin } from '@/lib/flows/admin-client';

interface LogSystemErrorParams {
  accountId?: string | null;
  userId?: string | null;
  errorMessage: string;
  stackTrace?: string | null;
  url?: string | null;
  component?: string | null;
  severity?: 'info' | 'warning' | 'error' | 'critical';
  metadata?: any;
}

/**
 * Logs a system/website error directly to the `system_errors` table using the admin bypass client.
 * Safe to call from any server-side context (API routes, server actions, cron handlers, automations, etc.).
 */
export async function logSystemError(params: LogSystemErrorParams) {
  try {
    const db = supabaseAdmin();
    const { error } = await db.from('system_errors').insert({
      account_id: params.accountId || null,
      user_id: params.userId || null,
      error_message: params.errorMessage,
      stack_trace: params.stackTrace || null,
      url: params.url || null,
      component: params.component || null,
      severity: params.severity || 'error',
      metadata: params.metadata || {},
    });

    if (error) {
      console.error('[error-logger] Failed to insert system error log:', error);
    }
  } catch (err) {
    console.error('[error-logger] Failed to write system error:', err);
  }
}
