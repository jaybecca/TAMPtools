import { db, TRIAL_LIMITS } from './db/database.js';

export function trialActive(user) {
  return Boolean(user?.trialEndsAt && Date.parse(String(user.trialEndsAt).replace(' ', 'T') + 'Z') > Date.now());
}

export async function getPlanForUser(user) {
  if (typeof user === 'number' || typeof user === 'string') user = await db.prepare('SELECT id,plan,trial_ends_at AS trialEndsAt FROM users WHERE id=?').get(Number(user));
  const ownerRole = user?.id ? await db.prepare('SELECT role FROM admin_roles WHERE user_id=?').get(user.id) : null;
  if (ownerRole) {
    const ownerPlan = await db.prepare("SELECT id,name,usd,gbp,ngn,prices_json AS pricesJson,monthly_uses AS monthlyUses,features_json AS featuresJson,scheduling_days AS schedulingDays,batch_posts AS batchPosts FROM plans WHERE name='Business' AND active=1").get();
    const baseFeatures = JSON.parse(ownerPlan?.featuresJson || '{}');
    const features = Object.fromEntries(Object.entries({ ...TRIAL_LIMITS, ...baseFeatures }).map(([key, value]) => [key, typeof value === 'number' ? Number.MAX_SAFE_INTEGER : value === false ? true : value]));
    return { ...(ownerPlan || {}), name: 'Owner access', trial: false, monthlyUses: null, features };
  }
  const activeSub = user?.id ? await db.prepare("SELECT p.id,p.name,p.usd,p.gbp,p.ngn,p.prices_json AS pricesJson,p.monthly_uses AS monthlyUses,p.features_json AS featuresJson,p.scheduling_days AS schedulingDays,p.batch_posts AS batchPosts FROM subscriptions s JOIN plans p ON p.id=s.plan_id WHERE s.user_id=? AND s.status IN ('active','trialing') AND p.active=1 ORDER BY s.id DESC LIMIT 1").get(user.id) : null;
  if (activeSub) return { ...activeSub, trial:false, prices:JSON.parse(activeSub.pricesJson||'{}'), features:JSON.parse(activeSub.featuresJson||'{}') };
  if (trialActive(user)) {
    return { name: '30-Day Trial', trial: true, monthlyUses: TRIAL_LIMITS.monthlyUses, features: { ...TRIAL_LIMITS, pdfMaxFiles: 10, pdfMaxMb: 100, pdfAdvanced: true, tools: 'All', teamMembers: 1, analytics: 'Basic', prioritySupport: false } };
  }
  const row = await db.prepare(`SELECT id,name,usd,gbp,ngn,monthly_uses AS monthlyUses,features_json AS featuresJson,scheduling_days AS schedulingDays,batch_posts AS batchPosts FROM plans WHERE name = ? AND active = 1`).get(user.plan);
  if (!row) return null;
  return { ...row, trial: false, features: JSON.parse(row.featuresJson || '{}') };
}

export async function monthlyUsage(userId) {
  return Number(await db.prepare(`SELECT COUNT(*) AS count FROM usage_events WHERE user_id = ? AND created_at >= datetime('now','start of month')`).get(userId).count);
}

export async function consumeEntitlement(userId, toolKey, units = 1) {
  const user = await db.prepare('SELECT id,plan,trial_ends_at AS trialEndsAt FROM users WHERE id = ?').get(userId);
  if (!user) return { ok:false,status:401,body:{error:'Account not found.'} };
  const plan = await getPlanForUser(user);
  if (!plan) return { ok:false,status:403,body:{error:'Your account plan is unavailable.'} };
  const used = await monthlyUsage(userId);
  const limit = plan.monthlyUses == null ? null : Number(plan.monthlyUses);
  if (limit !== null && used + units > limit) return { ok:false,status:429,body:{error:`You have reached your ${plan.name} plan usage limit of ${limit} this month.`,code:'USAGE_LIMIT_REACHED',plan:plan.name,used,limit,remaining:Math.max(0,limit-used)} };
  for (let i=0;i<units;i++) await db.prepare('INSERT INTO usage_events (user_id,tool_key) VALUES (?,?)').run(userId,toolKey);
  return {ok:true,plan,usage:{used:used+units,limit,remaining:limit===null?null:Math.max(0,limit-used-units)}};
}

export async function enforceFeature(userId, feature, requested = 1) {
  const user = await db.prepare('SELECT id,plan,trial_ends_at AS trialEndsAt FROM users WHERE id = ?').get(userId);
  const plan = await getPlanForUser(user || {});
  const value = plan?.features?.[feature];
  if (value === undefined || value === null || value === 'Fair-use' || value === 'All') return {ok:true,plan,value};
  if (Number(value) >= Number(requested)) return {ok:true,plan,value};
  return {ok:false,status:403,body:{error:`Your ${plan?.name || 'current'} plan does not allow this request.`,code:'PLAN_FEATURE_LIMIT',feature,limit:value,requested,plan:plan?.name}};
}

