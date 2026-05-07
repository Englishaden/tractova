/**
 * Single source of truth for the service-role Supabase client.
 *
 * Every API endpoint, scraper, and handler that needs full DB access
 * imports `supabaseAdmin` from here rather than calling `createClient`
 * inline. Consolidates 18 prior call sites into one — the env vars
 * (`VITE_SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY`) and constructor
 * options were identical at every call site, so behavior is unchanged.
 *
 * Vercel Functions reuse module instances across requests under Fluid
 * Compute, so a single instance per cold-start is the right shape.
 *
 * Mirrors the api/_admin-auth.js + api/_cors.js + api/_rate-limit.js
 * helper-module convention.
 */
import { createClient } from '@supabase/supabase-js'

export const supabaseAdmin = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
)
