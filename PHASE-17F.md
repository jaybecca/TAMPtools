# Phase 17F — Encrypted Secrets & Integrations

- Admin-only Secrets & Integrations panel
- AES-256-GCM encrypted secret values
- Master encryption key remains an environment/hosting secret
- Secret values are never returned to the browser after save
- Generic integration secret store for AI/providers and future payments/email/R2/Google credentials
- AI provider API keys migrated to secret references for new configuration
- Audit events for secret create/update/delete
- PostgreSQL and SQLite schema support

Production requirement: set `TAMPTOOLS_ENCRYPTION_KEY` outside the database before storing secrets.
