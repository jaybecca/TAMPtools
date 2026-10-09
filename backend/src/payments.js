import { integrationSecretGet } from './secret-store.js';
import crypto from 'node:crypto';

const PROVIDERS = ['flutterwave', 'paddle'];
const configured = value => Boolean(value && value !== 'REPLACE_ME');
const AFRICA_FLUTTERWAVE_COUNTRIES = new Set([
  'NG','GH','KE','ZA','UG','TZ','RW','ZM','MW','CI','SN','CM','EG','SL','LR','GM'
]);
const FLUTTERWAVE_CURRENCIES = new Set(['NGN','GHS','KES','ZAR','UGX','TZS','RWF','ZMW','MWK','XOF','XAF','EGP','USD','EUR','GBP']);

export function paymentProviders() {
  return Object.fromEntries(PROVIDERS.map(provider => [provider, {
    configured: providerConfigured(provider),
    recurring: true,
    role: provider === 'flutterwave' ? 'regional' : 'global'
  }]));
}

export function providerConfigured(provider) {
  switch (String(provider || '').toLowerCase()) {
    case 'flutterwave': return configured(process.env.FLW_SECRET_KEY);
    case 'paddle': return configured(process.env.PADDLE_API_KEY);
    default: return false;
  }
}

export function routeCheckout({ country, currency, language, requested } = {}) {
  const cc = String(country || '').toUpperCase();
  const cur = String(currency || '').toUpperCase();
  const lang = String(language || '').toLowerCase();
  // Manual provider selection is intentionally ignored for customer checkout.
  // Routing is deterministic: regional African currencies/countries go to Flutterwave;
  // all other supported markets go to Paddle. Language is a secondary regional signal.
  const regionalLanguage = ['fr','pt','sw','ar'].some(prefix => lang.startsWith(prefix));
  if (providerConfigured('flutterwave') && (FLUTTERWAVE_CURRENCIES.has(cur) && (AFRICA_FLUTTERWAVE_COUNTRIES.has(cc) || regionalLanguage))) {
    return { provider: 'flutterwave', reason: 'regional_currency_or_locale', country: cc, currency: cur, language: lang || null };
  }
  if (providerConfigured('paddle')) {
    return { provider: 'paddle', reason: 'global_default', country: cc, currency: cur, language: lang || null };
  }
  if (providerConfigured('flutterwave')) {
    return { provider: 'flutterwave', reason: 'fallback_available_provider', country: cc, currency: cur, language: lang || null };
  }
  return { provider: null, reason: 'no_configured_provider', country: cc, currency: cur, language: lang || null };
}

export function selectProvider(args = {}) { return routeCheckout(args).provider; }

async function paymentSecret(provider, keyName, envName) {
  try {
    const stored = await integrationSecretGet(`${provider}:${keyName}`);
    if (stored) return stored;
  } catch {}
  return process.env[envName] || null;
}

export { paymentSecret };
function baseUrl(req) { return process.env.APP_BASE_URL || `${req.protocol}://${req.get('host')}`; }
function planKey(plan) { return String(plan).toUpperCase().replace(/[^A-Z0-9]+/g, '_'); }
function cycleKey(cycle) { return String(cycle || 'monthly').toUpperCase(); }
function priceId(provider, plan, currency, cycle = 'monthly') {
  const prefix = provider === 'flutterwave' ? 'FLW' : 'PADDLE';
  return process.env[`${prefix}_PRICE_${planKey(plan)}_${currency}_${cycleKey(cycle)}`]
    || process.env[`${prefix}_PRICE_${planKey(plan)}_${currency}`]
    || process.env[`${prefix}_PRICE_${planKey(plan)}_${cycleKey(cycle)}`]
    || process.env[`${prefix}_PRICE_${planKey(plan)}`]
    || null;
}

