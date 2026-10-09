# Phase 18 — AI Secret Integration

Connect the encrypted Admin Secrets & Integrations system to the AI provider router.

## Implemented
- AI provider records use `secret_ref` to reference encrypted credentials.
- AI Gateway resolves the referenced encrypted secret server-side before provider calls.
- OpenAI, Gemini and Claude can use Admin-managed encrypted credentials.
- Environment API keys remain a development/compatibility fallback.
- Raw API keys are not returned to the frontend or persisted in `ai_providers.api_key` by the admin provider flow.
- Missing/broken stored credentials are skipped so provider fallback can continue.
- Secret `last_used_at` is updated when a stored credential is successfully resolved.
- Encryption remains AES-256-GCM with `TAMPTOOLS_ENCRYPTION_KEY` held outside the database.

## Validation
- Node syntax checks
- Phase 18 focused tests
- ZIP integrity
