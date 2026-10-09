# Phase 34 — Translation Engine + Batch Studio Refinement

## Translation
- Keeps all 22 TAMPtools interface languages.
- Treats the English catalog as the canonical UI source.
- Adds a server-side Google Cloud Translation integration for missing translations.
- Translations are cached in `i18n_translations` so the same UI text is not translated repeatedly.
- Google credentials stay server-side in `GOOGLE_TRANSLATE_API_KEY`.
- Existing curated translations remain preferred; Google fills gaps.
- Nigerian Pidgin remains a curated fallback because Google Cloud Translation may not expose a direct `pcm` target.
- Added `/api/i18n/status` and authenticated `/api/i18n/translate` for translation service diagnostics and controlled text translation.

## Batch Studio
- Rebuilt around four simple steps: Add files → Choose action → Review → Run.
- Keeps the 500-file limit.
- Uses the existing `/api/batch/process` backend.
- Adds clear action cards, simple settings, drag/drop, queue management, review summary, progress messaging and result downloads.
- Responsive, colourful and minimalist without hiding controls.
