import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { S3Client, PutObjectCommand, GetObjectCommand, HeadObjectCommand, DeleteObjectCommand, CopyObjectCommand } from '@aws-sdk/client-s3';
import { db } from './db/database.js';

const defaultRoot = path.resolve(new URL('../../data/uploads', import.meta.url).pathname);
const root = path.resolve(process.env.TAMPTOOLS_STORAGE_DIR || defaultRoot);
fs.mkdirSync(root,{recursive:true});
const MAX_FILE_BYTES = Number(process.env.MAX_FILE_SIZE_BYTES || 100 * 1024 * 1024);
const provider = String(process.env.STORAGE_PROVIDER || 'local').toLowerCase();
const r2Bucket = process.env.R2_BUCKET || '';
const r2Endpoint = process.env.R2_ENDPOINT || (process.env.R2_ACCOUNT_ID ? `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com` : '');
let r2Client = null;

function getR2Client(){
  if(provider !== 'r2') return null;
  if(!r2Bucket || !r2Endpoint || !process.env.R2_ACCESS_KEY_ID || !process.env.R2_SECRET_ACCESS_KEY) throw new Error('R2 storage is enabled but R2 credentials/configuration are incomplete.');
  if(!r2Client) r2Client = new S3Client({region:'auto',endpoint:r2Endpoint,credentials:{accessKeyId:process.env.R2_ACCESS_KEY_ID,secretAccessKey:process.env.R2_SECRET_ACCESS_KEY}});
  return r2Client;
}
function objectKey(userId, id, filename){ return `users/${userId}/files/${id}-${sanitizeFilename(filename)}`; }
function trashKey(userId,row){ return `users/${userId}/trash/${crypto.randomUUID()}-${sanitizeFilename(row.filename)}`; }

