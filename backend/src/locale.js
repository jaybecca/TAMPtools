import crypto from 'node:crypto';

const COUNTRY_MAP = {
  NG:'NGN', GH:'GHS', KE:'KES', ZA:'ZAR', EG:'EGP', MA:'MAD', TZ:'TZS', UG:'UGX', RW:'RWF',
  US:'USD', CA:'CAD', GB:'GBP', IE:'EUR', FR:'EUR', DE:'EUR', ES:'EUR', IT:'EUR', PT:'EUR', NL:'EUR', BE:'EUR', AT:'EUR',
  CH:'CHF', NO:'NOK', SE:'SEK', DK:'DKK', FI:'EUR', PL:'PLN', CZ:'CZK', HU:'HUF', RO:'RON',
  AE:'AED', SA:'SAR', QA:'QAR', IL:'ILS', IN:'INR', PK:'PKR', BD:'BDT', SG:'SGD', MY:'MYR', ID:'IDR', TH:'THB', VN:'VND',
  JP:'JPY', CN:'CNY', KR:'KRW', AU:'AUD', NZ:'NZD', BR:'BRL', MX:'MXN', AR:'ARS', CL:'CLP', CO:'COP'
};

export const CURRENCY_INFO = {
  USD:{symbol:'$',name:'US Dollar',locale:'en-US',digits:2}, GBP:{symbol:'£',name:'British Pound',locale:'en-GB',digits:2}, EUR:{symbol:'€',name:'Euro',locale:'en-IE',digits:2},
  NGN:{symbol:'₦',name:'Nigerian Naira',locale:'en-NG',digits:0}, GHS:{symbol:'GH₵',name:'Ghanaian Cedi',locale:'en-GH',digits:2}, KES:{symbol:'KSh',name:'Kenyan Shilling',locale:'en-KE',digits:0}, ZAR:{symbol:'R',name:'South African Rand',locale:'en-ZA',digits:2},
  EGP:{symbol:'E£',name:'Egyptian Pound',locale:'en-EG',digits:2}, MAD:{symbol:'د.م.',name:'Moroccan Dirham',locale:'fr-MA',digits:2}, TZS:{symbol:'TSh',name:'Tanzanian Shilling',locale:'sw-TZ',digits:0}, UGX:{symbol:'USh',name:'Ugandan Shilling',locale:'en-UG',digits:0}, RWF:{symbol:'RF',name:'Rwandan Franc',locale:'rw-RW',digits:0},
  CAD:{symbol:'CA$',name:'Canadian Dollar',locale:'en-CA',digits:2}, AUD:{symbol:'A$',name:'Australian Dollar',locale:'en-AU',digits:2}, NZD:{symbol:'NZ$',name:'New Zealand Dollar',locale:'en-NZ',digits:2}, CHF:{symbol:'CHF',name:'Swiss Franc',locale:'de-CH',digits:2}, NOK:{symbol:'kr',name:'Norwegian Krone',locale:'nb-NO',digits:2}, SEK:{symbol:'kr',name:'Swedish Krona',locale:'sv-SE',digits:2}, DKK:{symbol:'kr',name:'Danish Krone',locale:'da-DK',digits:2}, PLN:{symbol:'zł',name:'Polish Zloty',locale:'pl-PL',digits:2}, CZK:{symbol:'Kč',name:'Czech Koruna',locale:'cs-CZ',digits:2}, HUF:{symbol:'Ft',name:'Hungarian Forint',locale:'hu-HU',digits:0}, RON:{symbol:'lei',name:'Romanian Leu',locale:'ro-RO',digits:2},
  AED:{symbol:'د.إ',name:'UAE Dirham',locale:'ar-AE',digits:2}, SAR:{symbol:'﷼',name:'Saudi Riyal',locale:'ar-SA',digits:2}, QAR:{symbol:'﷼',name:'Qatari Riyal',locale:'ar-QA',digits:2}, ILS:{symbol:'₪',name:'Israeli New Shekel',locale:'he-IL',digits:2},
  INR:{symbol:'₹',name:'Indian Rupee',locale:'en-IN',digits:0}, PKR:{symbol:'₨',name:'Pakistani Rupee',locale:'en-PK',digits:0}, BDT:{symbol:'৳',name:'Bangladeshi Taka',locale:'en-BD',digits:0}, SGD:{symbol:'S$',name:'Singapore Dollar',locale:'en-SG',digits:2}, MYR:{symbol:'RM',name:'Malaysian Ringgit',locale:'ms-MY',digits:2}, IDR:{symbol:'Rp',name:'Indonesian Rupiah',locale:'id-ID',digits:0}, THB:{symbol:'฿',name:'Thai Baht',locale:'th-TH',digits:0}, VND:{symbol:'₫',name:'Vietnamese Dong',locale:'vi-VN',digits:0}, JPY:{symbol:'¥',name:'Japanese Yen',locale:'ja-JP',digits:0}, CNY:{symbol:'¥',name:'Chinese Yuan',locale:'zh-CN',digits:2}, KRW:{symbol:'₩',name:'South Korean Won',locale:'ko-KR',digits:0},
  BRL:{symbol:'R$',name:'Brazilian Real',locale:'pt-BR',digits:2}, MXN:{symbol:'MX$',name:'Mexican Peso',locale:'es-MX',digits:2}, ARS:{symbol:'AR$',name:'Argentine Peso',locale:'es-AR',digits:2}, CLP:{symbol:'CLP$',name:'Chilean Peso',locale:'es-CL',digits:0}, COP:{symbol:'COL$',name:'Colombian Peso',locale:'es-CO',digits:0}
};

