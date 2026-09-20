# Personal OS synthetic showcase

This is a standalone frontend demonstration, not the complete Personal OS engine.
All records are hand-authored fiction. No personal vault, Python backend, account,
health database, session log, credential, or original Git history is included.

Install with `npm ci`, run `npm test`, and build with `npm run build`.
Serve `dist/` with any static host. The data adapter is always synthetic, even
when the default build command is used. Unsupported routes fail closed.

Changes made in the UI live only in this tab's memory and reset on reload.
The data models and visual components are shared with the local application;
the private data adapters are deliberately outside this exported project.

`export-receipt.json` records the exact reviewed inputs and exported file hashes.
The source file allowlist is explicit. Pattern scanning supplements human review
and is not a guarantee that arbitrary future text contains no private information.
