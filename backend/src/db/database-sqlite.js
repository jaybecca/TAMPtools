import { DatabaseSync } from "node:sqlite";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.resolve(__dirname, "../../data");
const dbPath = path.join(dataDir, "tamptools.db");
fs.mkdirSync(dataDir, { recursive: true });

export const db = new DatabaseSync(dbPath);
db.exec("PRAGMA foreign_keys = ON;");

const hasColumn = (table, column) => db.prepare(`PRAGMA table_info(${table})`).all().some(row => row.name === column);
const addColumn = (table, column, definition) => {
  if (!hasColumn(table, column)) db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
};

db.exec(`
  CREATE TABLE IF NOT EXISTS oauth_identities (
    id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL, provider TEXT NOT NULL, subject TEXT NOT NULL, email TEXT, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, UNIQUE(provider, subject), FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS integration_secrets (id INTEGER PRIMARY KEY AUTOINCREMENT, secret_key TEXT NOT NULL UNIQUE, provider TEXT NOT NULL, encrypted_value TEXT NOT NULL, metadata_json TEXT NOT NULL DEFAULT '{}', created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, last_used_at TEXT);

  CREATE TABLE IF NOT EXISTS ai_providers (
    id INTEGER PRIMARY KEY AUTOINCREMENT, provider TEXT NOT NULL, model TEXT NOT NULL, base_url TEXT, api_key TEXT, secret_ref TEXT, priority INTEGER NOT NULL DEFAULT 1, cost REAL NOT NULL DEFAULT 0, enabled INTEGER NOT NULL DEFAULT 0, routing_json TEXT NOT NULL DEFAULT '{}', created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, UNIQUE(provider,model)
  );

  CREATE TABLE IF NOT EXISTS assistant_conversations (
    id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL, title TEXT NOT NULL DEFAULT 'New conversation', messages_json TEXT NOT NULL DEFAULT '[]', created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS assistant_jobs (
    id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL, command TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'queued', plan_json TEXT NOT NULL DEFAULT '{}', result_json TEXT NOT NULL DEFAULT '{}', progress INTEGER NOT NULL DEFAULT 0, error TEXT, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    plan TEXT NOT NULL DEFAULT 'Free',
    trial_started_at TEXT,
    trial_ends_at TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    token_hash TEXT NOT NULL UNIQUE,
    user_id INTEGER NOT NULL,
    expires_at TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS plans (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    usd REAL NOT NULL,
    gbp REAL NOT NULL,
    ngn REAL NOT NULL,
    prices_json TEXT NOT NULL DEFAULT '{}',
    monthly_uses INTEGER,
    features_json TEXT NOT NULL DEFAULT '{}',
    scheduling_days INTEGER,
    batch_posts INTEGER,
    active INTEGER NOT NULL DEFAULT 1,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS subscriptions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    plan_id INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'inactive',
    provider TEXT,
    provider_reference TEXT,
    current_period_start TEXT,
    current_period_end TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (plan_id) REFERENCES plans(id)
  );

  CREATE TABLE IF NOT EXISTS usage_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    tool_key TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS ai_provider_rates (id INTEGER PRIMARY KEY AUTOINCREMENT, provider TEXT NOT NULL, model TEXT NOT NULL, input_cost_per_million REAL NOT NULL DEFAULT 0, output_cost_per_million REAL NOT NULL DEFAULT 0, image_cost REAL NOT NULL DEFAULT 0, active INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, UNIQUE(provider,model));
  CREATE TABLE IF NOT EXISTS ai_usage_events (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL, operation TEXT NOT NULL, units INTEGER NOT NULL DEFAULT 1, source TEXT NOT NULL DEFAULT 'included', credits INTEGER NOT NULL DEFAULT 0, provider TEXT, model TEXT, input_tokens INTEGER NOT NULL DEFAULT 0, output_tokens INTEGER NOT NULL DEFAULT 0, image_units REAL NOT NULL DEFAULT 0, provider_cost_usd REAL NOT NULL DEFAULT 0, estimated_credits INTEGER NOT NULL DEFAULT 0, charged_credits INTEGER NOT NULL DEFAULT 0, status TEXT NOT NULL DEFAULT 'completed', error TEXT, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE);
  CREATE TABLE IF NOT EXISTS i18n_translations (id INTEGER PRIMARY KEY AUTOINCREMENT, language TEXT NOT NULL, source_key TEXT NOT NULL, source_text TEXT NOT NULL, translated_text TEXT NOT NULL, provider TEXT NOT NULL DEFAULT 'local', created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, UNIQUE(language,source_key));

  CREATE TABLE IF NOT EXISTS user_files (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    tool_key TEXT,
    filename TEXT NOT NULL,
    storage_path TEXT NOT NULL,
    mime_type TEXT,
    size_bytes INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );
`);

