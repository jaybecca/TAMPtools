import express from "express";
import helmet from "helmet";
import cors from "cors";
import rateLimit from "express-rate-limit";
import dotenv from "dotenv";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import crypto from "node:crypto";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { z } from "zod";
import multer from "multer";
import { consumeEntitlement, getPlanForUser, monthlyUsage, enforceFeature } from "./entitlements.js";
import { audit } from "./audit.js";
import { generateText } from "./ai-provider.js";
import { consumeAiJob, CREDIT_VALUE_NGN, economicsSummary } from "./ai-economics.js";
import { encryptSecret, decryptSecret, integrationSecretUpsert, integrationSecretGet, integrationSecretConfigured, secretKeySafe } from "./secret-store.js";
import { sendEmail } from "./email-provider.js";
import { getCompleteDictionary, translateTexts, translationStatus } from "./translation.js";

import { userReport, adminMetrics } from "./reports.js";
import { cleanupExpiredFiles, storageInfo, saveBuffer, safeFileRow, storageUsage, sanitizeFilename, detectFileType, moveToTrash, restoreFromTrash, storedFileExists, readStoredBuffer, streamStoredFile, renameStoredFile } from "./storage.js";
import { resolveLocale, CURRENCY_INFO, pricingAmount, pricingAmountForCycle, FALLBACK_RATES, toMinorUnits } from "./locale.js";
import { compressPdf } from "./pdf-compressor.js";
import { parsePageRanges, getPdfPageCount, splitPdf } from "./pdf-splitter.js";
import { compressImage } from "./image-compressor.js";
import { extractDocumentText } from "./document-text.js";
import { convertImage } from "./image-converter.js";
import { processImage } from "./image-studio.js";
import { mergePdfs, convertPdfToImages, createTextPdf, imageToPdf, imagesToPdf, extractPdfTextFull, ocrPdf, protectPdf, reorderPdf, cleanupText, compareText, inspectPdf, composePdf } from "./document-pdf-studio.js";
import { paymentProviders, providerConfigured, selectProvider, routeCheckout, createCheckout, verifyWebhook, normalizeWebhook, paymentSecret } from "./payments.js";
import { db, dbProvider, TRIAL_LIMITS } from "./db/database.js";
import { enqueueJob, queueHealth, closeQueue } from "./jobs.js";
import { TOOL_CATALOG } from "./tool-catalog.js";
import { PLATFORM, CANONICAL_TOOLS, PRODUCT_BOUNDARIES } from "./platform/canonical-config.js";
import QRCode from "qrcode";
import sharp from "sharp";
import { inspectSpreadsheet, cleanSpreadsheet } from "./spreadsheet-cleaner.js";
import { INVOICE_TEMPLATES, INVOICE_CURRENCIES, invoiceTotals, renderInvoiceHtml, renderInvoicePdf } from "./invoice-generator.js";


dotenv.config();

const app = express();
const PORT = Number(process.env.PORT || 4000);
const SUPPORT_EMAIL = process.env.SUPPORT_EMAIL || "tools@tampconsulting.space";
const WHATSAPP_SUPPORT_NUMBER = String(process.env.WHATSAPP_SUPPORT_NUMBER || "2349152345734").trim().replace(/^https?:\/\/(?:www\.)?(?:wa\.me|api\.whatsapp\.com)\//i,'').replace(/\D/g, "");
const isProduction = process.env.NODE_ENV === "production";
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const frontendDir = path.resolve(__dirname, "../../frontend");
const generatedDir = path.resolve(__dirname, "../../data/generated");
const qrDir = path.resolve(__dirname, "../../data/qr-codes");
fs.mkdirSync(generatedDir, { recursive: true });
fs.mkdirSync(qrDir, { recursive: true });

const cookieName = "tamptools_session";
const sessionDays = Number(process.env.SESSION_DAYS || 7);
const sessionMaxAgeMs = sessionDays * 24 * 60 * 60 * 1000;

app.disable("x-powered-by");
app.use((req,res,next)=>{const id=req.get('x-request-id')||crypto.randomUUID();req.requestId=id;res.setHeader('X-Request-Id',id);next();});
app.use(helmet({ contentSecurityPolicy: false, referrerPolicy: { policy: 'strict-origin-when-cross-origin' }, hsts: isProduction ? undefined : false }));
const allowedOrigins = new Set((process.env.FRONTEND_ORIGINS || process.env.FRONTEND_ORIGIN || `http://localhost:${PORT},http://127.0.0.1:${PORT}`).split(",").map(x => x.trim()).filter(Boolean));
app.use(cors({
  origin(origin, callback) {
    if (!origin || allowedOrigins.has(origin)) return callback(null, true);
    return callback(new Error("CORS origin not allowed"));
  },
  methods: ["GET", "POST", "PATCH", "OPTIONS"],
  credentials: true
}));
app.use(express.json({ limit: "100kb", verify: (req, res, buf) => { req.rawBody = Buffer.from(buf); } }));
app.use(rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false
}));

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many authentication attempts. Please try again later." }
});

const googleConfigured = () => Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
// Mailbox Gmail OAuth intentionally reuses the same Google OAuth client credentials as Continue with Google.
// Gmail access is a separate consent scope, not a second Google client credential.
const gmailMailConfigured = googleConfigured;
const microsoftMailConfigured = () => Boolean(process.env.MICROSOFT_CLIENT_ID && process.env.MICROSOFT_CLIENT_SECRET);
const mailOAuthBaseUrl = req => process.env.APP_BASE_URL || `${req.protocol}://${req.get('host')}`;
const mailOAuthRedirect = (req,provider) => `${mailOAuthBaseUrl(req)}/api/mail/oauth/${provider}/callback`;
const mailOAuthCookie = provider => `tamptools_mail_oauth_${provider}`;
const mailOAuthStates = new Map();
const oauthState = userId => { const state=crypto.randomBytes(32).toString('hex'); mailOAuthStates.set(state,{userId:Number(userId),expires:Date.now()+10*60*1000}); return state; };
const oauthStateUser = state => { const row=mailOAuthStates.get(String(state)); mailOAuthStates.delete(String(state)); if(!row||row.expires<Date.now()) return null; return row.userId; };
const setMailOAuthCookie = (res,provider,state) => res.appendHeader('Set-Cookie',`${mailOAuthCookie(provider)}=${encodeURIComponent(state)}; Path=/; Max-Age=600; HttpOnly; SameSite=Lax${isProduction?'; Secure':''}`);
const clearMailOAuthCookie = (res,provider) => res.appendHeader('Set-Cookie',`${mailOAuthCookie(provider)}=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax${isProduction?'; Secure':''}`);
const mailSecretKey = (userId,connectionId) => `mail-oauth:${userId}:${connectionId}`;
const googleApi = async (token,url,options={}) => { const r=await fetch(url,{...options,headers:{Accept:'application/json',...(options.headers||{}),Authorization:`Bearer ${token}`}}); const d=await r.json().catch(()=>({})); if(!r.ok) throw new Error(d.error?.message||d.error_description||`Google Mail request failed (${r.status}).`); return d; };
const graphApi = async (token,url,options={}) => { const r=await fetch(url,{...options,headers:{Accept:'application/json',...(options.headers||{}),Authorization:`Bearer ${token}`}}); const d=await r.json().catch(()=>({})); if(!r.ok) throw new Error(d.error?.message||`Microsoft Mail request failed (${r.status}).`); return d; };
const mailTokenRecord = async (userId,connectionId) => { const raw=await integrationSecretGet(mailSecretKey(userId,connectionId)); if(!raw) throw new Error('Mail authorization is missing. Reconnect this mailbox.'); try{return JSON.parse(raw)}catch{throw new Error('Stored mail authorization is invalid. Reconnect this mailbox.');} };
const refreshGoogleToken = async tok => { if(!tok.refresh_token) return tok; if(tok.expires_at && Date.now()<Number(tok.expires_at)-60000) return tok; const r=await fetch('https://oauth2.googleapis.com/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({client_id:process.env.GOOGLE_CLIENT_ID,client_secret:process.env.GOOGLE_CLIENT_SECRET,refresh_token:tok.refresh_token,grant_type:'refresh_token'})}); const d=await r.json().catch(()=>({})); if(!r.ok||!d.access_token) throw new Error('Google authorization expired. Reconnect Gmail.'); return {...tok,...d,refresh_token:d.refresh_token||tok.refresh_token,expires_at:Date.now()+Number(d.expires_in||3600)*1000}; };
const refreshMicrosoftToken = async tok => { if(!tok.refresh_token) return tok; if(tok.expires_at && Date.now()<Number(tok.expires_at)-60000) return tok; const r=await fetch(`https://login.microsoftonline.com/${process.env.MICROSOFT_TENANT_ID||'common'}/oauth2/v2.0/token`,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({client_id:process.env.MICROSOFT_CLIENT_ID,client_secret:process.env.MICROSOFT_CLIENT_SECRET,refresh_token:tok.refresh_token,grant_type:'refresh_token',scope:'openid email profile offline_access User.Read Mail.ReadWrite'})}); const d=await r.json().catch(()=>({})); if(!r.ok||!d.access_token) throw new Error('Microsoft authorization expired. Reconnect Outlook.'); return {...tok,...d,refresh_token:d.refresh_token||tok.refresh_token,expires_at:Date.now()+Number(d.expires_in||3600)*1000}; };
const gmailToken = async (userId,connectionId) => { const tok=await mailTokenRecord(userId,connectionId),fresh=await refreshGoogleToken(tok); if(fresh.access_token!==tok.access_token) await integrationSecretUpsert({key:mailSecretKey(userId,connectionId),provider:'google-mail',value:JSON.stringify(fresh),metadata:{userId,connectionId}}); return fresh; };
const microsoftToken = async (userId,connectionId) => { const tok=await mailTokenRecord(userId,connectionId),fresh=await refreshMicrosoftToken(tok); if(fresh.access_token!==tok.access_token) await integrationSecretUpsert({key:mailSecretKey(userId,connectionId),provider:'microsoft-mail',value:JSON.stringify(fresh),metadata:{userId,connectionId}}); return fresh; };
function decodeBase64Url(value=''){try{return Buffer.from(String(value).replace(/-/g,'+').replace(/_/g,'/'),'base64').toString('utf8')}catch{return ''}}
function gmailPayloadText(payload){let text='',html=''; const walk=p=>{if(!p)return; const type=String(p.mimeType||''); if(p.body?.data){const v=decodeBase64Url(p.body.data);if(type==='text/plain')text+=v;else if(type==='text/html')html+=v;} for(const child of p.parts||[])walk(child)};walk(payload); return {text:text||html.replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim(),html};}
function mailHeader(payload,name){return (payload?.headers||[]).find(h=>String(h.name).toLowerCase()===name.toLowerCase())?.value||'';}
async function saveRemoteMessage(userId,connectionId,m){const attachmentNames=m.attachmentNames||[];const h=mailHash({senderEmail:m.senderEmail,subject:m.subject,bodyText:m.bodyText,sentAt:m.sentAt,attachmentNames}); if(await db.prepare('SELECT id FROM mail_messages WHERE user_id=? AND connection_id=? AND message_uid=?').get(userId,connectionId,String(m.messageUid)))return false; if(await db.prepare('SELECT id FROM mail_messages WHERE user_id=? AND content_hash=?').get(userId,h))return false; await db.prepare(`INSERT INTO mail_messages(user_id,connection_id,message_uid,sender_name,sender_email,subject,body_text,body_html,sent_at,has_attachments,attachment_names_json,folder_name,is_read,is_starred,content_hash) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(userId,connectionId,String(m.messageUid),m.senderName||'',m.senderEmail||'',m.subject||'',m.bodyText||'',m.bodyHtml||null,m.sentAt||null,attachmentNames.length?1:0,JSON.stringify(attachmentNames),m.folderName||'Inbox',m.isRead?1:0,m.isStarred?1:0,h);return true;}
async function syncGoogleMailbox(userId,connectionId){const tok=await gmailToken(userId,connectionId);const labels=await googleApi(tok.access_token,'https://gmail.googleapis.com/gmail/v1/users/me/labels');const folders=(labels.labels||[]).map(x=>({id:x.id,name:x.name,type:x.type}));const inbox=(folders.find(x=>x.name==='INBOX')||folders[0]);let list=await googleApi(tok.access_token,`https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=500${inbox?'&labelIds=INBOX':''}`);let imported=0,duplicates=0;for(const item of list.messages||[]){try{const full=await googleApi(tok.access_token,`https://gmail.googleapis.com/gmail/v1/users/me/messages/${encodeURIComponent(item.id)}?format=full`);const parsed=gmailPayloadText(full.payload);const from=mailHeader(full.payload,'From');const fm=from.match(/^(.*?)\s*<([^>]+)>$/);const labelsSet=new Set(full.labelIds||[]);const ok=await saveRemoteMessage(userId,connectionId,{messageUid:item.id,senderName:(fm?fm[1]:from).replace(/^"|"$/g,'').trim(),senderEmail:(fm?fm[2]:from).trim(),subject:mailHeader(full.payload,'Subject'),bodyText:parsed.text,bodyHtml:parsed.html,sentAt:mailHeader(full.payload,'Date'),attachmentNames:[],folderName:labelsSet.has('INBOX')?'INBOX':'Gmail',isRead:!labelsSet.has('UNREAD'),isStarred:labelsSet.has('STARRED')}); if(ok)imported++;else duplicates++;}catch(e){console.warn('Gmail message skipped:',e.message)}}return {imported,duplicates,folders};}
async function syncMicrosoftMailbox(userId,connectionId){const tok=await microsoftToken(userId,connectionId);const foldersResponse=await graphApi(tok.access_token,'https://graph.microsoft.com/v1.0/me/mailFolders?$top=100');const folders=(foldersResponse.value||[]).map(x=>({id:x.id,name:x.displayName,type:x.wellKnownName||''}));const data=await graphApi(tok.access_token,'https://graph.microsoft.com/v1.0/me/messages?$top=500&$select=id,subject,body,bodyPreview,from,receivedDateTime,isRead,flag,hasAttachments,parentFolderId&$orderby=receivedDateTime%20desc');let imported=0,duplicates=0;for(const m of data.value||[]){const ok=await saveRemoteMessage(userId,connectionId,{messageUid:m.id,senderName:m.from?.emailAddress?.name||'',senderEmail:m.from?.emailAddress?.address||'',subject:m.subject||'',bodyText:m.body?.contentType==='text'?m.body.content:(m.bodyPreview||m.body?.content||'').replace(/<[^>]*>/g,' '),bodyHtml:m.body?.contentType==='html'?m.body.content:null,sentAt:m.receivedDateTime,attachmentNames:[],folderName:(folders.find(f=>f.id===m.parentFolderId)?.name)||'Inbox',isRead:Boolean(m.isRead),isStarred:Boolean(m.flag?.flagStatus==='flagged')});if(ok)imported++;else duplicates++;}return {imported,duplicates,folders};}

const googleBaseUrl = req => process.env.APP_BASE_URL || `${req.protocol}://${req.get('host')}`;
const googleRedirectUri = req => `${googleBaseUrl(req)}/api/auth/google/callback`;
const googleStateCookie = 'tamptools_google_oauth_state';
const setOAuthStateCookie = (res, state) => res.setHeader('Set-Cookie', `${googleStateCookie}=${encodeURIComponent(state)}; Path=/; Max-Age=600; HttpOnly; SameSite=Lax${isProduction ? '; Secure' : ''}`);
const clearOAuthStateCookie = res => res.appendHeader('Set-Cookie', `${googleStateCookie}=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax${isProduction ? '; Secure' : ''}`);
const getCookie = (req,name) => parseCookies(req.headers.cookie)[name];

const hashToken = token =>
  crypto.createHash("sha256").update(token).digest("hex");

const hashPassword = password => {
  const salt = crypto.randomBytes(16);
  const derived = crypto.scryptSync(password, salt, 64);
  return `scrypt$${salt.toString("hex")}$${derived.toString("hex")}`;
};

const verifyPassword = (password, stored) => {
  try {
    const [scheme, saltHex, hashHex] = String(stored).split("$");
    if (scheme !== "scrypt" || !saltHex || !hashHex) return false;
    const salt = Buffer.from(saltHex, "hex");
    const expected = Buffer.from(hashHex, "hex");
    const actual = crypto.scryptSync(password, salt, expected.length);
    return actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
};

const parseCookies = header => {
  const cookies = {};
  for (const part of String(header || "").split(";")) {
    const index = part.indexOf("=");
    if (index < 0) continue;
    const key = part.slice(0, index).trim();
    const value = part.slice(index + 1).trim();
    if (key) cookies[key] = decodeURIComponent(value);
  }
  return cookies;
};

const setSessionCookie = (res, token) => {
  const secure = isProduction ? "; Secure" : "";
  res.setHeader(
    "Set-Cookie",
    `${cookieName}=${encodeURIComponent(token)}; Path=/; Max-Age=${Math.floor(sessionMaxAgeMs / 1000)}; HttpOnly; SameSite=Lax${secure}`
  );
};

const clearSessionCookie = res => {
  res.setHeader(
    "Set-Cookie",
    `${cookieName}=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax${isProduction ? "; Secure" : ""}`
  );
};

function trialActive(user) {
  return Boolean(user?.trialEndsAt && Date.parse(String(user.trialEndsAt).replace(" ", "T") + "Z") > Date.now());
}

async function getPlanRecord(name) {
  const row = await db.prepare(`SELECT id, name, usd, gbp, ngn, prices_json AS pricesJson, credit_packs_json AS creditPacksJson, monthly_uses AS monthlyUses, features_json AS featuresJson FROM plans WHERE name = ? AND active = 1`).get(name);
  if (!row) return null;
  return { ...row, prices: JSON.parse(row.pricesJson || "{}"), features: JSON.parse(row.featuresJson || "{}") };
}

async function effectivePlanForUser(user) {
  const activeSub = user?.id ? await db.prepare("SELECT p.* FROM subscriptions s JOIN plans p ON p.id=s.plan_id WHERE s.user_id=? AND s.status IN ('active','trialing') AND p.active=1 ORDER BY s.id DESC LIMIT 1").get(user.id) : null;
  if (activeSub) return { ...activeSub, features: JSON.parse(activeSub.features_json || '{}'), prices: JSON.parse(activeSub.prices_json || '{}'), trial: false };
  if (trialActive(user)) return { name: "30-Day Trial", usd: 0, gbp: 0, ngn: 0, monthlyUses: TRIAL_LIMITS.monthlyUses, features: { ...TRIAL_LIMITS, pdfMaxFiles: 10, pdfMaxMb: 100, pdfAdvanced: true, tools: "All", teamMembers: 1, analytics: "Basic", prioritySupport: false }, trial: true, trialEndsAt: user.trialEndsAt };
  return { ...await getPlanRecord(user.plan), trial: false };
}

async function getCurrentUser(req) {
  const cookies = parseCookies(req.headers.cookie);
  const token = cookies[cookieName];
  if (!token) return null;

  const tokenHash = hashToken(token);
  const row = await db.prepare(`
    SELECT u.id, u.name, u.email, u.plan, u.language, u.currency, u.country_code AS countryCode, u.trial_started_at AS trialStartedAt,
           u.trial_ends_at AS trialEndsAt, u.created_at AS createdAt, u.email_verified_at AS emailVerifiedAt,
           s.expires_at AS expiresAt
    FROM sessions s
    JOIN users u ON u.id = s.user_id
    WHERE s.token_hash = ?
  `).get(tokenHash);

  if (!row) return null;

  if (Date.parse(row.expiresAt.replace(" ", "T") + "Z") <= Date.now()) {
    await db.prepare("DELETE FROM sessions WHERE token_hash = ?").run(tokenHash);
    return null;
  }

  return row;
}

async function requireAuth(req, res, next) {
  const user = await getCurrentUser(req);
  if (!user) return res.status(401).json({ error: "Authentication required." });
  req.user = user;
  next();
}

function requireSameOrigin(req, res, next) {
  const origin = req.get("origin");
  if (origin && !allowedOrigins.has(origin)) {
    return res.status(403).json({ error: "Invalid request origin." });
  }
  next();
}

const localeSchema = z.object({
  language: z.string().trim().min(2).max(10).optional(),
  currency: z.string().trim().length(3).optional(),
  country: z.string().trim().length(2).optional()
});

const signupSchema = z.object({
  name: z.string().trim().min(2).max(100),
  email: z.string().trim().toLowerCase().email().max(254),
  password: z.string().min(8).max(128)
});

const signinSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
  password: z.string().min(1).max(128)
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1).max(128),
  newPassword: z.string().min(8).max(128)
});

const forgotPasswordSchema = z.object({ email: z.string().trim().toLowerCase().email().max(254) });
const resetPasswordSchema = z.object({ token: z.string().trim().min(20).max(200), password: z.string().min(8).max(128) });
const tokenSchema = z.object({ token: z.string().trim().min(20).max(200) });
const projectSchema = z.object({ name: z.string().trim().min(1).max(160), toolKey: z.string().trim().max(100).optional(), projectType: z.string().trim().max(100).optional(), metadata: z.record(z.string(), z.any()).optional() });
const publicOrigin = () => { const configured=String(process.env.PUBLIC_APP_URL||'').trim().replace(/\/$/,''); return configured || `http://localhost:${PORT}`; };
const issueAccountToken = async (userId,type,minutes) => { await db.prepare("DELETE FROM account_tokens WHERE user_id=? AND token_type=? AND used_at IS NULL").run(userId,type); const token=crypto.randomBytes(48).toString('base64url'); await db.prepare("INSERT INTO account_tokens (user_id,token_hash,token_type,expires_at) VALUES (?,?,?,?)").run(userId,hashToken(token),type,new Date(Date.now()+minutes*60000).toISOString().replace('T',' ').replace('Z','')); return token; };
const accountUrl = (page,token) => `${publicOrigin()}/${page}?token=${encodeURIComponent(token)}`;
const sendAccountEmail = async ({to,name,subject,heading,body,link,label}) => sendEmail({to,subject,html:`<div style="font-family:Arial,sans-serif;max-width:620px;margin:auto"><h2>${heading}</h2><p>${body}</p><p><a href="${link}" style="display:inline-block;padding:12px 18px;background:#5d2de6;color:#fff;text-decoration:none;border-radius:8px">${label}</a></p><p style="color:#667085;font-size:13px">If you did not request this, you can ignore this email.</p><p style="color:#667085;font-size:13px">TAMPtools</p></div>`,text:`${heading}\n\n${body}\n\n${label}: ${link}`});

app.get('/api/integrations/catalog',async (req,res)=>res.json({policy:integrationPolicy(),connectors:integrationCatalog()}));
app.get('/api/integrations/status',async (req,res)=>res.json({
  payments:paymentProviders(),
  email:{provider:'resend',configured:Boolean(process.env.RESEND_API_KEY && process.env.RESEND_API_KEY!=='REPLACE_ME')},
  ai:{text:Boolean(process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY!=='REPLACE_ME'),image:Boolean(process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY!=='REPLACE_ME')},
  storage:await storageInfo()
}));

app.get("/api/platform", async (req, res) => {
  res.json({
    name: PLATFORM.name,
    tagline: PLATFORM.tagline,
    groups: PLATFORM.groups,
    canonicalTools: CANONICAL_TOOLS,
    boundaries: PRODUCT_BOUNDARIES,
    admin: PLATFORM.admin
  });
});

app.get("/api/auth/google/status", (req, res) => {
  res.json({ configured: googleConfigured(), provider: "google", message: googleConfigured() ? "Google Sign-In is ready." : "Google Sign-In needs GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET." });
});

app.get("/api/health", async (req, res) => {
  try {
    const database = await db.prepare("SELECT 1 AS ok").get();
    const redis = await queueHealth();
    const optional = {
      ai: Boolean(process.env.OPENAI_API_KEY || process.env.GEMINI_API_KEY || process.env.CLAUDE_API_KEY),
      imap: Boolean(process.env.IMAP_HOST && process.env.IMAP_USERNAME && process.env.IMAP_PASSWORD && process.env.IMAP_ACCOUNT_EMAIL),
      googleMail: Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET),
      microsoftMail: Boolean(process.env.MICROSOFT_CLIENT_ID && process.env.MICROSOFT_CLIENT_SECRET)
    };
    const ok = database?.ok === 1;
    res.status(ok ? 200 : 503).json({ ok, service: "tamptools", version: "phase-45", uptimeSeconds: Math.round(process.uptime()), database: ok ? "ok" : "error", redis, optional });
  } catch (error) {
    res.status(503).json({ ok: false, service: "tamptools", version: "phase-45", error: isProduction ? "Service unavailable." : String(error.message || error) });
  }
});

app.get("/api/plans", async (req, res) => {
  const plans = await db.prepare(`
    SELECT id, name, usd, gbp, ngn, prices_json AS pricesJson, credit_packs_json AS creditPacksJson, monthly_uses AS monthlyUses,
           features_json AS featuresJson, scheduling_days AS schedulingDays, batch_posts AS batchPosts, sort_order AS sortOrder
    FROM plans
    WHERE active = 1
    ORDER BY sort_order ASC
  `).all().map(plan => ({
    ...plan,
    features: JSON.parse(plan.featuresJson || "{}"),
    prices: JSON.parse(plan.pricesJson || "{}"),
    localizedPrices: Object.fromEntries(Object.keys(CURRENCY_INFO).map(code => [code, pricingAmount(plan, code)])),
    featuresJson: undefined, pricesJson: undefined
  }));
  res.json({
    trial: { days: 30, access: "All tools", limits: TRIAL_LIMITS },
    plans
  });
});

app.get("/api/tools", async (req, res) => {
  res.json({ tools: TOOL_CATALOG });
});

app.get("/api/locale", async (req, res) => {
  const detected = await resolveLocale(req);
  const supported = Object.entries(CURRENCY_INFO).map(([code, info]) => ({ code, ...info, rateFromUsd: FALLBACK_RATES[code] || null }));
  res.json({ ...detected, currencyInfo: CURRENCY_INFO[detected.currency] || CURRENCY_INFO.USD, supportedCurrencies: supported, note: "Currency amounts for currencies outside the configured plan table use a conservative fallback FX rate. Refresh rates in production from your chosen FX provider before charging customers." });
});

app.get("/api/i18n", async (req, res) => {
  const language = String(req.query.lang || "en").toLowerCase().slice(0, 5);
  try {
    const translations = await getCompleteDictionary(language);
    res.json({ language, translations, translation: translationStatus() });
  } catch (error) {
    res.status(500).json({ error: "Translation service unavailable.", detail: isProduction ? undefined : error.message });
  }
});

app.post("/api/i18n/translate", requireSameOrigin, requireAuth, async (req, res) => {
  const language = String(req.body?.language || "en").toLowerCase().slice(0, 5);
  const texts = Array.isArray(req.body?.texts) ? req.body.texts : [];
  if (!texts.length) return res.status(400).json({ error: "No text supplied." });
  try {
    const translations = await translateTexts(texts, language);
    res.json({ language, translations, provider: translationStatus().provider });
  } catch (error) {
    res.status(502).json({ error: "Translation service unavailable.", detail: isProduction ? undefined : error.message });
  }
});

app.get("/api/i18n/status", requireAuth, async (req, res) => {
  res.json(translationStatus());
});

const toolUseSchema = z.object({
  toolKey: z.string().trim().min(1).max(120)
});

async function consumeToolUse(userId, toolKey, units = 1) {
  const tool = TOOL_CATALOG.find(item => item.key === toolKey);
  if (!tool) return { ok: false, status: 404, body: { error: "Tool not found." } };
  const result = await consumeEntitlement(userId, tool.key, units);
  if (!result.ok) return result;
  return { ...result, tool, usage: result.usage };
}

app.post("/api/tools/use", requireSameOrigin, requireAuth, async (req, res) => {
  const parsed = toolUseSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "A valid tool is required." });

  const requestedTool = TOOL_CATALOG.find(item => item.key === parsed.data.toolKey);
  if (!requestedTool) return res.status(404).json({ error: "Tool not found." });

  // Real tools consume usage only when their actual processing endpoint runs.
  if (requestedTool.implementation === "real") {
    return res.status(400).json({ error: "This tool records usage when processing starts." });
  }

  const result = await consumeToolUse(req.user.id, requestedTool.key);
  if (!result.ok) return res.status(result.status).json(result.body);

  res.status(201).json({ ok: true, tool: result.tool, usage: result.usage });
});

const pdfUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024, files: 1 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === "application/pdf" || file.originalname.toLowerCase().endsWith(".pdf")) cb(null, true);
    else cb(new Error("Only PDF files are accepted."));
  }
});

const pdfCompressionSchema = z.object({
  level: z.enum(["screen", "ebook", "printer"]).default("ebook")
});

app.post("/api/tools/pdf-compressor", requireSameOrigin, requireAuth, async (req, res) => {
  pdfUpload.single("file")(req, res, async error => {
    if (error) {
      const message = error.code === "LIMIT_FILE_SIZE" ? "PDF is too large. Maximum size is 25 MB." : error.message;
      return res.status(400).json({ error: message });
    }
    if (!req.file) return res.status(400).json({ error: "Please select a PDF file." });
    if (req.file.buffer.subarray(0, 5).toString() !== "%PDF-") {
      return res.status(400).json({ error: "The uploaded file is not a valid PDF." });
    }

    const parsed = pdfCompressionSchema.safeParse(req.body || {});
    if (!parsed.success) return res.status(400).json({ error: "Invalid compression level." });

    const charge = await consumeToolUse(req.user.id, "pdf-compressor");
    if (!charge.ok) return res.status(charge.status).json(charge.body);

    try {
      const compressed = await compressPdf(req.file.buffer, parsed.data.level);
      const originalBytes = req.file.buffer.length;
      const compressedBytes = compressed.length;
      const reduction = Math.max(0, (1 - compressedBytes / originalBytes) * 100);
      const originalName = path.basename(req.file.originalname).replace(/\.pdf$/i, "");
      const filename = `${originalName || "document"}-compressed.pdf`;

      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `attachment; filename="${filename.replace(/[^a-zA-Z0-9._-]/g, "_")}"`);
      res.setHeader("X-TAMPtools-Original-Bytes", String(originalBytes));
      res.setHeader("X-TAMPtools-Compressed-Bytes", String(compressedBytes));
      res.setHeader("X-TAMPtools-Reduction", reduction.toFixed(1));
      return res.send(compressed);
    } catch (error) {
      console.error("PDF compression failed:", error);
      return res.status(500).json({ error: "PDF compression failed. Make sure Ghostscript is installed on the server." });
    }
  });
});

app.get('/api/auth/google', (req,res) => {
  if (!googleConfigured()) return res.status(503).send('Google Sign-In is not configured.');
  const state = crypto.randomBytes(32).toString('base64url');
  setOAuthStateCookie(res,state);
  const u = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  u.searchParams.set('client_id',process.env.GOOGLE_CLIENT_ID);
  u.searchParams.set('redirect_uri',googleRedirectUri(req));
  u.searchParams.set('response_type','code');
  u.searchParams.set('scope','openid email profile');
  u.searchParams.set('state',state);
  u.searchParams.set('access_type','online');
  res.redirect(u.toString());
});

app.get('/api/auth/google/callback', async (req,res) => {
  try {
    if (!googleConfigured()) return res.status(503).send('Google Sign-In is not configured.');
    const {code,state,error} = req.query || {};
    const saved = getCookie(req,googleStateCookie);
    clearOAuthStateCookie(res);
    if (error) return res.redirect('/signin.html?oauth=cancelled');
    if (!code || !state || !saved || !crypto.timingSafeEqual(Buffer.from(String(state)),Buffer.from(String(saved)))) return res.status(400).send('Invalid Google OAuth state.');
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({code:String(code),client_id:process.env.GOOGLE_CLIENT_ID,client_secret:process.env.GOOGLE_CLIENT_SECRET,redirect_uri:googleRedirectUri(req),grant_type:'authorization_code'})});
    const tokens = await tokenResponse.json().catch(()=>({}));
    if (!tokenResponse.ok || !tokens.access_token) throw new Error('Google token exchange failed.');
    const profileResponse = await fetch('https://openidconnect.googleapis.com/v1/userinfo',{headers:{Authorization:`Bearer ${tokens.access_token}`}});
    const profile = await profileResponse.json().catch(()=>({}));
    if (!profileResponse.ok || !profile.sub || !profile.email || profile.email_verified !== true) throw new Error('Google account email could not be verified.');
    const subject=String(profile.sub), email=String(profile.email).toLowerCase();
    let identity=await db.prepare("SELECT user_id AS userId FROM oauth_identities WHERE provider='google' AND subject=?").get(subject);
    let user=identity ? await db.prepare("SELECT id,name,email,plan,trial_ends_at AS trialEndsAt FROM users WHERE id=?").get(identity.userId) : null;
    if (!user) user=await db.prepare("SELECT id,name,email,plan,trial_ends_at AS trialEndsAt FROM users WHERE lower(email)=?").get(email);
    if (!user) {
      const locale=await resolveLocale(req);
      const passwordHash=hashPassword(crypto.randomBytes(48).toString('base64url'));
      const now=new Date().toISOString().replace('T',' ').replace('Z','');
      const result=await db.prepare("INSERT INTO users (name,email,password_hash,auth_provider,auth_subject,plan,trial_started_at,trial_ends_at,language,currency,country_code,email_verified_at) VALUES (?,?,?,?,?,'Free',?,?,?,?,?,CURRENT_TIMESTAMP)").run(profile.name || email.split('@')[0],email,passwordHash,'google',subject,now,new Date(Date.now()+30*24*60*60*1000).toISOString().replace('T',' ').replace('Z',''),locale.language,locale.currency,locale.country);
      user=await db.prepare("SELECT id,name,email,plan,trial_ends_at AS trialEndsAt FROM users WHERE id=?").get(Number(result.lastInsertRowid));
    }
    if (!identity) await db.prepare("INSERT INTO oauth_identities (user_id,provider,subject,email) VALUES (?, 'google', ?, ?)").run(user.id,subject,email);
    const sessionToken=crypto.randomBytes(32).toString('base64url');
    await db.prepare("INSERT INTO sessions (token_hash,user_id,expires_at) VALUES (?,?,?)").run(hashToken(sessionToken),user.id,new Date(Date.now()+sessionMaxAgeMs).toISOString().replace('T',' ').replace('Z',''));
    setSessionCookie(res,sessionToken);
    await audit(user.id,'auth.google_signin',{},req);
    res.redirect('/dashboard.html');
  } catch (error) { console.error('Google Sign-In error:',error); res.redirect('/signin.html?oauth=error'); }
});

