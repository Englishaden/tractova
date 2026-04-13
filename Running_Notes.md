# Tractova — Build Queue

## ✅ Completed
- Priority 1: Tractova Lens — state context map on results
- Priority 2: Remove project confirmation dialog
- Priority 3: Search form visual redesign + field dropdown polish
- Priority 4: Glossary — 7 dev stages + 5 industry terms + Dev Stages filter
- Iteration 3a: Supabase project persistence (Library + Search save flow migrated from localStorage)
- Iteration 3b — Priority 1: Auth gating (Lens + Library behind auth; Glossary + Dashboard public)
- Iteration 3b — Priority 2: Data expansion to 18 states (countyData.js)
- Iteration 3b — Priority 3: Landing / marketing page (Landing.jsx)
- Iteration 4 — Stripe Pro subscription ($9.99/mo): checkout, portal, webhook, real-time tier sync
- Iteration 4 — Paywall on Lens + Library (UpgradePrompt + wrapper gate pattern)
- Iteration 4 — Alert badges on project cards in Library (getAlerts, AlertChip, urgent/warning/info)

---

## Current: Iteration 4 — Remaining

## Proposed discussion for Claude, give feedback where necessary on the below prompt. The goal is how to manage web scraping in an efficient manner to have live updated data via pulling from state regs or state incentive programs like MA Smart 3.0 or ABP shines 2.0, etc, but have it be as efficient and easy to update as possible even if it requires us to run a scraping 1-2 times per week, whereby you would pull the data into the database and remove any old data. 

- Build a simple, structured backend in Supabase that serves as the single source of truth for program rules and constraints. Start with one table (program_rules) where each row represents a state/program/utility combination, and includes key fields such as LMI minimum/maximum percentages, minimum bill applicability (LMI vs non-LMI), net crediting, and concise notes on credit structure and key risks. Populate this manually at first using trusted public sources, focusing on a few core markets (e.g., MA, VA, IL). Keep the schema simple and clean—prioritize accuracy, usability, and speed over building a complex or fully automated system upfront.

This is a proposed approach for the next iteration of the product, and I’d like feedback before building further. The application layer would pull from this structured dataset to deterministically evaluate project viability based on user inputs (state, utility, size, subscriber mix), returning a clear go/no-go (or viable/borderline/not viable) with plain-English explanations and risk flags tied directly to stored rules. Longer term, the idea is to maintain and scale this database by running updates 1–2 times per week, where new program or policy information is identified from public sources, structured, and pushed into Supabase. Does this methodology make sense, and do you agree this is an accurate and scalable way to manage and update a growing dataset like this?

---

## Backlog — Iteration 4 (remaining)

- Resend transactional email — weekly project digest, policy alerts

---

## Backlog — Iteration 5

- Data scrapers: DSIRE, FERC queue data, EIA utility territory
- Scheduled refresh jobs (Vercel cron or Supabase edge functions)
- Admin panel for reviewing / approving scraped data
- Data freshness indicators in the UI

---

## Long-term Backlog

- RFP Tracker (public PUC data)
- IRA Energy Community map layer (DOE API)
- Utility Report Card (standalone profile page per utility)
- Document Vault with AI summarization
