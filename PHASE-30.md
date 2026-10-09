# Phase 30 — Complete 4-Language Translation

Scope: translation-only. No product functionality, billing, mail, storage, AI, or workflow behaviour is changed.

Supported interface languages in this phase:
- English (US) — source language
- English (UK)
- Simplified Chinese
- Spanish

## Coverage
The localization layer now contains a shared key/phrase set for the core customer-facing interface, including navigation, dashboards, work areas, authentication, pricing, credits, storage, mail connection fields, status messages, validation messages, support, account settings, and workspace controls.

The runtime translation pass also handles exact visible phrases and generated `Open …` tool links so shell-generated UI is localized consistently.

## Language selector
The interface selector is intentionally limited to the four Phase 30 languages. Other historical language dictionaries remain in the source archive but are not exposed by the Phase 30 interface.

## Source of truth
`frontend/ui-translations.json` is the phrase dictionary. English (US) is the source wording; English (UK), Chinese, and Spanish provide corresponding translations.

## Validation
- `frontend/app.js` passes Node syntax validation.
- `frontend/ui-translations.json` passes JSON validation.
- The four Phase 30 dictionaries have matching key coverage.