app.post("/api/auth/signup", authLimiter, requireSameOrigin, async (req, res) => {
  const parsed = signupSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Please provide a valid name, email and password of at least 8 characters." });

  const { name, email, password } = parsed.data;
  const existing = await db.prepare("SELECT id FROM users WHERE email = ?").get(email);
  if (existing) return res.status(409).json({ error: "An account with that email already exists." });

  const passwordHash = hashPassword(password);
  const locale = await resolveLocale(req);
  const result = await db.prepare(`
    INSERT INTO users (name, email, password_hash, plan, trial_started_at, trial_ends_at, language, currency, country_code, email_verified_at)
    VALUES (?, ?, ?, 'Free', ?, ?, ?, ?, ?, NULL)
  `).run(name, email, passwordHash, new Date().toISOString().replace("T", " ").replace("Z", ""), new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().replace("T", " ").replace("Z", ""), locale.language, locale.currency, locale.country);

  const userId = Number(result.lastInsertRowid);
  const token = crypto.randomBytes(32).toString("base64url");
  const expires = new Date(Date.now() + sessionMaxAgeMs).toISOString();

  await db.prepare(`
    INSERT INTO sessions (token_hash, user_id, expires_at)
    VALUES (?, ?, ?)
  `).run(hashToken(token), userId, expires.replace("T", " ").replace("Z", ""));

  setSessionCookie(res, token);
  const verifyToken = await issueAccountToken(userId,'email_verification',1440);
  let verificationSent=false;
  try { const mail=await sendAccountEmail({to:email,name,subject:'Verify your TAMPtools email',heading:`Hi ${name}, verify your email`,body:'Please verify your email address to secure your TAMPtools account.',link:accountUrl('verify-email.html',verifyToken),label:'Verify email'}); verificationSent=Boolean(mail.sent); } catch(error) { console.error('Verification email error:',error); }
  await audit(userId,'auth.signup',{country:locale.country,language:locale.language,currency:locale.currency,verificationSent},req);
  res.status(201).json({ user:{id:userId,name,email,plan:'Free',trial:true,emailVerified:false}, verification:{sent:verificationSent,required:true} });
});

app.post("/api/auth/signin", authLimiter, requireSameOrigin, async (req, res) => {
  const parsed = signinSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Please provide a valid email and password." });

  const { email, password } = parsed.data;
  const user = await db.prepare(`
    SELECT id, name, email, password_hash AS passwordHash, plan, trial_ends_at AS trialEndsAt
    FROM users WHERE email = ?
  `).get(email);

  if (!user || !verifyPassword(password, user.passwordHash)) {
    return res.status(401).json({ error: "Email or password is incorrect." });
  }

  const token = crypto.randomBytes(32).toString("base64url");
  const expires = new Date(Date.now() + sessionMaxAgeMs).toISOString();

  await db.prepare(`
    INSERT INTO sessions (token_hash, user_id, expires_at)
    VALUES (?, ?, ?)
  `).run(hashToken(token), user.id, expires.replace("T", " ").replace("Z", ""));

  setSessionCookie(res, token);
  await audit(user.id,'auth.signin',{},req);
  res.json({ user: { id: user.id, name: user.name, email: user.email, plan: user.plan, trial: trialActive(user), trialEndsAt: user.trialEndsAt } });
});

app.post("/api/auth/signout", requireSameOrigin, async (req, res) => {
  const cookies = parseCookies(req.headers.cookie);
  const token = cookies[cookieName];
  if (token) await db.prepare("DELETE FROM sessions WHERE token_hash = ?").run(hashToken(token));
  clearSessionCookie(res);
  res.json({ ok: true });
});

app.get('/api/support',(req,res)=>res.json({email:SUPPORT_EMAIL,whatsappAvailable:Boolean(WHATSAPP_SUPPORT_NUMBER),whatsappNumber:WHATSAPP_SUPPORT_NUMBER,whatsappUrl:WHATSAPP_SUPPORT_NUMBER?`https://wa.me/${WHATSAPP_SUPPORT_NUMBER}`:null}));
app.get("/api/auth/me", async (req, res) => {
  const user = await getCurrentUser(req);
  if (!user) return res.status(401).json({ error: "Not signed in." });
  res.json({
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      plan: user.plan,
      trial: trialActive(user),
      trialEndsAt: user.trialEndsAt,
      effectivePlan: await effectivePlanForUser(user).name,
      createdAt: user.createdAt,
      language: user.language || 'en',
      currency: user.currency || 'USD',
      countryCode: user.countryCode || null,
      emailVerified: Boolean(user.emailVerifiedAt)
    }
  });
});

app.get('/api/account', requireAuth, async (req,res)=>{
  const user=await db.prepare(`SELECT id,name,email,plan,trial_ends_at AS trialEndsAt,language,currency,country_code AS countryCode,email_verified_at AS emailVerifiedAt,created_at AS createdAt FROM users WHERE id=?`).get(req.user.id);
  if(!user)return res.status(404).json({error:'Account not found.'});
  const plan=await effectivePlanForUser(user);
  const used=await monthlyUsage(user.id);
  const limit=plan?.monthlyUses==null?null:Number(plan.monthlyUses);
  const storage=await storageUsage(user.id);
  const limitMb=Number(plan?.features?.storageMb??500);
  const recentUsage=await db.prepare(`SELECT tool_key AS toolKey,created_at AS createdAt FROM usage_events WHERE user_id=? ORDER BY id DESC LIMIT 8`).all(user.id);
  const savedProjects=await db.prepare(`SELECT id,name,tool_key AS toolKey,updated_at AS updatedAt FROM saved_projects WHERE user_id=? ORDER BY id DESC LIMIT 8`).all(user.id);
  const filesProcessed=Number(await db.prepare(`SELECT COUNT(*) AS n FROM user_files WHERE user_id=? AND status<>? AND created_at>=datetime('now','start of month')`).get(user.id,'deleted').n);
  const aiWork=Number(await db.prepare(`SELECT COUNT(*) AS n FROM usage_events WHERE user_id=? AND created_at>=datetime('now','start of month') AND (tool_key LIKE '%ai%' OR tool_key LIKE '%assistant%' OR tool_key LIKE '%content%' OR tool_key LIKE '%career%')`).get(user.id).n);
  const completed=Number(await db.prepare(`SELECT COUNT(*) AS n FROM usage_events WHERE user_id=? AND created_at>=datetime('now','start of month')`).get(user.id).n);
  res.json({user,plan:{name:plan?.name||user.plan||'Free',description:plan?.features?.description||'Your TAMPtools workspace'},usage:{used,limit,remaining:limit==null?null:Math.max(0,limit-used)},storage:{usedMb:Math.round(Number(storage.bytes)/1048576*10)/10,fileCount:Number(storage.count),limitMb},stats:{completed,filesProcessed,aiWork,storageMb:Math.round(Number(storage.bytes)/1048576*10)/10},recentUsage,savedProjects});
});



app.get('/api/auth/verify-email',async (req,res)=>{ const p=tokenSchema.safeParse(req.query||{}); if(!p.success)return res.status(400).json({error:'Verification token is missing or invalid.'}); const row=await db.prepare("SELECT id,user_id AS userId,expires_at AS expiresAt,used_at AS usedAt FROM account_tokens WHERE token_hash=? AND token_type='email_verification'").get(hashToken(p.data.token)); if(!row||row.usedAt||Date.parse(String(row.expiresAt).replace(' ','T')+'Z')<=Date.now())return res.status(400).json({error:'This verification link is expired or invalid.'}); await db.prepare("UPDATE users SET email_verified_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP WHERE id=?").run(row.userId); await db.prepare("UPDATE account_tokens SET used_at=CURRENT_TIMESTAMP WHERE id=?").run(row.id); await audit(row.userId,'auth.email_verified',{},req); res.json({ok:true,message:'Email verified successfully.'}); });
app.post('/api/auth/resend-verification',authLimiter,requireSameOrigin,requireAuth,async(req,res)=>{ const user=await db.prepare('SELECT id,name,email,email_verified_at AS emailVerifiedAt FROM users WHERE id=?').get(req.user.id); if(user.emailVerifiedAt)return res.json({ok:true,verified:true,message:'Your email is already verified.'}); const token=await issueAccountToken(user.id,'email_verification',1440); try { const mail=await sendAccountEmail({to:user.email,name:user.name,subject:'Verify your TAMPtools email',heading:'Verify your TAMPtools email',body:'Please verify your email address to secure your account.',link:accountUrl('verify-email.html',token),label:'Verify email'}); res.json({ok:true,sent:Boolean(mail.sent),configured:Boolean(mail.sent)}); } catch(error){ console.error(error); res.status(502).json({error:'Unable to send the verification email right now.'}); } });
app.post('/api/auth/forgot-password',authLimiter,requireSameOrigin,async(req,res)=>{ const p=forgotPasswordSchema.safeParse(req.body||{}); if(!p.success)return res.status(400).json({error:'Please provide a valid email address.'}); const user=await db.prepare('SELECT id,name,email FROM users WHERE email=?').get(p.data.email); if(user){ const token=await issueAccountToken(user.id,'password_reset',30); try { await sendAccountEmail({to:user.email,name:user.name,subject:'Reset your TAMPtools password',heading:'Reset your password',body:'We received a request to reset your TAMPtools password. This link expires in 30 minutes.',link:accountUrl('reset-password.html',token),label:'Reset password'}); } catch(error){ console.error(error); } await audit(user.id,'auth.password_reset.requested',{},req); } res.json({ok:true,message:'If an account exists for that email, a password reset link has been sent.'}); });
app.post('/api/auth/reset-password',authLimiter,requireSameOrigin,async (req,res)=>{ const p=resetPasswordSchema.safeParse(req.body||{}); if(!p.success)return res.status(400).json({error:'Please provide a valid reset token and a password of at least 8 characters.'}); const row=await db.prepare("SELECT id,user_id AS userId,expires_at AS expiresAt,used_at AS usedAt FROM account_tokens WHERE token_hash=? AND token_type='password_reset'").get(hashToken(p.data.token)); if(!row||row.usedAt||Date.parse(String(row.expiresAt).replace(' ','T')+'Z')<=Date.now())return res.status(400).json({error:'This reset link is expired or invalid.'}); await db.prepare('UPDATE users SET password_hash=?,updated_at=CURRENT_TIMESTAMP WHERE id=?').run(hashPassword(p.data.password),row.userId); await db.prepare('UPDATE account_tokens SET used_at=CURRENT_TIMESTAMP WHERE id=?').run(row.id); await db.prepare('DELETE FROM sessions WHERE user_id=?').run(row.userId); const token=crypto.randomBytes(32).toString('base64url'); await db.prepare('INSERT INTO sessions (token_hash,user_id,expires_at) VALUES (?,?,?)').run(hashToken(token),row.userId,new Date(Date.now()+sessionMaxAgeMs).toISOString().replace('T',' ').replace('Z','')); setSessionCookie(res,token); await audit(row.userId,'auth.password_reset.completed',{},req); res.json({ok:true,message:'Password reset successfully.'}); });


const imageGeneratorSchema = z.object({
  prompt: z.string().trim().min(10, "Describe the image in at least 10 characters.").max(4000),
  size: z.enum(["1024x1024", "1536x1024", "1024x1536"]).default("1024x1024")
});

const qrCodeSchema = z.object({
  content: z.string().trim().min(1, "Enter a link or text to encode.").max(1500, "Content is too long for a reliable QR code (max 1500 characters).")
});

const invoiceLineSchema = z.object({
  description: z.string().trim().min(1).max(200), detail: z.string().trim().max(300).optional().default(""),
  quantity: z.coerce.number().positive().max(100000), unitPrice: z.coerce.number().min(0).max(10000000)
});
const looseEmail = z.string().trim().max(200).optional().default("");
const invoiceSchema = z.object({
  fromName: z.string().trim().min(1, "Your business name is required.").max(160), fromEmail: looseEmail, fromPhone: z.string().trim().max(60).optional().default(""), fromAddress: z.string().trim().max(300).optional().default(""),
  clientName: z.string().trim().min(1, "Client name is required.").max(160), clientEmail: looseEmail, clientPhone: z.string().trim().max(60).optional().default(""), clientAddress: z.string().trim().max(300).optional().default(""),
  invoiceNumber: z.string().trim().max(60).optional().default(""), issueDate: z.string().trim().max(40).optional().default(""), dueDate: z.string().trim().max(40).optional().default(""), reference: z.string().trim().max(100).optional().default(""),
  currency: z.enum(INVOICE_CURRENCIES).default("NGN"), taxRate: z.coerce.number().min(0).max(100).optional().default(0), discountRate: z.coerce.number().min(0).max(100).optional().default(0), discountAmount: z.coerce.number().min(0).max(100000000).optional().default(0),
  template: z.enum(INVOICE_TEMPLATES).optional().default("classic"), accentColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional().default("#5d2de6"), logoDataUrl: z.string().max(700000).optional().default(""),
  paymentTerms: z.string().trim().max(500).optional().default(""), paymentLink: z.string().trim().max(500).optional().default(""), bankDetails: z.string().trim().max(800).optional().default(""), notes: z.string().trim().max(1500).optional().default(""), footerNote: z.string().trim().max(200).optional().default("Thank you for your business."),
  items: z.array(invoiceLineSchema).min(1, "Add at least one line item.").max(100)
});

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

const assistantSchema = z.object({
  messages: z.array(z.object({ role:z.enum(["user","assistant"]), content:z.string().trim().min(1).max(6000) })).min(1).max(40),
  context: z.string().trim().max(6000).optional().default(""),
  preferredProvider: z.string().trim().max(40).optional()
});
const ASSISTANT_TOOLS = [
  ["mail-manager","Mail Manager","search, organize, archive and write email"],["image-studio","Image Studio","edit, enhance, resize, convert and process images"],
  ["document-pdf-studio","Document & PDF Studio","create, merge, split, compress, extract and organize documents"],["storage-manager","Storage Manager","scan, find duplicates, organize and safely clean files"],
  ["zip-file-toolkit","ZIP & File Toolkit","zip, unzip, package and manage archives"],["batch-studio","Batch Studio","run operations across many files"],
  ["invoice-generator","Invoice Generator","create professional invoices"],["proposal-builder","Proposal Builder","build structured business proposals"],
  ["qr-code-generator","QR Code Generator","create branded QR codes"],["spreadsheet-data-cleaner","Spreadsheet & Data Cleaner","clean and normalize spreadsheet data"],
  ["resume-builder","Resume Builder","create and tailor resumes"],["cover-letter-builder","Cover Letter Builder","create job-specific cover letters"],
  ["career-profile-writer","Career/Profile Writer","write bios, summaries and applications"],["content-studio","Content Studio","write blogs, website copy, reports and business content"]
].map(([key,name,description])=>({key,name,description}));
function discoverTools(q){ const words=String(q).toLowerCase().split(/\W+/).filter(Boolean); return ASSISTANT_TOOLS.map(t=>({...t,score:words.reduce((n,w)=>n+(t.name.toLowerCase().includes(w)||t.description.includes(w)||t.key.includes(w)?1:0),0)})).filter(x=>x.score>0).sort((a,b)=>b.score-a.score).slice(0,5); }
function makePlan(command){
 const found=discoverTools(command); const lower=command.toLowerCase(); const steps=[];
 if(/zip|package|archive/.test(lower)) steps.push({tool:"ZIP & File Toolkit",action:"package selected outputs"});
 if(/rename/.test(lower)) steps.push({tool:"Batch Studio",action:"rename files"});
 if(/compress|resize|convert|watermark/.test(lower)) steps.push({tool:"Image Studio",action:"process files"});
 if(/pdf|document|ocr|extract/.test(lower)) steps.push({tool:"Document & PDF Studio",action:"process document"});
 if(/email|mail/.test(lower)) steps.push({tool:"Mail Manager",action:"prepare or organize email"});
 if(!steps.length && found.length) steps.push({tool:found[0].name,action:"open recommended workspace"});
 return {tools:found,steps,requiresApproval:steps.length>0};
}
app.get('/api/assistant/tools',requireAuth,async (req,res)=>res.json({tools:ASSISTANT_TOOLS}));
app.post('/api/assistant/plan',requireSameOrigin,requireAuth,async (req,res)=>{const command=String(req.body?.command||'').trim();if(!command)return res.status(400).json({error:'Enter a command.'});res.json(makePlan(command));});
app.post('/api/assistant/chat',requireSameOrigin,requireAuth,async(req,res)=>{
 const parsed=assistantSchema.safeParse(req.body||{}); if(!parsed.success)return res.status(400).json({error:parsed.error.issues[0]?.message||'Invalid assistant request.'});
 const charge=await consumeAiJob(req.user.id,'tamp-assistant'); if(!charge.ok)return res.status(charge.status).json(charge.body);
 const recent=parsed.data.messages.slice(-18); const latest=recent.at(-1)?.content||''; const plan=makePlan(latest);
 const system=["You are TAMP Assistant, the cross-platform AI assistant inside TAMPtools.","Help users discover tools, understand files/documents, generate or rewrite content, analyze information, and plan multi-step workflows across TAMPtools.","When a request involves an operation, clearly state the recommended tool/workflow. Do not claim an operation was executed unless TAMPtools actually executed it.","Never invent file contents, user facts, business numbers, regulations, or completed job results. Ask for missing inputs when needed.","Keep answers practical and concise.",`Available tools: ${ASSISTANT_TOOLS.map(x=>x.name).join(', ')}.`,plan.steps.length?`Suggested workflow: ${plan.steps.map(x=>x.tool+' → '+x.action).join(' | ')}`:'',parsed.data.context?`Current context: ${parsed.data.context}`:''].filter(Boolean).join(' ');
 try{const result=await generateText({system,messages:[{role:'system',content:system},...recent],maxTokens:1400,preferredProvider:parsed.data.preferredProvider,userId:req.user.id,operation:'tamp-assistant',estimatedCredits:charge.estimatedCredits,chargedCredits:charge.chargedCredits}); await audit(req.user.id,'assistant.replied',{provider:result.provider,model:result.model,tools:plan.tools.map(x=>x.key),turns:recent.length},req);res.json({reply:result.text,provider:result.provider,model:result.model,plan,usage:charge.usage});}catch(e){res.status(502).json({error:'Unable to get an AI response right now.'});}
});
app.post('/api/assistant/jobs',requireSameOrigin,requireAuth,async (req,res)=>{const command=String(req.body?.command||'').trim();if(!command)return res.status(400).json({error:'Enter a command.'});const plan=makePlan(command);const r=await db.prepare('INSERT INTO assistant_jobs(user_id,command,status,plan_json,progress) VALUES(?,?,?,?,?)').run(req.user.id,command,'planned',JSON.stringify(plan),0);await audit(req.user.id,'assistant.job.created',{jobId:Number(r.lastInsertRowid),steps:plan.steps.length},req);res.status(201).json({job:{id:Number(r.lastInsertRowid),status:'planned',progress:0,plan}});});
app.get('/api/assistant/jobs',requireAuth,async (req,res)=>res.json({jobs:await db.prepare('SELECT id,command,status,progress,error,created_at AS createdAt,updated_at AS updatedAt FROM assistant_jobs WHERE user_id=? ORDER BY id DESC LIMIT 50').all(req.user.id)}));
app.get('/api/assistant/jobs/:id',requireAuth,async (req,res)=>{const job=await db.prepare('SELECT id,command,status,progress,error,plan_json AS planJson,result_json AS resultJson,created_at AS createdAt,updated_at AS updatedAt FROM assistant_jobs WHERE id=? AND user_id=?').get(Number(req.params.id),req.user.id);if(!job)return res.status(404).json({error:'Job not found.'});res.json({job:{...job,plan:JSON.parse(job.planJson||'{}'),result:JSON.parse(job.resultJson||'{}')}});});
app.get('/api/assistant/conversations',requireAuth,async (req,res)=>res.json({conversations:await db.prepare('SELECT id,title,created_at AS createdAt,updated_at AS updatedAt FROM assistant_conversations WHERE user_id=? ORDER BY updated_at DESC LIMIT 50').all(req.user.id)}));
app.post('/api/assistant/conversations',requireSameOrigin,requireAuth,async (req,res)=>{const title=String(req.body?.title||'New conversation').slice(0,120);const r=await db.prepare('INSERT INTO assistant_conversations(user_id,title,messages_json) VALUES(?,?,?)').run(req.user.id,title,'[]');res.status(201).json({id:Number(r.lastInsertRowid),title});});


const CONTENT_TYPES = {
  "product-description": "an e-commerce product description",
  "landing-page": "landing page copy (headline, subheadline, body, and a closing call to action)",
  "ad-copy": "short paid-ad copy",
  "newsletter": "an email newsletter section",
  "press-release": "a short press release",
  "about-page": "an 'About us' page section",
  "faq": "a set of FAQ questions with answers",
  "service-description": "a description of a service offering",
  "social-bio": "a short social media bio"
};

const contentWriterSchema = z.object({
  contentType: z.enum(Object.keys(CONTENT_TYPES)),
  subject: z.string().trim().min(3, "Describe what you're writing about.").max(2000),
  audience: z.string().trim().max(300).optional().default(""),
  keyPoints: z.string().trim().max(2500).optional().default(""),
  tone: z.enum(["professional", "conversational", "playful", "premium", "urgent", "warm"]).default("professional"),
  length: z.enum(["short", "medium", "long"]).default("medium"),
  variants: z.coerce.number().int().min(1).max(3).default(2)
});

app.post("/api/tools/ai-content-writer", requireSameOrigin, requireAuth, async (req, res) => {
  const parsed = contentWriterSchema.safeParse(req.body || {});
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message || "Please check the content details." });
  const charge = await consumeAiJob(req.user.id,'ai-content-writer');
  if (!charge.ok) return res.status(charge.status).json(charge.body);
  const d = parsed.data;

  const lengthGuide = { short: "Keep it tight — around 60-90 words.", medium: "Around 150-220 words.", long: "Around 350-450 words." }[d.length];
  const context = [
    `Write ${CONTENT_TYPES[d.contentType]}.`,
    `Subject: ${d.subject}`,
    d.audience ? `Audience: ${d.audience}` : "",
    d.keyPoints ? `Points that must appear:\n${d.keyPoints}` : "",
    `Tone: ${d.tone}`,
    lengthGuide
  ].filter(Boolean).join("\n");

  const system = 'You are TAMPtools Content Studio. Write clear, specific marketing and business copy. Never invent product features, pricing, guarantees, review counts, awards, or statistics that were not provided — if a proof point would strengthen the copy, use a clearly marked placeholder like [add your own figure] instead of fabricating one. Avoid empty superlatives ("world-class", "revolutionary", "game-changing") and filler openings.';

  // Distinct angles rather than three near-identical rewrites — the point of
  // variants is to give a real choice, not the same copy with synonyms swapped.
  const angles = [
    "Lead with the main benefit to the reader.",
    "Lead with the problem the reader currently has, then resolve it.",
    "Lead with what makes this specifically different from the alternatives."
  ];

  try {
    const drafts = await Promise.all(Array.from({ length: d.variants }, async (_, i) => {
      const result = await generateText({
        system,
        prompt: `${context}\n\nApproach for this version: ${angles[i] || angles[0]}\n\nOutput only the copy itself — no title, no commentary, no markdown formatting characters.`,
        maxTokens: 900
      });
      return { angle: angles[i] || angles[0], text: (result.text || "").trim(), provider: result.provider };
    }));
    const kept = drafts.filter(v => v.text);
    if (!kept.length) throw new Error("No content was generated.");
    await audit(req.user.id, "content.generated", { provider: kept[0]?.provider, contentType: d.contentType, variants: kept.length }, req);
    res.json({ variants: kept, provider: kept[0]?.provider, usage: charge.usage });
  } catch (error) {
    console.error("Content writer error:", error);
    res.status(502).json({ error: "Unable to generate the content right now." });
  }
});

