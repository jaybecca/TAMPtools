# TAMPtools Phase 17C — Cloudflare R2

Production file storage now supports Cloudflare R2 through an S3-compatible storage abstraction while retaining local disk for development.

## Environment
- `STORAGE_PROVIDER=local` for local development
- `STORAGE_PROVIDER=r2` for production
- `R2_ACCOUNT_ID` or `R2_ENDPOINT`
- `R2_BUCKET`
- `R2_ACCESS_KEY_ID`
- `R2_SECRET_ACCESS_KEY`

Credentials are placeholders only. Real secrets are intentionally deferred to Phase 17F secret management.

## Implemented
- R2 upload
- R2 download/preview streaming
- R2 existence checks
- R2 rename via copy/delete
- R2 trash/recovery via copy/delete
- R2 cleanup
- DB metadata remains in PostgreSQL
- Local provider preserved for development
- ZIP packaging updated to read from the storage abstraction

## Deployment model
Cloudflare is used for R2 storage (and can also provide DNS/CDN/WAF/SSL). The current Node/Express backend remains the application server; this is not a move of the whole backend to a Cloudflare Page/Worker.
