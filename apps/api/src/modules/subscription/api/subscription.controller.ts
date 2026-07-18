import { Body, Controller, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { SubscriptionPermissionGuard } from './subscription-permission.guard';
import { RequirePermission } from '../../auth/api/guards/permission.guard';
import { CreateSubscriptionDto } from '../application/dto/create-subscription.dto';
import { CancelSubscriptionDto } from '../application/dto/cancel-subscription.dto';
import { CreateSubscriptionHandler } from '../application/handlers/create-subscription.handler';
import { CancelSubscriptionHandler } from '../application/handlers/cancel-subscription.handler';
import { GetSubscriptionHandler } from '../application/handlers/get-subscription.handler';
import { ListSubscriptionsHandler } from '../application/handlers/list-subscriptions.handler';

@Controller('subscriptions')
@UseGuards(SubscriptionPermissionGuard)
export class SubscriptionController {
  constructor(
    private readonly createSubscriptionHandler: CreateSubscriptionHandler,
    private readonly cancelSubscriptionHandler: CancelSubscriptionHandler,
    private readonly getSubscriptionHandler: GetSubscriptionHandler,
    private readonly listSubscriptionsHandler: ListSubscriptionsHandler,
  ) {}

  @Post()
  @RequirePermission('api.subscription', 'create')
  async create(@Body() body: CreateSubscriptionDto, @Req() request: any) {
    const createdBy = request.user?.id ?? '';
    return await this.createSubscriptionHandler.execute({
      customerId: body.customerId,
      plan: body.plan,
      currency: body.currency,
      startDate: body.startDate,
      endDate: body.endDate ?? null,
      autoRenew: body.autoRenew ?? false,
      branchId: body.branchId ?? null,
      createdBy,
    });
  }

  @Post(':subscriptionId/cancel')
  @RequirePermission('api.subscription', 'delete')
  async cancel(@Param('subscriptionId') subscriptionId: string, @Body() body: CancelSubscriptionDto) {
    return await this.cancelSubscriptionHandler.execute({
      subscriptionId,
      canceledBy: body.canceledBy,
    });
  }

  @Get(':subscriptionId')
  @RequirePermission('api.subscription', 'view')
  async get(@Param('subscriptionId') subscriptionId: string) {
    return await this.getSubscriptionHandler.execute({ subscriptionId, branchId: null });
  }

  @Get()
  @RequirePermission('api.subscription', 'view')
  async list(
    @Query('branchId') branchId?: string,
    @Query('customerId') customerId?: string,
    @Query('status') status?: string,
    @Query('plan') plan?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return await this.listSubscriptionsHandler.execute({
      branchId: branchId?.trim() || null,
      customerId: customerId?.trim() || null,
      status: status?.trim() || null,
      plan: plan?.trim() || null,
      limit: Number.isNaN(Number(limit)) ? 50 : Math.max(Number(limit), 1),
      offset: Number.isNaN(Number(offset)) ? 0 : Math.max(Number(offset), 0),
    });
  }
}
