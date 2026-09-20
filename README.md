# Personal OS synthetic showcase

This is a standalone frontend demonstration, not the complete Personal OS engine.
All records are fictional synthetic output; the investment case is regenerated
from a reviewed scenario brief in the private application. No personal vault, Python backend, account,
health database, session log, credential, or original Git history is included.

Start with [project context and issue map](PROJECT_CONTEXT.md) for the user goals,
completed baseline, remaining work and local/cloud handoff. GitHub issues are the
current progress record; this README is not a claim that every feature is done.

Install with `npm ci`, run `npm test`, and build with `npm run build`.
Serve `dist/` with any static host. The data adapter is always synthetic, even
when the default build command is used. Unsupported routes fail closed.

Changes made in the UI live only in this tab's memory and reset on reload.
The data models and visual components are shared with the local application and
canonical in this repository; the private data adapters, task Context service,
source-detail reader, and scenario briefs are deliberately outside this exported
project. The synthetic `/api/investment/history` and `/api/investment/context`
routes are memory-only demo adapters, not private data endpoints.

## Local and cloud collaboration

The local application and this repository use the same components and data
contracts. Locally, the transport calls a private FastAPI backend. Here, it is
replaced with a synthetic adapter at export time. `connect-src 'none'` also
blocks browser data connections in the built showcase.

Cloud agents can clone this repository, run `npm ci` and `npm run dev`, and
propose UI changes with fictional fixtures. The source remains the deliverable;
a GitHub push does not automatically update the separately hosted website.

For local-to-cloud changes, the local maintainer checks synchronization state,
exports the reviewed allowlist, runs checks, then commits and pushes this repo.
For cloud-to-local changes, pull the reviewed branch here and run the local
`scripts/sync_visualization.py` check/import workflow. Conflicts are blocked,
not silently overwritten. See the local `docs/visualization-sync.md` guide.
Cloud access to a private repository must be enabled in that client's GitHub
integration; creating this repository alone does not grant the integration access.

`export-receipt.json` records the exact reviewed inputs and exported file hashes.
The source file allowlist is explicit. Pattern scanning supplements human review
and is not a guarantee that arbitrary future text contains no private information.
