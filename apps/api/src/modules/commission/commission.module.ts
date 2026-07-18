import { Module } from '@nestjs/common';
import { CommissionController } from './controllers/commission.controller';
import { CalculateCommissionHandler } from './application/handlers/calculate-commission.handler';
import { ApproveCommissionHandler } from './application/handlers/approve-commission.handler';
import { PayCommissionHandler } from './application/handlers/pay-commission.handler';
import { DisputeCommissionHandler } from './application/handlers/dispute-commission.handler';
import { GetCommissionHandler } from './application/handlers/get-commission.handler';
import { ListCommissionsHandler } from './application/handlers/list-commissions.handler';
import { PrismaCommissionRepository } from './infrastructure/prisma-commission.repository';
import { PrismaCommissionRuleRepository } from './infrastructure/prisma-commission-rule.repository';
import { CommissionPolicyService } from './policies/commission-policy.service';
import { CommissionPermissionGuard } from './api/commission-permission.guard';
import { COMMISSION_REPOSITORY, COMMISSION_RULE_REPOSITORY } from '../../infrastructure/provider.tokens';
import { CommissionRuleService } from './domain/services/commission-rule.service';
import { CreateCommissionRuleHandler } from './application/handlers/create-commission-rule.handler';
import { ListCommissionRulesHandler } from './application/handlers/list-commission-rules.handler';
import { CalculateCommissionFromInvoicesHandler } from './application/handlers/calculate-commission-from-invoices.handler';

@Module({
  controllers: [CommissionController],
  providers: [
    { provide: COMMISSION_REPOSITORY, useClass: PrismaCommissionRepository },
    { provide: COMMISSION_RULE_REPOSITORY, useClass: PrismaCommissionRuleRepository },
    CalculateCommissionHandler,
    CreateCommissionRuleHandler,
    ApproveCommissionHandler,
    PayCommissionHandler,
    DisputeCommissionHandler,
    GetCommissionHandler,
    ListCommissionsHandler,
    ListCommissionRulesHandler,
    CalculateCommissionFromInvoicesHandler,
    CommissionRuleService,
    CommissionPolicyService,
    CommissionPermissionGuard,
  ],
})
export class CommissionModule {}
