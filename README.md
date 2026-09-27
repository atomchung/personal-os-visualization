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
This repository is the canonical source for shared UI, module contracts and
provider wiring. The Investment module includes a typed provider interface, a
capability manifest and a synthetic/reference provider for Today,
Judgment/Narrative, Research and Review/History. Detail lookup and source
provenance pass through that contract.

The synthetic provider supports optional capabilities only when declared; missing
capabilities are reported as unavailable/partial. It stays browser-memory-only,
makes no network requests and has no private fallback. The private PersonalOS
implementation, runtime, credentials, context and real records remain outside
this repository. A compatible Investment provider can be replaced without
forking the Investment UI.

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