export async function createCheckout({ provider, user, plan, currency, amount, req, cycle = 'monthly', promotion = null }) {
  const success = `${baseUrl(req)}/dashboard.html?payment=success`;
  const cancel = `${baseUrl(req)}/index.html#pricing`;
  if (provider === 'flutterwave') {
    const secret = await paymentSecret('flutterwave','secret_key','FLW_SECRET_KEY');
    const txRef = `tt-${user.id}-${Date.now()}-${crypto.randomUUID()}`;
    const paymentPlan = cycle === 'one_time' ? null : priceId('flutterwave', plan, currency, cycle);
    if (cycle !== 'one_time' && !paymentPlan) throw new Error(`FLW_PRICE_${planKey(plan)}_${currency}_${cycleKey(cycle)} (Flutterwave payment plan ID) is required.`);
    const payload = {
      tx_ref: txRef,
      amount: Number(amount),
      currency,
      redirect_url: success,
      payment_options: 'card,banktransfer,account,ussd,mobilemoney',
      customer: { email: user.email, name: user.name },
      customizations: { title: `TAMPtools ${plan}` },
      ...(paymentPlan ? { payment_plan: Number(paymentPlan) } : {}),
      meta: [
        ...(promotion ? [{ key: 'promotion_code', value: String(promotion.code) }] : []),
        { key: 'user_id', value: String(user.id) },
        { key: 'plan', value: plan },
        { key: 'currency', value: currency },
        { key: 'billing_cycle', value: cycle }
      ]
    };
    return postJson('https://api.flutterwave.com/v3/payments', payload, { Authorization: `Bearer ${secret}` });
  }
  if (provider === 'paddle') {
    const secret = await paymentSecret('paddle','api_key','PADDLE_API_KEY');
    const pid = priceId('paddle', plan, currency, cycle);
    if (!pid) throw new Error(`PADDLE_PRICE_${planKey(plan)}_${currency}_${cycleKey(cycle)} is required.`);
    return postJson('https://api.paddle.com/transactions', {
      items: [{ price_id: pid, quantity: 1 }],
      checkout: { url: success },
      custom_data: { user_id: String(user.id), plan, currency, billing_cycle: cycle, promotion_code: promotion?.code || null, discount_amount: promotion?.discountAmount || 0 }
    }, { Authorization: `Bearer ${secret}` });
  }
  throw new Error('Unsupported payment provider.');
}

async function postJson(url, payload, headers = {}) {
  const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(payload) });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.message || d.error?.message || `Payment provider returned HTTP ${r.status}`);
  return d;
}

export function verifyWebhook(provider, rawBody, headers = {}) {
  const raw = Buffer.isBuffer(rawBody) ? rawBody : Buffer.from(String(rawBody || ''));
  if (provider === 'paddle') return verifyPaddle(raw, headers['paddle-signature'], process.env.PADDLE_WEBHOOK_SECRET);
  if (provider === 'flutterwave') return verifyFlutterwave(raw, headers['flutterwave-signature'], headers['verif-hash'], process.env.FLW_WEBHOOK_SECRET);
  return false;
}

function verifyPaddle(raw, signature, secret) {
  if (!configured(secret)) return false;
  const parts = String(signature || '').split(';').reduce((acc, item) => { const [k, ...v] = item.split('='); if (k && v.length) acc[k] = v.join('='); return acc; }, {});
  const ts = Number(parts.ts); const h1 = parts.h1;
  if (!ts || !h1 || Math.abs(Date.now() / 1000 - ts) > 5) return false;
  return safeEqual(crypto.createHmac('sha256', secret).update(`${ts}:${raw.toString()}`).digest('hex'), h1);
}

function verifyFlutterwave(raw, signature, legacyHash, secret) {
  if (!configured(secret)) return false;
  if (signature) {
    const expected = crypto.createHmac('sha256', secret).update(raw).digest('base64');
    return safeEqual(expected, signature);
  }
  return Boolean(legacyHash) && safeEqual(secret, legacyHash);
}

function safeEqual(a, b) {
  if (!a || !b) return false;
  const A = Buffer.from(String(a)); const B = Buffer.from(String(b));
  return A.length === B.length && crypto.timingSafeEqual(A, B);
}

export function normalizeWebhook(provider, event) {
  const obj = event?.data?.object || event?.data || event || {};
  if (provider === 'flutterwave') {
    const meta = Array.isArray(obj.meta) ? Object.fromEntries(obj.meta.map(x => [x.key, x.value])) : (obj.meta || {});
    const type = String(event.type || event.event || '').toLowerCase();
    return {
      eventId: event.id || obj.id || obj.tx_ref,
      type,
      userId: Number(meta.user_id || 0),
      plan: meta.plan,
      billingCycle: meta.billing_cycle || 'monthly',
      reference: obj.tx_ref || obj.id,
      status: ['charge.completed', 'subscription.created', 'subscription.charged', 'charge.success'].includes(type) ? 'active' : 'inactive',
      customer: obj.customer?.id || obj.customer?.customer_code
    };
  }
  if (provider === 'paddle') {
    const custom = obj.custom_data || {};
    const type = String(event.event_type || event.eventType || '').toLowerCase();
    return {
      eventId: event.event_id || event.notification_id,
      type,
      userId: Number(custom.user_id || 0),
      plan: custom.plan,
      billingCycle: custom.billing_cycle || 'monthly',
      reference: obj.subscription_id || obj.id,
      status: ['subscription.created', 'subscription.updated', 'subscription.activated', 'transaction.completed', 'transaction.paid'].includes(type) ? 'active' : (['subscription.canceled', 'subscription.past_due', 'transaction.past_due'].includes(type) ? 'inactive' : 'active'),
      customer: obj.customer_id
    };
  }
  return { eventId: null };
}
