import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'
import { applyCors } from './_cors.js'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)

const supabaseAdmin = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function readBody(req) {
  if (req.body) return typeof req.body === 'string' ? JSON.parse(req.body) : req.body
  const chunks = []
  for await (const chunk of req) chunks.push(Buffer.from(chunk))
  return JSON.parse(Buffer.concat(chunks).toString())
}

export default async function handler(req, res) {
  if (applyCors(req, res)) return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).end('Method Not Allowed')

  // Verify Supabase JWT
  const authHeader = req.headers.authorization
  if (!authHeader?.startsWith('Bearer ')) return res.status(401).json({ error: 'Unauthorized' })
  const token = authHeader.slice(7)
  const { data: { user }, error: authErr } = await supabaseAdmin.auth.getUser(token)
  if (authErr || !user) return res.status(401).json({ error: 'Unauthorized' })

  const { priceId, successUrl, cancelUrl } = await readBody(req)

  // Server-side validation: the client passes priceId from a Vite env var
  // (VITE_STRIPE_PRICE_ID) but a malicious request could substitute any
  // Stripe price. Stripe will reject unknown prices, but a price belonging
  // to OUR account at a different rate (e.g. an internal employee discount
  // price) would succeed and silently create a subscription at the wrong
  // tier. Allowlist the canonical price configured server-side; if no env
  // is set, accept anything (dev / first-time setup).
  const allowedPriceId = process.env.STRIPE_PRICE_ID || process.env.VITE_STRIPE_PRICE_ID
  if (allowedPriceId && priceId && priceId !== allowedPriceId) {
    return res.status(400).json({ error: 'Invalid price' })
  }

  try {
    // Fetch or create Stripe customer linked to this user
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('stripe_customer_id')
      .eq('id', user.id)
      .single()

    let customerId = profile?.stripe_customer_id
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        metadata: { supabase_user_id: user.id },
      })
      customerId = customer.id
      await supabaseAdmin
        .from('profiles')
        .upsert({ id: user.id, stripe_customer_id: customerId })
    }

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: successUrl,
      cancel_url: cancelUrl,
      client_reference_id: user.id,
      allow_promotion_codes: true,
      // 14-day trial — reduces sticker-price friction at the $29.99 tier.
      // useSubscription.isPro already includes 'trialing' status (see
      // src/hooks/useSubscription.js), so the user gets full Pro access
      // immediately on checkout. Card is captured up-front (Stripe default)
      // and only charged on day 14 unless the user cancels first.
      subscription_data: { trial_period_days: 14 },
    })

    return res.status(200).json({ url: session.url })
  } catch (err) {
    console.error('Checkout session error:', err)
    return res.status(500).json({ error: err.message })
  }
}
