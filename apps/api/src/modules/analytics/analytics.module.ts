import { Module } from '@nestjs/common';
import { DashboardModule } from '../dashboard/dashboard.module';
import { NotificationModule } from '../notifications/notifications.module';
import { ReportingModule } from '../reporting/reporting.module';
import { SubscriptionModule } from '../subscription/subscription.module';
import { AnalyticsController } from './controllers/analytics.controller';
import { AnalyticsPolicy } from './policies/analytics-policy.service';
import { AnalyticsPermissionGuard } from './api/analytics-permission.guard';
import { RecordMetricHandler } from './application/handlers/record-metric.handler';
import { CreateDashboardHandler } from './application/handlers/create-dashboard.handler';
import { GenerateAnalyticsReportHandler } from './application/handlers/generate-analytics-report.handler';
import { GetMetricQueryHandler, ListMetricsQueryHandler } from './application/handlers/get-metric-query.handler';
import { GetDashboardQueryHandler, ListDashboardsQueryHandler } from './application/handlers/get-dashboard-query.handler';
import { GetAnalyticsReportQueryHandler, ListAnalyticsReportsQueryHandler } from './application/handlers/get-analytics-report-query.handler';
import { UpdateAnalyticsReportHandler, DeleteAnalyticsReportHandler } from './application/handlers/update-analytics-report.handler';
import { PrismaAnalyticsReportRepository } from './infrastructure/prisma-analytics-report.repository';
import { METRIC_REPOSITORY, DASHBOARD_REPOSITORY, ANALYTICS_REPORT_REPOSITORY } from '../../infrastructure/provider.tokens';
import { DomainEventAnalyticsListener } from './application/integrations/domain-event-analytics.listener';
import { AnalyticsDemoSeedService } from './application/integrations/analytics-demo-seed.service';
import { ReportQueuedListener } from './application/integrations/report-queued.listener';
import { ReportDeliveryService } from './application/services/report-delivery.service';
import { ScheduledAnalyticsReportService } from './application/services/scheduled-analytics-report.service';
import { AnalyticsReportGenerationService } from './application/services/analytics-report-generation.service';
import { PrismaMetricRepository } from './infrastructure/prisma-metric.repository';
import { PrismaDashboardRepository } from './infrastructure/prisma-dashboard.repository';
import { AnalyticsDomainService } from './application/services/analytics-domain.service';
import { AnalyticsAlertsService } from './application/services/analytics-alerts.service';
import { AnalyticsFilterPresetService } from './application/services/analytics-filter-preset.service';
import { AnalyticsLayoutService } from './application/services/analytics-layout.service';

@Module({
  imports: [DashboardModule, NotificationModule, ReportingModule, SubscriptionModule],
  controllers: [AnalyticsController],
  providers: [
    AnalyticsPolicy,
    AnalyticsPermissionGuard,
    RecordMetricHandler,
    CreateDashboardHandler,
    GenerateAnalyticsReportHandler,
    UpdateAnalyticsReportHandler,
    DeleteAnalyticsReportHandler,
    DomainEventAnalyticsListener,
    AnalyticsDemoSeedService,
    ReportQueuedListener,
    AnalyticsReportGenerationService,
    ReportDeliveryService,
    ScheduledAnalyticsReportService,
    AnalyticsDomainService,
    AnalyticsAlertsService,
    AnalyticsFilterPresetService,
    AnalyticsLayoutService,
    GetMetricQueryHandler,
    ListMetricsQueryHandler,
    GetDashboardQueryHandler,
    ListDashboardsQueryHandler,
    GetAnalyticsReportQueryHandler,
    ListAnalyticsReportsQueryHandler,
    { provide: METRIC_REPOSITORY, useClass: PrismaMetricRepository },
    { provide: DASHBOARD_REPOSITORY, useClass: PrismaDashboardRepository },
    { provide: ANALYTICS_REPORT_REPOSITORY, useClass: PrismaAnalyticsReportRepository },
  ],
  exports: [ScheduledAnalyticsReportService, AnalyticsReportGenerationService],
})
export class AnalyticsModule {}
