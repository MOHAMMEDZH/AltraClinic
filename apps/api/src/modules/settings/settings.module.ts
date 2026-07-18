import { Module } from '@nestjs/common';

import { TenantScopedAccessGuard } from '../../common/tenant-scoped-access.guard';

import { SubscriptionModule } from '../subscription/subscription.module';

import { SettingsController } from './api/settings.controller';

import { SettingsService } from './application/services/settings.service';

import { TenantPolicyService } from './application/services/tenant-policy.service';

import { SettingsWebhookService } from './application/services/settings-webhook.service';



@Module({

  imports: [SubscriptionModule],

  controllers: [SettingsController],

  providers: [SettingsService, TenantPolicyService, SettingsWebhookService, TenantScopedAccessGuard],

  exports: [SettingsService, TenantPolicyService, SettingsWebhookService],

})

export class SettingsModule {}

