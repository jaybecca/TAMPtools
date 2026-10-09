function text(v){return String(v ?? '');}
function normSpace(v){return text(v).replace(/[\u00a0\u200b\u200c\u200d\ufeff\u0000-\u001f]/g,' ').replace(/\s+/g,' ').trim();}
function slug(v){return normSpace(v).toLowerCase();}
function titleCase(v){return normSpace(v).toLowerCase().replace(/\b([a-z\u00c0-\u024f])/g,m=>m.toUpperCase());}
function normalizePhone(v){let s=text(v).trim().replace(/[^\d+]/g,''); if(/^00/.test(s))s='+'+s.slice(2); if(/^0\d{10}$/.test(s))s='+234'+s.slice(1); return s;}
function validEmail(v){return /^\S+@\S+\.\S+$/.test(text(v).trim());}
function dateIso(v){const s=normSpace(v); if(!s)return s; const d=new Date(s); if(Number.isNaN(d.getTime()))return s; return d.toISOString().slice(0,10);}
function normalizeNumber(v){const s=normSpace(v); if(!s)return s; const n=s.replace(/[₦$€£¥₹₽]|\b(?:NGN|USD|EUR|GBP|JPY|INR)\b/gi,'').replace(/\s/g,'').replace(/,(?=\d{3}(?:\D|$))/g,''); if(!/^[-+]?\d+(?:\.\d+)?$/.test(n))return s; return n;}
function isError(v){return /^#(?:REF!|DIV\/0!|VALUE!|N\/A|NAME\?|NUM!|NULL!|SPILL!|CALC!)/i.test(normSpace(v));}
function headerKind(h){const x=slug(h); return {name:/^(first\s*name|last\s*name|full\s*name|name|customer|client|contact|company|business)/.test(x)||/name|customer|client/.test(x),phone:/phone|mobile|telephone|tel/.test(x),email:/e[- ]?mail/.test(x),country:/country|nation/.test(x),date:/date|dob|birth/.test(x),number:/amount|price|cost|total|qty|quantity|number|count|balance|salary|revenue|rate|percent|percentage/.test(x)};}
function similarity(a,b){a=slug(a);b=slug(b);if(!a||!b)return 0;if(a===b)return 1;const aa=[...a],bb=[...b],m=aa.length,n=bb.length;if(Math.max(m,n)>80)return 0;let prev=Array(n+1).fill(0).map((_,i)=>i);for(let i=1;i<=m;i++){const cur=[i];for(let j=1;j<=n;j++)cur[j]=Math.min(cur[j-1]+1,prev[j]+1,prev[j-1]+(aa[i-1]===bb[j-1]?0:1));prev=cur;}return 1-(prev[n]/Math.max(m,n));}
function canonicalCell(v,h){const k=headerKind(h);let x=normSpace(v);if(k.email)x=x.toLowerCase();if(k.phone)x=normalizePhone(x);if(k.name)x=slug(x);return x;}
function rowKey(values,headers){return values.map((v,i)=>canonicalCell(v,headers[i])).join('\u0001');}
function keyColumns(headers){const preferred=[];headers.forEach((h,i)=>{const k=headerKind(h);if(k.email||k.phone)preferred.push(i);});if(preferred.length)return preferred.slice(0,3);headers.forEach((h,i)=>{if(headerKind(h).name)preferred.push(i);});return preferred.slice(0,3);}

export function inspectSpreadsheet(rows,{smart=false}={}){
  if(!rows.length)return {headers:[],data:[],rowCount:0,stats:{}};
  const width=Math.max(...rows.map(r=>r.length),0); const headers=Array.from({length:width},(_,i)=>text(rows[0]?.[i]));
  const data=rows.slice(1).map(r=>Array.from({length:width},(_,i)=>text(r?.[i])));
  const stats={rows:data.length,columns:width,emptyRows:0,blankCells:0,duplicates:0,nearDuplicates:0,whitespaceCells:0,invisibleChars:0,invalidEmails:0,invalidDates:0,invalidNumbers:0,errorCells:0,normalizableDates:0,normalizableNumbers:0};
  const seen=new Map(); const keys=keyColumns(headers);
  data.forEach((r,ri)=>{
    const empty=r.every(v=>normSpace(v)===''); if(empty)stats.emptyRows++;
    r.forEach((v,ci)=>{const raw=text(v);const clean=normSpace(raw);if(!clean)stats.blankCells++;if(raw!==clean)stats.whitespaceCells++;if(/[\u00a0\u200b\u200c\u200d\ufeff\u0000-\u001f]/.test(raw))stats.invisibleChars++;if(isError(raw))stats.errorCells++;const k=headerKind(headers[ci]);if(k.email&&clean&&!validEmail(clean))stats.invalidEmails++;if(k.date&&clean){const d=new Date(clean);if(Number.isNaN(d.getTime()))stats.invalidDates++;else if(clean!==dateIso(clean))stats.normalizableDates++;}if(k.number&&clean&&normalizeNumber(clean)!==clean)stats.normalizableNumbers++;});
    const exact=rowKey(r,headers); if(exact){if(seen.has(exact))stats.duplicates++;else seen.set(exact,ri);}
  });
  if(smart&&keys.length&&data.length<=5000){const candidates=[];data.forEach((r,i)=>{const k=keys.map(c=>normSpace(r[c])).filter(Boolean).join('|');if(k)candidates.push([i,k]);});for(let i=0;i<candidates.length;i++)for(let j=i+1;j<candidates.length;j++){const [ri,a]=candidates[i],[rj,b]=candidates[j];if(a===b)continue;const score=similarity(a,b);if(score>=0.88){stats.nearDuplicates++;if(stats.nearDuplicates>=500)break;} } }
  return {headers,data,rowCount:data.length,stats};
}

export function cleanSpreadsheet(rows,opts={}){
  if(!rows.length)return {rows:[],headers:[],changes:[],removedRows:[],stats:{}};
  const width=Math.max(...rows.map(r=>r.length),0); const headers=Array.from({length:width},(_,i)=>text(rows[0]?.[i]));
  let data=rows.slice(1).map((r,ri)=>({sourceRow:ri+2,values:Array.from({length:width},(_,i)=>text(r?.[i]))}));
  const changes=[]; const removedRows=[];
  const pushChange=(sourceRow,column,before,after,reason)=>{if(text(before)!==text(after))changes.push({sourceRow,column,before:text(before),after:text(after),reason});};
  if(opts.removeEmptyRows){data=data.filter(item=>{if(item.values.every(v=>normSpace(v)==='')){removedRows.push({sourceRow:item.sourceRow,reason:'Empty row'});return false;}return true;});}
  if(opts.removeDuplicates){const seen=new Map();data=data.filter(item=>{const key=rowKey(item.values,headers);if(!key)return true;if(seen.has(key)){removedRows.push({sourceRow:item.sourceRow,reason:'Exact duplicate',duplicateOf:seen.get(key)});return false;}seen.set(key,item.sourceRow);return true;});}
  if(opts.smartDedupe){const keys=keyColumns(headers);const kept=[];for(const item of data){const k=keys.map(c=>normSpace(item.values[c])).filter(Boolean).join('|');let match=null;if(k){for(const prev of kept){const pk=keys.map(c=>normSpace(prev.values[c])).filter(Boolean).join('|');if(pk&&pk!==k&&similarity(pk,k)>=0.92){match=prev;break;}}}if(match){removedRows.push({sourceRow:item.sourceRow,reason:'Smart near-duplicate',duplicateOf:match.sourceRow});}else kept.push(item);}data=kept;}
  const preset=opts.preset||'standard';
  data.forEach(item=>item.values.forEach((v,i)=>{
    const h=headers[i]; const kind=headerKind(h); let next=v;
    if(opts.whitespace!==false){next=normSpace(next);pushChange(item.sourceRow,h,v,next,'Whitespace / invisible characters');}
    if(preset!=='conservative' || opts.normalizeEmail){if(kind.email&&next) {const n=next.toLowerCase();pushChange(item.sourceRow,h,next,n,'Email normalization');next=n;}}
    if(preset==='standard'||preset==='aggressive'||opts.names){if(kind.name&&next){const n=titleCase(next);pushChange(item.sourceRow,h,next,n,'Name normalization');next=n;}}
    if(preset==='standard'||preset==='aggressive'||opts.phones){if(kind.phone&&next){const n=normalizePhone(next);pushChange(item.sourceRow,h,next,n,'Phone normalization');next=n;}}
    if(preset==='standard'||preset==='aggressive'||opts.countries){if(kind.country&&next){const n=titleCase(next);pushChange(item.sourceRow,h,next,n,'Country normalization');next=n;}}
    if(preset==='standard'||preset==='aggressive'||opts.dates){if(kind.date&&next){const n=dateIso(next);if(n!==next&&n)pushChange(item.sourceRow,h,next,n,'Date normalization');next=n;}}
    if(preset==='aggressive'||opts.numbers){if(kind.number&&next){const n=normalizeNumber(next);if(n!==next)pushChange(item.sourceRow,h,next,n,'Number normalization');next=n;}}
    item.values[i]=next;
  }));
  const analysis=inspectSpreadsheet([headers,...data.map(x=>x.values)],{smart:false});
  return {rows:[headers,...data.map(x=>x.values)],headers,changes,removedRows,stats:{...analysis.stats,changedCells:changes.length,removedRows:removedRows.length}};
}

export function auditRows(rows,opts={}){return cleanSpreadsheet(rows,{...opts,removeDuplicates:false,removeEmptyRows:false,smartDedupe:false});}
