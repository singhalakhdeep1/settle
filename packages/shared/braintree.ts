// Braintree integration for settle

import braintree from 'braintree';

class BraintreeService {
  private gateway: braintree.Gateway;

  constructor(merchantId: string, publicKey: string, privateKey: string, environment = 'sandbox') {
    this.gateway = new braintree.Gateway({
      environment: environment === 'production' 
        ? braintree.Environment.Production 
        : braintree.Environment.Sandbox,
      merchantId: merchantId,
      publicKey: publicKey,
      privateKey: privateKey
    });
  }

  async generateClientToken() {
    const response = await this.gateway.clientToken.generate({});
    return response.clientToken;
  }

  async createTransaction(transactionData: any) {
    const request = {
      amount: transactionData.amount,
      paymentMethodNonce: transactionData.paymentMethodNonce,
      customer: {
        firstName: transactionData.firstName,
        lastName: transactionData.lastName,
        email: transactionData.email
      },
      options: {
        submitForSettlement: true
      }
    };

    if (transactionData.deviceData) {
      request.deviceData = transactionData.deviceData;
    }

    const response = await this.gateway.transaction.sale(request);
    return response;
  }

  async submitForSettlement(transactionId: string, amount?: number) {
    const request: any = { transactionId };
    if (amount) {
      request.amount = amount;
    }

    const response = await this.gateway.transaction.submitForSettlement(request);
    return response;
  }

  async voidTransaction(transactionId: string) {
    const response = await this.gateway.transaction.void(transactionId);
    return response;
  }

  async refundTransaction(transactionId: string, amount?: number) {
    const request: any = { transactionId };
    if (amount) {
      request.amount = amount;
    }

    const response = await this.gateway.transaction.refund(request);
    return response;
  }

  async findTransaction(transactionId: string) {
    const response = await this.gateway.transaction.find(transactionId);
    return response;
  }

  async createCustomer(customerData: any) {
    const request = {
      firstName: customerData.firstName,
      lastName: customerData.lastName,
      email: customerData.email,
      phone: customerData.phone,
      paymentMethodNonce: customerData.paymentMethodNonce
    };

    const response = await this.gateway.customer.create(request);
    return response;
  }

  async findCustomer(customerId: string) {
    const response = await this.gateway.customer.find(customerId);
    return response;
  }

  async updateCustomer(customerId: string, updates: any) {
    const response = await this.gateway.customer.update(customerId, updates);
    return response;
  }

  async deleteCustomer(customerId: string) {
    const response = await this.gateway.customer.delete(customerId);
    return response;
  }

  async createPaymentMethod(customerId: string, paymentMethodNonce: string) {
    const request = {
      customerId: customerId,
      paymentMethodNonce: paymentMethodNonce
    };

    const response = await this.gateway.paymentMethod.create(request);
    return response;
  }

  async findPaymentMethod(paymentMethodToken: string) {
    const response = await this.gateway.paymentMethod.find(paymentMethodToken);
    return response;
  }

  async deletePaymentMethod(paymentMethodToken: string) {
    const response = await this.gateway.paymentMethod.delete(paymentMethodToken);
    return response;
  }

  async createSubscription(subscriptionData: any) {
    const request = {
      paymentMethodToken: subscriptionData.paymentMethodToken,
      planId: subscriptionData.planId,
      price: subscriptionData.price,
      neverExpires: subscriptionData.neverExpires || false
    };

    if (subscriptionData.numberOfBillingCycles) {
      request.numberOfBillingCycles = subscriptionData.numberOfBillingCycles;
    }

    const response = await this.gateway.subscription.create(request);
    return response;
  }

  async cancelSubscription(subscriptionId: string) {
    const response = await this.gateway.subscription.cancel(subscriptionId);
    return response;
  }

  async findSubscription(subscriptionId: string) {
    const response = await this.gateway.subscription.find(subscriptionId);
    return response;
  }

  async searchTransactions(searchCriteria: any) {
    const search = this.gateway.transaction.search();
    
    if (searchCriteria.customerId) {
      search.customerId().is(searchCriteria.customerId);
    }
    
    if (searchCriteria.status) {
      search.status().is(searchCriteria.status);
    }

    const response = await search;
    return response;
  }

  async verifyPaymentMethod(paymentMethodNonce: string) {
    const response = await this.gateway.paymentMethod.verify(paymentMethodNonce);
    return response;
  }

  async cloneTransaction(transactionId: string, amount: number, options: any = {}) {
    const request = {
      amount: amount,
      transactionId: transactionId,
      options: {
        submitForSettlement: true
      }
    };

    if (options.channel) {
      request.options.channel = options.channel;
    }

    const response = await this.gateway.transaction.cloneTransaction(request);
    return response;
  }
}

export default BraintreeService;
