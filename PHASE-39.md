# Phase 39 — Home Translation + Business Studio Completion

## Scope
1. Fully local home-page translation architecture for all 22 supported languages; no Google Cloud Translation dependency.
2. Complete customer-facing business studios: Invoice Generator, Proposal Builder, QR Code Generator.

## Home translation
- `frontend/home-i18n.js` adds a first-party home-page translation layer.
- Uses the existing TAMPtools translation catalog first and a dedicated home-page pack for expanded coverage.
- Supports all 22 language codes: en, en_gb, zh, es, hi, fr, ar, bn, pt, ru, id, ur, de, ja, pcm, ar_eg, mr, vi, te, ha, zu, tr.
- No external translation API is called.

## Business studios
### Invoice Generator
- Professional, Minimal and Service templates.
- Business/customer details.
- Invoice number and due date.
- Currency and tax rate.
- Dynamic line items with quantity/unit price.
- Live totals and preview.
- Real `/api/tools/invoice-generator` generation and downloadable/openable output.

### Proposal Builder
- Service, Project, Consulting and Partnership templates.
- Provider/client/project information.
- Problem, deliverables, differentiator, budget, timeline and validity.
- Live structured preview.
- Real `/api/tools/proposal-generator` generation and output link.

### QR Code Generator
- Website, Text, Contact and Wi-Fi starting templates.
- Custom foreground/background colours.
- Size selection and optional label.
- Real PNG QR generation via the server-side `qrcode` package.
- Downloadable result.

## Design
Business studios use the modern TAMPtools visual language: spacious cards, rounded controls, strong typography, purple/violet and restrained gold/orange accents, clear hierarchy, live previews and direct actions.

## Validation
- `node --check frontend/workspace.js` — pass
- `node --check frontend/home-i18n.js` — pass
- `node --check backend/src/server.js` — pass
- `backend/package.json` JSON validation — pass
- No Google Cloud Translation implementation added.