// Migrations for Phase 3.4 and older Phase 3 databases.
addColumn("users", "trial_started_at", "TEXT");
addColumn("users", "language", "TEXT DEFAULT 'en'");
addColumn("users", "currency", "TEXT DEFAULT 'USD'");
addColumn("users", "country_code", "TEXT");
addColumn("users", "email_verified_at", "TEXT");
addColumn("users", "auth_provider", "TEXT NOT NULL DEFAULT 'password'");
addColumn("users", "auth_subject", "TEXT");
addColumn("users", "trial_ends_at", "TEXT");
addColumn("plans", "features_json", "TEXT NOT NULL DEFAULT '{}'");
addColumn("plans", "scheduling_days", "INTEGER");
addColumn("plans", "batch_posts", "INTEGER");
addColumn("plans", "prices_json", "TEXT NOT NULL DEFAULT '{}'");
addColumn("plans", "credit_packs_json", "TEXT NOT NULL DEFAULT '{}'");
addColumn("user_files", "folder_path", "TEXT NOT NULL DEFAULT ''");
addColumn("user_files", "status", "TEXT NOT NULL DEFAULT 'ready'");
addColumn("user_files", "sha256", "TEXT");
addColumn("user_files", "is_temp", "INTEGER NOT NULL DEFAULT 0");
addColumn("user_files", "expires_at", "TEXT");
addColumn("user_files", "updated_at", "TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP");
addColumn("user_files", "deleted_at", "TEXT");
addColumn("user_files", "trash_path", "TEXT");


// Preserve existing test accounts while moving the old five-plan naming to the new five-plan model.
const oldPro = db.prepare("SELECT id FROM plans WHERE name = 'Pro'").get();
const growth = db.prepare("SELECT id FROM plans WHERE name = 'Growth'").get();
if (oldPro && !growth) {
  db.prepare("UPDATE users SET plan = 'Growth' WHERE plan = 'Pro'").run();
  db.prepare("UPDATE plans SET name = 'Growth' WHERE id = ?").run(oldPro.id);
}
else if (oldPro && growth && oldPro.id !== growth.id) {
  db.prepare("UPDATE users SET plan = 'Growth' WHERE plan = 'Pro'").run();
  db.prepare("UPDATE subscriptions SET plan_id = ? WHERE plan_id = ?").run(growth.id, oldPro.id);
  db.prepare("DELETE FROM plans WHERE id = ?").run(oldPro.id);
}

const oldUnlimited = db.prepare("SELECT id FROM plans WHERE name = 'Unlimited'").get();
const business = db.prepare("SELECT id FROM plans WHERE name = 'Business'").get();
if (oldUnlimited && business) {
  db.prepare("UPDATE users SET plan = 'Business' WHERE plan = 'Unlimited'").run();
  db.prepare("UPDATE subscriptions SET plan_id = ? WHERE plan_id = ?").run(business.id, oldUnlimited.id);
  db.prepare("DELETE FROM plans WHERE id = ?").run(oldUnlimited.id);
}

export const TRIAL_LIMITS = {
  monthlyUses: 100,
  aiText: 30,
  aiImages: 10,
  pdfOps: 20,
  invoices: 10,
  qrCodes: 10,
  spreadsheetRows: 100000, spreadsheetFileMb: 100, spreadsheetSheets: 20, spreadsheetSmartDedupe: true, spreadsheetAudit: true, spreadsheetAi: true, spreadsheetMultiSheet: true,
  storageMb: 2048
};

