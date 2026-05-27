# Site Teardown: Nixtio

**URL:** https://nixtio.com
**Built by:** Nixtio (in-house — agency dogfooding its own work)
**Platform:** Next.js (App Router), deployed on Vercel (`dpl_…` build-id in chunk paths)
**Date analyzed:** 2026-05-27
**Purpose of teardown:** Source the visual + motion vocabulary for a Tractova landing-page redesign. Per session scoping: **inspired-by lighter**, not literal clone. We will NOT port the MP4 video backgrounds, the Splide carousel, the Lenis smooth-scroll, or any GSAP scrubbing — but we will port typography, section rhythm, the accordion pattern, the FAQ, the stat-counter, the scroll-reveal entrance, and the dark-section / light-section alternation.

---

## Tech Stack (Confirmed from Source)

| Technology | Evidence | Purpose |
|---|---|---|
| Next.js 14+ App Router | `/_next/static/chunks/`, `dpl_…` build ID, RSC stream payload in `<script>self.__next_f.push(...)` | Page framework |
| AOS (Animate on Scroll) | `data-aos="fade-up"` + `data-aos-delay` attributes on every animated section | Section entrance animations |
| Splide.js | `.splide` carousel for testimonials slider on mobile, paged dots styled in CSS | Mobile testimonial carousel |
| Altcha | `<altcha-widget challenge="/api/altcha" auto="onload" hidefooter hidelogo>` in contact form | CAPTCHA on contact form (open-source, no Google reCAPTCHA) |
| HTML `<video autoPlay loop muted playsInline>` with WebP poster | Hero + Why-section + About-section + Arsen-modal | Cinematic ambient backgrounds — Tractova will SKIP this |
| Next/Image with `srcSet` ladder (640w→3840w) | Every raster image | Responsive image pipeline |
| Inter (Google Fonts pattern, hosted via `@font-face` woff2/woff) | `--font-family: "Inter", sans-serif` in `:root` | Body + display typography |
| Custom SCSS Modules | Class names like `hero-section-module-scss-module__9Qb3Mq__container` | Component-scoped styling |

