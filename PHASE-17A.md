# Phase 17A — PostgreSQL / Neon Production Runtime

## Objective
Make PostgreSQL a real production database runtime for TAMPtools while retaining SQLite as the lightweight local-development option.

## Implemented
- PostgreSQL runtime selector via `DB_PROVIDER=postgres`.
- `pg` connection-pool integration with `DATABASE_URL`.
- SSL, pool-size, connection-timeout and statement-timeout configuration.
- Canonical PostgreSQL schema initialization on startup.
- Production plan seed/upsert for Free, Lite, Pro and Business.
- Shared awaitable database boundary for existing application queries.
- PostgreSQL result-date normalization for compatibility with current application logic.
- PostgreSQL compatibility normalization for the SQLite-style SQL patterns still present in the existing codebase.
- Health endpoint reports the active database provider.
- Existing SQLite runtime preserved for local development.
- Foundation/static checks updated to understand the new adapter split.
- Phase 17A tests added for the local adapter and production configuration.

## Production configuration

```text
DB_PROVIDER=postgres
DATABASE_URL=postgresql://...
DB_SSL=true
DB_POOL_MAX=10
DB_CONNECTION_TIMEOUT_MS=10000
DB_STATEMENT_TIMEOUT_MS=5000
```

Real credentials are intentionally **not** included in this checkpoint. They will be handled later through the planned Admin **Settings → Secrets & Integrations** system and hosting-level secrets.

## Validation
- Backend JavaScript syntax: passed.
- Frontend JavaScript syntax: passed.
- Foundation checks: passed.
- Static project checks: passed.
- Automated backend tests: 6/6 passed.
- Live HTTP testing was not claimed because the packaged environment does not contain installed backend dependencies; run `npm install` before local live testing.

## Next
Phase 17B — Redis / BullMQ durable job infrastructure.
