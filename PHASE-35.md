# TAMPtools Phase 35 — Translation Cost Cleanup + Modern Image Studio

## Goals
1. Remove paid Google Cloud Translation from TAMPtools. Translation is now local/curated and uses the database/catalog only.
2. Make the Image Studio feel like a modern, friendly creative workspace rather than a retro/technical tool panel.
3. Keep real image processing connected to the existing backend operations.

## Translation
- No Google Cloud Translation API calls.
- No Google translation API key required.
- Existing curated `ui-translations.json` remains the source of reviewed translations.
- Database translations remain available through `i18n_translations`.
- Missing strings fall back to English until a reviewed TAMPtools translation is added.
- Translation status reports a local curated provider and zero external translation cost.

## Image Studio
New experience:
- Friendly welcome header
- Upload images / quick preset / multiple images entry points
- Visual upload queue with thumbnails
- Large central image preview
- Before/after result comparison
- Clear action groups: Improve, Size & format, Finish
- Real controls for enhance, remove background, background color, resize, crop, compress, convert, watermark, shadow and reflection
- One clear Apply change action
- Download result
- Multi-image processing uses the existing `/api/image-studio/batch` endpoint
- Responsive layout
- TAMPtools purple/violet + blue/cyan + restrained gold/orange visual language

## Design principle
The work area should feel calm and useful: fewer technical labels, larger visual hierarchy, clear actions, whitespace, friendly cards and visible results.
