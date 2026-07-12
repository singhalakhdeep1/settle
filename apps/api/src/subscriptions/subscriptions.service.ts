import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Subscription, SubscriptionPlan, SubscriptionUsage } from '@payflow/database';
import { StripeService } from '../stripe/stripe.service';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';

@Injectable()
export class SubscriptionsService {
  constructor(
    @InjectRepository(Subscription)
    private subscriptionRepository: Repository<Subscription>,
    @InjectRepository(SubscriptionPlan)
    private planRepository: Repository<SubscriptionPlan>,
    @InjectRepository(SubscriptionUsage)
    private usageRepository: Repository<SubscriptionUsage>,
    private stripeService: StripeService,
    @InjectQueue('subscriptions')
    private subscriptionQueue: Queue,
  ) {}

  async createPlan(createPlanDto: any) {
    const stripePrice = await this.stripeService.createPrice(
      createPlanDto.price,
      createPlanDto.currency,
      createPlanDto.interval,
    );

    const plan = this.planRepository.create({
      ...createPlanDto,
      stripePriceId: stripePrice.id,
    });

    return this.planRepository.save(plan);
  }

  async getPlans() {
    return this.planRepository.find({ where: { isActive: true } });
  }

  async subscribe(organizationId: string, planId: string, paymentMethodId: string) {
    const plan = await this.planRepository.findOne({ where: { id: planId } });
    if (!plan) throw new NotFoundException('Plan not found');

    const stripeSubscription = await this.stripeService.createSubscription(
      paymentMethodId,
      plan.stripePriceId,
    );

    const subscription = this.subscriptionRepository.create({
      organizationId,
      planId,
      stripeSubscriptionId: stripeSubscription.id,
      status: stripeSubscription.status,
      currentPeriodStart: new Date(stripeSubscription.current_period_start * 1000),
      currentPeriodEnd: new Date(stripeSubscription.current_period_end * 1000),
    });

    return this.subscriptionRepository.save(subscription);
  }

  async cancelSubscription(subscriptionId: string) {
    const subscription = await this.subscriptionRepository.findOne({
      where: { id: subscriptionId },
    });
    if (!subscription) throw new NotFoundException('Subscription not found');

    await this.stripeService.cancelSubscription(subscription.stripeSubscriptionId);

    subscription.status = 'canceled';
    subscription.canceledAt = new Date();
    return this.subscriptionRepository.save(subscription);
  }

  async recordUsage(organizationId: string, metric: string, quantity: number) {
    const subscription = await this.subscriptionRepository.findOne({
      where: { organizationId, status: 'active' },
    });
    if (!subscription) throw new NotFoundException('Active subscription not found');

    const usage = this.usageRepository.create({
      subscriptionId: subscription.id,
      metric,
      quantity,
      timestamp: new Date(),
    });

    await this.usageRepository.save(usage);

    // Check if usage exceeds limits
    await this.subscriptionQueue.add('check-usage-limits', {
      subscriptionId: subscription.id,
    });
  }

  async getUsageReport(subscriptionId: string, startDate: Date, endDate: Date) {
    return this.usageRepository.find({
      where: {
        subscriptionId,
        timestamp: { between: [startDate, endDate] },
      },
    });
  }

  async upgradeSubscription(subscriptionId: string, newPlanId: string) {
    const subscription = await this.subscriptionRepository.findOne({
      where: { id: subscriptionId },
    });
    const newPlan = await this.planRepository.findOne({ where: { id: newPlanId } });

    if (!subscription || !newPlan) {
      throw new NotFoundException('Subscription or plan not found');
    }

    await this.stripeService.updateSubscription(
      subscription.stripeSubscriptionId,
      newPlan.stripePriceId,
    );

    subscription.planId = newPlanId;
    return this.subscriptionRepository.save(subscription);
  }
}
