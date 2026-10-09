# Phase 31 — Consistency, Mail Google Credential Fix & Translation Batch 1

## Product changes
- Restored the language selector across authenticated, public and authentication pages.
- Language selector currently exposes only English (US), English (UK), Simplified Chinese and Spanish.
- Currency selector remains separate and now drives the AI Credit meter.
- AI Credits remain ₦3 per credit as the base price; the displayed top-up amount converts with the selected currency.
- Restored visible Name and Email fields on authentication pages and reinforced their input styling.
- Mail Manager now shows the secondary logo mark in the workspace hero while retaining the main brand logo in the header.
- Google Mail OAuth explicitly reuses the same GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET as Continue with Google. Gmail access is an additional consent scope, not another credential pair.
- Fixed the Phase 29 missing Mail OAuth helper functions and added Google/Microsoft token refresh, provider API helpers and mailbox sync helpers.
- Google/Microsoft connections only become connected after successful OAuth/token/profile validation.
- Google disconnect attempts token revocation; local Microsoft credentials/tokens are removed on disconnect.

## Translation Batch 1
Auth, Mail Manager, Pricing/AI Credits, dashboard/core shell.

This phase intentionally does not claim full-project translation. Remaining customer-facing strings are scheduled in subsequent translation batches.