const mailImportSchema = z.object({ provider: z.string().trim().max(40).optional().default('import'), accountEmail: z.string().trim().email().max(254).optional(), folder: z.string().trim().max(80).optional().default('Inbox') });
const mailImapSchema = z.object({ accountEmail:z.string().trim().email('Enter a valid mailbox email.').max(254), host:z.string().trim().min(1,'IMAP host is required.').max(255), port:z.coerce.number().int().min(1).max(65535).default(993), secure:z.coerce.boolean().default(true), username:z.string().trim().min(1,'IMAP username is required.').max(254), password:z.string().min(1,'IMAP password is required.').max(500), folder:z.string().trim().max(120).default('INBOX') });
async function mailImapSecretKey(userId, connectionId){ return `mail-imap:${userId}:${connectionId}`; }
async function openImapConnection(creds){
  let ImapFlow;
  try { ({ ImapFlow } = await import('imapflow')); } catch { throw new Error('IMAP support is not installed. Run npm install in backend.'); }
  const client=new ImapFlow({host:creds.host,port:Number(creds.port||993),secure:Boolean(creds.secure),auth:{user:creds.username,pass:creds.password},logger:false});
  await client.connect();
  return client;
}
async function syncImapMailbox(userId, connectionId, creds){
  let simpleParser;
  try { ({ simpleParser } = await import('mailparser')); } catch { throw new Error('Mail parser support is not installed. Run npm install in backend.'); }
  const client=await openImapConnection(creds); let imported=0,duplicates=0;
  try { const lock=await client.getMailboxLock(creds.folder||'INBOX'); try {
      const total=Number(client.mailbox?.exists||0); const start=Math.max(1,total-499); const rows=[];
      if(total>0) for await (const msg of client.fetch(`${start}:*`,{uid:true,source:true,flags:true,internalDate:true})) rows.push(msg);
      for(const msg of rows){ const parsed=await simpleParser(msg.source); const attachmentNames=(parsed.attachments||[]).map(a=>a.filename).filter(Boolean); const m={senderName:parsed.from?.value?.[0]?.name||'',senderEmail:parsed.from?.value?.[0]?.address||'',subject:parsed.subject||'',bodyText:parsed.text||'',sentAt:parsed.date?parsed.date.toISOString():msg.internalDate?.toISOString()||'',attachmentNames}; const h=mailHash(m); if(await db.prepare('SELECT id FROM mail_messages WHERE user_id=? AND content_hash=?').get(userId,h)){duplicates++;continue;} await db.prepare(`INSERT INTO mail_messages(user_id,connection_id,message_uid,sender_name,sender_email,subject,body_text,sent_at,has_attachments,attachment_names_json,folder_name,is_read,content_hash) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(userId,connectionId,String(msg.uid),m.senderName,m.senderEmail,m.subject,m.bodyText,m.sentAt,attachmentNames.length?1:0,JSON.stringify(attachmentNames),creds.folder||'INBOX',msg.flags?.has?.('\\Seen')?1:0,h); imported++; }
    } finally { lock.release(); }
  } finally { await client.logout().catch(()=>{}); }
  return {imported,duplicates};
}
const mailSearchSchema = z.object({ q:z.string().trim().max(300).optional().default(''), sender:z.string().trim().max(254).optional().default(''), from:z.string().trim().max(40).optional().default(''), to:z.string().trim().max(40).optional().default(''), attachment:z.enum(['any','yes','no']).optional().default('any'), folder:z.string().trim().max(80).optional().default(''), read:z.enum(['any','read','unread']).optional().default('any'), starred:z.enum(['any','yes']).optional().default('any') });
const mailBulkSchema = z.object({ ids:z.array(z.number().int().positive()).max(500), action:z.enum(['read','unread','star','unstar','flag','unflag','archive','delete','move','label']), value:z.string().trim().max(100).optional().default('') });
async function mailRow(userId,id){ return await db.prepare(`SELECT * FROM mail_messages WHERE user_id=? AND id=?`).get(userId,id); }
function parseMailText(raw){
  const normalized=String(raw||'').replace(/\r\n/g,'\n'); const split=normalized.split(/\n\n/); const head=split.shift()||''; const body=split.join('\n\n');
  const headers={}; let last=''; for(const line of head.split('\n')){ if(/^\s/.test(line)&&last){headers[last]+=' '+line.trim();continue;} const m=line.match(/^([^:]+):\s*(.*)$/); if(m){last=m[1].toLowerCase();headers[last]=m[2];} }
  const from=headers.from||''; const fm=from.match(/^(.*?)\s*<([^>]+)>$/); const senderEmail=(fm?fm[2]:from).trim(); const senderName=(fm?fm[1]:from).replace(/^"|"$/g,'').trim();
  const subject=headers.subject||''; const date=headers.date||''; const msgId=headers['message-id']||crypto.randomUUID();
  const attachments=[]; const attachRe=/filename\*?\s*=\s*(?:"([^"]+)"|([^;\n]+))/gi; let am; while((am=attachRe.exec(head))) attachments.push((am[1]||am[2]).trim());
  return {senderName,senderEmail,subject,sentAt:date,bodyText:body.replace(/--\s*\n[\s\S]*$/,''),hasAttachments:attachments.length?1:0,attachmentNames:attachments,messageUid:msgId};
}
function mailHash(m){return crypto.createHash('sha256').update(JSON.stringify([m.senderEmail,m.subject,m.bodyText,m.sentAt,m.attachmentNames])).digest('hex');}
function mailArchiveEncrypt(payload,password){const salt=crypto.randomBytes(16),iv=crypto.randomBytes(12),key=crypto.scryptSync(password,salt,32);const cipher=crypto.createCipheriv('aes-256-gcm',key,iv);const enc=Buffer.concat([cipher.update(JSON.stringify(payload),'utf8'),cipher.final()]);return Buffer.concat([Buffer.from('TAMPMail1\0'),salt,iv,cipher.getAuthTag(),enc]);}
function mailArchiveDecrypt(buf,password){if(!buf.subarray(0,9).equals(Buffer.from('TAMPMail1\0')))throw new Error('Invalid TAMP mail archive.');const salt=buf.subarray(9,25),iv=buf.subarray(25,37),tag=buf.subarray(37,53),enc=buf.subarray(53);const key=crypto.scryptSync(password,salt,32);const decipher=crypto.createDecipheriv('aes-256-gcm',key,iv);decipher.setAuthTag(tag);return JSON.parse(Buffer.concat([decipher.update(enc),decipher.final()]).toString('utf8'));}
async function mailQuery(userId,d){let sql=`SELECT * FROM mail_messages WHERE user_id=?`,args=[userId];if(d.q){sql+=` AND (subject LIKE ? OR body_text LIKE ? OR sender_email LIKE ? OR sender_name LIKE ?)`;const q='%'+d.q+'%';args.push(q,q,q,q);}if(d.sender){sql+=' AND sender_email LIKE ?';args.push('%'+d.sender+'%');}if(d.from){sql+=' AND sent_at>=?';args.push(d.from);}if(d.to){sql+=' AND sent_at<=?';args.push(d.to+' 23:59:59');}if(d.attachment==='yes')sql+=' AND has_attachments=1';if(d.attachment==='no')sql+=' AND has_attachments=0';if(d.folder) {sql+=' AND folder_name=?';args.push(d.folder);}if(d.read==='read')sql+=' AND is_read=1';if(d.read==='unread')sql+=' AND is_read=0';if(d.starred==='yes')sql+=' AND is_starred=1';sql+=' ORDER BY COALESCE(sent_at,created_at) DESC LIMIT 500';return await db.prepare(sql).all(...args);}


app.get('/api/mail/oauth/:provider/start',requireAuth,async(req,res)=>{ const provider=String(req.params.provider); if(!['google','microsoft'].includes(provider)) return res.status(404).send('Unknown mail provider.'); if(provider==='google'&&!gmailMailConfigured()) return res.status(503).send('Google Mail integration is not configured.'); if(provider==='microsoft'&&!microsoftMailConfigured()) return res.status(503).send('Microsoft Mail integration is not configured.'); const state=oauthState(req.user.id); setMailOAuthCookie(res,provider,state); const u=new URL(provider==='google'?'https://accounts.google.com/o/oauth2/v2/auth':'https://login.microsoftonline.com/'+(process.env.MICROSOFT_TENANT_ID||'common')+'/oauth2/v2.0/authorize'); u.searchParams.set('client_id',provider==='google'?process.env.GOOGLE_CLIENT_ID:process.env.MICROSOFT_CLIENT_ID); u.searchParams.set('redirect_uri',mailOAuthRedirect(req,provider)); u.searchParams.set('response_type','code'); u.searchParams.set('state',state); u.searchParams.set('scope',provider==='google'?'openid email profile https://www.googleapis.com/auth/gmail.modify':'openid email profile offline_access User.Read Mail.ReadWrite'); u.searchParams.set('access_type','offline'); u.searchParams.set('prompt','consent'); res.redirect(u.toString()); });
app.get('/api/mail/oauth/:provider/callback',async(req,res)=>{ const provider=String(req.params.provider); try { const state=String(req.query.state||''),saved=getCookie(req,mailOAuthCookie(provider)); clearMailOAuthCookie(res,provider); const userId=oauthStateUser(state); if(!userId||!saved||state!==saved) throw new Error('Invalid mail OAuth state.'); const current=await getCurrentUser(req); if(!current||Number(current.id)!==userId) throw new Error('Your sign-in session expired.'); const code=String(req.query.code||''); if(!code) throw new Error('Mail provider authorization was cancelled.'); let tokenResponse; if(provider==='google'){ tokenResponse=await fetch('https://oauth2.googleapis.com/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({code,client_id:process.env.GOOGLE_CLIENT_ID,client_secret:process.env.GOOGLE_CLIENT_SECRET,redirect_uri:mailOAuthRedirect(req,'google'),grant_type:'authorization_code'})}); } else { tokenResponse=await fetch(`https://login.microsoftonline.com/${process.env.MICROSOFT_TENANT_ID||'common'}/oauth2/v2.0/token`,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({code,client_id:process.env.MICROSOFT_CLIENT_ID,client_secret:process.env.MICROSOFT_CLIENT_SECRET,redirect_uri:mailOAuthRedirect(req,'microsoft'),grant_type:'authorization_code',scope:'openid email profile offline_access User.Read Mail.ReadWrite'})}); } const tok=await tokenResponse.json().catch(()=>({})); if(!tokenResponse.ok||!tok.access_token) throw new Error('Mail provider token exchange failed.'); const profile=provider==='google'?await googleApi(tok.access_token,'https://openidconnect.googleapis.com/v1/userinfo'):await graphApi(tok.access_token,'https://graph.microsoft.com/v1.0/me'); const email=String(provider==='google'?profile.email:profile.mail||profile.userPrincipalName||'').toLowerCase(); if(!email) throw new Error('The provider did not return a mailbox address.'); const r=await db.prepare('INSERT OR IGNORE INTO mail_connections(user_id,provider,account_email,status,settings_json) VALUES(?,?,?,?,?)').run(userId,provider,email,'connected',JSON.stringify({provider})); const row=await db.prepare('SELECT id FROM mail_connections WHERE user_id=? AND provider=? AND account_email=?').get(userId,provider,email); const id=Number(row.id); tok.expires_at=Date.now()+Number(tok.expires_in||3600)*1000; await integrationSecretUpsert({key:mailSecretKey(userId,id),provider:`${provider}-mail`,value:JSON.stringify(tok),metadata:{userId,connectionId:id,accountEmail:email}}); res.redirect('/mail-manager.html?mail_connected='+provider); } catch(e){ console.error('Mail OAuth error:',e); res.redirect('/mail-manager.html?mail_error='+encodeURIComponent(e.message||'Mail connection failed.')); } });
app.post('/api/mail/connections/:id/test',requireSameOrigin,requireAuth,async(req,res)=>{try{const row=await db.prepare('SELECT * FROM mail_connections WHERE id=? AND user_id=?').get(Number(req.params.id),req.user.id); if(!row) return res.status(404).json({error:'Mail connection not found.'}); if(row.provider==='google'){await gmailToken(req.user.id,row.id);res.json({ok:true,message:'Gmail connection is valid.'});} else if(row.provider==='microsoft'){await microsoftToken(req.user.id,row.id);res.json({ok:true,message:'Microsoft connection is valid.'});} else return res.status(400).json({error:'Use the IMAP connection test for this mailbox.'});}catch(e){await db.prepare('UPDATE mail_connections SET status=? WHERE id=? AND user_id=?').run('error',Number(req.params.id),req.user.id);res.status(400).json({error:e.message});}});

app.get('/api/mail/messages',requireAuth,async (req,res)=>{const d=mailSearchSchema.parse(req.query||{});const rows=await mailQuery(req.user.id,d);res.json({messages:rows.map(r=>({...r,attachmentNames:JSON.parse(r.attachment_names_json||'[]')})),count:rows.length});});
app.get('/api/mail/connections',requireAuth,async (req,res)=>res.json({connections:await db.prepare('SELECT id,provider,account_email AS accountEmail,status,created_at AS createdAt FROM mail_connections WHERE user_id=? ORDER BY id DESC').all(req.user.id)}));
app.post('/api/mail/connections',requireSameOrigin,requireAuth,async (req,res)=>{const d=mailImportSchema.parse(req.body||{});const row=await db.prepare('INSERT OR IGNORE INTO mail_connections(user_id,provider,account_email,status,settings_json) VALUES(?,?,?,?,?)').run(req.user.id,d.provider,d.accountEmail||null,'ready','{}');res.status(201).json({connection:{id:Number(row.lastInsertRowid),provider:d.provider,accountEmail:d.accountEmail||null,status:'ready'}});});
app.post('/api/mail/imap/test',requireSameOrigin,requireAuth,async (req,res)=>{try{const parsed=mailImapSchema.safeParse(req.body||{});if(!parsed.success)return res.status(400).json({error:'Complete the IMAP fields before testing.',fields:parsed.error.flatten().fieldErrors});const client=await openImapConnection(parsed.data);await client.logout().catch(()=>{});res.json({ok:true,message:'IMAP connection works.'});}catch(e){console.error('IMAP test error:',e);res.status(400).json({error:e.message||'Unable to connect to this mail server.'});}});
app.post('/api/mail/imap/connect',requireSameOrigin,requireAuth,async (req,res)=>{try{const parsed=mailImapSchema.safeParse(req.body||{});if(!parsed.success)return res.status(400).json({error:'Complete the IMAP fields before connecting.',fields:parsed.error.flatten().fieldErrors});const d=parsed.data;const test=await openImapConnection(d);await test.logout().catch(()=>{});const r=await db.prepare('INSERT OR IGNORE INTO mail_connections(user_id,provider,account_email,status,settings_json) VALUES(?,?,?,?,?)').run(req.user.id,`imap:${d.host}`,d.accountEmail,'connected',JSON.stringify({host:d.host,port:d.port,secure:d.secure,username:d.username,folder:d.folder}));const id=Number(r.lastInsertRowid)||Number((await db.prepare('SELECT id FROM mail_connections WHERE user_id=? AND provider=? AND account_email=?').get(req.user.id,`imap:${d.host}`,d.accountEmail)).id);await integrationSecretUpsert({key:await mailImapSecretKey(req.user.id,id),provider:'mail-imap',value:JSON.stringify({host:d.host,port:d.port,secure:d.secure,username:d.username,password:d.password,folder:d.folder}),metadata:{userId:req.user.id,connectionId:id}});res.status(201).json({ok:true,connection:{id,provider:`imap:${d.host}`,accountEmail:d.accountEmail,status:'connected'}});}catch(e){console.error('IMAP connect error:',e);res.status(400).json({error:e.message||'Unable to connect this mailbox.'});}});
app.post('/api/mail/connections/:id/sync',requireSameOrigin,requireAuth,async(req,res)=>{try{const id=Number(req.params.id);const row=await db.prepare('SELECT * FROM mail_connections WHERE id=? AND user_id=?').get(id,req.user.id);if(!row)return res.status(404).json({error:'Mail connection not found.'});let result;if(row.provider==='google')result=await syncGoogleMailbox(req.user.id,id);else if(row.provider==='microsoft')result=await syncMicrosoftMailbox(req.user.id,id);else {const raw=await integrationSecretGet(await mailImapSecretKey(req.user.id,id));if(!raw)throw new Error('Mail credentials are not available. Reconnect this mailbox.');result=await syncImapMailbox(req.user.id,id,JSON.parse(raw));} await db.prepare('UPDATE mail_connections SET status=?,updated_at=CURRENT_TIMESTAMP,settings_json=? WHERE id=? AND user_id=?').run('connected',JSON.stringify({...JSON.parse(row.settings_json||'{}'),folders:result.folders||[],lastSyncAt:new Date().toISOString()}),id,req.user.id);res.json({ok:true,...result});}catch(e){console.error('Mail sync error:',e);const id=Number(req.params.id);await db.prepare('UPDATE mail_connections SET status=? WHERE id=? AND user_id=?').run('error',id,req.user.id);res.status(400).json({error:e.message||'Unable to sync this mailbox.'});}});
app.delete('/api/mail/connections/:id',requireSameOrigin,requireAuth,async(req,res)=>{const id=Number(req.params.id);const row=await db.prepare('SELECT id,provider FROM mail_connections WHERE id=? AND user_id=?').get(id,req.user.id);if(!row)return res.status(404).json({error:'Mail connection not found.'});if(row.provider==='google'){try{const tok=await mailTokenRecord(req.user.id,id);if(tok.access_token)await fetch('https://oauth2.googleapis.com/revoke?token='+encodeURIComponent(tok.access_token),{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'}});}catch{}}await db.prepare('DELETE FROM integration_secrets WHERE secret_key=?').run(secretKeySafe(mailSecretKey(req.user.id,id)));if(String(row.provider).startsWith('imap:'))await db.prepare('DELETE FROM integration_secrets WHERE secret_key=?').run(secretKeySafe(await mailImapSecretKey(req.user.id,id)));await db.prepare('DELETE FROM mail_connections WHERE id=? AND user_id=?').run(id,req.user.id);res.json({ok:true});});
const mailUpload=multer({storage:multer.memoryStorage(),limits:{files:500,fileSize:25*1024*1024}});
app.post('/api/mail/import',requireSameOrigin,requireAuth,mailUpload.array('files',500),async (req,res)=>{const d=mailImportSchema.parse({provider:req.body?.provider,accountEmail:req.body?.accountEmail,folder:req.body?.folder});let conn=await db.prepare('SELECT id FROM mail_connections WHERE user_id=? AND provider=? AND account_email IS ?').get(req.user.id,d.provider,d.accountEmail||null);if(!conn){const r=await db.prepare('INSERT INTO mail_connections(user_id,provider,account_email,status) VALUES(?,?,?,?)').run(req.user.id,d.provider,d.accountEmail||null,'import');conn={id:Number(r.lastInsertRowid)};}let imported=0,duplicates=0;for(const f of req.files||[]){if(!/\.eml$/i.test(f.originalname) && !/message\/rfc822/i.test(f.mimetype||''))continue;const m=parseMailText(f.buffer.toString('utf8'));const h=mailHash(m);if(await db.prepare('SELECT id FROM mail_messages WHERE user_id=? AND content_hash=?').get(req.user.id,h)){duplicates++;continue;}await db.prepare(`INSERT INTO mail_messages(user_id,connection_id,message_uid,sender_name,sender_email,subject,body_text,sent_at,has_attachments,attachment_names_json,folder_name,content_hash) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)`).run(req.user.id,conn.id,m.messageUid,m.senderName,m.senderEmail,m.subject,m.bodyText,m.sentAt||null,m.hasAttachments,JSON.stringify(m.attachmentNames),d.folder,h);imported++;}await audit(req.user.id,'mail.imported',{imported,duplicates},req);res.json({ok:true,imported,duplicates});});
app.post('/api/mail/smart-select',requireSameOrigin,requireAuth,async (req,res)=>{const d=mailSearchSchema.parse(req.body||{});const rows=await mailQuery(req.user.id,d);res.json({ids:rows.map(x=>x.id),count:rows.length});});
app.post('/api/mail/bulk',requireSameOrigin,requireAuth,async (req,res)=>{const d=mailBulkSchema.parse(req.body||{});const ids=d.ids;const placeholders=ids.map(()=>'?').join(',');if(!ids.length)return res.json({updated:0});const ownedRows=await db.prepare(`SELECT * FROM mail_messages WHERE user_id=? AND id IN (${placeholders})`).all(req.user.id,...ids);const owned=ownedRows.map(x=>x.id);let updated=0;for(const row of ownedRows){const id=row.id; if(row.connection_id){const conn=await db.prepare('SELECT * FROM mail_connections WHERE id=? AND user_id=?').get(row.connection_id,req.user.id); if(conn&&(conn.provider==='google'||conn.provider==='microsoft')){try{if(conn.provider==='google'){const t=await gmailToken(req.user.id,conn.id);let labels=[];if(d.action==='read')labels={addLabelIds:[],removeLabelIds:['UNREAD']};else if(d.action==='unread')labels={addLabelIds:['UNREAD'],removeLabelIds:[]};else if(d.action==='star')labels={addLabelIds:['STARRED'],removeLabelIds:[]};else if(d.action==='unstar')labels={addLabelIds:[],removeLabelIds:['STARRED']};else if(d.action==='archive')labels={addLabelIds:[],removeLabelIds:['INBOX']};else if(d.action==='delete'){await googleApi(t.access_token,`https://gmail.googleapis.com/gmail/v1/users/me/messages/${encodeURIComponent(row.message_uid)}/trash`,{method:'POST',body:'{}'});labels=null;}else if(d.action==='move'){let cfg=JSON.parse(conn.settings_json||'{}'),folders=cfg.folders||[],target=folders.find(x=>String(x.name).toLowerCase()===String(d.value||'').toLowerCase());if(!target){const created=await googleApi(t.access_token,'https://gmail.googleapis.com/gmail/v1/users/me/labels',{method:'POST',body:JSON.stringify({name:d.value||'Inbox',labelListVisibility:'labelShow',messageListVisibility:'show'})});target={id:created.id,name:created.name};folders.push(target);await db.prepare('UPDATE mail_connections SET settings_json=? WHERE id=? AND user_id=?').run(JSON.stringify({...cfg,folders}),conn.id,req.user.id);} labels={addLabelIds:[target.id],removeLabelIds:['INBOX']};} if(labels)await googleApi(t.access_token,`https://gmail.googleapis.com/gmail/v1/users/me/messages/${encodeURIComponent(row.message_uid)}/modify`,{method:'POST',body:JSON.stringify(labels)});}
else {const t=await microsoftToken(req.user.id,conn.id);const base=`https://graph.microsoft.com/v1.0/me/messages/${encodeURIComponent(row.message_uid)}`;if(d.action==='read'||d.action==='unread')await graphApi(t.access_token,base,{method:'PATCH',body:JSON.stringify({isRead:d.action==='read'})});else if(d.action==='delete')await graphApi(t.access_token,base,{method:'DELETE'});else if(d.action==='archive'||d.action==='move'){let cfg=JSON.parse(conn.settings_json||'{}'),folders=cfg.folders||[],name=d.action==='archive'?'Archive':(d.value||'Inbox'),target=folders.find(x=>String(x.name).toLowerCase()===String(name).toLowerCase());if(!target)throw new Error(`Microsoft folder '${name}' was not found.`);await graphApi(t.access_token,base+'/move',{method:'POST',body:JSON.stringify({destinationId:target.id})});} }
}catch(e){await db.prepare('UPDATE mail_connections SET status=? WHERE id=? AND user_id=?').run('error',conn.id,req.user.id);return res.status(400).json({error:e.message||'Mail provider action failed.'});}}}
if(d.action==='delete')await db.prepare('DELETE FROM mail_messages WHERE user_id=? AND id=?').run(req.user.id,id);else if(d.action==='move')await db.prepare('UPDATE mail_messages SET folder_name=?,updated_at=CURRENT_TIMESTAMP WHERE user_id=? AND id=?').run(d.value||'Inbox',req.user.id,id);else if(d.action==='label'){const lr=await db.prepare('INSERT OR IGNORE INTO mail_labels(user_id,name) VALUES(?,?)').run(req.user.id,d.value||'Label');const label=await db.prepare('SELECT id FROM mail_labels WHERE user_id=? AND name=?').get(req.user.id,d.value||'Label');await db.prepare('INSERT OR IGNORE INTO mail_message_labels(message_id,label_id) VALUES(?,?)').run(id,label.id);}else {const map={read:['is_read',1],unread:['is_read',0],star:['is_starred',1],unstar:['is_starred',0],flag:['is_flagged',1],unflag:['is_flagged',0],archive:['is_archived',1]};const x=map[d.action];if(x)await db.prepare(`UPDATE mail_messages SET ${x[0]}=?,folder_name=CASE WHEN ?='archive' THEN 'Archive' ELSE folder_name END,updated_at=CURRENT_TIMESTAMP WHERE user_id=? AND id=?`).run(x[1],d.action,req.user.id,id);}updated++;}await audit(req.user.id,'mail.bulk',{action:d.action,count:updated},req);res.json({ok:true,updated});});
app.get('/api/mail/duplicates',requireAuth,async (req,res)=>{const rows=await db.prepare(`SELECT content_hash,COUNT(*) count,MIN(id) keep_id,GROUP_CONCAT(id) ids FROM mail_messages WHERE user_id=? AND content_hash IS NOT NULL GROUP BY content_hash HAVING COUNT(*)>1`).all(req.user.id);res.json({groups:rows});});
app.post('/api/mail/export',requireSameOrigin,requireAuth,async (req,res)=>{const ids=z.array(z.number().int().positive()).max(500).parse(req.body?.ids||[]);if(!ids.length)return res.status(400).json({error:'Select at least one message.'});const ph=ids.map(()=>'?').join(',');const rows=await db.prepare(`SELECT * FROM mail_messages WHERE user_id=? AND id IN (${ph})`).all(req.user.id,...ids);const text=rows.map(m=>`From: ${m.senderName?m.senderName+' ':''}<${m.sender_email}>\nSubject: ${m.subject}\nDate: ${m.sent_at||''}\n\n${m.body_text}`).join('\n\n'+('-'.repeat(60))+'\n\n');const saved=await saveBuffer(req.user.id,'mail-manager','mail-export.eml',Buffer.from(text),'message/rfc822');res.json({downloadUrl:`/api/files/${saved.id}/download`,fileId:saved.id});});
app.post('/api/mail/archive',requireSameOrigin,requireAuth,async (req,res)=>{const p=z.object({ids:z.array(z.number().int().positive()).max(500),password:z.string().min(6).max(200)}).parse(req.body||{});const ph=p.ids.map(()=>'?').join(',');const rows=await db.prepare(`SELECT id,sender_name,sender_email,subject,body_text,body_html,sent_at,has_attachments,attachment_names_json,folder_name,is_read,is_starred,is_flagged FROM mail_messages WHERE user_id=? AND id IN (${ph})`).all(req.user.id,...p.ids);const payload={version:1,createdAt:new Date().toISOString(),messages:rows};const saved=await saveBuffer(req.user.id,'mail-manager','TAMP-mail-archive.tampmail',mailArchiveEncrypt(payload,p.password),'application/octet-stream');res.json({downloadUrl:`/api/files/${saved.id}/download`,fileId:saved.id});});
app.post('/api/mail/archive/unlock',requireSameOrigin,requireAuth,mailUpload.single('file'),async (req,res)=>{try{const password=String(req.body?.password||'');if(!req.file||!password)return res.status(400).json({error:'Archive and password are required.'});const payload=mailArchiveDecrypt(req.file.buffer,password);let imported=0;for(const m of payload.messages||[]){const h=mailHash({senderEmail:m.sender_email,subject:m.subject,bodyText:m.body_text,sentAt:m.sent_at,attachmentNames:JSON.parse(m.attachment_names_json||'[]')});if(await db.prepare('SELECT id FROM mail_messages WHERE user_id=? AND content_hash=?').get(req.user.id,h))continue;await db.prepare(`INSERT INTO mail_messages(user_id,sender_name,sender_email,subject,body_text,body_html,sent_at,has_attachments,attachment_names_json,folder_name,is_read,is_starred,is_flagged,content_hash) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(req.user.id,m.sender_name,m.sender_email,m.subject,m.body_text,m.body_html,m.sent_at,m.has_attachments,m.attachment_names_json,m.folder_name,m.is_read,m.is_starred,m.is_flagged,h);imported++;}res.json({ok:true,imported});}catch(e){res.status(400).json({error:'Unable to unlock archive. Check the password and archive.'});}});

const emailGenSchema = z.object({
  purpose: z.string().trim().min(5, "Describe what the email needs to say.").max(4000),
  recipient: z.string().trim().max(160).optional().default(""),
  senderName: z.string().trim().max(160).optional().default(""),
  tone: z.enum(["professional", "friendly", "formal", "direct", "apologetic", "enthusiastic"]).default("professional"),
  length: z.enum(["short", "medium", "detailed"]).default("medium"),
  keyPoints: z.string().trim().max(2000).optional().default("")
});

// Both email tools return a subject and body as separate fields so the UI can
// offer copy-subject / copy-body independently instead of one blob of text.
function splitSubjectAndBody(text) {
  const raw = String(text || "").trim();
  const match = raw.match(/^\s*subject\s*:\s*(.+?)\s*(?:\n|$)/i);
  if (!match) return { subject: "", body: raw };
  return { subject: match[1].trim(), body: raw.slice(match[0].length).replace(/^\s*(body\s*:)?\s*/i, "").trim() };
}

app.post("/api/tools/email-generator", requireSameOrigin, requireAuth, async (req, res) => {
  const parsed = emailGenSchema.safeParse(req.body || {});
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message || "Please describe the email you need." });
  const charge = await consumeAiJob(req.user.id,'email-generator');
  if (!charge.ok) return res.status(charge.status).json(charge.body);
  const d = parsed.data;
  const lengthGuide = { short: "Keep it under 90 words — 2 short paragraphs at most.", medium: "Around 120-180 words.", detailed: "Around 250-350 words, with clear paragraph breaks." }[d.length];
  const prompt = [
    `Write a ${d.tone} business email.`,
    d.recipient ? `Recipient: ${d.recipient}` : "",
    `Purpose: ${d.purpose}`,
    d.keyPoints ? `Points that must be included:\n${d.keyPoints}` : "",
    d.senderName ? `Sign off as: ${d.senderName}` : "",
    lengthGuide,
    'Start your response with a line in exactly this format: "Subject: <the subject line>" followed by a blank line, then the email body.'
  ].filter(Boolean).join("\n");
  try {
    const result = await generateText({
      system: 'You are TAMPtools Email Studio. Write clear, natural business emails that get to the point. Never invent facts, names, figures, dates, or commitments the user did not provide — if a detail is missing, use a clearly marked placeholder like [date]. Avoid stiff filler openings like "I hope this email finds you well".',
      prompt,
      maxTokens: 900
    });
    const { subject, body } = splitSubjectAndBody(result.text);
    await audit(req.user.id, "email.generated", { provider: result.provider }, req);
    res.json({ subject, body, provider: result.provider, usage: charge.usage });
  } catch (error) {
    console.error("Email generation error:", error);
    res.status(502).json({ error: "Unable to generate the email right now." });
  }
});

const coldEmailSchema = z.object({
  prospectName: z.string().trim().max(160).optional().default(""),
  prospectCompany: z.string().trim().max(160).optional().default(""),
  prospectRole: z.string().trim().max(160).optional().default(""),
  senderName: z.string().trim().max(160).optional().default(""),
  senderCompany: z.string().trim().max(160).optional().default(""),
  offer: z.string().trim().min(5, "Describe what you're offering.").max(3000),
  painPoint: z.string().trim().max(2000).optional().default(""),
  callToAction: z.string().trim().max(300).optional().default(""),
  tone: z.enum(["professional", "friendly", "direct", "casual"]).default("professional"),
  followUps: z.coerce.number().int().min(0).max(3).default(2)
});

app.post("/api/tools/cold-email-generator", requireSameOrigin, requireAuth, async (req, res) => {
  const parsed = coldEmailSchema.safeParse(req.body || {});
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message || "Please check the outreach details." });
  const charge = await consumeAiJob(req.user.id,'cold-email-generator');
  if (!charge.ok) return res.status(charge.status).json(charge.body);
  const d = parsed.data;

  const context = [
    d.prospectName ? `Prospect: ${d.prospectName}` : "Prospect: (name unknown — use a neutral greeting)",
    d.prospectRole ? `Their role: ${d.prospectRole}` : "",
    d.prospectCompany ? `Their company: ${d.prospectCompany}` : "",
    d.senderName || d.senderCompany ? `Sender: ${[d.senderName, d.senderCompany].filter(Boolean).join(" at ")}` : "",
    `What is being offered: ${d.offer}`,
    d.painPoint ? `The problem this solves for them: ${d.painPoint}` : "",
    `Desired next step: ${d.callToAction || "a short intro call"}`,
    `Tone: ${d.tone}`
  ].filter(Boolean).join("\n");

  const system = 'You are TAMPtools Cold Email Studio. Write short, human, ethical B2B outreach. Hard rules: under 120 words, one clear ask, no fabricated statistics or fake personalisation, no manipulative urgency, no spam-trigger phrasing. Never claim prior contact that did not happen. Always start with a line in exactly this format: "Subject: <subject line>" then a blank line, then the email body.';

  try {
    const steps = [{ label: "Initial email", brief: "Write the first cold outreach email. Open with something specific to them, not a generic compliment." }];
    for (let i = 1; i <= d.followUps; i++) {
      steps.push({
        label: `Follow-up ${i}`,
        brief: `Write follow-up number ${i}, sent about ${i * 4} days after the previous email with no reply. It must add a NEW angle or piece of value — never just "bumping this" or "circling back". Keep it shorter than the original.`
      });
    }
    const emails = await Promise.all(steps.map(async step => {
      const result = await generateText({ system, prompt: `${context}\n\n${step.brief}`, maxTokens: 500 });
      const { subject, body } = splitSubjectAndBody(result.text);
      return { label: step.label, subject, body, provider: result.provider };
    }));
    await audit(req.user.id, "email.cold.generated", { provider: emails[0]?.provider, count: emails.length }, req);
    res.json({ emails, provider: emails[0]?.provider, usage: charge.usage });
  } catch (error) {
    console.error("Cold email generation error:", error);
    res.status(502).json({ error: "Unable to generate the outreach sequence right now." });
  }
});

const blogPostSchema = z.object({
  topic: z.string().trim().min(5, "Enter a topic or working title.").max(300),
  audience: z.string().trim().max(300).optional().default(""),
  keyPoints: z.string().trim().max(3000).optional().default(""),
  tone: z.enum(["professional", "conversational", "authoritative", "friendly"]).default("conversational"),
  sectionCount: z.coerce.number().int().min(3).max(7).default(5),
  keyword: z.string().trim().max(120).optional().default(""),
  authorName: z.string().trim().max(160).optional().default("")
});

function renderArticleHtml(meta, sections) {
  const sectionHtml = sections.map(s => `<section><h2>${escapeHtml(s.heading)}</h2>${s.body.split(/\n{2,}/).map(p => {
    const lines = p.split("\n").filter(Boolean);
    const isList = lines.length > 1 && lines.every(l => /^\s*(?:[-*\u2022]|\d+[.)])\s+/.test(l));
    if (isList) return `<ul>${lines.map(l => `<li>${escapeHtml(l.replace(/^\s*(?:[-*\u2022]|\d+[.)])\s+/, ""))}</li>`).join("")}</ul>`;
    return `<p>${escapeHtml(p.replace(/\n/g, " "))}</p>`;
  }).join("")}</section>`).join("");

  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(meta.title)}</title><meta name="description" content="${escapeHtml(meta.metaDescription)}"><style>
    :root{--ink:#111936;--muted:#63708f;--line:#dfe4ef;--purple:#5d2de6}
    *{box-sizing:border-box}
    body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Inter,Georgia,serif;color:var(--ink);margin:0;background:#f7f8fc;line-height:1.75}
    .page{max-width:760px;margin:40px auto;background:#fff;box-shadow:0 20px 60px rgba(18,28,65,.10);border-radius:18px;padding:56px 60px 48px}
    .eyebrow{font-size:11px;font-weight:800;letter-spacing:.18em;text-transform:uppercase;color:var(--purple);margin:0 0 14px}
    h1{font-size:38px;line-height:1.2;margin:0 0 16px;letter-spacing:-.02em}
    .standfirst{font-size:18px;color:var(--muted);margin:0 0 10px}
    .byline{font-size:13px;color:var(--muted);padding-bottom:22px;border-bottom:1px solid var(--line);margin-bottom:8px}
    section{padding:22px 0}
    h2{font-size:23px;line-height:1.3;margin:0 0 12px;letter-spacing:-.01em}
    p{margin:0 0 16px;font-size:17px}
    ul{margin:0 0 16px;padding-left:22px}
    li{margin-bottom:8px;font-size:17px}
    .seo{margin-top:28px;padding:18px 20px;border:1px solid var(--line);border-radius:12px;background:#fbfcfe;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Inter,sans-serif}
    .seo h3{margin:0 0 10px;font-size:11px;font-weight:800;letter-spacing:.1em;text-transform:uppercase;color:var(--muted)}
    .seo p{font-size:13px;margin:0 0 8px;color:var(--muted)}
    .seo code{background:#eef1f8;padding:2px 6px;border-radius:5px;font-size:12px}
    .print-btn{position:fixed;right:24px;bottom:24px;padding:13px 22px;border:0;border-radius:10px;background:var(--purple);color:#fff;font-weight:700;font-size:14px;cursor:pointer;box-shadow:0 10px 28px rgba(93,45,230,.3)}
    @media print{body{background:#fff}.page{box-shadow:none;margin:0;max-width:none;border-radius:0;padding:0}.print-btn,.seo{display:none}section{break-inside:avoid}}
  </style></head><body>
    <article class="page">
      <p class="eyebrow">Article</p>
      <h1>${escapeHtml(meta.title)}</h1>
      ${meta.standfirst ? `<p class="standfirst">${escapeHtml(meta.standfirst)}</p>` : ""}
      <p class="byline">${meta.authorName ? `By ${escapeHtml(meta.authorName)} · ` : ""}${meta.wordCount} words · about ${meta.readingMinutes} min read</p>
      ${sectionHtml}
      <div class="seo">
        <h3>SEO details</h3>
        <p><strong>Meta description:</strong> ${escapeHtml(meta.metaDescription)}</p>
        <p><strong>Suggested slug:</strong> <code>${escapeHtml(meta.slug)}</code></p>
        ${meta.keyword ? `<p><strong>Target keyword:</strong> ${escapeHtml(meta.keyword)}</p>` : ""}
      </div>
    </article>
    <button class="print-btn" onclick="window.print()">Print / Save as PDF</button>
  </body></html>`;
}

app.post("/api/tools/blog-post-generator", requireSameOrigin, requireAuth, async (req, res) => {
  const parsed = blogPostSchema.safeParse(req.body || {});
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message || "Please check the article details." });
  const charge = await consumeAiJob(req.user.id,'blog-post-generator');
  if (!charge.ok) return res.status(charge.status).json(charge.body);
  const d = parsed.data;

  const context = [
    `Topic: ${d.topic}`,
    d.audience ? `Audience: ${d.audience}` : "",
    d.keyPoints ? `Points that must be covered:\n${d.keyPoints}` : "",
    d.keyword ? `Target keyword to use naturally: ${d.keyword}` : "",
    `Tone: ${d.tone}`
  ].filter(Boolean).join("\n");

  const system = 'You are TAMPtools Article Studio. Write substantive, specific content for small-business readers. Never invent statistics, studies, quotes, dates, or named sources — if evidence would help, describe the kind of evidence rather than fabricating a figure. Avoid filler openings ("In today\'s fast-paced world"), and avoid restating the heading as the first sentence.';

  try {
    // Outline first, then each section separately — asking for a whole article in
    // one call reliably produces evenly-shallow output with padded sections.
    const outlineResult = await generateText({
      system,
      prompt: `${context}\n\nProduce an outline of exactly ${d.sectionCount} section headings for this article. Output ONLY the headings, one per line, with no numbering, no markdown, and no commentary.`,
      maxTokens: 300
    });
    const headings = String(outlineResult.text || "")
      .split("\n").map(l => l.replace(/^\s*(?:[-*\u2022]|\d+[.)])\s*/, "").replace(/^#+\s*/, "").trim())
      .filter(Boolean).slice(0, d.sectionCount);
    if (!headings.length) throw new Error("Outline generation returned nothing.");

    const sections = await Promise.all(headings.map(async (heading, index) => {
      const brief = index === 0
        ? "This is the opening section. Set up the problem concretely and tell the reader what they'll get. 2-3 paragraphs."
        : index === headings.length - 1
          ? "This is the closing section. Summarise the practical takeaway and end with a concrete next action. 2 paragraphs."
          : "Write this section with specific, actionable detail — examples, steps, or trade-offs. 3-4 paragraphs, or a short list where it genuinely helps.";
      const result = await generateText({
        system,
        prompt: `${context}\n\nFull outline for context:\n${headings.join("\n")}\n\nWrite ONLY the "${heading}" section. ${brief} Do not repeat the heading in your output, and do not write any other section.`,
        maxTokens: 700
      });
      return { heading, body: (result.text || "").trim() };
    }));

    const kept = sections.filter(s => s.body);
    if (!kept.length) throw new Error("No sections were generated.");

    const metaResult = await generateText({
      system,
      prompt: `${context}\n\nArticle sections: ${headings.join("; ")}\n\nReturn exactly two lines and nothing else:\nLine 1: a compelling article title, under 70 characters.\nLine 2: an SEO meta description, 140-158 characters.`,
      maxTokens: 200
    });
    const metaLines = String(metaResult.text || "").split("\n").map(l => l.replace(/^(title|meta description)\s*:\s*/i, "").trim()).filter(Boolean);
    const title = metaLines[0] || d.topic;
    const metaDescription = metaLines[1] || `${d.topic} — a practical guide.`;
    const wordCount = kept.reduce((sum, s) => sum + s.body.split(/\s+/).filter(Boolean).length, 0);

    const meta = {
      title,
      metaDescription,
      standfirst: "",
      slug: title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 80),
      keyword: d.keyword,
      authorName: d.authorName,
      wordCount,
      readingMinutes: Math.max(1, Math.round(wordCount / 220))
    };

    const id = crypto.randomUUID();
    const filename = `article-${id}.html`;
    fs.writeFileSync(path.join(generatedDir, filename), renderArticleHtml(meta, kept), "utf-8");
    await audit(req.user.id, "blog.generated", { provider: outlineResult.provider, sections: kept.length }, req);
    res.status(201).json({ article: { url: `/generated/campaign-media/${filename}`, meta, sections: kept }, provider: outlineResult.provider, usage: charge.usage });
  } catch (error) {
    console.error("Blog post generation error:", error);
    res.status(502).json({ error: "Unable to generate the article right now." });
  }
});

const proposalItemSchema = z.object({
  description: z.string().trim().min(1).max(200),
  quantity: z.coerce.number().positive().max(100000).default(1),
  unitPrice: z.coerce.number().min(0).max(10000000)
});
const proposalSchema = z.object({
  fromName: z.string().trim().min(1, "Your business name is required.").max(160),
  fromEmail: z.string().trim().max(160).optional().default(""),
  fromPhone: z.string().trim().max(60).optional().default(""),
  fromAddress: z.string().trim().max(300).optional().default(""),
  clientName: z.string().trim().min(1, "Client name is required.").max(160),
  clientEmail: z.string().trim().max(160).optional().default(""),
  clientContact: z.string().trim().max(120).optional().default(""),
  projectTitle: z.string().trim().min(1, "Project title is required.").max(200),
  projectDescription: z.string().trim().max(3000).optional().default(""),
  scope: z.string().trim().min(10, "Describe the project scope in at least 10 characters.").max(5000),
  pricing: z.array(proposalItemSchema).min(1, "Add at least one pricing item.").max(100),
  currency: z.string().trim().max(6).optional().default("NGN"),
  taxRate: z.coerce.number().min(0).max(100).optional().default(0),
  discountRate: z.coerce.number().min(0).max(100).optional().default(0),
  timeline: z.string().trim().max(1200).optional().default(""),
  terms: z.string().trim().max(3000).optional().default(""),
  template: z.enum(["professional","modern","minimal","creative"]).optional().default("professional"),
  validityDays: z.coerce.number().int().min(1).max(365).optional().default(30),
  nextSteps: z.string().trim().max(1200).optional().default("")
});

function renderProposalHtml(d, totals) {
  const validUntil = new Date(Date.now() + d.validityDays * 86400000).toLocaleDateString(undefined, {year:"numeric",month:"long",day:"numeric"});
  const accent = ({professional:"#5d2de6",modern:"#111936",minimal:"#374151",creative:"#d35400"})[d.template] || "#5d2de6";
  const pricingRows = d.pricing.map(i=>`<tr><td><strong>${escapeHtml(i.description)}</strong></td><td>${i.quantity}</td><td style="text-align:right">${d.currency} ${Number(i.unitPrice).toFixed(2)}</td><td style="text-align:right">${d.currency} ${(i.quantity*i.unitPrice).toFixed(2)}</td></tr>`).join("");
  const bullets = String(d.scope).split(/\n|•|;/).map(x=>x.trim()).filter(Boolean).map(x=>`<li>${escapeHtml(x.replace(/^[-*]\s*/,""))}</li>`).join("");
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Proposal — ${escapeHtml(d.projectTitle)}</title><style>
  :root{--accent:${accent};--ink:#111936;--muted:#68728c;--line:#e1e5ee}*{box-sizing:border-box}body{margin:0;background:#f6f7fb;color:var(--ink);font-family:Inter,-apple-system,BlinkMacSystemFont,"Segoe UI",Arial,sans-serif;line-height:1.6}.page{max-width:900px;margin:32px auto;background:#fff;box-shadow:0 18px 55px rgba(30,35,70,.1);border-radius:20px;overflow:hidden}.cover{padding:58px 60px;color:#fff;background:linear-gradient(135deg,var(--accent),#ef7f2d)}.cover.minimal{background:#fff;color:var(--ink);border-bottom:4px solid var(--accent)}.eyebrow{font-size:11px;font-weight:800;letter-spacing:.16em;text-transform:uppercase;opacity:.8}.cover h1{font-size:38px;line-height:1.15;margin:8px 0}.cover p{margin:6px 0;opacity:.9}.meta{display:grid;grid-template-columns:repeat(4,1fr);gap:20px;padding:22px 60px;border-bottom:1px solid var(--line);background:#fbfcfe}.meta span{display:block;font-size:10px;font-weight:800;letter-spacing:.1em;text-transform:uppercase;color:var(--muted);margin-bottom:3px}.body{padding:20px 60px 45px}.section{padding:25px 0;border-bottom:1px solid var(--line)}h2{font-size:13px;text-transform:uppercase;letter-spacing:.1em;color:var(--accent);margin:0 0 10px}p{font-size:15px;margin:0 0 12px}ul{margin:0;padding-left:21px}li{margin:6px 0}table{width:100%;border-collapse:collapse;margin-top:12px}th,td{padding:11px 8px;border-bottom:1px solid var(--line);font-size:13px;text-align:left}th{font-size:10px;text-transform:uppercase;letter-spacing:.08em;color:var(--muted)}.totals{max-width:330px;margin:16px 0 0 auto}.totals div{display:flex;justify-content:space-between;padding:5px 0}.totals .grand{font-weight:900;font-size:18px;border-top:2px solid var(--ink);margin-top:5px;padding-top:10px}.footer{padding:25px 60px;background:#fbfcfe;color:var(--muted);font-size:12px}.print-btn{position:fixed;right:24px;bottom:24px;border:0;border-radius:10px;background:var(--accent);color:#fff;padding:12px 18px;font-weight:800;cursor:pointer}@media(max-width:720px){.page{margin:0;border-radius:0}.cover,.body,.footer{padding-left:22px;padding-right:22px}.meta{grid-template-columns:1fr 1fr;padding:18px 22px}.cover h1{font-size:30px}}@media print{body{background:#fff}.page{margin:0;max-width:none;box-shadow:none;border-radius:0}.print-btn{display:none}}
  </style></head><body><div class="page"><div class="cover ${d.template==='minimal'?'minimal':''}"><div class="eyebrow">Business Proposal</div><h1>${escapeHtml(d.projectTitle)}</h1><p>Prepared for ${escapeHtml(d.clientName)} by ${escapeHtml(d.fromName)}</p></div><div class="meta"><div><span>Client</span>${escapeHtml(d.clientName)}</div><div><span>Project</span>${escapeHtml(d.projectTitle)}</div><div><span>Valid until</span>${validUntil}</div><div><span>Currency</span>${escapeHtml(d.currency)}</div></div><div class="body">
  <section class="section"><h2>Project Overview</h2><p>${escapeHtml(d.projectDescription || "This proposal outlines the recommended scope, investment, timeline and terms for the project.")}</p></section>
  <section class="section"><h2>Scope of Work</h2><ul>${bullets}</ul></section>
  <section class="section"><h2>Pricing & Investment</h2><table><thead><tr><th>Description</th><th>Qty</th><th style="text-align:right">Unit Price</th><th style="text-align:right">Amount</th></tr></thead><tbody>${pricingRows}</tbody></table><div class="totals"><div><span>Subtotal</span><strong>${d.currency} ${totals.subtotal.toFixed(2)}</strong></div>${totals.discount?`<div><span>Discount</span><strong>-${d.currency} ${totals.discount.toFixed(2)}</strong></div>`:""}${totals.tax?`<div><span>Tax</span><strong>${d.currency} ${totals.tax.toFixed(2)}</strong></div>`:""}<div class="grand"><span>Total</span><span>${d.currency} ${totals.total.toFixed(2)}</span></div></div></section>
  ${d.timeline?`<section class="section"><h2>Timeline</h2><p>${escapeHtml(d.timeline)}</p></section>`:""}
  ${d.terms?`<section class="section"><h2>Terms</h2><p>${escapeHtml(d.terms).replace(/\n/g,"<br>")}</p></section>`:""}
  ${d.nextSteps?`<section class="section"><h2>Next Steps</h2><p>${escapeHtml(d.nextSteps).replace(/\n/g,"<br>")}</p></section>`:`<section class="section"><h2>Next Steps</h2><p>Confirm the scope and pricing, approve the proposal, and agree the project start date.</p></section>`}
  </div><div class="footer">Prepared by ${escapeHtml(d.fromName)}${d.fromEmail?` · ${escapeHtml(d.fromEmail)}`:""}${d.fromPhone?` · ${escapeHtml(d.fromPhone)}`:""}. This proposal is valid until ${validUntil}.</div></div><button class="print-btn" onclick="window.print()">Print / Save as PDF</button></body></html>`;
}


const qrUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 2 * 1024 * 1024, files: 1 } });
const qrTypes = new Set(['url','text','email','phone','sms','whatsapp','wifi','vcard','event','app','social','business','profile','coupon','feedback','video','images','pdf','menu','mp3','multiple-links','bitcoin','paypal']);
const dynamicQrTypes = new Set(['url','app','social','business','profile','coupon','feedback','video','images','pdf','menu','mp3','multiple-links']);
function qrPayload(d){
  const clean = x => String(x ?? '').trim();
  switch(d.type){
    case 'url': return clean(d.url);
    case 'text': return clean(d.text);
    case 'email': return `mailto:${clean(d.email)}${d.subject||d.body?`?${new URLSearchParams({...(d.subject?{subject:d.subject}:{}),...(d.body?{body:d.body}:{})}).toString()}`:''}`;
    case 'phone': return `tel:${clean(d.phone)}`;
    case 'sms': return `SMSTO:${clean(d.phone)}:${clean(d.message)}`;
    case 'whatsapp': return `https://wa.me/${clean(d.phone).replace(/\D/g,'')}?text=${encodeURIComponent(clean(d.message))}`;
    case 'wifi': return `WIFI:T:${clean(d.security)||'WPA'};S:${clean(d.ssid)};P:${clean(d.password)};H:${d.hidden?'true':'false'};;`;
    case 'vcard': return ['BEGIN:VCARD','VERSION:3.0',`FN:${clean(d.name)}`,d.org?`ORG:${clean(d.org)}`:'',d.title?`TITLE:${clean(d.title)}`:'',d.phone?`TEL:${clean(d.phone)}`:'',d.email?`EMAIL:${clean(d.email)}`:'',d.website?`URL:${clean(d.website)}`:'',d.address?`ADR:;;${clean(d.address)};;;;`: '', 'END:VCARD'].filter(Boolean).join('\n');
    case 'event': return `BEGIN:VEVENT\nSUMMARY:${clean(d.name)}\nDTSTART:${clean(d.start).replace(/[-:]/g,'')}\nLOCATION:${clean(d.location)}\nDESCRIPTION:${clean(d.description)}\nEND:VEVENT`;
    case 'app': return clean(d.url || d.android || d.ios);
    case 'social': return clean(d.url);
    case 'business': case 'profile': return clean(d.url || d.website);
    case 'coupon': case 'feedback': case 'video': case 'images': case 'pdf': case 'menu': case 'mp3': return clean(d.url);
    case 'multiple-links': return clean(d.url);
    case 'bitcoin': return `bitcoin:${clean(d.address)}${d.amount?`?amount=${encodeURIComponent(d.amount)}`:''}`;
    case 'paypal': return clean(d.url);
    default: return '';
  }
}
function qrLandingHtml(d, id){
  const esc = escapeHtml; const title = esc(d.title || ({url:'Website',app:'App',social:'Social links',business:'Business page',profile:'Profile',coupon:'Coupon',feedback:'Feedback',video:'Video',images:'Images',pdf:'PDF',menu:'Menu',mp3:'Audio','multiple-links':'Links'}[d.type]||'QR Code'));
  const action = esc(d.url || d.website || d.android || d.ios || d.target || '');
  const cta = d.type==='pdf'?'Open PDF':d.type==='video'?'Watch video':d.type==='images'?'View images':d.type==='mp3'?'Play audio':d.type==='menu'?'View menu':d.type==='coupon'?'View offer':d.type==='feedback'?'Leave feedback':'Continue';
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title><style>body{margin:0;background:#f5f3fb;color:#15152a;font-family:Inter,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}.card{max-width:620px;margin:8vh auto;padding:42px 32px;background:#fff;border-radius:24px;box-shadow:0 20px 70px rgba(35,20,80,.12);text-align:center}.brand{font-weight:900;letter-spacing:.08em;text-transform:uppercase;color:#5d2de6;font-size:12px}.card h1{font-size:32px;margin:12px 0}.card p{color:#69728a;line-height:1.65}.btn{display:inline-block;padding:13px 20px;background:#5d2de6;color:#fff;border-radius:12px;text-decoration:none;font-weight:800;margin-top:12px}.meta{margin-top:22px;padding-top:18px;border-top:1px solid #e7e8ef;font-size:12px;color:#8a92a5}</style></head><body><main class="card"><div class="brand">TAMPtools QR</div><h1>${title}</h1><p>${esc(d.description || d.message || 'Scan complete. Continue below.')}</p>${action?`<a class="btn" href="${action}" target="_blank" rel="noopener">${cta}</a>`:''}<div class="meta">Dynamic QR • Code ${esc(id.slice(0,8))}</div></main></body></html>`;
}
app.get('/qr/d/:id', async (req,res)=>{
  try{const id=String(req.params.id).replace(/[^a-zA-Z0-9_-]/g,''); const file=path.join(qrDir,`${id}.json`); if(!fs.existsSync(file))return res.status(404).send('QR code not found.'); const d=JSON.parse(fs.readFileSync(file,'utf8')); d.scans=Number(d.scans||0)+1; d.lastScanAt=new Date().toISOString(); fs.writeFileSync(file,JSON.stringify(d,null,2)); res.type('html').send(qrLandingHtml(d,id));}catch{res.status(404).send('QR code not found.');}
});
app.get('/api/tools/qr-code/:id/stats', requireAuth, async (req,res)=>{const id=String(req.params.id).replace(/[^a-zA-Z0-9_-]/g,'');const file=path.join(qrDir,`${id}.json`);if(!fs.existsSync(file))return res.status(404).json({error:'QR code not found.'});const d=JSON.parse(fs.readFileSync(file,'utf8'));if(Number(d.userId)!==Number(req.user.id))return res.status(403).json({error:'Not allowed.'});res.json({id,scans:Number(d.scans||0),lastScanAt:d.lastScanAt||null,type:d.type,title:d.title||''});});
app.get('/api/tools/qr-code/capabilities', requireAuth, async (req,res)=>{const plan=await getPlanForUser(req.user.id);const name=plan?.name||'Free';const lite=['Lite','Pro','Business','30-Day Trial'].includes(name);const pro=['Pro','Business','30-Day Trial'].includes(name);res.json({plan:name,features:{maxCodes:name==='Free'?10:name==='Lite'?100: name==='Pro'?1000:'Fair-use',staticTypes:name==='Free'?['url','text','email','phone','wifi','vcard']:lite?['url','text','email','phone','sms','whatsapp','wifi','vcard','event','bitcoin','paypal']:Array.from(qrTypes),dynamic:pro,branding:lite,logo:pro,design:lite,stats:pro,bulk:name==='Business',api:name==='Business',templates:lite}});});
app.post('/api/tools/qr-code', requireSameOrigin, requireAuth, qrUpload.single('logo'), async (req,res)=>{
  const body={...(req.body||{})}; if(!qrTypes.has(String(body.type)))return res.status(400).json({error:'Choose a supported QR code type.'});
  const cap=await (async()=>{const p=await getPlanForUser(req.user.id);const n=p?.name||'Free';return {plan:p,name:n, lite:['Lite','Pro','Business','30-Day Trial'].includes(n),pro:['Pro','Business','30-Day Trial'].includes(n),max:n==='Free'?10:n==='Lite'?100:n==='Pro'?1000:'Fair-use'};})();
  const usedQr=Number((await db.prepare("SELECT COUNT(*) AS count FROM usage_events WHERE user_id=? AND tool_key='qr-code-generator' AND created_at >= datetime('now','start of month')").get(req.user.id)).count||0);
  if(cap.max!=='Fair-use' && usedQr>=Number(cap.max))return res.status(403).json({error:`Your ${cap.name} plan has reached its QR code limit of ${cap.max} this month.`,code:'PLAN_FEATURE_LIMIT'});
  const charge=await consumeToolUse(req.user.id,'qr-code-generator'); if(!charge.ok)return res.status(charge.status).json(charge.body);
  if(!cap.lite && !['url','text','email','phone','wifi','vcard'].includes(body.type))return res.status(403).json({error:'This QR type is available on Lite and higher plans.',code:'PLAN_FEATURE_LIMIT'});
  const isDynamic=String(body.mode||'static')==='dynamic'; if(isDynamic&&!cap.pro)return res.status(403).json({error:'Dynamic QR codes are available on Pro and Business plans.',code:'PLAN_FEATURE_LIMIT'});
  if(req.file && !cap.pro)return res.status(403).json({error:'Logo branding is available on Pro and Business plans.',code:'PLAN_FEATURE_LIMIT'});
  if(!body.content) body.content=qrPayload(body); if(!body.content)return res.status(400).json({error:'Complete the required QR fields.'});
  try{
    let id=null, encoded=body.content;
    if(isDynamic){id=crypto.randomUUID(); const target=`/qr/d/${id}`; const record={id,userId:req.user.id,type:body.type,title:body.title||'',description:body.description||'',url:body.url||'',website:body.website||'',target,scans:0,createdAt:new Date().toISOString()}; fs.writeFileSync(path.join(qrDir,`${id}.json`),JSON.stringify(record,null,2)); const base=process.env.APP_BASE_URL||`${req.protocol}://${req.get('host')}`; encoded=`${base}${target}`;}
    const size=Math.min(2400,Math.max(256,Number(body.size||900))); const ec=['low','medium','quartile','high'].includes(body.errorCorrection)?body.errorCorrection:'quartile'; const dark=body.foreground||'#111936'; const light=body.background||'#ffffff';
    let png=await QRCode.toBuffer(encoded,{type:'png',width:size,errorCorrectionLevel:ec.toUpperCase(),margin:Math.min(8,Math.max(0,Number(body.margin||2))),color:{dark,light}});
    let svg=await QRCode.toString(encoded,{type:'svg',width:size,errorCorrectionLevel:ec.toUpperCase(),margin:Math.min(8,Math.max(0,Number(body.margin||2))),color:{dark,light}});
    if(req.file && cap.pro){const logo=await sharp(req.file.buffer).resize(Math.floor(size*.22),Math.floor(size*.22),{fit:'contain'}).png().toBuffer();const meta=await sharp(png).metadata();const w=meta.width||size,h=meta.height||size;png=await sharp(png).composite([{input:Buffer.from(`<svg width="${Math.floor(size*.24)}" height="${Math.floor(size*.24)}"><rect x="2" y="2" width="${Math.floor(size*.24)-4}" height="${Math.floor(size*.24)-4}" rx="${Math.floor(size*.04)}" fill="white"/></svg>`),left:Math.floor((w-size*.24)/2),top:Math.floor((h-size*.24)/2)},{input:logo,left:Math.floor((w-size*.22)/2),top:Math.floor((h-size*.22)/2)}]).png().toBuffer();const b64=logo.toString('base64');svg=svg.replace('</svg>',`<rect x="39%" y="39%" width="22%" height="22%" rx="4%" fill="white"/><image href="data:image/png;base64,${b64}" x="40%" y="40%" width="20%" height="20%" preserveAspectRatio="xMidYMid meet"/></svg>`);}
    const pngData=`data:image/png;base64,${png.toString('base64')}`; const svgData=svg; await audit(req.user.id,'qr.generated',{type:body.type,mode:isDynamic?'dynamic':'static',branded:Boolean(req.file)},req);
    res.status(201).json({qr:{type:body.type,mode:isDynamic?'dynamic':'static',content:encoded,png:pngData,svg:svgData,dynamicId:id,dynamicUrl:isDynamic?encoded:null},usage:charge.usage,plan:cap.name});
  }catch(error){console.error('QR generation error:',error);res.status(500).json({error:'Unable to generate the QR code right now.'});}
});

app.get('/api/tools/invoice-generator/capabilities', requireAuth, async (req,res)=>{
  const plan=await getPlanForUser(req.user.id); const name=plan?.name||'Free'; const lite=['Lite','Pro','Business','30-Day Trial'].includes(name); const pro=['Pro','Business','30-Day Trial'].includes(name);
  const maxItems=name==='Free'?8:pro?100:25; const maxInvoices=plan?.features?.invoices ?? (name==='Free'?5:50); const templates=name==='Free'?['classic','minimal']:pro?INVOICE_TEMPLATES:['classic','minimal','modern','bold'];
  res.json({plan:name,features:{maxItems,maxInvoices,templates,branding:lite,customColors:lite,logo:pro,savedDrafts:name==='Free'?3:name==='Lite'?20:'All',duplicate:lite,recurring:pro,paymentLink:pro,sharedTemplates:name==='Business'}});
});
app.post('/api/tools/invoice-generator/preview', requireSameOrigin, requireAuth, async (req,res)=>{
  const parsed=invoiceSchema.safeParse(req.body||{});if(!parsed.success)return res.status(400).json({error:parsed.error.issues[0]?.message||'Please check the invoice details.'});const d=parsed.data;const plan=await getPlanForUser(req.user.id);const name=plan?.name||'Free';const lite=['Lite','Pro','Business','30-Day Trial'].includes(name);const pro=['Pro','Business','30-Day Trial'].includes(name);if(!lite&&!['classic','minimal'].includes(d.template))return res.status(403).json({error:'Modern and Bold templates are available on Lite and higher plans.'});if(d.template==='executive'&&!pro)return res.status(403).json({error:'Executive template is available on Pro and Business plans.'});if(d.logoDataUrl&&!pro)return res.status(403).json({error:'Logo branding is available on Pro and Business plans.'});if(d.paymentLink&&!pro)return res.status(403).json({error:'Payment links are available on Pro and Business plans.'});res.json({html:renderInvoiceHtml(d,invoiceTotals(d))});
});
app.get('/api/tools/invoice-generator/drafts', requireAuth, async (req,res)=>{const rows=await db.prepare(`SELECT id,name,project_type AS projectType,metadata_json AS metadataJson,created_at AS createdAt,updated_at AS updatedAt FROM saved_projects WHERE user_id=? AND tool_key='invoice-generator' ORDER BY updated_at DESC LIMIT 50`).all(req.user.id);res.json({drafts:rows.map(r=>({...r,metadata:JSON.parse(r.metadataJson||'{}')}))});});
app.post('/api/tools/invoice-generator/drafts', requireSameOrigin, requireAuth, async (req,res)=>{const name=String(req.body?.name||'Untitled invoice').trim().slice(0,120)||'Untitled invoice';const plan=await getPlanForUser(req.user.id);const max=plan?.name==='Free'?3:plan?.name==='Lite'?20:'All';const count=Number((await db.prepare(`SELECT COUNT(*) AS n FROM saved_projects WHERE user_id=? AND tool_key='invoice-generator'`).get(req.user.id)).n||0);if(max!=='All'&&count>=Number(max))return res.status(403).json({error:`Your ${plan?.name||'current'} plan allows up to ${max} saved invoices.`,code:'PLAN_FEATURE_LIMIT'});const r=await db.prepare(`INSERT INTO saved_projects(user_id,name,tool_key,project_type,metadata_json) VALUES(?,?,?,?,?)`).run(req.user.id,name,'invoice-generator','invoice-draft',JSON.stringify(req.body?.invoice||{}));res.status(201).json({id:Number(r.lastInsertRowid),name});});
app.patch('/api/tools/invoice-generator/drafts/:id', requireSameOrigin, requireAuth, async (req,res)=>{const id=Number(req.params.id);const existing=await db.prepare(`SELECT id FROM saved_projects WHERE id=? AND user_id=? AND tool_key='invoice-generator'`).get(id,req.user.id);if(!existing)return res.status(404).json({error:'Invoice draft not found.'});const name=String(req.body?.name||'Untitled invoice').trim().slice(0,120)||'Untitled invoice';await db.prepare(`UPDATE saved_projects SET name=?,metadata_json=?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND user_id=?`).run(name,JSON.stringify(req.body?.invoice||{}),id,req.user.id);res.json({ok:true,id,name});});
app.post('/api/tools/invoice-generator/drafts/:id/duplicate', requireSameOrigin, requireAuth, async (req,res)=>{const src=await db.prepare(`SELECT name,metadata_json FROM saved_projects WHERE id=? AND user_id=? AND tool_key='invoice-generator'`).get(Number(req.params.id),req.user.id);if(!src)return res.status(404).json({error:'Invoice draft not found.'});const plan=await getPlanForUser(req.user.id);const max=plan?.name==='Free'?3:plan?.name==='Lite'?20:'All';const count=Number((await db.prepare(`SELECT COUNT(*) AS n FROM saved_projects WHERE user_id=? AND tool_key='invoice-generator'`).get(req.user.id)).n||0);if(max!=='All'&&count>=Number(max))return res.status(403).json({error:`Your ${plan?.name||'current'} plan has reached its saved invoice limit.`,code:'PLAN_FEATURE_LIMIT'});const r=await db.prepare(`INSERT INTO saved_projects(user_id,name,tool_key,project_type,metadata_json) VALUES(?,?,?,?,?)`).run(req.user.id,`${src.name} copy`,'invoice-generator','invoice-draft',src.metadata_json);res.status(201).json({id:Number(r.lastInsertRowid),name:`${src.name} copy`});});
app.delete('/api/tools/invoice-generator/drafts/:id', requireSameOrigin, requireAuth, async (req,res)=>{const r=await db.prepare(`DELETE FROM saved_projects WHERE id=? AND user_id=? AND tool_key='invoice-generator'`).run(Number(req.params.id),req.user.id);if(!r.changes)return res.status(404).json({error:'Invoice draft not found.'});res.json({ok:true});});
app.post('/api/tools/invoice-generator', requireSameOrigin, requireAuth, async (req,res)=>{
  const parsed=invoiceSchema.safeParse(req.body||{});if(!parsed.success)return res.status(400).json({error:parsed.error.issues[0]?.message||'Please check the invoice details.'});const d=parsed.data;const plan=await getPlanForUser(req.user.id);const name=plan?.name||'Free';const f=plan?.features||{};const allowed=f.invoices;if(allowed!=='All'&&Number(allowed||0)<=0)return res.status(403).json({error:`Your ${name} plan does not include invoice generation.`,code:'PLAN_FEATURE_LIMIT'});
  const maxItems=name==='Free'?8:['Pro','Business','30-Day Trial'].includes(name)?100:25;if(d.items.length>maxItems)return res.status(403).json({error:`Your ${name} plan allows ${maxItems} line items per invoice.`,code:'PLAN_FEATURE_LIMIT'});const lite=['Lite','Pro','Business','30-Day Trial'].includes(name);const pro=['Pro','Business','30-Day Trial'].includes(name);if(!lite&&!['classic','minimal'].includes(d.template))return res.status(403).json({error:'Modern and Bold templates are available on Lite and higher plans.',code:'PLAN_FEATURE_LIMIT'});if(d.template==='executive'&&!pro)return res.status(403).json({error:'Executive template is available on Pro and Business plans.',code:'PLAN_FEATURE_LIMIT'});if(d.logoDataUrl&&!pro)return res.status(403).json({error:'Logo branding is available on Pro and Business plans.',code:'PLAN_FEATURE_LIMIT'});if(d.accentColor!=='#5d2de6'&&!lite)return res.status(403).json({error:'Custom invoice colors are available on Lite and higher plans.',code:'PLAN_FEATURE_LIMIT'});if(d.paymentLink&&!pro)return res.status(403).json({error:'Payment links are available on Pro and Business plans.',code:'PLAN_FEATURE_LIMIT'});
  const charge=await consumeToolUse(req.user.id,'invoice-generator');if(!charge.ok)return res.status(charge.status).json(charge.body);const totals=invoiceTotals(d);const id=crypto.randomUUID();const html=renderInvoiceHtml(d,totals);const htmlName=`invoice-${id}.html`;const pdfName=`invoice-${id}.pdf`;const htmlPath=path.join(generatedDir,htmlName);const pdfPath=path.join(generatedDir,pdfName);try{fs.writeFileSync(htmlPath,html,'utf8');const renderer=renderInvoicePdf(html,pdfPath);await audit(req.user.id,'invoice.generated',{template:d.template,currency:d.currency,total:totals.total,renderer:renderer.renderer},req);res.status(201).json({ok:true,invoice:{id,number:d.invoiceNumber||'',htmlUrl:`/generated/${htmlName}`,pdfUrl:`/generated/${pdfName}`,totals,renderer:renderer.renderer},usage:charge.usage});}catch(error){fs.rmSync(htmlPath,{force:true});fs.rmSync(pdfPath,{force:true});console.error('Invoice generation error:',error);res.status(502).json({error:error.message||'Unable to render the invoice PDF.'});}
});

app.get('/api/tools/proposal-builder/capabilities', requireAuth, async (req,res)=>{
  const plan=await getPlanForUser(req.user.id); const name=plan?.name||'Free';
  const advanced=['Lite','Pro','Business','30-Day Trial'].includes(name); const premium=['Pro','Business','30-Day Trial'].includes(name);
  res.json({plan:name,features:{maxItems:name==='Free'?5:premium?100:25,templates:name==='Free'?['professional','minimal']:advanced?['professional','modern','minimal','creative']:['professional','modern','minimal','creative'],branding:advanced,aiAssist:premium,customSections:premium,sharedTemplates:name==='Business'}});
});

app.post('/api/tools/proposal-builder', requireSameOrigin, requireAuth, async (req,res)=>{
  const parsed=proposalSchema.safeParse(req.body||{}); if(!parsed.success)return res.status(400).json({error:parsed.error.issues[0]?.message||'Please check the proposal details.'});
  const charge=await consumeToolUse(req.user.id,'proposal-builder'); if(!charge.ok)return res.status(charge.status).json(charge.body);
  const d=parsed.data; const plan=await getPlanForUser(req.user.id); const f=plan?.features||{}; const allowed=f.proposals;
  if(allowed!=='All' && Number(allowed||0)<1)return res.status(403).json({error:`Your ${plan?.name||'current'} plan has no proposal generation allowance.`,code:'PLAN_FEATURE_LIMIT'});
  if(d.pricing.length>(['Pro','Business','30-Day Trial'].includes(plan?.name)?100:plan?.name==='Lite'?25:5))return res.status(403).json({error:'Your plan has reached its proposal line-item limit.',code:'PLAN_FEATURE_LIMIT'});
  if(d.template!=='professional' && !['Lite','Pro','Business','30-Day Trial'].includes(plan?.name))return res.status(403).json({error:'This proposal template is available on Lite and higher plans.',code:'PLAN_FEATURE_LIMIT'});
  const subtotal=d.pricing.reduce((sum,i)=>sum+i.quantity*i.unitPrice,0); const discount=Math.min(subtotal,subtotal*(d.discountRate/100)); const taxable=Math.max(0,subtotal-discount); const tax=taxable*(d.taxRate/100); const totals={subtotal,discount,tax,total:taxable+tax};
  try{const id=crypto.randomUUID(); const html=renderProposalHtml(d,totals); const htmlName=`proposal-${id}.html`; const pdfName=`proposal-${id}.pdf`; fs.writeFileSync(path.join(generatedDir,htmlName),html,'utf8'); const pdfText=[`Proposal: ${d.projectTitle}`,`Prepared for: ${d.clientName}`,`Prepared by: ${d.fromName}`,``, `PROJECT`,d.projectDescription,``,`SCOPE`,d.scope,``,`PRICING`,...d.pricing.map(i=>`${i.description} | ${i.quantity} x ${d.currency} ${i.unitPrice.toFixed(2)} = ${d.currency} ${(i.quantity*i.unitPrice).toFixed(2)}`),``,`Subtotal: ${d.currency} ${totals.subtotal.toFixed(2)}`,`Discount: ${d.currency} ${totals.discount.toFixed(2)}`,`Tax: ${d.currency} ${totals.tax.toFixed(2)}`,`TOTAL: ${d.currency} ${totals.total.toFixed(2)}`,d.timeline?`Timeline: ${d.timeline}`:'',d.terms?`Terms: ${d.terms}`:'',d.nextSteps?`Next steps: ${d.nextSteps}`:''].filter(Boolean).join('\n'); fs.writeFileSync(path.join(generatedDir,pdfName),createTextPdf({title:`Proposal ${d.projectTitle}`,text:pdfText})); await audit(req.user.id,'proposal.generated',{template:d.template},req); res.status(201).json({proposal:{url:`/generated/campaign-media/${htmlName}`,pdfUrl:`/generated/campaign-media/${pdfName}`,totals,projectTitle:d.projectTitle},usage:charge.usage});}catch(error){console.error('Proposal generation error:',error);res.status(500).json({error:'Unable to generate the proposal right now.'});}
});

const pdfSplitSchema = z.object({
  mode: z.enum(["ranges", "pages"]).default("ranges"),
  ranges: z.string().trim().max(400).optional()
});

app.post("/api/tools/pdf-splitter", requireSameOrigin, requireAuth, async (req, res) => {
  pdfUpload.single("file")(req, res, async uploadError => {
    if (uploadError) {
      const message = uploadError.code === "LIMIT_FILE_SIZE" ? "PDF is too large. Maximum size is 25 MB." : uploadError.message;
      return res.status(400).json({ error: message });
    }
    if (!req.file) return res.status(400).json({ error: "Please select a PDF file." });
    if (req.file.buffer.subarray(0, 5).toString() !== "%PDF-") {
      return res.status(400).json({ error: "The uploaded file is not a valid PDF." });
    }
    const parsed = pdfSplitSchema.safeParse(req.body || {});
    if (!parsed.success) return res.status(400).json({ error: "Invalid request." });

    let ranges;
    try {
      if (parsed.data.mode === "pages") {
        const pageCount = await getPdfPageCount(req.file.buffer);
        if (pageCount > 200) return res.status(400).json({ error: `This PDF has ${pageCount} pages — splitting into individual pages is limited to 200 pages. Try custom ranges instead.` });
        ranges = Array.from({ length: pageCount }, (_, i) => ({ first: i + 1, last: i + 1 }));
      } else {
        ranges = parsePageRanges(parsed.data.ranges);
      }
    } catch (error) {
      return res.status(400).json({ error: error.message || "Could not read the requested page ranges." });
    }

    const charge = await consumeToolUse(req.user.id, "document-pdf-studio");
    if (!charge.ok) return res.status(charge.status).json(charge.body);

    try {
      const result = await splitPdf(req.file.buffer, ranges);
      const originalName = path.basename(req.file.originalname).replace(/\.pdf$/i, "") || "document";
      const filename = `${originalName}-split.${result.extension}`.replace(/[^a-zA-Z0-9._-]/g, "_");
      res.setHeader("Content-Type", result.mimeType);
      res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
      res.setHeader("X-TAMPtools-Usage-Remaining", charge.usage.remaining === null ? "unlimited" : String(charge.usage.remaining));
      res.send(result.buffer);
    } catch (error) {
      console.error("PDF split error:", error);
      res.status(422).json({ error: error.message || "Unable to split this PDF. It may be encrypted or corrupted." });
    }
  });
});

const imageCompressSchema = z.object({
  quality: z.coerce.number().int().min(10).max(95).default(70),
  maxWidth: z.coerce.number().int().min(100).max(4000).optional()
});

app.post("/api/tools/image-compressor", requireSameOrigin, requireAuth, async (req, res) => {
  imageUpload.single("file")(req, res, async uploadError => {
    if (uploadError) {
      const message = uploadError.code === "LIMIT_FILE_SIZE" ? "Image is too large. Maximum size is 12 MB." : uploadError.message;
      return res.status(400).json({ error: message });
    }
    if (!req.file) return res.status(400).json({ error: "Please select an image file." });
    const parsed = imageCompressSchema.safeParse(req.body || {});
    if (!parsed.success) return res.status(400).json({ error: "Invalid compression settings." });
    const charge = await consumeToolUse(req.user.id, "image-compressor");
    if (!charge.ok) return res.status(charge.status).json(charge.body);
    try {
      const result = await compressImage({ buffer: req.file.buffer, mimeType: req.file.mimetype, quality: parsed.data.quality, maxWidth: parsed.data.maxWidth });
      const originalName = path.basename(req.file.originalname).replace(/\.[^.]+$/, "") || "image";
      const filename = `${originalName}-compressed.${result.extension}`.replace(/[^a-zA-Z0-9._-]/g, "_");
      res.setHeader("Content-Type", result.mimeType);
      res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
      res.setHeader("X-TAMPtools-Original-Size", String(result.originalSize));
      res.setHeader("X-TAMPtools-Compressed-Size", String(result.compressedSize));
      res.setHeader("X-TAMPtools-Usage-Remaining", charge.usage.remaining === null ? "unlimited" : String(charge.usage.remaining));
      res.send(result.buffer);
    } catch (error) {
      console.error("Image compression error:", error);
      res.status(422).json({ error: "Unable to compress this image. It may be an unsupported or corrupted file." });
    }
  });
});

const imageConvertSchema = z.object({
  targetFormat: z.enum(["jpeg", "jpg", "png", "webp", "avif", "tiff"])
});

app.post("/api/tools/image-converter", requireSameOrigin, requireAuth, async (req, res) => {
  imageUpload.single("file")(req, res, async uploadError => {
    if (uploadError) {
      const message = uploadError.code === "LIMIT_FILE_SIZE" ? "Image is too large. Maximum size is 12 MB." : uploadError.message;
      return res.status(400).json({ error: message });
    }
    if (!req.file) return res.status(400).json({ error: "Please select an image file." });
    const parsed = imageConvertSchema.safeParse(req.body || {});
    if (!parsed.success) return res.status(400).json({ error: "Please choose a target format." });
    const charge = await consumeToolUse(req.user.id, "image-converter");
    if (!charge.ok) return res.status(charge.status).json(charge.body);
    try {
      const result = await convertImage({ buffer: req.file.buffer, targetFormat: parsed.data.targetFormat });
      const originalName = path.basename(req.file.originalname).replace(/\.[^.]+$/, "") || "image";
      const filename = `${originalName}.${result.extension}`.replace(/[^a-zA-Z0-9._-]/g, "_");
      res.setHeader("Content-Type", result.mimeType);
      res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
      res.setHeader("X-TAMPtools-Usage-Remaining", charge.usage.remaining === null ? "unlimited" : String(charge.usage.remaining));
      res.send(result.buffer);
    } catch (error) {
      console.error("Image conversion error:", error);
      res.status(422).json({ error: error.message || "Unable to convert this image." });
    }
  });
});

const documentUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024, files: 1 },
  fileFilter: (req, file, cb) => {
    const okType = file.mimetype === "application/pdf" || file.mimetype === "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
    const okExt = /\.(pdf|docx)$/i.test(file.originalname || "");
    if (okType || okExt) cb(null, true);
    else cb(new Error("Only PDF or DOCX files are accepted."));
  }
});

// Shared by CV/Resume Builder and Cover Letter Generator so someone can upload
// an existing document instead of retyping everything. Extraction itself isn't
// charged against plan usage — only the actual AI generation call is, via /api/ai/text.
app.post("/api/tools/extract-document-text", requireSameOrigin, requireAuth, async (req, res) => {
  documentUpload.single("file")(req, res, async uploadError => {
    if (uploadError) {
      const message = uploadError.code === "LIMIT_FILE_SIZE" ? "File is too large. Maximum size is 8 MB." : uploadError.message;
      return res.status(400).json({ error: message });
    }
    if (!req.file) return res.status(400).json({ error: "Please select a PDF or DOCX file." });
    try {
      const text = await extractDocumentText({ buffer: req.file.buffer, mimeType: req.file.mimetype, originalName: req.file.originalname });
      res.status(200).json({ text });
    } catch (error) {
      res.status(422).json({ error: error.message || "Couldn't read that file." });
    }
  });
});

app.post("/api/tools/qr-code-generator", requireSameOrigin, requireAuth, async (req, res) => {
  const parsed = qrCodeSchema.safeParse(req.body || {});
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message || "Enter a link or text to encode." });
  const charge = await consumeToolUse(req.user.id, "qr-code-generator");
  if (!charge.ok) return res.status(charge.status).json(charge.body);
  try {
    const opts={errorCorrectionLevel:"M",width:Math.min(2048,Math.max(128,Number(req.body.size)||512)),margin:2,color:{dark:req.body.foreground||"#35158f",light:req.body.background||"#ffffff"}};
    const dataUrl=await QRCode.toDataURL(parsed.data.content,opts);
    res.status(201).json({ok:true,qr:{dataUrl,filename:"tamptools-qr.png"},usage:charge.usage});
  } catch(error) { res.status(422).json({error:error.message||"Unable to generate the QR code."}); }
});

const imageUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 12 * 1024 * 1024, files: 1 },
  fileFilter: (req, file, cb) => {
    if (/^image\/(png|jpe?g|webp)$/.test(file.mimetype)) cb(null, true);
    else cb(new Error("Only PNG, JPG, or WEBP images are accepted."));
  }
});

app.post("/api/tools/background-remover", requireSameOrigin, requireAuth, async (req, res) => {
  imageUpload.single("file")(req, res, async uploadError => {
    if (uploadError) {
      const message = uploadError.code === "LIMIT_FILE_SIZE" ? "Image is too large. Maximum size is 12 MB." : uploadError.message;
      return res.status(400).json({ error: message });
    }
    if (!req.file) return res.status(400).json({ error: "Please select an image file." });
    const charge = await consumeToolUse(req.user.id, "background-remover");
    if (!charge.ok) return res.status(charge.status).json(charge.body);
    try {
      const result = await processImage({ buffer: req.file.buffer, originalName: req.file.originalname, operation: "remove-background", settings: { format: "png" } });
      res.status(201).json({ image: { filename: result.filename, mimeType: result.mimeType, url: `data:${result.mimeType};base64,${result.buffer.toString("base64")}` }, usage: charge.usage });
    } catch (error) {
      console.error("Background removal error:", error);
      res.status(502).json({ error: error.message || "Unable to remove the background right now." });
    }
  });
});


const documentTextSchema = z.object({
  text: z.string().trim().min(1).max(50000),
  title: z.string().trim().max(140).optional()
});
const compareUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 25 * 1024 * 1024, files: 2 }, fileFilter: (req,file,cb) => {
  if (/application\/pdf|application\/vnd\.openxmlformats-officedocument\.wordprocessingml\.document|text\//.test(file.mimetype) || /\.(pdf|docx|txt|md)$/i.test(file.originalname)) cb(null,true);
  else cb(new Error('Only PDF, DOCX or text documents are accepted.'));
}});
const pdfStudioUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 500 * 1024 * 1024, files: 50 }, fileFilter: (req,file,cb) => {
  if (file.mimetype === 'application/pdf' || /\.pdf$/i.test(file.originalname)) cb(null,true);
  else cb(new Error('Only PDF files are accepted.'));
}});

