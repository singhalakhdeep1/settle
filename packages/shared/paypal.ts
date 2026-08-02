// PayPal SDK integration for settle

import paypal from '@paypal/checkout-server-sdk';

class PayPalService {
  private client: paypal.core.PayPalHttpClient;

  constructor(clientId: string, clientSecret: string, environment = 'sandbox') {
    const environmentClass = environment === 'live' 
      ? paypal.core.LiveEnvironment 
      : paypal.core.SandboxEnvironment;
    
    this.client = new paypal.core.PayPalHttpClient(
      new environmentClass(clientId, clientSecret)
    );
  }

  async createOrder(orderData: any) {
    const request = new paypal.orders.OrdersCreateRequest();
    request.prefer('return=representation');
    request.requestBody({
      intent: 'CAPTURE',
      purchase_units: [{
        amount: {
          currency_code: orderData.currency,
          value: orderData.amount.toString()
        },
        description: orderData.description || ''
      }]
    });

    const response = await this.client.execute(request);
    return response.result;
  }

  async captureOrder(orderId: string) {
    const request = new paypal.orders.OrdersCaptureRequest(orderId);
    request.requestBody({});

    const response = await this.client.execute(request);
    return response.result;
  }

  async authorizeOrder(orderId: string) {
    const request = new paypal.orders.OrdersAuthorizeRequest(orderId);
    request.requestBody({});

    const response = await this.client.execute(request);
    return response.result;
  }

  async getOrder(orderId: string) {
    const request = new paypal.orders.OrdersGetRequest(orderId);

    const response = await this.client.execute(request);
    return response.result;
  }

  async createPayment(amount: string, currency: string, returnUrl: string, cancelUrl: string) {
    const request = new paypal.payments.PaymentsCreateRequest();
    request.requestBody({
      intent: 'sale',
      payer: {
        payment_method: 'paypal'
      },
      transactions: [{
        amount: {
          total: amount,
          currency: currency
        }
      }],
      redirect_urls: {
        return_url: returnUrl,
        cancel_url: cancelUrl
      }
    });

    const response = await this.client.execute(request);
    return response.result;
  }

  async executePayment(paymentId: string, payerId: string) {
    const request = new paypal.payments.PaymentsExecuteRequest(paymentId);
    request.requestBody({
      payer_id: payerId
    });

    const response = await this.client.execute(request);
    return response.result;
  }

  async createSubscription(planId: string, startTime: string) {
    const request = new paypal.subscriptions.SubscriptionsCreateRequest();
    request.requestBody({
      plan_id: planId,
      start_time: startTime,
      subscriber: {
        name: {
          given_name: 'John',
          surname: 'Doe'
        },
        email_address: 'customer@example.com'
      }
    });

    const response = await this.client.execute(request);
    return response.result;
  }

  async getSubscription(subscriptionId: string) {
    const request = new paypal.subscriptions.SubscriptionsGetRequest(subscriptionId);

    const response = await this.client.execute(request);
    return response.result;
  }

  async cancelSubscription(subscriptionId: string, reason: string) {
    const request = new paypal.subscriptions.SubscriptionsCancelRequest(subscriptionId);
    request.requestBody({
      reason: reason
    });

    await this.client.execute(request);
    return { success: true };
  }

  async createPlan(planData: any) {
    const request = new paypal.billing.PlansCreateRequest();
    request.requestBody({
      product_id: planData.productId,
      name: planData.name,
      description: planData.description,
      billing_cycles: [{
        frequency: {
          interval_unit: planData.intervalUnit,
          interval_count: planData.intervalCount
        },
        tenure_type: 'REGULAR',
        sequence: 1,
        total_cycles: planData.totalCycles || 0
      }],
      payment_preferences: {
        auto_bill_outstanding: true,
        setup_fee: {
          value: planData.setupFee || '0',
          currency_code: planData.currency
        },
        setup_fee_failure_action: 'CONTINUE',
        payment_failure_threshold: 3
      },
      taxes: {
        percentage: planData.taxPercentage || '0',
        inclusive: false
      }
    });

    const response = await this.client.execute(request);
    return response.result;
  }

  async createProduct(productData: any) {
    const request = new paypal.catalog.ProductsCreateRequest();
    request.requestBody({
      name: productData.name,
      description: productData.description,
      type: productData.type || 'SERVICE',
      category: productData.category || 'SOFTWARE',
      image_url: productData.imageUrl,
      home_url: productData.homeUrl
    });

    const response = await this.client.execute(request);
    return response.result;
  }

  async refundPayment(captureId: string, amount?: string) {
    const request = new paypal.payments.CapturesRefundRequest(captureId);
    
    if (amount) {
      request.requestBody({
        amount: {
          value: amount,
          currency_code: 'USD'
        }
      });
    } else {
      request.requestBody({});
    }

    const response = await this.client.execute(request);
    return response.result;
  }

  async verifyWebhookSignature(headers: any, body: string, webhookId: string) {
    const request = new paypal.notifications.VerifyWebhookSignatureRequest();
    request.requestBody({
      auth_algo: headers['paypal-auth-algo'],
      cert_id: headers['paypal-cert-id'],
      transmission_id: headers['paypal-transmission-id'],
      transmission_sig: headers['paypal-transmission-sig'],
      transmission_time: headers['paypal-transmission-time'],
      webhook_id: webhookId,
      webhookevent: JSON.parse(body)
    });

    const response = await this.client.execute(request);
    return response.result.verification_status === 'SUCCESS';
  }

  async createPayout(payoutData: any) {
    const request = new paypal.payments.PayoutsCreateRequest();
    request.requestBody({
      sender_batch_header: {
        sender_batch_id: payoutData.batchId,
        email_subject: payoutData.subject
      },
      items: [{
        recipient_type: 'EMAIL',
        amount: {
          value: payoutData.amount,
          currency: payoutData.currency
        },
        receiver: payoutData.receiver,
        note: payoutData.note,
        sender_item_id: payoutData.itemId
      }]
    });

    const response = await this.client.execute(request);
    return response.result;
  }

  async getPayout(payoutBatchId: string) {
    const request = new paypal.payments.PayoutsGetRequest(payoutBatchId);

    const response = await this.client.execute(request);
    return response.result;
  }
}

export default PayPalService;
