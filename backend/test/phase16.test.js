import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

test('Phase 16 production hardening source is present', () => {
  const s = fs.readFileSync(new URL('../src/server.js', import.meta.url), 'utf8');
  assert.match(s, /helmet\(/);
  assert.match(s, /rateLimit\(/);
  assert.match(s, /\/api\/admin\/operations/);
  assert.match(s, /\/api\/admin\/security/);
  assert.match(s, /VACUUM INTO/);
  assert.match(s, /Global JSON error handler/);
});
