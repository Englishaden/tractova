import Stripe from 'stripe'
import { applyCors } from './_cors.js'
import { supabaseAdmin } from './lib/_supabaseAdmin.js'

// ── Stripe customer endpoint ─────────────────────────────────────────────────
// Filename retained for backwards compatibility with the deployed POST route.
// This endpoint handles BOTH the billing portal session (POST) and the
// inline invoice list (GET ?action=invoices) so we stay within Vercel
// Hobby's 12-serverless-function cap. The Profile page calls both.
//
//   POST   /api/create-portal-session                  → portal session URL
//   GET    /api/create-portal-session?action=invoices  → sanitized invoices

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)

async function readBody(req) {
  if (req.body) return typeof req.body === 'string' ? JSON.parse(req.body) : req.body
  const chunks = []
  for await (const chunk of req) chunks.push(Buffer.from(chunk))
  return JSON.parse(Buffer.concat(chunks).toString())
}

async function authenticate(req) {
  const authHeader = req.headers.authorization
  if (!authHeader?.startsWith('Bearer ')) return null
  const token = authHeader.slice(7)
  const { data: { user }, error: authErr } = await supabaseAdmin.auth.getUser(token)
  if (authErr || !user) return null
  return user
}

async function getStripeCustomerId(userId) {
  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('stripe_customer_id')
    .eq('id', userId)
    .single()
  return profile?.stripe_customer_id ?? null
}

export default async function handler(req, res) {
  if (applyCors(req, res)) return res.status(200).end()

  // ── GET ?action=invoices — sanitized invoice list for Profile billing UI ──
  if (req.method === 'GET') {
    const action = req.query.action
    if (action !== 'invoices') {
      return res.status(400).json({ error: 'Unknown GET action' })
    }

    const user = await authenticate(req)
    if (!user) return res.status(401).json({ error: 'Unauthorized' })

    const customerId = await getStripeCustomerId(user.id)
    if (!customerId) {
      // No billing account yet (free user or never subscribed) — return
      // an empty list. The UI distinguishes via the empty-state branch.
      return res.status(200).json({ invoices: [] })
    }

    try {
      const list = await stripe.invoices.list({
        customer: customerId,
        limit: 24,
      })
      // Sanitize — only fields the UI actually needs. Never leak the
      // raw Stripe payload (contains internal metadata + line items +
      // payment intent IDs that have no business in the browser).
      const invoices = (list.data || []).map(inv => ({
        id:                   inv.id,
        number:               inv.number,                                      // e.g. "ABC-001"
        status:               inv.status,                                      // 'paid' | 'open' | 'void' | 'uncollectible' | 'draft'
        amount_due:           inv.amount_due,                                  // cents
        amount_paid:          inv.amount_paid,                                 // cents
        currency:             inv.currency,                                    // 'usd'
        created:              inv.created,                                     // unix seconds
        period_end:           inv.period_end,                                  // unix seconds — when the billed period ended
        hosted_invoice_url:   inv.hosted_invoice_url,                          // viewable in browser
        invoice_pdf:          inv.invoice_pdf,                                 // direct PDF download
        description:          inv.lines?.data?.[0]?.description ?? null,
      }))
      return res.status(200).json({ invoices })
    } catch (err) {
      console.error('Invoices list error:', err)
      return res.status(500).json({ error: err.message })
    }
  }

  // ── POST — billing portal session (existing behavior) ────────────────────
  if (req.method !== 'POST') return res.status(405).end('Method Not Allowed')

  const user = await authenticate(req)
  if (!user) return res.status(401).json({ error: 'Unauthorized' })

  const { returnUrl } = await readBody(req)

  const customerId = await getStripeCustomerId(user.id)
  if (!customerId) {
    return res.status(400).json({ error: 'No billing account found' })
  }

  try {
    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: returnUrl,
    })
    return res.status(200).json({ url: session.url })
  } catch (err) {
    console.error('Portal session error:', err)
    return res.status(500).json({ error: err.message })
  }
}