async function documentPlanGate(userId,{files=0,totalBytes=0,advanced=false}={}){
  const plan=await getPlanForUser(userId);
  if(!plan) return {ok:false,status:403,body:{error:'Your account plan is unavailable.'}};
  const maxFiles=Number(plan.features?.pdfMaxFiles ?? 3);
  const maxMb=Number(plan.features?.pdfMaxMb ?? 25);
  if(files>maxFiles) return {ok:false,status:403,body:{error:`Your ${plan.name} plan allows up to ${maxFiles} files in one PDF task.`,code:'PDF_FILE_LIMIT',limit:maxFiles,plan:plan.name}};
  if(totalBytes>maxMb*1024*1024) return {ok:false,status:413,body:{error:`Your ${plan.name} plan allows files up to ${maxMb} MB.`,code:'PDF_SIZE_LIMIT',limitMb:maxMb,plan:plan.name}};
  if(advanced && plan.features?.pdfAdvanced!==true) return {ok:false,status:403,body:{error:`${plan.name} includes the core PDF tools. Upgrade to Lite, Pro or Business for advanced OCR and Office conversions.`,code:'PDF_ADVANCED_PLAN_REQUIRED',plan:plan.name}};
  const use=await enforceFeature(userId,'pdfOps',1); if(!use.ok)return use;
  return {ok:true,plan};
}

