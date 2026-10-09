# TAMPtools Phase 34

This phase perfects the translation architecture and makes Batch Studio easier to understand and use.

## Google Translation setup
1. Enable Cloud Translation API in Google Cloud.
2. Create a restricted API key.
3. Set `GOOGLE_TRANSLATE_API_KEY="..."` on the backend only.
4. Restart TAMPtools.

The app will continue working with curated/local translations if Google Translation is not configured. When configured, missing catalog entries are translated and cached automatically.

Important: Google translation is an aid to complete the catalog, not a reason to send user-generated private documents or email content to Google automatically. The translation endpoint is authenticated and intended for controlled text translation.
