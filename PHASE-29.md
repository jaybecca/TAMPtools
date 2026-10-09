# Phase 29 — Mail Manager: Google, Microsoft & Universal Mail Connections

## Added
- Gmail OAuth using the existing Google OAuth client with Gmail mailbox scope.
- Microsoft OAuth for Outlook / Microsoft 365 using Microsoft Entra credentials.
- Generic IMAP mailbox connection remains supported.
- OAuth tokens and IMAP credentials are stored through the existing encrypted secret store.
- OAuth token refresh for Google and Microsoft.
- Provider connection validation.
- Gmail and Microsoft mailbox synchronization.
- Provider folder/label discovery stored with the connection.
- Inbox/message retrieval into the TAMPtools Mail Manager database.
- Provider-aware read/unread, archive, move and delete actions where supported.
- Gmail star/unstar support.
- Provider error state instead of falsely reporting a connection as ready.
- Disconnect removes the provider secret and mailbox connection.
- Mail Manager UI now exposes Gmail, Microsoft 365 and universal IMAP connection paths.

## Required environment
- Existing `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` for Gmail OAuth.
- `MICROSOFT_CLIENT_ID`, `MICROSOFT_CLIENT_SECRET`, and optional `MICROSOFT_TENANT_ID` for Microsoft.
- Existing `TAMPTOOLS_ENCRYPTION_KEY` for encrypted mailbox credentials/tokens.

## OAuth redirect URLs
Google:
`https://YOUR-DOMAIN/api/mail/oauth/google/callback`

Microsoft:
`https://YOUR-DOMAIN/api/mail/oauth/microsoft/callback`

Local:
`http://localhost:4000/api/mail/oauth/google/callback`
`http://localhost:4000/api/mail/oauth/microsoft/callback`

## Important
Google Sign-In and Gmail mailbox access are separate permissions. The same Google OAuth client can be used, but Gmail requires additional consent/scopes.

The implementation does not report a mailbox as connected until provider authorization/token exchange succeeds. Provider OAuth/API credentials must be configured before those buttons can work.
