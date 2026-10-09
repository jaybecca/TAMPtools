import { generateText } from "./ai-provider.js";

export function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

export async function generateProposalNarrative(d) {
  const itemList = d.items.map(i => `- ${i.name}${i.description ? `: ${i.description}` : ""}`).join("\n");
  const prompt = `Client: ${d.clientName}${d.clientContact ? ` (contact: ${d.clientContact})` : ""}
Sender: ${d.fromName}${d.tagline ? ` — ${d.tagline}` : ""}
Client's actual problem: ${d.problem}
Proposed deliverables:
${itemList}
${d.differentiator ? `Why the sender is the right fit: ${d.differentiator}` : ""}
${d.timeline ? `Timeline: ${d.timeline}` : ""}

Respond ONLY with valid JSON, no markdown fences, no commentary, in exactly this shape:
{"summary":"2-3 sentence executive summary opening with the client's actual problem","understanding":"a short paragraph showing deep understanding of the specific problem, referencing details they gave","whyUs":"a short paragraph on why the sender is the right fit, naturally weaving in their differentiator if given, or omit generic claims if none given","closing":"a confident, specific closing paragraph with a call to action"}`;

  const result = await generateText({
    system: 'You are TAMPtools Proposal Studio. Write specific, non-generic business proposal copy tied directly to what the person provided. Never invent claims, statistics, or past results that were not given. Ban generic filler phrases like "we are excited", "cutting-edge solutions", "take your business to the next level". Always respond with strict JSON only.',
    prompt,
    maxTokens: 1200
  });

  try {
    const cleaned = result.text.trim().replace(/^```json\s*/i, "").replace(/```$/, "");
    const parsed = JSON.parse(cleaned);
    return { ...parsed, provider: result.provider };
  } catch {
    // Model didn't return clean JSON — degrade gracefully rather than fail the whole request.
    return { summary: result.text, understanding: "", whyUs: "", closing: "", provider: result.provider };
  }
}

export function renderProposalHtml(d, narrative, totals) {
  const validUntil = new Date(Date.now() + d.validityDays * 86400000).toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" });
  const itemRows = d.items.map(item => `<tr><td><strong>${escapeHtml(item.name)}</strong>${item.description ? `<br><span class="muted small">${escapeHtml(item.description)}</span>` : ""}</td><td style="text-align:right">${item.price !== undefined ? `${d.currency} ${item.price.toFixed(2)}` : "—"}</td></tr>`).join("");
  return `<!doctype html><html><head><meta charset="utf-8"><title>Proposal for ${escapeHtml(d.clientName)}</title><style>
    body{font-family:Inter,Arial,sans-serif;color:#111936;max-width:820px;margin:0 auto;padding:0 24px 60px;line-height:1.6}
    .cover{background:linear-gradient(120deg,#5d2de6,#ef7f2d);color:#fff;padding:60px 40px;margin:0 -24px 40px;border-radius:0 0 24px 24px}
    .cover .eyebrow{font-size:11px;letter-spacing:.14em;text-transform:uppercase;opacity:.85;margin:0 0 10px}
    .cover h1{font-size:34px;margin:0 0 8px}
    .cover p{margin:0;opacity:.92}
    h2{font-size:19px;border-bottom:2px solid #ef7f2d;padding-bottom:8px;margin-top:40px}
    .muted{color:#63708f}
    .small{font-size:12px}
    table{width:100%;border-collapse:collapse;margin-top:14px}
    th,td{padding:12px 10px;border-bottom:1px solid #dfe4ef;font-size:14px;text-align:left;vertical-align:top}
    th{font-size:11px;text-transform:uppercase;letter-spacing:.06em;color:#63708f}
    .totals{margin-top:10px;margin-left:auto;width:280px}
    .totals .grand{display:flex;justify-content:space-between;font-weight:800;font-size:18px;border-top:2px solid #111936;margin-top:6px;padding-top:10px}
    .meta{display:flex;justify-content:space-between;gap:20px;margin-top:30px;flex-wrap:wrap}
    .print-btn{margin-top:40px;padding:12px 20px;border:0;border-radius:8px;background:#5d2de6;color:#fff;font-weight:700;cursor:pointer;font-size:14px}
    @media print{.print-btn{display:none}.cover{margin-top:-40px}}
  </style></head><body>
    <div class="cover">
      <p class="eyebrow">Proposal</p>
      <h1>${escapeHtml(d.fromName)} for ${escapeHtml(d.clientName)}</h1>
      ${d.tagline ? `<p>${escapeHtml(d.tagline)}</p>` : ""}
    </div>

    <div class="meta">
      <div><strong>Prepared for</strong><br>${escapeHtml(d.clientName)}${d.clientContact ? `<br><span class="muted small">${escapeHtml(d.clientContact)}</span>` : ""}</div>
      <div><strong>Prepared by</strong><br>${escapeHtml(d.fromName)}</div>
      <div><strong>Valid until</strong><br>${validUntil}</div>
    </div>

    <h2>Executive Summary</h2>
    <p>${escapeHtml(narrative.summary)}</p>

    <h2>Understanding Your Challenge</h2>
    <p>${escapeHtml(narrative.understanding || d.problem)}</p>

    <h2>Proposed Solution</h2>
    <table><thead><tr><th>Deliverable</th><th style="text-align:right">Investment</th></tr></thead><tbody>${itemRows}</tbody></table>
    ${totals.hasPrice ? `<div class="totals"><div class="grand"><span>Total</span><span>${d.currency} ${totals.total.toFixed(2)}</span></div></div>` : ""}

    ${d.timeline ? `<h2>Timeline</h2><p>${escapeHtml(d.timeline)}</p>` : ""}

    ${narrative.whyUs ? `<h2>Why ${escapeHtml(d.fromName)}</h2><p>${escapeHtml(narrative.whyUs)}</p>` : ""}

    ${d.terms ? `<h2>Terms</h2><p>${escapeHtml(d.terms)}</p>` : ""}

    <h2>Next Steps</h2>
    <p>${escapeHtml(narrative.closing)}</p>

    <button class="print-btn" onclick="window.print()">Print / Save as PDF</button>
  </body></html>`;
}