const planRows = [
  { name:"Free", usd:0, gbp:0, ngn:0, monthlyUses:30, sortOrder:1, features:{tools:"All",spreadsheetRows:5000,spreadsheetFileMb:25,spreadsheetSheets:1,spreadsheetSmartDedupe:false,spreadsheetAudit:false,spreadsheetAi:false,spreadsheetMultiSheet:false,qrCodes:10,imageOps:10,backgroundRemoval:5,pdfOps:10,pdfMaxFiles:3,pdfMaxMb:25,pdfAdvanced:false,batchJobs:5,batchFiles:10,aiGenerations:20,resumeProjects:2,coverLetterProjects:2,proposals:2,invoices:5,storageMb:500,mailMonthly:250,teamMembers:1,analytics:"Basic",prioritySupport:false}},
  { name:"Lite", usd:1.5, gbp:1.2, ngn:1500, monthlyUses:250, sortOrder:2, prices:{NGN:{monthly:1500,yearly:15000},USD:{monthly:1.5,yearly:18},GBP:{monthly:1.2,yearly:14.4}}, features:{tools:"All",spreadsheetRows:25000,spreadsheetFileMb:50,spreadsheetSheets:5,spreadsheetSmartDedupe:false,spreadsheetAudit:true,spreadsheetAi:false,spreadsheetMultiSheet:true,qrCodes:10,imageOps:100,backgroundRemoval:50,pdfOps:100,pdfMaxFiles:10,pdfMaxMb:100,pdfAdvanced:true,batchJobs:30,batchFiles:50,aiGenerations:150,resumeProjects:10,coverLetterProjects:10,proposals:20,invoices:50,storageMb:5120,mailMonthly:2000,teamMembers:1,analytics:"Basic",prioritySupport:false}},
  { name:"Pro", usd:5, gbp:4, ngn:5000, monthlyUses:2500, sortOrder:3, prices:{NGN:{monthly:5000,yearly:50000},USD:{monthly:5,yearly:60},GBP:{monthly:4,yearly:48}}, features:{tools:"All",spreadsheetRows:100000,spreadsheetFileMb:100,spreadsheetSheets:20,spreadsheetSmartDedupe:true,spreadsheetAudit:true,spreadsheetAi:true,spreadsheetMultiSheet:true,qrCodes:10,imageOps:1000,backgroundRemoval:500,pdfOps:1000,pdfMaxFiles:20,pdfMaxMb:500,pdfAdvanced:true,batchJobs:200,batchFiles:500,aiGenerations:1000,resumeProjects:"All",proposals:"All",invoices:"All",storageMb:51200,mailMonthly:20000,teamMembers:1,protectedArchives:true,advancedMail:true,workflowAutomation:true,prioritySupport:true}},
  { name:"Business", usd:15, gbp:12, ngn:15000, monthlyUses:10000, sortOrder:4, prices:{NGN:{monthly:15000,yearly:150000},USD:{monthly:15,yearly:180},GBP:{monthly:12,yearly:144}}, features:{tools:"All",spreadsheetRows:250000,spreadsheetFileMb:250,spreadsheetSheets:50,spreadsheetSmartDedupe:true,spreadsheetAudit:true,spreadsheetAi:true,spreadsheetMultiSheet:true,qrCodes:"Fair-use",imageOps:"Fair-use",backgroundRemoval:"Fair-use",pdfOps:"Fair-use",batchJobs:"Fair-use",batchFiles:500,aiGenerations:"Fair-use",resumeProjects:"All",proposals:"All",invoices:"All",storageMb:512000,mailMonthly:"Fair-use",teamMembers:25,sharedWorkspace:true,teamProjects:true,adminControls:true,usageAnalytics:true,centralBilling:true,sharedTemplates:true,businessWorkflows:true,apiAccess:true,auditLogs:true,prioritySupport:true}}
];