async function studioFileResponse(userId, toolKey, filename, buffer, mime, folder='document-pdf') {
  const item = await saveBuffer(userId, toolKey, filename, buffer, mime, { folderPath: folder, isTemp: false });
  return { id:item.id, filename:item.filename, sizeBytes:item.sizeBytes, mimeType:item.mimeType, downloadUrl:`/api/files/${item.id}/download`, previewUrl:`/api/files/${item.id}/preview` };
}
function sendStudioBuffer(res, result, filename, mime) {
  res.setHeader('Content-Type', mime); res.setHeader('Content-Disposition', `attachment; filename="${sanitizeFilename(filename)}"`); res.send(result);
}

app.post('/api/document-pdf/inspect', requireSameOrigin, requireAuth, async (req,res)=>{
  pdfStudioUpload.array('files',50)(req,res,async err=>{
    if(err) return res.status(400).json({error:err.message});
    const files=req.files||[];
    if(!files.length) return res.status(400).json({error:'Select at least one PDF.'});
    const plan=await getPlanForUser(req.user.id); const f=plan?.features||{};
    const maxFiles=Number(f.pdfMaxFiles||3), maxMb=Number(f.pdfMaxMb||25);
    if(files.length>maxFiles) return res.status(403).json({error:`Your ${plan?.name||'Free'} plan allows up to ${maxFiles} PDF files in one workspace.`,code:'PDF_FILE_LIMIT',limit:maxFiles});
    if(files.some(x=>x.size>maxMb*1024*1024)) return res.status(413).json({error:`Your ${plan?.name||'Free'} plan allows files up to ${maxMb} MB each.`,code:'PDF_SIZE_LIMIT',limitMb:maxMb});
    try {
      const sources=[];
      for(const f of files){
        const stored=await studioFileResponse(req.user.id,'document-pdf-studio',f.originalname,f.buffer,'application/pdf','document-pdf/sources');
        const preview=await inspectPdf(f.buffer,{maxPages:80,thumbWidth:220});
        sources.push({id:stored.id,filename:stored.filename,sizeBytes:stored.sizeBytes,downloadUrl:stored.downloadUrl,previewUrl:stored.previewUrl,...preview});
      }
      await audit(req.user.id,'document.workspace.opened',{files:sources.length,pages:sources.reduce((n,x)=>n+x.pageCount,0)},req);
      res.status(201).json({ok:true,plan:plan?.name||'Free',sources});
    } catch(e){res.status(422).json({error:e.message||'Unable to inspect the PDF.'});}
  });
});

app.get('/api/document-pdf/source/:id', requireAuth, async (req,res)=>{
  const row=await safeFileRow(req.user.id,Number(req.params.id));
  if(!row || row.tool_key!=='document-pdf-studio') return res.status(404).json({error:'PDF source not found.'});
  try { const buffer=await readStoredBuffer(row); const preview=await inspectPdf(buffer,{maxPages:80,thumbWidth:220}); res.json({ok:true,source:{id:row.id,filename:row.filename,sizeBytes:row.size_bytes,...preview}}); }
  catch(e){res.status(422).json({error:e.message||'Unable to inspect the saved PDF.'});}
});

app.post('/api/document-pdf/compose', requireSameOrigin, requireAuth, async (req,res)=>{
  try {
    const ids=Array.isArray(req.body?.sourceFileIds)?req.body.sourceFileIds.map(Number).filter(Number.isInteger):[];
    const pages=Array.isArray(req.body?.pages)?req.body.pages:[];
    if(!ids.length || !pages.length) return res.status(400).json({error:'Add PDF pages to the workspace before exporting.'});
    const plan=await getPlanForUser(req.user.id); const f=plan?.features||{};
    const maxFiles=Number(f.pdfMaxFiles||3), maxMb=Number(f.pdfMaxMb||25);
    if(ids.length>maxFiles) return res.status(403).json({error:`Your ${plan?.name||'Free'} plan allows up to ${maxFiles} source files.`,code:'PDF_FILE_LIMIT',limit:maxFiles});
    const rows=[]; let totalBytes=0;
    for(const id of ids){ const row=await safeFileRow(req.user.id,id); if(!row) return res.status(404).json({error:'A source PDF is no longer available.'}); if(!await storedFileExists(row)) return res.status(410).json({error:'A source PDF is no longer available.'}); rows.push(row); totalBytes+=Number(row.size_bytes||0); }
    if(rows.some(r=>Number(r.size_bytes||0)>maxMb*1024*1024)) return res.status(413).json({error:`Your ${plan?.name||'Free'} plan allows files up to ${maxMb} MB each.`,code:'PDF_SIZE_LIMIT',limitMb:maxMb});
    const gate=await documentPlanGate(req.user.id,{files:ids.length,totalBytes}); if(!gate.ok)return res.status(gate.status).json(gate.body);
    const buffers=await Promise.all(rows.map(readStoredBuffer));
    const cleanPages=pages.slice(0,5000).map(p=>({fileIndex:Number(p.fileIndex),pageIndex:Number(p.pageIndex),rotation:Number(p.rotation||0),blank:Boolean(p.blank)}));
    const buffer=await composePdf({sources:buffers,pages:cleanPages});
    const name=sanitizeFilename(String(req.body?.filename||'TAMPtools-document.pdf'))||'TAMPtools-document.pdf';
    const file=await studioFileResponse(req.user.id,'document-pdf-studio',name.endsWith('.pdf')?name:`${name}.pdf`,buffer,'application/pdf','document-pdf/exports');
    await audit(req.user.id,'document.workspace.exported',{sources:ids.length,pages:cleanPages.length,fileId:file.id},req);
    res.status(201).json({ok:true,file,usage:gate.usage,pageCount:cleanPages.length});
  } catch(e){res.status(422).json({error:e.message||'Unable to export the document.'});}
});

app.get('/api/document-pdf/workspaces', requireAuth, async (req,res)=>{
  const rows=await db.prepare(`SELECT id,name,tool_key AS toolKey,project_type AS projectType,metadata_json AS metadataJson,created_at AS createdAt,updated_at AS updatedAt FROM saved_projects WHERE user_id=? AND tool_key='document-pdf-studio' ORDER BY updated_at DESC LIMIT 20`).all(req.user.id);
  res.json({workspaces:rows.map(r=>({...r,metadata:JSON.parse(r.metadataJson||'{}')}))});
});
app.post('/api/document-pdf/workspaces', requireSameOrigin, requireAuth, async (req,res)=>{
  const name=sanitizeFilename(String(req.body?.name||'Untitled PDF workspace')).slice(0,120)||'Untitled PDF workspace';
  const metadata=JSON.stringify(req.body?.metadata||{});
  const id=await db.prepare(`INSERT INTO saved_projects(user_id,name,tool_key,project_type,metadata_json) VALUES(?,?,?,?,?)`).run(req.user.id,name,'document-pdf-studio','pdf-workspace',metadata);
  res.status(201).json({ok:true,workspace:{id:Number(id.lastInsertRowid),name,metadata:JSON.parse(metadata)}});
});
app.patch('/api/document-pdf/workspaces/:id', requireSameOrigin, requireAuth, async (req,res)=>{
  const id=Number(req.params.id); const existing=await db.prepare(`SELECT id FROM saved_projects WHERE id=? AND user_id=? AND tool_key='document-pdf-studio'`).get(id,req.user.id); if(!existing)return res.status(404).json({error:'Workspace not found.'});
  const name=sanitizeFilename(String(req.body?.name||'Untitled PDF workspace')).slice(0,120)||'Untitled PDF workspace'; const metadata=JSON.stringify(req.body?.metadata||{});
  await db.prepare(`UPDATE saved_projects SET name=?,metadata_json=?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND user_id=?`).run(name,metadata,id,req.user.id); res.json({ok:true});
});
app.delete('/api/document-pdf/workspaces/:id', requireSameOrigin, requireAuth, async (req,res)=>{const id=Number(req.params.id);const r=await db.prepare(`DELETE FROM saved_projects WHERE id=? AND user_id=? AND tool_key='document-pdf-studio'`).run(id,req.user.id);if(!r.changes)return res.status(404).json({error:'Workspace not found.'});res.json({ok:true});});

app.get('/api/document-pdf/capabilities', requireAuth, async (req,res)=>{
  const plan=await getPlanForUser(req.user.id);
  const f=plan?.features||{};
  res.json({plan:plan?.name||'Free',limits:{maxFiles:Number(f.pdfMaxFiles||3),maxMb:Number(f.pdfMaxMb||25),pdfOps:f.pdfOps??10,advanced:Boolean(f.pdfAdvanced)}});
});

app.post('/api/document-pdf/create', requireSameOrigin, requireAuth, async (req,res)=>{
  const parsed=documentTextSchema.safeParse(req.body||{}); if(!parsed.success)return res.status(400).json({error:'Enter some document text first.'});
  const charge=await consumeToolUse(req.user.id,'document-pdf-studio'); if(!charge.ok)return res.status(charge.status).json(charge.body);
  try { const buffer=createTextPdf(parsed.data); const file=await studioFileResponse(req.user.id,'document-pdf-studio',`${sanitizeFilename(parsed.data.title||'document')}.pdf`,buffer,'application/pdf'); res.status(201).json({ok:true,file,usage:charge.usage}); } catch(e){res.status(422).json({error:e.message||'Unable to create the PDF.'});}
});

app.post('/api/document-pdf/merge', requireSameOrigin, requireAuth, async (req,res)=>{
  pdfStudioUpload.array('files',20)(req,res,async err=>{if(err)return res.status(400).json({error:err.message});const files=req.files||[];if(files.length<2)return res.status(400).json({error:'Select at least two PDFs.'});const charge=await consumeToolUse(req.user.id,'document-pdf-studio');if(!charge.ok)return res.status(charge.status).json(charge.body);try{const buffer=await mergePdfs(files.map(f=>f.buffer));const file=await studioFileResponse(req.user.id,'document-pdf-studio','merged-document.pdf',buffer,'application/pdf');res.status(201).json({ok:true,file,usage:charge.usage});}catch(e){res.status(422).json({error:e.message||'Unable to merge these PDFs.'});}});
});

app.post('/api/document-pdf/split', requireSameOrigin, requireAuth, async (req,res)=>{
  pdfStudioUpload.single('file')(req,res,async err=>{if(err)return res.status(400).json({error:err.message});if(!req.file)return res.status(400).json({error:'Select a PDF.'});const ranges=String(req.body?.ranges||'').trim();if(!ranges)return res.status(400).json({error:'Enter page ranges, for example 1-3,5.'});const charge=await consumeToolUse(req.user.id,'document-pdf-studio');if(!charge.ok)return res.status(charge.status).json(charge.body);try{const {parsePageRanges,splitPdf}=await import('./pdf-splitter.js');const pageCount=await getPdfPageCount(req.file.buffer);const parsed=parsePageRanges(ranges);for(const r of parsed)if(r.last>pageCount)throw new Error(`Page ${r.last} is outside this PDF (${pageCount} pages).`);const result=await splitPdf(req.file.buffer,parsed);const file=await studioFileResponse(req.user.id,'document-pdf-studio',`${safeName(req.file.originalname)}-split.${result.extension}`,result.buffer,result.mimeType);res.status(201).json({ok:true,file,usage:charge.usage});}catch(e){res.status(422).json({error:e.message||'Unable to split this PDF.'});}});
});

app.post('/api/document-pdf/compress', requireSameOrigin, requireAuth, async (req,res)=>{
  pdfStudioUpload.single('file')(req,res,async err=>{if(err)return res.status(400).json({error:err.message});if(!req.file)return res.status(400).json({error:'Select a PDF.'});const level=['screen','ebook','printer'].includes(req.body?.level)?req.body.level:'ebook';const charge=await consumeToolUse(req.user.id,'pdf-compressor');if(!charge.ok)return res.status(charge.status).json(charge.body);try{const buffer=await compressPdf(req.file.buffer,level);const file=await studioFileResponse(req.user.id,'pdf-compressor',`${safeName(req.file.originalname)}-compressed.pdf`,buffer,'application/pdf');res.status(201).json({ok:true,file,usage:charge.usage});}catch(e){res.status(422).json({error:e.message||'Unable to compress this PDF.'});}});
});

app.post('/api/document-pdf/pdf-to-image', requireSameOrigin, requireAuth, async (req,res)=>{
  pdfStudioUpload.single('file')(req,res,async err=>{if(err)return res.status(400).json({error:err.message});if(!req.file)return res.status(400).json({error:'Select a PDF.'});const format=req.body?.format==='jpg'?'jpg':'png';const all=req.body?.allPages==='true'||req.body?.allPages===true;const charge=await consumeToolUse(req.user.id,'document-pdf-studio');if(!charge.ok)return res.status(charge.status).json(charge.body);try{const outputs=await convertPdfToImages(req.file.buffer,format,all);const files=await Promise.all(outputs.map((o,i)=>studioFileResponse(req.user.id,'document-pdf-studio',`${safeName(req.file.originalname)}-page-${i+1}.${format}`,o.buffer,o.mime,'document-pdf/images')));res.status(201).json({ok:true,files,usage:charge.usage});}catch(e){res.status(422).json({error:e.message||'Unable to render this PDF.'});}});
});

app.post('/api/document-pdf/image-to-pdf', requireSameOrigin, requireAuth, async (req,res)=>{
  imageUpload.array('files',20)(req,res,async err=>{if(err)return res.status(400).json({error:err.message});const files=req.files||[];if(!files.length)return res.status(400).json({error:'Select at least one PNG, JPG or WEBP image.'});const charge=await consumeToolUse(req.user.id,'document-pdf-studio');if(!charge.ok)return res.status(charge.status).json(charge.body);try{const buffer=await imagesToPdf(files.map(f=>f.buffer));const base=safeName(files[0].originalname)||'images';const file=await studioFileResponse(req.user.id,'document-pdf-studio',`${base}${files.length>1?'-collection':''}.pdf`,buffer,'application/pdf');res.status(201).json({ok:true,file,usage:charge.usage});}catch(e){res.status(422).json({error:e.message||'Unable to create a PDF from these images.'});}});
});

app.post('/api/document-pdf/protect', requireSameOrigin, requireAuth, async (req,res)=>{
  pdfStudioUpload.single('file')(req,res,async err=>{if(err)return res.status(400).json({error:err.message});if(!req.file)return res.status(400).json({error:'Select a PDF.'});const password=String(req.body?.password||'');if(password.length<4)return res.status(400).json({error:'Password must be at least 4 characters.'});const charge=await consumeToolUse(req.user.id,'document-pdf-studio');if(!charge.ok)return res.status(charge.status).json(charge.body);try{const buffer=await protectPdf(req.file.buffer,{userPassword:password,ownerPassword:password});const file=await studioFileResponse(req.user.id,'document-pdf-studio',`${safeName(req.file.originalname)}-protected.pdf`,buffer,'application/pdf');res.status(201).json({ok:true,file,usage:charge.usage});}catch(e){res.status(422).json({error:e.message||'PDF protection is unavailable on this server.'});}});
});

app.post('/api/document-pdf/organize', requireSameOrigin, requireAuth, async (req,res)=>{
  pdfStudioUpload.single('file')(req,res,async err=>{if(err)return res.status(400).json({error:err.message});if(!req.file)return res.status(400).json({error:'Select a PDF.'});const order=String(req.body?.order||'').split(',').map(x=>Number(x.trim())).filter(Number.isFinite);if(!order.length)return res.status(400).json({error:'Enter a page order, for example 3,1,2.'});const charge=await consumeToolUse(req.user.id,'document-pdf-studio');if(!charge.ok)return res.status(charge.status).json(charge.body);try{const pageCount=await getPdfPageCount(req.file.buffer);if(order.some(n=>n<1||n>pageCount))throw new Error(`Page order must stay within 1-${pageCount}.`);const buffer=await reorderPdf(req.file.buffer,order);const file=await studioFileResponse(req.user.id,'document-pdf-studio',`${safeName(req.file.originalname)}-organized.pdf`,buffer,'application/pdf');res.status(201).json({ok:true,file,usage:charge.usage});}catch(e){res.status(422).json({error:e.message||'Unable to organize this PDF.'});}});
});

app.post('/api/document-pdf/extract-pages', requireSameOrigin, requireAuth, async (req,res)=>{
  pdfStudioUpload.single('file')(req,res,async err=>{if(err)return res.status(400).json({error:err.message});if(!req.file)return res.status(400).json({error:'Select a PDF.'});const ranges=String(req.body?.ranges||'').trim();if(!ranges)return res.status(400).json({error:'Enter the pages to extract.'});const gate=await documentPlanGate(req.user.id,{files:1,totalBytes:req.file.size});if(!gate.ok)return res.status(gate.status).json(gate.body);try{const {parsePageRanges}=await import('./pdf-splitter.js');const parsed=parsePageRanges(ranges);const count=await getPdfPageCount(req.file.buffer);for(const r of parsed)if(r.last>count)throw new Error(`Page ${r.last} is outside this PDF (${count} pages).`);const buffer=await extractPagesToPdf(req.file.buffer,parsed);const file=await studioFileResponse(req.user.id,'document-pdf-studio',`${safeName(req.file.originalname)}-pages.pdf`,buffer,'application/pdf');const charge=await consumeToolUse(req.user.id,'document-pdf-studio');res.status(201).json({ok:true,file,usage:charge.usage});}catch(e){res.status(422).json({error:e.message||'Unable to extract pages.'});}});
});

app.post('/api/document-pdf/rotate', requireSameOrigin, requireAuth, async (req,res)=>{
  pdfStudioUpload.single('file')(req,res,async err=>{if(err)return res.status(400).json({error:err.message});if(!req.file)return res.status(400).json({error:'Select a PDF.'});const degrees=Number(req.body?.degrees||90);const pagesText=String(req.body?.pages||'').trim();const gate=await documentPlanGate(req.user.id,{files:1,totalBytes:req.file.size});if(!gate.ok)return res.status(gate.status).json(gate.body);try{const {parsePageRanges}=await import('./pdf-splitter.js');let pages=[];if(pagesText){const ranges=parsePageRanges(pagesText);for(const r of ranges)for(let n=r.first;n<=r.last;n++)pages.push(n);}const buffer=await rotatePdf(req.file.buffer,degrees,pages);const file=await studioFileResponse(req.user.id,'document-pdf-studio',`${safeName(req.file.originalname)}-rotated.pdf`,buffer,'application/pdf');const charge=await consumeToolUse(req.user.id,'document-pdf-studio');res.status(201).json({ok:true,file,usage:charge.usage});}catch(e){res.status(422).json({error:e.message||'Unable to rotate this PDF.'});}});
});

app.post('/api/document-pdf/add-remove', requireSameOrigin, requireAuth, async (req,res)=>{
  pdfStudioUpload.single('file')(req,res,async err=>{if(err)return res.status(400).json({error:err.message});if(!req.file)return res.status(400).json({error:'Select a PDF.'});const action=req.body?.action==='insert'?'insert':'remove';const spec=String(req.body?.spec||'').trim();if(!spec)return res.status(400).json({error:action==='insert'?'Enter an insert position, for example 3.':'Enter pages to remove, for example 2,5-7.'});const gate=await documentPlanGate(req.user.id,{files:1,totalBytes:req.file.size});if(!gate.ok)return res.status(gate.status).json(gate.body);try{const buffer=await addOrRemovePages(req.file.buffer,{action,spec});const file=await studioFileResponse(req.user.id,'document-pdf-studio',`${safeName(req.file.originalname)}-${action==='insert'?'inserted':'pages-removed'}.pdf`,buffer,'application/pdf');const charge=await consumeToolUse(req.user.id,'document-pdf-studio');res.status(201).json({ok:true,file,usage:charge.usage});}catch(e){res.status(422).json({error:e.message||'Unable to modify the PDF pages.'});}});
});

