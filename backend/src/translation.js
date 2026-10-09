import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { db } from './db/database.js';
import { generateText } from './ai-provider.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const frontendDir = path.resolve(__dirname, '../../frontend');
let sourceCatalogPromise;
async function sourceCatalog(){
  if(!sourceCatalogPromise) sourceCatalogPromise=fs.readFile(path.join(frontendDir,'ui-translations.json'),'utf8').then(JSON.parse);
  return sourceCatalogPromise;
}
function rowsToDict(rows){return Object.fromEntries(rows.map(r=>[r.source_key,r.translated_text]));}
const ALIASES={en_us:'en',en_gb:'en_gb',zh_cn:'zh',pt_br:'pt',ar_eg:'ar_eg'};
const LANGUAGE_NAMES={en:'English',en_gb:'British English',zh:'Simplified Chinese',es:'Spanish',fr:'French',de:'German',pt:'Portuguese',ru:'Russian',id:'Indonesian',tr:'Turkish',hi:'Hindi',bn:'Bengali',ar:'Arabic',ar_eg:'Egyptian Arabic',ur:'Urdu',ja:'Japanese',mr:'Marathi',vi:'Vietnamese',te:'Telugu',ha:'Hausa',zu:'Zulu',pcm:'Nigerian Pidgin'};
function normalizeLanguage(language){const raw=String(language||'en').toLowerCase().replace('-','_');return ALIASES[raw]||raw;}


// TAMPtools uses its own curated translation catalog. No external translation API
// is called at runtime, so translation has no per-request provider cost.
export async function getCompleteDictionary(language){
  const lang=normalizeLanguage(language);
  const catalog=await sourceCatalog();
  const source=catalog.en||{};
  if(lang==='en') return source;
  let cached=[]; try { cached=await db.prepare('SELECT source_key,translated_text FROM i18n_translations WHERE language=?').all(lang); } catch { cached=[]; }
  const dict={...(catalog[lang]||{}),...rowsToDict(cached)};
  // Missing entries intentionally fall back to the master English catalog until
  // a human-reviewed TAMPtools translation is added. No automatic paid service.
  for(const key of Object.keys(source)) if(!dict[key]) dict[key]=source[key];
  return dict;
}

export async function translateTexts(texts,target){
  const catalog=await sourceCatalog();
  const source=catalog.en||{};
  const wanted=[...new Set((texts||[]).map(x=>String(x||'').trim()).filter(Boolean))];
  const lang=normalizeLanguage(target);
  const dict=catalog[lang]||{};
  const bySource=new Map(Object.entries(source).map(([key,value])=>[value,key]));
  const result={};
  for(const text of wanted){ const key=bySource.get(text); result[text]=(key&&dict[key])||text; }
  const missing=wanted.filter(text=>result[text]===text && lang!=='en');
  if(missing.length && process.env.TRANSLATION_AI_ENABLED==='1'){
    const prompt=`Translate each source string into ${LANGUAGE_NAMES[lang]||lang}. Return ONLY a JSON object mapping each exact source string to its translation. Preserve placeholders, URLs, numbers, punctuation, and product names. Do not explain.\n${JSON.stringify(Object.fromEntries(missing.map(x=>[x,'' ])))} `;
    try {
      const ai=await generateText({system:'You are a professional software localization engine. Translate faithfully and naturally.',prompt,maxTokens:Math.min(4000,missing.length*80),operation:'translation'});
      const clean=String(ai.text||'').replace(/^```json\s*|\s*```$/g,'').trim(); const parsed=JSON.parse(clean);
      for(const text of missing) if(typeof parsed[text]==='string' && parsed[text].trim()) result[text]=parsed[text].trim();
    } catch (error) {
      console.warn(`[translation] AI fallback failed for ${lang}:`, error?.message || error);
    }
  }
  return result;
}

export function translationStatus(){
  return {provider:process.env.TRANSLATION_AI_ENABLED==='1'?'TAMPtools catalog + configured AI':'TAMPtools curated catalog',externalProvider:process.env.TRANSLATION_AI_ENABLED==='1',externalTranslationCost:0, aiTranslationCostModel:process.env.TRANSLATION_AI_ENABLED==='1'?'configured AI provider':'disabled',mode:process.env.TRANSLATION_AI_ENABLED==='1'?'curated translations plus AI for missing strings':'curated translations with explicit English fallback',supportedLanguages:Object.keys(LANGUAGE_NAMES)};
}