const upsert = db.prepare(`
  INSERT INTO plans (name, usd, gbp, ngn, prices_json, monthly_uses, features_json, scheduling_days, batch_posts, active, sort_order, updated_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, CURRENT_TIMESTAMP)
  ON CONFLICT(name) DO UPDATE SET
    usd=excluded.usd, gbp=excluded.gbp, ngn=excluded.ngn, prices_json=excluded.prices_json,
    monthly_uses=excluded.monthly_uses, features_json=excluded.features_json,
    scheduling_days=excluded.scheduling_days, batch_posts=excluded.batch_posts, active=1, sort_order=excluded.sort_order, updated_at=CURRENT_TIMESTAMP
`);
for (const p of planRows) upsert.run(p.name, p.usd, p.gbp, p.ngn, JSON.stringify(p.prices || {}), p.monthlyUses, JSON.stringify(p.features), p.features.schedulingDays ?? null, p.features.batchPosts ?? null, p.sortOrder);

db.prepare("UPDATE plans SET active = 0 WHERE name NOT IN ('Free','Lite','Pro','Business')").run();
// Phase 15 plan migration: Starter/Growth become Lite/Pro while preserving existing subscriptions.
const starterPlan=db.prepare("SELECT id FROM plans WHERE name='Starter'").get();
const litePlan=db.prepare("SELECT id FROM plans WHERE name='Lite'").get();
if(starterPlan && litePlan){ db.prepare("UPDATE subscriptions SET plan_id=? WHERE plan_id=?").run(litePlan.id,starterPlan.id); db.prepare("UPDATE users SET plan='Lite' WHERE plan='Starter'").run(); db.prepare("DELETE FROM plans WHERE id=?").run(starterPlan.id); }
const growthPlan=db.prepare("SELECT id FROM plans WHERE name='Growth'").get();
if(growthPlan){ const proPlan=db.prepare("SELECT id FROM plans WHERE name='Pro'").get(); db.prepare("UPDATE subscriptions SET plan_id=? WHERE plan_id=?").run(proPlan.id,growthPlan.id); db.prepare("UPDATE users SET plan='Pro' WHERE plan='Growth'").run(); db.prepare("DELETE FROM plans WHERE id=?").run(growthPlan.id); }


// Any existing user without trial dates gets the same 30-day introductory window based on account creation.
const legacyUsers = db.prepare("SELECT id, created_at AS createdAt FROM users WHERE trial_started_at IS NULL OR trial_ends_at IS NULL").all();
const updateTrial = db.prepare("UPDATE users SET trial_started_at = ?, trial_ends_at = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?");
for (const user of legacyUsers) {
  const start = new Date(String(user.createdAt).replace(" ", "T") + "Z");
  const end = new Date(start.getTime() + 30 * 24 * 60 * 60 * 1000);
  updateTrial.run(start.toISOString().replace("T", " ").replace("Z", ""), end.toISOString().replace("T", " ").replace("Z", ""), user.id);
}