app.post('/api/document-pdf/convert', requireSameOrigin, requireAuth, async (req,res)=>{
  const upload=multer({storage:multer.memoryStorage(),limits:{fileSize:500*1024*1024,files:1},fileFilter:(rq,file,cb)=>{if(/\.(pdf|docx|pptx|xlsx|png|jpe?g|webp)$/i.test(file.originalname)||/application\/(pdf|vnd\.openxmlformats-officedocument\.(wordprocessingml\.document|presentationml\.presentation|spreadsheetml\.sheet))|image\//.test(file.mimetype))cb(null,true);else cb(new Error('Supported formats: PDF, DOCX, PPTX, XLSX, PNG, JPG and WEBP.'));}});
  upload.single('file')(req,res,async err=>{if(err)return res.status(400).json({error:err.message});if(!req.file)return res.status(400).json({error:'Select a document.'});const target=String(req.body?.target||'pdf').toLowerCase();const advanced=['docx','pptx','xlsx','txt'].includes(target)&&!/\.(png|jpe?g|webp)$/i.test(req.file.originalname);const gate=await documentPlanGate(req.user.id,{files:1,totalBytes:req.file.size,advanced});if(!gate.ok)return res.status(gate.status).json(gate.body);try{if(['png','jpg'].includes(target)&&!/\.pdf$/i.test(req.file.originalname))throw new Error('PNG/JPG conversion targets require a PDF source.');const result=await convertDocumentFormat(req.file.buffer,req.file.originalname,target,req.body?.scope||'all');if(Array.isArray(result)){const files=await Promise.all(result.map((b,i)=>studioFileResponse(req.user.id,'document-pdf-studio',`${safeName(req.file.originalname)}-page-${i+1}.${target}`,b,target==='png'?'image/png':'image/jpeg','document-pdf/images')));return res.status(201).json({ok:true,files});}const mime=target==='pdf'?'application/pdf':target==='docx'?'application/vnd.openxmlformats-officedocument.wordprocessingml.document':target==='pptx'?'application/vnd.openxmlformats-officedocument.presentationml.presentation':target==='xlsx'?'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet':'text/plain';const file=await studioFileResponse(req.user.id,'document-pdf-studio',`${safeName(req.file.originalname)}.${target}`,result,mime);res.status(201).json({ok:true,file});}catch(e){res.status(422).json({error:e.message||'Unable to convert this document.'});}});
});

app.post('/api/document-pdf/ocr', requireSameOrigin, requireAuth, async (req,res)=>{
  pdfStudioUpload.single('file')(req,res,async err=>{if(err)return res.status(400).json({error:err.message});if(!req.file)return res.status(400).json({error:'Select a PDF.'});const lang=String(req.body?.language||'eng').replace(/[^a-z+]/g,'').slice(0,40)||'eng';const charge=await consumeToolUse(req.user.id,'document-pdf-studio');if(!charge.ok)return res.status(charge.status).json(charge.body);try{const text=await ocrPdf(req.file.buffer,lang);res.status(201).json({ok:true,text,usage:charge.usage});}catch(e){res.status(422).json({error:e.message||'OCR is unavailable on this server.'});}});
});

app.post('/api/document-pdf/extract-text', requireSameOrigin, requireAuth, async (req,res)=>{
  compareUpload.single('file')(req,res,async err=>{if(err)return res.status(400).json({error:err.message});if(!req.file)return res.status(400).json({error:'Select a PDF, DOCX or text file.'});const charge=await consumeToolUse(req.user.id,'document-pdf-studio');if(!charge.ok)return res.status(charge.status).json(charge.body);try{const text=/\.pdf$/i.test(req.file.originalname)||req.file.mimetype==='application/pdf' ? await extractPdfTextFull(req.file.buffer) : await extractDocumentText({buffer:req.file.buffer,mimeType:req.file.mimetype,originalName:req.file.originalname});res.status(201).json({ok:true,text,usage:charge.usage});}catch(e){res.status(422).json({error:e.message||'Unable to extract text.'});}});
});

app.post('/api/document-pdf/cleanup-text', requireSameOrigin, requireAuth, async (req,res)=>{
  const parsed=documentTextSchema.safeParse(req.body||{});if(!parsed.success)return res.status(400).json({error:'Enter text to clean.'});const charge=await consumeToolUse(req.user.id,'document-pdf-studio');if(!charge.ok)return res.status(charge.status).json(charge.body);res.status(201).json({ok:true,text:cleanupText(parsed.data.text),usage:charge.usage});
});

app.post('/api/document-pdf/compare', requireSameOrigin, requireAuth, async (req,res)=>{
  compareUpload.array('files',2)(req,res,async err=>{if(err)return res.status(400).json({error:err.message});if((req.files||[]).length!==2)return res.status(400).json({error:'Upload exactly two documents to compare.'});const charge=await consumeToolUse(req.user.id,'document-pdf-studio');if(!charge.ok)return res.status(charge.status).json(charge.body);try{const texts=[];for(const f of req.files){if(/\.pdf$/i.test(f.originalname)||f.mimetype==='application/pdf')texts.push(await extractPdfTextFull(f.buffer));else texts.push(await extractDocumentText({buffer:f.buffer,mimeType:f.mimetype,originalName:f.originalname}));}res.status(201).json({ok:true,result:compareText(texts[0],texts[1]),usage:charge.usage});}catch(e){res.status(422).json({error:e.message||'Unable to compare these documents.'});}});
});

app.post('/api/document-pdf/extract-data', requireSameOrigin, requireAuth, async (req,res)=>{
  pdfStudioUpload.single('file')(req,res,async err=>{if(err)return res.status(400).json({error:err.message});if(!req.file)return res.status(400).json({error:'Select a PDF.'});const charge=await consumeAiJob(req.user.id,'document-ai-extract');if(!charge.ok)return res.status(charge.status).json(charge.body);try{const text=await extractPdfTextFull(req.file.buffer);const ai=await generateText({system:'You extract structured business data. Return concise JSON only when possible.',prompt:`Extract useful fields from this document. If it appears to be an invoice or receipt, prioritize vendor, invoice number, date, currency, subtotal, tax, total, customer, payment status and line items. If another document, return the most useful structured fields.\n\nDOCUMENT:\n${text.slice(0,30000)}`,maxTokens:1800,userId:req.user.id,operation:'document-ai-extract',estimatedCredits:charge.estimatedCredits,chargedCredits:charge.chargedCredits});res.status(201).json({ok:true,text:ai.text,provider:ai.provider,sourceText:text,usage:charge.usage});}catch(e){res.status(422).json({error:e.message||'Unable to extract structured data.'});}});
});

app.post('/api/document-pdf/invoice-receipt-extract', requireSameOrigin, requireAuth, async (req,res)=>{
  pdfStudioUpload.single('file')(req,res,async err=>{if(err)return res.status(400).json({error:err.message});if(!req.file)return res.status(400).json({error:'Select an invoice or receipt PDF.'});const charge=await consumeAiJob(req.user.id,'invoice-receipt-ai-extract');if(!charge.ok)return res.status(charge.status).json(charge.body);try{const text=await extractPdfTextFull(req.file.buffer);const ai=await generateText({system:'Extract invoice or receipt information. Return JSON with vendor, documentType, documentNumber, date, currency, subtotal, tax, total, customer, paymentStatus, and lineItems.',prompt:`Extract the invoice/receipt data below. Do not invent missing values.\n\n${text.slice(0,30000)}`,maxTokens:1800,userId:req.user.id,operation:'invoice-receipt-ai-extract',estimatedCredits:charge.estimatedCredits,chargedCredits:charge.chargedCredits});res.status(201).json({ok:true,data:ai.text,provider:ai.provider,usage:charge.usage});}catch(e){res.status(422).json({error:e.message||'Unable to extract invoice or receipt data.'});}});
});

function safeName(name){return path.basename(String(name||'document')).replace(/\.[^.]+$/,'').replace(/[^a-zA-Z0-9._-]/g,'_')||'document';}


const imageStudioSchema = z.object({
  operation: z.enum(['enhance','remove-background','replace-background','background-color','resize','crop','compress','convert','watermark','shadow','reflection']).default('enhance'),
  width: z.coerce.number().int().min(100).max(6000).optional(),
  height: z.coerce.number().int().min(100).max(6000).optional(),
  fit: z.enum(['inside','cover','fill']).optional(),
  position: z.string().max(30).optional(),
  backgroundColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  text: z.string().max(80).optional(),
  opacity: z.coerce.number().min(.08).max(.9).optional(),
  quality: z.coerce.number().int().min(10).max(100).optional(),
  format: z.enum(['jpeg','jpg','png','webp','avif']).optional(),
  upscale: z.coerce.boolean().optional()
});

app.post('/api/image-studio/process', requireSameOrigin, requireAuth, async (req,res)=>{
  imageUpload.single('file')(req,res,async uploadError=>{
    if(uploadError)return res.status(400).json({error:uploadError.code==='LIMIT_FILE_SIZE'?'Image is too large. Maximum size is 12 MB.':uploadError.message});
    if(!req.file)return res.status(400).json({error:'Please select an image file.'});
    const parsed=imageStudioSchema.safeParse(req.body||{}); if(!parsed.success)return res.status(400).json({error:'Invalid image settings.'});
    const charge=await consumeToolUse(req.user.id,'image-studio'); if(!charge.ok)return res.status(charge.status).json(charge.body);
    try{const result=await processImage({buffer:req.file.buffer,originalName:req.file.originalname,operation:parsed.data.operation,settings:parsed.data});
      res.status(201).json({ok:true,filename:result.filename,mimeType:result.mimeType,width:result.width,height:result.height,originalSize:result.originalSize,outputSize:result.outputSize,usage:charge.usage,image:{url:`data:${result.mimeType};base64,${result.buffer.toString('base64')}`}});
    }catch(error){console.error('Image Studio error:',error);res.status(422).json({error:error.message||'Unable to process this image.'});}
  });
});

app.post('/api/image-studio/batch', requireSameOrigin, requireAuth, async (req,res)=>{
  imageUpload.array('files',20)(req,res,async uploadError=>{
    if(uploadError)return res.status(400).json({error:uploadError.message});
    const files=req.files||[]; if(!files.length)return res.status(400).json({error:'Select at least one image.'});
    const parsed=imageStudioSchema.safeParse(req.body||{}); if(!parsed.success)return res.status(400).json({error:'Invalid image settings.'});
    const charge=await consumeToolUse(req.user.id,'image-studio',files.length); if(!charge.ok)return res.status(charge.status).json(charge.body);
    try{const results=[];for(const file of files){const result=await processImage({buffer:file.buffer,originalName:file.originalname,operation:parsed.data.operation,settings:parsed.data});results.push({filename:result.filename,mimeType:result.mimeType,originalSize:result.originalSize,outputSize:result.outputSize,image:{url:`data:${result.mimeType};base64,${result.buffer.toString('base64')}`}});}res.status(201).json({ok:true,results,usage:charge.usage});}
    catch(error){console.error('Image Studio batch error:',error);res.status(422).json({error:error.message||'Unable to process this batch.'});}
  });
});

// Phase 4: Cold Email Studio. Draft generation and provider-backed sending live behind one workflow.
const emailDraftSchema=z.object({name:z.string().trim().min(2).max(120).optional().default(''),company:z.string().trim().max(160).optional().default(''),idea:z.string().trim().min(5).max(6000),offer:z.string().trim().max(1000).optional().default(''),tone:z.string().trim().max(80).optional().default('professional'),subject:z.string().trim().max(200).optional().default('')});
app.post('/api/email/generate',requireSameOrigin,requireAuth,async(req,res)=>{
  const parsed=emailDraftSchema.safeParse(req.body||{});if(!parsed.success)return res.status(400).json({error:'Please provide the outreach idea.'});
  const charge=await consumeToolUse(req.user.id,'cold-email-generator');if(!charge.ok)return res.status(charge.status).json(charge.body);
  const d=parsed.data; const prompt=`Create a concise cold email for ${d.name||'a prospect'}${d.company?` at ${d.company}`:''}. Idea: ${d.idea}. Offer: ${d.offer||'the proposed service'}. Tone: ${d.tone}. Return a subject line and plain-text email. Avoid deceptive claims, spammy language, and fabricated facts.`;
  try{const result=await generateText({system:'You are TAMPtools Cold Email Studio. Write ethical, concise B2B outreach with a clear value proposition and opt-out-friendly language.',prompt,maxTokens:900,userId:req.user.id,operation:'cold-email-generator',estimatedCredits:charge.estimatedCredits,chargedCredits:charge.chargedCredits}); await audit(req.user.id,'email.draft.generated',{provider:result.provider},req);res.json({draft:result.text,provider:result.provider,usage:charge.usage});}catch(error){console.error(error);res.status(502).json({error:'Unable to generate the email right now.'});}
});

const emailSendSchema=z.object({to:z.string().email(),subject:z.string().trim().min(1).max(200),text:z.string().trim().min(1).max(12000),html:z.string().max(30000).optional()});
app.post('/api/email/send',requireSameOrigin,requireAuth,async(req,res)=>{
  const parsed=emailSendSchema.safeParse(req.body||{});if(!parsed.success)return res.status(400).json({error:'Provide a valid recipient, subject and email body.'});
  const charge=await consumeToolUse(req.user.id,'cold-email-generator');if(!charge.ok)return res.status(charge.status).json(charge.body);
  try{const result=await sendEmail({...parsed.data,idempotencyKey:`tamptools-email-${req.user.id}-${crypto.randomUUID()}`});if(!result.sent)return res.status(503).json({...result,code:'EMAIL_PROVIDER_NOT_CONFIGURED'});await audit(req.user.id,'email.sent',{provider:result.provider,to:parsed.data.to},req);res.json({...result,usage:charge.usage});}catch(error){console.error(error);res.status(502).json({error:error.message||'Unable to send email.'});}
});

app.get('/api/email/status',requireAuth,async (req,res)=>res.json({provider:'resend',configured:Boolean(process.env.RESEND_API_KEY&&process.env.RESEND_API_KEY!=='REPLACE_ME'),from:process.env.EMAIL_FROM||'TAMPtools <tools@tampconsulting.space>'}));

// Phase 4: reporting and analytics.
app.get('/api/reports/me',requireAuth,async (req,res)=>{const report=await userReport(req.user.id,req.query.from||null,req.query.to||null);await db.prepare('INSERT INTO report_runs (user_id,report_type,period_from,period_to,result_json) VALUES (?,?,?,?,?)').run(req.user.id,'workspace',report.period.from,report.period.to,JSON.stringify(report));res.json(report);});

// Phase 4: audit and storage visibility.
app.get('/api/account/audit',requireAuth,async (req,res)=>{const rows=await db.prepare('SELECT id,action,metadata_json AS metadataJson,created_at AS createdAt FROM audit_logs WHERE user_id=? ORDER BY id DESC LIMIT 100').all(req.user.id).map(x=>({...x,metadata:JSON.parse(x.metadataJson||'{}')}));res.json({events:rows});});
app.get('/api/account/storage',requireAuth,async (req,res)=>{const files=await db.prepare('SELECT id,tool_key AS toolKey,filename,mime_type AS mimeType,size_bytes AS sizeBytes,created_at AS createdAt FROM user_files WHERE user_id=? ORDER BY id DESC').all(req.user.id);res.json({storage:await storageInfo(),files});});

app.get('/api/files',requireAuth,async (req,res)=>{
  const q=String(req.query.q||'').trim().slice(0,120); const folder=String(req.query.folder||'').replace(/^\/+|\/+$/g,'').slice(0,500); const type=String(req.query.type||'').trim().slice(0,30);
  const where=['user_id=?','status<>?']; const params=[req.user.id,'deleted'];
  if(q){where.push('(filename LIKE ? OR mime_type LIKE ?)');params.push(`%${q}%`,`%${q}%`)}
  if(folder) {where.push('folder_path=?');params.push(folder)}
  const rows=await db.prepare(`SELECT id,tool_key AS toolKey,filename,folder_path AS folderPath,mime_type AS mimeType,size_bytes AS sizeBytes,status,sha256,created_at AS createdAt,expires_at AS expiresAt,is_temp AS isTemp FROM user_files WHERE ${where.join(' AND ')} ORDER BY id DESC LIMIT 500`).all(...params).map(x=>({...x,isTemp:Boolean(x.isTemp),type:detectFileType(Buffer.alloc(0),x.filename,x.mimeType).type}));
  const usage=await storageUsage(req.user.id); const plan=await getPlanForUser(req.user.id); const limitBytes=Number(plan?.features?.storageMb??500)*1024*1024;
  res.json({files:rows,storage:{...await storageInfo(),usedBytes:Number(usage.bytes),fileCount:Number(usage.count),limitBytes,usagePercent:limitBytes?Math.min(100,Number(usage.bytes)/limitBytes*100):0}});
});

const generalFileUpload=multer({storage:multer.memoryStorage(),limits:{fileSize:Number(process.env.MAX_FILE_SIZE_BYTES||100*1024*1024),files:20},fileFilter:(req,file,cb)=>cb(null,true)});
app.post('/api/files/upload',requireSameOrigin,requireAuth,async (req,res)=>{
  generalFileUpload.array('files',20)(req,res,async error=>{
    if(error) return res.status(400).json({error:error.code==='LIMIT_FILE_SIZE'?'File exceeds the maximum allowed size.':error.message});
    const files=req.files||[]; if(!files.length)return res.status(400).json({error:'Select at least one file.'});
    const plan=await getPlanForUser(req.user.id); const limitBytes=Number(plan?.features?.storageMb??500)*1024*1024; const usage=await storageUsage(req.user.id); const incoming=files.reduce((n,f)=>n+f.size,0);
    if(Number(usage.bytes)+incoming>limitBytes)return res.status(413).json({error:'Storage quota exceeded.',storage:{usedBytes:Number(usage.bytes),limitBytes}});
    const folder=String(req.body?.folder||'').trim().slice(0,500); const toolKey=String(req.body?.toolKey||'file-browser').trim().slice(0,100);
    const saved=[];
    for(const f of files){const detected=detectFileType(f.buffer,f.originalname,f.mimetype); const item=await saveBuffer(req.user.id,toolKey,f.originalname,f.buffer,detected.mime,{folderPath:folder}); saved.push({id:item.id,filename:item.filename,sizeBytes:item.sizeBytes,mimeType:item.mimeType,type:item.type,sha256:item.sha256,status:'ready'});}
    await audit(req.user.id,'file.upload',{count:saved.length,bytes:incoming,toolKey,folder},req);
    res.status(201).json({files:saved,storage:{usedBytes:Number(usage.bytes)+incoming,limitBytes}});
  });
});

app.get('/api/files/:id/download',requireAuth,async (req,res)=>{const row=await safeFileRow(req.user.id,Number(req.params.id));if(!row)return res.status(404).json({error:'File not found.'});if(!await storedFileExists(row))return res.status(410).json({error:'Stored file is no longer available.'});res.setHeader('Content-Disposition',`attachment; filename="${sanitizeFilename(row.filename)}"`);if(row.mime_type)res.setHeader('Content-Type',row.mime_type);await streamStoredFile(row,res);});
app.get('/api/files/:id/preview',requireAuth,async (req,res)=>{const row=await safeFileRow(req.user.id,Number(req.params.id));if(!row)return res.status(404).json({error:'File not found.'});if(!await storedFileExists(row))return res.status(410).json({error:'Stored file is no longer available.'});res.setHeader('Content-Type',row.mime_type||'application/octet-stream');res.setHeader('Content-Disposition',`inline; filename="${sanitizeFilename(row.filename)}"`);await streamStoredFile(row,res);});
app.patch('/api/files/:id',requireSameOrigin,requireAuth,async (req,res)=>{const row=await safeFileRow(req.user.id,Number(req.params.id));if(!row)return res.status(404).json({error:'File not found.'});const name=sanitizeFilename(req.body?.filename||'');if(!name)return res.status(400).json({error:'A filename is required.'});try{await renameStoredFile(req.user.id,row,name);}catch{return res.status(500).json({error:'Unable to rename file.'});}await audit(req.user.id,'file.rename',{fileId:row.id,filename:name},req);res.json({ok:true,file:{id:row.id,filename:name}});});app.delete('/api/files/:id',requireSameOrigin,requireAuth,async (req,res)=>{const row=await safeFileRow(req.user.id,Number(req.params.id));if(!row)return res.status(404).json({error:'File not found.'});if(!await moveToTrash(req.user.id,row))return res.status(410).json({error:'Stored file is no longer available.'});await audit(req.user.id,'file.delete',{fileId:row.id,recoverable:true},req);res.json({ok:true,recoverable:true});});
// Phase 7: ZIP/File Toolkit basics.
app.post('/api/zip/create',requireSameOrigin,requireAuth,async (req,res)=>{
  const ids=Array.isArray(req.body?.ids)?req.body.ids.map(Number).filter(Boolean).slice(0,100):[];
  if(!ids.length)return res.status(400).json({error:'Select at least one file to package.'});
  const rows=await db.prepare(`SELECT * FROM user_files WHERE user_id=? AND status<>'deleted' AND id IN (${ids.map(()=>'?').join(',')})`).all(req.user.id,...ids);
  if(!rows.length)return res.status(404).json({error:'No valid files selected.'});
  const temp=path.join(os.tmpdir(),`tamptools-zip-${crypto.randomUUID()}`);fs.mkdirSync(temp,{recursive:true});
  try{
    const names=[]; for(const r of rows){if(!await storedFileExists(r))continue;const safe=sanitizeFilename(r.filename);const target=path.join(temp,safe);fs.writeFileSync(target,await readStoredBuffer(r));names.push(safe);}
    if(!names.length)return res.status(410).json({error:'Selected files are no longer available.'});
    const zipName=sanitizeFilename(req.body?.filename||'tamptools-package.zip').replace(/\.zip$/i,'')+'.zip';const out=path.join(temp,zipName);
    execFileSync('zip',['-q','-j',out,...names],{cwd:temp});const buffer=fs.readFileSync(out);const saved=await saveBuffer(req.user.id,'zip-file-toolkit',zipName,buffer,'application/zip',{isTemp:false});await audit(req.user.id,'zip.create',{count:names.length,fileId:saved.id},req);res.status(201).json({file:{id:saved.id,filename:saved.filename,sizeBytes:saved.sizeBytes,downloadUrl:`/api/files/${saved.id}/download`}});
  }catch(error){res.status(500).json({error:'Unable to create ZIP package.'});}finally{try{fs.rmSync(temp,{recursive:true,force:true});}catch{}}
});

// Phase 7: Storage Manager insights and safe organization.
app.get('/api/storage/insights',requireAuth,async (req,res)=>{
  const uid=req.user.id;
  const active=await db.prepare("SELECT * FROM user_files WHERE user_id=? AND status<>'deleted'").all(uid);
  const typeMap={}, folders={};
  for(const f of active){const t=detectFileType(Buffer.alloc(0),f.filename,f.mime_type).type; typeMap[t]=(typeMap[t]||0)+1; const folder=f.folder_path||'Root'; folders[folder]=(folders[folder]||0)+1;}
  const large=[...active].sort((a,b)=>Number(b.size_bytes)-Number(a.size_bytes)).slice(0,25);
  const old=[...active].sort((a,b)=>String(a.created_at).localeCompare(String(b.created_at))).slice(0,25);
  const dupRows=await db.prepare("SELECT sha256,COUNT(*) count,SUM(size_bytes) bytes FROM user_files WHERE user_id=? AND status<>'deleted' AND sha256 IS NOT NULL GROUP BY sha256 HAVING COUNT(*)>1 ORDER BY bytes DESC").all(uid);
  const dupIds=[]; for(const d of dupRows){const rs=await db.prepare("SELECT id,filename,size_bytes AS sizeBytes,created_at AS createdAt FROM user_files WHERE user_id=? AND sha256=? AND status<>'deleted' ORDER BY id").all(uid,d.sha256);dupIds.push({sha256:d.sha256,count:Number(d.count),bytes:Number(d.bytes),files:rs});}
  const usage=await storageUsage(uid); const plan=await getPlanForUser(uid); const limitBytes=Number(plan?.features?.storageMb??500)*1024*1024;
  res.json({scan:{fileCount:active.length,usedBytes:Number(usage.bytes),largeFiles:large.map(x=>({id:x.id,filename:x.filename,sizeBytes:x.size_bytes,folderPath:x.folder_path||''})),oldFiles:old.map(x=>({id:x.id,filename:x.filename,sizeBytes:x.size_bytes,createdAt:x.created_at,folderPath:x.folder_path||''})),duplicates:dupIds,types:typeMap,folders},storage:{usedBytes:Number(usage.bytes),limitBytes,usagePercent:limitBytes?Math.min(100,Number(usage.bytes)/limitBytes*100):0}});
});
app.get('/api/storage/folders',requireAuth,async (req,res)=>{await db.prepare('CREATE TABLE IF NOT EXISTS user_storage_folders (user_id TEXT NOT NULL, folder_path TEXT NOT NULL, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, PRIMARY KEY(user_id, folder_path))').run();const folders=await db.prepare('SELECT folder_path AS folderPath, created_at AS createdAt FROM user_storage_folders WHERE user_id=? ORDER BY folder_path').all(String(req.user.id));res.json({folders});});
app.post('/api/storage/folders',requireSameOrigin,requireAuth,async (req,res)=>{const folder=String(req.body?.folder||'').replace(/^\/+|\/+$/g,'').replace(/[^a-zA-Z0-9._\- /]/g,'').replace(/\/{2,}/g,'/').slice(0,500);if(!folder)return res.status(400).json({error:'Folder name is required.'});await db.prepare('CREATE TABLE IF NOT EXISTS user_storage_folders (user_id TEXT NOT NULL, folder_path TEXT NOT NULL, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, PRIMARY KEY(user_id, folder_path))').run();const parts=folder.split('/').filter(Boolean);let pathPart='';for(const part of parts){pathPart=pathPart?pathPart+'/'+part:part;await db.prepare('INSERT INTO user_storage_folders (user_id, folder_path) VALUES (?,?) ON CONFLICT(user_id, folder_path) DO NOTHING').run(String(req.user.id),pathPart);}await audit(req.user.id,'storage.folder.create',{folder},req);res.status(201).json({ok:true,folder});});
app.post('/api/storage/move',requireSameOrigin,requireAuth,async (req,res)=>{const ids=Array.isArray(req.body?.ids)?req.body.ids.map(Number).filter(Boolean).slice(0,100):[];const folder=String(req.body?.folder||'').replace(/^\/+|\/+$/g,'').slice(0,500);if(!ids.length)return res.status(400).json({error:'Select at least one file.'});await db.prepare(`UPDATE user_files SET folder_path=?,updated_at=CURRENT_TIMESTAMP WHERE user_id=? AND status<>'deleted' AND id IN (${ids.map(()=>'?').join(',')})`).run(folder,req.user.id,...ids);await audit(req.user.id,'file.move',{ids,folder},req);res.json({ok:true,count:ids.length,folder});});
app.get('/api/storage/trash',requireAuth,async (req,res)=>{const rows=await db.prepare("SELECT id,filename,size_bytes AS sizeBytes,deleted_at AS deletedAt FROM user_files WHERE user_id=? AND status='deleted' AND deleted_at IS NOT NULL ORDER BY deleted_at DESC LIMIT 100").all(req.user.id);res.json({files:rows});});
app.post('/api/storage/restore/:id',requireSameOrigin,requireAuth,async (req,res)=>{const row=await db.prepare("SELECT * FROM user_files WHERE id=? AND user_id=? AND status='deleted'").get(Number(req.params.id),req.user.id);if(!row)return res.status(404).json({error:'Trash item not found.'});if(!await restoreFromTrash(req.user.id,row))return res.status(410).json({error:'This item can no longer be recovered.'});await audit(req.user.id,'file.restore',{fileId:row.id},req);res.json({ok:true});});
app.post('/api/storage/cleanup-preview',requireAuth,async (req,res)=>{const days=Math.max(1,Math.min(3650,Number(req.query.days||30)));const rows=await db.prepare("SELECT id,filename,size_bytes AS sizeBytes,created_at AS createdAt FROM user_files WHERE user_id=? AND status<>'deleted' AND created_at <= datetime('now',?) ORDER BY size_bytes DESC LIMIT 200").all(req.user.id,`-${days} day`);res.json({days,files:rows,totalBytes:rows.reduce((n,x)=>n+Number(x.sizeBytes||0),0)});});
app.post('/api/files/:id/process',requireSameOrigin,requireAuth,async (req,res)=>{const row=await safeFileRow(req.user.id,Number(req.params.id));if(!row)return res.status(404).json({error:'File not found.'});const payload={userId:req.user.id,fileId:row.id,operation:String(req.body?.operation||'process').slice(0,100)};const dbJob=await db.prepare("INSERT INTO jobs (type,payload_json,status,max_attempts) VALUES (?,?,?,?)").run('file.process',JSON.stringify(payload),'queued',5);const dbJobId=Number(dbJob.lastInsertRowid);try{const job=await enqueueJob('file.process',{...payload,dbJobId},{attempts:5});await db.prepare('UPDATE user_files SET status=? WHERE id=?').run('processing',row.id);await audit(req.user.id,'file.process.queued',{fileId:row.id,jobId:dbJobId,queueJobId:String(job.id)},req);res.status(202).json({job:{id:dbJobId,queueId:String(job.id),status:'queued'},file:{id:row.id,status:'processing'}});}catch(error){await db.prepare("UPDATE jobs SET status='failed',last_error=?,updated_at=CURRENT_TIMESTAMP WHERE id=?").run(String(error.message||error),dbJobId);return res.status(503).json({error:'Job queue unavailable.',detail:isProduction?undefined:String(error.message||error)});}});

// Phase 8: Batch Studio — shared multi-file processing workspace.
const batchUpload=multer({storage:multer.memoryStorage(),limits:{fileSize:Number(process.env.MAX_FILE_SIZE_BYTES||100*1024*1024),files:500},fileFilter:(req,file,cb)=>cb(null,true)});
app.post('/api/batch/process',requireSameOrigin,requireAuth,async (req,res)=>{
  batchUpload.array('files',500)(req,res,async error=>{
    if(error)return res.status(400).json({error:error.code==='LIMIT_FILE_COUNT'?'Maximum batch size is 500 files.':error.message});
    const files=req.files||[]; if(!files.length)return res.status(400).json({error:'Select at least one file.'});
    const operation=String(req.body?.operation||'').toLowerCase(); const value=String(req.body?.value||'').trim().slice(0,100);
    const supported=['convert','compress','resize','rename','organize','watermark','extract','merge','split','package','image','pdf','document','spreadsheet'];
    if(!supported.includes(operation))return res.status(400).json({error:'Unsupported batch operation.'});
    const plan=await getPlanForUser(req.user.id); const limitBytes=Number(plan?.features?.storageMb??500)*1024*1024; const usage=await storageUsage(req.user.id);
    const results=[]; const temp=path.join(path.dirname(await storageInfo().root),`batch-${crypto.randomUUID()}`);fs.mkdirSync(temp,{recursive:true});
    try{
      for(let i=0;i<files.length;i++){
        const f=files[i]; const detected=detectFileType(f.buffer,f.originalname,f.mimetype); let out=f.buffer,mime=detected.mime,ext=path.extname(f.originalname).replace('.','')||'bin'; let base=path.basename(f.originalname,path.extname(f.originalname));
        if(operation==='convert'||operation==='image'){
          if(detected.type!=='image')throw new Error(`Convert/image operations require image files: ${f.originalname}`);
          const target=(value||'webp').replace('.','').toLowerCase(); const r=await convertImage({buffer:f.buffer,targetFormat:target});out=r.buffer;mime=r.mimeType;ext=r.extension;
        } else if(operation==='compress'){
          if(detected.type==='image'){const r=await compressImage({buffer:f.buffer,mimeType:f.mimetype,quality:70});out=r.buffer;mime=r.mimeType;ext=r.extension;}
          else {out=f.buffer;mime=f.mimetype||mime;}
        } else if(operation==='resize'){
          if(detected.type!=='image')throw new Error(`Resize currently supports image files: ${f.originalname}`);
          const r=await processImage({buffer:f.buffer,originalName:f.originalname,operation:'resize',settings:{width:Number(value)||1600,format:'webp'}});out=r.buffer;mime=r.mimeType;ext=r.extension;
        } else if(operation==='watermark'){
          if(detected.type!=='image')throw new Error(`Watermark currently supports image files: ${f.originalname}`);
          const r=await processImage({buffer:f.buffer,originalName:f.originalname,operation:'watermark',settings:{text:value||'TAMPtools',format:'webp'}});out=r.buffer;mime=r.mimeType;ext=r.extension;
        } else if(operation==='rename'){
          base=`${value||'batch'}-${String(i+1).padStart(3,'0')}`;
        } else if(operation==='organize'){
          // Preserve content; folder assignment is the batch result's organization target.
        } else if(operation==='split'){
          const chunkSize=Math.max(1024,Math.min(100*1024*1024,Number(value)||5*1024*1024)); const chunks=[];
          for(let off=0;off<f.buffer.length;off+=chunkSize)chunks.push({buffer:f.buffer.subarray(off,Math.min(off+chunkSize,f.buffer.length)),suffix:`-part-${Math.floor(off/chunkSize)+1}`});
          for(const c of chunks){const saved=await saveBuffer(req.user.id,'batch-studio',`${base}${c.suffix}.${ext}`,c.buffer,mime,{folderPath:value&&/^[\w ./-]+$/.test(value)?value:''});results.push({id:saved.id,filename:saved.filename,sizeBytes:saved.sizeBytes,downloadUrl:`/api/files/${saved.id}/download`});} continue;
        } else if(operation==='extract'){
          if(detected.type!=='archive')throw new Error(`Extract requires ZIP archives: ${f.originalname}`);
          const zip=path.join(temp,sanitizeFilename(f.originalname));fs.writeFileSync(zip,f.buffer); const listing=execFileSync('unzip',['-Z1',zip],{encoding:'utf8'}).split(/\r?\n/).filter(Boolean).slice(0,500);
          for(const name of listing){if(name.endsWith('/')||name.includes('..')||path.isAbsolute(name))continue;const data=execFileSync('unzip',['-p',zip,name]);const saved=await saveBuffer(req.user.id,'batch-studio',sanitizeFilename(path.basename(name)),data,'application/octet-stream',{folderPath:'batch-extracted'});results.push({id:saved.id,filename:saved.filename,sizeBytes:saved.sizeBytes,downloadUrl:`/api/files/${saved.id}/download`});} continue;
        } else if(operation==='package'){
          // handled below as one ZIP from all inputs
        } else if(operation==='merge'){
          if(files.some(x=>detectFileType(x.buffer,x.originalname,x.mimetype).type!=='pdf'))throw new Error('Merge currently supports PDF files.');
          const merged=await mergePdfs(files.map(x=>x.buffer));out=merged;mime='application/pdf';ext='pdf';base='merged';
          if(i>0)break;
        } else if(operation==='pdf'||operation==='document'||operation==='spreadsheet'){
          // Studio-specific operations are intentionally routed through the shared batch workspace; preserve files until their specialized operation is selected.
        }
        const folder=operation==='organize' ? (value||'batch-organized') : '';
        const saved=await saveBuffer(req.user.id,'batch-studio',`${base}.${ext}`,out,mime,{folderPath:folder});results.push({id:saved.id,filename:saved.filename,sizeBytes:saved.sizeBytes,downloadUrl:`/api/files/${saved.id}/download`});
      }
      if(operation==='package'){
        const packagePath=path.join(temp,'batch-package.zip'); for(const f of files)fs.writeFileSync(path.join(temp,sanitizeFilename(f.originalname)),f.buffer);
        execFileSync('zip',['-q','-j',packagePath,...files.map(f=>sanitizeFilename(f.originalname))],{cwd:temp}); const saved=await saveBuffer(req.user.id,'batch-studio','batch-package.zip',fs.readFileSync(packagePath),'application/zip');results.push({id:saved.id,filename:saved.filename,sizeBytes:saved.sizeBytes,downloadUrl:`/api/files/${saved.id}/download`});
      }
      const added=results.reduce((n,x)=>n+Number(x.sizeBytes||0),0); if(Number(usage.bytes)+added>limitBytes)return res.status(413).json({error:'Storage quota exceeded by batch output.',storage:{usedBytes:Number(usage.bytes),limitBytes}});
      await audit(req.user.id,'batch.process',{operation,count:files.length,outputs:results.length},req); res.status(201).json({operation,count:files.length,results});
    }catch(error){res.status(400).json({error:error.message||'Batch processing failed.'});}finally{try{fs.rmSync(temp,{recursive:true,force:true});}catch{}}
  });
});

app.get('/api/jobs/:id',requireAuth,async (req,res)=>{const job=await db.prepare('SELECT id,type,status,attempts,max_attempts,available_at AS availableAt,completed_at AS completedAt,last_error AS lastError,created_at AS createdAt,updated_at AS updatedAt,payload_json AS payload FROM jobs WHERE id=?').get(Number(req.params.id));if(!job)return res.status(404).json({error:'Job not found.'});let payload={};try{payload=JSON.parse(job.payload||'{}')}catch{}if(payload.userId!==req.user.id)return res.status(404).json({error:'Job not found.'});delete job.payload;res.json({job});});



// Phase 15 — Billing, Credits & Business Accounts.
const CREDIT_PACKS = [500,1000,2500,5000,10000];
const STORAGE_ADDONS = [{gb:10,amountNgn:1000},{gb:50,amountNgn:4000},{gb:100,amountNgn:7000}];
async function creditBalance(userId){return Number(await db.prepare('SELECT COALESCE(SUM(amount),0) AS balance FROM credit_ledger WHERE user_id=?').get(userId).balance||0);}
async function addCredits(userId,amount,reason,reference=null){await db.prepare('INSERT INTO credit_ledger(user_id,amount,reason,reference) VALUES(?,?,?,?)').run(userId,Number(amount),String(reason),reference);return await creditBalance(userId);}
async function billingUser(userId){return await db.prepare('SELECT id,name,email,plan,language,currency,country_code AS countryCode FROM users WHERE id=?').get(userId);}
async function currentSubscription(userId){return await db.prepare(`SELECT s.id,s.status,s.provider,s.provider_reference AS providerReference,s.current_period_start AS currentPeriodStart,s.current_period_end AS currentPeriodEnd,p.name AS plan,p.prices_json AS pricesJson FROM subscriptions s JOIN plans p ON p.id=s.plan_id WHERE s.user_id=? ORDER BY s.id DESC LIMIT 1`).get(userId)||null;}
async function billingSummary(userId){const u=await billingUser(userId);const plan=await getPlanForUser(u);const sub=await currentSubscription(userId);const storageAddonGb=Number(await db.prepare("SELECT COALESCE(SUM(gb),0) AS gb FROM storage_addons WHERE user_id=? AND status='active'").get(userId).gb||0);return {user:u,plan,subscription:sub,credits:await creditBalance(userId),storageAddonGb,creditPacks:CREDIT_PACKS,storageAddons:STORAGE_ADDONS};}

app.get('/api/billing',requireAuth,async (req,res)=>res.json(await billingSummary(req.user.id)));
app.get('/api/billing/plans',async (req,res)=>{const rows=await db.prepare("SELECT id,name,usd,gbp,ngn,prices_json AS pricesJson,monthly_uses AS monthlyUses,features_json AS featuresJson,active,sort_order AS sortOrder FROM plans WHERE active=1 ORDER BY sort_order").all().map(x=>({...x,prices:JSON.parse(x.pricesJson||'{}'),features:JSON.parse(x.featuresJson||'{}')}));res.json({plans:rows,currency:req.user?.currency||'NGN'});});
app.get('/api/billing/credits',requireAuth,async (req,res)=>{const transactions=await db.prepare("SELECT id,amount,reason,reference,created_at AS createdAt FROM credit_ledger WHERE user_id=? ORDER BY id DESC LIMIT 100").all(req.user.id);res.json({balance:await creditBalance(req.user.id),packs:CREDIT_PACKS,transactions});});
app.post('/api/billing/credits/consume',requireSameOrigin,requireAuth,async (req,res)=>{const amount=Number(req.body?.amount);if(!Number.isInteger(amount)||amount<=0)return res.status(400).json({error:'Credit amount must be a positive integer.'});const balance=await creditBalance(req.user.id);if(balance<amount)return res.status(402).json({error:'Insufficient TAMP Credits.',code:'INSUFFICIENT_CREDITS',balance,required:amount});const next=await addCredits(req.user.id,-amount,req.body?.reason||'credit consumption',req.body?.reference||null);await audit(req.user.id,'billing.credit.consumed',{amount,reason:req.body?.reason||null},req);res.json({ok:true,balance:next});});
app.post('/api/billing/credits/checkout',requireSameOrigin,requireAuth,async(req,res)=>{const amount=Number(req.body?.amount);if(!CREDIT_PACKS.includes(amount))return res.status(400).json({error:'Choose a supported TAMP Credit pack.'});const currency=String(req.body?.currency||req.user.currency||'NGN').toUpperCase();const route=selectProvider({country:req.user.countryCode,currency,language:req.user.language});if(!route||!providerConfigured(route))return res.status(503).json({error:'No configured payment provider can process this credit purchase yet.',code:'PAYMENT_PROVIDER_NOT_CONFIGURED'});try{const data=await createCheckout({provider:route,user:req.user,plan:`CREDITS_${amount}`,currency,amount,req,cycle:'one_time'});const checkoutUrl=data?.data?.authorization_url||data?.data?.link||data?.data?.checkout?.url||data?.data?.attributes?.url||data?.url||data?.checkout?.url||null;const reference=data?.data?.reference||data?.data?.id||data?.data?.attributes?.id||data?.id||null;await db.prepare("INSERT INTO billing_transactions(user_id,kind,amount,currency,status,provider,provider_reference,description,metadata_json) VALUES(?,?,?,?,?,?,?,?,?)").run(req.user.id,'credit_purchase',amount,currency,'pending',route,reference,`TAMP Credits ₦${amount}`,JSON.stringify({credits:amount}));res.json({checkoutUrl,reference,provider:route,amount,currency,credits:amount});}catch(e){res.status(502).json({error:e.message||'Unable to create credit checkout.'});}});
app.get('/api/billing/receipts',requireAuth,async (req,res)=>{const rows=await db.prepare("SELECT id,kind,amount,currency,status,provider,provider_reference AS providerReference,description,created_at AS createdAt FROM billing_transactions WHERE user_id=? ORDER BY id DESC LIMIT 100").all(req.user.id);res.json({receipts:rows});});
app.post('/api/billing/cancel',requireSameOrigin,requireAuth,async (req,res)=>{const sub=await currentSubscription(req.user.id);if(!sub||!['active','trialing'].includes(sub.status))return res.status(404).json({error:'No active subscription found.'});await db.prepare("UPDATE subscriptions SET status='canceled',updated_at=CURRENT_TIMESTAMP WHERE id=?").run(sub.id);await db.prepare("UPDATE users SET plan='Free',updated_at=CURRENT_TIMESTAMP WHERE id=?").run(req.user.id);await audit(req.user.id,'billing.subscription.canceled',{subscriptionId:sub.id,plan:sub.plan},req);res.json({ok:true,plan:'Free'});});
app.post('/api/billing/change-plan',requireSameOrigin,requireAuth,async (req,res)=>{const plan=String(req.body?.plan||'');const cycle=String(req.body?.billingCycle||'monthly');const selected=await db.prepare("SELECT name FROM plans WHERE name=? AND active=1").get(plan);if(!selected)return res.status(400).json({error:'Plan unavailable.'});res.json({ok:true,next:'checkout',plan,billingCycle:cycle,checkoutEndpoint:'/api/payments/create-checkout'});});
app.get('/api/business',requireAuth,async (req,res)=>{const ws=await db.prepare('SELECT id,name,seats,created_at AS createdAt FROM business_workspaces WHERE owner_user_id=? ORDER BY id DESC LIMIT 1').get(req.user.id);if(!ws)return res.json({workspace:null,members:[]});const members=await db.prepare('SELECT id,email,role,status,created_at AS createdAt FROM business_members WHERE workspace_id=? ORDER BY id').all(ws.id);res.json({workspace:ws,members});});
app.post('/api/business/workspace',requireSameOrigin,requireAuth,async (req,res)=>{const plan=await getPlanForUser(req.user);if(plan?.name!=='Business')return res.status(403).json({error:'Business plan required.',code:'BUSINESS_PLAN_REQUIRED'});const name=String(req.body?.name||`${req.user.name}'s Workspace`).trim().slice(0,120);const seats=Math.max(1,Math.min(Number(req.body?.seats||1),25));const existing=await db.prepare('SELECT id FROM business_workspaces WHERE owner_user_id=? LIMIT 1').get(req.user.id);if(existing){await db.prepare('UPDATE business_workspaces SET name=?,seats=?,updated_at=CURRENT_TIMESTAMP WHERE id=?').run(name,seats,existing.id);return res.json({ok:true,id:existing.id});}const r=await db.prepare('INSERT INTO business_workspaces(owner_user_id,name,seats) VALUES(?,?,?)').run(req.user.id,name,seats);await db.prepare('INSERT INTO business_members(workspace_id,user_id,email,role,status) VALUES(?,?,?,?,?)').run(Number(r.lastInsertRowid),req.user.id,req.user.email,'owner','active');res.status(201).json({ok:true,id:Number(r.lastInsertRowid)});});
app.post('/api/business/invite',requireSameOrigin,requireAuth,async (req,res)=>{const ws=await db.prepare('SELECT id,seats FROM business_workspaces WHERE owner_user_id=? LIMIT 1').get(req.user.id);if(!ws)return res.status(404).json({error:'Create a Business workspace first.'});const email=String(req.body?.email||'').trim().toLowerCase();if(!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email))return res.status(400).json({error:'Valid email required.'});const count=Number(await db.prepare("SELECT COUNT(*) AS n FROM business_members WHERE workspace_id=? AND status IN ('active','invited')").get(ws.id).n);if(count>=ws.seats)return res.status(409).json({error:'Business seat limit reached.'});try{await db.prepare('INSERT INTO business_members(workspace_id,email,role,status) VALUES(?,?,?,?)').run(ws.id,email,'member','invited');res.json({ok:true});}catch{res.status(409).json({error:'This email is already invited.'});}});
app.get('/api/billing/offers',requireAuth,async (req,res)=>{const promos=await db.prepare("SELECT code,discount_type AS discountType,discount_value AS discountValue,currency,starts_at AS startsAt,ends_at AS endsAt FROM promotions WHERE active=1 ORDER BY id DESC LIMIT 50").all();const student=await db.prepare('SELECT status,discount_percent AS discountPercent,expires_at AS expiresAt FROM student_offers WHERE user_id=?').get(req.user.id)||null;const referral=await db.prepare('SELECT code,reward,status FROM referral_credits WHERE referrer_user_id=? ORDER BY id DESC LIMIT 10').all(req.user.id);res.json({promotions:promos,studentOffer:student,referrals:referral});});
app.post('/api/billing/student-offer',requireSameOrigin,requireAuth,async (req,res)=>{const proof=String(req.body?.proofReference||'').trim().slice(0,200);if(!proof)return res.status(400).json({error:'Student verification reference required.'});await db.prepare(`INSERT INTO student_offers(user_id,status,proof_reference,discount_percent) VALUES(?,?,?,?) ON CONFLICT(user_id) DO UPDATE SET status='pending',proof_reference=excluded.proof_reference`).run(req.user.id,'pending',proof,30);res.json({ok:true,status:'pending'});});
app.post('/api/billing/referral',requireSameOrigin,requireAuth,async (req,res)=>{const code=`TAMP-${req.user.id}-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;try{await db.prepare('INSERT INTO referral_credits(referrer_user_id,code,reward,status) VALUES(?,?,?,?)').run(req.user.id,code,500,'active');}catch{}res.json({code});});
app.post('/api/billing/storage-addon',requireSameOrigin,requireAuth,async (req,res)=>{const gb=Number(req.body?.gb);const addon=STORAGE_ADDONS.find(x=>x.gb===gb);if(!addon)return res.status(400).json({error:'Choose 10, 50 or 100 GB.'});await db.prepare("INSERT INTO storage_addons(user_id,gb,amount_ngn,status) VALUES(?,?,?,?,?)").run(req.user.id,gb,addon.amountNgn,'active');await audit(req.user.id,'billing.storage.addon.added',{gb,amountNgn:addon.amountNgn},req);res.json({ok:true,storageAddonGb:Number(await db.prepare("SELECT COALESCE(SUM(gb),0) AS gb FROM storage_addons WHERE user_id=? AND status='active'").get(req.user.id).gb)});});

// Phase 4.4: promotion engine. Admins can create seasonal discounts without code changes.
function normalizePromoCode(code){return String(code||'').trim().toUpperCase().replace(/\s+/g,'');}
function promoJson(value){try{return JSON.parse(value||'[]')}catch{return[]}}
async function isPromotionEligible(promo,user,plan,currency){
  if(!promo || !promo.active)return {ok:false,reason:'Promotion is inactive.'};
  const now=Date.now();
  if(promo.startsAt && Date.parse(String(promo.startsAt).replace(' ','T')+'Z')>now)return {ok:false,reason:'Promotion has not started yet.'};
  if(promo.endsAt && Date.parse(String(promo.endsAt).replace(' ','T')+'Z')<now)return {ok:false,reason:'Promotion has expired.'};
  if(promo.maxRedemptions!==null && promo.maxRedemptions!==undefined && Number(promo.redemptionCount)>=Number(promo.maxRedemptions))return {ok:false,reason:'Promotion redemption limit has been reached.'};
  const plans=promoJson(promo.planNamesJson); if(plans.length && !plans.includes(plan))return {ok:false,reason:'Promotion does not apply to this plan.'};
  const countries=promoJson(promo.countriesJson); if(countries.length && !countries.includes(String(user.countryCode||'').toUpperCase()))return {ok:false,reason:'Promotion is not available in your country.'};
  if(promo.currency && String(promo.currency).toUpperCase()!==String(currency).toUpperCase())return {ok:false,reason:'Promotion is not available in this currency.'};
  if(Number(promo.newCustomersOnly)){const paid=Number(await db.prepare("SELECT COUNT(*) AS n FROM subscriptions WHERE user_id=? AND status IN ('active','trialing')").get(user.id).n); if(paid>0)return {ok:false,reason:'Promotion is for new customers only.'};}
  return {ok:true};
}
function calculatePromotion(promo,amount){
  const raw=promo.discountType==='percent' ? Number(amount)*Number(promo.discountValue)/100 : Number(promo.discountValue);
  const discount=Math.max(0,Math.min(Number(amount),raw));
  return {discountAmount:Number(discount.toFixed(2)),finalAmount:Number((Number(amount)-discount).toFixed(2))};
}
async function loadPromotion(code){const normalized=normalizePromoCode(code);if(!normalized)return null;return await db.prepare(`SELECT id,code,discount_type AS discountType,discount_value AS discountValue,currency,starts_at AS startsAt,ends_at AS endsAt,max_redemptions AS maxRedemptions,redemption_count AS redemptionCount,new_customers_only AS newCustomersOnly,recurring_cycles AS recurringCycles,plan_names_json AS planNamesJson,countries_json AS countriesJson,active FROM promotions WHERE code=?`).get(normalized);}

app.post('/api/payments/promo/validate',requireSameOrigin,requireAuth,async (req,res)=>{
  const code=normalizePromoCode(req.body?.code); const plan=String(req.body?.plan||''); const currency=String(req.body?.currency||req.user.currency||'USD').toUpperCase();
  if(!code)return res.status(400).json({error:'Enter a promo code.'});
  const selected=await db.prepare('SELECT * FROM plans WHERE name=? AND active=1').get(plan); if(!selected)return res.status(400).json({error:'Selected plan is unavailable.'});
  const amount=pricingAmountForCycle(selected,currency,String(req.body?.billingCycle||'monthly'));
  const promo=await loadPromotion(code); const eligibility=await isPromotionEligible(promo,req.user,plan,currency);
  if(!eligibility.ok)return res.status(400).json({valid:false,error:eligibility.reason});
  const calc=calculatePromotion(promo,amount); res.json({valid:true,code:promo.code,discountType:promo.discountType,discountValue:promo.discountValue,...calc,currency,plan});
});

// Phase 4: admin operations. Set ADMIN_EMAIL to grant the role to that account.
async function requireAdmin(req,res,next){if(!req.user)return res.status(401).json({error:'Authentication required.'});const role=await db.prepare('SELECT role FROM admin_roles WHERE user_id=?').get(req.user.id);if(!role)return res.status(403).json({error:'Admin access required.'});req.adminRole=role.role;next();}
app.get('/api/admin/ai/providers',requireAuth,requireAdmin,async (req,res)=>{let rows=await db.prepare('SELECT id,provider,model,base_url AS baseUrl,priority,cost,enabled,routing_json AS routingJson,created_at AS createdAt,updated_at AS updatedAt FROM ai_providers ORDER BY priority,id').all();res.json({providers:rows});});
app.get('/api/admin/secrets',requireSameOrigin,requireAuth,requireAdmin,async (req,res)=>{
  const rows=await db.prepare('SELECT id,secret_key,provider,metadata_json,created_at,updated_at,last_used_at FROM integration_secrets ORDER BY provider,secret_key').all();
  res.json({secrets:rows.map(x=>({...x,metadata:x.metadata_json?JSON.parse(x.metadata_json):{}})),encryptionConfigured:integrationSecretConfigured()});
});
app.put('/api/admin/secrets/:key',requireSameOrigin,requireAuth,requireAdmin,async (req,res)=>{
  const value=String(req.body?.value||''); const provider=String(req.body?.provider||'custom');
  if(!value) return res.status(400).json({error:'Secret value is required.'});
  if(!encryptionKey()) return res.status(503).json({error:'TAMPTOOLS_ENCRYPTION_KEY is not configured.'});
  const id=await integrationSecretUpsert({key:req.params.key,provider,value,metadata:req.body?.metadata||{}});
  await audit(req.user.id,'admin.secret.updated',{key:secretKeySafe(req.params.key),provider,fingerprint:secretFingerprint(value)},req);
  res.json({ok:true,id,key:secretKeySafe(req.params.key),configured:true});
});
app.delete('/api/admin/secrets/:key',requireSameOrigin,requireAuth,requireAdmin,async (req,res)=>{
  await db.prepare('DELETE FROM integration_secrets WHERE secret_key=?').run(secretKeySafe(req.params.key));
  await audit(req.user.id,'admin.secret.deleted',{key:secretKeySafe(req.params.key)},req); res.json({ok:true});
});

app.post('/api/admin/ai/providers',requireSameOrigin,requireAuth,requireAdmin,async (req,res)=>{const d=req.body||{};if(!d.provider||!d.model)return res.status(400).json({error:'Provider and model are required.'});let secretRef=d.secretRef||`ai:${String(d.provider)}:${String(d.model)}`;if(d.apiKey){await integrationSecretUpsert({key:secretRef,provider:String(d.provider),value:String(d.apiKey),metadata:{type:'ai_provider',model:String(d.model)}});}const r=await db.prepare('INSERT INTO ai_providers(provider,model,base_url,api_key,secret_ref,priority,cost,enabled,routing_json) VALUES(?,?,?,?,?,?,?,?,?)').run(String(d.provider),String(d.model),d.baseUrl||null,null,secretKeySafe(secretRef),Number(d.priority||1),Number(d.cost||0),d.enabled===false?0:1,JSON.stringify(d.routing||{}));await audit(req.user.id,'admin.ai.provider.created',{id:Number(r.lastInsertRowid),provider:d.provider,model:d.model,secretConfigured:Boolean(d.apiKey)},req);res.status(201).json({ok:true,id:Number(r.lastInsertRowid)});});
app.patch('/api/admin/ai/providers/:id',requireSameOrigin,requireAuth,requireAdmin,async (req,res)=>{const d=req.body||{},sets=[],vals=[];for(const [k,col] of [['provider','provider'],['model','model'],['baseUrl','base_url'],['priority','priority'],['cost','cost']])if(d[k]!==undefined){sets.push(`${col}=?`);vals.push(d[k]);} if(d.apiKey){const current=await db.prepare('SELECT provider,model,secret_ref FROM ai_providers WHERE id=?').get(Number(req.params.id)); const ref=secretKeySafe(d.secretRef||current?.secret_ref||`ai:${current?.provider}:${current?.model}`); await integrationSecretUpsert({key:ref,provider:String(current?.provider||d.provider),value:String(d.apiKey),metadata:{type:'ai_provider',model:String(current?.model||d.model)}}); sets.push('secret_ref=?'); vals.push(ref);}if(d.enabled!==undefined){sets.push('enabled=?');vals.push(d.enabled?1:0);}if(d.routing!==undefined){sets.push('routing_json=?');vals.push(JSON.stringify(d.routing));}if(!sets.length)return res.status(400).json({error:'No changes supplied.'});sets.push('updated_at=CURRENT_TIMESTAMP');vals.push(Number(req.params.id));await db.prepare(`UPDATE ai_providers SET ${sets.join(',')} WHERE id=?`).run(...vals);await audit(req.user.id,'admin.ai.provider.updated',{id:Number(req.params.id),fields:Object.keys(d).filter(k=>k!=='apiKey')},req);res.json({ok:true});});
app.delete('/api/admin/ai/providers/:id',requireSameOrigin,requireAuth,requireAdmin,async (req,res)=>{await db.prepare('DELETE FROM ai_providers WHERE id=?').run(Number(req.params.id));await audit(req.user.id,'admin.ai.provider.deleted',{id:Number(req.params.id)},req);res.json({ok:true});});
app.get('/api/admin/ai/status',requireAuth,requireAdmin,async (req,res)=>{const providers=await db.prepare('SELECT provider,model,priority,cost,enabled,CASE WHEN api_key IS NULL OR api_key=\'\' THEN 0 ELSE 1 END AS configured FROM ai_providers ORDER BY priority,id').all();res.json({providers,architecture:'TAMP Assistant → AI Gateway → Provider Router'});});
app.get('/api/admin/metrics',requireAuth,requireAdmin,async (req,res)=>res.json(await adminMetrics()));
app.get('/api/admin/users',requireAuth,requireAdmin,async (req,res)=>{const users=await db.prepare('SELECT id,name,email,plan,language,currency,country_code AS countryCode,created_at AS createdAt,updated_at AS updatedAt FROM users ORDER BY id DESC LIMIT 200').all();res.json({users});});
app.get('/api/admin/audit',requireAuth,requireAdmin,async (req,res)=>{const events=await db.prepare('SELECT id,user_id AS userId,action,metadata_json AS metadataJson,ip_address AS ipAddress,created_at AS createdAt FROM audit_logs ORDER BY id DESC LIMIT 200').all().map(x=>({...x,metadata:JSON.parse(x.metadataJson||'{}')}));res.json({events});});
app.post('/api/admin/storage/cleanup',requireAuth,requireAdmin,async (req,res)=>{const count=await cleanupExpiredFiles();await audit(req.user.id,'admin.storage.cleanup',{deleted:count},req);res.json({ok:true,deleted:count});});
app.patch('/api/admin/plans/:id',requireAuth,requireAdmin,requireSameOrigin,async (req,res)=>{const id=Number(req.params.id);const input=req.body||{};const updates={};for(const c of ['usd','gbp','ngn'])if(input[c]!==undefined&&Number.isFinite(Number(input[c]))&&Number(input[c])>=0)updates[c]=Number(input[c]);if(input.prices&&typeof input.prices==='object')updates.prices=JSON.stringify(input.prices);if(input.creditPacks&&typeof input.creditPacks==='object')updates.creditPacks=JSON.stringify(input.creditPacks);if(!Object.keys(updates).length)return res.status(400).json({error:'Provide at least one valid price or credit pack.'});const sets=[];const vals=[];for(const [k,v] of Object.entries(updates)){sets.push(`${k==='prices'?'prices_json':k==='creditPacks'?'credit_packs_json':k}=?`);vals.push(v);}vals.push(id);await db.prepare(`UPDATE plans SET ${sets.join(',')},updated_at=CURRENT_TIMESTAMP WHERE id=?`).run(...vals);await audit(req.user.id,'admin.plan.pricing.updated',{planId:id,fields:Object.keys(updates)},req);res.json({ok:true});});

const promotionAdminSchema=z.object({
  code:z.string().trim().min(3).max(64), discountType:z.enum(['percent','fixed']), discountValue:z.number().positive(), currency:z.string().length(3).optional().nullable(),
  startsAt:z.string().optional().nullable(), endsAt:z.string().optional().nullable(), maxRedemptions:z.number().int().positive().optional().nullable(),
  newCustomersOnly:z.boolean().optional().default(false), recurringCycles:z.number().int().positive().optional().nullable(), planNames:z.array(z.string()).optional().default([]), countries:z.array(z.string().length(2)).optional().default([]), active:z.boolean().optional().default(true)
});
app.get('/api/admin/promotions',requireAuth,requireAdmin,async (req,res)=>{const rows=await db.prepare('SELECT * FROM promotions ORDER BY id DESC').all().map(x=>({...x,planNames:promoJson(x.plan_names_json),countries:promoJson(x.countries_json)}));res.json({promotions:rows});});
app.post('/api/admin/promotions',requireAuth,requireAdmin,requireSameOrigin,async (req,res)=>{const p=promotionAdminSchema.safeParse(req.body||{});if(!p.success)return res.status(400).json({error:'Invalid promotion details.'});const x=p.data;const code=normalizePromoCode(x.code);try{const r=await db.prepare(`INSERT INTO promotions (code,discount_type,discount_value,currency,starts_at,ends_at,max_redemptions,new_customers_only,recurring_cycles,plan_names_json,countries_json,active,created_by,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,CURRENT_TIMESTAMP)`).run(code,x.discountType,x.discountValue,x.currency?.toUpperCase()||null,x.startsAt||null,x.endsAt||null,x.maxRedemptions??null,x.newCustomersOnly?1:0,x.recurringCycles??null,JSON.stringify(x.planNames||[]),JSON.stringify((x.countries||[]).map(c=>c.toUpperCase())),x.active?1:0,req.user.id);await audit(req.user.id,'admin.promotion.created',{id:Number(r.lastInsertRowid),code},req);res.status(201).json({ok:true,id:Number(r.lastInsertRowid),code});}catch(e){res.status(409).json({error:e.message.includes('UNIQUE')?'Promo code already exists.':'Unable to create promotion.'});}});
app.patch('/api/admin/promotions/:id',requireAuth,requireAdmin,requireSameOrigin,async (req,res)=>{const id=Number(req.params.id);const p=promotionAdminSchema.partial().safeParse(req.body||{});if(!p.success)return res.status(400).json({error:'Invalid promotion details.'});const x=p.data;const sets=[],vals=[];const map={code:'code',discountType:'discount_type',discountValue:'discount_value',currency:'currency',startsAt:'starts_at',endsAt:'ends_at',maxRedemptions:'max_redemptions',newCustomersOnly:'new_customers_only',recurringCycles:'recurring_cycles',active:'active'};for(const [k,v] of Object.entries(x)){if(k==='planNames'||k==='countries')continue;let val=v;if(k==='code')val=normalizePromoCode(v);if(k==='currency')val=v?.toUpperCase()||null;if(k==='newCustomersOnly'||k==='active')val=v?1:0;sets.push(`${map[k]}=?`);vals.push(val);}if(x.planNames!==undefined){sets.push('plan_names_json=?');vals.push(JSON.stringify(x.planNames));}if(x.countries!==undefined){sets.push('countries_json=?');vals.push(JSON.stringify(x.countries.map(c=>c.toUpperCase())));}if(!sets.length)return res.status(400).json({error:'No changes supplied.'});vals.push(id);await db.prepare(`UPDATE promotions SET ${sets.join(',')},updated_at=CURRENT_TIMESTAMP WHERE id=?`).run(...vals);await audit(req.user.id,'admin.promotion.updated',{id},req);res.json({ok:true});});
app.delete('/api/admin/promotions/:id',requireAuth,requireAdmin,requireSameOrigin,async (req,res)=>{const id=Number(req.params.id);await db.prepare('DELETE FROM promotions WHERE id=?').run(id);await audit(req.user.id,'admin.promotion.deleted',{id},req);res.json({ok:true});});

const checkoutSchema = z.object({
  email: z.string().email().max(254),
  plan: z.enum(["Free", "Lite", "Pro", "Business"]),
  currency: z.string().length(3).transform(v => v.toUpperCase()).refine(v => Boolean(CURRENCY_INFO[v]), "Unsupported currency"),
  billingCycle: z.enum(["monthly", "yearly"]).default("monthly"),
  promoCode: z.string().trim().max(64).optional().default("")
});

app.get('/api/payments/providers',async (req,res)=>res.json({providers:paymentProviders(),routing:'automatic',manualSelection:false}));

app.get('/api/payments/route',async(req,res)=>{
  const detected=await resolveLocale(req);
  const route=routeCheckout({country:detected.country,currency:detected.currency,language:detected.language});
  res.json({country:detected.country,currency:detected.currency,language:detected.language,provider:route.provider,reason:route.reason,automatic:true});
});

app.post('/api/payments/create-checkout', requireSameOrigin, requireAuth, async (req,res)=>{
  const parsed=checkoutSchema.safeParse({email:req.body?.email || req.user.email,plan:req.body?.plan,currency:req.body?.currency || req.user.currency,billingCycle:req.body?.billingCycle || 'monthly',promoCode:req.body?.promoCode || ''});
  if(!parsed.success)return res.status(400).json({error:'Invalid checkout details'});
  const {email,plan,currency,billingCycle,promoCode}=parsed.data;
  if(email.toLowerCase()!==req.user.email.toLowerCase())return res.status(403).json({error:'Checkout email must match the signed-in account.'});
  const selected=await db.prepare('SELECT * FROM plans WHERE name=? AND active=1').get(plan); if(!selected)return res.status(400).json({error:'Selected plan is unavailable'});
  const baseAmount=pricingAmountForCycle(selected,currency,billingCycle);
  let promotion=null; let amount=baseAmount;
  if(promoCode){ promotion=await loadPromotion(promoCode); const eligibility=await isPromotionEligible(promotion,req.user,plan,currency); if(!eligibility.ok)return res.status(400).json({error:eligibility.reason,code:'INVALID_PROMO'}); const calc=calculatePromotion(promotion,baseAmount); amount=calc.finalAmount; promotion={...promotion,...calc}; }
  if(plan==='Free')return res.json({message:'Free plan selected.',checkoutUrl:null,currency,amount,provider:null,billingCycle});
  const route=selectProvider({country:req.user.countryCode,currency,language:req.user.language});
  const provider=route;
  if(!provider || !providerConfigured(provider))return res.status(503).json({error:'No configured payment provider can process this checkout yet.',code:'PAYMENT_PROVIDER_NOT_CONFIGURED',available:paymentProviders(),plan,currency,amount,billingCycle});
  try {
    const data=await createCheckout({provider,user:req.user,plan,currency,amount,req,cycle:billingCycle,promotion});
    const checkoutUrl=data?.data?.authorization_url || data?.data?.link || data?.data?.checkout?.url || data?.data?.attributes?.url || data?.data?.attributes?.checkout?.url || data?.url || data?.checkout?.url || null;
    const reference=data?.data?.reference || data?.data?.id || data?.data?.attributes?.id || data?.id || null;
    await db.prepare(`INSERT OR IGNORE INTO payment_events (provider,event_id,event_type,payload_json) VALUES (?,?,?,?)`).run(provider,`checkout-created-${provider}-${reference||crypto.randomUUID()}`,'checkout.created',JSON.stringify({userId:req.user.id,plan,currency,amount,baseAmount,discountAmount:promotion?.discountAmount||0,promoCode:promotion?.code||null,billingCycle,reference}));
    await audit(req.user.id,'payment.checkout.created',{provider,reference,plan,currency,amount,baseAmount,discountAmount:promotion?.discountAmount||0,promoCode:promotion?.code||null,billingCycle,routing:'automatic'},req);
    res.json({checkoutUrl,reference,provider,plan,currency,amount,baseAmount,discountAmount:promotion?.discountAmount||0,promoCode:promotion?.code||null,billingCycle,routingReason:selectProvider({country:req.user.countryCode,currency,language:req.user.language})===provider?'locale/currency route':'fallback'});
  } catch(error) { console.error(error); res.status(502).json({error:error.message||'Unable to create payment checkout.',provider}); }
});


app.get('/api/payments/config',requireAuth,async(req,res)=>{
  const route=selectProvider({country:req.user.countryCode,currency:req.user.currency,language:req.user.language});
  res.json({providers:paymentProviders(),selectedProvider:route,routing:'automatic'});
});

app.post('/api/payments/portal',requireSameOrigin,requireAuth,async(req,res)=>{
  const sub=await db.prepare("SELECT provider,provider_reference FROM subscriptions WHERE user_id=? AND status IN ('active','trialing') ORDER BY id DESC LIMIT 1").get(req.user.id);
  if(!sub)return res.status(404).json({error:'No active paid subscription was found.'});
  if(sub.provider==='paddle'){
    const customer=await db.prepare("SELECT customer_reference FROM payment_customers WHERE user_id=? AND provider='paddle'").get(req.user.id);
    const apiKey=await paymentSecret('paddle','api_key','PADDLE_API_KEY');
    if(customer?.customer_reference && apiKey){
      const body=sub.provider_reference?{subscription_ids:[String(sub.provider_reference)]}:{};
      const r=await fetch(`https://api.paddle.com/customers/${encodeURIComponent(customer.customer_reference)}/portal-sessions`,{method:'POST',headers:{Authorization:`Bearer ${apiKey}`,'Content-Type':'application/json'},body:JSON.stringify(body)});
      const d=await r.json().catch(()=>({}));
      if(r.ok && d?.data?.urls?.general?.overview) return res.json({url:d.data.urls.general.overview,provider:'paddle',deepLinks:d.data.urls.subscriptions||[]});
    }
    if(process.env.PADDLE_CUSTOMER_PORTAL_URL) return res.json({url:process.env.PADDLE_CUSTOMER_PORTAL_URL,provider:'paddle',fallback:true});
    return res.status(503).json({error:'Paddle customer portal is not available yet. Complete the Paddle customer mapping and portal-session API permission.'});
  }
  return res.json({provider:'flutterwave',supportUrl:'/support.html?topic=payment',selfService:true});
});

app.get('/api/payments/support',requireAuth,async(req,res)=>{
  const tickets=await db.prepare("SELECT id,provider,transaction_reference AS transactionReference,issue_type AS issueType,subject,message,status,created_at AS createdAt,updated_at AS updatedAt FROM payment_support_tickets WHERE user_id=? ORDER BY id DESC LIMIT 50").all(req.user.id);
  const receipts=await db.prepare("SELECT id,provider,provider_reference AS providerReference,amount,currency,status,description,created_at AS createdAt FROM billing_transactions WHERE user_id=? ORDER BY id DESC LIMIT 50").all(req.user.id);
  res.json({tickets,receipts});
});

app.post('/api/payments/support',requireSameOrigin,requireAuth,async(req,res)=>{
  const provider=String(req.body?.provider||'').toLowerCase();
  if(provider && !['paddle','flutterwave'].includes(provider)) return res.status(400).json({error:'Unsupported payment provider.'});
  const issueType=String(req.body?.issueType||'payment_problem').trim().slice(0,60);
  const subject=String(req.body?.subject||'Payment issue').trim().slice(0,160);
  const message=String(req.body?.message||'').trim().slice(0,4000);
  const reference=String(req.body?.transactionReference||'').trim().slice(0,200);
  if(message.length<5)return res.status(400).json({error:'Please describe the payment issue.'});
  const r=await db.prepare('INSERT INTO payment_support_tickets(user_id,provider,transaction_reference,issue_type,subject,message) VALUES(?,?,?,?,?,?)').run(req.user.id,provider||null,reference||null,issueType,subject,message);
  await audit(req.user.id,'payment.support.ticket.created',{ticketId:Number(r.lastInsertRowid),provider:provider||null,reference:reference||null},req);
  res.status(201).json({ok:true,ticketId:Number(r.lastInsertRowid),status:'open'});
});

function customPromotionCode(event){const obj=event?.data?.object||event?.data||event||{};return obj?.custom_data?.promotion_code || obj?.meta?.promotion_code || (Array.isArray(obj?.meta)?Object.fromEntries(obj.meta.map(x=>[x.key,x.value])).promotion_code:'') || ''; }

app.post('/api/payments/webhook/:provider',async (req,res)=>{
  const provider=String(req.params.provider||'').toLowerCase();
  if(!['flutterwave','paddle'].includes(provider))return res.status(404).json({error:'Unknown payment provider.'});
  const headers=Object.fromEntries(Object.entries(req.headers).map(([k,v])=>[k.toLowerCase(),Array.isArray(v)?v[0]:v]));
  if(!verifyWebhook(provider,req.rawBody || Buffer.from(JSON.stringify(req.body||{})),headers))return res.status(400).json({error:'Invalid payment webhook signature.'});
  const event=req.body||{}; const normalized=normalizeWebhook(provider,event); if(!normalized.eventId)return res.status(400).json({error:'Webhook event ID missing.'});
  try { await db.prepare('INSERT INTO payment_events (provider,event_id,event_type,payload_json) VALUES (?,?,?,?)').run(provider,String(normalized.eventId),String(normalized.type||'unknown'),JSON.stringify(event)); }
  catch { return res.json({received:true,duplicate:true}); }
  const userId=Number(normalized.userId||0); const planName=normalized.plan;
  if(userId && String(planName||'').startsWith('CREDITS_') && normalized.status==='active'){
    const credits=Number(String(planName).split('_')[1]||0);
    if(CREDIT_PACKS.includes(credits)){
      await addCredits(userId,credits,'credit purchase',String(normalized.reference||normalized.eventId));
      await db.prepare("UPDATE billing_transactions SET status='paid',provider_reference=? WHERE user_id=? AND kind='credit_purchase' AND status='pending' ORDER BY id DESC LIMIT 1").run(String(normalized.reference||normalized.eventId),userId);
      await audit(userId,'billing.credit.purchase.completed',{credits,provider,reference:normalized.reference});
    }
  }
  if(userId && planName && !String(planName).startsWith('CREDITS_')){
    const plan=await db.prepare('SELECT id FROM plans WHERE name=?').get(planName);
    if(plan && normalized.status==='active'){
      if(normalized.customer) await db.prepare(`INSERT INTO payment_customers (user_id,provider,customer_reference,updated_at) VALUES (?,?,?,CURRENT_TIMESTAMP) ON CONFLICT(user_id,provider) DO UPDATE SET customer_reference=excluded.customer_reference,updated_at=CURRENT_TIMESTAMP`).run(userId,provider,String(normalized.customer));
      await db.prepare(`INSERT INTO subscriptions (user_id,plan_id,status,provider,provider_reference,current_period_start,current_period_end,updated_at) VALUES (?,?,?,?,?,?,?,CURRENT_TIMESTAMP)`).run(userId,plan.id,'active',provider,String(normalized.reference||normalized.eventId),null,null);
      await db.prepare('UPDATE users SET plan=?,updated_at=CURRENT_TIMESTAMP WHERE id=?').run(planName,userId);
      const promoCode=String(customPromotionCode(event)||'');
      if(promoCode){const promo=await loadPromotion(promoCode);if(promo){try{await db.prepare('INSERT INTO promotion_redemptions (promotion_id,user_id,subscription_id,provider,provider_reference) VALUES (?,?,?,?,?)').run(promo.id,userId,null,provider,String(normalized.reference||normalized.eventId));await db.prepare('UPDATE promotions SET redemption_count=redemption_count+1,updated_at=CURRENT_TIMESTAMP WHERE id=?').run(promo.id);}catch{}}}
      await audit(userId,'payment.subscription.activated',{provider,plan:planName,reference:normalized.reference});
      const billedPlan=await db.prepare('SELECT ngn FROM plans WHERE name=?').get(planName);
      await db.prepare("INSERT INTO billing_transactions(user_id,kind,amount,currency,status,provider,provider_reference,description,metadata_json) VALUES(?,?,?,?,?,?,?,?,?)").run(userId,'subscription',Number(billedPlan?.ngn||0),'NGN','paid',provider,String(normalized.reference||normalized.eventId),`TAMPtools ${planName} subscription`,JSON.stringify({plan:planName,billingCycle:normalized.billingCycle||'monthly'}));
    } else if(plan && normalized.status!=='active') {
      await db.prepare('UPDATE subscriptions SET status=?,updated_at=CURRENT_TIMESTAMP WHERE provider=? AND provider_reference=?').run('inactive',provider,String(normalized.reference||''));
      await db.prepare("UPDATE users SET plan='Free',updated_at=CURRENT_TIMESTAMP WHERE id=? AND plan=?").run(userId,planName);
      await audit(userId,'payment.subscription.deactivated',{provider,plan:planName,reference:normalized.reference});
    }
  }
  res.json({received:true,provider,eventId:normalized.eventId});
});


// Remove expired sessions periodically.
setInterval(async () => {
  await cleanupExpiredFiles();
  const now = new Date().toISOString().replace('T',' ').replace('Z','');
  await db.prepare('DELETE FROM sessions WHERE expires_at <= ?').run(now);
}, 60 * 60 * 1000).unref();



app.get("/dashboard.html", async (req, res) => {
  if (!await getCurrentUser(req)) return res.redirect(302, "/signin.html?next=dashboard.html");
  return res.sendFile(path.join(frontendDir, "dashboard.html"));
});

app.get('/admin.html',async (req,res)=>{const user=await getCurrentUser(req);if(!user)return res.redirect(302,'/signin.html?next=admin.html');const role=await db.prepare('SELECT role FROM admin_roles WHERE user_id=?').get(user.id);if(!role)return res.status(403).send('Forbidden');return res.sendFile(path.join(frontendDir,'admin.html'));});

// Tool workspace pages are publicly viewable (the page itself shows a
// disabled "sign in to use this tool" state to logged-out visitors) —
// actual tool usage is protected at the API layer (requireAuth on each
// /api/tools/* endpoint), not at the static-file layer. Serving these as
// JSON 401s here previously broke every tool page for logged-out visitors.

app.use(express.static(frontendDir));
app.get("/{*splat}", async (req, res) => res.sendFile(path.join(frontendDir, "index.html")));

app.get('/api/admin/reconciliation',requireAuth,requireAdmin,async (req,res)=>{const orphaned=Number(await db.prepare("SELECT COUNT(*) AS n FROM subscriptions WHERE status IN ('active','trialing') AND (provider IS NULL OR provider_reference IS NULL OR provider_reference='')").get().n);const multiple=Number(await db.prepare("SELECT COUNT(*) AS n FROM (SELECT user_id,COUNT(*) c FROM subscriptions WHERE status IN ('active','trialing') GROUP BY user_id HAVING c>1)").get().n);const failed=Number(await db.prepare("SELECT COUNT(*) AS n FROM payment_events WHERE event_type LIKE '%failed%' OR event_type LIKE '%error%'").get().n);res.json({ok:orphaned===0&&multiple===0,orphanedSubscriptions:orphaned,usersWithMultipleActiveSubscriptions:multiple,failedOrErrorEvents:failed,note:'External provider reconciliation requires live Paddle/Flutterwave credentials; this endpoint checks local consistency only.'});});
app.get('/api/admin/health',requireAuth,requireAdmin,async (req,res)=>{const jobs=await db.prepare("SELECT status,COUNT(*) AS count FROM jobs GROUP BY status").all();const events=await db.prepare("SELECT level,COUNT(*) AS count FROM system_events WHERE created_at>=datetime('now','-24 hours') GROUP BY level").all();const dbOk=await db.prepare('SELECT 1 AS ok').get().ok===1;const redis=await queueHealth();res.json({ok:dbOk&&(!redis.configured||redis.ok),uptimeSeconds:Math.round(process.uptime()),database:dbOk?'ok':'error',redis,jobs,events,environment:isProduction?'production':'development'});});app.put('/api/admin/ai-economics/rates',requireSameOrigin,requireAuth,requireAdmin,async (req,res)=>{const provider=String(req.body?.provider||'').trim().slice(0,40);const model=String(req.body?.model||'').trim().slice(0,160);const inputCost=Number(req.body?.inputCostPerMillion);const outputCost=Number(req.body?.outputCostPerMillion);const imageCost=Number(req.body?.imageCost||0);if(!provider||!model||![inputCost,outputCost,imageCost].every(Number.isFinite)||inputCost<0||outputCost<0||imageCost<0)return res.status(400).json({error:'Provide valid provider, model and non-negative cost values.'});await db.prepare('INSERT INTO ai_provider_rates(provider,model,input_cost_per_million,output_cost_per_million,image_cost,active) VALUES(?,?,?,?,?,1) ON CONFLICT(provider,model) DO UPDATE SET input_cost_per_million=excluded.input_cost_per_million,output_cost_per_million=excluded.output_cost_per_million,image_cost=excluded.image_cost,active=1,updated_at=CURRENT_TIMESTAMP').run(provider,model,inputCost,outputCost,imageCost);await audit(req.user.id,'admin.ai.rate.updated',{provider,model,inputCostPerMillion:inputCost,outputCostPerMillion:outputCost,imageCost},req);res.json({ok:true});});
app.get('/api/admin/ai-economics',requireAuth,requireAdmin,async (req,res)=>{const summary=await economicsSummary();const rates=await db.prepare('SELECT provider,model,input_cost_per_million AS inputCostPerMillion,output_cost_per_million AS outputCostPerMillion,image_cost AS imageCost,active FROM ai_provider_rates ORDER BY provider,model').all();res.json({creditValueNgn:CREDIT_VALUE_NGN,summary,rates});});
app.get('/api/admin/operations',requireAuth,requireAdmin,async (req,res)=>{
  const plans=await db.prepare('SELECT plan,COUNT(*) AS count FROM users GROUP BY plan ORDER BY count DESC').all();
  const geography=await db.prepare("SELECT COALESCE(country_code,'Unknown') AS country,COUNT(*) AS count FROM users GROUP BY country_code ORDER BY count DESC LIMIT 25").all();
  const languages=await db.prepare("SELECT COALESCE(language,'en') AS language,COUNT(*) AS count FROM users GROUP BY language ORDER BY count DESC").all();
  const devices=await db.prepare("SELECT CASE WHEN lower(COALESCE(user_agent,'')) LIKE '%mobile%' THEN 'Mobile' WHEN lower(COALESCE(user_agent,'')) LIKE '%tablet%' THEN 'Tablet' ELSE 'Desktop/Web' END AS device,COUNT(*) AS count FROM audit_logs WHERE action='session.created' GROUP BY device ORDER BY count DESC").all();
  const revenue=await db.prepare("SELECT COALESCE(SUM(CASE WHEN s.status IN ('active','trialing') THEN COALESCE(p.ngn,0) ELSE 0 END),0) AS recurring FROM subscriptions s JOIN plans p ON p.id=s.plan_id").get();
  const credits=await db.prepare("SELECT COALESCE(SUM(CASE WHEN amount>0 THEN amount ELSE 0 END),0) AS purchased,COALESCE(SUM(CASE WHEN amount<0 THEN -amount ELSE 0 END),0) AS consumed FROM credit_ledger").get();
  const usage=await db.prepare("SELECT tool_key AS toolKey,COUNT(*) AS count FROM usage_events WHERE created_at>=datetime('now','-30 day') GROUP BY tool_key ORDER BY count DESC LIMIT 50").all();
  const jobs=await db.prepare("SELECT status,COUNT(*) AS count FROM jobs GROUP BY status").all();
  res.json({plans,geography,languages,devices,revenue:{mrr:Number(revenue?.recurring||0),arr:Number(revenue?.recurring||0)*12},credits,usage,jobs});
});
app.get('/api/admin/security',requireAuth,requireAdmin,async (req,res)=>{
  const missing=[];
  for(const key of ['TAMPTOOLS_ENCRYPTION_KEY']) if(!process.env[key] || process.env[key]==='REPLACE_ME') missing.push(key);
  const productionChecks={https:!isProduction || String(process.env.PUBLIC_APP_URL||'').startsWith('https://'),encryptionKey:!missing.includes('TAMPTOOLS_ENCRYPTION_KEY'),rateLimiting:true,helmet:true,requestIds:true,corsAllowlist:allowedOrigins.size>0};
  res.json({production:isProduction,checks:productionChecks,missingSecrets:missing,sessionDays,notes:['API keys and integration secrets must remain server-side.','Production payment and AI providers require live credentials before end-to-end verification.']});
});
app.post('/api/admin/backup',requireSameOrigin,requireAuth,requireAdmin,async (req,res)=>{
  try{
    const outDir=path.resolve(__dirname,'../../data/backups');fs.mkdirSync(outDir,{recursive:true});
    const file=path.join(outDir,`tamptools-${new Date().toISOString().replace(/[:.]/g,'-')}.db`);
    db.exec(`VACUUM INTO '${file.replace(/'/g,"''")}'`);
    await audit(req.user.id,'admin.backup.created',{file:path.basename(file)},req);
    res.json({ok:true,file:path.basename(file),path:'/data/backups'});
  }catch(e){res.status(500).json({error:'Backup failed.'});}
});

// Durable background jobs are executed by the dedicated BullMQ worker (backend/src/worker.js).

// Global JSON error handler. Without this, any uncaught exception in a route
// falls through to Express's default HTML error page — which breaks every
// frontend fetch() call expecting JSON, surfacing only as a generic
// "Request failed" message with no indication of what actually went wrong.
// This guarantees every error response, expected or not, is JSON.
app.use((err, req, res, next) => {
  console.error("Unhandled error:", err);
  if (res.headersSent) return next(err);
  res.status(err.status || 500).json({ error: isProduction ? "Something went wrong. Please try again." : String(err.message || err) });
});

process.on("uncaughtException", error => { console.error("[TAMPtools] uncaughtException", error); });
process.on("unhandledRejection", error => { console.error("[TAMPtools] unhandledRejection", error); });

const server = app.listen(PORT, "0.0.0.0", () => console.log(`TAMPtools running on http://localhost:${PORT}`));
server.keepAliveTimeout = 65000;
server.headersTimeout = 66000;

let shuttingDown = false;
const shutdown = (signal = "SIGTERM") => {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`[TAMPtools] ${signal} received; shutting down...`);
  const force = setTimeout(() => {
    console.error("[TAMPtools] Forced shutdown after timeout.");
    process.exit(1);
  }, 5000);
  force.unref();
  server.close(async () => {
    await Promise.allSettled([closeQueue(), db.close()]);
    clearTimeout(force);
    process.exit(0);
  });
};
process.once("SIGINT", () => shutdown("SIGINT"));
process.once("SIGTERM", () => shutdown("SIGTERM"));

