# Phase 21 — Customer Billing & Payment Support

Built on Phase 20.

## Paddle
- Added authenticated Paddle customer portal sessions.
- Uses the logged-in TAMPtools user's stored Paddle customer reference.
- Generates temporary portal links on demand; links are not stored.
- Supports general billing portal access and subscription deep links when the subscription reference is a Paddle subscription ID.
- Requires Paddle API key permission `customer_portal_session.write`.
- Falls back to `PADDLE_CUSTOMER_PORTAL_URL` if customer mapping/API access is unavailable.

## Flutterwave
- Added TAMPtools Payment Help / Support Center rather than pretending Flutterwave has the same hosted customer portal as Paddle.
- Customers can report failed payments, missing upgrades, duplicate charges, refunds, receipt questions and other billing issues.
- Customer can include provider and transaction reference.
- Support requests are persisted for admin/customer-service handling.
- Existing Flutterwave payment/subscription flows remain intact.

## Billing UI
- Added Manage my billing action.
- Added payment issue form and support history.
- Billing receipts now show provider.
- Paddle redirects to its hosted portal; Flutterwave directs the customer to TAMPtools Payment Help.

## Security
- Paddle portal sessions are generated server-side.
- Provider credentials remain server-side.
- Portal session URLs are temporary and are never persisted.
- Payment support tickets are scoped to the authenticated user.
