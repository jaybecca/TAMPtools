# TAMPtools Phase 28 — Mail Manager Functionality & Workspace Refinement

## Goals
- Make Mail Manager easier to understand and use.
- Replace the misleading “save a domain” behavior with a real generic IMAP connection path.
- Keep `.eml` import as a no-API workflow.
- Add connected-mailbox sync for IMAP mailboxes.
- Store mailbox credentials encrypted with the existing TAMPtools secret system.
- Restore a consistent TAMPtools logo/header on the customer dashboard.
- Keep the Phase 27 workspace improvements and fix the known `monthlyUsage` import bug.

## Mail connection requirements
- `.eml` import: no provider API required.
- Generic business/custom domain: normally no custom API is required; the mailbox needs IMAP access and credentials (or an app password).
- Gmail/Google Workspace: production OAuth sync should use Google OAuth/Gmail API. The generic IMAP path is useful where the account permits IMAP/app-password access.
- Outlook/Microsoft 365: production OAuth sync should use Microsoft identity/Graph. Generic IMAP is useful where IMAP is enabled.
- TAMPtools email sending/verification: Resend remains a separate outbound-email provider.

## Implemented
- Mail Manager redesigned into Find → Review & Act → Connect → Write → Protected Archive.
- Mail counts, selection count and source count.
- Select-all, Smart Select, clearer bulk actions and result cards.
- Real custom-domain IMAP form: mailbox email, host, port, TLS, username, password/app password, folder.
- IMAP connection test.
- IMAP mailbox connection.
- IMAP sync of recent mailbox messages with duplicate detection.
- Remove connection while keeping imported messages.
- Encrypted storage of IMAP credentials using `integration_secrets` and `TAMPTOOLS_ENCRYPTION_KEY`.
- Dashboard top bar restored with TAMPtools logo, Home, Account and theme control.
- Phase 27 `monthlyUsage` backend import corrected.
- Added `imapflow` and `mailparser` backend dependencies.

## Important limitation
The IMAP route is intentionally generic. Gmail/Outlook OAuth is not falsely represented as complete by this phase. Provider-specific OAuth sync remains a separate integration task.

## Setup
After unpacking, run in `backend`:

```bash
npm install
```

Ensure `TAMPTOOLS_ENCRYPTION_KEY` is configured before saving mailbox credentials.
