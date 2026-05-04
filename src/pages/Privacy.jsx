import { Link } from 'react-router-dom'

// Privacy Policy — Tractova
//
// Hand-rolled, comprehensive. Covers every data source, every processor we
// share data with, and every right we grant the user. Drafted to a CCPA/GDPR-
// equivalent standard even though our customer base is US-only and we are not
// strictly a covered business under CCPA today — the bar is "100% legal cover
// for foreseeable scenarios" per the launch brief.
//
// EFFECTIVE_DATE drives the visible "Last updated" stamp. Bump it whenever
// the policy changes materially. The version field is for our internal
// changelog.

const EFFECTIVE_DATE = 'May 4, 2026'
const VERSION = '1.1'

export default function Privacy() {
  return (
    <main className="min-h-screen bg-paper pt-20 pb-20 px-6">
      <article className="max-w-3xl mx-auto">
        {/* Eyebrow + title */}
        <p
          className="font-mono text-[10px] uppercase tracking-[0.24em] font-bold mb-3"
          style={{ color: '#0F766E' }}
        >
          ◆ Tractova · Legal
        </p>
        <h1
          className="font-serif text-4xl font-semibold text-ink mb-2"
          style={{ letterSpacing: '-0.02em' }}
        >
          Privacy Policy
        </h1>
        <p className="text-sm text-gray-500 mb-1">
          Last updated: <span className="font-mono">{EFFECTIVE_DATE}</span>
          <span className="text-gray-300 mx-2">·</span>
          Version <span className="font-mono">{VERSION}</span>
        </p>
        <p className="text-sm text-gray-500 mb-10">
          This policy describes what information Tractova collects, how we use it,
          who we share it with, and the choices you have. We aim to write it
          plainly. If anything here is unclear, email{' '}
          <a className="underline hover:text-gray-700" href="mailto:hello@tractova.com">
            hello@tractova.com
          </a>{' '}
          and we will explain.
        </p>

        <Divider />

        <Section eyebrow="01" title="Who we are">
          <P>
            <strong>Tractova</strong> ("we", "our", "us") is a US-based intelligence
            platform for renewable-energy project developers, operated by Aden
            Walker. We provide market-research tools, feasibility analysis, and a
            saved-project library. Our service is provided via the website at{' '}
            <span className="font-mono">tractova.com</span> (the "Service"). The
            Service is intended for users in the United States only.
          </P>
        </Section>

        <Section eyebrow="02" title="What we collect">
          <P>We collect information in three categories:</P>
          <List>
            <Li>
              <strong>Account information you provide:</strong> email address,
              password (stored as a one-way hash by our authentication provider),
              and optional profile fields (display name, default state focus).
              Subscription customers also provide billing details, which are
              handled directly by Stripe (see Section 04); we never receive your
              full card number or CVV.
            </Li>
            <Li>
              <strong>Content you generate inside the Service:</strong> Lens
              analysis form inputs (state, county, project size, technology,
              development stage), saved projects, saved scenarios, comparison
              groups, share-link tokens for Deal Memos, cancellation-survey
              responses, and any free-text fields you type. We retain this so
              you can revisit it across devices.
            </Li>
            <Li>
              <strong>Operational telemetry:</strong> server logs (IP address,
              user agent, request path, status code, response time), API call
              counts (for rate-limit enforcement), authentication events
              (sign-in, password reset), and aggregate usage metrics. We do not
              run third-party advertising trackers, fingerprinting tools, or
              session-replay tools.
            </Li>
          </List>
        </Section>

        <Section eyebrow="03" title="How we use your information">
          <P>We use the information described above to:</P>
          <List>
            <Li>Operate the Service — render Lens reports, save projects, send share-link emails.</Li>
            <Li>Authenticate you and protect your account — sign-in, password reset, sign-out across sessions.</Li>
            <Li>Bill subscriptions — through Stripe, including the 14-day free trial and recurring charges at the tier you selected.</Li>
            <Li>Send transactional and product emails — sign-in confirmations, weekly digests, project alerts when state programs or interconnection conditions shift on a project you have saved. You can unsubscribe from non-transactional emails at any time from your Profile or via the link in each email.</Li>
            <Li>Improve the Service — by reviewing aggregate usage, error logs, and qualitative feedback. We do not sell your data, and we do not use account-identifiable data to train AI models.</Li>
            <Li>Comply with applicable law — respond to legal process, prevent fraud and abuse, enforce our Terms of Service.</Li>
          </List>
        </Section>

        <Section eyebrow="04" title="Who we share data with (sub-processors)">
          <P>
            We share narrowly scoped data with a small number of vetted
            sub-processors to operate the Service. Each is bound by its own
            privacy and security commitments. Current sub-processors:
          </P>
          <Table
            cols={['Sub-processor', 'Purpose', 'Data shared', 'Location']}
            rows={[
              ['Supabase (Supabase Inc.)',  'Authentication, database, file storage', 'Account data, content you generate, telemetry', 'United States'],
              ['Vercel (Vercel Inc.)',      'Application hosting, serverless functions, edge cache', 'All data routed through the Service', 'United States (multi-region)'],
              ['Stripe (Stripe, Inc.)',     'Payment processing, subscription billing, customer portal', 'Email, billing details, subscription status', 'United States'],
              ['Anthropic (Anthropic PBC)', 'AI commentary on Lens reports + Scenario Studio', 'Project context (state, county, MW, technology, stage); structured scenario inputs/outputs. No account email or billing data.', 'United States'],
              ['Resend (Resend, Inc.)',     'Transactional + product emails (digests, alerts)', 'Email address, message body', 'United States'],
              ['Cloudflare',                'DNS resolution and DDoS protection at the edge', 'IP address, request metadata', 'Global edge network'],
            ]}
          />
          <P>
            Other than the sub-processors listed above, we do not sell, rent, or
            disclose your personal information to any third party except (a)
            with your explicit consent (e.g. when you generate a Deal Memo
            share-link and send it to a recipient), or (b) to comply with
            applicable law or legal process.
          </P>
        </Section>

        <Section eyebrow="05" title="AI processing disclosure">
          <P>
            Our Lens analysis and Scenario Studio features generate written
            commentary using large language models operated by Anthropic PBC
            (Claude Sonnet 4.6 and Claude Haiku 4.5). When you run an analysis
            or save a scenario:
          </P>
          <List>
            <Li>The project context (state, county, project MW, technology, development stage, and the structured scenario inputs/outputs) is sent to Anthropic's API.</Li>
            <Li>We do <strong>not</strong> send your account email, billing details, password, or unrelated saved projects.</Li>
            <Li>Anthropic processes the request under their commercial Zero Data Retention terms and does not use customer data to train their models.</Li>
            <Li>The generated commentary is then returned to your browser and cached server-side under a content-hash (so identical inputs return the same commentary cheaply). The cache is shared across all Tractova users at the input level, not the user level — your account identity is not stored alongside the cached commentary.</Li>
          </List>
          <P>
            If you do not want the AI features to fire, do not click into the
            Lens flow or save scenarios. The non-AI portions of the Service
            (state map, raw program data, glossary, saved-project library
            without scenarios) work without invoking Anthropic.
          </P>
        </Section>

        <Section eyebrow="06" title="Public data we publish about US energy markets">
          <P>
            Tractova synthesizes publicly available federal, state, and ISO/RTO
            data to power the Service. Each analysis you run combines snapshots
            of the following sources. We document them here so you can audit
            our derivations and verify any number that affects a project
            decision:
          </P>
          <List>
            <Li><Source>EIA Form 860 + Form 861</Source> — substation locations, capacity, retail electricity rates by state and utility (US Energy Information Administration; eia.gov).</Li>
            <Li><Source>NREL PVWatts</Source> — solar capacity factor estimates by location (National Renewable Energy Laboratory; nrel.gov).</Li>
            <Li><Source>LBNL Tracking the Sun (TTS)</Source> — observed installed-PV-cost percentiles for non-residential installations 0.5–5 MW DC, last three install years (Lawrence Berkeley National Laboratory; emp.lbl.gov/tracking-the-sun). Coverage is uneven across states by design: states whose primary solar incentive is a per-MWh REC strike (Illinois, Pennsylvania, Oregon, Delaware, Washington) generate no TTS paper trail and are presented as Tier B regional-analog estimates rather than observed data. Where observed sample exists we publish three confidence tiers — strong (n≥40), modest (n=10–39), thin (n=3–9) — and disclose the sample size on every state lens.</Li>
            <Li><Source>NREL Sharing the Sun</Source> — operating community-solar project data (~3,800 individual projects with utility, developer, capacity, vintage, and LMI attribution). National Renewable Energy Laboratory; nrel.gov/solar/market-research-analysis/community-solar-data.html.</Li>
            <Li><Source>NREL Annual Technology Baseline (ATB)</Source> — modeled $/kW capex benchmarks for utility-scale, distributed commercial, and battery-storage technologies; cross-checked against Tractova synthesis (atb.nrel.gov).</Li>
            <Li><Source>US Census American Community Survey (ACS)</Source> — state and county demographic data, low-and-moderate-income (LMI) household estimates (census.gov).</Li>
            <Li><Source>USFWS National Wetlands Inventory (NWI)</Source> — per-county wetland coverage percentages and feature counts (US Fish and Wildlife Service; fws.gov/program/national-wetlands-inventory).</Li>
            <Li><Source>USDA SSURGO Soil Survey</Source> — per-county prime farmland percentages (US Department of Agriculture Soil Survey Geographic Database; nrcs.usda.gov).</Li>
            <Li><Source>HUD Qualified Census Tracts + Difficult Development Areas (QCT/DDA)</Source> — LIHTC and federal LMI overlay (US Department of Housing and Urban Development; huduser.gov).</Li>
            <Li><Source>CDFI Fund New Markets Tax Credit (NMTC) Low-Income Communities</Source> — IRA §48(e) Cat 1 +10% ITC eligibility (US Treasury CDFI Fund; cdfifund.gov).</Li>
            <Li><Source>DOE NETL Energy Community Tax Credit Bonus layer</Source> — IRA §45/§48 +10% ITC eligibility (US Department of Energy National Energy Technology Lab Energy Data eXchange; edx.netl.doe.gov).</Li>
            <Li><Source>DSIRE — Database of State Incentives for Renewables &amp; Efficiency</Source> — state incentive program documentation (NC Clean Energy Technology Center; dsireusa.org).</Li>
            <Li><Source>ISO/RTO interconnection queue downloads</Source> — public queue snapshots from PJM Interconnection, MISO, NYISO, ISO-NE, and other RTOs where published. Coverage and freshness vary; the Service flags stale snapshots honestly when a scraper has not refreshed within seven days.</Li>
            <Li><Source>Public RSS feeds + state PUC docket portals</Source> — for the News Pulse and Regulatory Activity panels.</Li>
          </List>
          <P>
            All public-data snapshots are republished within the Service in
            derived form (subscores, eligibility flags, summaries). We do not
            assert ownership of the underlying public data. If you reuse our
            derivations, please retain the source attributions described above.
          </P>
          <P>
            Where a per-state observed sample is below the n≥3 floor, or
            where the state's incentive design produces no LBNL TTS paper
            trail at all, we say so explicitly on the relevant state's
            analysis lens and label the synthesized capex value as a
            regional-analog estimate. Sample sizes are surfaced on every
            published row.
          </P>
        </Section>

        <Section eyebrow="07" title="Data retention">
          <List>
            <Li><strong>Account data:</strong> kept while your account is active and for up to 12 months after deletion or sustained inactivity, then purged. Hashed authentication records may persist longer if required for security forensics.</Li>
            <Li><strong>Saved content (projects, scenarios, comparisons):</strong> kept until you delete it or your account is closed.</Li>
            <Li><strong>Server logs:</strong> typically retained 30 days, longer if needed to investigate a security incident.</Li>
            <Li><strong>AI response cache:</strong> 6 hours for Lens verdicts, 30 days for scenario commentary. Cache is keyed by content hash and not associated with your account identity.</Li>
            <Li><strong>Billing records:</strong> retained as required by US tax and accounting law, typically 7 years.</Li>
          </List>
        </Section>

        <Section eyebrow="08" title="Your rights">
          <P>
            We grant the following rights to all users, regardless of state of
            residence. Some are required by law for California, Colorado,
            Virginia, and other-state residents (CCPA, CPA, VCDPA, etc.); we
            extend them to everyone:
          </P>
          <List>
            <Li><strong>Access</strong> — request a copy of the personal information we hold about you.</Li>
            <Li><strong>Correction</strong> — ask us to correct inaccurate personal information. Profile fields are user-editable directly.</Li>
            <Li><strong>Deletion</strong> — request that we delete your account and associated saved content. This is also self-serve via the "Delete account" control on your Profile page.</Li>
            <Li><strong>Portability / Export</strong> — request a machine-readable export of your data (CSV/JSON). Saved projects can be exported directly from the Library.</Li>
            <Li><strong>Withdraw consent</strong> — disable the AI features by not invoking them; cancel your subscription at any time from the Stripe-hosted billing portal linked from your Profile.</Li>
            <Li><strong>Opt out of marketing emails</strong> — via the unsubscribe link in any non-transactional email or by adjusting Profile preferences.</Li>
            <Li><strong>No discrimination</strong> — exercising any of the rights above will never reduce your service quality or your subscription tier.</Li>
          </List>
          <P>
            To exercise any right that is not self-serve, email{' '}
            <a className="underline hover:text-gray-700" href="mailto:hello@tractova.com">
              hello@tractova.com
            </a>
            . We will respond within 30 days. If you are unsatisfied with our
            response, you may also contact your state Attorney General or an
            applicable data-protection authority.
          </P>
        </Section>

        <Section eyebrow="09" title="Cookies and similar technologies">
          <P>
            We use a small number of strictly necessary first-party cookies to
            keep you signed in and remember UI preferences (e.g. dismissal of
            the welcome card, completion of the onboarding tour). These do not
            track you across other sites. We do not use third-party advertising
            cookies.
          </P>
          <P>
            We use{' '}
            <span className="font-mono">localStorage</span> for client-side
            state (including the LensTour completion flag described above). You
            can clear these at any time via your browser's site-data settings.
          </P>
        </Section>

        <Section eyebrow="10" title="Security">
          <P>
            We use industry-standard administrative, technical, and physical
            safeguards: row-level security in our database, encrypted-at-rest
            storage, TLS in transit, principle-of-least-privilege access for
            engineers, and regular dependency-vulnerability scans. No system
            is perfectly secure; you assume the inherent risk of using the
            internet to send us data.
          </P>
        </Section>

        <Section eyebrow="11" title="Children's privacy">
          <P>
            The Service is not directed to children under 13, and we do not
            knowingly collect personal information from children under 13. If
            you believe a child has provided us personal information, contact
            us at{' '}
            <a className="underline hover:text-gray-700" href="mailto:hello@tractova.com">
              hello@tractova.com
            </a>{' '}
            and we will delete the data.
          </P>
        </Section>

        <Section eyebrow="12" title="International users">
          <P>
            The Service is intended for users in the United States. If you
            access the Service from outside the US, you do so on your own
            initiative and are responsible for compliance with local law. Your
            information will be processed in the United States, which may have
            different privacy protections than your jurisdiction.
          </P>
        </Section>

        <Section eyebrow="13" title="Changes to this policy">
          <P>
            We may update this Privacy Policy as our practices evolve. When we
            do, we will revise the "Last updated" date above and, for material
            changes, send you a notice via email or in-product banner before
            the change takes effect. Continued use of the Service after a
            change indicates acceptance.
          </P>
        </Section>

        <Section eyebrow="14" title="Contact us">
          <P>
            Questions, requests, or complaints about this policy or our
            handling of your information: email{' '}
            <a className="underline hover:text-gray-700" href="mailto:hello@tractova.com">
              hello@tractova.com
            </a>
            . Mailed correspondence: please email first to confirm a current
            mailing address.
          </P>
        </Section>

        <p className="mt-12 text-xs text-gray-400">
          See also: <Link to="/terms" className="underline hover:text-gray-700">Terms of Service</Link>
          <span className="mx-2 text-gray-300">·</span>
          <Link to="/" className="underline hover:text-gray-700">Back to dashboard</Link>
        </p>
      </article>
    </main>
  )
}

