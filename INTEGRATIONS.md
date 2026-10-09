# TAMPtools Integrations

TAMPtools remains the product. Integrations extend it; they do not replace its core tools or AI.

Suggested optional connectors: Google Workspace, Microsoft 365, Dropbox, Slack, WhatsApp Business and CRM platforms.

Integration rules:
- Core features must work without an integration.
- Tokens/secrets are stored encrypted at rest.
- Each integration uses an adapter boundary.
- Disconnecting an integration must not delete TAMPtools data.
- Third-party outages must degrade gracefully.
- Future marketplace plugins should be sandboxed and permission-scoped.