// Phase 50 — Spreadsheet & Data Cleaner
const spreadsheetUpload = multer({
  storage: multer.memoryStorage(),
  limits: { files: 1, fileSize: 250 * 1024 * 1024 },
  fileFilter: (req,file,cb) => /\.(csv|tsv|xls|xlsx|ods)$/i.test(file.originalname) ? cb(null,true) : cb(new Error("Supported formats: CSV, TSV, XLS, XLSX and ODS."))
});

function spreadsheetPlan(name='Free') {
  const trial=name==='30-Day Trial';
  if(name==='Business') return {name,rows:250000,fileMb:250,sheets:50,smartDedupe:true,audit:true,ai:true,multiSheet:true,presets:true};
  if(name==='Pro'||trial) return {name,rows:100000,fileMb:100,sheets:20,smartDedupe:true,audit:true,ai:true,multiSheet:true,presets:true};
  if(name==='Lite') return {name,rows:25000,fileMb:50,sheets:5,smartDedupe:false,audit:true,ai:false,multiSheet:true,presets:true};
  return {name:'Free',rows:5000,fileMb:25,sheets:1,smartDedupe:false,audit:false,ai:false,multiSheet:false,presets:false};
}

function parseSpreadsheetFile(file, sheet='') {
  const ext=file.originalname.toLowerCase().split('.').pop();
  if(['csv','tsv'].includes(ext)) return {rows:parseDelimited(file.buffer.toString('utf8').replace(/^\ufeff/,''),ext==='tsv'?'\t':','),sheet:'CSV',sheets:['CSV'],format:ext};
  const tmpDir=fs.mkdtempSync(path.join(os.tmpdir(),'tamp-sheet-')); const source=path.join(tmpDir,file.originalname.replace(/[^\w.-]+/g,'_')); fs.writeFileSync(source,file.buffer);
  try {
    let xlsxPath=source;
    if(ext!=='xlsx') { execFileSync('soffice',['--headless','--convert-to','xlsx','--outdir',tmpDir,source],{stdio:'ignore'}); xlsxPath=path.join(tmpDir,path.basename(source).replace(/\.(xls|ods)$/i,'.xlsx')); }
    if(!fs.existsSync(xlsxPath)) throw new Error('Spreadsheet conversion failed.');
    const argSheet=sheet||'';
    const result=JSON.parse(execFileSync('python3',[path.join(process.cwd(),'src/spreadsheet.py'),'read',xlsxPath,argSheet,'0'],{encoding:'utf8',maxBuffer:40*1024*1024}));
    return {rows:result.rows,sheet:result.sheet,sheets:result.sheets,format:ext};
  } finally { fs.rmSync(tmpDir,{recursive:true,force:true}); }
}

