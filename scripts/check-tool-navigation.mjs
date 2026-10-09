import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');
const registryContext = { window: {} };
vm.runInNewContext(read('frontend/apps/tool-registry.js'), registryContext, { filename: 'tool-registry.js' });
const registry = registryContext.window.TAMP_APP_REGISTRY;
assert.ok(registry && Object.keys(registry).length > 0, 'Registry should expose at least one tool');

let checkedPages = 0;
for (const [key, app] of Object.entries(registry)) {
  assert.ok(app.entry && app.entry.startsWith('/'), `${key} should have an absolute app entry`);
  if (app.entry.startsWith('/workspace.html?')) {
    assert.equal(app.status, 'legacy', `${key} workspace fallback should be marked legacy`);
    continue;
  }
  const page = path.join(root, 'frontend', app.entry.replace(/^\//, '').split('?')[0]);
  assert.ok(fs.existsSync(page), `${key} entry page does not exist: ${app.entry}`);
  checkedPages++;
}

for (const [key, expectedEntry] of Object.entries({
  'document-pdf-studio': '/apps/document-pdf.html',
  'invoice-generator': '/apps/invoice-generator.html',
  'proposal-builder': '/apps/proposal-builder.html',
  'resume-builder': '/apps/resume-builder.html'
})) {
  assert.equal(registry[key]?.entry, expectedEntry, `${key} should point to its dedicated page`);
  assert.notEqual(registry[key]?.status, 'legacy', `${key} should not be marked legacy`);
}

const appJs = read('frontend/app.js');
assert.match(appJs, /window\.TAMP_APP_REGISTRY\?\.\[a\.dataset\.toolLink\]/, 'Sidebar links should resolve registered tool destinations');
assert.match(appJs, /Object\.entries\(registryKeys\)/, 'Bundled command palette should resolve destinations from the registry');
const phase3 = read('frontend/phase3-ui.js');
assert.match(phase3, /window\.TAMP_APP_REGISTRY\?\.\[key\]\?\.entry/, 'Phase 3 tool opener should prefer registered destinations');

console.log(`PASS: navigation registry checks passed (${Object.keys(registry).length} tools; ${checkedPages} dedicated pages verified).`);
