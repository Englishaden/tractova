// hCaptcha sitekey — PUBLIC (it's meant to ship to the browser). The real key
// comes from VITE_HCAPTCHA_SITEKEY (set in Vercel + .env.local); it falls back
// to hCaptcha's official TEST sitekey so local dev + CI always render a widget
// that auto-passes. The matching SECRET key lives only in Supabase Auth (Bot &
// Abuse Protection) — never in this repo.
//
// Captcha is enforced by Supabase on signUp / signInWithPassword /
// resetPasswordForEmail. updateUser (the recovery-session password change) is
// NOT captcha-gated, so UpdatePassword.jsx passes no token.
export const HCAPTCHA_SITEKEY =
  import.meta.env.VITE_HCAPTCHA_SITEKEY || '10000000-ffff-ffff-ffff-000000000001'
