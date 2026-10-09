# Phase 73 — Mail Manager

Mail Manager provides a dedicated mail workspace with message search/filtering, selection and bulk actions, mailbox connection flows for Gmail/Microsoft OAuth and IMAP, `.eml` import, email drafting, export, and password-protected mail archives.

## Deployment requirements
- Configure Google OAuth credentials and callback URL to enable Gmail.
- Configure Microsoft OAuth credentials and callback URL to enable Microsoft mail.
- Use HTTPS and the application's configured secret storage in production.

## Scope note
This phase packages the existing Mail Manager implementation. Provider connection and mail sync depend on valid deployment credentials and user authorization. A dedicated send/reply workflow is not verified as implemented in this build; the write-email tab generates drafts rather than sending messages.
