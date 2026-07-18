import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { NotificationController } from './controllers/notification.controller';
import { CreateNotificationHandler } from './application/handlers/create-notification.handler';
import { GetNotificationHandler } from './application/handlers/get-notification.handler';
import { ListNotificationsHandler } from './application/handlers/list-notifications.handler';
import { MarkNotificationReadHandler } from './application/handlers/mark-notification-read.handler';
import {
  ComposeNotificationHandler,
  CreateAutomationRuleHandler,
  CreateNotificationTemplateHandler,
  DeleteAutomationRuleHandler,
  DeleteNotificationHandler,
  DeleteNotificationSavedFilterHandler,
  DeleteNotificationTemplateHandler,
  ExportNotificationsHandler,
  GetNotificationPreferencesHandler,
  GetNotificationsOverviewHandler,
  GetTenantNotificationSettingsHandler,
  GetUnreadNotificationCountHandler,
  ListAutomationRulesHandler,
  ListNotificationDraftsHandler,
  ListNotificationSavedFiltersHandler,
  ListNotificationsPaginatedHandler,
  ListNotificationTemplatesHandler,
  MarkAllNotificationsReadHandler,
  RegisterDeviceTokenHandler,
  RetryNotificationHandler,
  SaveNotificationDraftHandler,
  SaveNotificationFilterHandler,
  SendNotificationDraftHandler,
  TestSendNotificationTemplateHandler,
  UpdateAutomationRuleHandler,
  UpdateNotificationFlagsHandler,
  UpdateNotificationPreferencesHandler,
  UpdateNotificationTemplateHandler,
  UpdateTenantChannelConfigHandler,
} from './application/handlers/notification-enterprise.handlers';
import { PrismaNotificationRepository } from './infrastructure/prisma-notification.repository';
import { AuditTrailNotificationAuditLog } from './infrastructure/audit-trail-notification-audit-log';
import { NotificationPolicyService } from './policies/notification-policy.service';
import { NotificationPermissionGuard } from './api/notification-permission.guard';
import { NOTIFICATION_REPOSITORY } from '../../infrastructure/provider.tokens';
import { DomainEventNotificationListener } from './application/integrations/domain-event-notification.listener';
import { NotificationAutomationListener } from './application/integrations/notification-automation.listener';
import { NotificationAutomationExecutorService } from './application/services/notification-automation.executor';
import { NOTIFICATION_AUDIT_LOG } from './application/ports/notification-audit-log.port';
import { DeliveryModule } from './delivery/delivery.module';

@Module({
  imports: [AuditModule, DeliveryModule],
  controllers: [NotificationController],
  providers: [
    { provide: NOTIFICATION_REPOSITORY, useClass: PrismaNotificationRepository },
    { provide: NOTIFICATION_AUDIT_LOG, useClass: AuditTrailNotificationAuditLog },
    CreateNotificationHandler,
    GetNotificationHandler,
    ListNotificationsHandler,
    MarkNotificationReadHandler,
    GetNotificationsOverviewHandler,
    ListNotificationsPaginatedHandler,
    MarkAllNotificationsReadHandler,
    UpdateNotificationFlagsHandler,
    RetryNotificationHandler,
    DeleteNotificationHandler,
    ExportNotificationsHandler,
    ListNotificationTemplatesHandler,
    CreateNotificationTemplateHandler,
    UpdateNotificationTemplateHandler,
    DeleteNotificationTemplateHandler,
    TestSendNotificationTemplateHandler,
    GetNotificationPreferencesHandler,
    UpdateNotificationPreferencesHandler,
    GetTenantNotificationSettingsHandler,
    UpdateTenantChannelConfigHandler,
    ListAutomationRulesHandler,
    CreateAutomationRuleHandler,
    UpdateAutomationRuleHandler,
    DeleteAutomationRuleHandler,
    ComposeNotificationHandler,
    SaveNotificationDraftHandler,
    ListNotificationDraftsHandler,
    SendNotificationDraftHandler,
    ListNotificationSavedFiltersHandler,
    SaveNotificationFilterHandler,
    DeleteNotificationSavedFilterHandler,
    GetUnreadNotificationCountHandler,
    RegisterDeviceTokenHandler,
    NotificationPolicyService,
    NotificationPermissionGuard,
    DomainEventNotificationListener,
    NotificationAutomationExecutorService,
    NotificationAutomationListener,
  ],
  exports: [
    NOTIFICATION_REPOSITORY,
    CreateNotificationHandler,
    NotificationAutomationExecutorService,
    DeliveryModule,
  ],
})
export class NotificationModule {}
