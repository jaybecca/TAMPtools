import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { db } from '../src/db/database.js';
import {
  trialActive,
  getPlanForUser,
  monthlyUsage,
  consumeEntitlement,
  enforceFeature
} from '../src/entitlements.js';

function createUser(plan = 'Free', trialEndsAt = null) {
  const email = `coverage-${randomUUID()}@example.test`;
  const result = db.prepare(
    'INSERT INTO users (name,email,password_hash,plan,trial_ends_at) VALUES (?,?,?,?,?)'
  ).run('Coverage Test', email, 'not-a-real-password-hash', plan, trialEndsAt);
  return Number(result.lastInsertRowid);
}

function removeUser(id) {
  db.prepare('DELETE FROM users WHERE id = ?').run(id);
}

test('owner access returns unlimited usage and full feature entitlements', async () => {
  const id = createUser();
  try {
    db.prepare("INSERT INTO admin_roles (user_id,role) VALUES (?,'owner')").run(id);
    const plan = await getPlanForUser(id);
    assert.equal(plan.name, 'Owner access');
    assert.equal(plan.monthlyUses, null);
    assert.equal(plan.features.storageMb, Number.MAX_SAFE_INTEGER);

    const usage = await consumeEntitlement(id, 'coverage-owner-test', 2);
    assert.equal(usage.ok, true);
    assert.equal(usage.usage.limit, null);
    assert.equal(usage.usage.remaining, null);

    const feature = await enforceFeature(id, 'storageMb', Number.MAX_SAFE_INTEGER);
    assert.equal(feature.ok, true);
  } finally {
    removeUser(id);
  }
});

test('regular plan usage and feature limits are enforced', async () => {
  const id = createUser('Free');
  try {
    const plan = await getPlanForUser(String(id));
    assert.equal(plan.name, 'Free');
    assert.equal(trialActive({ trialEndsAt: '2000-01-01 00:00:00' }), false);

    const before = await monthlyUsage(id);
    const usage = await consumeEntitlement(id, 'coverage-free-test');
    assert.equal(usage.ok, true);
    assert.equal(usage.usage.used, before + 1);

    const feature = await enforceFeature(id, 'pdfMaxFiles', 999);
    assert.equal(feature.ok, false);
    assert.equal(feature.body.code, 'PLAN_FEATURE_LIMIT');
  } finally {
    removeUser(id);
  }
});

test('trial and active-subscription plans are resolved correctly', async () => {
  const trialEnd = '2099-01-01 00:00:00';
  const id = createUser('Free', trialEnd);
  try {
    assert.equal(trialActive({ trialEndsAt: trialEnd }), true);
    const trial = await getPlanForUser({ id, plan: 'Free', trialEndsAt: trialEnd });
    assert.equal(trial.name, '30-Day Trial');
    assert.equal(trial.trial, true);

    const freePlan = db.prepare("SELECT id FROM plans WHERE name = 'Free'").get();
    db.prepare("INSERT INTO subscriptions (user_id,plan_id,status) VALUES (?,?,'active')").run(id, freePlan.id);
    const subscribed = await getPlanForUser({ id, plan: 'Free', trialEndsAt: null });
    assert.equal(subscribed.name, 'Free');
    assert.equal(subscribed.trial, false);

    assert.equal(await getPlanForUser({ plan: 'Missing plan' }), null);
    const missingUser = await consumeEntitlement(999999999, 'coverage-missing-user');
    assert.equal(missingUser.status, 401);
  } finally {
    removeUser(id);
  }
});
