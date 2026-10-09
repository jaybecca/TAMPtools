import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import path from 'node:path';
const root = path.resolve(new URL('../..', import.meta.url).pathname);

test('Phase 40 removes dead generic tool workspaces', () => {
  const workspace = fs.readFileSync(`${root}/frontend/workspace.js`, 'utf8');
  for (const key of ['mail-manager','storage-manager','zip-file-toolkit','batch-studio','spreadsheet-data-cleaner','resume-builder','cover-letter-builder','career-profile-writer','content-studio','tamp-assistant']) {
    assert.ok(workspace.includes(key), `missing workspace route for ${key}`);
  }
  assert.match(workspace, /Tool integration is unavailable\./);
  assert.match(workspace, /if\(direct\[key\]\)\{location\.replace/);
  assert.match(workspace, /function aiToolStudio\(key,t\)/);
});

test('Phase 40 uses one translation path and supports missing-string translation', () => {
  const home = fs.readFileSync(`${root}/frontend/home-i18n.js`, 'utf8');
  const translation = fs.readFileSync(`${root}/backend/src/translation.js`, 'utf8');
  const server = fs.readFileSync(`${root}/backend/src/server.js`, 'utf8');
  assert.match(home, /\/api\/i18n\?lang=/);
  assert.match(translation, /TRANSLATION_AI_ENABLED/);
  assert.match(translation, /generateText/);
  assert.match(server, /provider: translationStatus\(\)\.provider/);
});

test('Phase 40 dependency and tool surfaces are present', () => {
  const pkg = JSON.parse(fs.readFileSync(`${root}/backend/package.json`, 'utf8'));
  const catalog = fs.readFileSync(`${root}/backend/src/tool-catalog.js`, 'utf8');
  assert.ok(pkg.dependencies.dotenv);
  assert.ok(pkg.dependencies.qrcode);
  assert.match(catalog, /ZIP & File Toolkit/);
  assert.match(catalog, /Spreadsheet & Data Cleaner/);
});
