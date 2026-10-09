const CONNECTORS = [
  { key: 'google-workspace', name: 'Google Workspace', category: 'productivity', optional: true },
  { key: 'microsoft-365', name: 'Microsoft 365', category: 'productivity', optional: true },
  { key: 'dropbox', name: 'Dropbox', category: 'storage', optional: true },
  { key: 'slack', name: 'Slack', category: 'communication', optional: true },
  { key: 'whatsapp-business', name: 'WhatsApp Business', category: 'messaging', optional: true },
  { key: 'crm', name: 'CRM connectors', category: 'sales', optional: true }
];
export function integrationCatalog(){ return CONNECTORS; }
export function integrationPolicy(){ return { coreOwnedByTampTools: true, optionalConnectors: true, customerChoiceRequired: false, thirdPartyAppsDoNotReplaceCoreTools: true }; }
