# Phase 55 — TAMPtools Architecture Reset

## Objective
Stop the repeated generic-workspace pattern by separating the shared TAMP product shell from individual tool applications.

## Findings
1. `frontend/workspace.html` was the universal entry point for most tools.
2. `frontend/workspace.js` selected a renderer based on `?tool=` and injected each renderer into the same `.workspace-layout`, `.canvas-main`, and `.preview-panel` structure.
3. Global workspace CSS reinforced the same visual hierarchy across tools.
4. Dashboard/homepage/templates routing therefore repeatedly returned users to the same application shell.
5. Previous validation relied heavily on syntax and ZIP integrity; this did not prove the running browser was using the intended tool entry point.

## Reset implemented
- Added `frontend/apps/tool-registry.js` as the migration boundary.
- Added dedicated Document & PDF Studio entrypoint: `frontend/apps/document-pdf.html`.
- Added dedicated Document & PDF Studio application code: `frontend/apps/document-pdf.js`.
- Document & PDF Studio no longer loads `workspace.js` and no longer depends on `workspace.html?tool=document-pdf-studio`.
- Dashboard/homepage/sidebar/template links now open `/apps/document-pdf.html`.
- Existing backend PDF APIs and entitlement enforcement remain in place.
- Existing universal workspace remains temporarily for tools that have not yet been migrated; it is explicitly legacy architecture.
- Added `docs/PHASE-55-ARCHITECTURE-RESET.md` describing the new boundary and migration rule.

## New rule
A tool is not considered architecturally migrated until it has its own application entry point and owns its workspace/editor/state model. Shared TAMP branding, authentication, account navigation, billing and entitlements may remain shared.

## Verification
- JavaScript syntax: passed for new registry, Document/PDF application, shared app shell.
- Backend JavaScript syntax: passed.
- Python compilation: passed for backend Python modules.
- Static routing audit: Document/PDF links resolve to `/apps/document-pdf.html`; no remaining frontend link targets `workspace.html?tool=document-pdf-studio`.
- Dedicated Document/PDF application does not reference `workspace.js` or `workspace.html`.
- Full authenticated browser E2E was not run because project dependencies are not installed in the provided runtime and installation previously exceeded the execution window. Therefore this phase does not claim live browser E2E completion.

## Next migration order
1. Document & PDF Studio — proof application (this phase)
2. Resume Builder — document editor architecture
3. Spreadsheet & Data Cleaner — data-grid architecture
4. QR Code Generator — design studio architecture
5. Invoice Generator — invoicing architecture
6. Proposal Builder — proposal editor architecture
7. Cover Letter Builder — writing/editor architecture
8. Image Studio — visual editor architecture
9. remaining tools

Do not add new feature phases to the legacy generic workspace. Migrate the target tool into `/frontend/apps/` first.
