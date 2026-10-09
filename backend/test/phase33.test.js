import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
const root=path.resolve(process.cwd());
test("Phase 33 economics architecture is present",()=>{
  assert.ok(fs.existsSync(path.join(root,"src/ai-economics.js")));
  const econ=fs.readFileSync(path.join(root,"src/ai-economics.js"),"utf8");
  assert.match(econ,/CREDIT_VALUE_NGN = 3/);
  assert.match(econ,/consumeAiJob/);
  assert.match(econ,/recordAiProviderUsage/);
  assert.match(econ,/refundAiCredits/);
  const server=fs.readFileSync(path.join(root,"src/server.js"),"utf8");
  assert.match(server,/\/api\/admin\/ai-economics/);
  assert.match(server,/consumeAiJob\(req\.user\.id,'tamp-assistant'/);
  const schema=fs.readFileSync(path.join(root,"src/db/postgres-schema.sql"),"utf8");
  assert.match(schema,/CREATE TABLE IF NOT EXISTS ai_usage_events/);
  assert.match(schema,/CREATE TABLE IF NOT EXISTS ai_provider_rates/);
});
