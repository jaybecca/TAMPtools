import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
const root=process.cwd().endsWith('/backend')?path.resolve('..'):process.cwd();
test('Phase 17C declares R2 storage dependency',()=>{const pkg=JSON.parse(fs.readFileSync(path.join(root,'backend/package.json'),'utf8'));assert.ok(pkg.dependencies['@aws-sdk/client-s3']);});
test('Phase 17C storage abstraction supports local and R2 providers',()=>{const s=fs.readFileSync(path.join(root,'backend/src/storage.js'),'utf8');assert.match(s,/STORAGE_PROVIDER/);assert.match(s,/S3Client/);assert.match(s,/PutObjectCommand/);assert.match(s,/GetObjectCommand/);assert.match(s,/DeleteObjectCommand/);assert.match(s,/CopyObjectCommand/);});
test('Phase 17C file endpoints use storage abstraction',()=>{const s=fs.readFileSync(path.join(root,'backend/src/server.js'),'utf8');assert.match(s,/storedFileExists/);assert.match(s,/streamStoredFile/);assert.match(s,/renameStoredFile/);});
