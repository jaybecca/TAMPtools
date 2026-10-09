# TAMPtools 22-language localization audit — implementation status

## What was added

- `scripts/i18n-check.mjs`: repeatable catalog audit with a nonzero exit status when locales are missing required keys, empty values exist, interpolation variables differ, or the 22-locale inventory changes.
- `reports/i18n-audit.json` and `reports/i18n-audit.md`: machine-readable and human-readable audit outputs.
- `npm run i18n:check`: a root command to reproduce the audit.

## Audit findings (2026-10-09)

The project has the expected 22 locale identifiers and 468 canonical English strings. It is **not currently 100% translated**. Several dictionaries contain only 80 entries, while the English runtime fallback fills missing strings for display. The audit intentionally does not count that fallback as a translation.

The audit reports:

- English: 468/468 source strings.
- Simplified Chinese: 401 entries present.
- Spanish: 401 entries present.
- French, German, Portuguese, Russian, Indonesian, Turkish, Hindi, Bengali, Arabic, Egyptian Arabic, Urdu, Japanese, Marathi, Vietnamese, Telugu, Hausa, Zulu, Nigerian Pidgin: 80 entries each.
- British English: 418 entries.

The audit command currently exits nonzero, as intended. This is a truthful release gate—not a claim that localization is complete.

## Important limitation

No reliable translation provider or native-speaker review credentials were configured in this workspace. Automatically filling missing entries with English or fabricated translations would conceal the gap and violate the requested quality bar. The full 22-language translation and native-speaker QA are therefore **not completed** in this artifact. Use the report's missing-key lists to drive professional translation batches, then rerun `npm run i18n:check`. Review identical-to-English strings manually because product names and shared terms may legitimately remain unchanged.

## Release gate

Do not mark localization complete until all 22 dictionaries contain every required key, placeholders match, suspected untranslated strings are reviewed, and each language has documented linguistic QA.
