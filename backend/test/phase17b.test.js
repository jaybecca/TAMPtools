import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd().endsWith(`${path.sep}backend`) ? path.resolve(process.cwd(), '..') : process.cwd();
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const backendPkg = JSON.parse(fs.readFileSync(path.join(root, 'backend/package.json'), 'utf8'));

test('Phase 17B declares BullMQ and Redis dependencies', () => {
  assert.ok(backendPkg.dependencies.bullmq);
  assert.ok(backendPkg.dependencies.ioredis);
  assert.equal(backendPkg.scripts.worker, 'node src/worker.js');
});

test('Phase 17B has durable worker and queue modules', () => {
  assert.ok(fs.existsSync(path.join(root, 'backend/src/jobs.js')));
  assert.ok(fs.existsSync(path.join(root, 'backend/src/worker.js')));
  const worker = fs.readFileSync(path.join(root, 'backend/src/worker.js'), 'utf8');
  assert.match(worker, /new Worker/);
  assert.match(worker, /upsertJobScheduler/);
  const server = fs.readFileSync(path.join(root, 'backend/src/server.js'), 'utf8');
  assert.doesNotMatch(server, /setInterval\(\(\)=>\{processJobs/);
  assert.match(server, /enqueueJob\('file\.process'/);
});

test('root exposes the worker command', () => {
  assert.equal(pkg.scripts.worker, 'npm --prefix backend run worker');
});
