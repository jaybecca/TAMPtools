# Phase 33 — Economics & Usage Architecture

This package is based on Phase 32 and adds the economics/usage layer before final UX/product refinement.

Main additions:
- AI credit consumption by operation
- Included-plan AI allowance tracking
- TAMP Credits overage charging
- Provider/model token usage capture
- Configurable provider cost rates
- AI profitability data model
- Admin AI Economics endpoint
- Admin provider-rate editing endpoint
- Failure/fallback credit refund behavior
- Phase documentation

Run:

```bash
cd backend
npm install
npm run check
npm test
```

The provider cost values seeded in the database are starting reference values and should be reviewed against the exact live provider/model pricing before production billing is enabled.
