# TAMPtools Phase 22 — Minimalist UI, Account Menu, Locale Cleanup & Support

## Scope

Phase 22 addresses the live UI issues reported after local launch.

### UI / navigation
- One visible global language selector and one visible global currency selector per page.
- Removed the extra writing-language and translation-language selectors from the global shell.
- Removed the separate homepage pricing currency selector; pricing follows the global currency selection.
- Checkout currency is kept internal/hidden and synchronized from the global currency.
- Simplified the authenticated sidebar by removing repeated Settings/Support/upgrade blocks; those actions are available from the avatar menu.
- Added a compact avatar menu with Profile, Settings, Notifications and Sign out.
- Added a Profile page showing stored account information available from the authenticated account response.
- Added a lightweight Notifications page for account/workspace notifications.

### Authentication
- Added **Continue with Google** to account creation.
- Existing Google OAuth backend route is reused; no duplicate OAuth implementation is introduced.

### Favicon / branding
- Replaced the old favicon with a clean favicon generated from the icon used in the current TAMPtools Purple Gold logo.
- All HTML pages now reference `/favicon.png?v=22` for cache-busting.

### WhatsApp support
- Added public `/api/support` configuration endpoint used by the support page.
- `WHATSAPP_SUPPORT_NUMBER` is normalized to digits and accepts a number-only value or a wa.me URL.
- Canonical `.env` value should be the international number only, including country code, e.g. `2348012345678`.
- The backend builds the WhatsApp URL as `https://wa.me/<number>`.

### Dashboard / visual system
- Reworked the main dashboard into a focused, minimalist layout.
- Removed decorative dashboard sections that created visual density.
- Reduced card shadows, padding and visual noise while keeping work-area access, search, usage, storage, recent work, saved work and plan information.
- Added minimalist styling for profile and notification pages.

## Validation
- `node --check frontend/app.js` — passed.
- `node --check backend/src/server.js` — passed.
- Favicon generated from the approved current logo icon.
- Full live HTTP/runtime testing should be performed against the user's already-installed local dependencies and environment because this source checkpoint does not include `node_modules` or production credentials.
