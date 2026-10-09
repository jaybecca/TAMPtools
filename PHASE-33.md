# TAMPtools Phase 33 — Economics & Usage Architecture

Phase 33 adds a usage-aware economics layer so variable-cost AI work can be priced and metered without hard-coding provider costs into customer-facing features.

## Core rules

- TAMP AI Credit value: **₦3 per credit**.
- AI jobs consume variable credit amounts by operation instead of treating every AI action as one credit.
- Plans can include an AI allowance (`features.aiGenerations`).
- When the included AI allowance is exhausted, eligible AI jobs can consume purchased TAMP Credits.
- Provider/model costs are configurable in the database and Admin Console.
- Provider keys remain server-side; this phase does not expose them to customers.

## Initial AI credit schedule

| Operation | Credits | Category |
|---|---:|---|
| Email rewrite/generation | 1 | Text |
| TAMP Assistant | 2 | Text |
| Content generation | 3 | Text |
| Invoice generation | 3 | Text |
| Spreadsheet AI cleaning | 3 | Text |
| Blog generation | 8 | Text |
| Proposal generation | 8 | Text |
| Document AI extraction | 10 | Document |
| Invoice/receipt AI extraction | 10 | Document |
| AI image generation | 30 | Image |

These are initial controls, not claims about final provider pricing. Admin can change the rates and credit schedule in later iterations.

## Provider usage measurement

The AI provider layer now captures, where providers return it:

- provider
- model
- input tokens
- output tokens
- image units
- provider cost estimate
- estimated credits
- charged credits
- completion/fallback/error status

## Economics reporting

Admin endpoint:

`GET /api/admin/ai-economics`

Returns:

- credit value
- total AI jobs
- estimated/charged credits
- provider cost
- operation profitability inputs
- provider/model breakdown
- configurable provider rates

Admin rate update endpoint:

`PUT /api/admin/ai-economics/rates`

## Safety behavior

If an AI provider fails and TAMPtools falls back to its local response, charged TAMP Credits are refunded. Provider failures are recorded for later profitability/error analysis.

## Important distinction

Subscription plans still provide included usage. TAMP Credits are the variable-cost safety valve for heavier AI work. The goal is to prevent a low-priced plan from silently creating unlimited provider/API costs.
