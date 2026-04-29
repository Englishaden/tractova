Dashboard

- Focus scope: prioritize Community Solar + Hybrid (Solar + Storage). Exclude standalone BESS and C&I unless strong justification. Hybrid remains critical for post-ITC economics and stackable incentives (e.g., IL BESS + inverter rebates).
- Refine color scheme: improve contrast so high-value markets (e.g., CA) stand out without over-saturation.
- Standardize map legend: ensure all colors map to a defined feasibility index or remove partial labeling.
- Policy/market feed: shift toward AI-powered summaries as primary layer; maintain manual source validation workflow before publishing.
- Define “policy alert” criteria (e.g., thresholds, keywords, impact level) to justify yellow highlighting.
- Build centralized Community Solar database: include program definitions, eligibility, LMI %, capacity blocks, REC structure, etc. Enable drill-down via state click or CS coverage module into a structured detail view/widget.
- Automate “data last verified” timestamp based on latest database refresh (Supabase sync).
- UX: Esc key should close/open dashboard modules (CS coverage, IX headroom, etc.).

Tractova Lens

- Automate “last updated” date from database refresh.
- Scope alignment: prioritize Community Solar + Hybrid; reassess inclusion of C&I. Clarify “technology” vs revenue structure (CS ≠ technology).
- Remove or redesign low-value market intelligence tags (e.g., “No CS program,” “Index 56 – viable”) unless they provide actionable insight.
- Convert Immediate Action, Stage Guidance, Competitive Context into interactive/dynamic modules with expandable structured views.
- Rebuild sensitivity analysis:
	- Open as dynamic widget/modal (not scroll-dependent).
	- Include quantitative score impact + detailed AI rationale.
	- Add scenario toggles (e.g., IX tightening, LMI increase).
	- Integrate custom scenario builder within same interface.
- Maintain consistent layout across all states (even low-data markets like KS); include placeholders with clear messaging (e.g., IX/site control limited, revenue non-viable).

Glossary

- Expand to include platform-specific terms (e.g., Lens Analysis, Add to Compare, Market Intelligence), not just industry definitions.

My Projects (Library)

- Consider renaming “My Projects” → “Library.”
- Add color legend to pipeline distribution.
- Improve pipeline distribution UI: stronger visual hierarchy, better borders, and clickable/interactable elements.
- Redesign tab as a “war room”: enhance layout, section separation, and introduce subtle animation or darker accents for depth.
- Remove or make “X alerts across your portfolio” interactive.
- Portfolio Intelligence:
	- Remove duplication (Portfolio Health vs Avg Score, Total Capacity).
	- Fix/remove low-value visuals (Risk Spread).
	- Keep MW by Technology with consistent color mapping.
	- Upgrade Geographic Spread to interactive map/globe with clickable assets.
	- Enhance AI Portfolio Insight: increase token usage for deeper, actionable analysis (budget permitting).
- “Your Deal” section: currently empty → either remove, condense, or replace with meaningful structured content.
- Export Summary PDF:
	- Add AI-driven project insight (site control, IX, substation, revenue).
	- Upgrade formatting to match Tractova branding; more professional one-pager.
- Data refresh button: keep hover interaction, but integrate more cleanly into layout (avoid isolated placement).
- Alerts color: increase visibility/contrast.
- Dev cycle dropdown: fix truncation issue when project is collapsed; ensure full visibility.
- Export CSV: expand beyond basic fields; include actionable developer data (IX status, interconnection queue, revenue assumptions, risk flags, timeline, etc.). Provide clear rationale for download value.

Profile

- Fix toggle UI (white dot overflow issue).
- Expand “urgent reports” to include major positive events (e.g., large capacity additions, new/passed CS programs).
- Improve layout balance: center profile content and utilize side space (e.g., subtle map, animation, or contextual visuals).

Other

- Evaluate standalone chatbot tab: define clear value-add vs embedded AI insights; assess feasibility.
- Consider “About” section: explain platform purpose, target users, methodology, and background for transparency.