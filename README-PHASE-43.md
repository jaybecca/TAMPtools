# TAMPtools Phase 43 — Functional Recovery

Fixes included:
- Root `npm install` now uses npm workspaces so backend dependencies install with the project.
- Google Sign-In is detected at runtime; when credentials are absent, the dead Google button is hidden and email sign-in remains available.
- Translation lookup is case-insensitive across the first-party catalog, fixing common phrase-key mismatches.
- Home translation lookup now uses the same robust matching.
- Workspace tools no longer show a dead “Tool integration is unavailable” screen; unsupported workspace actions use the TAMPtools assistant/local fallback workflow.
- Health reports Phase 43.
- Logo loading is kept visible if the logo asset encounters a browser load error.
