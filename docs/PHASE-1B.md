# TAMPtools Phase 1B — Source Integration & Foundation Completion

## Status

**Foundation integration complete.**

Phase 1B uses the actual `tamptools.zip` source as the source of truth. The existing application is substantially more mature than the Phase 1A scaffold, so the Phase 1A scaffold was not copied over the real project.

## What Phase 1B does

- Audits the actual frontend/backend structure.
- Preserves the existing working Node.js + Express + static frontend architecture.
- Adds a root project command layer for consistent development and checks.
- Pins the expected Node major version with `.nvmrc`.
- Adds the canonical TAMPtools product architecture as a backend configuration boundary.
- Adds a dedicated Phase 1B foundation verifier.
- Adds `/api/platform` for the canonical product map.
- Adds foundation metadata to `/api/health`.
- Documents the existing-source audit and legacy migration boundary.

## What was found

The existing source already contains authentication/session handling, SQLite persistence, entitlement/plan infrastructure, file metadata, jobs, audit events, AI provider abstraction, payment adapters, integrations and several processing services.

Therefore those systems are **not reimplemented from scratch** in Phase 1B.

## Intentionally not completed here

Phase 1B does not claim that the final customer-facing TAMPtools studios are complete. It also does not migrate or delete legacy social/campaign functionality. Those changes belong in the relevant later implementation phases.

Phase 1B also does not claim production PostgreSQL, live payment credentials, external AI credentials, object storage, or production deployment are complete.

## Verification

Run:

```bash
npm ci --prefix backend
npm run check:foundation
npm test
npm run check:api
```

`check:api` requires the backend server to be running.

## Next phase

After Phase 1B is accepted, proceed to:

**Phase 2 — Authentication, Accounts & User Dashboard**
