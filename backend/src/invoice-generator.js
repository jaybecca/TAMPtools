import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';

export const INVOICE_TEMPLATES = ['classic','modern','minimal','bold','executive'];
export const INVOICE_CURRENCIES = ['NGN','USD','GBP','EUR','GHS','KES','ZAR'];

export function invoiceTotals(data){
  const subtotal = data.items.reduce((sum, item) => sum + Number(item.quantity || 0) * Number(item.unitPrice || 0), 0);
  const percentDiscount = subtotal * (Number(data.discountRate || 0) / 100);
  const fixedDiscount = Number(data.discountAmount || 0);
  const discount = Math.min(subtotal, Math.max(0, percentDiscount + fixedDiscount));
  const taxable = Math.max(0, subtotal - discount);
  const tax = taxable * (Number(data.taxRate || 0) / 100);
  return {subtotal, discount, taxable, tax, total: taxable + tax};
}

const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const attr = esc;

function money(value, currency){
  try { return new Intl.NumberFormat('en', {style:'currency', currency, maximumFractionDigits:2}).format(Number(value)||0); }
  catch { return `${currency} ${(Number(value)||0).toFixed(2)}`; }
}

export function renderInvoiceHtml(data, totals){
  const template = INVOICE_TEMPLATES.includes(data.template) ? data.template : 'classic';
  const accentColor = /^#[0-9a-fA-F]{6}$/.test(String(data.accentColor||'')) ? String(data.accentColor) : (template==='bold'?'#c2410c':template==='modern'?'#5b2be0':template==='executive'?'#172554':'#171a2b');
  const rows = data.items.map(item => `<tr><td class="item-name"><strong>${esc(item.description)}</strong>${item.detail ? `<span>${esc(item.detail)}</span>` : ''}</td><td>${Number(item.quantity).toLocaleString('en')}</td><td>${money(item.unitPrice,data.currency)}</td><td>${money(Number(item.quantity)*Number(item.unitPrice),data.currency)}</td></tr>`).join('');
  const logo = data.logoDataUrl ? `<img class="logo" src="${attr(data.logoDataUrl)}" alt="Business logo">` : `<div class="logo-mark">${esc((data.fromName||'T').trim().slice(0,1).toUpperCase())}</div>`;
  const taxLabel = Number(data.taxRate||0) ? `Tax (${Number(data.taxRate).toFixed(2).replace(/\.00$/,'')}%)` : 'Tax';
  const discountLabel = Number(data.discountRate||0) && Number(data.discountAmount||0) ? 'Discount' : Number(data.discountRate||0) ? `Discount (${Number(data.discountRate).toFixed(2).replace(/\.00$/,'')}%)` : 'Discount';
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(data.invoiceNumber || 'Invoice')}</title><style>
@page{size:A4;margin:0}*{box-sizing:border-box}html,body{margin:0;padding:0;background:#eef0f5;color:#171a2b;font-family:Inter,Arial,Helvetica,sans-serif}.sheet{width:210mm;min-height:297mm;margin:0 auto;background:#fff;padding:18mm 16mm 16mm;position:relative;overflow:hidden}.accent{color:${accentColor}}
.top{display:flex;justify-content:space-between;gap:30px;padding-bottom:20px;border-bottom:2px solid ${accentColor}}.brand{display:flex;gap:12px;align-items:center}.logo,.logo-mark{width:52px;height:52px;border-radius:12px;object-fit:contain}.logo-mark{display:flex;align-items:center;justify-content:center;background:${accentColor}18;font-weight:900;font-size:20px}.business{font-size:19px;font-weight:800}.business-meta,.bill-meta,.muted{color:#697287;font-size:10px;line-height:1.6}.invoice-heading{text-align:right}.invoice-heading .word{font-size:28px;font-weight:900;letter-spacing:.08em}.invoice-heading .number{font-size:13px;font-weight:800;margin-top:4px}.meta-grid{display:grid;grid-template-columns:1fr 1fr 1fr;gap:22px;padding:24px 0}.meta-label{font-size:9px;font-weight:800;letter-spacing:.12em;color:#7c8497;text-transform:uppercase;margin-bottom:5px}.meta-value{font-size:12px;line-height:1.55}.items{width:100%;border-collapse:collapse;margin-top:6px}.items th{font-size:9px;text-transform:uppercase;letter-spacing:.08em;color:#7c8497;background:${template==='minimal'?'#fff':'#f7f7fa'};padding:10px 8px;text-align:left;border-bottom:1px solid #dfe3eb}.items th:nth-child(n+2),.items td:nth-child(n+2){text-align:right}.items td{font-size:11px;padding:12px 8px;border-bottom:1px solid #e8ebf0;vertical-align:top}.item-name strong{display:block}.item-name span{display:block;color:#7a8396;font-size:9px;margin-top:3px}.bottom{display:flex;justify-content:space-between;gap:28px;margin-top:25px}.notes{flex:1;max-width:55%;font-size:10px;line-height:1.6;color:#697287}.notes h4{font-size:9px;text-transform:uppercase;letter-spacing:.1em;color:#7c8497;margin:0 0 6px}.totals{width:260px}.totals-row{display:flex;justify-content:space-between;gap:16px;padding:6px 0;font-size:11px}.grand{display:flex;justify-content:space-between;padding:11px 0 0;border-top:2px solid #171a2b;margin-top:5px;font-size:16px;font-weight:900}.payment{margin-top:25px;padding:13px 15px;background:${template==='minimal'?'#fafafa':'#f6f7fb'};border-radius:10px;font-size:10px;line-height:1.6}.footer{position:absolute;left:16mm;right:16mm;bottom:10mm;border-top:1px solid #e4e7ed;padding-top:8px;font-size:8px;color:#8a92a2;display:flex;justify-content:space-between}.template-bold .sheet,.template-modern .sheet,.template-executive .sheet{border-top:5px solid ${accentColor}}.template-minimal .items th{background:#fff}.template-minimal .sheet{padding-top:20mm}
@media screen{body{padding:24px}.sheet{box-shadow:0 18px 60px rgba(26,31,52,.12)}}
</style></head><body><article class="sheet template-${template}">
<section class="top"><div class="brand">${logo}<div><div class="business accent">${esc(data.fromName)}</div><div class="business-meta">${[data.fromEmail,data.fromPhone,data.fromAddress].filter(Boolean).map(esc).join(' · ')}</div></div></div><div class="invoice-heading"><div class="word accent">INVOICE</div><div class="number">${esc(data.invoiceNumber || 'DRAFT')}</div></div></section>
<section class="meta-grid"><div><div class="meta-label">Bill to</div><div class="meta-value"><strong>${esc(data.clientName)}</strong><br>${[data.clientEmail,data.clientPhone,data.clientAddress].filter(Boolean).map(esc).join('<br>')}</div></div><div><div class="meta-label">Invoice date</div><div class="meta-value">${esc(data.issueDate || '—')}</div><div class="meta-label" style="margin-top:10px">Due date</div><div class="meta-value">${esc(data.dueDate || 'Due on receipt')}</div></div><div><div class="meta-label">Currency</div><div class="meta-value"><strong>${esc(data.currency)}</strong></div>${data.reference ? `<div class="meta-label" style="margin-top:10px">Reference</div><div class="meta-value">${esc(data.reference)}</div>`:''}</div></section>
<table class="items"><thead><tr><th>Description</th><th>Qty</th><th>Unit price</th><th>Amount</th></tr></thead><tbody>${rows}</tbody></table>
<section class="bottom"><div class="notes">${data.notes ? `<h4>Notes</h4><div>${esc(data.notes).replace(/\n/g,'<br>')}</div>` : ''}</div><div class="totals"><div class="totals-row"><span>Subtotal</span><strong>${money(totals.subtotal,data.currency)}</strong></div>${totals.discount>0?`<div class="totals-row"><span>${esc(discountLabel)}</span><strong>−${money(totals.discount,data.currency)}</strong></div>`:''}${totals.tax>0?`<div class="totals-row"><span>${esc(taxLabel)}</span><strong>${money(totals.tax,data.currency)}</strong></div>`:''}<div class="grand accent"><span>Total</span><span>${money(totals.total,data.currency)}</span></div></div></section>
${data.paymentTerms || data.paymentLink || data.bankDetails ? `<section class="payment"><strong>Payment information</strong><br>${data.paymentTerms ? `${esc(data.paymentTerms)}<br>`:''}${data.bankDetails ? `${esc(data.bankDetails).replace(/\n/g,'<br>')}<br>`:''}${data.paymentLink ? `Pay online: ${esc(data.paymentLink)}`:''}</section>`:''}
<div class="footer"><span>${esc(data.fromName)} · ${esc(data.invoiceNumber || 'Invoice')}</span><span>${esc(data.footerNote || 'Thank you for your business.')}</span></div>
</article></body></html>`;
}

export function renderInvoicePdf(html, outputPath){
  const tmp = path.join(os.tmpdir(), `tamptools-invoice-${crypto.randomUUID()}.html`);
  fs.writeFileSync(tmp, html, 'utf8');
  try {
    const chromium = process.env.CHROMIUM_BIN || 'chromium';
    execFileSync(process.env.WEASYPRINT_BIN || 'weasyprint', [tmp,outputPath], {stdio:'ignore', timeout:30000});
    if(fs.existsSync(outputPath) && fs.statSync(outputPath).size>1000) return {renderer:'weasyprint'};
  } catch {}
  try {
    execFileSync(chromium, ['--headless','--no-sandbox','--disable-gpu','--disable-dev-shm-usage',`--print-to-pdf=${outputPath}`,`file://${tmp}`], {stdio:'ignore', timeout:15000});
    if(fs.existsSync(outputPath) && fs.statSync(outputPath).size>1000) return {renderer:'chromium'};
  } catch {}
  throw new Error('PDF rendering is unavailable on this server. Install Chromium or WeasyPrint, or configure CHROMIUM_BIN/WEASYPRINT_BIN.');
}
