# TAMPtools Phase 58 — Dashboard Card Restoration + Single-Page PDF Studio

## Changes
- Restored the dashboard's four colored metric cards and their labels: Work Completed, Files Processed, AI Work, Storage.
- Kept the dashboard middle Work Areas section intact.
- Returned Document & PDF Studio to one main workspace route.
- Removed the long list of PDF Studio child links from the global sidebar.
- Added a full-width PDF upload strip above the PDF canvas.
- Added click-to-upload and drag/drop upload handling to the strip.
- Kept the large central PDF page workspace for reorder, rotate, duplicate, delete, insert, save and export.
- Legacy `?view=` URLs now land on the single PDF Studio workspace instead of opening separate operation pages.

## Validation
- Node syntax checks passed for the changed frontend and backend JavaScript files.
- Existing PDF backend was retained; no PDF processing path was removed.
