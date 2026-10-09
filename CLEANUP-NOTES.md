# Phase 16 cleanup / backend hardening checkpoint

## Removed
- Legacy `frontend/tools/` standalone tool pages.
- Legacy Campaign Studio frontend files.
- Legacy social/campaign/publisher backend modules.
- Legacy social publishing/campaign schema from the canonical PostgreSQL target.
- Old duplicate/root logo assets and background logo asset.
- Bundled local SQLite database file.
- Stale phase checkpoint documents that were only historical duplicates.
- Obsolete social/publishing environment variables.

## Canonical UI
The main customer tool entry points now use the shared `workspace.html` experience for the 15 primary tools.

## Database decision
- SQLite remains the local-development database.
- Neon PostgreSQL is the preferred production database target.
- The PostgreSQL schema was rebuilt around the canonical TAMPtools product and includes Google-ready identity fields.
- Runtime PostgreSQL switching is intentionally **not enabled yet** because the current application uses synchronous SQLite calls throughout the request layer. The next database implementation step is an async PostgreSQL adapter/repository migration, followed by dual-database integration tests.

## Backend fixes in this checkpoint
- Removed social publishing scheduler dependency from the runtime worker.
- Replaced the standalone background-removal dependency with the Image Studio processor.
- Removed campaign/social routes from the canonical runtime surface.
- Removed legacy email-campaign persistence/routes from the canonical product.
- Fixed plan lookup so storage/billing code can safely resolve plans by user id.
- Reworked reporting so it no longer depends on campaign/scheduled-post tables.
- Updated static validation to match the actual canonical 15-tool product.
- Added production configuration placeholders for Google Sign-In, Gemini, Redis and S3-compatible object storage.
- Updated the canonical Postgres schema for current file, mail, billing, AI, business and account models.

## Validation
- Backend/frontend JavaScript syntax checks: passed.
- Database initialization against SQLite: passed.
- Backend test suite: 4/4 passed.
- Project static/reference checker: 0 failures; live HTTP checks remain to be run after dependencies are installed and the server is started.
