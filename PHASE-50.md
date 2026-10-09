# TAMPtools Phase 50 — Spreadsheet & Data Cleaner

## What changed
Rebuilt the Spreadsheet & Data Cleaner as a dedicated data-quality workspace inspired by modern spreadsheet/data-cleaning products including Zoho Sheet, ExcelMaster.ai, OpenRefine, Rows and Airtable.

## Workflow
1. Import CSV, TSV, XLS, XLSX or ODS.
2. Preview the worksheet and inspect data quality before making changes.
3. See row/column counts, duplicates, empty rows, whitespace/invisible characters, errors, invalid emails, dates and number normalization opportunities.
4. Choose Conservative, Standard or Aggressive cleaning presets.
5. Remove empty rows and exact duplicates.
6. Pro/Business: smart near-duplicate detection.
7. Normalize whitespace, names, emails, phone numbers, countries, dates and numbers where safely detected.
8. Export XLSX or CSV.
9. Lite+: optional audit/diff workbook containing a cleaning summary, change log and removed-row report.
10. Pro/Business: optional AI cleanup suggestions; AI suggestions are never applied automatically.

## Plan design
- Free: 5,000 rows/file, 25 MB, one worksheet; core preview, exact dedupe, empty-row cleanup, conservative normalization, error scan and CSV/XLSX export.
- Lite: 25,000 rows/file, 50 MB, up to 5 worksheets; richer normalization, presets and audit/diff workbook.
- Pro: 100,000 rows/file, 100 MB, up to 20 worksheets; smart near-duplicate detection, AI suggestions and audit/diff.
- Business: 250,000 rows/file, 250 MB, up to 50 worksheets; smart dedupe, AI, multi-sheet workflows and audit/diff.

## Backend
- Added `backend/src/spreadsheet-cleaner.js` for inspection, canonical duplicate detection, conservative normalization and cleaning reports.
- Expanded spreadsheet input handling to XLS/XLSX/ODS through LibreOffice conversion where required.
- Added plan capabilities endpoint: `/api/tools/spreadsheet-data-cleaner/capabilities`.
- Rebuilt `/api/spreadsheets/inspect` and `/api/spreadsheets/clean`.
- AI cleanup endpoint is now plan-gated to Pro/Business.
- Cleaned XLSX exports can include a Cleaning Summary sheet.
- Audit exports include Cleaning Summary, Change Log and Removed Rows.
- Tool processing consumes a monthly TAMPtools tool use only when cleaning/exporting, not when previewing.

## Frontend
- Replaced the older basic spreadsheet page with a dedicated premium data-cleaning workspace.
- Added drag/drop import, worksheet selection, quality dashboard, preview grid, presets, impact estimate, tier locks and export/result state.
- Existing dashboard navigation continues to route to `/spreadsheet-studio.html`.

## Validation
- Node syntax checks passed for the new server/cleaner/frontend files.
- Python syntax check passed for the spreadsheet processor.
- Direct cleaner tests passed for whitespace cleanup, duplicate handling, empty rows, date/number normalization and audit workbook generation.
- Full repository tests were not fully runnable from the extracted phase because `backend/node_modules` is absent; existing unrelated legacy tests also reference earlier source layouts.
