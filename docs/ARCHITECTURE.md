# TAMPtools Architecture — Phase 1B

## Product boundary

TAMPtools is a digital operations base for digital work, files, documents, communication and business tasks.

The agreed customer-facing structure is:

1. Mail
2. Images
3. Documents & PDF
4. Files & Storage
5. Batch
6. Business & Generators
7. Career & Content
8. AI — TAMP Assistant

There is a separate Admin Console. It is not a customer-facing tool.

## Canonical customer-facing tools

- Mail Manager
- Image Studio
- Document & PDF Studio
- Storage Manager
- ZIP & File Toolkit
- Batch Studio
- Invoice Generator
- Proposal Builder
- QR Code Generator
- Spreadsheet & Data Cleaner
- Resume Builder
- Cover Letter Builder
- Career/Profile Writer
- Content Studio
- TAMP Assistant

Batch processing is a shared capability. TAMP Assistant is a cross-platform orchestration layer.

Social account management, social scheduling, social publishing and social analytics are outside the agreed core product scope.

## Runtime layers

```text
Browser / Static Frontend
        |
        v
Express API + Session Auth
        |
        +--> Validation / Security
        +--> Entitlements / Usage
        +--> File + Job Infrastructure
        +--> Domain Services
        +--> AI Provider Abstraction
        +--> Payments / Email / Optional Integrations
        |
        v
SQLite (local) / PostgreSQL target (production)
```

## Shared-service principle

Studios must use shared infrastructure rather than implementing isolated copies of:

- authentication
- storage
- usage/entitlements
- jobs
- AI access
- document/file metadata
- audit events
- billing

## AI boundary

Customer-facing AI calls should use the TAMPtools-owned provider abstraction. Provider selection must remain server-side so provider API keys never reach the browser.

## Database boundary

SQLite remains the local development database. PostgreSQL remains the production target. The migration boundary must be implemented and tested before production database switching.
