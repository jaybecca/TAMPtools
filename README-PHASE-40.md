# TAMPtools Phase 40

## Translation and Tool Reliability Repair

Phase 40 is based on Phase 39 and fixes the two audited failure classes:

- Public home-page translation now uses the same `/api/i18n` catalog as the rest of the application instead of a second hard-coded translation path.
- Missing translations can optionally be generated through the configured TAMPtools AI provider with `TRANSLATION_AI_ENABLED=1`; curated translations remain the first choice.
- Translation status now reports the real provider mode instead of referencing the unrelated Google Sign-In configuration.
- The ten Phase 39 placeholder tool workspaces now route to their existing dedicated pages or to a functional AI workspace.
- Resume, cover-letter, career/profile, content and assistant workspaces can submit a real request through `/api/assistant/chat` and display the returned result.
- ZIP, batch, storage, mail and spreadsheet tools open their existing functional surfaces instead of the dead generic workspace.

## Run

From `backend/`:

```bash
npm install
npm test
npm start
```

For automatic translation of strings not already in the curated catalog, configure an AI provider and set:

```env
TRANSLATION_AI_ENABLED=1
```

Without an AI provider, the application intentionally uses curated translations and explicit English fallback rather than silently pretending a translation occurred.
