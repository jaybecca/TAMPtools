/* TAMPtools Phase 42 — first-party translation pack via the backend translation API. */
(()=>{
const FIRST_PARTY_TRANSLATION_LANGUAGES=["en","en_gb","zh","es","hi","fr","ar","bn","pt","ru","id","ur","de","ja","pcm","ar_eg","mr","vi","te","ha","zu","tr"];
async function run(){
  if(!document.body.classList.contains('home-page')&&location.pathname!=='/index.html'&&location.pathname!=='/')return;
  const lang=localStorage.getItem('tamptools-language')||'en';
  try{
    const d=await fetch('/api/i18n?lang='+encodeURIComponent(lang),{cache:'no-store'}).then(r=>r.ok?r.json():Promise.reject());
    const pack=d.translations||{}; const packLower=Object.fromEntries(Object.entries(pack).map(([k,v])=>[k.toLowerCase(),v]));
    const walker=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT); const nodes=[];
    while(walker.nextNode())nodes.push(walker.currentNode);
    for(const n of nodes){const raw=n.nodeValue,key=raw.replace(/\s+/g,' ').trim();if(!key||n.parentElement?.closest('script,style'))continue;const val=pack[key]||packLower[key.toLowerCase()];if(val&&raw.trim()===key)n.nodeValue=raw.replace(key,val)}
    document.documentElement.lang=lang; document.documentElement.dir=['ar','ar_eg','ur'].includes(lang)?'rtl':'ltr';
  }catch(error){
    console.warn("[TAMPtools i18n] translation request failed",error);
    document.documentElement.lang=lang;
    document.documentElement.dir=["ar","ar_eg","ur"].includes(lang)?"rtl":"ltr";
  }
}
document.addEventListener('DOMContentLoaded',run);document.addEventListener('tamptools:locale',run);window.TAMPHomeI18n={run};
})();
