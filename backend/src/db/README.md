# TAMPtools database architecture

## Decision

**Production database: PostgreSQL on Neon.**

**Local development: SQLite.**

Neon is the preferred production target for the current TAMPtools stage because it is PostgreSQL-compatible, has a free tier for development, scales to zero when idle, and uses usage-based billing rather than forcing a fixed monthly database bill. Supabase remains a strong alternative if bundled auth/storage features become a priority.

## Phase 17A runtime

Phase 17A makes PostgreSQL a real runtime option instead of leaving it as schema-only preparation.

- `DB_PROVIDER=sqlite` keeps local development lightweight.
- `DB_PROVIDER=postgres` loads the PostgreSQL adapter.
- `DATABASE_URL` is required for PostgreSQL.
- The adapter uses `pg` with a connection pool, SSL support, connection timeout and statement timeout.
- The canonical PostgreSQL schema is applied on startup.
- Production plan records are seeded/upserted on startup.
- Existing application database calls retain their shared `db.prepare(...).get/all/run` boundary while becoming awaitable; SQLite remains compatible because `await` also accepts its synchronous return values.
- PostgreSQL result dates are normalized to the string format expected by the current application.
- SQLite-specific SQL patterns used by the existing application are normalized at the adapter boundary where practical.

This lets us move the production database to Neon without rewriting the customer-facing tools again.

## Production configuration

Set: 

```text
DB_PROVIDER=postgres
DATABASE_URL=postgresql://...
DB_SSL=true
DB_POOL_MAX=10
DB_CONNECTION_TIMEOUT_MS=10000
DB_STATEMENT_TIMEOUT_MS=5000
```

Do not put the real `DATABASE_URL` into source control. It will later be managed through the production secret-management strategy.

## Canonical production database responsibilities

- Users, sessions and account security
- Plans, subscriptions, credits and billing
- Usage and audit events
- Files and saved projects metadata
- Mail connections/messages/labels
- AI providers and assistant conversations/jobs
- Business workspaces and members
- Promotions/referrals/student offers
- Background jobs and system events
- Payment customer/event records
- OAuth state and future Google sign-in identity mapping
- Admin roles and reporting

Uploaded/generated file bytes should **not** live in PostgreSQL. Use object storage (recommended next: Cloudflare R2) and keep only metadata/keys in Postgres.

## Next infrastructure sequence

After Phase 17A, the planned sequence remains:

1. Redis + BullMQ
2. Cloudflare R2
3. Google Sign-In
4. Gemini production provider
5. Admin Secrets & Integrations