export const LANGUAGE_BY_COUNTRY = {
  NG:'pcm', GH:'en', KE:'en', ZA:'en', TZ:'sw', UG:'en', RW:'rw', US:'en', CA:'en', GB:'en', IE:'en', AU:'en', NZ:'en',
  FR:'fr', DE:'de', ES:'es', IT:'it', PT:'pt', NL:'nl', BE:'fr', AT:'de', CH:'de', NO:'no', SE:'sv', DK:'da', FI:'fi', PL:'pl', CZ:'cs', HU:'hu', RO:'ro',
  AE:'ar', EG:'ar_eg', SA:'ar', QA:'ar', IL:'he', IN:'hi', PK:'ur', BD:'bn', SG:'en', MY:'ms', ID:'id', TH:'th', VN:'vi', JP:'ja', CN:'zh', KR:'ko', BR:'pt', MX:'es', AR:'es', CL:'es', CO:'es'
};

// Conservative fallback rates from USD. Production should refresh these from a trusted FX provider.
export const FALLBACK_RATES = {USD:1,GBP:0.78,EUR:0.92,NGN:1500,GHS:10.8,KES:129,ZAR:17.8,EGP:48,MAD:9.9,TZS:2550,UGX:3500,RWF:1450,CAD:1.38,AUD:1.53,NZD:1.67,CHF:0.79,NOK:10.4,SEK:10.6,DKK:6.85,PLN:3.95,CZK:23.0,HUF:350,RON:4.58,AED:3.6725,SAR:3.75,QAR:3.64,ILS:3.25,INR:88,PKR:280,BDT:122,SGD:1.29,MYR:4.2,IDR:16500,THB:32,VND:25000,JPY:148,CNY:7.15,KRW:1380,BRL:5.45,MXN:19.2,ARS:1350,CLP:950,COP:4100};

const langAliases = {mr:'mr',vi:'vi',te:'te',ha:'ha',zu:'zu',tr:'tr',en:'en',en_us:'en',en_gb:'en_gb',fr:'fr',de:'de',es:'es',pt:'pt',ru:'ru',id:'id',ur:'ur',ja:'ja',pcm:'pcm',pdt:'pcm',ng:'pcm',ar:'ar',ar_eg:'ar_eg',zh:'zh',hi:'hi',it:'it',nl:'nl',tr:'tr',pl:'pl',bn:'bn',sw:'sw',he:'he'};

