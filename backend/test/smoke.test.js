import test from 'node:test';
import assert from 'node:assert/strict';
process.env.PADDLE_API_KEY='configured';
process.env.FLW_SECRET_KEY='configured';
const { routeCheckout } = await import('../src/payments.js');

test('smart checkout routes African NGN to Flutterwave',()=>{const r=routeCheckout({country:'NG',currency:'NGN',language:'en'});assert.equal(r.provider,'flutterwave');});
test('smart checkout routes international USD to Paddle',()=>{const r=routeCheckout({country:'US',currency:'USD',language:'en'});assert.equal(r.provider,'paddle');});
test('customer requested provider is ignored',()=>{const r=routeCheckout({country:'US',currency:'USD',language:'en',requested:'flutterwave'});assert.equal(r.provider,'paddle');});
