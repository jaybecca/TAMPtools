import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import path from 'node:path';
const root = path.resolve(new URL('../..', import.meta.url).pathname);

test('Phase 41 has a public health endpoint and safe optional integrations', () => {
  const server = fs.readFileSync(`${root}/backend/src/server.js`, 'utf8');
  assert.match(server, /app\.get\("\/api\/health"/);
  assert.match(server, /optional = \{/);
  assert.match(server, /imap: Boolean\(process\.env\.IMAP_HOST/);
  assert.match(server, /mailImapSchema\.safeParse/);
});

test('Phase 41 does not silently swallow translation failures', () => {
  const translation = fs.readFileSync(`${root}/backend/src/translation.js`, 'utf8');
  const home = fs.readFileSync(`${root}/frontend/home-i18n.js`, 'utf8');
  assert.match(translation, /console\.warn\(\`\[translation\]/);
  assert.match(home, /console\.warn\("\[TAMPtools i18n\]/);
  assert.doesNotMatch(home, /catch\{\}/);
});

test('Phase 41 documents optional integrations', () => {
  const env = fs.readFileSync(`${root}/backend/.env.example`, 'utf8');
  assert.match(env, /IMAP_HOST=/);
  assert.match(env, /IMAP_USERNAME=/);
  assert.match(env, /IMAP_PASSWORD=/);
  assert.match(env, /IMAP_ACCOUNT_EMAIL=/);
});
