import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { LoyaltyPermissionGuard } from '../api/loyalty-permission.guard';
import { RequirePermission } from '../../auth/api/guards/permission.guard';
import { RequireLicensedModule } from '../../subscription/api/decorators/require-licensed-module.decorator';
import { CreateLoyaltyAccountDto } from '../application/dto/create-loyalty-account.dto';
import { EarnLoyaltyPointsDto } from '../application/dto/earn-loyalty-points.dto';
import { RedeemLoyaltyPointsDto } from '../application/dto/redeem-loyalty-points.dto';
import { CreateLoyaltyRewardDto } from '../application/dto/create-loyalty-reward.dto';
import { CreateLoyaltyAccountHandler } from '../application/handlers/create-loyalty-account.handler';
import { EarnLoyaltyPointsHandler } from '../application/handlers/earn-loyalty-points.handler';
import { RedeemLoyaltyPointsHandler } from '../application/handlers/redeem-loyalty-points.handler';
import { CreateLoyaltyRewardHandler } from '../application/handlers/create-loyalty-reward.handler';
import { SuspendLoyaltyAccountHandler } from '../application/handlers/suspend-loyalty-account.handler';
import { ReactivateLoyaltyAccountHandler } from '../application/handlers/reactivate-loyalty-account.handler';
import { GetLoyaltyAccountHandler } from '../application/handlers/get-loyalty-account.handler';
import { ListLoyaltyRewardsHandler } from '../application/handlers/list-loyalty-rewards.handler';
import { GetLoyaltyAccountCommand } from '../application/commands/get-loyalty-account.command';
import { ListLoyaltyRewardsCommand } from '../application/commands/list-loyalty-rewards.command';

@Controller('loyalty')
@UseGuards(LoyaltyPermissionGuard)
@RequireLicensedModule('loyalty')
export class LoyaltyController {
  constructor(
    private readonly createAccountHandler: CreateLoyaltyAccountHandler,
    private readonly earnPointsHandler: EarnLoyaltyPointsHandler,
    private readonly redeemPointsHandler: RedeemLoyaltyPointsHandler,
    private readonly createRewardHandler: CreateLoyaltyRewardHandler,
    private readonly suspendAccountHandler: SuspendLoyaltyAccountHandler,
    private readonly reactivateAccountHandler: ReactivateLoyaltyAccountHandler,
    private readonly getAccountHandler: GetLoyaltyAccountHandler,
    private readonly listRewardsHandler: ListLoyaltyRewardsHandler,
  ) {}

  @Post('accounts')
  @RequirePermission('api.loyalty', 'create')
  async createAccount(@Body() body: CreateLoyaltyAccountDto) {
    return await this.createAccountHandler.execute({
      patientId: body.patientId,
      clinicId: body.clinicId,
      initialPoints: body.initialPoints,
    });
  }

  @Get('accounts/:accountId')
  @RequirePermission('api.loyalty', 'view')
  async getAccount(@Param('accountId') accountId: string) {
    return await this.getAccountHandler.execute(new GetLoyaltyAccountCommand(accountId));
  }

  @Post('accounts/:accountId/earn')
  @RequirePermission('api.loyalty', 'update')
  async earnPoints(@Param('accountId') accountId: string, @Body() body: EarnLoyaltyPointsDto) {
    return await this.earnPointsHandler.execute({
      accountId,
      pointsToEarn: body.pointsToEarn,
      reference: body.reference,
      description: body.description,
    });
  }

  @Post('accounts/:accountId/redeem')
  @RequirePermission('api.loyalty', 'update')
  async redeemPoints(@Param('accountId') accountId: string, @Body() body: RedeemLoyaltyPointsDto) {
    return await this.redeemPointsHandler.execute({
      accountId,
      pointsToRedeem: body.pointsToRedeem,
      rewardId: body.rewardId,
      reference: body.reference,
    });
  }

  @Post('accounts/:accountId/suspend')
  @RequirePermission('api.loyalty', 'approve')
  async suspendAccount(@Param('accountId') accountId: string) {
    return await this.suspendAccountHandler.execute({ accountId });
  }

  @Post('accounts/:accountId/reactivate')
  @RequirePermission('api.loyalty', 'approve')
  async reactivateAccount(@Param('accountId') accountId: string) {
    return await this.reactivateAccountHandler.execute({ accountId });
  }

  @Post('rewards')
  @RequirePermission('api.loyalty', 'create')
  async createReward(@Body() body: CreateLoyaltyRewardDto) {
    return await this.createRewardHandler.execute({
      accountId: body.accountId,
      pointsRequired: body.pointsRequired,
      description: body.description,
      expiryDate: body.expiryDate,
    });
  }

  @Get('rewards')
  @RequirePermission('api.loyalty', 'view')
  async listRewards(
    @Query('accountId') accountId?: string,
    @Query('onlyAvailable') onlyAvailable?: string,
  ) {
    return await this.listRewardsHandler.execute(
      new ListLoyaltyRewardsCommand(accountId?.trim() || null, String(onlyAvailable).toLowerCase() === 'true'),
    );
  }
}
