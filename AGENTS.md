# Visualization collaboration

Read `PROJECT_CONTEXT.md` before planning work. It records the product intent,
decisions, issue map and evidence limits. GitHub issues own current work status;
update the corresponding issue when scope, blockers or verified progress change.
Classify user feedback yourself as ui/data/integration after tracing the cause.
Do not ask the user to perform technical triage. Claim work on the issue before
editing and link the PR. Mock UI completion does not close local integration work.

This repository is the canonical product source for PersonalOS's shared visual
and interaction entry, information architecture, minimal module/provider
bindings, provider selection, capability/degraded-state presentation, and
synthetic/reference implementations. A module binding declares identity,
surfaces/capabilities, its explicitly selected provider, ready/partial/unavailable
state, and optional freshness/provenance/source detail. Domain payloads and read
models remain Domain-specific; the contract does not prescribe Domain reasoning.
There is no universal cross-Domain state store, knowledge graph, ranking, or
invocation framework. This repository contains no private backend, credentials,
private context, real records or producer schema. Do not add live data fallbacks,
analytics or external data connections.

Investment is the first reference module, not the center of PersonalOS. Its UI
projects Investment Note-owned outputs through its typed provider and capability
manifest. Judgment is an Investment Note read model. Do not reproduce Investment
reasoning, classify trade/watch/ignore, infer relationships from ticker/title/
prose, or regenerate producer-owned #61 current_reading/gaps. Preserve source
states, cutoffs and provenance. The synthetic/reference provider runs in browser
memory, uses only fictional fixtures, makes no network requests, and has no
private fallback. Optional capabilities report unavailable/partial truthfully;
do not infer support from data shape. Other Domains keep their own payload models
and can use the same small binding without inheriting Investment semantics.

Private PersonalOS may implement the same contract with its own runtime,
credentials and private context. Those implementation details and records stay
outside this repository. Replacing the provider must not require forking the UI.
Keep the default Today page and distinguish missing/stale data from no events.
Investment history quotes existing records; never invent a person's conclusions. The
public history screen uses only synthetic/reference data and keeps provenance and
detail lookup within the module contract.
Preserve shared design tokens unless reviewed UI work calls for a design change.
Treat `src/tokens.css` and `src/demo/generated/*` as generated/export-only
outputs, not shared authoring inputs. Follow their existing reviewed
authoring/export direction and receipt gates; do not change it as part of
provider work.

`src/lib/transport.ts`, `vite.config.ts`, `index.html`, and `package.json` are
generated showcase-isolation files. Keep them network-free and do not replace
them with private adapters. Shared module contracts, provider selection and
provider wiring are reviewed in this repository. New shared files and
dependencies go through the normal pull-request review; private adoption has a
separate integration check. Do not rewrite receipt hashes to hide conflicts.

Run `npm test`, `npm run lint`, and `npm run build` before proposing a change.
Use a branch and pull request for shared product changes. The private maintainer
may adopt reviewed changes through a three-way comparison; conflicts are
resolved explicitly and do not change which repository owns the product source.
