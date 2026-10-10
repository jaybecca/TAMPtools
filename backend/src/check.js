import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const backend=path.resolve(here,'..');
const project=path.resolve(backend,'..');
const frontend=path.join(project,'frontend');
const base=(process.env.TAMPTOOLS_URL||'http://localhost:4000').replace(/\/+$/,'');
let failures=0,warnings=0;
const ok=m=>console.log(`✓ ${m}`),warn=m=>{warnings++;console.log(`⚠ ${m}`)},fail=m=>{failures++;console.log(`✗ ${m}`)};
function files(dir,ext){const out=[];function walk(d){if(!fs.existsSync(d))return;for(const e of fs.readdirSync(d,{withFileTypes:true})){if(e.isDirectory()&&['node_modules','.git'].includes(e.name))continue;const f=path.join(d,e.name);if(e.isDirectory())walk(f);else if(e.name.endsWith(ext))out.push(f)}}walk(dir);return out}
function productChecks(){
 const pkg=JSON.parse(fs.readFileSync(path.join(backend,'package.json'),'utf8'));
 pkg.version==='4.5.0'?ok('Backend version: 4.5.0'):fail(`Unexpected backend version: ${pkg.version}`);
 const db=fs.readFileSync(path.join(backend,'src/db/database.js'),'utf8');
 const sqlite=fs.existsSync(path.join(backend,'src/db/database-sqlite.js'))?fs.readFileSync(path.join(backend,'src/db/database-sqlite.js'),'utf8'):'';
 const schema=fs.readFileSync(path.join(backend,'src/db/postgres-schema.sql'),'utf8');
 for(const name of ['Free','Lite','Pro','Business']) (db+sqlite).includes(`name:"${name}"`)?ok(`Pricing plan: ${name}`):fail(`Missing pricing plan: ${name}`);
 const catalog=fs.readFileSync(path.join(backend,'src/tool-catalog.js'),'utf8');
 const count=(catalog.match(/^  \["/gm)||[]).length; count===15?ok('Canonical tool catalog: 15 primary tools'):fail(`Canonical tool catalog count: ${count}`);
 (db+sqlite+schema).includes('CREATE TABLE IF NOT EXISTS user_files')&&(db+sqlite+schema).includes('trash_path')?ok('File metadata and recovery fields: present'):fail('File metadata/recovery fields: missing');
 (db+sqlite+schema).includes('account_tokens')&&(db+sqlite+schema).includes('saved_projects')?ok('Account/project persistence: present'):fail('Account/project persistence: missing');
 (db+sqlite+schema).includes('mail_messages')&&(db+sqlite+schema).includes('mail_labels')?ok('Mail Manager persistence: present'):fail('Mail persistence: missing');
 (db+sqlite+schema).includes('business_workspaces')&&(db+sqlite+schema).includes('billing_transactions')?ok('Business/billing persistence: present'):fail('Business/billing persistence: missing');
 (db+sqlite+schema).includes('jobs')&&(db+sqlite+schema).includes('system_events')?ok('Job/system event tables: present'):fail('Job/system event tables: missing');
 (db+sqlite+schema).includes('auth_provider')&&(db+sqlite+schema).includes('auth_subject')?ok('Google-ready account identity fields: present'):fail('Google-ready identity fields: missing');
 fs.existsSync(path.join(backend,'src/db/postgres-schema.sql'))?ok('Canonical PostgreSQL schema: present'):fail('Canonical PostgreSQL schema: missing');
 fs.existsSync(path.join(backend,'src/db/README.md'))?ok('Database migration plan: present'):fail('Database migration plan: missing');
 pkg.dependencies?.pg?ok('PostgreSQL runtime driver: pg dependency present'):fail('PostgreSQL runtime driver: pg dependency missing');
 db.includes("provider === 'postgres'")?ok('PostgreSQL runtime selector: present'):fail('PostgreSQL runtime selector: missing');
 fs.existsSync(path.join(backend,'src/ai-provider.js'))?ok('AI provider router: present'):fail('AI provider router: missing');
 fs.existsSync(path.join(backend,'src/payments.js'))?ok('Payment adapter: present'):fail('Payment adapter: missing');
 fs.existsSync(path.join(backend,'src/oauth.js'))?ok('OAuth foundation: present'):fail('OAuth foundation: missing');
}
function staticChecks(){
 console.log('Static project checks');
 const backendFiles=['package.json','src/server.js','src/db/database.js','src/check.js','src/check-api.js','src/locale.js','src/entitlements.js','src/audit.js','src/ai-provider.js','src/email-provider.js','src/reports.js','src/storage.js','src/payments.js','src/oauth.js','src/integrations.js','src/tool-catalog.js'];
 for(const f of backendFiles)fs.existsSync(path.join(backend,f))?ok(`Backend file: ${f}`):fail(`Missing backend file: ${f}`);
 const frontFiles=['index.html','signin.html','signup.html','change-password.html','forgot-password.html','reset-password.html','verify-email.html','dashboard.html','settings.html','workspace.html','files.html','mail-manager.html','spreadsheet-studio.html','billing.html','styles.css','app.js','workspace.js','files.js','mail-manager.js','spreadsheet-studio.js','billing.js','admin.html','admin.js','logo.png','favicon.png'];
 for(const f of frontFiles)fs.existsSync(path.join(frontend,f))?ok(`Frontend file: ${f}`):fail(`Missing frontend file: ${f}`);
 if(fs.existsSync(path.join(frontend,'tools')))fail('Legacy frontend/tools directory still exists'); else ok('Legacy standalone tools directory removed');
 for(const f of ['campaign-studio.html','campaign-studio.js'])fs.existsSync(path.join(frontend,f))?fail(`Legacy campaign file remains: ${f}`):ok(`Legacy campaign file removed: ${f}`);
 for(const f of ['social.js','publisher.js','campaigns.js'])fs.existsSync(path.join(backend,'src',f))?fail(`Legacy backend module remains: ${f}`):ok(`Legacy backend module removed: ${f}`);
}
function syntax(){console.log('\nJavaScript syntax checks');for(const f of [...files(backend,'.js'),...files(frontend,'.js')]){const r=spawnSync(process.execPath,['--check',f],{encoding:'utf8'});const rel=path.relative(project,f);r.status===0?ok(`JavaScript syntax: ${rel}`):fail(`JavaScript syntax: ${rel} — ${(r.stderr||r.stdout||'syntax error').trim().split('\n').slice(-2).join(' ')}`)}}

function serverRouteExists(ref){
 const source=fs.readFileSync(path.join(backend,'src/server.js'),'utf8');
 const routeDecl=/app\.(get|all)\s*\(\s*(['"])([^'"]+)\2/g;
 let m;
 while((m=routeDecl.exec(source))){
  const pattern='^'+m[3].split('/').map(part=>
   part.startsWith(':')?'[^/]+':part.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')
  ).join('/')+'/?$';
  if(new RegExp(pattern).test(ref))return true;
 }
 return false;
}
function refs(){console.log('\nHTML local-reference checks');const attr=/\b(?:src|href)=['"]([^'"]+)['"]/gi;for(const f of files(frontend,'.html')){const html=fs.readFileSync(f,'utf8');let m;while((m=attr.exec(html))){let ref=m[1].split('?')[0].split('#')[0];if(!ref||ref.includes('${')||ref.startsWith('#')||/^(?:https?:)?\/\//i.test(ref)||/^(?:mailto:|tel:|data:|javascript:)/i.test(ref))continue;const candidate=ref.startsWith('/')?path.join(frontend,ref.slice(1)):path.resolve(path.dirname(f),ref);if(fs.existsSync(candidate))ok(`HTML reference: ${path.relative(frontend,f)} → ${ref}`);else if(ref.startsWith('/api/')&&serverRouteExists(ref))ok(`HTML server route: ${path.relative(frontend,f)} → ${ref}`);else if(ref.startsWith('/api/')||(!path.extname(ref)&&ref.startsWith('/')))warn(`Server route not checked statically: ${path.relative(frontend,f)} → ${ref}`);else fail(`Missing HTML reference: ${path.relative(frontend,f)} → ${ref}`)}}}
async function live(){console.log('\nLive checks');try{const h=await fetch(`${base}/api/health`);if(!h.ok)throw Error(`HTTP ${h.status}`)}catch{warn(`Live checks skipped: ${base} is not running. Start with npm run dev.`);return}for(const route of ['/','/index.html','/signup.html','/signin.html','/dashboard.html']){try{const r=await fetch(base+route,{redirect:'manual'});if(route==='/dashboard.html'&&[302,303].includes(r.status))ok(`Protected page ${route}: redirects to sign-in`);else if(r.ok)ok(`Frontend page ${route}: HTTP ${r.status}`);else fail(`Frontend page ${route}: HTTP ${r.status}`)}catch(e){fail(`Frontend page ${route}: ${e.message}`)}}for(const a of ['/styles.css','/app.js','/workspace.js','/logo.png','/favicon.png']){try{const r=await fetch(base+a);r.ok?ok(`Frontend asset ${a}: HTTP ${r.status}`):fail(`Frontend asset ${a}: HTTP ${r.status}`)}catch(e){fail(`Frontend asset ${a}: ${e.message}`)}}for(const a of ['/api/health','/api/plans','/api/tools','/api/locale','/api/integrations/status','/api/payments/providers']){try{const r=await fetch(base+a);r.ok?ok(`API ${a}: HTTP ${r.status}`):fail(`API ${a}: HTTP ${r.status}`)}catch(e){fail(`API ${a}: ${e.message}`)}}}
staticChecks();productChecks();syntax();refs();await live();console.log('\n----------------------------------------');console.log(failures?`FAIL: ${failures} failure(s), ${warnings} warning(s).`:`PASS: 0 failures, ${warnings} warning(s).`);process.exitCode=failures?1:0;
