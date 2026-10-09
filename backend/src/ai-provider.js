import crypto from 'node:crypto';
import { db } from './db/database.js';
import { integrationSecretGet } from './secret-store.js';
import { recordAiProviderUsage, refundAiCredits } from './ai-economics.js';

const envKey = p => process.env[`${p.toUpperCase()}_API_KEY`] && process.env[`${p.toUpperCase()}_API_KEY`] !== 'REPLACE_ME' ? process.env[`${p.toUpperCase()}_API_KEY`] : null;
const defaults = [
  {provider:'openai',model:process.env.OPENAI_TEXT_MODEL||'gpt-4o-mini',baseUrl:process.env.OPENAI_BASE_URL||'https://api.openai.com/v1',priority:1,cost:0.15,enabled:1},
  {provider:'gemini',model:process.env.GEMINI_TEXT_MODEL||'gemini-2.0-flash',baseUrl:'https://generativelanguage.googleapis.com/v1beta',priority:2,cost:0.10,enabled:0},
  {provider:'claude',model:process.env.CLAUDE_TEXT_MODEL||'claude-3-5-haiku-latest',baseUrl:'https://api.anthropic.com/v1',priority:3,cost:0.25,enabled:0}
];
async function configs(){
  try {
    const rows=await db.prepare('SELECT provider,model,base_url AS baseUrl,api_key AS apiKey,secret_ref AS secretRef,priority,cost,enabled FROM ai_providers WHERE enabled=1 ORDER BY priority ASC,id ASC').all();
    if(rows.length){
      const resolved=[];
      for(const row of rows){
        const secretKey = row.secretRef || null;
        const storedKey = secretKey ? await integrationSecretGet(secretKey) : null;
        const apiKey = storedKey || row.apiKey || envKey(row.provider);
        if(apiKey) resolved.push({...row,apiKey});
      }
      if(resolved.length) return resolved;
    }
  } catch {}
  return defaults.filter(x=>envKey(x.provider)).map(x=>({...x,apiKey:envKey(x.provider)}));
}
function promptText(system,prompt){ return [{role:'system',content:system||'You are TAMPtools AI.'},{role:'user',content:prompt}]; }
async function callOpenAI(c,messages,maxTokens){
 const r=await fetch(`${c.baseUrl}/chat/completions`,{method:'POST',headers:{Authorization:`Bearer ${c.apiKey}`,'Content-Type':'application/json'},body:JSON.stringify({model:c.model,messages,max_tokens:maxTokens,temperature:.7})});
 if(!r.ok)throw new Error(`openai:${r.status}`); const d=await r.json();
 return {text:d.choices?.[0]?.message?.content?.trim()||'',usage:{inputTokens:Number(d.usage?.prompt_tokens||0),outputTokens:Number(d.usage?.completion_tokens||0)}};
}
async function callGemini(c,messages,maxTokens){
 const system=messages.find(x=>x.role==='system')?.content||''; const contents=messages.filter(x=>x.role!=='system').map(x=>({role:x.role==='assistant'?'model':'user',parts:[{text:x.content}]}));
 const r=await fetch(`${c.baseUrl}/models/${encodeURIComponent(c.model)}:generateContent?key=${encodeURIComponent(c.apiKey)}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({systemInstruction:{parts:[{text:system}]},contents,generationConfig:{maxOutputTokens:maxTokens,temperature:.7}})});
 if(!r.ok)throw new Error(`gemini:${r.status}`); const d=await r.json(); const u=d.usageMetadata||{};
 return {text:d.candidates?.[0]?.content?.parts?.map(p=>p.text||'').join('').trim()||'',usage:{inputTokens:Number(u.promptTokenCount||0),outputTokens:Number(u.candidatesTokenCount||0)}};
}
async function callClaude(c,messages,maxTokens){
 const system=messages.find(x=>x.role==='system')?.content||''; const r=await fetch(`${c.baseUrl}/messages`,{method:'POST',headers:{'x-api-key':c.apiKey,'anthropic-version':'2023-06-01','Content-Type':'application/json'},body:JSON.stringify({model:c.model,max_tokens:maxTokens,system,messages:messages.filter(x=>x.role!=='system')})});
 if(!r.ok)throw new Error(`anthropic:${r.status}`); const d=await r.json();
 return {text:d.content?.map(x=>x.text||'').join('').trim()||'',usage:{inputTokens:Number(d.usage?.input_tokens||0),outputTokens:Number(d.usage?.output_tokens||0)}};
}
async function call(c,messages,maxTokens){ if(c.provider==='openai')return callOpenAI(c,messages,maxTokens); if(c.provider==='gemini')return callGemini(c,messages,maxTokens); if(c.provider==='claude')return callClaude(c,messages,maxTokens); throw new Error(`Unsupported provider: ${c.provider}`); }
export async function generateText({system,prompt,messages,maxTokens=1200,preferredProvider,userId=null,operation='unknown',chargedCredits=0,estimatedCredits=0}){
  let list=configs(); if(preferredProvider) list=[...list.filter(x=>x.provider===preferredProvider),...list.filter(x=>x.provider!==preferredProvider)];
  if(!list.length)return {provider:'local-fallback',text:localFallback(prompt||messages?.at(-1)?.content||'')};
  const errors=[];
  for(const c of list){ try { const result=await call(c,messages||promptText(system,prompt),maxTokens); const output={provider:c.provider,model:c.model,text:result.text,usage:result.usage||{}}; if(userId) await recordAiProviderUsage({userId,operation,provider:output.provider,model:output.model,usage:output.usage,estimatedCredits,chargedCredits,status:'completed'}); return output; } catch(e){ errors.push(e.message); } }
  if(userId){ if(chargedCredits) await refundAiCredits(userId,chargedCredits,operation,`fallback-${Date.now()}`); await recordAiProviderUsage({userId,operation,provider:'local-fallback',model:'local-fallback',usage:{},estimatedCredits,chargedCredits:0,status:'fallback',error:errors.join('; ').slice(0,1000)}); }
  return {provider:'local-fallback',text:localFallback(prompt||messages?.at(-1)?.content||''),fallback:true,errors,usage:{inputTokens:0,outputTokens:0}};
}
export async function generateImage({prompt,size='1024x1024'}){
 const c=(await configs()).find(x=>x.provider==='openai'); const key=c?.apiKey||envKey('openai');
 if(!key)return {provider:'local-fallback',url:`data:image/svg+xml;charset=utf-8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024"><rect width="100%" height="100%" fill="#f4efff"/><text x="50%" y="48%" text-anchor="middle" font-family="Arial" font-size="34" fill="#5b35c9">TAMPtools image preview</text></svg>`)}`};
 const r=await fetch(`${c?.baseUrl||process.env.OPENAI_BASE_URL||'https://api.openai.com/v1'}/images/generations`,{method:'POST',headers:{Authorization:`Bearer ${key}`,'Content-Type':'application/json'},body:JSON.stringify({model:process.env.OPENAI_IMAGE_MODEL||'gpt-image-1',prompt,size,n:1})}); if(!r.ok)throw new Error(`Image provider returned HTTP ${r.status}`); const d=await r.json(); return {provider:'openai',url:d.data?.[0]?.url||(d.data?.[0]?.b64_json?`data:image/png;base64,${d.data[0].b64_json}`:'')};
}
function localFallback(prompt){return `TAMPtools draft based on: ${prompt}\n\nNext steps: refine the outcome, review the result, and continue in the recommended TAMPtools workspace.`}
export function requestId(){return crypto.randomUUID()}
