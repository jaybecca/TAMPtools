# TAMPtools product and engineering audit — 7 November 2026

Repository audited: `jaybecca/TAMPtools` (default branch `main`, Phase 74 baseline).

## Existing foundations verified
- Node.js 22+ / Express 5 ES-module backend and modular HTML/CSS/JavaScript frontend.
- 15 primary catalogue entries; README describes 21 business tools, so customer-facing tool counts and taxonomy need reconciliation.
- Account sessions, admin roles, monthly usage entitlements, Free/Lite/Pro/Business plans, subscriptions and Paddle/Flutterwave payment adapters.
- AI provider abstraction, encrypted integration secrets, file metadata/storage helpers, PostgreSQL schema and local SQLite development database.
- PDF, image, spreadsheet, invoice, proposal, resume and mail workflow implementations.
- Existing backend tests and product validation scripts.
- Previous DevSecOps workflow ran dependency audit, one syntax check and Gitleaks, but omitted product validation and the test suite.

## Findings and follow-up priorities
1. **Studio experience is inconsistent.** The registry still marks Image Studio, QR Code Generator, Cover Letter Builder, ZIP & File Toolkit, Career/Profile Writer, Content Studio and TAMP Assistant as legacy workspace routes. Dedicated studio pages exist for only a subset. Continue migrating these into task-specific, responsive studios with validation, previews, progress, recovery and export states; do not mark a tool migrated until its complete workflow is implemented and tested.
2. **Tool taxonomy needs one source of truth.** Homepage, registry, backend catalogue and README should be generated from a canonical catalogue. The source currently has 15 primary catalogue entries despite README's 21-tool statement.
3. **Owner entitlements.** Admin role membership now grants unlimited monthly usage and all feature entitlements while retaining authenticated user flows and usage-event logging. The configured `ADMIN_EMAIL` is promoted to owner when its account session is resolved.
4. **Advertising workflow.** Added admin upload/publish/pause/delete, 1200×300 banner normalization, footer placement and per-ad Business-plan preferences. Production still needs persistent media storage and an operational backup/retention policy for advert files.
5. **Production database.** SQLite schema is applied locally; PostgreSQL schema is canonical for production. Apply and verify the updated PostgreSQL schema against production before relying on the new ad tables.
6. **External services remain configuration-dependent.** Launch still requires verified Paddle/Flutterwave credentials and webhooks, PostgreSQL, object storage, backups, monitoring, AI keys, OAuth approvals, email authentication and legal/business identity details.
7. **Security automation.** CI now runs product validation and the backend test suite in addition to npm audit, syntax validation and Gitleaks. Next add live API smoke tests, PostgreSQL integration tests, browser end-to-end tests and deployment health checks.
8. **Media reliability.** The workplace carousel currently uses externally hosted illustrative photos. For long-term reliability, move approved/licensed assets into first-party optimized storage and document image attribution/licensing.

## Implemented in this change
- Shared progressive Studio confidence layer on tool pages with Prepare → Process → Review cues.
- Four-image workplace carousel immediately after the homepage tools section.
- Owner entitlement override for accounts assigned the admin role.
- Admin advert manager with dimensions, image optimization and publish/pause/delete.
- Footer advert rendering across HTML pages and Business-plan per-ad show/hide switches directly on the advert.
- CI runs product validation and backend tests.

## Release gates
- Confirm `ADMIN_EMAIL` points to the intended owner login in the deployed environment.
- Apply the updated PostgreSQL schema to production.
- Verify advert uploads persist in production; local container filesystems may be ephemeral.
- Verify Business-plan advert preferences and media delivery in a production-like environment.
- Complete dedicated studio migrations for every legacy registry entry.
