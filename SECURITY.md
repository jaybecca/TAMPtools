# TAMPtools DevSecOps checklist

1. Never put payment secret keys, database passwords, JWT signing secrets or webhook secrets in HTML/JS.
2. Store production secrets in GitHub Actions Secrets and your hosting provider's secret manager.
3. Use HTTPS only in production.
4. Verify payment webhooks cryptographically before granting subscriptions or credits.
5. Never trust a price sent by the browser. The server must calculate the amount from the selected plan and currency.
6. Use short-lived signed download URLs for generated files.
7. Enforce file-size, MIME-type and extension allowlists for uploads.
8. Scan uploads where appropriate and delete temporary files automatically.
9. Rate-limit authentication, checkout, tool generation and upload endpoints separately.
10. Add authentication with secure, HttpOnly, SameSite cookies; never store sensitive tokens in localStorage.
11. Use a database with least-privilege credentials and encrypted backups.
12. Add audit logs for login, payment, plan changes, admin actions and suspicious activity.
13. Use CSP, HSTS, X-Content-Type-Options, Referrer-Policy and frame-ancestors in production.
14. Run dependency scanning, secret scanning, SAST and container scanning in GitHub Actions.
15. Keep dependencies updated and pin/lock production dependencies.
16. Back up the database and test restoration.
17. Configure object-storage lifecycle rules to delete temporary uploads/results.
18. Never log card details, full payment payloads, passwords or access tokens.
19. Add CSRF protection where cookie-based state-changing requests require it.
20. Add monitoring and alerts for repeated failed logins, payment anomalies and unusual tool usage.


## Phase 2 authentication

Passwords are never stored in plaintext. TAMPtools uses Node.js `crypto.scryptSync`
with a random per-password salt. Session identifiers are random 32-byte tokens;
only their SHA-256 hashes are stored in SQLite. The browser receives an HttpOnly,
SameSite=Lax cookie rather than a localStorage session.

Before production deployment, configure HTTPS and run with NODE_ENV=production so
the session cookie also receives the Secure attribute. Password-reset email delivery,
account verification, MFA, and payment provider integration remain separate phases.
