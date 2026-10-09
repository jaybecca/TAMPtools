import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const backend = path.resolve(here, "..");
const project = path.resolve(backend, "..");
const frontend = path.join(project, "frontend");
let failures = 0;
const ok = m => console.log(`✓ ${m}`);
const fail = m => { failures++; console.log(`✗ ${m}`); };
const exists = p => fs.existsSync(p);

console.log("TAMPtools Phase 1B foundation verification\n");

for (const file of [
  "package.json", ".nvmrc", "docs/SOURCE-AUDIT.md", "docs/ARCHITECTURE.md",
  "docs/LEGACY-MIGRATION.md", "backend/package.json", "backend/src/server.js",
  "backend/src/db/database.js", "backend/src/platform/canonical-config.js",
  "backend/src/ai-provider.js", "backend/src/entitlements.js", "backend/src/storage.js",
  "backend/src/audit.js", "frontend/index.html", "frontend/app.js", "frontend/styles.css"
]) exists(path.join(project, file)) ? ok(`Required foundation file: ${file}`) : fail(`Missing foundation file: ${file}`);

const pkg = JSON.parse(fs.readFileSync(path.join(project, "package.json"), "utf8"));
pkg.scripts?.dev && pkg.scripts?.check ? ok("Root development/check scripts: present") : fail("Root development/check scripts: missing");

const canonical = await import("./platform/canonical-config.js");
canonical.PLATFORM.groups.length === 8 ? ok("Canonical product groups: 8") : fail(`Canonical product groups: expected 8, found ${canonical.PLATFORM.groups.length}`);
canonical.CANONICAL_TOOLS.length === 15 ? ok("Canonical primary tools: 15") : fail(`Canonical primary tools: expected 15, found ${canonical.CANONICAL_TOOLS.length}`);
canonical.PRODUCT_BOUNDARIES.socialPublishing === false ? ok("Social publishing excluded from core boundary") : fail("Social publishing boundary is incorrect");

const jsFiles = [];
function walk(dir) {
  if (!exists(dir)) return;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory() && !["node_modules", ".git"].includes(entry.name)) walk(full);
    else if (entry.isFile() && full.endsWith(".js")) jsFiles.push(full);
  }
}
walk(backend); walk(frontend);
for (const file of jsFiles) {
  const result = spawnSync(process.execPath, ["--check", file], { encoding: "utf8" });
  if (result.status === 0) ok(`JavaScript syntax: ${path.relative(project, file)}`);
  else fail(`JavaScript syntax: ${path.relative(project, file)} — ${(result.stderr || result.stdout || "syntax error").trim()}`);
}

const db = fs.readFileSync(path.join(backend, "src/db/database.js"), "utf8");
const sqliteSchema = fs.readFileSync(path.join(backend, "src/db/database-sqlite.js"), "utf8");
const postgresSchema = fs.readFileSync(path.join(backend, "src/db/postgres-schema.sql"), "utf8");
const databaseSources = db + sqliteSchema + postgresSchema;
for (const marker of ["CREATE TABLE IF NOT EXISTS users", "CREATE TABLE IF NOT EXISTS sessions", "CREATE TABLE IF NOT EXISTS plans", "CREATE TABLE IF NOT EXISTS subscriptions", "CREATE TABLE IF NOT EXISTS user_files", "CREATE TABLE IF NOT EXISTS jobs", "CREATE TABLE IF NOT EXISTS system_events"]) {
  databaseSources.includes(marker) ? ok(`Database foundation: ${marker.replace("CREATE TABLE IF NOT EXISTS ", "")}`) : fail(`Database foundation missing: ${marker}`);
}

console.log("\n----------------------------------------");
if (failures) {
  console.log(`FAIL: ${failures} foundation check(s) failed.`);
  process.exitCode = 1;
} else {
  console.log("PASS: Phase 1B foundation checks passed.");
}
