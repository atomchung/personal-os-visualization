# Personal OS synthetic showcase

This is a standalone frontend demonstration, not the complete Personal OS engine.
All records are fictional synthetic output, not anonymized private records. No
personal data store, private backend, account, health database, session log,
credential, or original Git history is included.

Start with [project context and issue map](PROJECT_CONTEXT.md) for the user goals,
completed baseline, remaining work and local/cloud handoff. GitHub issues are the
current progress record; this README is not a claim that every feature is done.

Install with `npm ci`, run `npm test`, and build with `npm run build`.
Serve `dist/` with any static host. The data adapter is always synthetic, even
when the default build command is used. Unsupported routes fail closed.

Changes made in the UI live only in this tab's memory and reset on reload.
This repository is the canonical source for PersonalOS's shared visual and
interaction entry, information architecture, minimal module/provider bindings,
capability/degraded-state presentation, and synthetic/reference implementations.
A binding selects a provider for a module and declares its surfaces, capabilities,
state and optional freshness/provenance/source detail. Domain payloads and read
models remain Domain-specific; the shared contract does not prescribe how a
Domain reasons.

The synthetic provider supports optional capabilities only when declared; missing
capabilities are reported as unavailable/partial. It stays browser-memory-only,
makes no network requests and has no private fallback. Investment Note remains
the complete and sole Investment system; Investment is the first reference
module, not PersonalOS's architecture center. Its surfaces project already
produced Investment Note outputs without recreating Investment reasoning.
Cross-Domain ranking and reasoning are deferred until multiple mature Domains
create a concrete need. The private PersonalOS implementation, runtime,
credentials, context and real records remain outside this repository.

`src/tokens.css` and `src/demo/generated/*` remain generated/export-only
outputs, not shared authoring inputs. Follow their existing reviewed
authoring/export direction and receipt gates; a direction change is tracked
separately under #39.

## Local and cloud collaboration

The shared UI consumes the module/provider contract and does not know a
provider's backend. The bundled reference provider is synthetic and uses only
browser memory. `connect-src 'none'` also blocks browser data connections in
the built showcase.

Cloud agents can clone this repository, run `npm ci` and `npm run dev`, and
propose UI changes with fictional fixtures. The source remains the deliverable;
a GitHub push does not automatically update the separately hosted website.

Shared changes are proposed through reviewed branches and pull requests. The
private maintainer uses a three-way sync before adopting a change locally;
conflicts are reviewed explicitly and never silently overwritten. Shared PR/CI,
private provider/runtime readback, served bundle identity, browser acceptance and
website deployment are separate evidence.

`export-receipt.json` records the exact reviewed inputs and exported file hashes.
The source file allowlist is explicit. Pattern scanning supplements human review
and is not a guarantee that arbitrary future text contains no private information.
