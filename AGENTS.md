# Visualization collaboration

Read `PROJECT_CONTEXT.md` before planning work. It records the product intent,
decisions, issue map and evidence limits. GitHub issues own current work status;
update the corresponding issue when scope, blockers or verified progress change.
Classify user feedback yourself as ui/data/integration after tracing the cause.
Do not ask the user to perform technical triage. Claim work on the issue before
editing and link the PR. Mock UI completion does not close local integration work.

This repository contains shared UI code and fictional fixtures. It has no access
to the local application's personal data or backend. Do not add credentials,
real records, live API fallbacks, analytics, or external data connections.

`personal-os-visualization` is the canonical source for components, design tokens,
and contracts. Edit shared UI there; this exported repository receives reviewed
changes through the local three-way sync. Synthetic scenario output under
`src/demo/generated/` comes from the private generator; do not hand-copy private
records into it. Preserve the existing design tokens.
Keep the default Today page and distinguish missing/stale data from no events.
Investment history quotes existing records; never invent a person's conclusions. The
public history/context screen uses only the reviewed synthetic scenario; the private
Context service and source-detail reader are never exported.

`src/lib/transport.ts`, `vite.config.ts`, `index.html`, `package.json`, README,
and the export receipt are generated isolation boundaries. Do not replace them
with live adapters. New files and dependencies require admission review in the
local application before they can be synchronized. Do not rewrite receipt hashes.

Run `npm test`, `npm run lint`, and `npm run build` before proposing a change.
Use a branch and pull request for cloud changes. The local maintainer imports
reviewed shared-file changes using a three-way comparison against the last
export receipt; conflicting local edits must be resolved explicitly.
