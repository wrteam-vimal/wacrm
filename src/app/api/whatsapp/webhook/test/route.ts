import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import crypto from 'node:crypto';

// Gated to owner and admin roles
async function requireAdmin(): Promise<
  | { ok: true; accountId: string }
  | { ok: false; status: number; message: string }
> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false, status: 401, message: 'Unauthorized' };
  }

  const { data: profile, error } = await supabase
    .from('profiles')
    .select('account_id, account_role')
    .eq('user_id', user.id)
    .maybeSingle();

  if (error || !profile?.account_id) {
    return { ok: false, status: 403, message: 'Profile not linked to an account.' };
  }

  if (profile.account_role !== 'owner' && profile.account_role !== 'admin') {
    return { ok: false, status: 403, message: 'Forbidden: Admin or Owner role required.' };
  }

  return { ok: true, accountId: profile.account_id };
}

export async function POST(request: Request) {
  const guard = await requireAdmin();
  if (!guard.ok) {
    return NextResponse.json({ error: guard.message }, { status: guard.status });
  }

  try {
    const { senderPhone, messageText, phoneNumberId } = await request.json();

    if (!senderPhone || !messageText || !phoneNumberId) {
      return NextResponse.json(
        { error: 'Missing required parameters: senderPhone, messageText, phoneNumberId' },
        { status: 400 }
      )
    }

    const cleanPhone = senderPhone.replace(/\D/g, '');

    // Construct a mock Meta Cloud API webhook payload
    const payload = JSON.stringify({
      object: 'whatsapp_business_account',
      entry: [
        {
          id: '1223995502755349',
          changes: [
            {
              value: {
                messaging_product: 'whatsapp',
                metadata: {
                  display_phone_number: '15550244444',
                  phone_number_id: phoneNumberId
                },
                contacts: [
                  {
                    profile: {
                      name: 'Diagnostic Test User'
                    },
                    wa_id: cleanPhone
                  }
                ],
                messages: [
                  {
                    from: cleanPhone,
                    id: 'wamid.test-' + Math.random().toString(36).substring(2),
                    timestamp: Math.floor(Date.now() / 1000).toString(),
                    text: {
                      body: messageText
                    },
                    type: 'text'
                  }
                ]
              },
              field: 'messages'
            }
          ]
        }
      ]
    });

    const secret = process.env.META_APP_SECRET || '';
    const signature = 'sha256=' + crypto.createHmac('sha256', secret).update(payload).digest('hex');

    // Replace '/test' suffix with '' to target the actual webhook route
    const webhookUrl = request.url.replace(/\/test$/, '');

    console.log(`[webhook-test-endpoint] Forwarding mock payload to ${webhookUrl}`);

    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-hub-signature-256': signature,
      },
      body: payload,
    });

    const responseText = await res.text();
    let responseData;
    try {
      responseData = JSON.parse(responseText);
    } catch {
      responseData = { raw: responseText };
    }

    return NextResponse.json({
      success: res.ok,
      status: res.status,
      response: responseData,
    });
  } catch (error) {
    console.error('Error in webhook test endpoint:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