function spreadsheetRowsGate(plan, count) {
  if(count>plan.rows) return {ok:false,status:403,body:{error:`Your ${plan.name} plan supports up to ${plan.rows.toLocaleString()} data rows per file. Upgrade for larger spreadsheets.`,code:'SPREADSHEET_ROW_LIMIT',limit:plan.rows,rows:count,plan:plan.name}};
  return {ok:true};
}


// Cover Letter Builder — targeted career application workspace
function coverLetterPlan(name='Free'){
  const map={
    Free:{projects:2,templates:['professional','classic','minimal'],ai:false,ats:false,customColors:false,versions:false,brand:false},
    Lite:{projects:10,templates:['professional','classic','minimal','modern','elegant','executive'],ai:false,ats:true,customColors:true,versions:true,brand:false},
    Pro:{projects:'All',templates:['professional','classic','minimal','modern','elegant','executive','creative','compact'],ai:true,ats:true,customColors:true,versions:true,brand:true},
    Business:{projects:'All',templates:['professional','classic','minimal','modern','elegant','executive','creative','compact'],ai:true,ats:true,customColors:true,versions:true,brand:true}
  }; return map[name]||map.Free;
}
const coverLetterGenerateSchema=z.object({
  name:z.string().trim().min(1).max(120),title:z.string().max(140).optional().default(''),email:z.string().max(180).optional().default(''),phone:z.string().max(80).optional().default(''),location:z.string().max(160).optional().default(''),linkedin:z.string().max(240).optional().default(''),website:z.string().max(240).optional().default(''),
  employer:z.string().trim().min(1).max(180),hiringManager:z.string().max(140).optional().default(''),employerAddress:z.string().max(300).optional().default(''),position:z.string().trim().min(1).max(180),jobDescription:z.string().max(14000).optional().default(''),
  tone:z.enum(['professional','confident','warm','concise','creative']).default('professional'),template:z.string().max(40).default('professional'),keySkills:z.array(z.string().max(100)).max(20).default([]),highlights:z.array(z.string().max(600)).max(8).default([]),motivation:z.string().max(1800).optional().default(''),closing:z.string().max(800).optional().default(''),date:z.string().max(80).optional().default('')
});
function coverLetterPlanName(plan){return coverLetterPlan(plan?.name||'Free')}
function coverLetterText(d){
  const greeting=d.hiringManager?`Dear ${d.hiringManager},`:'Dear Hiring Manager,';
  const intro=d.motivation||`I am writing to apply for the ${d.position} position at ${d.employer}. With a background in ${d.title||'my professional field'}${d.keySkills.length?` and strengths in ${d.keySkills.slice(0,4).join(', ')}`:''}, I am excited by the opportunity to contribute to your team.`;
  const highlights=d.highlights.length?d.highlights.map(x=>`• ${x}`).join('\n'):`I bring a practical, results-focused approach and a strong commitment to delivering high-quality work. I would welcome the opportunity to apply my experience to the priorities outlined for this role.`;
  const roleLine=d.jobDescription?`The position calls for capabilities that align closely with my experience, particularly around ${d.keySkills.slice(0,3).join(', ')||'the role’s core responsibilities'}. I would be glad to discuss how I can contribute to ${d.employer}.`:`I am particularly interested in the opportunity to contribute to ${d.employer} and believe my background would allow me to add value quickly.`;
  const close=d.closing||`Thank you for considering my application. I would welcome the opportunity to discuss my fit for the ${d.position} role and learn more about your team.`;
  return [greeting,'',intro,'',highlights,'',roleLine,'',close,'',`Sincerely,`,d.name].join('\n');
}
function coverLetterAts(d){
  const text=JSON.stringify(d).toLowerCase();const words=(d.jobDescription||'').split(/\W+/).filter(w=>w.length>4).slice(0,40);const matched=words.filter(w=>text.includes(w)).length;const checks=[['Applicant contact details',!!(d.name&&d.email),15],['Employer and position',!!(d.employer&&d.position),15],['Job description supplied',!!d.jobDescription,15],['Role keywords aligned',words.length?matched/words.length>=.18:true,20],['Relevant skills',d.keySkills.length>=3,15],['Specific evidence',d.highlights.length>=2,10],['Clear closing',!!d.closing||true,10]];const score=Math.min(100,checks.reduce((n,x)=>n+(x[1]?x[2]:0),0));return {score,matchedKeywords:matched,totalKeywords:words.length,checks:checks.map(x=>({label:x[0],pass:x[1]})),tips:checks.filter(x=>!x[1]).map(x=>x[0])};}
function coverLetterPdfText(d,letter){return [`${d.name}${d.title?' — '+d.title:''}`,[d.email,d.phone,d.location,d.linkedin,d.website].filter(Boolean).join(' | '),'',d.date||new Date().toLocaleDateString(),'',d.hiringManager||'Hiring Manager',d.employer,d.employerAddress,'',`RE: ${d.position}`,'',letter].filter(Boolean).join('\n');}

app.get('/api/tools/cover-letter-builder/capabilities',requireAuth,async(req,res)=>{const p=await getPlanForUser(req.user.id);const c=coverLetterPlanName(p);res.json({plan:p?.name||'Free',limits:{projects:c.projects},features:{templates:c.templates,ai:c.ai,ats:c.ats,customColors:c.customColors,multipleVersions:c.versions,brand:c.brand}});});
app.post('/api/tools/cover-letter-builder/generate',requireSameOrigin,requireAuth,async(req,res)=>{
  const parsed=coverLetterGenerateSchema.safeParse(req.body||{});if(!parsed.success)return res.status(400).json({error:'Please complete your applicant, employer and position details.'});
  const p=await getPlanForUser(req.user.id),c=coverLetterPlanName(p),recent=await db.prepare("SELECT COUNT(*) AS n FROM usage_events WHERE user_id=? AND tool_key='cover-letter-builder' AND created_at >= datetime('now','start of month')").get(req.user.id);
  if(c.projects!=='All'&&c.projects!=='Fair-use'&&Number(recent?.n||0)>=Number(c.projects))return res.status(403).json({error:`Your ${p?.name||'Free'} plan has reached its cover letter generation limit. Upgrade to create more letters.`,code:'COVER_LETTER_LIMIT'});
  const d=parsed.data;if(!c.templates.includes(d.template))d.template=c.templates[0];const charge=await consumeToolUse(req.user.id,'cover-letter-builder');if(!charge.ok)return res.status(charge.status).json(charge.body);
  try{
    let letter=coverLetterText(d),provider='local';
    if(c.ai){const ai=await generateText({system:`You are an expert career writer. Write a concise, persuasive cover letter for the applicant using only supplied facts. Tailor it to the employer, position and job description. Tone: ${d.tone}. Do not invent achievements, employers, dates or qualifications. Return only the final letter body with greeting and sign-off.`,prompt:`APPLICANT: ${d.name}\nTITLE: ${d.title}\nEMPLOYER: ${d.employer}\nHIRING MANAGER: ${d.hiringManager}\nPOSITION: ${d.position}\nJOB DESCRIPTION:\n${d.jobDescription}\nKEY SKILLS: ${d.keySkills.join(', ')}\nHIGHLIGHTS:\n${d.highlights.join('\n')}\nMOTIVATION: ${d.motivation}\nCLOSING: ${d.closing}`,maxTokens:1000,userId:req.user.id,operation:'cover-letter-generate',estimatedCredits:charge.estimatedCredits,chargedCredits:charge.chargedCredits});letter=ai.text||letter;provider=ai.provider||'local';}
    const ats=coverLetterAts(d),pdf=createTextPdf({title:`Cover Letter — ${d.position}`,text:coverLetterPdfText(d,letter)}),base=sanitizeFilename(`${d.name}-${d.position}`).replace(/\s+/g,'-').toLowerCase()||'cover-letter';
    const pdfFile=await studioFileResponse(req.user.id,'cover-letter-builder',`${base}-cover-letter.pdf`,pdf,'application/pdf','cover-letters');
    const tmp=path.join(os.tmpdir(),`${crypto.randomUUID()}-cover-letter.json`),out=tmp.replace(/\.json$/,'.docx');fs.writeFileSync(tmp,JSON.stringify({...d,letter,_out:out}));execFileSync('python3',[path.join(process.cwd(),'src/cover-letter-builder.py')],{input:fs.readFileSync(tmp),maxBuffer:4*1024*1024});const docx=fs.readFileSync(out);const docxFile=await studioFileResponse(req.user.id,'cover-letter-builder',`${base}-cover-letter.docx`,docx,'application/vnd.openxmlformats-officedocument.wordprocessingml.document','cover-letters');fs.rmSync(tmp,{force:true});fs.rmSync(out,{force:true});await audit(req.user.id,'cover-letter.generated',{template:d.template,position:d.position,employer:d.employer,atsScore:ats.score,provider},req);res.status(201).json({ok:true,coverLetter:{pdf:pdfFile,docx:docxFile,text:letter,ats,provider},usage:charge.usage});
  }catch(e){console.error('Cover letter generation error:',e);res.status(422).json({error:e.message||'Unable to generate the cover letter.'});}
});
app.post('/api/tools/cover-letter-builder/ai-improve',requireSameOrigin,requireAuth,async(req,res)=>{const p=await getPlanForUser(req.user.id);if(!['Pro','Business'].includes(p?.name))return res.status(403).json({error:'AI cover letter writing is available on Pro and Business plans.',code:'COVER_LETTER_AI_PLAN_REQUIRED'});const parsed=z.object({content:z.string().min(1).max(8000),tone:z.enum(['professional','confident','warm','concise','creative']).default('professional'),position:z.string().max(180).optional().default(''),jobDescription:z.string().max(12000).optional().default('')}).safeParse(req.body||{});if(!parsed.success)return res.status(400).json({error:'Provide the letter content to improve.'});const charge=await consumeAiJob(req.user.id,'cover-letter-ai-improve');if(!charge.ok)return res.status(charge.status).json(charge.body);try{const ai=await generateText({system:`You are an expert cover-letter editor. Improve the supplied letter for clarity, specificity and persuasive impact while preserving every factual claim. Tone: ${parsed.data.tone}. Return only the revised letter.`,prompt:`POSITION: ${parsed.data.position}\nJOB DESCRIPTION:\n${parsed.data.jobDescription}\nLETTER:\n${parsed.data.content}`,maxTokens:1200,userId:req.user.id,operation:'cover-letter-ai-improve',estimatedCredits:charge.estimatedCredits,chargedCredits:charge.chargedCredits});res.json({ok:true,text:ai.text,provider:ai.provider,usage:charge.usage});}catch(e){res.status(502).json({error:'Unable to improve this letter right now.'});}});

// Resume Builder — guided career document workspace
app.get('/api/tools/resume-builder/capabilities', requireAuth, async (req,res)=>{
  const plan=await getPlanForUser(req.user.id); const f=plan?.features||{}; const n=f.resumeProjects;
  const all=n==='All'||n==='Fair-use';
  const templates=plan?.name==='Free'?['modern','classic','minimal']:plan?.name==='Lite'?['modern','classic','minimal','executive','creative','academic']:['modern','classic','minimal','executive','creative','academic','professional','compact'];
  res.json({plan:plan?.name||'Free',limits:{projects:all?n:Number(n||2)},features:{templates,ats:plan?.name!=='Free',ai:['Pro','Business'].includes(plan?.name),customColors:plan?.name!=='Free',photo:['Pro','Business'].includes(plan?.name),multipleVersions:plan?.name!=='Free',feedback:['Pro','Business'].includes(plan?.name)}});
});
const resumeGenerateSchema=z.object({name:z.string().trim().min(1).max(120),title:z.string().max(120).optional().default(''),email:z.string().max(180).optional().default(''),phone:z.string().max(80).optional().default(''),location:z.string().max(120).optional().default(''),linkedin:z.string().max(240).optional().default(''),website:z.string().max(240).optional().default(''),summary:z.string().max(3000).optional().default(''),targetJob:z.string().max(160).optional().default(''),jobDescription:z.string().max(12000).optional().default(''),template:z.string().max(40).default('modern'),skills:z.array(z.string().max(100)).max(40).default([]),languages:z.array(z.string().max(100)).max(20).default([]),experience:z.array(z.object({role:z.string().max(160).default(''),company:z.string().max(160).default(''),location:z.string().max(120).default(''),dates:z.string().max(100).default(''),bullets:z.array(z.string().max(500)).max(12).default([])})).max(30).default([]),education:z.array(z.object({degree:z.string().max(180).default(''),school:z.string().max(180).default(''),dates:z.string().max(100).default('')})).max(15).default([]),certifications:z.array(z.object({name:z.string().max(180).default(''),issuer:z.string().max(180).default(''),date:z.string().max(100).default('')})).max(20).default([])});
function resumeText(d){const lines=[`${d.name}${d.title?' — '+d.title:''}`,[d.email,d.phone,d.location,d.linkedin,d.website].filter(Boolean).join(' | '),''];if(d.summary)lines.push('PROFESSIONAL SUMMARY',d.summary,'');if(d.experience?.length){lines.push('EXPERIENCE');for(const e of d.experience){lines.push(`${e.role} — ${e.company}${e.dates?' | '+e.dates:''}`,...(e.bullets||[]).map(x=>'• '+x),'');}}if(d.education?.length){lines.push('EDUCATION');for(const e of d.education)lines.push(`${e.degree} — ${e.school}${e.dates?' | '+e.dates:''}`);lines.push('');}if(d.skills?.length)lines.push('SKILLS',d.skills.join(' • '),'');if(d.certifications?.length){lines.push('CERTIFICATIONS');for(const e of d.certifications)lines.push(`${e.name} — ${e.issuer}${e.date?' | '+e.date:''}`);lines.push('');}if(d.languages?.length)lines.push('LANGUAGES',d.languages.join(' • '));return lines.filter((x,i)=>x!==''||lines[i-1]!=='').join('\n');}
function resumeAts(d){const text=JSON.stringify(d).toLowerCase();const checks=[['Contact details',!!(d.email&&d.phone),8],['Professional summary',!!d.summary,12],['Experience',d.experience?.length>0,15],['Achievement bullets',(d.experience||[]).reduce((n,e)=>n+(e.bullets?.length||0),0)>=3,15],['Education',d.education?.length>0,10],['Skills',d.skills?.length>=5,12],['Certifications',d.certifications?.length>0,6],['Target role',!!d.targetJob,8],['Job keywords',d.jobDescription?d.jobDescription.split(/\W+/).filter(w=>w.length>4).some(w=>text.includes(w.toLowerCase())):false,14]];const score=Math.min(100,checks.reduce((n,x)=>n+(x[1]?x[2]:0),0));return {score,checks:checks.map(x=>({label:x[0],pass:x[1]})),tips:checks.filter(x=>!x[1]).map(x=>x[0])};}
app.post('/api/tools/resume-builder/generate', requireSameOrigin, requireAuth, async (req,res)=>{
  const parsed=resumeGenerateSchema.safeParse(req.body||{});if(!parsed.success)return res.status(400).json({error:'Please complete the required resume fields.'});
  const plan=await getPlanForUser(req.user.id);const f=plan?.features||{};const limit=f.resumeProjects;const recent=await db.prepare("SELECT COUNT(*) AS n FROM usage_events WHERE user_id=? AND tool_key='resume-builder' AND created_at >= datetime('now','start of month')").get(req.user.id);if(limit!=='All'&&limit!=='Fair-use'&&Number(recent?.n||0)>=Number(limit||2))return res.status(403).json({error:`Your ${plan?.name||'Free'} plan has reached its resume generation limit. Upgrade to create more resumes.`,code:'RESUME_LIMIT'});
  const d=parsed.data;const allowed=new Set((plan?.name==='Free'?['modern','classic','minimal']:plan?.name==='Lite'?['modern','classic','minimal','executive','creative','academic']:['modern','classic','minimal','executive','creative','academic','professional','compact']));if(!allowed.has(d.template))d.template='modern';
  const charge=await consumeToolUse(req.user.id,'resume-builder');if(!charge.ok)return res.status(charge.status).json(charge.body);
  try{const ats=resumeAts(d);const pdf= createTextPdf({title:`Resume — ${d.name}`,text:resumeText(d)});const base=sanitizeFilename(d.name||'resume').replace(/\s+/g,'-').toLowerCase()||'resume';const pdfFile=await studioFileResponse(req.user.id,'resume-builder',`${base}-resume.pdf`,pdf,'application/pdf','resumes');
    const tmp=path.join(os.tmpdir(),`${crypto.randomUUID()}-resume.json`);fs.writeFileSync(tmp,JSON.stringify({...d,_out:tmp.replace(/\.json$/,'.docx')}));execFileSync('python3',[path.join(process.cwd(),'src/resume-builder.py')],{input:fs.readFileSync(tmp),maxBuffer:4*1024*1024});const docxPath=tmp.replace(/\.json$/,'.docx');const docx=fs.readFileSync(docxPath);const docxFile=await studioFileResponse(req.user.id,'resume-builder',`${base}-resume.docx`,docx,'application/vnd.openxmlformats-officedocument.wordprocessingml.document','resumes');fs.rmSync(tmp,{force:true});fs.rmSync(docxPath,{force:true});await audit(req.user.id,'resume.generated',{template:d.template,targetJob:d.targetJob,atsScore:ats.score},req);res.status(201).json({ok:true,resume:{pdf:pdfFile,docx:docxFile,ats},usage:charge.usage});}catch(e){console.error('Resume generation error:',e);res.status(422).json({error:e.message||'Unable to generate the resume.'});}
});
app.post('/api/tools/resume-builder/ai-improve', requireSameOrigin, requireAuth, async (req,res)=>{
  const plan=await getPlanForUser(req.user.id);if(!['Pro','Business'].includes(plan?.name))return res.status(403).json({error:'AI resume writing is available on Pro and Business plans.',code:'RESUME_AI_PLAN_REQUIRED'});const parsed=z.object({section:z.enum(['summary','experience','skills']),content:z.string().min(1).max(6000),targetJob:z.string().max(200).optional().default(''),jobDescription:z.string().max(10000).optional().default('')}).safeParse(req.body||{});if(!parsed.success)return res.status(400).json({error:'Provide the resume section you want improved.'});const charge=await consumeAiJob(req.user.id,'resume-ai-improve');if(!charge.ok)return res.status(charge.status).json(charge.body);try{const ai=await generateText({system:'You are an expert resume writer. Improve the supplied resume content without inventing facts. Use concise, achievement-focused, ATS-friendly language. Return only the improved text.',prompt:`SECTION: ${parsed.data.section}\nTARGET ROLE: ${parsed.data.targetJob}\nJOB DESCRIPTION: ${parsed.data.jobDescription}\nCONTENT:\n${parsed.data.content}`,maxTokens:900,userId:req.user.id,operation:'resume-ai-improve',estimatedCredits:charge.estimatedCredits,chargedCredits:charge.chargedCredits});res.json({ok:true,text:ai.text,provider:ai.provider,usage:charge.usage});}catch(e){res.status(502).json({error:'Unable to improve this section right now.'});}});

app.get('/api/tools/spreadsheet-data-cleaner/capabilities', requireAuth, async (req,res)=>{
  const p=await getPlanForUser(req.user.id); const c=spreadsheetPlan(p?.name||'Free');
  res.json({plan:c.name,features:{maxRows:c.rows,maxFileMb:c.fileMb,maxSheets:c.sheets,preview:true,emptyRows:true,duplicates:true,normalize:true,errorScan:true,exportCsv:true,exportXlsx:true,smartDedupe:c.smartDedupe,auditReport:c.audit,diffWorkbook:c.audit,aiCleanup:c.ai,multiSheet:c.multiSheet,presets:c.presets}});
});

app.post('/api/spreadsheets/ai-clean',requireSameOrigin,requireAuth,async(req,res)=>{try{const plan=spreadsheetPlan((await getPlanForUser(req.user.id))?.name||'Free');if(!plan.ai)return res.status(403).json({error:'AI cleanup suggestions are available on Pro and Business plans.',code:'PLAN_FEATURE_LIMIT',feature:'spreadsheetAi',plan:plan.name});const sample=String(req.body?.sample||'').slice(0,12000);if(!sample)return res.status(400).json({error:'Provide a spreadsheet sample.'});const charge=await consumeAiJob(req.user.id,'spreadsheet-ai-clean');if(!charge.ok)return res.status(charge.status).json(charge.body);const result=await generateText({system:'You are TAMPtools Spreadsheet & Data Cleaner. Analyze a tabular sample and return concise actionable JSON with suggested column normalizations, duplicate keys, missing-data risks, invalid email risks, and date/phone/country cleanup suggestions. Do not invent values.',prompt:sample,maxTokens:1000,userId:req.user.id,operation:'spreadsheet-ai-clean',estimatedCredits:charge.estimatedCredits,chargedCredits:charge.chargedCredits});res.json({ok:true,suggestions:result.text,provider:result.provider,usage:charge});}catch(e){res.status(422).json({error:e.message||'AI analysis unavailable.'});}});

app.post('/api/spreadsheets/inspect',requireSameOrigin,requireAuth,spreadsheetUpload.single('file'),async(req,res)=>{
  try {
    if(!req.file) return res.status(400).json({error:'Spreadsheet file required.'});
    const plan=spreadsheetPlan((await getPlanForUser(req.user.id))?.name||'Free');
    if(req.file.size>plan.fileMb*1024*1024) return res.status(403).json({error:`Your ${plan.name} plan supports files up to ${plan.fileMb} MB.`,code:'SPREADSHEET_FILE_LIMIT',limitMb:plan.fileMb,plan:plan.name});
    const parsed=parseSpreadsheetFile(req.file,String(req.body?.sheet||''));
    const gate=spreadsheetRowsGate(plan,Math.max(0,parsed.rows.length-1)); if(!gate.ok)return res.status(gate.status).json(gate.body);
    if((parsed.sheets||[]).length>plan.sheets)return res.status(403).json({error:`Your ${plan.name} plan supports up to ${plan.sheets} worksheets per file.`,code:'SPREADSHEET_SHEET_LIMIT',limit:plan.sheets,plan:plan.name,sheets:parsed.sheets});
    const report=inspectSpreadsheet(parsed.rows,{smart:Boolean(req.body?.smart==='true')&&plan.smartDedupe});
    res.json({ok:true,name:req.file.originalname,format:parsed.format,sheet:parsed.sheet,sheets:parsed.sheets,headers:report.headers,rows:[report.headers,...report.data.slice(0,100)],rowCount:report.rowCount,stats:report.stats,plan:plan.name});
  } catch(e) { console.error(e); res.status(422).json({error:e.message||'Unable to inspect this spreadsheet.'}); }
});

app.post('/api/spreadsheets/clean',requireSameOrigin,requireAuth,spreadsheetUpload.single('file'),async(req,res)=>{
  try {
    if(!req.file) return res.status(400).json({error:'Spreadsheet file required.'});
    const plan=spreadsheetPlan((await getPlanForUser(req.user.id))?.name||'Free');
    if(req.file.size>plan.fileMb*1024*1024) return res.status(403).json({error:`Your ${plan.name} plan supports files up to ${plan.fileMb} MB.`,code:'SPREADSHEET_FILE_LIMIT',limitMb:plan.fileMb,plan:plan.name});
    const parsed=parseSpreadsheetFile(req.file,String(req.body?.sheet||''));
    const gate=spreadsheetRowsGate(plan,Math.max(0,parsed.rows.length-1)); if(!gate.ok)return res.status(gate.status).json(gate.body);
    const smart=req.body.smartDedupe==='true'; if(smart&&!plan.smartDedupe)return res.status(403).json({error:'Smart duplicate detection is available on Pro and Business plans.',code:'PLAN_FEATURE_LIMIT',feature:'smartDedupe',plan:plan.name});
    const wantAudit=req.body.audit==='true'; if(wantAudit&&!plan.audit)return res.status(403).json({error:'Audit/diff workbooks are available from Lite.',code:'PLAN_FEATURE_LIMIT',feature:'auditReport',plan:plan.name});
    const charge=await consumeToolUse(req.user.id,'spreadsheet-data-cleaner'); if(!charge.ok)return res.status(charge.status).json(charge.body);
    const opts={preset:['conservative','standard','aggressive'].includes(req.body.preset)?req.body.preset:'standard',removeDuplicates:req.body.removeDuplicates==='true',removeEmptyRows:req.body.removeEmptyRows==='true',smartDedupe:smart,whitespace:req.body.whitespace!=='false',normalizeEmail:req.body.normalizeEmail==='true',names:req.body.names==='true',phones:req.body.phones==='true',countries:req.body.countries==='true',dates:req.body.dates==='true',numbers:req.body.numbers==='true'};
    const out=cleanSpreadsheet(parsed.rows,opts);
    const format=String(req.body?.format||'xlsx').toLowerCase()==='csv'?'csv':'xlsx';
    const base=safeName(req.file.originalname).replace(/\.[^.]+$/,'')||'spreadsheet';
    let saved, auditFile=null;
    if(format==='xlsx'){
      const tmp=path.join(os.tmpdir(),`tamp-${crypto.randomUUID()}.xlsx`);
      try { execFileSync('python3',[path.join(process.cwd(),'src/spreadsheet.py'),'write',tmp],{input:JSON.stringify({sheet:parsed.sheet,rows:out.rows,summary:[['Metric','Value'],['Rows processed',out.rows.length-1],['Rows removed',out.stats.removedRows],['Cells changed',out.stats.changedCells],['Exact duplicates removed',out.removedRows.filter(x=>x.reason==='Exact duplicate').length],['Smart duplicates removed',out.removedRows.filter(x=>x.reason==='Smart near-duplicate').length],['Blank rows removed',out.removedRows.filter(x=>x.reason==='Empty row').length],['Error cells found',out.stats.errorCells],['Invalid emails remaining',out.stats.invalidEmails]],changes:wantAudit?out.changes:[],removedRows:wantAudit?out.removedRows:[]}),encoding:'utf8',maxBuffer:20*1024*1024}); saved=await saveBuffer(req.user.id,'spreadsheet-data-cleaner',`${base}-cleaned.xlsx`,fs.readFileSync(tmp),'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      } finally { fs.rmSync(tmp,{force:true}); }
    } else { const csv=out.rows.map(r=>r.map(csvEscape).join(',')).join('\n'); saved=await saveBuffer(req.user.id,'spreadsheet-data-cleaner',`${base}-cleaned.csv`,Buffer.from(csv),'text/csv'); }
    if(wantAudit){
      const tmp=path.join(os.tmpdir(),`tamp-${crypto.randomUUID()}-audit.xlsx`);
      try { execFileSync('python3',[path.join(process.cwd(),'src/spreadsheet.py'),'write',tmp],{input:JSON.stringify({sheet:'Cleaned Data',rows:out.rows,summary:[['Metric','Value'],['Source file',req.file.originalname],['Worksheet',parsed.sheet],['Rows processed',parsed.rows.length-1],['Rows removed',out.stats.removedRows],['Cells changed',out.stats.changedCells],['Remaining errors',out.stats.errorCells],['Remaining invalid emails',out.stats.invalidEmails]],changes:out.changes,removedRows:out.removedRows}),encoding:'utf8',maxBuffer:20*1024*1024}); auditFile=await saveBuffer(req.user.id,'spreadsheet-data-cleaner',`${base}-audit-diff.xlsx`,fs.readFileSync(tmp),'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'); } finally { fs.rmSync(tmp,{force:true}); }
    }
    await audit(req.user.id,'spreadsheet.cleaned',{rows:out.rows.length-1,removedRows:out.stats.removedRows,changedCells:out.stats.changedCells,format,smartDedupe:smart,audit:wantAudit},req);
    res.status(201).json({ok:true,file:{id:saved.id,downloadUrl:`/api/files/${saved.id}/download`,filename:saved.filename},auditFile:auditFile?{id:auditFile.id,downloadUrl:`/api/files/${auditFile.id}/download`,filename:auditFile.filename}:null,rows:out.rows.length-1,stats:out.stats,removedRows:out.removedRows.slice(0,100),usage:charge.usage});
  } catch(e) { console.error(e); res.status(422).json({error:e.message||'Unable to clean this spreadsheet.'}); }
});
