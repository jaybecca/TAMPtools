# TAMPtools Phase 23 — Pricing, Auth & Public UX Refinement

## Scope
- Added a standalone `/pricing.html` page.
- Added live plan meter: Free → Lite → Pro → Business with price updates as the meter moves.
- Added monthly/yearly pricing switch using the configured plan prices.
- Added expanded plan benefits for Free, Lite, Pro and Business.
- Added TAMP AI Credits explanation and top-up pricing: ₦500, ₦1,000, ₦2,500, ₦5,000 and ₦10,000.
- Reworked sign-in and account-creation pages with Google at the top, email fallback below, and cleaner auth actions.
- Prevented language/currency selectors from appearing on auth pages.
- Kept public pages to the shared language/currency controls supplied by the main navigation.
- Expanded homepage tool excerpts with three concise feature bullets per primary tool.
- Replaced homepage pricing block with a compact link to the standalone pricing page.
- Cleaned homepage wording/navigation to match the current TAMPtools product boundary.
- Preserved the current favicon/logo assets.
- Added the missing `safeFileRow()` export required by the Phase 22 backend.

## Validation
- `node backend/src/check.js`: PASS — 0 failures, 3 warnings; live checks skipped because no local server was running during package validation.
- JavaScript syntax checks: PASS.
- HTML local-reference checks: PASS; OAuth endpoint warnings are expected dynamic server routes.
