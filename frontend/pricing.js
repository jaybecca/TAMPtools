(()=>{
  const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
  const money=(v,c)=>new Intl.NumberFormat(undefined,{style:'currency',currency:c,maximumFractionDigits:['JPY','KRW','VND','IDR','HUF','CLP','COP','NGN'].includes(c)?0:2}).format(Number(v||0));
  const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  let plans=[], currency=localStorage.getItem('tamptools-currency')||'NGN', index=0;
  const benefits={
    Free:['All 15 primary tools','Image processing: 10/mo','Background removal: 5/mo','PDF jobs: 10/mo','Batch jobs: 5/mo · 10 files/job','AI generations: 20/mo','Resume projects: 2','Proposals: 2/mo','Invoices: 5/mo','500 MB storage','Basic Mail Manager','Basic Storage Manager','Export included'],
    Lite:['Everything in Free','5 GB storage','Image processing: 100/mo','Background removal: 50/mo','PDF jobs: 100/mo','Batch jobs: 30/mo · 50 files/job','AI generations: 150/mo','Mail: 2,000/mo','Resume projects: 10','Proposals: 20/mo','Invoices: 50/mo'],
    Pro:['Everything in Lite','50 GB storage','Image processing: 1,000/mo','Background removal: 500/mo','PDF jobs: 1,000/mo','Batch jobs: 200/mo · 500 files/job','AI generations: 1,000/mo','Mail: 20,000/mo','Advanced Mail Manager','Protected archives','Advanced document processing','Workflow automation','Priority support'],
    Business:['Everything in Pro','Starting at 25 team members','Shared workspace & storage','Team projects & permissions','Central billing','Usage analytics','Shared templates & documents','Business workflows','Audit/activity logs','API access when available','Higher-volume processing','Advanced AI controls','Priority support']
  };
  const render=()=>{
    if(!plans.length)return;
    index=Math.max(0,Math.min(index,plans.length-1));
    const p=plans[index]||plans[0], prices=p.prices||{};
    const amount=prices[currency]?.monthly ?? (p.localizedPrices||{})[currency] ?? p[currency.toLowerCase()] ?? 0;
    const monthly=amount;
    $('#selectedPlan').textContent=p.name;
    $('#selectedPrice').textContent=money(amount,currency);
    $('#selectedPeriod').textContent=amount===0?'':'/ month';
    $('#selectedSub').textContent=amount===0?'Useful forever.':'Flexible monthly billing';
    $('#planSlider').value=index;
    $('#planPosition').textContent=`${index+1} of ${plans.length}`;
    $('#meterFill').style.width=`${(index/(Math.max(1,plans.length-1)))*100}%`;
    $('#meterKnob').style.left=`${(index/(Math.max(1,plans.length-1)))*100}%`;
    $('#selectedSavings').textContent='No recurring AI credit charge';
    $('#selectedBenefits').innerHTML=(benefits[p.name]||[]).map(x=>`<li>${esc(x)}</li>`).join('');
    $('#planCta').textContent=p.name==='Free'?'Create free account':`Choose ${p.name}`;
    $('#planCta').onclick=()=>{location.href=p.name==='Free'?'/signup.html':`/signup.html?plan=${encodeURIComponent(p.name)}`};
    $$('.plan-step').forEach((b,i)=>b.classList.toggle('active',i===index));
    const grid=$('#plansGrid');
    grid.innerHTML=plans.map((x,i)=>{
      const m=x.prices?.[currency]?.monthly ?? x.localizedPrices?.[currency] ?? x[currency.toLowerCase()] ?? 0;
      return `<article class="standalone-plan-card ${i===index?'active':''}"><div class="plan-card-top"><span class="eyebrow">${i===2?'MOST POPULAR':esc(x.name)}</span><button class="plan-select" data-plan-index="${i}" type="button">View plan</button></div><h3>${esc(x.name)}</h3><div class="plan-card-price">${money(m,currency)} <small>${m===0?'':'/ month'}</small></div><p>${i===0?'A genuinely useful starting point.':i===1?'More capacity for consistent individual work.':i===2?'For professionals, power users and automation.':'For teams running shared digital operations.'}</p><ul>${(benefits[x.name]||[]).slice(0,7).map(b=>`<li>${esc(b)}</li>`).join('')}</ul></article>`;
    }).join('');
    $$('.plan-select').forEach(b=>b.onclick=()=>{index=Number(b.dataset.planIndex);render();window.scrollTo({top:$('.pricing-meter').offsetTop-90,behavior:'smooth'})});
  };
  // AI credits are priced at ₦3 each. The currency selector converts this base price.
  const CREDIT_RATE_NGN=3;
  const USD_TO_CURRENCY={USD:1,GBP:0.78,EUR:0.92,NGN:1500,GHS:10.8,KES:129,ZAR:17.8,EGP:48,MAD:9.9,TZS:2550,UGX:3500,RWF:1450,CAD:1.38,AUD:1.53,NZD:1.67,CHF:0.79,NOK:10.4,SEK:10.6,DKK:6.85,PLN:3.95,CZK:23,HUF:350,RON:4.58,AED:3.6725,SAR:3.75,QAR:3.64,ILS:3.25,INR:88,PKR:280,BDT:122,SGD:1.29,MYR:4.2,IDR:16500,THB:32,VND:25000,JPY:148,CNY:7.15,KRW:1380,BRL:5.45,MXN:19.2,ARS:1350,CLP:950,COP:4100};
  const MIN_CREDITS=1, MAX_CREDITS=100000;
  const creditPrice=(credits,currency)=>{const usd=Number(credits||0)*CREDIT_RATE_NGN/1500;return usd*Number(USD_TO_CURRENCY[currency]||1)};
  const creditUsd=(credits)=>Number(credits||0)*CREDIT_RATE_NGN/1500;
  const creditCopy=['Choose a small amount for occasional AI work.','Add more capacity whenever you need it.','Ideal for heavier AI-assisted workflows.'];
  function renderCredits(){
    const input=$('#creditAmountInput'), slider=$('#creditSlider');
    let amount=Math.max(MIN_CREDITS,Math.min(MAX_CREDITS,Number(input?.value||100)||100));
    if(input) input.value=amount;
    if(slider) slider.value=Math.min(5000,amount);
    const pct=(Math.min(5000,amount)-1)/(4999)*100;
    $('#creditAmount').textContent=`${amount.toLocaleString()} Credits`;
    $('#creditPrice').textContent=money(creditPrice(amount,currency),currency);
    $('#creditDescription').textContent=creditCopy[amount<500?0:amount<2500?1:2];
    $('#creditMeterFill').style.width=`${pct}%`; $('#creditMeterKnob').style.left=`${pct}%`;
    $('#creditBenefits').innerHTML=[`${amount.toLocaleString()} TAMP AI Credits`,`${money(creditPrice(amount,currency),currency)} one-time payment`,`${money(creditUsd(amount),'USD')} USD equivalent`,'Use alongside any plan','AI generation, analysis and intensive workflows'].map(x=>`<li>${esc(x)}</li>`).join('');
    $('#creditCta').onclick=()=>location.href=`/signup.html?credits=${amount}`;
  }
  async function load(){
    try{
      const d=await fetch('/api/plans',{cache:'no-store'}).then(r=>r.json());
      plans=(d.plans||[]).filter(p=>['Free','Lite','Pro','Business'].includes(p.name)).sort((a,b)=>a.sortOrder-b.sortOrder);
      render();
    }catch{}
  }
  document.addEventListener('DOMContentLoaded',()=>{
    $('#planSlider')?.addEventListener('input',e=>{index=Number(e.target.value);render()});
    $('#creditSlider')?.addEventListener('input',e=>{ $('#creditAmountInput').value=e.target.value; renderCredits(); });
    $('#creditAmountInput')?.addEventListener('input',renderCredits);
    renderCredits();
    $$('.plan-step').forEach(b=>b.addEventListener('click',()=>{index=Number(b.dataset.planIndex);render()}));
    document.addEventListener('tamptools:currency',e=>{currency=e.detail.currency;render();renderCredits()});
    load();
  });
})();
