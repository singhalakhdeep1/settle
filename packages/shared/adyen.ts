// Adyen integration for settle

import { Client, Checkout, Payments, Recurring, Modification } from '@adyen/api-library';

class AdyenService {
  private checkout: Checkout;
  private payments: Payments;
  private recurring: Recurring;
  private modification: Modification;

  constructor(apiKey: string, merchantAccount: string, environment = 'test') {
    const config = {
      apiKey: apiKey,
      environment: environment === 'live' ? 'live' : 'test'
    };

    const client = new Client(config);
    this.checkout = new Checkout(client);
    this.payments = new Payments(client);
    this.recurring = new Recurring(client);
    this.modification = new Modification(client);

    this.merchantAccount = merchantAccount;
  }

  async createPayment(paymentData: any) {
    const request = {
      amount: {
        value: Math.round(paymentData.amount * 100),
        currency: paymentData.currency
      },
      paymentMethod: paymentData.paymentMethod,
      reference: paymentData.reference,
      merchantAccount: this.merchantAccount,
      returnUrl: paymentData.returnUrl,
      shopperReference: paymentData.shopperReference,
      shopperEmail: paymentData.shopperEmail,
      shopperIP: paymentData.shopperIP,
      additionalData: paymentData.additionalData
    };

    const response = await this.checkout.paymentsApi.payments(request);
    return response;
  }

  async createPaymentSession(merchantReference: string, amount: number, currency: string, returnUrl: string) {
    const request = {
      amount: {
        value: Math.round(amount * 100),
        currency: currency
      },
      reference: merchantReference,
      merchantAccount: this.merchantAccount,
      returnUrl: returnUrl
    };

    const response = await this.checkout.paymentsApi.paymentSession(request);
    return response;
  }

  async getPaymentDetails(paymentPspReference: string) {
    const response = await this.checkout.paymentsApi.paymentDetails({
      paymentPspReference
    });
    return response;
  }

  async createRecurringPayment(paymentData: any, shopperReference: string) {
    const request = {
      amount: {
        value: Math.round(paymentData.amount * 100),
        currency: paymentData.currency
      },
      paymentMethod: paymentData.paymentMethod,
      reference: paymentData.reference,
      merchantAccount: this.merchantAccount,
      shopperReference: shopperReference,
      recurringProcessingModel: 'Subscription' // or 'CardOnFile'
    };

    const response = await this.payments.paymentsApi.payments(request);
    return response;
  }

  async createToken(paymentData: any, shopperReference: string) {
    const request = {
      paymentMethod: paymentData.paymentMethod,
      merchantAccount: this.merchantAccount,
      shopperReference: shopperReference,
      recurring: {
        contract: 'RECURRING' // or 'ONECLICK'
      }
    };

    const response = await this.recurring.recurringApi.tokens(request);
    return response;
  }

  async disableToken(shopperReference: string, recurringDetailReference: string) {
    const request = {
      merchantAccount: this.merchantAccount,
      shopperReference: shopperReference,
      recurringDetailReference: recurringDetailReference
    };

    const response = await this.recurring.recurringApi.disable(request);
    return response;
  }

  async capturePayment(pspReference: string, amount: number, currency: string) {
    const request = {
      originalReference: pspReference,
      modificationAmount: {
        value: Math.round(amount * 100),
        currency: currency
      },
      merchantAccount: this.merchantAccount
    };

    const response = await this.modification.captureApi.capture(request);
    return response;
  }

  async refundPayment(pspReference: string, amount: number, currency: string) {
    const request = {
      originalReference: pspReference,
      modificationAmount: {
        value: Math.round(amount * 100),
        currency: currency
      },
      merchantAccount: this.merchantAccount
    };

    const response = await this.modification.refundApi.refund(request);
    return response;
  }

  async cancelPayment(pspReference: string) {
    const request = {
      originalReference: pspReference,
      merchantAccount: this.merchantAccount
    };

    const response = await this.modification.cancelApi.cancel(request);
    return response;
  }

  async getAvailablePaymentMethods(merchantReference: string, amount: number, currency: string) {
    const request = {
      merchantAccount: this.merchantAccount,
      shopperReference: merchantReference,
      amount: {
        value: Math.round(amount * 100),
        currency: currency
      },
      channel: 'Web'
    };

    const response = await this.checkout.paymentMethodsApi.paymentMethods(request);
    return response;
  }

  async createPaymentLink(amount: number, currency: string, reference: string, description: string) {
    const request = {
      amount: {
        value: Math.round(amount * 100),
        currency: currency
      },
      reference: reference,
      description: description,
      merchantAccount: this.merchantAccount
    };

    const response = await this.checkout.paymentsApi.paymentLinks(request);
    return response;
  }

  async getPaymentResult(pspReference: string) {
    const response = await this.checkout.paymentsApi.payments({
      merchantAccount: this.merchantAccount,
      pspReference
    });
    return response;
  }
}

export default AdyenService;
