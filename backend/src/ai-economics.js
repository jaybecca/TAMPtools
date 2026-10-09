import { db } from './db/database.js';

export const CREDIT_VALUE_NGN = 3;
export const AI_COST_CONFIG = {
  'tamp-assistant': { credits: 2, category: 'text', minMargin: 0.60 },
  'ai-content-writer': { credits: 3, category: 'text', minMargin: 0.60 },
  'email-generator': { credits: 1, category: 'text', minMargin: 0.60 },
  'cold-email-generator': { credits: 1, category: 'text', minMargin: 0.60 },
  'blog-post-generator': { credits: 8, category: 'text', minMargin: 0.60 },
  'proposal-generator': { credits: 8, category: 'text', minMargin: 0.60 },
  'invoice-generator': { credits: 3, category: 'text', minMargin: 0.60 },
  'spreadsheet-ai-clean': { credits: 3, category: 'text', minMargin: 0.60 },
  'document-ai-extract': { credits: 10, category: 'document', minMargin: 0.60 },
  'invoice-receipt-ai-extract': { credits: 10, category: 'document', minMargin: 0.60 },
  'ai-image-generation': { credits: 30, category: 'image', minMargin: 0.60 }
};

export function aiPricing(operation) {
  return AI_COST_CONFIG[operation] || { credits: 3, category: 'text', minMargin: 0.60 };
}

async function wallet(userId) {
  return Number((await db.prepare('SELECT COALESCE(SUM(amount),0) AS balance FROM credit_ledger WHERE user_id=?').get(userId)).balance || 0);
}

async function planAiAllowance(userId) {
  const row = await db.prepare(`SELECT u.plan, p.features_json AS featuresJson FROM users u LEFT JOIN plans p ON p.name=u.plan WHERE u.id=?`).get(userId);
  const features = JSON.parse(row?.featuresJson || '{}');
  const limit = features.aiGenerations;
  const used = Number((await db.prepare("SELECT COALESCE(SUM(units),0) AS units FROM ai_usage_events WHERE user_id=? AND created_at>=datetime('now','start of month')").get(userId)).units || 0);
  return { limit, used, remaining: (limit === undefined || limit === null || limit === 'All' || limit === 'Fair-use') ? null : Math.max(0, Number(limit) - used) };
}

async function ledger(userId, amount, reason, reference) {
  await db.prepare('INSERT INTO credit_ledger(user_id,amount,reason,reference) VALUES(?,?,?,?)').run(userId, Number(amount), reason, reference || null);
  return wallet(userId);
}

export async function consumeAiJob(userId, operation, reference = null) {
  const cfg = aiPricing(operation);
  const allowance = await planAiAllowance(userId);
  const referenceId = reference || `${operation}-${Date.now()}-${Math.random().toString(36).slice(2,8)}`;

  if (allowance.remaining === null || allowance.remaining >= cfg.credits) {
    return { ok:true, source:'included', credits:0, chargedCredits:0, estimatedCredits:cfg.credits, allowance };
  }

  const balance = await wallet(userId);
  if (balance < cfg.credits) {
    return { ok:false, status:402, body:{ error:`This AI task needs ${cfg.credits} TAMP Credits.`, code:'INSUFFICIENT_AI_CREDITS', requiredCredits:cfg.credits, balance, operation, creditValueNgn:CREDIT_VALUE_NGN } };
  }

  await ledger(userId, -cfg.credits, `AI ${operation}`, referenceId);
  return { ok:true, source:'credits', credits:cfg.credits, chargedCredits:cfg.credits, estimatedCredits:cfg.credits, balance:await wallet(userId), allowance };
}

export async function refundAiCredits(userId, credits, operation, reference = null) {
  if (!credits) return await wallet(userId);
  return ledger(userId, Math.abs(Number(credits)), `AI refund ${operation}`, reference || null);
}

export async function recordAiProviderUsage({ userId, operation, provider, model, usage, estimatedCredits=0, chargedCredits=0, status='completed', error=null }) {
  const inputTokens = Number(usage?.inputTokens || 0);
  const outputTokens = Number(usage?.outputTokens || 0);
  const imageUnits = Number(usage?.imageUnits || 0);
  const row = await db.prepare('SELECT input_cost_per_million AS inputCost, output_cost_per_million AS outputCost, image_cost AS imageCost FROM ai_provider_rates WHERE provider=? AND model=? AND active=1 ORDER BY id DESC LIMIT 1').get(provider, model);
  const inputCost = Number(row?.inputCost || 0);
  const outputCost = Number(row?.outputCost || 0);
  const imageCost = Number(row?.imageCost || 0);
  const providerCostUsd = inputTokens / 1_000_000 * inputCost + outputTokens / 1_000_000 * outputCost + imageUnits * imageCost;
  await db.prepare(`INSERT INTO ai_usage_events(user_id,operation,units,source,credits,provider,model,input_tokens,output_tokens,image_units,provider_cost_usd,estimated_credits,charged_credits,status,error,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,CURRENT_TIMESTAMP)`).run(userId, operation, Math.max(1, Number(estimatedCredits || 0)), 'provider', 0, provider || 'unknown', model || null, inputTokens, outputTokens, imageUnits, providerCostUsd, Number(estimatedCredits || 0), Number(chargedCredits || 0), status, error || null);
  return { providerCostUsd, inputTokens, outputTokens, imageUnits };
}

export async function economicsSummary() {
  const totals = await db.prepare(`SELECT COUNT(*) AS jobs, COALESCE(SUM(provider_cost_usd),0) AS providerCostUsd, COALESCE(SUM(charged_credits),0) AS creditsCharged, COALESCE(SUM(estimated_credits),0) AS estimatedCredits FROM ai_usage_events`).get();
  const byOperation = await db.prepare(`SELECT operation, COUNT(*) AS jobs, COALESCE(SUM(provider_cost_usd),0) AS providerCostUsd, COALESCE(SUM(charged_credits),0) AS chargedCredits FROM ai_usage_events GROUP BY operation ORDER BY providerCostUsd DESC`).all();
  const byProvider = await db.prepare(`SELECT provider,model,COUNT(*) AS jobs,COALESCE(SUM(input_tokens),0) AS inputTokens,COALESCE(SUM(output_tokens),0) AS outputTokens,COALESCE(SUM(provider_cost_usd),0) AS providerCostUsd,COALESCE(SUM(charged_credits),0) AS chargedCredits FROM ai_usage_events GROUP BY provider,model ORDER BY providerCostUsd DESC`).all();
  const creditRevenueNgn = Number(totals.creditsCharged || 0) * CREDIT_VALUE_NGN;
  const providerCostUsd = Number(totals.providerCostUsd || 0);
  return { creditValueNgn:CREDIT_VALUE_NGN, totals:{...totals,creditRevenueNgn,providerCostUsd}, byOperation, byProvider };
}
