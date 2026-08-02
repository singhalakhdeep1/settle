// Plaid integration for settle

import { Configuration, PlaidApi, PlaidEnvironments } from 'plaid';

class PlaidService {
  private client: PlaidApi;

  constructor(clientId: string, secret: string, environment = 'sandbox') {
    const configuration = new Configuration({
      basePath: environment === 'sandbox' 
        ? PlaidEnvironments.sandbox 
        : environment === 'development' 
          ? PlaidEnvironments.development 
          : PlaidEnvironments.production,
      baseOptions: {
        headers: {
          'PLAID-CLIENT-ID': clientId,
          'PLAID-SECRET': secret
        }
      }
    });

    this.client = new PlaidApi(configuration);
  }

  async createLinkToken(user: any, products: string[] = ['transactions']) {
    const request = {
      user: {
        client_user_id: user.id,
        email: user.email,
        name: user.name
      },
      client_name: 'Settle Payment Platform',
      products: products as any,
      country_codes: ['US'],
      language: 'en',
      webhook: user.webhookUrl
    };

    const response = await this.client.linkTokenCreate(request);
    return response.data;
  }

  async exchangePublicToken(publicToken: string) {
    const request = {
      public_token: publicToken
    };

    const response = await this.client.itemPublicTokenExchange(request);
    return response.data;
  }

  async getAccessToken(itemId: string) {
    // Note: In production, store access tokens securely
    // This is a placeholder for the stored access token
    throw new Error('Access token should be stored securely in your database');
  }

  async getTransactions(accessToken: string, startDate: string, endDate: string) {
    const request = {
      access_token: accessToken,
      start_date: startDate,
      end_date: endDate
    };

    const response = await this.client.transactionsGet(request);
    return response.data;
  }

  async getAccounts(accessToken: string) {
    const request = {
      access_token: accessToken
    };

    const response = await this.client.accountsGet(request);
    return response.data;
  }

  async getBalance(accessToken: string) {
    const request = {
      access_token: accessToken
    };

    const response = await this.client.accountsBalanceGet(request);
    return response.data;
  }

  async getAuth(accessToken: string) {
    const request = {
      access_token: accessToken
    };

    const response = await this.client.authGet(request);
    return response.data;
  }

  async getIdentity(accessToken: string) {
    const request = {
      access_token: accessToken
    };

    const response = await this.client.identityGet(request);
    return response.data;
  }

  async getIncome(accessToken: string) {
    const request = {
      access_token: accessToken
    };

    const response = await this.client.incomeGet(request);
    return response.data;
  }

  async getInvestments(accessToken: string) {
    const request = {
      access_token: accessToken
    };

    const response = await this.client.investmentsHoldingsGet(request);
    return response.data;
  }

  async getLiabilities(accessToken: string) {
    const request = {
      access_token: accessToken
    };

    const response = await this.client.liabilitiesGet(request);
    return response.data;
  }

  async createProcessorToken(accessToken: string, accountId: string) {
    const request = {
      access_token: accessToken,
      account_id: accountId,
      processor: 'stripe' // or 'dwolla', 'wyre', etc.
    };

    const response = await this.client.processorTokenCreate(request);
    return response.data;
  }

  async removeItem(accessToken: string) {
    const request = {
      access_token: accessToken
    };

    const response = await this.client.itemRemove(request);
    return response.data;
  }

  async getWebhookVerificationKey(keyId:string) {
    const response = await this.client.webhookVerificationKeyGet({ key_id: keyId });
    return response.data;
  }

  async verifyWebhookSignature(webhookUrl: string, body: any, signatureHeader: string) {
    // Implement webhook signature verification
    // This is a simplified version
    return true;
  }
}

export default PlaidService;
