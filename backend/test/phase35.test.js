import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root=path.resolve(path.dirname(new URL(import.meta.url).pathname),'../..');

test('Phase 35 removes external translation provider dependency',()=>{
  const t=fs.readFileSync(path.join(root,'backend/src/translation.js'),'utf8');
  assert.equal(t.includes('translation.googleapis.com'),false);
  assert.equal(t.includes('GOOGLE_TRANSLATE_API_KEY'),false);
  assert.match(t,/externalTranslationCost:0/);
});

test('Phase 35 modern Image Studio is present',()=>{
  const w=fs.readFileSync(path.join(root,'frontend/workspace.js'),'utf8');
  const css=fs.readFileSync(path.join(root,'frontend/styles.css'),'utf8');
  assert.match(w,/image-studio-modern/);
  assert.match(w,/api\/image-studio\/process/);
  assert.match(w,/api\/image-studio\/batch/);
  assert.match(css,/\.image-studio-grid/);
  assert.match(css,/\.image-preview-stage/);
  assert.match(css,/\.image-tool-button/);
});
