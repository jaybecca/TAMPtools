import 'dotenv/config';
import { Queue } from 'bullmq';
import IORedis from 'ioredis';

const queueName = process.env.REDIS_QUEUE_NAME || 'tamptools';
const redisUrl = process.env.REDIS_URL || '';
let connection;
let queue;

function requireRedis() {
  if (!redisUrl) throw new Error('REDIS_URL is required for BullMQ jobs.');
}

function redisConnection() {
  requireRedis();
  if (!connection) {
    connection = new IORedis(redisUrl, {
      maxRetriesPerRequest: null,
      enableReadyCheck: true
    });
    connection.on('error', (err) => console.error('[Redis]', err.message));
  }
  return connection;
}

export function getJobQueue() {
  if (!queue) queue = new Queue(queueName, { connection: redisConnection() });
  return queue;
}

export async function enqueueJob(type, payload = {}, options = {}) {
  const job = await getJobQueue().add(type, payload, {
    attempts: Number(options.attempts || 5),
    backoff: options.backoff || { type: 'exponential', delay: 5000 },
    removeOnComplete: { age: 86400, count: 1000 },
    removeOnFail: { age: 604800, count: 5000 },
    delay: Number(options.delayMs || 0),
    jobId: options.jobId ? String(options.jobId) : undefined
  });
  return job;
}

export async function queueHealth() {
  if (!redisUrl) return { configured: false, ok: false, queue: queueName };
  try {
    const redis = redisConnection();
    const pong = await redis.ping();
    return { configured: true, ok: pong === 'PONG', queue: queueName };
  } catch (error) {
    return { configured: true, ok: false, queue: queueName, error: error.message };
  }
}

export async function closeQueue() {
  if (queue) await queue.close();
  queue = null;
  if (connection) await connection.quit();
  connection = null;
}

export { queueName };