export function getClientIp(req){
  const forwarded = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim();
  return forwarded || String(req.headers['cf-connecting-ip'] || req.headers['x-real-ip'] || req.socket?.remoteAddress || '').replace(/^::ffff:/,'');
}

export function countryFromHeaders(req){
  return String(req.headers['cf-ipcountry'] || req.headers['x-vercel-ip-country'] || req.headers['x-country-code'] || '').trim().toUpperCase();
}

export function languageFromAcceptLanguage(header=''){
  const first = String(header).split(',')[0]?.trim().toLowerCase().replace('-','_');
  return langAliases[first] || langAliases[first?.split('_')[0]] || 'en';
}

const geoCache = new Map();
const CACHE_MS = 60 * 60 * 1000;

export async function resolveLocale(req){
  const ip = getClientIp(req);
  let country = countryFromHeaders(req);
  let source = country ? 'edge-header' : 'fallback';
  let city = '';
  let region = '';
  if(!country && ip && !['127.0.0.1','::1','localhost'].includes(ip)){
    const cached = geoCache.get(ip);
    if(cached && cached.expires > Date.now()) ({country,city,region}=cached.data);
    else {
      try {
        const controller = new AbortController();
        const timer = setTimeout(()=>controller.abort(),1800);
        const r = await fetch(`https://ipapi.co/${encodeURIComponent(ip)}/json/`,{signal:controller.signal,headers:{Accept:'application/json'}});
        clearTimeout(timer);
        if(r.ok){const d=await r.json();country=String(d.country_code||'').toUpperCase();city=String(d.city||'');region=String(d.region||'');source='ipapi.co';geoCache.set(ip,{expires:Date.now()+CACHE_MS,data:{country,city,region}});}
      } catch {}
    }
  }
  country = country || 'US';
  const currency = COUNTRY_MAP[country] || 'USD';
  const language = LANGUAGE_BY_COUNTRY[country] || languageFromAcceptLanguage(req.headers['accept-language']);
  return {country, currency, language, city, region, source};
}

export const PAYMENT_MINOR_UNITS = { JPY:0, KRW:0, VND:0, IDR:0, HUF:0, CLP:0, COP:0 };
export function toMinorUnits(amount, currency){ return Math.round(Number(amount || 0) * (10 ** (PAYMENT_MINOR_UNITS[currency] ?? 2))); }

export function pricingAmount(plan,currency){
  if(!plan) return 0;
  const key = currency.toLowerCase();
  const explicit = plan.prices_json ? JSON.parse(plan.prices_json || '{}') : (plan.prices || {});
  if(explicit && explicit[currency.toUpperCase()] !== undefined) return Number(explicit[currency.toUpperCase()]);
  if(['usd','gbp','ngn'].includes(key) && plan[key] !== undefined) return Number(plan[key]);
  const usd = Number(plan.usd || 0);
  return Math.round(usd * Number(FALLBACK_RATES[currency] || 1) * 100) / 100;
}

export function localeCacheKey(req){return crypto.createHash('sha1').update(getClientIp(req)).digest('hex').slice(0,16)}

export function pricingAmountForCycle(plan, currency, cycle = 'monthly'){
  if(!plan) return 0;
  const key=String(currency||'USD').toUpperCase();
  let explicit={};
  try{ explicit=plan.prices_json ? JSON.parse(plan.prices_json||'{}') : (plan.prices||{}); }catch{}
  const value=explicit?.[key];
  if(value && typeof value==='object'){
    const chosen=value[String(cycle).toLowerCase()];
    if(chosen!==undefined) return Number(chosen);
    if(value.monthly!==undefined) return Number(value.monthly);
  }
  const monthly=pricingAmount(plan,key);
  if(String(cycle).toLowerCase()==='yearly') return Math.round(monthly*12*0.80*100)/100;
  return monthly;
}
