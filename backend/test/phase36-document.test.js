import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root=path.resolve(path.dirname(new URL(import.meta.url).pathname),'../..');

test('Phase 36 document workspace calls real processing endpoints',()=>{
  const w=fs.readFileSync(path.join(root,'frontend/workspace.js'),'utf8');
  assert.match(w,/const endpoint=\{merge:'merge',split:'split',compress:'compress',convert:'pdf-to-image','image-to-pdf':'image-to-pdf',organize:'organize',ocr:'ocr','extract-text':'extract-text',compare:'compare'\}/);
  assert.match(w,/select\('image-to-pdf'\)/);
  assert.match(w,/Working…/);
  assert.match(w,/Done — your result is ready/);
});

test('Phase 36 fixes multi-result PDF conversion and multi-image PDF creation',()=>{
  const s=fs.readFileSync(path.join(root,'backend/src/server.js'),'utf8');
  const studio=fs.readFileSync(path.join(root,'backend/src/document-pdf-studio.js'),'utf8');
  assert.match(s,/await Promise\.all\(outputs\.map/);
  assert.match(s,/imageUpload\.array\('files',20\)/);
  assert.match(studio,/export async function imagesToPdf/);
});

test('Phase 36 translation remains TAMPtools-owned',()=>{
  const env=fs.readFileSync(path.join(root,'backend/.env.example'),'utf8');
  const t=fs.readFileSync(path.join(root,'backend/src/translation.js'),'utf8');
  assert.equal(env.includes('GOOGLE_TRANSLATE_API_KEY'),false);
  assert.equal(t.includes('translation.googleapis.com'),false);
});
