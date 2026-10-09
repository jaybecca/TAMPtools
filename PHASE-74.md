# Phase 74 — Application Registry & Navigation Integrity

## Scope

- Treat `frontend/apps/tool-registry.js` as the destination source for registered tools.
- Route Invoice Generator to its existing dedicated application page and mark it active.
- Make sidebar links and their sub-actions use the registered entry for active or migrated tools, while preserving legacy workspace routes for tools still marked `legacy`.
- Make the bundled command palette and the standalone Phase 3 UI opener prefer registry destinations.
- Add `npm run check:navigation` to verify registered destinations, dedicated entry-page existence, and registry-aware navigation hooks.

## Verification

Run from the repository root:

```bash
npm run check:navigation
node --check frontend/app.js
node --check frontend/phase3-ui.js
npm run check:api
```

The navigation check is a static integrity check. It does not replace browser-based end-to-end testing of every click path.
