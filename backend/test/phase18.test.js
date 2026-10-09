import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const root = new URL('../src/', import.meta.url);

test('Phase 18 secret-backed AI integration is wired', () => {
  const ai = fs.readFileSync(new URL('ai-provider.js', root), 'utf8');
  const server = fs.readFileSync(new URL('server.js', root), 'utf8');
  assert.match(ai, /integrationSecretGet/);
  assert.match(ai, /secretRef/);
  assert.match(ai, /storedKey/);
  assert.match(server, /integrationSecretUpsert/);
  assert.match(server, /secret_ref/);
});

test('Phase 18 keeps provider keys out of ai_providers persistence', () => {
  const server = fs.readFileSync(new URL('server.js', root), 'utf8');
  assert.match(server, /apiKey\).*integrationSecretUpsert/);
  assert.match(server, /VALUES\(\?\,\?\,\?\,\?\,\?\,/);
});

test('Phase 18 secret store uses authenticated AES-GCM encryption', () => {
  const source = fs.readFileSync(new URL('secret-store.js', root), 'utf8');
  assert.match(source, /aes-256-gcm/);
  assert.match(source, /setAuthTag/);
  assert.match(source, /TAMPTOOLS_ENCRYPTION_KEY/);
});
