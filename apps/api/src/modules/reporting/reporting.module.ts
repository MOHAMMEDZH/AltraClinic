import { Module, forwardRef } from '@nestjs/common';
import { ReportingController } from './controllers/reporting.controller';
import { RequestReportHandler } from './application/handlers/request-report.handler';
import { GetReportHandler } from './application/handlers/get-report.handler';
import { ListReportsHandler } from './application/handlers/list-reports.handler';
import { PrismaOperationalReportRepository } from './infrastructure/prisma-operational-report.repository';
import { ReportingPolicy } from './policies/reporting-policy.service';
import { ReportingPermissionGuard } from './api/reporting-permission.guard';
import { REPORT_REPOSITORY } from '../../infrastructure/provider.tokens';
import { SubscriptionModule } from '../subscription/subscription.module';
import { DashboardModule } from '../dashboard/dashboard.module';
import { OperationalReportGenerationService } from './application/services/operational-report-generation.service';
import { ReportRequestedListener } from './application/integrations/report-requested.listener';
import { ReportWorkspaceService } from './application/services/report-workspace.service';
import { OperationalReportDataService } from './application/services/operational-report-data.service';
import { OperationalReportDeliveryService } from './application/services/operational-report-delivery.service';
import { ReportAccessService } from './application/services/report-access.service';
import { ReportBrandingService } from './application/services/report-branding.service';
import { NotificationModule } from '../notifications/notifications.module';

@Module({
  imports: [SubscriptionModule, DashboardModule, NotificationModule],
  controllers: [ReportingController],
  providers: [
    { provide: REPORT_REPOSITORY, useClass: PrismaOperationalReportRepository },
    RequestReportHandler,
    GetReportHandler,
    ListReportsHandler,
    ReportingPolicy,
    ReportingPermissionGuard,
    OperationalReportGenerationService,
    OperationalReportDataService,
    OperationalReportDeliveryService,
    ReportRequestedListener,
    ReportWorkspaceService,
    ReportAccessService,
    ReportBrandingService,
  ],
  exports: [REPORT_REPOSITORY, ReportWorkspaceService, ReportAccessService, ReportBrandingService],
})
export class ReportingModule {}
