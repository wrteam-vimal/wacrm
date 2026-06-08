import admin from 'firebase-admin';
import { createClient } from '@supabase/supabase-js';

// Lazy-initialized Supabase admin client
let _adminClient: any = null;
function supabaseAdmin() {
  if (!_adminClient) {
    _adminClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
  }
  return _adminClient;
}

// Initialize Firebase Admin SDK
let firebaseInitialized = false;

function initFirebase() {
  if (firebaseInitialized) return true;
  if (admin.apps.length > 0) {
    firebaseInitialized = true;
    return true;
  }

  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  let privateKey = process.env.FIREBASE_PRIVATE_KEY;

  if (!projectId || !clientEmail || !privateKey) {
    console.warn('[FCM] Firebase push notifications not configured. Set FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, and FIREBASE_PRIVATE_KEY.');
    return false;
  }

  // Handle newline characters in the private key
  if (privateKey.includes('\\n')) {
    privateKey = privateKey.replace(/\\n/g, '\n');
  }

  try {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId,
        clientEmail,
        privateKey,
      }),
    });
    firebaseInitialized = true;
    console.log('[FCM] Firebase Admin initialized successfully.');
    return true;
  } catch (err) {
    console.error('[FCM] Failed to initialize Firebase Admin:', err);
    return false;
  }
}

interface FcmNotificationPayload {
  title: string;
  body: string;
  data?: Record<string, string>;
}

/**
 * Broadcasts a push notification to all FCM tokens registered under the given account.
 * Cleans up invalid/expired tokens automatically upon failure responses.
 */
export async function sendFcmMessage(accountId: string, payload: FcmNotificationPayload) {
  const isReady = initFirebase();
  if (!isReady) return;

  const db = supabaseAdmin();

  // Fetch all tokens for this account
  const { data: tokenRows, error: fetchError } = await db
    .from('fcm_tokens')
    .select('id, token, user_id')
    .eq('account_id', accountId);

  if (fetchError) {
    console.error('[FCM] Error fetching tokens from DB:', fetchError.message);
    return;
  }

  if (!tokenRows || tokenRows.length === 0) {
    // No tokens registered for this account — skip sending
    return;
  }

  console.log(`[FCM] Dispatching notification to ${tokenRows.length} tokens for account ${accountId}`);

  const tokens = tokenRows.map((row: any) => row.token);
  const dataPayload = payload.data || {};

  // Construct message template
  const message = {
    notification: {
      title: payload.title,
      body: payload.body,
    },
    data: {
      ...dataPayload,
      click_action: 'FLUTTER_NOTIFICATION_CLICK', // standard key for mobile clicks
    },
  };

  // Send to each token individually so we can clean up failing tokens selectively
  const sendPromises = tokenRows.map(async (row: any) => {
    try {
      if (row.token.startsWith('web_') || row.token.startsWith('mock_')) {
        console.log(`[FCM] Skipping Firebase delivery for custom/web token: ${row.token}`);
        return;
      }

      await admin.messaging().send({
        token: row.token,
        ...message,
      });
      console.log(`[FCM] Sent successfully to token id ${row.id}`);
    } catch (err: any) {
      console.error(`[FCM] Failed to send to token id ${row.id}:`, err.message);

      // Clean up invalid or unregistered tokens from database
      const isInvalidToken =
        err.code === 'messaging/invalid-registration-token' ||
        err.code === 'messaging/registration-token-not-registered' ||
        err.message?.includes('not-registered') ||
        err.message?.includes('invalid-registration-token');

      if (isInvalidToken) {
        console.log(`[FCM] Deleting expired or invalid token from DB: ${row.id}`);
        const { error: deleteError } = await db
          .from('fcm_tokens')
          .delete()
          .eq('id', row.id);
        
        if (deleteError) {
          console.error(`[FCM] Failed to delete token ${row.id}:`, deleteError.message);
        }
      }
    }
  });

  await Promise.all(sendPromises);
}
