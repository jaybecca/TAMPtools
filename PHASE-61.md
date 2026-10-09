# Phase 61 — Storage Manager File Browser

## Product direction
Storage Manager is a file browser and organization workspace, not a document editor or generic tool form. The interaction model takes useful cues from Dropbox's navigation/search/quick preview workflow and Google Drive's folder creation, drag-and-drop and move actions.

## Implemented
- Replaced the compact legacy storage utility page with a dedicated responsive file-browser workspace.
- Added navigation views for All files, Recent, Images, Documents, Archives, Storage scan and Recovery.
- Added breadcrumb navigation, virtual folder hierarchy, persistent empty folder records, folder opening, and drag-and-drop moving of selected files into folders.
- Added multi-file upload by file picker and drag/drop, upload feedback, storage usage display and server-side quota enforcement (existing API).
- Added grid/list layouts, sorting, live filename/folder search, multi-select and bulk actions.
- Added image thumbnails, file detail inspector, browser preview and real downloads.
- Added rename, move, move-to-recovery, restore, multi-file ZIP download, storage scan and old-file scan.
- Reused the existing TAMP app shell for one logo/header, avatar/account dropdown, Templates and Support navigation.
- Added persistent per-user folder paths via `user_storage_folders`; folder endpoints require authentication and creation is same-origin protected.

## Server endpoints reused or extended
- `GET /api/files`
- `POST /api/files/upload`
- `GET /api/files/:id/preview`
- `GET /api/files/:id/download`
- `PATCH /api/files/:id`
- `DELETE /api/files/:id`
- `GET /api/storage/insights`
- `GET /api/storage/trash`
- `POST /api/storage/restore/:id`
- `POST /api/storage/move`
- `GET /api/storage/folders` (added)
- `POST /api/storage/folders` (extended to persist user-owned folder paths)
- `POST /api/zip/create` (used for selected-file download as ZIP)

## Verification and limitations
- JavaScript syntax checks passed for `frontend/files.js`, `frontend/app.js`, and `backend/src/server.js`.
- The existing backend test suite was attempted: 25 tests passed and 4 failed. Failures include missing installed dependency `dotenv` for tests importing the backend, and pre-existing source-contract failures in the PDF/workspace test suite. This is not a clean full-suite pass.
- No authenticated browser/runtime was available here to verify live uploads, folder moves, restore, quota rejection, or account navigation end-to-end. These are wired to existing authenticated server endpoints but should be smoke-tested in the deployed environment.
- This phase intentionally does not claim external cloud-drive sync, public sharing, version history, or a cloud-storage provider of its own. It manages files stored in TAMPtools using the configured local/R2 storage provider.
