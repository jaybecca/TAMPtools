import test from 'node:test';
import assert from 'node:assert/strict';
import { db, dbProvider } from '../src/db/database.js';

test('Phase 17A database adapter loads with SQLite locally', async () => {
  assert.equal(dbProvider, 'sqlite');
  const row = await db.prepare('SELECT 1 AS ok').get();
  assert.equal(Number(row.ok), 1);
});

test('Phase 17A production selector and Neon settings are present', async () => {
  const fs = await import('node:fs/promises');
  const source = await fs.readFile(new URL('../src/db/database.js', import.meta.url), 'utf8');
  assert.match(source, /DB_PROVIDER/);
  assert.match(source, /DATABASE_URL/);
  assert.match(source, /new Pool/);
});
