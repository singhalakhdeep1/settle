import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SubscriptionsService } from './subscriptions.service';
import { SubscriptionsController } from './subscriptions.controller';
import { Subscription, SubscriptionPlan, SubscriptionUsage } from '@payflow/database';
import { StripeModule } from '../stripe/stripe.module';
import { OrganizationsModule } from '../organizations/organizations.module';
import { BullModule } from '@nestjs/bull';
import { SubscriptionProcessor } from './subscriptions.processor';

@Module({
  imports: [
    TypeOrmModule.forFeature([Subscription, SubscriptionPlan, SubscriptionUsage]),
    StripeModule,
    OrganizationsModule,
    BullModule.registerQueue({
      name: 'subscriptions',
    }),
  ],
  controllers: [SubscriptionsController],
  providers: [SubscriptionsService, SubscriptionProcessor],
  exports: [SubscriptionsService],
})
export class SubscriptionsModule {}
