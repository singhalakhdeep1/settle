import { Processor, Process, OnQueueActive, OnQueueFailed } from '@nestjs/bull';
import { Job } from 'bull';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Subscription, SubscriptionPlan, SubscriptionUsage } from '@payflow/database';
import { Logger } from '@nestjs/common';

@Processor('subscriptions')
export class SubscriptionProcessor {
  private readonly logger = new Logger(SubscriptionProcessor.name);

  constructor(
    @InjectRepository(Subscription)
    private subscriptionRepository: Repository<Subscription>,
    @InjectRepository(SubscriptionPlan)
    private planRepository: Repository<SubscriptionPlan>,
    @InjectRepository(SubscriptionUsage)
    private usageRepository: Repository<SubscriptionUsage>,
  ) {}

  @Process('check-usage-limits')
  async handleUsageCheck(job: Job) {
    const { subscriptionId } = job.data;
    this.logger.log(`Checking usage limits for subscription ${subscriptionId}`);

    const subscription = await this.subscriptionRepository.findOne({
      where: { id: subscriptionId },
      relations: ['plan'],
    });

    if (!subscription) return;

    const currentMonth = new Date();
    currentMonth.setDate(1);
    currentMonth.setHours(0, 0, 0, 0);

    const usage = await this.usageRepository
      .createQueryBuilder('usage')
      .select('usage.metric, SUM(usage.quantity) as total')
      .where('usage.subscriptionId = :subscriptionId', { subscriptionId })
      .andWhere('usage.timestamp >= :startDate', { startDate: currentMonth })
      .groupBy('usage.metric')
      .getRawMany();

    const plan = subscription.plan;
    const limits = plan.limits || {};

    for (const item of usage) {
      const limit = limits[item.metric];
      if (limit && item.total > limit) {
        this.logger.warn(
          `Usage limit exceeded for ${item.metric}: ${item.total}/${limit}`,
        );
        // Send notification or take action
      }
    }
  }

  @Process('handle-webhook')
  async handleWebhook(job: Job) {
    const { event } = job.data;
    this.logger.log(`Processing webhook event: ${event.type}`);

    switch (event.type) {
      case 'invoice.payment_succeeded':
        await this.handlePaymentSucceeded(event.data.object);
        break;
      case 'invoice.payment_failed':
        await this.handlePaymentFailed(event.data.object);
        break;
      case 'customer.subscription.deleted':
        await this.handleSubscriptionDeleted(event.data.object);
        break;
    }
  }

  private async handlePaymentSucceeded(invoice: any) {
    const subscription = await this.subscriptionRepository.findOne({
      where: { stripeSubscriptionId: invoice.subscription },
    });
    if (subscription) {
      subscription.status = 'active';
      await this.subscriptionRepository.save(subscription);
    }
  }

  private async handlePaymentFailed(invoice: any) {
    const subscription = await this.subscriptionRepository.findOne({
      where: { stripeSubscriptionId: invoice.subscription },
    });
    if (subscription) {
      subscription.status = 'past_due';
      await this.subscriptionRepository.save(subscription);
    }
  }

  private async handleSubscriptionDeleted(subscription: any) {
    const sub = await this.subscriptionRepository.findOne({
      where: { stripeSubscriptionId: subscription.id },
    });
    if (sub) {
      sub.status = 'canceled';
      sub.canceledAt = new Date();
      await this.subscriptionRepository.save(sub);
    }
  }

  @OnQueueActive()
  onActive(job: Job) {
    this.logger.debug(`Processing job ${job.id} of type ${job.name}`);
  }

  @OnQueueFailed()
  onError(job: Job, error: Error) {
    this.logger.error(
      `Failed job ${job.id} of type ${job.name}: ${error.message}`,
    );
  }
}
