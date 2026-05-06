import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)
const supabaseAdmin = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

// Read raw body (required for Stripe signature verification)
async function getRawBody(req) {
  const chunks = []
  for await (const chunk of req) chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk)
  return Buffer.concat(chunks)
}

async function setTierByCustomer(customerId, tier, status) {
  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('id')
    .eq('stripe_customer_id', customerId)
    .single()
  if (!profile) return
  await supabaseAdmin
    .from('profiles')
    .update({ subscription_tier: tier, subscription_status: status, updated_at: new Date().toISOString() })
    .eq('id', profile.id)
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end('Method Not Allowed')

  const rawBody = await getRawBody(req)
  const sig = req.headers['stripe-signature']

  let event
  try {
    event = stripe.webhooks.constructEvent(rawBody, sig, process.env.STRIPE_WEBHOOK_SECRET)
  } catch (err) {
    console.error('Webhook signature error:', err.message)
    return res.status(400).send(`Webhook Error: ${err.message}`)
  }

  const { type, data } = event

  // Idempotency check (migration 060) — if Stripe retries the same event
  // (timeout, network, edge), short-circuit BEFORE side effects. Two
  // race conditions made this non-cosmetic: (1) two concurrent
  // checkout.session.completed retries for the same user can interleave
  // a stripe_customer_id assignment; (2) two subscription.updated
  // retries can flap tier under tier-change windows. The table is
  // service-role-only.
  try {
    const { data: alreadyProcessed } = await supabaseAdmin
      .from('webhook_events_processed')
      .select('event_id')
      .eq('event_id', event.id)
      .maybeSingle()
    if (alreadyProcessed) {
      return res.status(200).json({ received: true, deduped: true, eventId: event.id })
    }
  } catch (err) {
    // If the dedup probe fails (table missing pre-migration / supabase
    // outage), continue to process. Stripe still retries on non-2xx,
    // and the upserts in each handler are individually idempotent for
    // the common case. The race-condition window without dedup is the
    // tradeoff we accept until 060 is applied.
    console.warn('[webhook] dedup probe failed, processing without:', err?.message)
  }

  try {
    switch (type) {
      case 'checkout.session.completed': {
        const session = data.object
        const userId = session.client_reference_id

        // SECURITY: validate that client_reference_id resolves to a real
        // user before upserting subscription tier. The signature check at
        // line 38 confirms the request came from Stripe, but Stripe will
        // accept any string in client_reference_id at session-create time.
        // A misconfigured caller (or a maliciously-crafted earlier session
        // creation flow) could pass an arbitrary user ID and grant Pro to
        // the wrong user. maybeSingle() returns null for no-match instead
        // of throwing, so a single round-trip handles all 3 cases.
        if (!userId) {
          console.warn('[webhook] checkout.session.completed missing client_reference_id; ignoring')
          break
        }
        const { data: profile, error: profileErr } = await supabaseAdmin
          .from('profiles')
          .select('id')
          .eq('id', userId)
          .maybeSingle()
        if (profileErr) {
          console.error('[webhook] profile lookup failed:', profileErr.message)
          return res.status(500).json({ error: 'Profile lookup failed' })
        }
        if (!profile) {
          console.warn(`[webhook] checkout.session.completed for unknown user_id ${userId}; rejecting`)
          return res.status(400).json({ error: 'Unknown user_id in client_reference_id' })
        }

        // Trial-aware status: when the checkout session created a trial
        // (subscription_data.trial_period_days), Stripe sets status to
        // 'trialing' on the subscription. Reflect that in profiles so
        // useSubscription.isPro grants access (it includes 'trialing').
        const subStatus = session.subscription
          ? await stripe.subscriptions.retrieve(session.subscription).then(s => s.status).catch(() => 'active')
          : 'active'

        await supabaseAdmin.from('profiles').update({
          stripe_customer_id: session.customer,
          subscription_tier: 'pro',
          subscription_status: subStatus,
          updated_at: new Date().toISOString(),
        }).eq('id', userId)
        break
      }

      case 'customer.subscription.updated': {
        const sub = data.object
        const isPro = ['active', 'trialing'].includes(sub.status)
        await setTierByCustomer(sub.customer, isPro ? 'pro' : 'free', sub.status)
        break
      }

      case 'customer.subscription.deleted': {
        const sub = data.object
        await setTierByCustomer(sub.customer, 'free', 'canceled')
        break
      }

      case 'invoice.payment_failed': {
        const invoice = data.object
        // Keep tier as 'pro' — Stripe retries failed payments. Only downgrade
        // on customer.subscription.deleted (actual cancellation).
        await setTierByCustomer(invoice.customer, 'pro', 'past_due')
        break
      }

      default:
        // Unhandled event — ignore
        break
    }

    // Mark this event processed so Stripe retries short-circuit at the
    // dedup probe above. Best-effort: a unique-constraint violation on
    // race-retry is the desired behavior (insert-or-ignore semantics).
    try {
      await supabaseAdmin
        .from('webhook_events_processed')
        .insert({ event_id: event.id, source: 'stripe' })
    } catch (err) {
      // Race: another retry inserted first. That's fine — the next
      // probe will still find it. Don't fail the handler.
      if (!/duplicate key/i.test(err?.message || '')) {
        console.warn('[webhook] processed-marker insert failed:', err?.message)
      }
    }

    return res.status(200).json({ received: true })
  } catch (err) {
    console.error('Webhook handler error:', err)
    return res.status(500).json({ error: err.message })
  }
}
