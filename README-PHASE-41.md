# TAMPtools Phase 41 — Runtime Stability

This phase prioritizes making the existing application actually runnable.

## Fixed
- Added `GET /api/health` for database/queue/runtime visibility.
- IMAP validation now returns clear field errors instead of a raw Zod crash.
- IMAP remains optional; missing IMAP configuration does not disable the application.
- Translation failures are logged instead of silently swallowed.
- Added regression tests for health, optional integrations, and translation diagnostics.
- Added explicit optional IMAP settings to `.env.example`.

## Run
1. Copy `backend/.env.example` to `backend/.env`.
2. Run `npm install` in `backend/`.
3. Run `npm start` from the project root.
4. Open `http://localhost:4000/api/health`.

A healthy local response should report `ok: true` and `database: "ok"`. Optional integrations can remain disabled.
