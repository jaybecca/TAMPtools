# TAMPtools Phase 24 — Dashboard, Sidebar, Workspace & Localization

## Scope
- Corrected WhatsApp support number to `2349152345734` and kept environment support number-only.
- Reworked the authenticated sidebar into expandable tool groups with direct function links.
- Rebuilt the dashboard first view around colorful work-stat cards before tool navigation.
- Added dashboard account/usage/storage summary API support.
- Reworked generic tool workspaces so previously dead tool launches now expose usable controls, previews, exports, uploads, ZIP packaging, batch processing and Assistant planning where supported.
- Moved Batch Studio into the same authenticated application shell so it cannot appear as a stray block after a public footer.
- Added standalone pricing credit top-up explanation and visible pack-rate explanation.
- Preserved the Phase 23 pricing meter and plan comparison.
- Kept authentication pages free of language/currency selectors and retained Google-first authentication flow.
- Added a 22-language UI phrase pack and wired language changes to dynamically rendered interface content.
- Updated public tool excerpts with compact feature lists and corrected dead tool links.
- Retained the current purple/gold favicon/logo asset.

## Validation targets
- Node syntax checks for modified backend/frontend JavaScript.
- JSON validation for localization pack.
- HTML presence/link checks for dashboard, workspace, pricing, auth and Batch Studio.
- ZIP integrity after packaging.
