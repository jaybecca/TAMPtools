# TAMPtools Phase 46 — Individual Document & PDF Studio

Document & PDF Studio is restored as a specialist workspace rather than a generic upload-first tool.

## Tasks
- Merge PDFs
- Split PDFs
- Extract pages
- Reorder pages
- Rotate pages
- Compress PDF
- Convert supported document/PDF formats
- Add/remove pages
- OCR scanned PDFs
- Extract text

## Plan model
- Free: core PDF workflows, 3 files/task, 25 MB/file, 10 PDF actions/month.
- Lite: higher limits and advanced OCR/Office conversion.
- Pro: higher limits and advanced workflows.
- Business: highest capacity/fair-use positioning and team-ready limits.
- 30-Day Trial: Lite-style PDF capacity.

The server enforces plan limits; the frontend only presents the current plan and controls.

## Advanced PDF runtime
Page rotation and PDF-to-Word use the optional Python runtime in `backend/requirements-pdf.txt` (`pypdf` and `python-docx`). Office-to-PDF conversion uses LibreOffice/soffice.
