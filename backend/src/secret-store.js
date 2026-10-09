import crypto from 'node:crypto';
import { db } from './db/database.js';

const encryptionKey = () => {
  const raw = process.env.TAMPTOOLS_ENCRYPTION_KEY || '';
  if (!raw || raw === 'REPLACE_ME') return null;
  return crypto.createHash('sha256').update(raw).digest();
};

const secretKeySafe = value => String(value || '').trim().toLowerCase().replace(/[^a-z0-9._:-]+/g, '-').slice(0, 180);

export const encryptSecret = value => {
  const key = encryptionKey();
  if (!key) throw new Error('TAMPTOOLS_ENCRYPTION_KEY is required before storing integration credentials.');
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(String(value), 'utf8'), cipher.final()]);
  return `v1:${iv.toString('base64url')}:${cipher.getAuthTag().toString('base64url')}:${encrypted.toString('base64url')}`;
};

export const decryptSecret = value => {
  const key = encryptionKey();
  if (!key || !value) return null;
  try {
    const [version, iv64, tag64, data64] = String(value).split(':');
    if (version !== 'v1') return null;
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(iv64, 'base64url'));
    decipher.setAuthTag(Buffer.from(tag64, 'base64url'));
    return Buffer.concat([decipher.update(Buffer.from(data64, 'base64url')), decipher.final()]).toString('utf8');
  } catch { return null; }
};

export const integrationSecretUpsert = async ({ key, provider, value, metadata = {} }) => {
  const secret_key = secretKeySafe(key);
  const encrypted_value = encryptSecret(value);
  const existing = await db.prepare('SELECT id FROM integration_secrets WHERE secret_key=?').get(secret_key);
  if (existing) {
    await db.prepare('UPDATE integration_secrets SET provider=?,encrypted_value=?,metadata_json=?,updated_at=CURRENT_TIMESTAMP WHERE secret_key=?').run(provider, encrypted_value, JSON.stringify(metadata), secret_key);
    return existing.id;
  }
  const r = await db.prepare('INSERT INTO integration_secrets(secret_key,provider,encrypted_value,metadata_json) VALUES(?,?,?,?)').run(secret_key, provider, encrypted_value, JSON.stringify(metadata));
  return r.lastInsertRowid;
};

export const integrationSecretGet = async key => {
  const row = await db.prepare('SELECT * FROM integration_secrets WHERE secret_key=?').get(secretKeySafe(key));
  if (!row) return null;
  const value = decryptSecret(row.encrypted_value);
  if (value) await db.prepare('UPDATE integration_secrets SET last_used_at=CURRENT_TIMESTAMP WHERE id=?').run(row.id);
  return value;
};

export const integrationSecretConfigured = () => Boolean(encryptionKey());
export { secretKeySafe };
