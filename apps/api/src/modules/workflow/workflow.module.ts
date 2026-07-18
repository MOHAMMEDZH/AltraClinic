import { Module, forwardRef } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { NotificationModule } from '../notifications/notifications.module';
import { RealtimeModule } from '../realtime/realtime.module';
import { SubscriptionModule } from '../subscription/subscription.module';
import { WorkflowController } from './api/workflow.controller';
import { WorkflowPolicy } from './policies/workflow-policy.service';
import { WorkflowPermissionGuard } from './api/workflow-permission.guard';
import { CreateWorkflowHandler } from './application/handlers/create-workflow.handler';
import { AdvanceWorkflowHandler } from './application/handlers/advance-workflow.handler';
import { CancelWorkflowHandler } from './application/handlers/cancel-workflow.handler';
import { GetWorkflowHandler } from './application/handlers/get-workflow.handler';
import { ListWorkflowsHandler } from './application/handlers/list-workflows.handler';
import {
  ApproveWorkflowRequestHandler,
  CreateWorkflowAutomationRuleHandler,
  CreateWorkflowTemplateHandler,
  DeleteWorkflowSavedFilterHandler,
  DuplicateWorkflowTemplateHandler,
  ExportWorkflowLogsHandler,
  GetWorkflowOverviewHandler,
  GetWorkflowTaskHandler,
  ListWorkflowApprovalsHandler,
  ListWorkflowAuditHandler,
  ListWorkflowAutomationRulesHandler,
  ListWorkflowExecutionLogsHandler,
  ListWorkflowSavedFiltersHandler,
  ListWorkflowTasksHandler,
  ListWorkflowTemplatesHandler,
  ListWorkflowsPaginatedHandler,
  LogWorkflowAdvanceHandler,
  PublishWorkflowTemplateHandler,
  RejectWorkflowRequestHandler,
  RetryFailedWorkflowHandler,
  SaveWorkflowFilterHandler,
  StartWorkflowFromTemplateHandler,
  UpdateWorkflowTaskHandler,
  UpdateWorkflowTemplateHandler,
} from './application/handlers/workflow-enterprise.handlers';
import { WorkflowAutomationListener } from './application/integrations/workflow-automation.listener';
import { WorkflowAutomationExecutorService } from './application/services/workflow-automation.executor';
import { WorkflowEscalationService } from './application/services/workflow-escalation.service';
import { WorkflowRealtimeService } from './application/services/workflow-realtime.service';
import { NOTIFICATION_AUDIT_LOG } from '../notifications/application/ports/notification-audit-log.port';
import { AuditTrailNotificationAuditLog } from '../notifications/infrastructure/audit-trail-notification-audit-log';
import { PrismaWorkflowRepository } from './infrastructure/prisma-workflow.repository';
import { WORKFLOW_REPOSITORY } from '../../infrastructure/provider.tokens';

@Module({
  imports: [SubscriptionModule, AuditModule, RealtimeModule, forwardRef(() => NotificationModule)],
  controllers: [WorkflowController],
  providers: [
    WorkflowPolicy,
    WorkflowPermissionGuard,
    CreateWorkflowHandler,
    AdvanceWorkflowHandler,
    CancelWorkflowHandler,
    GetWorkflowHandler,
    ListWorkflowsHandler,
    GetWorkflowOverviewHandler,
    ListWorkflowsPaginatedHandler,
    ListWorkflowTasksHandler,
    GetWorkflowTaskHandler,
    UpdateWorkflowTaskHandler,
    ListWorkflowApprovalsHandler,
    ApproveWorkflowRequestHandler,
    RejectWorkflowRequestHandler,
    ListWorkflowTemplatesHandler,
    CreateWorkflowTemplateHandler,
    UpdateWorkflowTemplateHandler,
    PublishWorkflowTemplateHandler,
    DuplicateWorkflowTemplateHandler,
    StartWorkflowFromTemplateHandler,
    ListWorkflowAutomationRulesHandler,
    CreateWorkflowAutomationRuleHandler,
    ListWorkflowExecutionLogsHandler,
    ExportWorkflowLogsHandler,
    ListWorkflowAuditHandler,
    ListWorkflowSavedFiltersHandler,
    SaveWorkflowFilterHandler,
    DeleteWorkflowSavedFilterHandler,
    RetryFailedWorkflowHandler,
    LogWorkflowAdvanceHandler,
    WorkflowAutomationExecutorService,
    WorkflowAutomationListener,
    WorkflowEscalationService,
    WorkflowRealtimeService,
    { provide: NOTIFICATION_AUDIT_LOG, useClass: AuditTrailNotificationAuditLog },
    { provide: WORKFLOW_REPOSITORY, useClass: PrismaWorkflowRepository },
  ],
  exports: [WORKFLOW_REPOSITORY, WorkflowEscalationService],
})
export class WorkflowModule {}
