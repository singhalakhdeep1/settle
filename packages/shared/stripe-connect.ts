// Stripe Connect integration for settle

import Stripe from 'stripe';

class StripeConnectService {
  private stripe: Stripe;

  constructor(secretKey: string) {
    this.stripe = new Stripe(secretKey, {
      apiVersion: '2023-10-16'
    });
  }

  async createConnectedAccount(accountData: any) {
    return await this.stripe.accounts.create({
      type: 'custom',
      country: accountData.country || 'US',
      email: accountData.email,
      business_type: accountData.businessType || 'individual',
      capabilities: {
        transfers: { requested: true },
        card_payments: { requested: true }
      },
      business_profile: {
        mcc: accountData.mcc || '5734',
        url: accountData.businessUrl
      }
    });
  }

  async generateAccountLink(accountId: string, returnUrl: string, refreshUrl: string) {
    return await this.stripe.accountLinks.create({
      account: accountId,
      refresh_url: refreshUrl,
      return_url: returnUrl,
      type: 'account_onboarding'
    });
  }

  async createPaymentIntent(amount: number, currency: string, accountId?: string) {
    const params: any = {
      amount: Math.round(amount * 100),
      currency: currency.toLowerCase()
    };

    if (accountId) {
      params.application_fee_amount = Math.round(amount * 100 * 0.05); // 5% fee
      params.transfer_data = {
        destination: accountId
      };
    }

    return await this.stripe.paymentIntents.create(params);
  }

  async confirmPaymentIntent(paymentIntentId: string, paymentMethodId: string) {
    return await this.stripe.paymentIntents.confirm(paymentIntentId, {
      payment_method: paymentMethodId
    });
  }

  async createCheckoutSession(items: any[], successUrl: string, cancelUrl: string, accountId?: string) {
    const params: any = {
      payment_method_types: ['card'],
      line_items: items.map(item => ({
        price_data: {
          currency: item.currency.toLowerCase(),
          product_data: {
            name: item.name
          },
          unit_amount: Math.round(item.amount * 100)
        },
        quantity: item.quantity || 1
      })),
      mode: 'payment',
      success_url: successUrl,
      cancel_url: cancelUrl
    };

    if (accountId) {
      params.payment_intent_data = {
        application_fee_amount: items.reduce((sum, item) => sum + item.amount, 0) * 0.05 * 100,
        transfer_data: {
          destination: accountId
        }
      };
    }

    return await this.stripe.checkout.sessions.create(params);
  }

  async createSubscription(customerId: string, priceId: string) {
    return await this.stripe.subscriptions.create({
      customer: customerId,
      items: [{ price: priceId }],
      payment_behavior: 'default_incomplete',
      payment_settings: { save_default_payment_method: 'on_subscription' },
      expand: ['latest_invoice.payment_intent']
    });
  }

  async transferToConnectedAccount(amount: number, currency: string, accountId: string) {
    return await this.stripe.transfers.create({
      amount: Math.round(amount * 100),
      currency: currency.toLowerCase(),
      destination: accountId
    });
  }

  async createCustomer(customerData: any) {
    return await this.stripe.customers.create({
      email: customerData.email,
      name: customerData.name,
      payment_method: customerData.paymentMethodId,
      invoice_settings: {
        default_payment_method: customerData.paymentMethodId
      }
    });
  }

  async createPaymentMethod(paymentMethodData: any) {
    return await this.stripe.paymentMethods.create({
      type: paymentMethodData.type || 'card',
      card: paymentMethodData.card
    });
  }

  async attachPaymentMethodToCustomer(paymentMethodId: string, customerId: string) {
    return await this.stripe.paymentMethods.attach(paymentMethodId, {
      customer: customerId
    });
  }

  async retrieveAccount(accountId: string) {
    return await this.stripe.accounts.retrieve(accountId);
  }

  async updateAccount(accountId: string, updates: any) {
    return await this.stripe.accounts.update(accountId, updates);
  }

  async listTransfers(accountId: string, limit = 10) {
    return await this.stripe.transfers.list({
      destination: accountId,
      limit
    });
  }

  async createWebhookEndpoint(url: string, events: string[]) {
    return await this.stripe.webhookEndpoints.create({
      url,
      enabled_events: events
    });
  }

  constructWebhookEvent(payload: string, signature: string, secret: string) {
    return this.stripe.webhooks.constructEvent(payload, signature, secret);
  }
}

export default StripeConnectService;