**Inferred but not confirmed:**
- Likely a custom "preloader" overlay (`.preloader-module-scss-module__CZbkPa__overlay` is in the DOM but the actual reveal logic wasn't fetched — typical pattern: black overlay slides up off-screen on `window.load`).
- Likely a Lenis or Locomotive smooth-scroll wrapper (typical for sites with this much scroll-tied motion), though we did not confirm by fetching JS — the AOS attributes alone cover the visible reveal behavior.

---

## Design System

### Colors

| Name/Usage | Value | Where it's used |
|---|---|---|
| Body background | `#f5f5f5` | Light "cream" page background |
| Section background (light) | inherits `body` (`#f5f5f5`) | Most sections |
| Section background (dark) | `#000` (pure black, via `.black-section`) | Hero, Services, Footer, Stats counter |
| Primary text | `#0a0a0a` | All headings, all body copy on light sections |
| Secondary text | `#0a0a0a99` (60% black) | Body paragraphs, captions |
| Tertiary text (on dark) | `#fff9` (60% white) | Body copy on `.black-section` |
| Border (on dark) | `#ffffff29` (16% white) | Dividers inside black sections |
| Soft fill | `#0a0a0a0a` (4% black) | Hover backgrounds, inactive states |
| Single brand accent | `#40a53c` (`--color-green`) | Sparingly — accent dots, the Upwork badge fill |
| Star (rating) | `#FB9826` (orange) | Testimonial 5-star icons, Clutch reviews |

**Palette philosophy:** Effectively monochrome (black / white / two grays) + one orange star color in testimonials. Nixtio runs an austere design-language for a design agency — visually, the design lets the work speak. **Tractova translation:** swap pure-black for brand-navy `#0F1A2E`, keep cream `#FAFAF7` (already our `--color-paper`), accent with teal `#0F766E` + secondary amber `#BA7517`. Same austere-monochrome principle, Tractova's palette.

### Typography

| Role | Font Family | Weight | Letter-spacing | Size (desktop) | Size (≤1024) | Size (≤768) | Line-height |
|---|---|---|---|---|---|---|---|
| `h1` (display) | Inter | 600 | `-0.4625rem` (-7.4px) | `9.25rem` (148px) | `7.375rem` | `3.25rem` | 110% / 96% |
| `h1--secondary` | Inter | 600 | `-0.1875rem` | `3.75rem` (60px) | — | `2.75rem` | 110% |
| `h2` | Inter | 600 | `-0.1625rem` | `3.25rem` (52px) | — | `2.75rem` | 110% |
| `h2--big` (footer "Let's talk") | Inter | 600 | `-0.45rem` (-7.2px) | `9rem` (144px) | — | — | `9rem` |
| `h3` | Inter | 500 | `-0.075rem` | `1.875rem` (30px) | `1.5rem` | — | 120% |
| `h3--secondary` | Inter | 600 | `-0.075rem` | `1.875rem` | — | — | 125% |
| `h4` | Inter | 600 | `-0.055rem` | `1.375rem` (22px) | — | — | `1.65rem` |
| `h5` | Inter | 600 | `-0.0562rem` | `1.125rem` (18px) | — | — | `1.125rem` |
| `.text--lg` | Inter | 500 | `-0.045rem` | `1.125rem` | — | — | 120% |
| `.text--base` | Inter | 500 | `-0.04rem` | `1rem` | — | — | 120% |
| `.text--sm` | Inter | 500 | `-0.035rem` | `0.875rem` (14px) | — | — | `1.125rem` |
| `.text--xs` | Inter | 500 | `-0.03rem` | `0.75rem` (12px) | — | — | 130% |

**Key observation:** Every type role has a measured negative letter-spacing — **the bigger the type, the tighter the tracking** (h1 at -0.46rem is *extremely* tight). This is the single biggest move that makes the type feel modern + intentional rather than default. Line-height is `110%` on display sizes, `120%` on body — also tighter than browser defaults (120% / 140%).

**Tractova translation:** apply identical letter-spacing / line-height ratios to Geist (which is structurally close to Inter — geometric grotesque, same x-height proportions). Geist takes negative tracking as well as Inter does.

### Spacing System

CSS custom properties drive section padding:

```css
--padding-sm: 2.25rem;   /* 36px */
--padding-md: 7.5rem;    /* 120px → 100px on ≤1024 */
--padding-lg: 10rem;     /* 160px → 100px on ≤1024 */
--padding-xl: 11.875rem; /* 190px → 100px on ≤1024 */
```

Section spacing scale (via `.default-section.--spacing-{x}`):

| Class | Gap | On ≤768 |
|---|---|---|
| `--spacing-xs` | `2.5rem` (40px) | — |
| `--spacing-sm` | `4.28rem` (68.5px) | — |
| `--spacing-md` | `5.62rem` (90px) | `2.5rem` |
| `--spacing-lg` | `6.25rem` (100px) | `2.5rem` |
| `--spacing-xl` | `7.5rem` (120px) | `2.5rem` |
| `--spacing-xxl` | `11.875rem` (190px) | `6.25rem` |

**Wrapper:**
```css
.wrapper { max-width: 75.5rem; padding: 0 2.25rem; }  /* default: 1208px */
@media (min-width: 1500px) { .wrapper { max-width: 95rem; } }  /* 1520px */
@media (max-width: 768px) { .wrapper { padding: 0 1.5rem; } }
```

**Default 2-col layout** (used on most content blocks):
```css
.default-columns { display: flex; gap: 0.25rem; align-items: start; }
.default-columns__subtitle { width: 100%; max-width: 17.4375rem; }  /* ≈ 279px — the eyebrow column */
.default-columns__content { display: flex; gap: 2rem; flex: 1; justify-content: space-between; }
```

The "eyebrow / subtitle column" on the left at fixed ~279px and the "content column" on the right that fills the rest is **the Nixtio layout signature** — almost every section uses it. On `≤1024` it collapses to single-column. **Tractova should adopt this pattern verbatim** — it's why every Nixtio section reads as the same family.

### Responsive Approach

Three breakpoints, mobile-last:
- **≤768px** — tighten type, collapse columns, tighten section gaps
- **≤1024px** — collapse default-columns to vertical, soften display type
- **≥1500px** — widen wrapper to 95rem, widen left subtitle column to 22.4375rem

No container queries. No fluid `clamp()` typography. Step-based responsive system.

### Transitions

```css
--transition-fast: .15s ease-in-out;
--transition-base: .3s ease-in-out;
--transition-slow: .5s ease-in-out;
```

Used on hovers, accordion expansion, button-fill effects. Simple ease-in-out, nothing fancy.

---

## Effects Breakdown

| Effect | Implementation | Complexity | Port to Tractova? |
|---|---|---|---|
| Black preloader sliding up off-screen on load | Fixed `.preloader-overlay` with `transition: transform 0.7s ease-in-out`; JS toggles `--overlayHidden` which sets `transform: translateY(-100%)` | Low | Skip (overkill for a SaaS landing) |
| Section entrance fade-up on scroll | AOS lib reading `data-aos="fade-up"` + `data-aos-delay="100"` → adds `aos-animate` class → CSS opacity/transform transition | Low | **YES** — implement as small IntersectionObserver hook, no need for full AOS lib |
| Animated stat counters ("0+" counting up to "600+") | `.animated-counter-module-scss-module__CcBUFq__suffix` wraps the suffix; JS animates the numeric portion when in viewport | Low | **YES** — small `useCountUp` hook |
| Reveal-lines-on-scroll (h2 lines fade in word-by-word) | `.reveal-lines-on-scroll-module-scss-module__aYYRvq__revealLinesOnScroll` — typical pattern: SplitText-style wrapping each line/word in spans, IntersectionObserver staggers opacity | Medium | **Optional** — could do without it; if we port it, a CSS-only word stagger via `:nth-child` works |
| Accordion services list (one open at a time, smooth expand) | `.accordion-item.isOpen` + sibling closed states; `transform: translateY(0)` on title; `transition: height` on `.answer` with measured height. Plus-icon swaps to minus-icon via separate `<svg>` for `aria-label="Close"` vs `"Open"` | Medium | **YES** — perfect for the 5-pillar story |
| FAQ accordion (multi-collapsible) | Same pattern as services accordion but multiple can be open. `aria-expanded="true"` toggles `height: 0` → measured-height | Medium | **YES** — add FAQ section (Tractova doesn't have one) |
| Button text-swap on hover ("Start a Project" slides up, duplicate slides up to replace) | `.button__wrapper` contains `.button__text` + `.button__text.button__duplicate`; `transform: translateY()` on hover. Two text elements stacked, both translate, one replaces the other | Low | **YES** — small, distinctive, doesn't break taste budget |
| MP4 video hero background with WebP poster fallback | `<video autoPlay loop muted playsInline preload="none">` over `next/image` poster, both `position: absolute; inset: 0` | Low to wire, High taste cost on a data-tool | **SKIP** — agreed in scoping. Replace with brand-navy gradient + a `<canvas>` particle field or a static screenshot of the dashboard |
| Burn-canvas on portfolio cards | `<canvas class="projects-module__burnCanvas">` — likely a noise/particle effect drawn imperatively on hover | High | **SKIP** — Tractova has no portfolio |
| Mute button on About video | Stateful `<button>` toggles `video.muted` | Low | **SKIP** (no video) |
| Header burger menu with overlay slide-in | `.menu-overlay` with translate transform; burger lines transform into ✕ | Low | **YES** — but Tractova already has nav |
| Mobile testimonial carousel with paged dots | Splide.js `<div class="splide">` with `splide__pagination__page` dots; `is-active` class scales the dot | Low | **YES** — but use a small custom snap-scroll, not the Splide lib |
| Page transition overlay | `.pageTransition-overlay` with `.idle` class — likely fades on route change | Medium | **SKIP** — over-engineered for our scale |
| Sticky black-section header (visual continuity) | Header is `position: fixed` with `mix-blend-mode` (likely `difference`) or class swap when scrolling over black sections | Medium | **Optional** — nice but skippable v1 |

---

## Section-by-Section Inventory (top to bottom)

1. **Preloader overlay** — black slide-up, ~700ms. SKIP.
2. **Header** — fixed top: logo (left), 4-link nav (center), "Start a Project" button + mobile burger (right). Single fixed bar across all sections.
3. **Hero (black-section)** — full-bleed MP4 video with WebP poster; centered logo SVG (white) + service tagline; right-aligned 3-stat block ("50+ employees, 6 countries, Founded in 2010"); bottom-right large description paragraph with "We create digital brands…" copy. Uses AOS fade-up with staggered delays (300, 400, 500ms).
4. **Clients strip (light)** — "Our clients" subtitle (left) + 12-logo grid (right). All logos are inline SVGs at 104×104, monochrome black.
5. **Featured projects (light)** — Two-column intro ("Unique solutions that generate leads" + "Featured Projects" h2) → 2×3 project grid with `canvas` overlay on each card → "See All Projects" CTA.
6. **Why-section** — Two-column intro ("Why choose us" + "We design for results…" h2) → embedded looping MP4 → 2-block stats grid ("600+ Successful projects" + "100% UpWork rating"). Stat counters animate 0→target.
7. **Services (black-section)** — Two-column intro + **services accordion** with 4 items (Web & App Design / Development / Branding / 3D). One open by default. Each item has: numeric prefix (001/002/003/004), title, expanded body, and a tag-cloud of sub-services. Plus/minus icon button to expand.
8. **About-section (light)** — Two-column intro ("We craft solutions designed for your niche") → 4-block "principles" grid (Always in Sync, Creating as One, Tailored for Success, Results You Can See) each with custom illustration → looping MP4 below.
9. **Testimonials** — Two-column intro → 3-card desktop layout (Clutch card + 2 testimonial cards) → Splide carousel on mobile. Stars rendered as SVGs with `fill` proportional.
10. **Statistics strip** — 4 large stat counters (Clients / Projects / Referrals / Awards) all animating 0→target. No bg, just numbers.
11. **Team-section** — "Our team, your vision" h2 + 4 team photo cards with hover overlay (name + role). Apply-now CTA card on the left.
12. **FAQ-section** — "FAQ" big-h2 + 6 collapsible questions. First open by default. Plus icon → minus icon on expand.
13. **Footer (black-section)** — "Let's talk" big-display h2 + description + 2-feature row (Quick response / Clear next steps) + contact form (Name, Email, Message, Altcha CAPTCHA, Send Message button) on the right. Then 9 social-link rows + © copyright + Privacy/Cookie links.

---

## Implementation Details — what we'll actually port

### 1. The default 2-column section pattern

Almost every Nixtio section uses this. Tractova should normalize to it for the redesign:

```jsx
<section>
  <div className="wrapper">
    <div className="default-section --spacing-md">
      <div className="default-columns">
        <div className="default-columns__subtitle">
          <h3 className="text--base">Eyebrow label</h3>
        </div>
        <div className="default-columns__content">
          <h2 className="h2">Section headline</h2>
        </div>
      </div>
      {/* … main section content … */}
    </div>
  </div>
</section>
```

**Why it works:** the small left-column eyebrow (~280px wide, fixed) + right-column content creates rhythm and reads as "premium" without any other treatment. It's the single most copyable move.

### 2. Heavy negative letter-spacing on display type

```css
.h1      { font-size: 9.25rem; letter-spacing: -0.4625rem; line-height: 110%; font-weight: 600; }
.h2      { font-size: 3.25rem; letter-spacing: -0.1625rem; line-height: 110%; font-weight: 600; }
.h2--big { font-size: 9rem;    letter-spacing: -0.45rem;   line-height: 9rem; font-weight: 600; }
.h3      { font-size: 1.875rem; letter-spacing: -0.075rem; line-height: 120%; font-weight: 500; }
.h4      { font-size: 1.375rem; letter-spacing: -0.055rem; line-height: 1.65rem; font-weight: 600; }
.h5      { font-size: 1.125rem; letter-spacing: -0.0562rem; line-height: 1.125rem; font-weight: 600; }
```

Geist handles these values well — same geometric grotesque structure as Inter, designed for tight tracking. We'll create matching `.h1` / `.h2` / `.h3` etc. utility classes in our index.css so every section gets the same treatment without inline styles.

### 3. AOS-style fade-up entrance

Their pattern: `data-aos="fade-up" data-aos-delay="100"`. The CSS that backs it (inferred from typical AOS): elements start at `opacity: 0; transform: translateY(40px)` and animate to `opacity: 1; transform: translateY(0)` over 600ms when they enter viewport. Delay staggers siblings.

**Tractova implementation** (no library — small custom hook):
```js
function useRevealOnScroll(ref) {
  useEffect(() => {
    if (!ref.current) return
    const io = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        entry.target.classList.add('is-revealed')
        io.unobserve(entry.target)
      }
    }, { rootMargin: '-10% 0px -10% 0px' })
    io.observe(ref.current)
    return () => io.disconnect()
  }, [ref])
}
```

Plus a tiny CSS rule:
```css
.reveal-on-scroll { opacity: 0; transform: translateY(40px); transition: opacity .8s ease-out, transform .8s ease-out; }
.reveal-on-scroll.is-revealed { opacity: 1; transform: translateY(0); }
.reveal-delay-100 { transition-delay: 100ms; }
.reveal-delay-200 { transition-delay: 200ms; }
.reveal-delay-300 { transition-delay: 300ms; }
@media (prefers-reduced-motion: reduce) {
  .reveal-on-scroll { opacity: 1; transform: none; transition: none; }
}
```

### 4. Accordion (5-pillar story)

Nixtio's pattern, simplified:

```jsx
const [openIdx, setOpenIdx] = useState(0)  // first item open by default

{pillars.map((p, i) => (
  <div key={p.id} className={`pillar-row ${openIdx === i ? 'is-open' : ''}`}>
    <div className="pillar-row__number">00{i+1}</div>
    <div className="pillar-row__content">
      <button onClick={() => setOpenIdx(openIdx === i ? -1 : i)}>
        <h4 className="h4">{p.title}</h4>
      </button>
      <div className="pillar-row__expanded">  {/* animates height */}
        <p>{p.description}</p>
        <div className="pillar-row__tags">
          {p.tags.map(t => <span key={t}>{t}</span>)}
        </div>
      </div>
      <PlusMinusIcon open={openIdx === i} />
    </div>
    <div className="pillar-row__divider" />
  </div>
))}
```

Height transition: track open/closed via class, use `grid-template-rows: 0fr` → `grid-template-rows: 1fr` trick (works without measuring height in JS).

```css
.pillar-row__expanded { display: grid; grid-template-rows: 0fr; transition: grid-template-rows .35s ease-in-out; }
.pillar-row__expanded > * { overflow: hidden; }
.pillar-row.is-open .pillar-row__expanded { grid-template-rows: 1fr; }
```

### 5. Button text-swap on hover

```jsx
<button className="btn-swap">
  <span className="btn-swap__wrap">
    <span className="btn-swap__text">Get started free</span>
    <span className="btn-swap__text btn-swap__dup" aria-hidden="true">Get started free</span>
  </span>
</button>
```
```css
.btn-swap__wrap { display: inline-flex; flex-direction: column; height: 1em; overflow: hidden; }
.btn-swap__text { transition: transform .3s ease-in-out; }
.btn-swap:hover .btn-swap__text { transform: translateY(-100%); }
```

The duplicate sits stacked below the original; on hover both slide up, original goes off-screen and duplicate takes its place. Distinctive but cheap.

### 6. Animated stat counter

```jsx
function useCountUp(target, durationMs = 1600) {
  const [value, setValue] = useState(0)
  const ref = useRef(null)
  useEffect(() => {
    if (!ref.current) return
    const io = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting) return
      const start = performance.now()
      const tick = (now) => {
        const t = Math.min(1, (now - start) / durationMs)
        setValue(Math.floor(target * (1 - Math.pow(1 - t, 3))))  // easeOutCubic
        if (t < 1) requestAnimationFrame(tick)
        else setValue(target)
      }
      requestAnimationFrame(tick)
      io.disconnect()
    })
    io.observe(ref.current)
    return () => io.disconnect()
  }, [target, durationMs])
  return [value, ref]
}
```

### 7. FAQ pattern

Same accordion mechanic but every item is independently collapsible (no "one open at a time" constraint). Plus icon → minus icon when open. First item open by default.

---

## Assets Needed to Recreate (Tractova-specific)

1. **Hero "ambient" element** — instead of MP4 video, options:
   - A subtle animated SVG noise/grid (we already have `.health-grid` and `.health-scan` patterns in `index.css` — reuse them at hero scale)
   - The existing simulated `<DashboardPreview>` card (already built, looks great, keeps the page product-honest)
   - A particle canvas (overkill, skip)
   **Recommended:** keep `<DashboardPreview>` on the right, add subtle grid drift behind on the left.
2. **Eyebrow chip dot** — 6px teal pulse dot (already in Landing.jsx hero).
3. **Open/close icons** for accordion + FAQ — inline SVGs, plus and minus, 16×16, already styled in our brand.
4. **Data source "logos"** — DSIRE, EIA, NREL, LBNL, FERC, USDA, USFWS, ISO/RTO — wordmark-only (SVG text in JetBrains Mono), not raster logos. No licensing concerns, matches the "intelligence platform" feel.
5. **Right-arrow + check icons** — already exist in Landing.jsx (IconCheck etc.).

No external assets needed. Everything's drawable with SVG or existing components.

---

## Build Plan

### Recommended stack changes
- **No new deps.** Everything builds on what's already in the repo (React, Tailwind 4, existing index.css, Geist + JetBrains Mono already loaded).
- **No AOS, no Splide, no Lenis, no GSAP.** Replace with three small hooks (`useRevealOnScroll`, `useCountUp`) and CSS grid-row height tricks for the accordion.

### Section-by-section build order (Tractova landing)

| # | Section | Replaces / Maps to | New? |
|---|---|---|---|
| 1 | Header / nav | (already exists — keep) | — |
| 2 | **Hero (dark)** — eyebrow chip + h1 "The intelligence edge most small developers don't have." + sub + CTAs + `<DashboardPreview>` on right | Current hero in `Landing.jsx:182–250` | Restyled with new type scale + reveal-on-scroll |
| 3 | Data sources strip (light) | Maps to Nixtio's "Our clients" strip | Restyled |
| 4 | **Platform stats counter (light)** — 4 animated counters: states sourced (12 NB + 1 NM = 13 sourced today), data sources (~10), pillars (5), update cadence (weekly) | Current "Metrics strip" at `Landing.jsx:253–278` | Now with count-up animation |
| 5 | **5-pillar accordion (dark)** — Offtake / IX / Incentives / Site / Policy — replaces stale 3-pillar section | Current "Three pillars" cards at `Landing.jsx:388–470` | Major restructure: 3 cards → 5-row accordion |
| 6 | Time-saved comparison (light) | Current "2 min vs 4 hr" at `Landing.jsx:317–386` | Light restyle, keep content |
| 7 | Who it's for (light, 2-col) | Current "Built for who" at `Landing.jsx:472–545` | **Remove the Nexamp/Ameresco mention on line 487** — rewrite as "Large IPPs have entire teams pulling …; you don't. Tractova is the team you can't afford to hire." |
| 8 | How it works (light, 3 steps) | Current step section at `Landing.jsx:547–630` | Light restyle |
| 9 | **FAQ (light)** — 6 questions with single-open accordion | NEW — Nixtio has one, Tractova doesn't | New |
| 10 | The Adder callout (light, compact) | Current at `Landing.jsx:632–657` | Keep as-is |
| 11 | **Footer CTA (dark)** — big "Let's talk" h2 + 2-feature row (Quick response / Clear next steps) + email-capture form | Current "Final CTA" at `Landing.jsx:659–687` | Major expansion to footer-style with form + features |

### Notes
- **NOT in scope:** About page (1252 lines), Privacy/Terms.
- **Remove Nexamp/Ameresco:** `Landing.jsx:487`. The Privacy.jsx mentions (lines 166, 196) are properly cited public-sourcing references per the memory `feedback_no_employer_naming.md` (which is specifically about onboarding/marketing surfaces) — leave those. But the landing-page name-drop is exactly the kind of employer-adjacent naming the feedback memory says to avoid.
- **5-pillar pivot:** the current landing still says "Three pillars" — that's stale per BUILD_LOG (the 2026-05-25 pivot is complete). The redesign updates this in the same pass.
- **Performance budget:** no new deps, no video, ~3KB of new CSS, ~1.5KB of new JS for the two hooks. Should be smaller than current landing, not larger.
- **Reduced-motion:** every reveal + counter respects `prefers-reduced-motion: reduce`.
