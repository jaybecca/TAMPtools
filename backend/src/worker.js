import dotenv from 'dotenv';
dotenv.config();
import { Worker, Queue } from 'bullmq';
import IORedis from 'ioredis';
const { db } = await import('./db/database.js');
const { cleanupExpiredFiles } = await import('./storage.js');

dotenv.config();
const redisUrl = process.env.REDIS_URL;
if (!redisUrl) throw new Error('REDIS_URL is required to start the TAMPtools BullMQ worker.');

const queueName = process.env.REDIS_QUEUE_NAME || 'tamptools';
const connection = new IORedis(redisUrl, { maxRetriesPerRequest: null, enableReadyCheck: true });
connection.on('error', (err) => console.error('[Redis]', err.message));

async function markRunning(job) {
  await db.prepare("UPDATE jobs SET status='running', locked_at=CURRENT_TIMESTAMP, attempts=attempts+1, updated_at=CURRENT_TIMESTAMP WHERE id=?").run(Number(job.data?.dbJobId || 0));
}

async function markCompleted(job) {
  if (!job.data?.dbJobId) return;
  await db.prepare("UPDATE jobs SET status='completed', completed_at=CURRENT_TIMESTAMP, updated_at=CURRENT_TIMESTAMP WHERE id=?").run(Number(job.data.dbJobId));
}

async function markFailed(job, error) {
  if (!job.data?.dbJobId) return;
  await db.prepare("UPDATE jobs SET status=?, last_error=?, updated_at=CURRENT_TIMESTAMP WHERE id=?").run(job.attemptsMade >= job.opts.attempts ? 'failed' : 'queued', String(error?.message || error), Number(job.data.dbJobId));
  await db.prepare('INSERT INTO system_events(level,component,message,metadata_json) VALUES (?,?,?,?)').run('error','bullmq',String(error?.message || error),JSON.stringify({jobId:job.data.dbJobId,type:job.name,attempts:job.attemptsMade}));
}

async function process(job) {
  await markRunning(job);
  const payload = job.data || {};
  if (job.name === 'cleanup') {
    await cleanupExpiredFiles();
  } else if (job.name === 'file.process' && payload.fileId && payload.userId) {
    await db.prepare("UPDATE user_files SET status='ready',updated_at=CURRENT_TIMESTAMP WHERE id=? AND user_id=? AND status='processing'").run(Number(payload.fileId), Number(payload.userId));
  }
  await markCompleted(job);
  return { ok: true };
}

const worker = new Worker(queueName, process, {
  connection,
  concurrency: Number(process.env.JOB_CONCURRENCY || 5),
  lockDuration: Number(process.env.JOB_LOCK_DURATION_MS || 60000)
});

worker.on('completed', job => console.log(`[BullMQ] completed ${job.name}#${job.id}`));
worker.on('failed', async (job, err) => {
  if (job) await markFailed(job, err).catch(e => console.error('[BullMQ] status update:', e.message));
  console.error(`[BullMQ] failed ${job?.name || 'unknown'}#${job?.id || ''}:`, err.message);
});
worker.on('error', err => console.error('[BullMQ] worker error:', err.message));

const schedulerQueue = new Queue(queueName, { connection });
await schedulerQueue.upsertJobScheduler('cleanup-expired-files', { every: Number(process.env.FILE_CLEANUP_INTERVAL_MS || 3600000) }, { name: 'cleanup', data: {} });

const shutdown = async () => {
  await worker.close();
  await schedulerQueue.close();
  await connection.quit();
  await db.close();
  process.exit(0);
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

console.log(`[BullMQ] TAMPtools worker listening on queue "${queueName}"`);
