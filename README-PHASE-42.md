# TAMPtools Phase 42 — Deterministic Runtime

Fixes carried forward from Phase 41:

- `npm run dev` uses a stable Node process instead of `node --watch`.
- Duplicate `/api/health` route removed.
- SIGINT/SIGTERM shutdown is idempotent and has a 5-second safety timeout.
- Public home translation script identifies the first-party translation pack and supported languages explicitly while continuing to use `/api/i18n`.
- Phase 39 translation test is aligned with the first-party translation implementation.
- Translation status reports curated translation cost as zero; optional AI fallback is reported separately.

Run:

```bash
npm install
npm run dev
```

Open: http://localhost:4000

Health: http://localhost:4000/api/health
