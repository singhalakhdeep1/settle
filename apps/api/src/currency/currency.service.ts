import { Injectable } from '@nestjs/common';
import { Cache } from 'cache-manager';

interface ExchangeRate {
  from: string;
  to: string;
  rate: number;
  timestamp: Date;
}

@Injectable()
export class CurrencyService {
  private rates: Map<string, ExchangeRate> = new Map();
  private readonly CACHE_TTL = 3600000; // 1 hour

  constructor() {
    // Initialize with some default rates
    this.setRate('USD', 'EUR', 0.85);
    this.setRate('USD', 'GBP', 0.73);
    this.setRate('USD', 'JPY', 110.0);
    this.setRate('EUR', 'USD', 1.18);
    this.setRate('GBP', 'USD', 1.37);
    this.setRate('JPY', 'USD', 0.0091);
  }

  setRate(from: string, to: string, rate: number) {
    const key = `${from}-${to}`;
    this.rates.set(key, {
      from,
      to,
      rate,
      timestamp: new Date(),
    });
  }

  getRate(from: string, to: string): number | null {
    const key = `${from}-${to}`;
    const rate = this.rates.get(key);

    if (!rate) return null;

    // Check if rate is stale (older than 1 hour)
    const age = Date.now() - rate.timestamp.getTime();
    if (age > this.CACHE_TTL) {
      this.rates.delete(key);
      return null;
    }

    return rate.rate;
  }

  async convert(amount: number, from: string, to: string): Promise<number> {
    if (from === to) return amount;

    const rate = this.getRate(from, to);
    if (!rate) {
      // In production, fetch from external API like Fixer.io or Open Exchange Rates
      throw new Error(`Exchange rate not available for ${from} to ${to}`);
    }

    return amount * rate;
  }

  async convertWithPrecision(
    amount: number,
    from: string,
    to: string,
    precision: number = 2,
  ): Promise<number> {
    const converted = await this.convert(amount, from, to);
    return Number(converted.toFixed(precision));
  }

  getSupportedCurrencies(): string[] {
    return ['USD', 'EUR', 'GBP', 'JPY', 'CAD', 'AUD', 'CHF', 'CNY'];
  }

  formatAmount(amount: number, currency: string): string {
    const formatter = new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency,
    });
    return formatter.format(amount);
  }
}
