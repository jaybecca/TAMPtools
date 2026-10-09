# Phase 66 — Spreadsheet & Data Cleaner

Dedicated spreadsheet-cleaning workspace: import and inspect CSV/TSV/XLS/XLSX/ODS, preview rows and detected data issues, select conservative/standard/aggressive cleaning rules, remove blank rows and exact duplicates, normalize whitespace and common fields, and export cleaned CSV/XLSX. Tier limits are checked server-side; Lite+ audit workbook and Pro+ smart deduplication/AI suggestions are gated server-side. XLSX exports include a cleaning summary and optional change/removal logs.

Entry point: `/spreadsheet-studio.html`.

Deployment prerequisites: Node.js 22.5+, Python 3 and `openpyxl`; configure the application's normal environment/database/storage dependencies as documented in `backend/README.md`.
