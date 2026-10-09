import { db } from './db/database.js';
export async function audit(userId, action, metadata = {}, req = null) {
  try {
    await db.prepare(`INSERT INTO audit_logs (user_id,action,metadata_json,ip_address,user_agent) VALUES (?,?,?,?,?)`).run(
      userId || null, action, JSON.stringify(metadata), req?.ip || null, req?.get?.('user-agent') || null
    );
  } catch (error) { console.error('audit log failed', error); }
}
