# Phase 17D — Google Sign-In

- Google OAuth 2.0 / OpenID Connect Sign-In
- CSRF state cookie
- Google verified email/profile retrieval
- OAuth identity table for account linking
- Existing email accounts can link verified Google identity
- Session creation uses existing TAMPtools auth
- Google secrets remain environment-managed until Phase 17F

Required env: GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, APP_BASE_URL.
Redirect URI: /api/auth/google/callback.
