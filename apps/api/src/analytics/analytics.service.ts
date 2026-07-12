import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Payment, Organization } from '@payflow/database';

interface AnalyticsMetrics {
  totalRevenue: number;
  totalTransactions: number;
  averageTransactionValue: number;
  successRate: number;
  revenueByPeriod: { period: string; revenue: number }[];
  topPaymentMethods: { method: string; count: number; amount: number }[];
  revenueByCountry: { country: string; amount: number }[];
}

@Injectable()
export class AnalyticsService {
  constructor(
    @InjectRepository(Payment)
    private paymentRepository: Repository<Payment>,
    @InjectRepository(Organization)
    private organizationRepository: Repository<Organization>,
  ) {}

  async getOrganizationMetrics(
    organizationId: string,
    startDate?: Date,
    endDate?: Date,
  ): Promise<AnalyticsMetrics> {
    const query = this.paymentRepository
      .createQueryBuilder('payment')
      .where('payment.organizationId = :organizationId', { organizationId });

    if (startDate) {
      query.andWhere('payment.createdAt >= :startDate', { startDate });
    }

    if (endDate) {
      query.andWhere('payment.createdAt <= :endDate', { endDate });
    }

    const payments = await query.getMany();

    const totalRevenue = payments
      .filter((p) => p.status === 'succeeded')
      .reduce((sum, p) => sum + Number(p.amount), 0);

    const totalTransactions = payments.length;
    const successfulTransactions = payments.filter(
      (p) => p.status === 'succeeded',
    ).length;

    return {
      totalRevenue,
      totalTransactions,
      averageTransactionValue: totalTransactions > 0 ? totalRevenue / totalTransactions : 0,
      successRate: totalTransactions > 0 ? (successfulTransactions / totalTransactions) * 100 : 0,
      revenueByPeriod: await this.getRevenueByPeriod(organizationId, startDate, endDate),
      topPaymentMethods: await this.getTopPaymentMethods(organizationId, startDate, endDate),
      revenueByCountry: await this.getRevenueByCountry(organizationId, startDate, endDate),
    };
  }

  private async getRevenueByPeriod(
    organizationId: string,
    startDate?: Date,
    endDate?: Date,
  ) {
    const query = this.paymentRepository
      .createQueryBuilder('payment')
      .select("DATE_TRUNC('day', payment.createdAt) as period, SUM(payment.amount) as revenue")
      .where('payment.organizationId = :organizationId', { organizationId })
      .andWhere('payment.status = :status', { status: 'succeeded' });

    if (startDate) {
      query.andWhere('payment.createdAt >= :startDate', { startDate });
    }

    if (endDate) {
      query.andWhere('payment.createdAt <= :endDate', { endDate });
    }

    query.groupBy("DATE_TRUNC('day', payment.createdAt)");
    query.orderBy('period', 'ASC');

    const results = await query.getRawMany();
    return results.map((r) => ({
      period: r.period,
      revenue: Number(r.revenue),
    }));
  }

  private async getTopPaymentMethods(
    organizationId: string,
    startDate?: Date,
    endDate?: Date,
  ) {
    const query = this.paymentRepository
      .createQueryBuilder('payment')
      .select('payment.paymentMethod, COUNT(*) as count, SUM(payment.amount) as amount')
      .where('payment.organizationId = :organizationId', { organizationId })
      .andWhere('payment.status = :status', { status: 'succeeded' });

    if (startDate) {
      query.andWhere('payment.createdAt >= :startDate', { startDate });
    }

    if (endDate) {
      query.andWhere('payment.createdAt <= :endDate', { endDate });
    }

    query.groupBy('payment.paymentMethod');
    query.orderBy('amount', 'DESC');
    query.limit(5);

    const results = await query.getRawMany();
    return results.map((r) => ({
      method: r.paymentMethod,
      count: parseInt(r.count),
      amount: Number(r.amount),
    }));
  }

  private async getRevenueByCountry(
    organizationId: string,
    startDate?: Date,
    endDate?: Date,
  ) {
    const query = this.paymentRepository
      .createQueryBuilder('payment')
      .select('payment.country, SUM(payment.amount) as amount')
      .where('payment.organizationId = :organizationId', { organizationId })
      .andWhere('payment.status = :status', { status: 'succeeded' });

    if (startDate) {
      query.andWhere('payment.createdAt >= :startDate', { startDate });
    }

    if (endDate) {
      query.andWhere('payment.createdAt <= :endDate', { endDate });
    }

    query.groupBy('payment.country');
    query.orderBy('amount', 'DESC');

    const results = await query.getRawMany();
    return results.map((r) => ({
      country: r.country,
      amount: Number(r.amount),
    }));
  }

  async getRealTimeMetrics(organizationId: string) {
    const now = new Date();
    const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    return this.getOrganizationMetrics(organizationId, twentyFourHoursAgo, now);
  }
}
