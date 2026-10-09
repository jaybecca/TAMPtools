import 'dotenv/config';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
let Pool;

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const provider = String(process.env.DB_PROVIDER || 'sqlite').toLowerCase();

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

function normalizeSql(sql) {
  let out = String(sql);
  let index = 0;
  let result = '';
  let quote = null;
  for (let i = 0; i < out.length; i++) {
    const ch = out[i];
    if (quote) {
      result += ch;
      if (ch === quote && out[i + 1] === quote) { result += out[++i]; continue; }
      if (ch === quote) quote = null;
      continue;
    }
    if (ch === "'" || ch === '"' || ch === '`') { quote = ch; result += ch; continue; }
    if (ch === '?') { result += `$${++index}`; continue; }
    result += ch;
  }
  const ignoreInsert = /INSERT\s+OR\s+IGNORE\s+INTO/i.test(result);
  result = result
    .replace(/INSERT\s+OR\s+IGNORE\s+INTO/gi, 'INSERT INTO')
    .replace(/datetime\('now'\s*,\s*'start of month'\)/gi, "date_trunc('month', CURRENT_TIMESTAMP)")
    .replace(/datetime\('now'\s*,\s*'([+-]\d+)\s+(seconds?|minutes?|hours?|days?)'\)/gi, (_, n, unit) => `CURRENT_TIMESTAMP ${Number(n) >= 0 ? '+' : '-'} INTERVAL '${Math.abs(Number(n))} ${unit}'`)
    .replace(/datetime\('now'\)/gi, 'CURRENT_TIMESTAMP')
    .replace(/\bIS\s+(\$\d+)\b/gi, 'IS NOT DISTINCT FROM $1');
  if (ignoreInsert && !/\bON\s+CONFLICT\b/i.test(result)) result += ' ON CONFLICT DO NOTHING';
  return result;
}

function normalizeRow(row) {
  if (!row) return row;
  const out = {};
  for (const [k, v] of Object.entries(row)) out[k] = v instanceof Date ? v.toISOString().replace('T', ' ').replace('Z', '') : v;
  return out;
}

function normalizeRows(rows) { return rows.map(normalizeRow); }

function buildArgs(args) {
  if (args.length === 1 && Array.isArray(args[0])) return args[0];
  return args;
}

function pgStatement(pool, sql) {
  const text = normalizeSql(sql);
  return {
    async get(...args) {
      const r = await pool.query(text, buildArgs(args));
      return normalizeRow(r.rows[0]);
    },
    async all(...args) {
      const r = await pool.query(text, buildArgs(args));
      return normalizeRows(r.rows);
    },
    async run(...args) {
      let query = text;
      if (/^\s*INSERT\s+INTO\s/i.test(query) && !/\bRETURNING\b/i.test(query)) query += ' RETURNING id';
      const r = await pool.query(query, buildArgs(args));
      return { changes: r.rowCount, lastInsertRowid: r.rows?.[0]?.id ?? null };
    }
  };
}

