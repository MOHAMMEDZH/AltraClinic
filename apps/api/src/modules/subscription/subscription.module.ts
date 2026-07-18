import { Module } from '@nestjs/common';
import { TenantScopedAccessGuard } from '../../common/tenant-scoped-access.guard';
import { PlatformAdminModule } from '../platform-admin/platform-admin.module';
import { InfrastructureModule } from '../../infrastructure/infrastructure.module';
import { SubscriptionController } from './api/subscription.controller';
import { TenantSubscriptionController } from './api/tenant-subscription.controller';
import { SubscriptionPolicy } from './policies/subscription-policy.service';
import { SubscriptionPermissionGuard } from './api/subscription-permission.guard';
import { CreateSubscriptionHandler } from './application/handlers/create-subscription.handler';
import { CancelSubscriptionHandler } from './application/handlers/cancel-subscription.handler';
import { GetSubscriptionHandler } from './application/handlers/get-subscription.handler';
import { ListSubscriptionsHandler } from './application/handlers/list-subscriptions.handler';
import {
  ChangeTenantSubscriptionPlanHandler,
  GetTenantEntitlementsHandler,
  GetTenantLicenseHandler,
  GetTenantSubscriptionHandler,
  GetTenantSubscriptionPaymentsHandler,
  GetTenantSubscriptionUsageHandler,
  GrantTenantEntitlementsHandler,
  GrantTenantTrialHandler,
  ListTenantSubscriptionPlansHandler,
  PreviewTenantPlanChangeHandler,
} from './application/handlers/tenant-subscription.handlers';
import { TenantSubscriptionService } from './application/services/tenant-subscription.service';
import { LicensingEngineService } from './application/services/licensing-engine.service';
import { PrismaSubscriptionRepository } from './infrastructure/prisma-subscription.repository';
import { SubscriptionEnforcementService } from './application/services/subscription-enforcement.service';
import { LicensedModuleGuard } from './api/guards/licensed-module.guard';
import { ApiRateLimitGuard } from './api/guards/api-rate-limit.guard';
import { LicensingAuditService } from './application/services/licensing-audit.service';
import { LicensingExecutionGuard } from './application/services/licensing-execution.guard';
import { CommunicationDispatchService } from './application/services/communication-dispatch.service';
import { ApiRateLimitService } from './application/services/api-rate-limit.service';
import { LicensingCommercialAuditService } from './application/services/licensing-commercial-audit.service';
import { LicensingLifecycleStateService } from './application/services/licensing-lifecycle-state.service';
import { LicensingCommercialAuditListener } from './application/listeners/licensing-commercial-audit.listener';
import { SUBSCRIPTION_REPOSITORY } from '../../infrastructure/provider.tokens';

@Module({
  imports: [PlatformAdminModule, InfrastructureModule],
  controllers: [SubscriptionController, TenantSubscriptionController],
  providers: [
    TenantScopedAccessGuard,
    SubscriptionPolicy,
    SubscriptionPermissionGuard,
    CreateSubscriptionHandler,
    CancelSubscriptionHandler,
    GetSubscriptionHandler,
    ListSubscriptionsHandler,
    TenantSubscriptionService,
    LicensingEngineService,
    GetTenantSubscriptionHandler,
    GetTenantLicenseHandler,
    GetTenantEntitlementsHandler,
    PreviewTenantPlanChangeHandler,
    ListTenantSubscriptionPlansHandler,
    GetTenantSubscriptionUsageHandler,
    GetTenantSubscriptionPaymentsHandler,
    ChangeTenantSubscriptionPlanHandler,
    GrantTenantEntitlementsHandler,
    GrantTenantTrialHandler,
    { provide: SUBSCRIPTION_REPOSITORY, useClass: PrismaSubscriptionRepository },
    SubscriptionEnforcementService,
    LicensedModuleGuard,
    ApiRateLimitGuard,
    LicensingAuditService,
    LicensingExecutionGuard,
    CommunicationDispatchService,
    ApiRateLimitService,
    LicensingCommercialAuditService,
    LicensingLifecycleStateService,
    LicensingCommercialAuditListener,
  ],
  exports: [
    SUBSCRIPTION_REPOSITORY,
    SubscriptionEnforcementService,
    LicensingEngineService,
    TenantSubscriptionService,
    LicensedModuleGuard,
    ApiRateLimitGuard,
    LicensingAuditService,
    LicensingExecutionGuard,
    CommunicationDispatchService,
    ApiRateLimitService,
    LicensingCommercialAuditService,
    LicensingLifecycleStateService,
  ],
})
export class SubscriptionModule {}
