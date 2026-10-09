# TAMPtools backend — Phase 4.3

Node.js + Express ES-module backend for TAMPtools.

## Billing
TAMPtools uses **Paddle and Flutterwave only**. Checkout routing is automatic; customers never select a gateway. The server uses country, currency and language to choose a route, preferring Flutterwave for supported regional African markets/currencies and Paddle as the global route/fallback.

Configure signed webhook secrets and provider-specific monthly/yearly price or payment-plan IDs before enabling real charges.

## Core services
- Authentication and sessions
- Central plan entitlements
- AI provider abstraction
- Social publishing and OAuth foundations
- Cold-email campaigns and email provider adapter
- Reporting/analytics
- File lifecycle/storage metadata
- IP geolocation, currency mapping and i18n
- Optional integration adapter layer

## Payment routes
- `GET /api/payments/providers`
- `GET /api/payments/route`
- `POST /api/payments/create-checkout`
- `GET /api/payments/config`
- `POST /api/payments/portal`
- `POST /api/payments/webhook/flutterwave`
- `POST /api/payments/webhook/paddle`

## Production principle
TAMPtools owns the customer-facing product and AI experience. Third-party services are infrastructure or optional integrations; core tools must remain usable without connecting an external app.

## Database runtime

Phase 17A adds PostgreSQL/Neon as the production runtime. Use `DB_PROVIDER=postgres` with `DATABASE_URL` in staging/production. SQLite remains the default local-development database.
