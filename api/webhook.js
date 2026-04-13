import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)
const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
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

  try {
    switch (type) {
      case 'checkout.session.completed': {
        const session = data.object
        const userId = session.client_reference_id
        if (userId) {
          await supabaseAdmin.from('profiles').upsert({
            id: userId,
            stripe_customer_id: session.customer,
            subscription_tier: 'pro',
            subscription_status: 'active',
            updated_at: new Date().toISOString(),
          })
        }
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
        await setTierByCustomer(invoice.customer, 'free', 'past_due')
        break
      }

      default:
        // Unhandled event — ignore
        break
    }

    return res.status(200).json({ received: true })
  } catch (err) {
    console.error('Webhook handler error:', err)
    return res.status(500).json({ error: err.message })
  }
}
