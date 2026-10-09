import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
const root = new URL('../..', import.meta.url).pathname;

test('Phase 39 business and translation architecture is present', () => {
  const workspace=fs.readFileSync(`${root}/frontend/workspace.js`,'utf8');
  const home=fs.readFileSync(`${root}/frontend/home-i18n.js`,'utf8');
  const server=fs.readFileSync(`${root}/backend/src/server.js`,'utf8');
  const pkg=JSON.parse(fs.readFileSync(`${root}/backend/package.json`,'utf8'));
  for (const name of ['invoiceGenerator','proposalBuilder','qrCodeGenerator']) assert.match(workspace,new RegExp(`function ${name}`));
  assert.match(home,/first-party translation pack/i);
  assert.match(home,/FIRST_PARTY_TRANSLATION_LANGUAGES/);
  for (const lang of ['en','en_gb','zh','es','hi','fr','ar','bn','pt','ru','id','ur','de','ja','pcm','ar_eg','mr','vi','te','ha','zu','tr']) assert.match(home,new RegExp(`['"]${lang}['"]`));
  assert.match(server,/QRCode\.toDataURL/);
  assert.equal(pkg.dependencies.qrcode,'^1.5.4');
});
