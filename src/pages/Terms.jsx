import { Link } from 'react-router-dom'

// Terms of Service — Tractova
//
// Designed to provide comprehensive legal cover for an early-stage US-based
// SaaS analytics platform serving renewable-energy project developers.
// Discloses every data source, every methodological limitation, every
// platform-availability constraint, and every risk-allocation we need
// users to accept before they make business decisions on top of our output.
//
// IMPORTANT: This is a hand-rolled draft suitable for first-day-of-launch
// use. Aden has indicated he will sign-off after reviewing. For
// jurisdictional questions or before a major institutional customer engages,
// retain a US tech-transactions attorney for review.

const EFFECTIVE_DATE = 'May 2, 2026'
const VERSION = '1.0'

export default function Terms() {
  return (
    <main className="min-h-screen bg-paper pt-20 pb-20 px-6">
      <article className="max-w-3xl mx-auto">
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
          Terms of Service
        </h1>
        <p className="text-sm text-gray-500 mb-1">
          Last updated: <span className="font-mono">{EFFECTIVE_DATE}</span>
          <span className="text-gray-300 mx-2">·</span>
          Version <span className="font-mono">{VERSION}</span>
        </p>
        <p className="text-sm text-gray-500 mb-10">
          Please read these Terms carefully before using the Service. They
          govern your use of Tractova and your relationship with us. By
          creating an account or using the Service, you agree to be bound by
          these Terms.
        </p>

        <Divider />

        <Section eyebrow="01" title="The Service">
          <P>
            Tractova ("we", "our", "us") provides an online research and
            analysis platform for renewable-energy project developers (the
            "Service"). The Service includes the website at{' '}
            <span className="font-mono">tractova.com</span>, the Tractova Lens
            analysis tool, the Scenario Studio, the saved-project Library, the
            News Pulse and Regulatory Activity panels, the Glossary, and any
            related features we add over time.
          </P>
          <P>
            The Service is provided on an "as-is" and "as-available" basis. We
            may modify, add, or remove features at any time, with reasonable
            notice for changes that materially affect paid users.
          </P>
        </Section>

        <Section eyebrow="02" title="Accounts and eligibility">
          <List>
            <Li>You must be at least 18 years old to create an account.</Li>
            <Li>You must provide accurate registration information and keep it current.</Li>
            <Li>You are responsible for safeguarding your password and for all activity under your account. Notify us immediately at <a className="underline hover:text-gray-700" href="mailto:hello@tractova.com">hello@tractova.com</a> if you suspect unauthorized access.</Li>
            <Li>You may not impersonate another person or entity, share your account, or create multiple accounts to evade rate limits or pricing tiers.</Li>
            <Li>The Service is intended for use within the United States. If you access it from elsewhere, you do so on your own initiative and at your own risk; we make no commitment that the Service is appropriate or available outside the US.</Li>
          </List>
        </Section>

        <Section eyebrow="03" title="Subscription and billing">
          <List>
            <Li>The Service offers a free tier and one or more paid subscription tiers, with current pricing displayed at sign-up. As of the effective date above, the Pro tier is <strong>$29.99 USD per month</strong> with a <strong>14-day free trial</strong>. Pricing may change with at least 30 days advance notice for existing subscribers.</Li>
            <Li>Subscriptions are billed in advance and renew automatically until canceled. Billing is processed by <strong>Stripe, Inc.</strong>; we do not store your full card number.</Li>
            <Li>You can cancel at any time via the Stripe-hosted billing portal accessible from your Profile page. Cancellation stops future charges; the current paid period continues until the end of the term you have already paid for. We do not provide pro-rated refunds for partial billing periods.</Li>
            <Li>If a payment fails, we may suspend access to paid features until the balance is resolved. We may permanently downgrade or close accounts after sustained payment failure.</Li>
            <Li>Sales tax may be applied where required by law and added to the price displayed.</Li>
          </List>
        </Section>

        <Section eyebrow="04" title="Acceptable use">
          <P>You agree not to:</P>
          <List>
            <Li>Reverse engineer, decompile, or attempt to extract the source code or non-public infrastructure of the Service.</Li>
            <Li>Scrape, mass-download, or systematically harvest content from the Service in a manner that exceeds normal individual use or our published rate limits.</Li>
            <Li>Resell, sublicense, or repackage the Service or its derived data for commercial distribution without our prior written consent.</Li>
            <Li>Upload viruses, malware, or attempt to disrupt, overload, or compromise the Service or its sub-processors.</Li>
            <Li>Use the Service to impersonate another developer, fabricate intelligence reports for misleading communications to investors or regulators, or engage in fraud.</Li>
            <Li>Use the Service in violation of any applicable US federal, state, or local law, including export-control laws, sanctions laws, or laws governing regulated industries.</Li>
          </List>
          <P>
            Violation of this section may result in immediate suspension or
            termination of your account without refund.
          </P>
        </Section>

        <Section eyebrow="05" title="Intellectual property">
          <P>
            The Service, including its design, source code, brand, trademarks
            ("Tractova", "Tractova Lens", "Scenario Studio"), and all
            value-added derivations of public data (subscores, eligibility
            calculators, AI-generated commentary, methodology documentation),
            is owned by us and our licensors and is protected by US and
            international intellectual-property laws.
          </P>
          <P>
            You retain ownership of the original content you generate inside
            the Service (project names, free-text notes, custom scenario
            inputs). By using the Service, you grant us a non-exclusive,
            royalty-free license to host, store, process, and display that
            content as needed to operate the Service.
          </P>
          <P>
            Public-data sources we synthesize (EIA, US Census, USFWS NWI, USDA
            SSURGO, HUD, CDFI, DOE NETL EDX, DSIRE, ISO/RTO queue data) remain
            the property of their respective publishers and are subject to
            their terms. The Service includes attribution to each source on
            the underlying panels and within the Privacy Policy.
          </P>
        </Section>

        <Section eyebrow="06" title="Important — disclaimers about data, scoring, and AI commentary">
          <P>
            <strong>This section is the most important part of the agreement.
            Read it before relying on Tractova for any business decision.</strong>{' '}
            By using the Service you acknowledge and agree to each of the
            following:
          </P>
          <List>
            <Li>
              <strong>The Service is a research accelerator, not professional
              advice.</strong> Outputs are decision-support intelligence, not
              engineering, legal, financial, or investment advice. You are
              solely responsible for verifying any output against authoritative
              sources, conducting your own due diligence, and engaging
              qualified professionals (engineers, attorneys, accountants,
              financial advisors) before committing capital, signing leases,
              or representing any project to third parties.
            </Li>
            <Li>
              <strong>Data may be stale, incomplete, or incorrect.</strong> We
              source data from public federal, state, and ISO/RTO datasets and
              from third-party scrapers. Public data is occasionally republished
              with corrections; ISO/RTO download URLs change without notice and
              our scrapers may fail silently. We surface freshness signals
              honestly when we know data is stale, but we cannot guarantee any
              dataset is current at the moment you read it.
            </Li>
            <Li>
              <strong>Scoring and ranking are subjective derivations.</strong>{' '}
              The Feasibility Index, sub-scores (Site Control, Interconnection,
              Offtake), Ease Score, Runway badge, and any quantitative
              outputs are produced by methodology we have designed and may
              modify. They are calibrated heuristics — defensible, but not
              audited financial-grade calculations. Two reasonable analysts
              looking at the same underlying data may produce different
              numbers.
            </Li>
            <Li>
              <strong>Scenario Studio outputs are illustrative.</strong> Year-1
              revenue, project IRR, equity IRR, payback, NPV, DSCR, LCOE, and
              lifetime revenue are computed from inputs you provide and from
              calibrated baselines. They are not project pro formas. Real
              project economics depend on specifics (PPA terms, tax-equity
              structure, debt covenants, escalators, basis risk, curtailment,
              site-specific capacity factor, supply-chain pricing) that the
              Service does not fully model.
            </Li>
            <Li>
              <strong>AI commentary is generated by language models and may be
              wrong.</strong> Where the Service generates written commentary
              ("Analyst Brief", "Scenario Studio analyst note", peer-state
              rationale), it is produced by Anthropic Claude models. Language
              models can hallucinate facts, cite incorrect numbers, or draw
              unsound conclusions. Treat AI commentary as a senior-analyst
              draft to review and revise — never as final analysis.
            </Li>
            <Li>
              <strong>Coverage is uneven.</strong> Some states, counties, and
              ISOs have richer live data than others. The Service flags
              "limited coverage" where applicable, but you should always
              confirm interconnection conditions with the serving utility,
              wetland boundaries with a per-site survey, and program-capacity
              status with the state PUC or program administrator before
              committing capital.
            </Li>
            <Li>
              <strong>The Service does not provide legal compliance
              certification.</strong> Eligibility flags (e.g. Energy Community,
              §48(e) NMTC LIC, HUD QCT/DDA) reflect our understanding of
              public eligibility layers as of the snapshot date. They are not
              legal opinions. Final ITC/PTC eligibility determinations require
              a qualified tax-equity attorney or CPA review against the
              specific project facts at the placed-in-service date.
            </Li>
            <Li>
              <strong>Methodology and outputs may change.</strong> We
              continuously refine the Service. Sub-scores, AI commentary, and
              eligibility assertions for the same project may differ from one
              run to the next. Save important outputs as Library entries or
              Deal Memos if you need to preserve a snapshot.
            </Li>
            <Li>
              <strong>No representation of fitness for any particular
              purpose.</strong> The Service is provided "AS IS" and "AS
              AVAILABLE", without warranties of any kind, whether express or
              implied, including but not limited to merchantability, fitness
              for a particular purpose, accuracy, completeness, non-
              infringement, or uninterrupted operation.
            </Li>
          </List>
        </Section>

        <Section eyebrow="07" title="Limitation of liability">
          <P>
            To the maximum extent permitted by applicable law:
          </P>
          <List>
            <Li>We are not liable for indirect, incidental, special, consequential, or punitive damages, including loss of profits, revenue, business opportunities, savings, data, goodwill, or any project-economics outcome that did not match a Service output.</Li>
            <Li>Our total cumulative liability for all claims arising out of or related to your use of the Service is capped at the greater of (a) the amount you paid us in the twelve months preceding the claim, or (b) one hundred US dollars ($100). For free-tier users, this cap is one hundred US dollars ($100).</Li>
            <Li>Some jurisdictions do not allow the exclusion or limitation of certain damages; in those jurisdictions, our liability is limited to the smallest extent permitted by law.</Li>
          </List>
        </Section>

        <Section eyebrow="08" title="Indemnification">
          <P>
            You agree to defend, indemnify, and hold harmless Tractova, its
            owners, employees, contractors, and sub-processors from any claim,
            damage, liability, or expense (including reasonable attorneys'
            fees) arising out of (a) your violation of these Terms, (b) your
            misuse of the Service, (c) your reliance on Service output for a
            business decision without independent verification, or (d) your
            violation of any law or third-party right.
          </P>
        </Section>

        <Section eyebrow="09" title="Third-party services">
          <P>
            The Service relies on third-party sub-processors (Supabase, Vercel,
            Stripe, Anthropic, Resend, Cloudflare, and others as disclosed in
            our Privacy Policy). The Service may also link to or display
            content from third-party publishers (federal agencies, state PUCs,
            ISO/RTOs, news feeds). We do not control those third parties and
            are not responsible for their content, accuracy, or availability.
          </P>
        </Section>

        <Section eyebrow="10" title="Termination">
          <List>
            <Li>You may stop using the Service and close your account at any time via your Profile page.</Li>
            <Li>We may suspend or terminate your access at any time, with or without notice, for violation of these Terms, suspected fraud, abuse, payment failure, or for legal or operational reasons.</Li>
            <Li>Upon termination, your right to use the Service ends immediately. Sections that by their nature should survive termination (Sections 05–08, 11–14, and any accrued payment obligations) will survive.</Li>
          </List>
        </Section>

        <Section eyebrow="11" title="Governing law and disputes">
          <P>
            These Terms and any disputes arising from or relating to them or
            the Service are governed by the laws of the State of New York,
            without regard to conflict-of-laws principles. The exclusive
            jurisdiction for any litigation that is not subject to the
            arbitration commitment below is the state and federal courts
            located in New York, New York, and you consent to personal
            jurisdiction there.
          </P>
          <P>
            <strong>Informal resolution first.</strong> If you have a dispute
            with us, you agree to first contact us at{' '}
            <a className="underline hover:text-gray-700" href="mailto:hello@tractova.com">
              hello@tractova.com
            </a>{' '}
            and attempt good-faith resolution for at least 30 days before
            commencing any formal proceeding.
          </P>
          <P>
            <strong>Binding arbitration; class-action waiver.</strong> Any
            unresolved dispute will be resolved by binding individual
            arbitration administered by JAMS under its Streamlined Arbitration
            Rules. You and we agree that each may bring claims only in an
            individual capacity and not as part of any class or representative
            proceeding. The arbitrator may award only individual relief. This
            arbitration commitment does not apply to (a) small-claims-court
            actions, or (b) injunctive relief sought to protect intellectual
            property rights, which may be brought in court.
          </P>
        </Section>

        <Section eyebrow="12" title="Changes to these Terms">
          <P>
            We may update these Terms as the Service evolves. When we do, we
            will revise the "Last updated" date above and, for material
            changes, send you a notice via email or in-product banner before
            the change takes effect. Continued use of the Service after a
            change indicates acceptance.
          </P>
        </Section>

        <Section eyebrow="13" title="Miscellaneous">
          <List>
            <Li><strong>Entire agreement.</strong> These Terms and the Privacy Policy constitute the entire agreement between you and us regarding the Service and supersede prior agreements.</Li>
            <Li><strong>Severability.</strong> If any provision is held invalid, the remaining provisions remain in effect.</Li>
            <Li><strong>No waiver.</strong> Our failure to enforce any provision is not a waiver of that provision.</Li>
            <Li><strong>Assignment.</strong> You may not assign these Terms without our prior written consent. We may assign them in connection with a merger, acquisition, or sale of all or substantially all assets.</Li>
            <Li><strong>Notices.</strong> We may give notice via email to your account address or via in-product banner. You may give notice to us at <a className="underline hover:text-gray-700" href="mailto:hello@tractova.com">hello@tractova.com</a>.</Li>
            <Li><strong>Force majeure.</strong> We are not liable for failures caused by events beyond our reasonable control (natural disasters, pandemics, internet-backbone outages, sub-processor failures, government actions).</Li>
            <Li><strong>US-only.</strong> The Service is offered from the United States. We make no representation that it is appropriate or compliant outside the US.</Li>
          </List>
        </Section>

        <Section eyebrow="14" title="Contact">
          <P>
            Questions about these Terms? Email{' '}
            <a className="underline hover:text-gray-700" href="mailto:hello@tractova.com">
              hello@tractova.com
            </a>
            .
          </P>
        </Section>

        <p className="mt-12 text-xs text-gray-400">
          See also: <Link to="/privacy" className="underline hover:text-gray-700">Privacy Policy</Link>
          <span className="mx-2 text-gray-300">·</span>
          <Link to="/" className="underline hover:text-gray-700">Back to dashboard</Link>
        </p>
      </article>
    </main>
  )
}

// ── Tiny presentation helpers — duplicated from Privacy.jsx so legal pages
// remain self-contained and edits don't ripple through shared components.

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

function P({ children }) { return <p>{children}</p> }
function List({ children }) { return <ul className="space-y-2 list-disc pl-5">{children}</ul> }
function Li({ children }) { return <li>{children}</li> }