async function createPostgres() {
  ({ Pool } = await import('pg'));
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error('DB_PROVIDER=postgres requires DATABASE_URL.');
  const pool = new Pool({
    connectionString,
    max: Number(process.env.DB_POOL_MAX || 10),
    ssl: process.env.DB_SSL === 'false' ? false : { rejectUnauthorized: false },
    connectionTimeoutMillis: Number(process.env.DB_CONNECTION_TIMEOUT_MS || 10000),
    statement_timeout: Number(process.env.DB_STATEMENT_TIMEOUT_MS || 5000)
  });

  const schemaPath = path.join(__dirname, 'postgres-schema.sql');
  const schema = await fs.readFile(schemaPath, 'utf8');
  // The canonical schema is intentionally PostgreSQL-native, while keeping JSON/toggle fields
  // text/integer-compatible with the existing application SQL during this migration.
  await pool.query(schema);

  const planRows = [
    { name:'Free', usd:0, gbp:0, ngn:0, monthlyUses:30, sortOrder:1, features:{tools:'All',spreadsheetRows:5000,spreadsheetFileMb:25,spreadsheetSheets:1,spreadsheetSmartDedupe:false,spreadsheetAudit:false,spreadsheetAi:false,spreadsheetMultiSheet:false,qrCodes:10,imageOps:10,backgroundRemoval:5,pdfOps:10,pdfMaxFiles:3,pdfMaxMb:25,pdfAdvanced:false,batchJobs:5,batchFiles:10,aiGenerations:20,resumeProjects:2,coverLetterProjects:2,proposals:2,invoices:5,storageMb:500,mailMonthly:250,teamMembers:1,analytics:'Basic',prioritySupport:false}},
    { name:'Lite', usd:1.5, gbp:1.2, ngn:1500, monthlyUses:250, sortOrder:2, prices:{NGN:{monthly:1500,yearly:15000},USD:{monthly:1.5,yearly:18},GBP:{monthly:1.2,yearly:14.4}}, features:{tools:'All',spreadsheetRows:25000,spreadsheetFileMb:50,spreadsheetSheets:5,spreadsheetSmartDedupe:false,spreadsheetAudit:true,spreadsheetAi:false,spreadsheetMultiSheet:true,qrCodes:10,imageOps:100,backgroundRemoval:50,pdfOps:100,pdfMaxFiles:10,pdfMaxMb:100,pdfAdvanced:true,batchJobs:30,batchFiles:50,aiGenerations:150,resumeProjects:10,coverLetterProjects:10,proposals:20,invoices:50,storageMb:5120,mailMonthly:2000,teamMembers:1,analytics:'Basic',prioritySupport:false}},
    { name:'Pro', usd:5, gbp:4, ngn:5000, monthlyUses:2500, sortOrder:3, prices:{NGN:{monthly:5000,yearly:50000},USD:{monthly:5,yearly:60},GBP:{monthly:4,yearly:48}}, features:{tools:'All',spreadsheetRows:100000,spreadsheetFileMb:100,spreadsheetSheets:20,spreadsheetSmartDedupe:true,spreadsheetAudit:true,spreadsheetAi:true,spreadsheetMultiSheet:true,qrCodes:10,imageOps:1000,backgroundRemoval:500,pdfOps:1000,pdfMaxFiles:20,pdfMaxMb:500,pdfAdvanced:true,batchJobs:200,batchFiles:500,aiGenerations:1000,resumeProjects:'All',coverLetterProjects:'All',proposals:'All',invoices:'All',storageMb:51200,mailMonthly:20000,teamMembers:1,protectedArchives:true,advancedMail:true,workflowAutomation:true,prioritySupport:true}},
    { name:'Business', usd:15, gbp:12, ngn:15000, monthlyUses:10000, sortOrder:4, prices:{NGN:{monthly:15000,yearly:150000},USD:{monthly:15,yearly:180},GBP:{monthly:12,yearly:144}}, features:{tools:'All',spreadsheetRows:250000,spreadsheetFileMb:250,spreadsheetSheets:50,spreadsheetSmartDedupe:true,spreadsheetAudit:true,spreadsheetAi:true,spreadsheetMultiSheet:true,qrCodes:'Fair-use',imageOps:'Fair-use',backgroundRemoval:'Fair-use',pdfOps:'Fair-use',pdfMaxFiles:50,pdfMaxMb:500,pdfAdvanced:true,batchJobs:'Fair-use',batchFiles:500,aiGenerations:'Fair-use',resumeProjects:'All',coverLetterProjects:'All',proposals:'All',invoices:'All',storageMb:512000,mailMonthly:'Fair-use',teamMembers:25,sharedWorkspace:true,teamProjects:true,adminControls:true,usageAnalytics:true,centralBilling:true,sharedTemplates:true,businessWorkflows:true,apiAccess:true,auditLogs:true,prioritySupport:true}}
  ];
  for (const p of planRows) {
    await pool.query(`INSERT INTO plans (name,usd,gbp,ngn,prices_json,monthly_uses,features_json,active,sort_order,updated_at)
      VALUES ($1,$2,$3,$4,$5,$6,$7,1,$8,CURRENT_TIMESTAMP)
      ON CONFLICT(name) DO UPDATE SET usd=EXCLUDED.usd,gbp=EXCLUDED.gbp,ngn=EXCLUDED.ngn,prices_json=EXCLUDED.prices_json,monthly_uses=EXCLUDED.monthly_uses,features_json=EXCLUDED.features_json,active=1,sort_order=EXCLUDED.sort_order,updated_at=CURRENT_TIMESTAMP`,
      [p.name,p.usd,p.gbp,p.ngn,JSON.stringify(p.prices||{}),p.monthlyUses,JSON.stringify(p.features),p.sortOrder]);
  }
  await pool.query("UPDATE plans SET active=0 WHERE name NOT IN ('Free','Lite','Pro','Business')");
  return pool;
}

let pool = null;
let sqliteDb = null;
if (provider === 'postgres') {
  pool = await createPostgres();
} else {
  const mod = await import('./database-sqlite.js');
  sqliteDb = mod.db;
}

export const db = provider === 'postgres'
  ? {
      prepare(sql) { return pgStatement(pool, sql); },
      async health() { await pool.query('SELECT 1'); return true; },
      async close() { await pool.end(); }
    }
  : sqliteDb;


const DEFAULT_AI_RATES = [
  ['openai', process.env.OPENAI_TEXT_MODEL || 'gpt-4o-mini', 0.25, 2.00, 0],
  ['gemini', process.env.GEMINI_TEXT_MODEL || 'gemini-2.0-flash', 0.10, 0.40, 0],
  ['claude', process.env.CLAUDE_TEXT_MODEL || 'claude-3-5-haiku-latest', 0.80, 4.00, 0]
];
for (const [p,m,i,o,img] of DEFAULT_AI_RATES) {
  try { await db.prepare('INSERT OR IGNORE INTO ai_provider_rates(provider,model,input_cost_per_million,output_cost_per_million,image_cost,active) VALUES(?,?,?,?,?,1)').run(p,m,i,o,img); } catch {}
}

export const dbProvider = provider;
