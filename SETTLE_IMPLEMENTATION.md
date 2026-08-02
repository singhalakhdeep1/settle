# Settle - Implementation

## Overview
This document describes the payment gateway integrations added to Settle.

## Technologies Added

### 1. Stripe Connect
- Connected account creation (custom accounts)
- Account link generation for onboarding
- Payment intent creation with application fees
- Payment intent confirmation
- Checkout session creation
- Subscription management
- Transfers to connected accounts
- Customer management
- Payment method creation and attachment
- Account retrieval and updates
- Transfer listing
- Webhook endpoint creation
- Webhook event construction

### 2. Plaid
- Link token creation for Plaid Link
- Public token exchange for access token
- Transaction retrieval
- Account information retrieval
- Balance retrieval
- Auth (account numbers and routing numbers)
- Identity verification
- Income verification
- Investment holdings
- Liabilities (loans, credit cards)
- Processor token creation (for Stripe/Dwolla)
- Item removal
- Webhook verification

### 3. Adyen
- Payment creation
- Payment session creation
- Payment details retrieval
- Recurring payments
- Token creation for saved payment methods
- Token disabling
- Payment capture
- Payment refund
- Payment cancellation
- Available payment methods
- Payment link creation
- Payment result retrieval

### 4. Braintree
- Client token generation
- Transaction creation and sale
- Transaction settlement
- Transaction voiding
- Transaction refunding
- Transaction search
- Customer CRUD operations
- Payment method management
- Subscription creation and cancellation
- Payment method verification
- Transaction cloning

### 5. PayPal
- Order creation and capture
- Order authorization
- Order retrieval
- Payment creation and execution
- Subscription management
- Plan creation
- Product creation
- Payment refund
- Webhook signature verification
- Payout creation
- Payout retrieval

## Files Created

### Payment Gateways
- `packages/shared/stripe-connect.ts` - Stripe Connect service
- `packages/shared/plaid.ts` - Plaid service
- `packages/shared/adyen.ts` - Adyen service
- `packages/shared/braintree.ts` - Braintree service
- `packages/shared/paypal.ts` - PayPal SDK service

## Installation Required

Add to `package.json`:
```json
{
  "dependencies": {
    "stripe": "^14.0.0",
    "plaid": "^18.0.0",
    "@adyen/api-library": "^14.0.0",
    "braintree": "^3.24.0",
    "@paypal/checkout-server-sdk": "^1.0.3"
  }
}
```

Run:
```bash
pnpm install
```

## Environment Variables

```env
# Stripe Connect
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...

# Plaid
PLAID_CLIENT_ID=your_client_id
PLAID_SECRET=your_secret
PLAID_ENV=sandbox
PLAID_WEBHOOK_KEY=your_webhook_key

# Adyen
ADYEN_API_KEY=your_api_key
ADYEN_MERCHANT_ACCOUNT=your_merchant_account
ADYEN_ENVIRONMENT=test

# Braintree
BRAINTREE_MERCHANT_ID=your_merchant_id
BRAINTREE_PUBLIC_KEY=your_public_key
BRAINTREE_PRIVATE_KEY=your_private_key
BRAINTREE_ENVIRONMENT=sandbox

# PayPal
PAYPAL_CLIENT_ID=your_client_id
PAYPAL_CLIENT_SECRET=your_client_secret
PAYPAL_ENVIRONMENT=sandbox
PAYPAL_WEBHOOK_ID=your_webhook_id
```

## Notes
- All code is written but packages are not installed (per user request)
- Stripe Connect supports marketplace payments with application fees
- Plaid provides bank account linking and financial data access
- Adyen supports global payment processing
- Braintree provides comprehensive payment management
- PayPal supports orders, subscriptions, and payouts
- All services support webhook integration
- Access tokens should be stored securely
