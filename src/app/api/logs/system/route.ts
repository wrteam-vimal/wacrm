import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { logSystemError } from '@/lib/error-logger';

export async function POST(request: Request) {
  try {
    const { error_message, stack_trace, url, component, severity, metadata } = await request.json();

    if (!error_message) {
      return NextResponse.json({ error: 'Missing required field: error_message' }, { status: 400 });
    }

    let accountId: string | null = null;
    let userId: string | null = null;

    try {
      const supabase = await createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        userId = user.id;
        const { data: profile } = await supabase
          .from('profiles')
          .select('account_id')
          .eq('user_id', user.id)
          .maybeSingle();
        
        if (profile?.account_id) {
          accountId = profile.account_id;
        }
      }
    } catch (err) {
      // Ignore auth/session errors; log anyway since this is an error logger
    }

    await logSystemError({
      accountId,
      userId,
      errorMessage: error_message,
      stackTrace: stack_trace,
      url,
      component,
      severity: severity || 'error',
      metadata: metadata || {},
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[system-errors-api] Unexpected exception in POST:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