// Phase 2: account verification, password recovery, credits and saved projects.
db.exec(`
  CREATE TABLE IF NOT EXISTS account_tokens (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    token_hash TEXT NOT NULL UNIQUE,
    token_type TEXT NOT NULL CHECK(token_type IN ('email_verification','password_reset')),
    expires_at TEXT NOT NULL,
    used_at TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );
  CREATE TABLE IF NOT EXISTS credit_ledger (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    amount INTEGER NOT NULL,
    reason TEXT NOT NULL,
    reference TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );
  CREATE TABLE IF NOT EXISTS saved_projects (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    tool_key TEXT,
    project_type TEXT,
    metadata_json TEXT NOT NULL DEFAULT '{}',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS business_workspaces (
    id INTEGER PRIMARY KEY AUTOINCREMENT, owner_user_id INTEGER NOT NULL, name TEXT NOT NULL, seats INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY(owner_user_id) REFERENCES users(id) ON DELETE CASCADE
  );
  CREATE TABLE IF NOT EXISTS business_members (
    id INTEGER PRIMARY KEY AUTOINCREMENT, workspace_id INTEGER NOT NULL, user_id INTEGER, email TEXT NOT NULL, role TEXT NOT NULL DEFAULT 'member', status TEXT NOT NULL DEFAULT 'invited', created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, UNIQUE(workspace_id,email), FOREIGN KEY(workspace_id) REFERENCES business_workspaces(id) ON DELETE CASCADE, FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE SET NULL
  );
  CREATE TABLE IF NOT EXISTS storage_addons (
    id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL, gb INTEGER NOT NULL, amount_ngn REAL NOT NULL, status TEXT NOT NULL DEFAULT 'active', provider TEXT, provider_reference TEXT, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
  );
  CREATE TABLE IF NOT EXISTS billing_transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL, kind TEXT NOT NULL, amount REAL NOT NULL DEFAULT 0, currency TEXT NOT NULL DEFAULT 'NGN', status TEXT NOT NULL DEFAULT 'pending', provider TEXT, provider_reference TEXT, description TEXT, metadata_json TEXT NOT NULL DEFAULT '{}', created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
  );
  CREATE TABLE IF NOT EXISTS referral_credits (
    id INTEGER PRIMARY KEY AUTOINCREMENT, referrer_user_id INTEGER NOT NULL, referred_user_id INTEGER, code TEXT NOT NULL UNIQUE, reward INTEGER NOT NULL DEFAULT 0, status TEXT NOT NULL DEFAULT 'pending', created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY(referrer_user_id) REFERENCES users(id) ON DELETE CASCADE, FOREIGN KEY(referred_user_id) REFERENCES users(id) ON DELETE SET NULL
  );
  CREATE TABLE IF NOT EXISTS student_offers (
    id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL UNIQUE, status TEXT NOT NULL DEFAULT 'pending', proof_reference TEXT, discount_percent REAL NOT NULL DEFAULT 30, expires_at TEXT, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
  );
`);
// Existing accounts are treated as verified because verification was not part of the earlier account model.
db.prepare("UPDATE users SET email_verified_at = COALESCE(email_verified_at, created_at), auth_provider = COALESCE(auth_provider, 'password')").run();
db.exec("CREATE UNIQUE INDEX IF NOT EXISTS idx_users_auth_identity ON users(auth_provider, auth_subject) WHERE auth_subject IS NOT NULL");

// Phase 4.4: promotions, durable jobs and operational hardening tables.
db.exec(`
  CREATE TABLE IF NOT EXISTS promotions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    code TEXT NOT NULL UNIQUE,
    discount_type TEXT NOT NULL CHECK(discount_type IN ('percent','fixed')),
    discount_value REAL NOT NULL CHECK(discount_value >= 0),
    currency TEXT,
    starts_at TEXT,
    ends_at TEXT,
    max_redemptions INTEGER,
    redemption_count INTEGER NOT NULL DEFAULT 0,
    new_customers_only INTEGER NOT NULL DEFAULT 0,
    recurring_cycles INTEGER,
    plan_names_json TEXT NOT NULL DEFAULT '[]',
    countries_json TEXT NOT NULL DEFAULT '[]',
    active INTEGER NOT NULL DEFAULT 1,
    created_by INTEGER,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS promotion_redemptions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    promotion_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    subscription_id INTEGER,
    provider TEXT,
    provider_reference TEXT,
    redeemed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(promotion_id,user_id),
    FOREIGN KEY (promotion_id) REFERENCES promotions(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );
  CREATE TABLE IF NOT EXISTS jobs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    type TEXT NOT NULL,
    payload_json TEXT NOT NULL DEFAULT '{}',
    status TEXT NOT NULL DEFAULT 'queued',
    attempts INTEGER NOT NULL DEFAULT 0,
    max_attempts INTEGER NOT NULL DEFAULT 5,
    available_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    locked_at TEXT,
    completed_at TEXT,
    last_error TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS system_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    level TEXT NOT NULL DEFAULT 'info',
    component TEXT NOT NULL,
    message TEXT NOT NULL,
    metadata_json TEXT NOT NULL DEFAULT '{}',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
`);

