# TAMPtools Phase 48 — Proposal Builder + Template Library

## Proposal Builder
Dedicated, operation-first Proposal Builder workspace with:
- Client information
- Business information
- Project title and overview
- Scope of work
- Line-item pricing
- Tax and discount calculations
- Timeline
- Terms
- Next steps
- Professional / Modern / Minimal / Creative templates
- Live proposal preview
- HTML / print output
- PDF generation
- Plan-aware proposal limits and template access

Basic proposal generation uses the normal tool-use allowance and does not require an AI provider.

## Templates
Added a global `/templates.html` template library and navigation link. The library currently covers templates for:
- Invoices
- Proposals
- QR codes
- Resumes
- Cover letters
- Career profiles
- Content
- Images
- Documents

Template cards route directly into the relevant generator with the selected template.

## Validation
- `node --check backend/src/server.js` — passed
- `node --check frontend/workspace.js` — passed
- `node --check frontend/app.js` — passed
- ZIP integrity — checked after packaging