export function storageInfo(){return {provider,root:provider==='local'?root:null,bucket:provider==='r2'?r2Bucket:null,endpoint:provider==='r2'?r2Endpoint:null,retentionDays:Number(process.env.FILE_RETENTION_DAYS||7),maxFileBytes:MAX_FILE_BYTES,note:provider==='r2'?'Cloudflare R2 object storage':'Local development storage'};}
export function userRoot(userId){const dir=path.join(root,String(userId));fs.mkdirSync(dir,{recursive:true});return dir;}
export function sanitizeFilename(filename){return path.basename(String(filename||'file')).replace(/[^a-zA-Z0-9._ -]/g,'_').replace(/\s+/g,' ').trim().slice(0,180)||'file';}
export function detectFileType(buffer,filename='',mime=''){
  const b=Buffer.from(buffer||[]); const lower=String(filename).toLowerCase();
  if(b.subarray(0,5).toString()==='%PDF-') return {type:'pdf',mime:'application/pdf'};
  if(b.subarray(0,8).equals(Buffer.from([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a]))) return {type:'image',mime:'image/png'};
  if(b.subarray(0,3).equals(Buffer.from([0xff,0xd8,0xff]))) return {type:'image',mime:'image/jpeg'};
  if(b.subarray(0,6).toString()==='GIF89a'||b.subarray(0,6).toString()==='GIF87a') return {type:'image',mime:'image/gif'};
  if(b.subarray(0,4).toString()==='RIFF'&&b.subarray(8,12).toString()==='WEBP') return {type:'image',mime:'image/webp'};
  if(b.subarray(0,4).equals(Buffer.from([0x50,0x4b,0x03,0x04]))) return {type:'archive',mime:'application/zip'};
  if(/^text\//.test(mime)||['.txt','.csv','.tsv','.json','.md'].some(x=>lower.endsWith(x))) return {type:'text',mime:mime||'text/plain'};
  return {type:'document',mime:mime||'application/octet-stream'};
}
export async function storageUsage(userId){return await db.prepare('SELECT COALESCE(SUM(size_bytes),0) AS bytes, COUNT(*) AS count FROM user_files WHERE user_id=? AND status<>?').get(userId,'deleted');}

export async function safeFileRow(userId,fileId){
  return await db.prepare(
    `SELECT id, user_id, tool_key, filename, storage_path, mime_type,
            size_bytes, folder_path, status, sha256, is_temp, expires_at,
            trash_path, deleted_at, created_at, updated_at
     FROM user_files
     WHERE id=? AND user_id=? AND status<>?`
  ).get(fileId,userId,'deleted');
}

export async function saveBuffer(userId,toolKey,filename,buffer,mime,options={}){
  const safe=sanitizeFilename(filename); const id=crypto.randomUUID(); const sha256=crypto.createHash('sha256').update(buffer).digest('hex'); const detected=detectFileType(buffer,safe,mime); const folder=String(options.folderPath||'').replace(/^\/+|\/+$/g,'').slice(0,500); const expiresAt=options.expiresAt||null;
  let location;
  if(provider==='r2'){
    location=objectKey(userId,id,safe); await getR2Client().send(new PutObjectCommand({Bucket:r2Bucket,Key:location,Body:buffer,ContentType:detected.mime,Metadata:{userId:String(userId),fileId:id,toolKey:String(toolKey||'')}}));
  } else {
    const dir=userRoot(userId); const name=`${id}-${safe}`; location=path.join(dir,name); fs.writeFileSync(location,buffer);
  }
  const result=await db.prepare('INSERT INTO user_files (user_id,tool_key,filename,storage_path,mime_type,size_bytes,folder_path,status,sha256,is_temp,expires_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)').run(userId,toolKey||null,safe,location,detected.mime,buffer.length,folder,'ready',sha256,options.isTemp?1:0,expiresAt);
  return {id:Number(result.lastInsertRowid),path:location,filename:safe,sizeBytes:buffer.length,mimeType:detected.mime,type:detected.type,sha256};
}
export async function storedFileExists(row){
  if(provider==='r2'){try{await getR2Client().send(new HeadObjectCommand({Bucket:r2Bucket,Key:row.storage_path}));return true;}catch{return false;}}
  return Boolean(row?.storage_path && fs.existsSync(row.storage_path));
}
export async function readStoredBuffer(row){
  if(provider==='r2'){
    const out=await getR2Client().send(new GetObjectCommand({Bucket:r2Bucket,Key:row.storage_path}));
    return Buffer.from(await out.Body.transformToByteArray());
  }
  return fs.readFileSync(row.storage_path);
}
export async function streamStoredFile(row,res){
  if(provider==='r2'){
    const out=await getR2Client().send(new GetObjectCommand({Bucket:r2Bucket,Key:row.storage_path}));
    if(out.ContentLength!=null) res.setHeader('Content-Length',String(out.ContentLength));
    if(out.ContentType) res.setHeader('Content-Type',out.ContentType);
    out.Body.pipe(res); return;
  }
  fs.createReadStream(row.storage_path).pipe(res);
}
export async function renameStoredFile(userId,row,newName){
  const safe=sanitizeFilename(newName); const next=provider==='r2'?objectKey(userId,row.id,safe):path.join(path.dirname(row.storage_path),`${crypto.randomUUID()}-${safe}`);
  if(provider==='r2'){
    await getR2Client().send(new CopyObjectCommand({Bucket:r2Bucket,CopySource:`${r2Bucket}/${encodeURIComponent(row.storage_path).replace(/%2F/g,'/')}`,Key:next,MetadataDirective:'COPY'}));
    await getR2Client().send(new DeleteObjectCommand({Bucket:r2Bucket,Key:row.storage_path}));
  } else fs.renameSync(row.storage_path,next);
  await db.prepare('UPDATE user_files SET filename=?,storage_path=?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND user_id=?').run(safe,next,row.id,userId);
  return next;
}
export async function removeStoredFile(row){
  if(provider==='r2') await getR2Client().send(new DeleteObjectCommand({Bucket:r2Bucket,Key:row.storage_path}));
  else fs.rmSync(row.storage_path,{force:true});
}
export async function cleanupExpiredFiles(){
  const days=Number(process.env.FILE_RETENTION_DAYS||7); const rows=await db.prepare(`SELECT id,storage_path FROM user_files WHERE status<>? AND ((is_temp=1 AND expires_at IS NOT NULL AND expires_at <= datetime('now')) OR (is_temp=0 AND created_at <= datetime('now',?)))`).all('deleted',`-${days} day`);
  for(const r of rows){try{await removeStoredFile(r);}catch{}await db.prepare('UPDATE user_files SET status=? WHERE id=?').run('deleted',r.id);} return rows.length;
}
export function trashRoot(userId){const dir=path.join(userRoot(userId),'.trash');if(provider==='local')fs.mkdirSync(dir,{recursive:true});return dir;}
export async function moveToTrash(userId,row){
  if(!(await storedFileExists(row))) return false;
  const target=provider==='r2'?trashKey(userId,row):path.join(trashRoot(userId),`${crypto.randomUUID()}-${sanitizeFilename(row.filename)}`);
  if(provider==='r2'){
    await getR2Client().send(new CopyObjectCommand({Bucket:r2Bucket,CopySource:`${r2Bucket}/${encodeURIComponent(row.storage_path).replace(/%2F/g,'/')}`,Key:target,MetadataDirective:'COPY'}));
    await getR2Client().send(new DeleteObjectCommand({Bucket:r2Bucket,Key:row.storage_path}));
  } else fs.renameSync(row.storage_path,target);
  await db.prepare('UPDATE user_files SET status=?,trash_path=?,deleted_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP WHERE id=? AND user_id=?').run('deleted',target,row.id,userId); return true;
}
export async function restoreFromTrash(userId,row){
  if(!row?.trash_path) return false;
  const exists=provider==='r2'?await (async()=>{try{await getR2Client().send(new HeadObjectCommand({Bucket:r2Bucket,Key:row.trash_path}));return true;}catch{return false;}})():fs.existsSync(row.trash_path); if(!exists)return false;
  const dest=provider==='r2'?objectKey(userId,row.id,row.filename):path.join(userRoot(userId),`${crypto.randomUUID()}-${sanitizeFilename(row.filename)}`);
  if(provider==='r2'){
    await getR2Client().send(new CopyObjectCommand({Bucket:r2Bucket,CopySource:`${r2Bucket}/${encodeURIComponent(row.trash_path).replace(/%2F/g,'/')}`,Key:dest,MetadataDirective:'COPY'}));
    await getR2Client().send(new DeleteObjectCommand({Bucket:r2Bucket,Key:row.trash_path}));
  } else fs.renameSync(row.trash_path,dest);
  await db.prepare('UPDATE user_files SET status=?,storage_path=?,trash_path=NULL,deleted_at=NULL,updated_at=CURRENT_TIMESTAMP WHERE id=? AND user_id=?').run('ready',dest,row.id,userId); return true;
}
