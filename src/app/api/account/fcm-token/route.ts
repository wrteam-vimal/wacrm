import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { token } = await request.json();
    if (!token) {
      return NextResponse.json({ error: 'FCM token is required' }, { status: 400 });
    }

    // Resolve the account ID of the user
    const { data: profile, error: profileErr } = await supabase
      .from('profiles')
      .select('account_id')
      .eq('user_id', user.id)
      .maybeSingle();

    if (profileErr || !profile?.account_id) {
      return NextResponse.json(
        { error: 'Profile not linked to an account.' },
        { status: 403 }
      );
    }

    // Insert or update fcm token
    const { error: upsertErr } = await supabase
      .from('fcm_tokens')
      .upsert(
        {
          user_id: user.id,
          account_id: profile.account_id,
          token,
        },
        { onConflict: 'user_id,token' }
      );

    if (upsertErr) {
      console.error('[FCM API] Upsert failed:', upsertErr.message);
      return NextResponse.json({ error: upsertErr.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('[FCM API] POST error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { token } = await request.json();
    if (!token) {
      return NextResponse.json({ error: 'FCM token is required' }, { status: 400 });
    }

    // Delete token
    const { error: deleteErr } = await supabase
      .from('fcm_tokens')
      .delete()
      .eq('user_id', user.id)
      .eq('token', token);

    if (deleteErr) {
      console.error('[FCM API] Delete failed:', deleteErr.message);
      return NextResponse.json({ error: deleteErr.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('[FCM API] DELETE error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
