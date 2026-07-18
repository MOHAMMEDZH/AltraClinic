import { Module } from '@nestjs/common';
import { LoyaltyController } from './controllers/loyalty.controller';
import { CreateLoyaltyAccountHandler } from './application/handlers/create-loyalty-account.handler';
import { EarnLoyaltyPointsHandler } from './application/handlers/earn-loyalty-points.handler';
import { RedeemLoyaltyPointsHandler } from './application/handlers/redeem-loyalty-points.handler';
import { CreateLoyaltyRewardHandler } from './application/handlers/create-loyalty-reward.handler';
import { SuspendLoyaltyAccountHandler } from './application/handlers/suspend-loyalty-account.handler';
import { ReactivateLoyaltyAccountHandler } from './application/handlers/reactivate-loyalty-account.handler';
import { GetLoyaltyAccountHandler } from './application/handlers/get-loyalty-account.handler';
import { ListLoyaltyRewardsHandler } from './application/handlers/list-loyalty-rewards.handler';
import { PrismaLoyaltyAccountRepository } from './infrastructure/prisma-loyalty-account.repository';
import { PrismaLoyaltyRewardRepository } from './infrastructure/prisma-loyalty-reward.repository';
import { LoyaltyPolicyService } from './policies/loyalty-policy.service';
import { LoyaltyPermissionGuard } from './api/loyalty-permission.guard';
import { LOYALTY_ACCOUNT_REPOSITORY, LOYALTY_REWARD_REPOSITORY } from '../../infrastructure/provider.tokens';
import { LoyaltyTierService } from './domain/services/loyalty-tier.service';
import { SubscriptionModule } from '../subscription/subscription.module';

@Module({
  imports: [SubscriptionModule],
  controllers: [LoyaltyController],
  providers: [
    { provide: LOYALTY_ACCOUNT_REPOSITORY, useClass: PrismaLoyaltyAccountRepository },
    { provide: LOYALTY_REWARD_REPOSITORY, useClass: PrismaLoyaltyRewardRepository },
    CreateLoyaltyAccountHandler,
    EarnLoyaltyPointsHandler,
    RedeemLoyaltyPointsHandler,
    CreateLoyaltyRewardHandler,
    SuspendLoyaltyAccountHandler,
    ReactivateLoyaltyAccountHandler,
    GetLoyaltyAccountHandler,
    ListLoyaltyRewardsHandler,
    LoyaltyTierService,
    LoyaltyPolicyService,
    LoyaltyPermissionGuard,
  ],
  exports: [EarnLoyaltyPointsHandler],
})
export class LoyaltyModule {}
