import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { decrypt, encrypt, isLegacyFormat } from '@/lib/whatsapp/encryption'
import { getMediaUrl } from '@/lib/whatsapp/meta-api'
import { normalizePhone, phonesMatch } from '@/lib/whatsapp/phone-utils'
import { verifyMetaWebhookSignature } from '@/lib/whatsapp/webhook-signature'
import { runAutomationsForTrigger } from '@/lib/automations/engine'
import { dispatchInboundToFlows } from '@/lib/flows/engine'
import {
  handleTemplateWebhookChange,
  isTemplateWebhookField,
} from '@/lib/whatsapp/template-webhook'
import { sendFcmMessage } from '@/lib/notifications/fcm'

// Lazy-initialized to avoid build-time crash when env vars are missing
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _adminClient: any = null
function supabaseAdmin() {
  if (!_adminClient) {
    _adminClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )
  }
  return _adminClient
}

async function logWebhookEvent(params: {
  accountId?: string | null
  phoneNumberId?: string | null
  eventType: string
  payload: unknown
  status: 'success' | 'failed'
  errorMessage?: string | null
}) {
  try {
    const { error } = await supabaseAdmin().from('webhook_logs').insert({
      account_id: params.accountId || null,
      phone_number_id: params.phoneNumberId || null,
      event_type: params.eventType,
      payload: params.payload,
      status: params.status,
      error_message: params.errorMessage || null,
    })
    if (error) {
      console.warn('[webhook_logs] Failed to write log:', error.message)
    }
  } catch (err) {
    console.warn('[webhook_logs] Failed to write log:', err)
  }
}

// ============================================================
// WhatsApp Cloud API payload type definitions
// Aligned with Meta's official webhook spec:
// https://developers.facebook.com/docs/whatsapp/cloud-api/webhooks/components
// ============================================================

interface WhatsAppReferral {
  /** Meta ad ID that originated the conversation. */
  source_url: string
  source_id?: string
  source_type: 'ad' | 'post' | 'unknown'
  headline?: string
  body?: string
  media_type?: 'image' | 'video'
  image_url?: string
  video_url?: string
  thumbnail_url?: string
  ctwa_clid?: string
}

interface WhatsAppOrderItem {
  product_retailer_id: string
  quantity: number
  item_price: number
  currency: string
}

interface WhatsAppOrder {
  catalog_id: string
  text?: string
  product_items: WhatsAppOrderItem[]
}

interface WhatsAppMessage {
  id: string
  from: string
  timestamp: string
  type: string
  text?: { body: string }
  image?: { id: string; mime_type: string; caption?: string; sha256?: string }
  video?: { id: string; mime_type: string; caption?: string; sha256?: string }
  document?: { id: string; mime_type: string; filename?: string; caption?: string; sha256?: string }
  audio?: { id: string; mime_type: string; voice?: boolean; sha256?: string }
  sticker?: { id: string; mime_type: string; animated?: boolean; sha256?: string }
  location?: { latitude: number; longitude: number; name?: string; address?: string }
  reaction?: { message_id: string; emoji: string }
  /** Order messages via WhatsApp Catalog */
  order?: WhatsAppOrder
  /**
   * Click-to-WhatsApp ad attribution. Present on the first message
   * when the customer started the conversation from an ad.
   */
  referral?: WhatsAppReferral
  /**
   * System notification — user changed their phone number, account deleted, etc.
   * We treat these as no-ops (no message row inserted).
   */
  system?: { body: string; identity?: string; new_wa_id?: string; old_wa_id?: string; type?: string; customer?: string }
  /**
   * Set when the customer taps a button or list row on an interactive
   * message we sent.
   */
  interactive?: {
    type: 'button_reply' | 'list_reply'
    button_reply?: { id: string; title: string }
    list_reply?: { id: string; title: string; description?: string }
  }
  /** Present when the customer swipe-replies to one of our messages. */
  context?: { id: string; forwarded?: boolean; frequently_forwarded?: boolean }
}

interface WhatsAppStatusError {
  code: number
  title: string
  message?: string
  error_data?: { details: string }
}

interface WhatsAppConversation {
  id: string
  origin: { type: 'business_initiated' | 'customer_initiated' | 'referral_conversion' }
  expiration_timestamp?: string
}

interface WhatsAppPricing {
  billable: boolean
  pricing_model: string
  category: string
}

interface WhatsAppStatus {
  id: string
  status: string
  timestamp: string
  recipient_id: string
  errors?: WhatsAppStatusError[]
  conversation?: WhatsAppConversation
  pricing?: WhatsAppPricing
}

interface WhatsAppWebhookEntry {
  /** WABA (WhatsApp Business Account) ID — cross-validated against config. */
  id: string
  changes: Array<{
    value: {
      messaging_product: string
      metadata: {
        display_phone_number: string
        phone_number_id: string
      }
      contacts?: Array<{
        profile: { name: string }
        wa_id: string
      }>
      messages?: WhatsAppMessage[]
      statuses?: WhatsAppStatus[]
    }
    field: string
  }>
}

