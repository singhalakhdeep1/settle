import { Controller, Get, Post, Body, Param, UseGuards } from '@nestjs/common';
import { SubscriptionsService } from './subscriptions.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@Controller('subscriptions')
@UseGuards(JwtAuthGuard, RolesGuard)
export class SubscriptionsController {
  constructor(private readonly subscriptionsService: SubscriptionsService) {}

  @Post('plans')
  @Roles('admin')
  createPlan(@Body() createPlanDto: any) {
    return this.subscriptionsService.createPlan(createPlanDto);
  }

  @Get('plans')
  getPlans() {
    return this.subscriptionsService.getPlans();
  }

  @Post('subscribe')
  subscribe(@Body() subscribeDto: any) {
    return this.subscriptionsService.subscribe(
      subscribeDto.organizationId,
      subscribeDto.planId,
      subscribeDto.paymentMethodId,
    );
  }

  @Post(':id/cancel')
  cancelSubscription(@Param('id') id: string) {
    return this.subscriptionsService.cancelSubscription(id);
  }

  @Post('usage')
  recordUsage(@Body() usageDto: any) {
    return this.subscriptionsService.recordUsage(
      usageDto.organizationId,
      usageDto.metric,
      usageDto.quantity,
    );
  }

  @Get(':id/usage')
  getUsageReport(
    @Param('id') id: string,
    @Body() reportDto: { startDate: Date; endDate: Date },
  ) {
    return this.subscriptionsService.getUsageReport(
      id,
      reportDto.startDate,
      reportDto.endDate,
    );
  }

  @Post(':id/upgrade')
  upgradeSubscription(
    @Param('id') id: string,
    @Body() upgradeDto: { newPlanId: string },
  ) {
    return this.subscriptionsService.upgradeSubscription(id, upgradeDto.newPlanId);
  }
}
