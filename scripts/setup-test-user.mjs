/**
 * One-shot: confirm the smoke-test user's email + flip their profile to Pro.
 *
 * Uses the service-role key (server-side, bypasses RLS). Reads creds from
 * .env.local. Idempotent — safe to re-run.
 *
 * Usage:  node scripts/setup-test-user.mjs
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { createClient } from '@supabase/supabase-js'

// Tiny .env.local loader (same shape as tests/auth.setup.js).
const raw = readFileSync(resolve(process.cwd(), '.env.local'), 'utf8')
for (const line of raw.split(/\r?\n/)) {
  const t = line.trim()
  if (!t || t.startsWith('#')) continue
  const eq = t.indexOf('=')
  if (eq === -1) continue
  const k = t.slice(0, eq).trim()
  let v = t.slice(eq + 1).trim()
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
    v = v.slice(1, -1)
  }
  if (process.env[k] === undefined) process.env[k] = v
}

const url      = process.env.SUPABASE_URL
const key      = process.env.SUPABASE_SERVICE_ROLE_KEY
const email    = process.env.TEST_USER_EMAIL
const password = process.env.TEST_USER_PASSWORD

if (!url || !key) throw new Error('SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY missing in .env.local')
if (!email)      throw new Error('TEST_USER_EMAIL missing in .env.local')

const admin = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })

console.log(`→ Looking up ${email}…`)

// Page through admin.listUsers (max 1000 per page) until we find the email.
async function findUserByEmail(target) {
  let page = 1
  while (true) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 })
    if (error) throw error
    const hit = data.users.find((u) => u.email?.toLowerCase() === target.toLowerCase())
    if (hit) return hit
    if (data.users.length < 200) return null
    page++
    if (page > 50) return null  // safety
  }
}

let user = await findUserByEmail(email)

if (!user) {
  if (!password) throw new Error('User not found and TEST_USER_PASSWORD missing — cannot create.')
  console.log(`→ User not found. Creating with email_confirm=true…`)
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  })
  if (error) throw error
  user = data.user
  console.log(`✓ Created user ${user.id}`)
} else {
  console.log(`→ Found user ${user.id}. email_confirmed_at=${user.email_confirmed_at ?? 'null'}`)
  if (!user.email_confirmed_at) {
    const { error } = await admin.auth.admin.updateUserById(user.id, { email_confirm: true })
    if (error) throw error
    console.log(`✓ Email confirmed`)
  } else {
    console.log(`✓ Email already confirmed`)
  }
  if (password) {
    const { error } = await admin.auth.admin.updateUserById(user.id, { password })
    if (error) throw error
    console.log(`✓ Password synced from .env.local`)
  }
}

console.log(`→ Flipping profile to Pro…`)
const { error: profileErr } = await admin
  .from('profiles')
  .update({ subscription_tier: 'pro', subscription_status: 'active' })
  .eq('id', user.id)
if (profileErr) {
  // If the profile row doesn't exist (sign-up trigger may not have fired in
  // some flows), insert it.
  if (profileErr.code === 'PGRST116' || profileErr.message?.includes('no rows')) {
    const { error: insErr } = await admin
      .from('profiles')
      .insert({ id: user.id, subscription_tier: 'pro', subscription_status: 'active' })
    if (insErr) throw insErr
  } else {
    throw profileErr
  }
}

const { data: check } = await admin
  .from('profiles')
  .select('subscription_tier, subscription_status')
  .eq('id', user.id)
  .single()

console.log(`✓ Profile: tier=${check?.subscription_tier} status=${check?.subscription_status}`)
console.log(`\nDone. Run:  npm run test:smoke:pro`)
