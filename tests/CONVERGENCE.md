# Shared UI convergence

The shared repository owns presentation, interactions, information architecture,
module selection and typed contracts. A private consumer replaces the provider
implementation at the existing main-entry import seam; it does not maintain a
second UI. Generated tokens and scenario definitions retain their existing
private-authoring/export direction.

## Resolution of the historical divergence

| Files | Resolution |
| --- | --- |
| InvestmentPage, Narrative, Thesis, Pending, History, Work | Adopt the previously owner-approved compact judgment, AI layer readings, date disclosures, merged pending work and source details. Keep failed/unavailable reads explicit. |
| MarketPulse, Indicators, Explore, StockMomentum, TaiwanRs | Bring the established session-aware market view and roster/relative-strength presentation into the shared module. Retain cached results, unknown direction and producer-specific dates. Preserve keyboard market navigation. |
| DayTimeline, EventNews, investmentToday, investmentDates, investmentFormat | Admit the existing projection helpers. Keep producer story/event identities and legacy read helpers; do not infer source relationships from ticker, title, prose or dates. |
| TimePage, WeeklyTrend, CcstoryMcpPanel, ccstoryPricing, api, card | Adopt the existing aggregate-only usage presentation and shared layout primitives. Missing rates and provider tiers remain unknown. |
| main, moduleProvider, reference provider, fictional fixtures and demo transport | Keep the explicit shared provider binding and isolated synthetic runtime. Extend the fictional reference to the adopted contracts. Private route factories and credentials remain outside this repository. |
| tokens, generated scenario, package, config, index, README, AGENTS | Keep the existing generated direction and configuration boundaries. Advance the receipt using the ordinary exporter after exact source adoption. |

## Regression evidence

Both previous unit-test oracles are retained: the existing shared suite plus the
extended fictional UI baseline. Extended fixtures live under tests/fixtures and
are separate from the reference scenario, so a fixture disagreement does not
rewrite an assertion. Cached work test inputs now explicitly identify a prior
successful read with dataUpdatedAt. Two literal-copy assertions now require the
uncertainty-preserving next-step wording: the browser oracle exposed that an
empty, partial action list was incorrectly described as no immediate action.
The underlying grouping and source-independence assertions remain unchanged.

The browser test retains the previous degraded-state inputs: unlinked long
content, blank/missing brief, partial actions, research-only work, first-read and
refresh errors, unavailable quotes, stale/delayed narratives, empty/unavailable/
cached/failed/delayed market exploration, mixed dates, missing breadth ratios,
known/stale/missing/malformed sessions, reminder failures/eligibility, and Taiwan
RS failure/unavailability. It adds structured judgment and producer AI reading
cases. Assertions follow the accepted compact layout rather than removed labels:
source clocks and state explanations stay in disclosures; unknown next steps
never imply no action; Research begins with future events and explicit directions,
then pending work. Desktop, 390px and 320px checks include expanded source detail,
keyboard navigation, runtime errors and network isolation.

This evidence proves code and synthetic presentation. Private adoption must
separately verify canonical main, exact source/receipt parity, process and bundle
identity, and the normal private browser. It does not establish data freshness,
external provider execution or owner acceptance.

## Concurrent main integration

PR #63 landed during convergence preparation. Its producer-owned layer readings,
gaps, synthetic fixture, and regression test are retained. Both helper call forms
remain accepted; existing private missing-date copy `日期未提供` is kept. Reading
state, author, limitations, source and gap sources remain inspectable in layer
details. Unknown expected dates are displayed as missing.

## Independent review repairs

The cold Codex review reproduced five gaps beyond the existing oracles: cached
brief actions after a read failure, optional legacy evidence arrays, cached quote
and pulse failure warnings, entirely omitted market results, and lost conflict/
unlinked provenance details. These are fixed without changing producer judgments
or inferring relationships. New contract tests and browser success-then-failure,
omitted-market, legacy-payload and expanded-provenance assertions cover them.

The targeted review retained two further edge cases: legacy unknown strings and
global-only unlinked rows whose pillar has a card. Unknown strings now remain
quoted and counted as unknown. Global source indexes remain fully inspectable;
a matching pillar alone no longer suppresses a row. Duplicate source indexes
are explicitly identified rather than silently collapsed.
