# TAMPtools Phase 59 — PDF Studio Runtime + Workspace Refinement

## Changes
- Removed redundant PDF upload controls from the main workspace. One Upload PDF entry point handles single and multi-PDF uploads.
- Restored the single-page Document & PDF Studio architecture: Pages, Sources, and Tools are internal workspace panels, not separate child pages.
- Restored a stronger in-workspace Rotate Pages experience: 90° left/right, 180°, and all-pages rotation.
- Made Insert blank page an explicit page-management action rather than a default workspace concept.
- Added in-workspace compression and conversion controls.
- Conversion UI is explicit about supported PDF outputs: DOCX, TXT, PNG, JPG.
- Added compact Focus canvas control.
- Reduced global language/currency selector footprint.
- Added Ghostscript fallback when `pdftoppm` is unavailable, covering PDF thumbnails and PDF-to-image conversion.

## Verification
- `node --check` passed for changed frontend/backend files.
- Foundation verification passed.
- Forced missing-`pdftoppm` tests passed for PDF inspection thumbnails and PDF-to-PNG/JPG conversion through Ghostscript.
- PDF-to-TXT conversion passed.
- Full legacy test suite is not clean because the repository test suite contains pre-reset expectations and the current test environment lacks installed `dotenv`; these are not treated as feature-completion evidence.
