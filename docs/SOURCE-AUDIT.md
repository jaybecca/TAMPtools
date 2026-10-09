# TAMPtools Phase 1B — Actual Source Audit

## Source inspected

`tamptools.zip` was unpacked and inspected as the source of truth for Phase 1B.

## What already exists

### Frontend
- HTML5/CSS3/static JavaScript application
- Public landing page
- Sign in / sign up / password-change flows
- Authenticated dashboard
- Settings, support and legal/data pages
- Admin page and admin JavaScript
- Campaign Studio
- Existing TAMPtools logo assets
- Consolidated frontend bundle in `frontend/app.js`
- Shared stylesheet in `frontend/styles.css`

### Backend
- Node.js 22+ / Express 5 ES modules
- SQLite local database
- PostgreSQL production schema target
- Session-cookie authentication
- Zod validation
- Helmet, CORS and rate limiting
- File storage metadata and processing helpers
- Job and system-event tables
- Entitlements / plans
- AI provider abstraction
- Email adapter
- Payment adapters for Paddle and Flutterwave
- OAuth/integration foundations
- Reporting and admin foundations
- PDF/image/document processing foundations
- Existing automated smoke/API checks

## Important integration conclusion

The actual source is substantially further along than the Phase 1A scaffold. Phase 1A should therefore **not** replace the source or be copied over it wholesale.

Phase 1B integrates the useful Phase 1A architectural ideas into the existing application by documenting and formalizing shared boundaries while preserving working source code.

## Existing-source items intentionally deferred

The source still contains legacy product areas that do not match the final agreed TAMPtools scope, especially social publishing/campaign functionality and older pricing/tool terminology. These are **not deleted in Phase 1B** because doing so would be a feature migration rather than foundation work.

They are documented as legacy/deferred areas and will be reconciled during the relevant product phases.
