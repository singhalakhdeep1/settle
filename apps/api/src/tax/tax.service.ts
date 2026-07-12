import { Injectable } from '@nestjs/common';

interface TaxRate {
  country: string;
  state?: string;
  rate: number;
  type: 'vat' | 'sales' | 'gst';
}

interface TaxCalculation {
  amount: number;
  currency: string;
  country: string;
  state?: string;
  taxRate: number;
  taxAmount: number;
  total: number;
  breakdown: {
    country: string;
    rate: number;
    amount: number;
  }[];
}

@Injectable()
export class TaxService {
  private taxRates: TaxRate[] = [
    { country: 'US', rate: 0, type: 'sales' }, // Sales tax varies by state
    { country: 'US', state: 'CA', rate: 0.0725, type: 'sales' },
    { country: 'US', state: 'NY', rate: 0.08875, type: 'sales' },
    { country: 'US', state: 'TX', rate: 0.0625, type: 'sales' },
    { country: 'GB', rate: 0.20, type: 'vat' },
    { country: 'DE', rate: 0.19, type: 'vat' },
    { country: 'FR', rate: 0.20, type: 'vat' },
    { country: 'CA', rate: 0.05, type: 'gst' },
    { country: 'CA', state: 'ON', rate: 0.13, type: 'gst' },
    { country: 'AU', rate: 0.10, type: 'gst' },
    { country: 'IN', rate: 0.18, type: 'gst' },
    { country: 'JP', rate: 0.10, type: 'sales' },
  ];

  getTaxRate(country: string, state?: string): number {
    const rate = this.taxRates.find(
      (r) => r.country === country && (!state || r.state === state),
    );
    return rate ? rate.rate : 0;
  }

  calculateTax(
    amount: number,
    country: string,
    state?: string,
  ): TaxCalculation {
    const taxRate = this.getTaxRate(country, state);
    const taxAmount = amount * taxRate;
    const total = amount + taxAmount;

    return {
      amount,
      currency: this.getCurrencyForCountry(country),
      country,
      state,
      taxRate,
      taxAmount,
      total,
      breakdown: [
        {
          country: country + (state ? `-${state}` : ''),
          rate: taxRate,
          amount: taxAmount,
        },
      ],
    };
  }

  calculateTaxForLineItems(
    lineItems: { amount: number; country: string; state?: string }[],
  ): TaxCalculation {
    let totalAmount = 0;
    let totalTax = 0;
    const breakdown: TaxCalculation['breakdown'] = [];

    for (const item of lineItems) {
      const calc = this.calculateTax(item.amount, item.country, item.state);
      totalAmount += item.amount;
      totalTax += calc.taxAmount;
      breakdown.push(...calc.breakdown);
    }

    return {
      amount: totalAmount,
      currency: 'USD',
      country: 'MULTI',
      taxRate: totalTax / totalAmount,
      taxAmount: totalTax,
      total: totalAmount + totalTax,
      breakdown,
    };
  }

  isTaxExempt(customerType: string, country: string): boolean {
    // Some customer types are tax-exempt in certain jurisdictions
    const exemptTypes = ['government', 'charity', 'reseller'];
    return exemptTypes.includes(customerType.toLowerCase());
  }

  getCurrencyForCountry(country: string): string {
    const currencyMap: Record<string, string> = {
      US: 'USD',
      GB: 'GBP',
      DE: 'EUR',
      FR: 'EUR',
      CA: 'CAD',
      AU: 'AUD',
      IN: 'INR',
      JP: 'JPY',
    };
    return currencyMap[country] || 'USD';
  }

  getSupportedCountries(): string[] {
    return [...new Set(this.taxRates.map((r) => r.country))];
  }
}
