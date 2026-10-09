/**
 * Canonical Phase 1B product map.
 *
 * This is deliberately separate from the legacy tool-catalog.js so Phase 1B
 * can document the final product architecture without breaking existing
 * endpoints that still use legacy tool keys.
 */
export const PLATFORM = Object.freeze({
  name: "TAMPtools",
  foundation: "1B",
  tagline: "Your digital operations base",
  groups: Object.freeze([
    { key: "mail", name: "Mail", tool: "mail-manager" },
    { key: "images", name: "Images", tool: "image-studio" },
    { key: "documents", name: "Documents & PDF", tool: "document-pdf-studio" },
    { key: "files", name: "Files & Storage", tools: ["storage-manager", "zip-file-toolkit"] },
    { key: "batch", name: "Batch", tool: "batch-studio" },
    { key: "business", name: "Business & Generators", tools: ["invoice-generator", "proposal-builder", "qr-code-generator", "spreadsheet-data-cleaner"] },
    { key: "career-content", name: "Career & Content", tools: ["resume-builder", "cover-letter-builder", "career-profile-writer", "content-studio"] },
    { key: "ai", name: "AI", tool: "tamp-assistant" }
  ]),
  admin: "admin-console"
});

export const CANONICAL_TOOLS = Object.freeze([
  "mail-manager",
  "image-studio",
  "document-pdf-studio",
  "storage-manager",
  "zip-file-toolkit",
  "batch-studio",
  "invoice-generator",
  "proposal-builder",
  "qr-code-generator",
  "spreadsheet-data-cleaner",
  "resume-builder",
  "cover-letter-builder",
  "career-profile-writer",
  "content-studio",
  "tamp-assistant"
]);

export const PRODUCT_BOUNDARIES = Object.freeze({
  socialAccountManagement: false,
  socialScheduling: false,
  socialPublishing: false,
  socialAnalytics: false,
  blogWriting: true,
  websiteContent: true,
  emailWriting: true,
  linkedinProfileText: true,
  batchProcessingSharedCapability: true
});
