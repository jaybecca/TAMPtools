import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..', '..');
const workspace = fs.readFileSync(path.join(root, 'frontend', 'workspace.js'), 'utf8');
const server = fs.readFileSync(path.join(root, 'backend', 'src', 'server.js'), 'utf8');

test('Phase 45 catalog tools have a reachable workspace path', () => {
  const keys = ['mail-manager','image-studio','document-pdf-studio','storage-manager','zip-file-toolkit','batch-studio','invoice-generator','proposal-builder','qr-code-generator','spreadsheet-data-cleaner','resume-builder','cover-letter-builder','career-profile-writer','content-studio','tamp-assistant'];
  for (const key of keys) assert.match(workspace, new RegExp(key.replaceAll('-', '\\-')));
});

test('Phase 45 has real backend endpoints for core processing tools', () => {
  for (const route of ['/api/tools/invoice-generator','/api/tools/pdf-splitter','/api/tools/image-compressor','/api/tools/image-converter','/api/tools/qr-code-generator','/api/image-studio/process','/api/document-pdf/merge','/api/batch/process','/api/spreadsheets/inspect','/api/mail/bulk']) {
    assert.match(server, new RegExp(route.replaceAll('/', '\\/')));
  }
});
