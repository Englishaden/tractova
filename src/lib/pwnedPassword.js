// pwnedPassword.js — app-layer leaked-password check via HaveIBeenPwned.
//
// Supabase gates its native HIBP "leaked password protection" to the Pro plan,
// so we implement the equivalent ourselves. Uses HIBP's free Pwned Passwords
// "range" API with k-ANONYMITY, so the password and its full hash NEVER leave
// the browser:
//   1. SHA-1 the password locally (Web Crypto).
//   2. Send ONLY the first 5 hex chars of the hash to
//      api.pwnedpasswords.com/range/<prefix>.
//   3. The API returns every breached-hash SUFFIX sharing that prefix (~hundreds);
//      we match the remaining 35 chars locally.
// The server never sees which password (or even which full hash) we asked about.
//
// Advisory by design: it runs client-side at signup / password-change to deter
// reused/breached passwords. Server-side enforcement (so it cannot be bypassed)
// would route through the api/lens-insight.js multiplexer — deferred follow-up.
//
// FAIL-OPEN: any error (offline, HIBP outage, no Web Crypto) returns 0 so a
// third-party hiccup never blocks a signup. Requires
// `https://api.pwnedpasswords.com` in the CSP connect-src (vercel.json).

async function sha1HexUpper(text) {
  const digest = await crypto.subtle.digest('SHA-1', new TextEncoder().encode(text))
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
    .toUpperCase()
}

// Returns how many times the password appears in known breaches (0 = safe / not
// found). Returns 0 on any failure (fail-open). Never logs the password.
export async function pwnedPasswordCount(password) {
  if (!password || typeof crypto?.subtle?.digest !== 'function') return 0
  try {
    const hash = await sha1HexUpper(password)
    const prefix = hash.slice(0, 5)
    const suffix = hash.slice(5)
    const res = await fetch(`https://api.pwnedpasswords.com/range/${prefix}`, {
      // Padding adds decoy zero-count entries so the response size doesn't leak
      // how many real hashes share the prefix. Decoys carry count 0, so they
      // can't false-positive below.
      headers: { 'Add-Padding': 'true' },
    })
    if (!res.ok) return 0
    const body = await res.text()
    for (const line of body.split('\n')) {
      const [suf, count] = line.trim().split(':')
      if (suf === suffix) return parseInt(count, 10) || 0
    }
    return 0
  } catch (err) {
    console.warn('[pwnedPassword] leaked-password check skipped:', err?.message)
    return 0
  }
}