// GET - Webhook verification
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const mode = searchParams.get('hub.mode')
    const challenge = searchParams.get('hub.challenge')
    const verifyToken = searchParams.get('hub.verify_token')

    if (mode !== 'subscribe' || !challenge || !verifyToken) {
      return NextResponse.json(
        { error: 'Missing verification parameters' },
        { status: 400 }
      )
    }

    // Fetch all whatsapp configs to check verify tokens
    const { data: configs, error: configError } = await supabaseAdmin()
      .from('whatsapp_config')
      .select('id, verify_token, account_id')

    if (configError || !configs) {
      console.error('Error fetching configs for verification:', configError)
      return NextResponse.json(
        { error: 'Verification failed' },
        { status: 403 }
      )
    }

    // Check if any config's verify_token matches. Also collect the
    // matching row so we can opportunistically upgrade its token to
    // GCM if it was still in the legacy CBC format.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let matchedConfig: any = null
    for (const config of configs) {
      if (!config.verify_token) continue
      try {
        if (decrypt(config.verify_token) === verifyToken) {
          matchedConfig = config
          break
        }
      } catch {
        // Malformed / wrong-key token row — skip it and keep checking.
      }
    }

    if (matchedConfig) {
      // Fire-and-forget GCM upgrade. Safe to run on every subscribe
      // since it's a no-op once the column is already GCM.
      if (isLegacyFormat(matchedConfig.verify_token)) {
        void supabaseAdmin()
          .from('whatsapp_config')
          .update({ verify_token: encrypt(verifyToken) })
          .eq('id', matchedConfig.id)
          .then(({ error }: { error: unknown }) => {
            if (error) {
              console.warn(
                '[webhook] verify_token GCM upgrade failed:',
                (error as { message?: string })?.message ?? error,
              )
            }
          })
      }

      // Log successful verification
      await logWebhookEvent({
        accountId: matchedConfig.account_id,
        eventType: 'verification',
        payload: { mode, challenge, verifyToken },
        status: 'success'
      })

      // Return challenge as plain text (Meta requires this exact format)
      return new Response(challenge, {
        status: 200,
        headers: { 'Content-Type': 'text/plain' },
      })
    }

    // Log verification token mismatch
    await logWebhookEvent({
      eventType: 'verification',
      payload: { mode, challenge, verifyToken },
      status: 'failed',
      errorMessage: 'Verification token mismatch'
    })

    return NextResponse.json(
      { error: 'Verification token mismatch' },
      { status: 403 }
    )
  } catch (error) {
    console.error('Error in webhook GET verification:', error)
    await logWebhookEvent({
      eventType: 'verification',
      payload: { url: request.url },
      status: 'failed',
      errorMessage: error instanceof Error ? error.message : String(error)
    })
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// POST - Receive messages
export async function POST(request: Request) {
  // Read raw body first so we can HMAC-verify the exact bytes Meta
  // signed. request.json() would re-encode and break the signature.
  const rawBody = await request.text()
  const signature = request.headers.get('x-hub-signature-256')

  if (!verifyMetaWebhookSignature(rawBody, signature)) {
    // 401 (not 200) — we want Meta's delivery dashboard to show failures
    // loudly if a misconfiguration causes signatures to stop matching,
    // rather than silently eating events.
    console.warn('[webhook] rejected request with invalid signature')

    let parsedPayload = null
    try { parsedPayload = JSON.parse(rawBody) } catch {}
    await logWebhookEvent({
      eventType: 'error',
      payload: parsedPayload || { rawBody, signature },
      status: 'failed',
      errorMessage: 'Invalid webhook signature'
    })

    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
  }

  let body: { object?: string; entry?: WhatsAppWebhookEntry[] }
  try {
    body = JSON.parse(rawBody)
  } catch {
    await logWebhookEvent({
      eventType: 'error',
      payload: { rawBody },
      status: 'failed',
      errorMessage: 'Invalid JSON payload'
    })
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  // Process asynchronously so we can ack Meta within their timeout.
  // Meta requires a 200 OK within 20 seconds or it marks the delivery
  // as failed and begins retrying. Never await processWebhook here.
  processWebhook(body).catch(async (error) => {
    console.error('Error processing webhook:', error)
    await logWebhookEvent({
      eventType: 'error',
      payload: body,
      status: 'failed',
      errorMessage: error instanceof Error ? error.message : String(error)
    })
  })

  return NextResponse.json({ status: 'received' }, { status: 200 })
}

async function processWebhook(body: { object?: string; entry?: WhatsAppWebhookEntry[] }) {
  // ────────────────────────────────────────────────────────────────
  // Guard 1: `object` field must be "whatsapp_business_account".
  // The same app subscription endpoint can receive events from other
  // Meta products (Instagram DMs, etc.) if wired up incorrectly.
  // Silently dropping them would mask configuration errors.
  // ────────────────────────────────────────────────────────────────
  if (body.object && body.object !== 'whatsapp_business_account') {
    console.warn('[webhook] unexpected object type, ignoring:', body.object)
    return
  }

  if (!body.entry) return

  for (const entry of body.entry) {
    for (const change of entry.changes) {
      // Template-lifecycle events (status / quality / components
      // updates from Meta) come in on a different change.field and
      // have a different value shape — route them through the
      // dedicated handler. Skip the messaging branches below so we
      // don't try to read message-shaped fields off a template event.
      if (isTemplateWebhookField(change.field)) {
        await handleTemplateWebhookChange(
          { field: change.field, value: change.value as unknown },
          supabaseAdmin(),
        )
        continue
      }

      const value = change.value

      // Handle status updates
      if (value.statuses) {
        for (const status of value.statuses) {
          await handleStatusUpdate(status, entry.id)
        }
      }

      // Handle incoming messages
      if (!value.messages || !value.contacts) continue

      const phoneNumberId = value.metadata.phone_number_id

      // Find user's config by phone_number_id.
      const { data: configRows, error: configError } = await supabaseAdmin()
        .from('whatsapp_config')
        .select('*')
        .eq('phone_number_id', phoneNumberId)

      if (configError) {
        console.error(
          'Error fetching whatsapp_config for phone_number_id:',
          phoneNumberId,
          configError
        )
        await logWebhookEvent({
          phoneNumberId,
          eventType: 'error',
          payload: value,
          status: 'failed',
          errorMessage: `Error fetching whatsapp_config: ${configError.message}`
        })
        continue
      }

      if (!configRows || configRows.length === 0) {
        console.error('No config found for phone_number_id:', phoneNumberId)
        await logWebhookEvent({
          phoneNumberId,
          eventType: 'error',
          payload: value,
          status: 'failed',
          errorMessage: `No whatsapp_config found for phone_number_id: ${phoneNumberId}`
        })
        continue
      }

      if (configRows.length > 1) {
        const owners = configRows.map((r: { account_id: string; user_id: string }) => `${r.account_id} (admin ${r.user_id})`)
        console.error(
          `Multiple configs (${configRows.length}) found for phone_number_id:`,
          phoneNumberId,
          '— inbound message dropped. Resolve duplicates so each number maps to a single account.',
          'Account owners:',
          owners
        )
        await logWebhookEvent({
          phoneNumberId,
          eventType: 'error',
          payload: value,
          status: 'failed',
          errorMessage: `Multiple configs found for phone_number_id: ${phoneNumberId}. Owners: ${owners.join(', ')}`
        })
        continue
      }

      const config = configRows[0]

      // ────────────────────────────────────────────────────────────
      // Guard 2: Cross-validate the WABA ID from entry.id against
      // the stored waba_id in config. This prevents accepting events
      // from a different WABA if the app subscription is shared.
      // We do a soft check — if config.waba_id is null/empty we
      // skip the check rather than rejecting legitimate events from
      // accounts that pre-date the waba_id column.
      // ────────────────────────────────────────────────────────────
      if (config.waba_id && entry.id && config.waba_id !== entry.id) {
        console.warn(
          '[webhook] WABA ID mismatch: entry.id=%s config.waba_id=%s — dropping event',
          entry.id,
          config.waba_id
        )
        await logWebhookEvent({
          accountId: config.account_id,
          phoneNumberId,
          eventType: 'error',
          payload: value,
          status: 'failed',
          errorMessage: `WABA ID mismatch: received=${entry.id} expected=${config.waba_id}`
        })
        continue
      }

      let decryptedAccessToken = ''
      try {
        decryptedAccessToken = decrypt(config.access_token)
      } catch (err) {
        console.error('Failed to decrypt WhatsApp access token:', err)
        await logWebhookEvent({
          accountId: config.account_id,
          phoneNumberId,
          eventType: 'error',
          payload: value,
          status: 'failed',
          errorMessage: `Failed to decrypt access token: ${err instanceof Error ? err.message : String(err)}. Verify ENCRYPTION_KEY.`
        })
        continue
      }

      for (let i = 0; i < value.messages.length; i++) {
        const message = value.messages[i]
        const contact = value.contacts[i] || value.contacts[0]

        await processMessage(
          message,
          contact,
          // Tenancy — drives every contact / conversation lookup
          // and the engines' active-row dispatch.
          config.account_id,
          // Audit / sender-of-record — used as the user_id on row
          // inserts that need it for NOT NULL FK compliance. Always
          // the admin who saved the WhatsApp config.
          config.user_id,
          decryptedAccessToken,
          phoneNumberId
        )
      }
    }
  }
}

// The happy-path status ladder — pending → sent → delivered → read →
// replied. Webhook replays must never regress a recipient back down
// this ladder.
//
// `failed` is NOT on this ladder. It's a terminal side branch that is
// only valid from the early states (pending / sent) — once Meta has
// delivered or the user has read or replied, a later "failed" status
// event is a bug in Meta's pipeline or a spoof attempt and must be
// ignored.
const RECIPIENT_STATUS_LADDER = [
  'pending',
  'sent',
  'delivered',
  'read',
  'replied',
] as const

function ladderLevel(s: string): number {
  const idx = (RECIPIENT_STATUS_LADDER as readonly string[]).indexOf(s)
  return idx < 0 ? -1 : idx
}

/**
 * Can a recipient transition from `current` to `incoming`?
 *   - Along the ladder, only forward moves are allowed.
 *   - `failed` is accepted only from `pending` or `sent`; it's refused
 *     once the recipient has reached any of the success states.
 */
function isValidStatusTransition(current: string, incoming: string): boolean {
  if (incoming === 'failed') {
    return current === 'pending' || current === 'sent'
  }
  if (current === 'failed') {
    return false // failed is terminal
  }
  const ci = ladderLevel(current)
  const ii = ladderLevel(incoming)
  if (ii < 0) return false // unknown incoming status
  if (ci < 0) return true // unknown current — accept anything on the ladder
  return ii > ci
}

/**
 * Handle a status update event from Meta.
 *
 * Extended to:
 *  - Capture `errors[0]` (code + title) on failed status
 *  - Update conversation `session_expires_at` from the `conversation` object
 *  - Log `pricing` metadata for billing visibility
 *
 * @param status   - The status object from Meta
 * @param wabaId   - The WABA ID from entry.id (used for conversation lookup scoping)
 */
async function handleStatusUpdate(status: WhatsAppStatus, wabaId?: string) {
  // Build the update payload for the messages table
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const msgUpdate: Record<string, any> = { status: status.status }

  // Capture error details when Meta reports a delivery failure
  if (status.status === 'failed' && status.errors && status.errors.length > 0) {
    const firstError = status.errors[0]
    msgUpdate.error_code = firstError.code
    msgUpdate.error_title = firstError.title
    console.warn(
      '[webhook] message delivery failed:',
      status.id,
      `code=${firstError.code}`,
      `title="${firstError.title}"`,
      firstError.error_data?.details ?? ''
    )
  }

  // 1) Mirror onto messages
  const { error: msgErr } = await supabaseAdmin()
    .from('messages')
    .update(msgUpdate)
    .eq('message_id', status.id)

  if (msgErr) {
    console.error('Error updating message status:', msgErr)
  }

  // 2) Mirror onto broadcast_recipients via whatsapp_message_id
  const tsIso = new Date(parseInt(status.timestamp) * 1000).toISOString()

  const { data: recipient, error: recFetchErr } = await supabaseAdmin()
    .from('broadcast_recipients')
    .select('id, status')
    .eq('whatsapp_message_id', status.id)
    .maybeSingle()

  if (recFetchErr) {
    console.error('Error fetching broadcast recipient:', recFetchErr)
    return
  }

  if (recipient) {
    // Guard transitions — forward-only on the success ladder, and
    // `failed` only from pre-delivered states.
    if (isValidStatusTransition(recipient.status, status.status)) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const update: Record<string, any> = { status: status.status }
      if (status.status === 'sent' && !('sent_at' in update)) update.sent_at = tsIso
      if (status.status === 'delivered') update.delivered_at = tsIso
      if (status.status === 'read') update.read_at = tsIso

      const { error: recUpdateErr } = await supabaseAdmin()
        .from('broadcast_recipients')
        .update(update)
        .eq('id', recipient.id)

      if (recUpdateErr) {
        console.error('Error updating broadcast recipient status:', recUpdateErr)
      }
    }
  }

  // 3) Update conversation session window from the `conversation` object.
  // Meta sends this on every status event that occurs within an open
  // 24-hour session. The `expiration_timestamp` tells us exactly when
  // the session window closes so the inbox can show an accurate warning.
  if (status.conversation?.expiration_timestamp) {
    const sessionExpiresAt = new Date(
      parseInt(status.conversation.expiration_timestamp) * 1000
    ).toISOString()

    // Locate the conversation via the message_id to get the conversation_id
    const { data: msgRow } = await supabaseAdmin()
      .from('messages')
      .select('conversation_id')
      .eq('message_id', status.id)
      .maybeSingle()

    if (msgRow?.conversation_id) {
      await supabaseAdmin()
        .from('conversations')
        .update({ session_expires_at: sessionExpiresAt })
        .eq('id', msgRow.conversation_id)
    }
  }

  // 4) Log pricing metadata for billing insight (no schema change needed)
  if (status.pricing) {
    void logWebhookEvent({
      eventType: 'pricing',
      payload: {
        message_id: status.id,
        recipient_id: status.recipient_id,
        waba_id: wabaId,
        billable: status.pricing.billable,
        pricing_model: status.pricing.pricing_model,
        category: status.pricing.category,
        status: status.status,
      },
      status: 'success',
    })
  }
}

/**
 * If an inbound message's sender is on a still-unreplied
 * broadcast_recipients row, flip it to `replied` so the reply count
 * advances on the parent broadcast.
 */
async function flagBroadcastReplyIfAny(accountId: string, contactId: string) {
  try {
    const { data: recs, error } = await supabaseAdmin()
      .from('broadcast_recipients')
      .select('id, status, broadcast_id, broadcasts!inner(account_id)')
      .eq('contact_id', contactId)
      .eq('broadcasts.account_id', accountId)
      .in('status', ['sent', 'delivered', 'read'])
      .order('created_at', { ascending: false })
      .limit(1)

    if (error || !recs || recs.length === 0) return

    const row = recs[0]
    const { error: updErr } = await supabaseAdmin()
      .from('broadcast_recipients')
      .update({ status: 'replied', replied_at: new Date().toISOString() })
      .eq('id', row.id)

    if (updErr) {
      console.error('Error marking broadcast recipient replied:', updErr)
    }
  } catch (err) {
    console.error('flagBroadcastReplyIfAny failed:', err)
  }
}

/**
 * Resolve a Meta-side message_id into the matching internal UUID, scoped
 * to one conversation.
 */
async function lookupInternalIdByMetaId(
  metaId: string,
  conversationId: string
): Promise<string | null> {
  const { data, error } = await supabaseAdmin()
    .from('messages')
    .select('id')
    .eq('message_id', metaId)
    .eq('conversation_id', conversationId)
    .maybeSingle()
  if (error) {
    console.error('[webhook] lookupInternalIdByMetaId failed:', error.message)
    return null
  }
  return data?.id ?? null
}

/**
 * Persist an inbound reaction. WhatsApp reactions are not new messages —
 * they're per-(target, actor) state. We upsert / delete on
 * `message_reactions`, never write a row into `messages`.
 */
async function handleReaction(
  message: WhatsAppMessage,
  conversationId: string,
  contactId: string
) {
  const reaction = message.reaction
  if (!reaction?.message_id) return

  const targetInternalId = await lookupInternalIdByMetaId(
    reaction.message_id,
    conversationId
  )
  if (!targetInternalId) {
    console.warn(
      '[webhook] reaction target message not found; skipping',
      reaction.message_id
    )
    return
  }

  // Empty emoji = removal (per Meta's Cloud API spec).
  if (!reaction.emoji) {
    const { error: delError } = await supabaseAdmin()
      .from('message_reactions')
      .delete()
      .eq('message_id', targetInternalId)
      .eq('actor_type', 'customer')
      .eq('actor_id', contactId)
    if (delError) {
      console.error('[webhook] reaction delete failed:', delError.message)
    }
    return
  }

  const { error: upsertError } = await supabaseAdmin()
    .from('message_reactions')
    .upsert(
      {
        message_id: targetInternalId,
        conversation_id: conversationId,
        actor_type: 'customer',
        actor_id: contactId,
        emoji: reaction.emoji,
      },
      { onConflict: 'message_id,actor_type,actor_id' }
    )
  if (upsertError) {
    console.error('[webhook] reaction upsert failed:', upsertError.message)
  }
}

async function processMessage(
  message: WhatsAppMessage,
  contact: { profile: { name: string }; wa_id: string },
  accountId: string,
  configOwnerUserId: string,
  accessToken: string,
  phoneNumberId: string
) {
  const senderPhone = normalizePhone(message.from)
  const contactName = contact.profile.name
  // The canonical WhatsApp ID from Meta (country-code normalised, no +)
  const waId = contact.wa_id

  // ──────────────────────────────────────────────────────────────
  // System messages (user changed number, account deleted, etc.)
  // are notification-only — Meta doesn't expect us to respond or
  // store them. Acknowledge and skip.
  // ──────────────────────────────────────────────────────────────
  if (message.type === 'system') {
    console.info(
      '[webhook] system message from %s: %s',
      senderPhone,
      message.system?.body ?? '(no body)'
    )
    return
  }

  // Find or create contact
  const contactOutcome = await findOrCreateContact(
    accountId,
    configOwnerUserId,
    senderPhone,
    contactName,
    waId
  )
  if (!contactOutcome) {
    await logWebhookEvent({
      accountId,
      phoneNumberId,
      eventType: message.type === 'reaction' ? 'reaction' : 'message',
      payload: message,
      status: 'failed',
      errorMessage: 'Failed to create or find contact'
    })
    return
  }
  const contactRecord = contactOutcome.contact

  // ──────────────────────────────────────────────────────────────
  // Click-to-WhatsApp referral attribution.
  // Meta sends a `referral` object on the *first* message when the
  // customer started the conversation from an ad. We log it as a
  // webhook event so ad attribution data is preserved for reporting.
  // We also store the ctwa_clid on the contact for future CRM use.
  // ──────────────────────────────────────────────────────────────
  if (message.referral) {
    const ref = message.referral
    void logWebhookEvent({
      accountId,
      phoneNumberId,
      eventType: 'referral',
      payload: {
        contact_id: contactRecord.id,
        source_type: ref.source_type,
        source_url: ref.source_url,
        source_id: ref.source_id,
        headline: ref.headline,
        ctwa_clid: ref.ctwa_clid,
        media_type: ref.media_type,
        body: ref.body,
      },
      status: 'success',
    })

    // Persist the ad click ID on the contact if not already set
    if (ref.ctwa_clid) {
      await supabaseAdmin()
        .from('contacts')
        .update({ notes: `Ad referral: ${ref.headline ?? ref.source_url} (${ref.ctwa_clid})` })
        .eq('id', contactRecord.id)
        .is('notes', null) // Only set if not already populated
    }
  }

  // Find or create conversation
  const conversation = await findOrCreateConversation(
    accountId,
    configOwnerUserId,
    contactRecord.id
  )
  if (!conversation) {
    await logWebhookEvent({
      accountId,
      phoneNumberId,
      eventType: message.type === 'reaction' ? 'reaction' : 'message',
      payload: message,
      status: 'failed',
      errorMessage: 'Failed to create or find conversation'
    })
    return
  }

  // Reactions short-circuit here — they aren't messages. We never insert
  // into `messages`, never bump unread_count, never update last_message_text.
  if (message.type === 'reaction') {
    await handleReaction(message, conversation.id, contactRecord.id)
    return
  }

  // ──────────────────────────────────────────────────────────────
  // Idempotency guard — Meta may re-deliver the same event if our
  // server times out or returns a non-200. A duplicate wamid would
  // hit a unique constraint on messages.message_id and generate an
  // error log. Instead, we check first and skip gracefully.
  // ──────────────────────────────────────────────────────────────
  const { data: existingMsg } = await supabaseAdmin()
    .from('messages')
    .select('id')
    .eq('message_id', message.id)
    .maybeSingle()

  if (existingMsg) {
    console.info('[webhook] duplicate wamid, skipping:', message.id)
    return
  }

  // Parse message content based on type
  const { contentText, mediaUrl, mediaType, interactiveReplyId } =
    await parseMessageContent(message, accessToken)

  // Resolve swipe-reply context if present.
  let replyToInternalId: string | null = null
  if (message.context?.id) {
    replyToInternalId = await lookupInternalIdByMetaId(
      message.context.id,
      conversation.id
    )
    if (!replyToInternalId) {
      console.warn(
        '[webhook] reply context parent not found:',
        message.context.id
      )
    }
  }

  // The messages.content_type CHECK constraint allows:
  //   text, image, document, audio, video, location, template, interactive
  // Map incoming WhatsApp types to the closest allowed value.
  const ALLOWED_CONTENT_TYPES = new Set([
    'text', 'image', 'document', 'audio', 'video',
    'location', 'template', 'interactive',
  ])
  const contentType = ALLOWED_CONTENT_TYPES.has(message.type)
    ? message.type
    : message.type === 'sticker'
      ? 'image'   // stickers are images
      : message.type === 'order'
        ? 'text'  // orders stored as structured text
        : 'text'  // system, unknown → text fallback

  // Silence unused mediaType (schema has no media_type column)
  void mediaType

  // Determine whether this is the contact's very first inbound message
  const { count: priorCustomerMsgCount } = await supabaseAdmin()
    .from('messages')
    .select('id', { count: 'exact', head: true })
    .eq('conversation_id', conversation.id)
    .eq('sender_type', 'customer')
  const isFirstInboundMessage = (priorCustomerMsgCount ?? 0) === 0

  const { error: msgError } = await supabaseAdmin().from('messages').insert({
    conversation_id: conversation.id,
    account_id: accountId,
    sender_type: 'customer',
    content_type: contentType,
    content_text: contentText,
    media_url: mediaUrl,
    message_id: message.id,
    status: 'delivered',
    created_at: new Date(parseInt(message.timestamp) * 1000).toISOString(),
    reply_to_message_id: replyToInternalId,
    interactive_reply_id: interactiveReplyId,
  })

  if (msgError) {
    console.error('Error inserting message:', msgError)
    await logWebhookEvent({
      accountId,
      phoneNumberId,
      eventType: 'message',
      payload: message,
      status: 'failed',
      errorMessage: `Error inserting message: ${msgError.message}`
    })
    return
  }

  // Update conversation
  const { error: convError } = await supabaseAdmin()
    .from('conversations')
    .update({
      last_message_text: contentText || `[${message.type}]`,
      last_message_at: new Date().toISOString(),
      unread_count: (conversation.unread_count || 0) + 1,
      updated_at: new Date().toISOString(),
      // Inbound customer messages always open/extend the 24-hour
      // session window. Mark session as active (expiry = now + 24h)
      // as a safe default; the actual expiry arrives via status events.
      session_expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    })
    .eq('id', conversation.id)

  if (convError) {
    console.error('Error updating conversation:', convError)
  }

  // Flag broadcast reply if relevant
  await flagBroadcastReplyIfAny(accountId, contactRecord.id)

  // Trigger FCM push notifications to all devices linked to this account
  const notificationBody = contentText ||
    (message.type ? `Sent an attachment (${message.type})` : 'Sent a message')

  void sendFcmMessage(accountId, {
    title: `New message from ${contactName}`,
    body: notificationBody,
    data: {
      conversationId: conversation.id,
    },
  }).catch((err) => {
    console.error('[webhook] Failed to dispatch FCM notifications:', err)
  })

  // ============================================================
  // Flow runner dispatch.
  // ============================================================
  const flowResult = await dispatchInboundToFlows({
    accountId,
    userId: configOwnerUserId,
    contactId: contactRecord.id,
    conversationId: conversation.id,
    message:
      interactiveReplyId
        ? {
            kind: 'interactive_reply',
            reply_id: interactiveReplyId,
            reply_title: contentText ?? '',
            meta_message_id: message.id,
          }
        : {
            kind: 'text',
            text: contentText ?? message.text?.body ?? '',
            meta_message_id: message.id,
          },
    isFirstInboundMessage,
  })
  const flowConsumed = flowResult.consumed

  // Fire automations
  const inboundText = contentText ?? message.text?.body ?? ''
  const automationTriggers: (
    | 'new_contact_created'
    | 'first_inbound_message'
    | 'new_message_received'
    | 'keyword_match'
  )[] = []
  if (!flowConsumed) {
    automationTriggers.push('new_message_received', 'keyword_match')
  }
  if (contactOutcome.wasCreated) automationTriggers.unshift('new_contact_created')
  if (isFirstInboundMessage) automationTriggers.unshift('first_inbound_message')
  for (const triggerType of automationTriggers) {
    runAutomationsForTrigger({
      accountId,
      triggerType,
      contactId: contactRecord.id,
      context: {
        message_text: inboundText,
        conversation_id: conversation.id,
      },
    }).catch((err) => console.error('[automations] dispatch failed:', err))
  }

  // Log successful processing
  await logWebhookEvent({
    accountId,
    phoneNumberId,
    eventType: message.type === 'reaction' ? 'reaction' : 'message',
    payload: message,
    status: 'success'
  })
}

async function parseMessageContent(
  message: WhatsAppMessage,
  accessToken: string
): Promise<{
  contentText: string | null
  mediaUrl: string | null
  mediaType: string | null
  interactiveReplyId: string | null
}> {
  const verifyAndBuildUrl = async (
    mediaId: string
  ): Promise<string | null> => {
    try {
      await getMediaUrl({ mediaId, accessToken })
      return `/api/whatsapp/media/${mediaId}`
    } catch (error) {
      console.error(
        `Failed to verify media ${mediaId} with Meta:`,
        error instanceof Error ? error.message : error
      )
      return null
    }
  }

  const empty = {
    contentText: null,
    mediaUrl: null,
    mediaType: null,
    interactiveReplyId: null,
  }

  switch (message.type) {
    case 'text':
      return { ...empty, contentText: message.text?.body || null }

    case 'image':
      if (message.image?.id) {
        return {
          ...empty,
          contentText: message.image.caption || null,
          mediaUrl: await verifyAndBuildUrl(message.image.id),
          mediaType: message.image.mime_type,
        }
      }
      return empty

    case 'video':
      if (message.video?.id) {
        return {
          ...empty,
          contentText: message.video.caption || null,
          mediaUrl: await verifyAndBuildUrl(message.video.id),
          mediaType: message.video.mime_type,
        }
      }
      return empty

    case 'document':
      if (message.document?.id) {
        return {
          ...empty,
          contentText:
            message.document.caption || message.document.filename || null,
          mediaUrl: await verifyAndBuildUrl(message.document.id),
          mediaType: message.document.mime_type,
        }
      }
      return empty

    case 'audio':
      if (message.audio?.id) {
        return {
          ...empty,
          contentText: message.audio.voice ? '[Voice message]' : '[Audio]',
          mediaUrl: await verifyAndBuildUrl(message.audio.id),
          mediaType: message.audio.mime_type,
        }
      }
      return empty

    case 'sticker':
      // Stickers are images under the hood. Treat them as such so the
      // MessageBubble renders the <img>.
      if (message.sticker?.id) {
        return {
          ...empty,
          contentText: message.sticker.animated ? '[Animated sticker]' : '[Sticker]',
          mediaUrl: await verifyAndBuildUrl(message.sticker.id),
          mediaType: message.sticker.mime_type,
        }
      }
      return empty

    case 'location':
      if (message.location) {
        const loc = message.location
        const locationText = [loc.name, loc.address, `${loc.latitude},${loc.longitude}`]
          .filter(Boolean)
          .join(' - ')
        return { ...empty, contentText: locationText }
      }
      return empty

    case 'reaction':
      return { ...empty, contentText: message.reaction?.emoji || null }

    case 'order': {
      // Catalog order — format into a human-readable summary
      const order = message.order
      if (!order) return { ...empty, contentText: '[Order]' }

      const itemLines = order.product_items
        .map(
          (item) =>
            `• ${item.product_retailer_id} × ${item.quantity} @ ${item.currency} ${item.item_price}`
        )
        .join('\n')

      const orderText = [
        `🛒 Order from catalog ${order.catalog_id}`,
        order.text ? `"${order.text}"` : null,
        itemLines,
      ]
        .filter(Boolean)
        .join('\n')

      return { ...empty, contentText: orderText }
    }

    case 'interactive': {
      const reply =
        message.interactive?.button_reply ?? message.interactive?.list_reply
      if (reply?.id) {
        return {
          ...empty,
          contentText: reply.title || reply.id,
          interactiveReplyId: reply.id,
        }
      }
      return { ...empty, contentText: '[Interactive reply]' }
    }

    case 'system':
      // System messages are handled upstream (no-op skip) but
      // parseMessageContent may still be called in edge cases.
      return { ...empty, contentText: `[System: ${message.system?.body ?? 'notification'}]` }

    default:
      return {
        ...empty,
        contentText: `[Unsupported message type: ${message.type}]`,
      }
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ContactRow = any

interface ContactOutcome {
  contact: ContactRow
  wasCreated: boolean
}

async function findOrCreateContact(
  accountId: string,
  configOwnerUserId: string,
  phone: string,
  name: string,
  waId?: string
): Promise<ContactOutcome | null> {
  // Look up existing contacts for this account by phone suffix
  const normalizedSender = phone.replace(/\D/g, '')
  const phoneSuffix =
    normalizedSender.length >= 8
      ? normalizedSender.slice(-8)
      : normalizedSender

  const { data: contacts, error: contactsError } = await supabaseAdmin()
    .from('contacts')
    .select('*')
    .eq('account_id', accountId)
    .like('phone', `%${phoneSuffix}`)

  if (contactsError) {
    console.error('Error fetching contacts:', contactsError)
    return null
  }

  const existingContact = contacts?.find((c: ContactRow) => phonesMatch(c.phone, phone))

  if (existingContact) {
    // Build an update patch — only send columns that actually changed
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const patch: Record<string, any> = {}
    if (name && name !== existingContact.name) patch.name = name
    // Store the canonical wa_id from Meta if we don't have it yet
    if (waId && !existingContact.wa_id) patch.wa_id = waId
    if (Object.keys(patch).length > 0) {
      patch.updated_at = new Date().toISOString()
      await supabaseAdmin()
        .from('contacts')
        .update(patch)
        .eq('id', existingContact.id)
    }
    return { contact: existingContact, wasCreated: false }
  }

  // Create new contact
  const { data: newContact, error: createError } = await supabaseAdmin()
    .from('contacts')
    .insert({
      account_id: accountId,
      user_id: configOwnerUserId,
      phone,
      name: name || phone,
      wa_id: waId || null,
    })
    .select()
    .single()

  if (createError) {
    console.error('Error creating contact:', createError)
    return null
  }

  console.info(`[webhook] Received message from a new number not in contact list: ${phone} (${name || 'No Name'})`)

  return { contact: newContact, wasCreated: true }
}

async function findOrCreateConversation(
  accountId: string,
  configOwnerUserId: string,
  contactId: string,
) {
  // Look for existing conversation in this account
  const { data: existing, error: findError } = await supabaseAdmin()
    .from('conversations')
    .select('*')
    .eq('account_id', accountId)
    .eq('contact_id', contactId)
    .single()

  if (!findError && existing) {
    return existing
  }

  // Create new conversation
  const { data: newConv, error: createError } = await supabaseAdmin()
    .from('conversations')
    .insert({
      account_id: accountId,
      user_id: configOwnerUserId,
      contact_id: contactId,
    })
    .select()
    .single()

  if (createError) {
    console.error('Error creating conversation:', createError)
    return null
  }

  return newConv
}