// Phase 4 production foundation tables.
db.exec(`
  CREATE TABLE IF NOT EXISTS payment_customers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    provider TEXT NOT NULL,
    customer_reference TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, provider),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );
  CREATE TABLE IF NOT EXISTS payment_support_tickets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    provider TEXT,
    transaction_reference TEXT,
    issue_type TEXT NOT NULL,
    subject TEXT NOT NULL,
    message TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'open',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );
  CREATE TABLE IF NOT EXISTS payment_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    provider TEXT NOT NULL,
    event_id TEXT NOT NULL UNIQUE,
    event_type TEXT NOT NULL,
    payload_json TEXT NOT NULL,
    processed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS audit_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    action TEXT NOT NULL,
    metadata_json TEXT NOT NULL DEFAULT '{}',
    ip_address TEXT,
    user_agent TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
  );
  CREATE TABLE IF NOT EXISTS mail_connections (
    id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL, provider TEXT NOT NULL, account_email TEXT,
    status TEXT NOT NULL DEFAULT 'import', settings_json TEXT NOT NULL DEFAULT '{}', created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, UNIQUE(user_id, provider, account_email), FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );
  CREATE TABLE IF NOT EXISTS mail_messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL, connection_id INTEGER, message_uid TEXT,
    sender_name TEXT, sender_email TEXT, recipients_json TEXT NOT NULL DEFAULT '[]', subject TEXT NOT NULL DEFAULT '',
    body_text TEXT NOT NULL DEFAULT '', body_html TEXT, sent_at TEXT, has_attachments INTEGER NOT NULL DEFAULT 0,
    attachment_names_json TEXT NOT NULL DEFAULT '[]', folder_name TEXT NOT NULL DEFAULT 'Inbox', is_read INTEGER NOT NULL DEFAULT 0,
    is_starred INTEGER NOT NULL DEFAULT 0, is_flagged INTEGER NOT NULL DEFAULT 0, is_archived INTEGER NOT NULL DEFAULT 0,
    content_hash TEXT, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE, FOREIGN KEY (connection_id) REFERENCES mail_connections(id) ON DELETE SET NULL
  );
  CREATE INDEX IF NOT EXISTS idx_mail_messages_user ON mail_messages(user_id, sent_at);
  CREATE INDEX IF NOT EXISTS idx_mail_messages_hash ON mail_messages(user_id, content_hash);
  CREATE TABLE IF NOT EXISTS mail_labels (
    id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL, name TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id,name), FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );
  CREATE TABLE IF NOT EXISTS mail_message_labels (
    message_id INTEGER NOT NULL, label_id INTEGER NOT NULL, PRIMARY KEY(message_id,label_id),
    FOREIGN KEY(message_id) REFERENCES mail_messages(id) ON DELETE CASCADE, FOREIGN KEY(label_id) REFERENCES mail_labels(id) ON DELETE CASCADE
  );
  CREATE TABLE IF NOT EXISTS report_runs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    report_type TEXT NOT NULL,
    period_from TEXT,
    period_to TEXT,
    result_json TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );
  CREATE TABLE IF NOT EXISTS oauth_states (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    provider TEXT NOT NULL,
    state_hash TEXT NOT NULL UNIQUE,
    code_verifier TEXT,
    redirect_uri TEXT NOT NULL,
    expires_at TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );
  CREATE TABLE IF NOT EXISTS ads (
    id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT NOT NULL, image_url TEXT NOT NULL,
    target_url TEXT, alt_text TEXT NOT NULL DEFAULT 'TAMPtools advertisement',
    width INTEGER NOT NULL DEFAULT 1200, height INTEGER NOT NULL DEFAULT 300,
    active INTEGER NOT NULL DEFAULT 1, created_by INTEGER,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
  );
  CREATE TABLE IF NOT EXISTS user_ad_preferences (
    user_id INTEGER NOT NULL, ad_id INTEGER NOT NULL, enabled INTEGER NOT NULL DEFAULT 1,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, PRIMARY KEY (user_id, ad_id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (ad_id) REFERENCES ads(id) ON DELETE CASCADE
  );
  CREATE TABLE IF NOT EXISTS admin_roles (
    user_id INTEGER PRIMARY KEY,
    role TEXT NOT NULL DEFAULT 'admin',
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );
`);

// Seed the configured admin email as an admin role when that account exists.
const adminEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase();
if (adminEmail) {
  const adminUser = db.prepare('SELECT id FROM users WHERE email = ?').get(adminEmail);
  if (adminUser) db.prepare("INSERT INTO admin_roles (user_id,role) VALUES (?, 'owner') ON CONFLICT(user_id) DO UPDATE SET role='owner'").run(adminUser.id);
}