// ── Tiny presentation helpers ────────────────────────────────────────────────
// Local to keep the legal pages self-contained — no shared component pollution.

function Divider() {
  return <div className="h-px bg-gray-200 my-8" />
}

function Section({ eyebrow, title, children }) {
  return (
    <section className="mb-10">
      <div className="flex items-baseline gap-3 mb-3">
        <span
          className="font-mono text-[10px] uppercase tracking-[0.20em] font-bold"
          style={{ color: '#0F766E' }}
        >
          § {eyebrow}
        </span>
        <h2
          className="font-serif text-xl font-semibold text-ink"
          style={{ letterSpacing: '-0.015em' }}
        >
          {title}
        </h2>
      </div>
      <div className="space-y-3 text-[14px] text-gray-700 leading-relaxed">
        {children}
      </div>
    </section>
  )
}

function P({ children }) {
  return <p>{children}</p>
}

function List({ children }) {
  return <ul className="space-y-2 list-disc pl-5">{children}</ul>
}

function Li({ children }) {
  return <li>{children}</li>
}

function Source({ children }) {
  return <span className="font-semibold text-ink">{children}</span>
}

function Table({ cols, rows }) {
  return (
    <div className="overflow-x-auto border border-gray-200 rounded-lg my-3">
      <table className="w-full text-[12px]">
        <thead className="bg-gray-50 border-b border-gray-200">
          <tr className="text-left text-[10px] font-mono uppercase tracking-[0.16em] text-gray-500">
            {cols.map((c) => (
              <th key={c} className="px-3 py-2 font-bold align-bottom">{c}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-b border-gray-100 last:border-0 align-top">
              {r.map((cell, j) => (
                <td key={j} className="px-3 py-2 text-gray-700">{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
