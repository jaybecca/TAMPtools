# TAMPtools Phase 4.4

TAMPtools is a Node.js + Express ES-module SaaS workspace with 21 business tools, AI workflows, authentication, subscriptions, reporting, social publishing, email automation, i18n and local-currency pricing.

## Tech stack
- Frontend: HTML5, CSS3, modular JavaScript
- Backend: Node.js + Express (ES modules)
- Database: SQLite foundation, PostgreSQL-ready architecture
- Validation/security: Zod, Helmet, CORS, rate limiting, secure sessions
- AI: TAMPtools-owned provider abstraction for text and image workflows
- PDF processing: Ghostscript-backed PDF compressor foundation
- Email: provider adapter with idempotent sending
- Social: OAuth/publishing adapter foundation

## Billing
- **Paddle + Flutterwave only.**
- Customers never choose a gateway manually.
- Route detection uses country, currency and language, with country/currency as primary signals and language as a secondary regional signal.
- Flutterwave is preferred for supported regional African markets/currencies when configured. Paddle is the global default/fallback.
- Monthly and yearly subscriptions are supported.
- Optional credit packs can be configured for variable-cost AI usage.
- Pricing remains editable by currency/market without changing the checkout architecture.

## Product ownership and integrations
TAMPtools is the product. TAMPtools owns the customer-facing tools and AI abstraction. Optional integrations such as Google Workspace, Microsoft 365, Dropbox, Slack, WhatsApp Business and CRM connectors extend the workspace but do not replace its core functionality.

## Checkout routes
- `GET /api/payments/providers`
- `GET /api/payments/route`
- `POST /api/payments/create-checkout`
- `GET /api/payments/config`
- `POST /api/payments/portal`
- `POST /api/payments/webhook/flutterwave`
- `POST /api/payments/webhook/paddle`

## Production
Configure the provider credentials, signed webhook secrets and price/payment-plan IDs in `backend/.env`. Do not commit real secrets.


## Phase 4.5 production database recommendation
TAMPtools uses SQLite for local development. The recommended production database is **Amazon RDS for PostgreSQL**. See `backend/src/db/postgres-schema.sql` and `backend/src/db/README.md`. DynamoDB is intentionally not the primary database because TAMPtools has relational transactions across users, subscriptions, payments, usage, promotions, campaigns, jobs, audit logs and integrations.

## Production readiness
Before launch, configure PostgreSQL, object storage, backups, monitoring/error tracking, verified Paddle/Flutterwave webhooks, AI provider credentials, social platform approvals, email authentication and legal/business identity details.
