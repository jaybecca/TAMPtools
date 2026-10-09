import { db } from './db/database.js';

export async function userReport(userId, from, to) {
  const end = to ? new Date(to) : new Date();
  const start = from ? new Date(from) : new Date(end.getTime() - 30 * 24 * 60 * 60 * 1000);
  const usage = await db.prepare(`SELECT tool_key AS toolKey, COUNT(*) AS count FROM usage_events WHERE user_id=? AND created_at BETWEEN ? AND ? GROUP BY tool_key ORDER BY count DESC`).all(userId, start.toISOString().replace('T',' ').replace('Z',''), end.toISOString().replace('T',' ').replace('Z',''));
  return {period:{from:start.toISOString(),to:end.toISOString()},usage,generatedAt:new Date().toISOString()};
}

export async function adminMetrics() {
  const users = Number(await db.prepare('SELECT COUNT(*) AS n FROM users').get().n);
  const active = Number(await db.prepare("SELECT COUNT(*) AS n FROM sessions WHERE expires_at > datetime('now')").get().n);
  const jobs = await db.prepare('SELECT status, COUNT(*) AS count FROM jobs GROUP BY status').all();
  return {users,active,jobs};
}
