# Phase 17B — Redis / BullMQ

## Implemented
- BullMQ durable queue integration.
- Redis connection via `REDIS_URL`.
- Dedicated `backend/src/worker.js` process.
- File-processing jobs routed through BullMQ.
- Retry/backoff and job retention policies.
- Durable recurring cleanup scheduler through BullMQ Job Scheduler.
- Redis status exposed in Admin health.
- Removed the in-process `setInterval(processJobs)` worker.
- SQLite/PostgreSQL `jobs` table retained as application job/audit state.

## Runtime
Start the API normally, then run the worker separately:

```bash
npm install
npm --prefix backend install
npm run dev
npm run worker
```

Production requires `REDIS_URL`.

## Validation
- Phase 17B tests: 3/3 passed.
- Modified JavaScript syntax checks passed.
- Full dependency-backed test suite was not run successfully in the build environment because installed `node_modules` is incomplete and dependency installation could not finish here.
