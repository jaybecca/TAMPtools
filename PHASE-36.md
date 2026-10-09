# TAMPtools Phase 36 — Modern Document & PDF Studio (Functional Repair)

## Goals
1. Keep the modern, friendly TAMPtools workspace established in Phase 35.
2. Make the Document & PDF Studio controls actually execute the existing backend processing services.
3. Make file selection intelligent so supported uploads lead users into the correct task.
4. Keep translation fully TAMPtools-owned with no Google Cloud Translation dependency or cost.

## Functional repair
- Uploading an image automatically selects **Images to PDF**.
- Uploading one PDF from the default state selects **Compress PDF**.
- Uploading multiple PDFs selects **Merge PDFs**.
- Uploading DOCX/TXT/MD from the default state selects **Extract text**.
- Drag-and-drop follows the same task selection rules.
- File-type validation is shown before a job is sent.
- Real processing status is shown while the API job runs.
- API error responses are surfaced instead of silently failing.
- PDF-to-image results are awaited correctly with `Promise.all`.
- Images-to-PDF supports up to 20 images in one PDF.
- Extract text now supports PDF, DOCX and text files consistently with the workspace.
- Result cards provide real download URLs from TAMPtools storage.

## Real processing endpoints
- Create PDF
- Merge PDFs
- Split PDF
- Compress PDF
- PDF to images
- Images to PDF
- Organize pages
- OCR
- Extract text
- Compare documents

## Translation
- No Google Cloud Translation.
- No external translation API.
- No translation API key required.
- Translation remains TAMPtools-owned through the curated catalog/database.
