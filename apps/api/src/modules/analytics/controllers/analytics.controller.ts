import { Body, Controller, Delete, Get, Patch, Post, Put, Param, Query, UseGuards, BadRequestException, Req, Res, NotFoundException, ForbiddenException } from '@nestjs/common';
import { createReadStream, existsSync } from 'fs';
import type { Response } from 'express';
import { AnalyticsPermissionGuard } from '../api/analytics-permission.guard';
import { RequirePermission } from '../../auth/api/guards/permission.guard';
import { RequireLicensedModule } from '../../subscription/api/decorators/require-licensed-module.decorator';
import { RequireLicensedFeature } from '../../subscription/api/decorators/require-licensed-feature.decorator';
import { AnalyticsPolicy } from '../policies/analytics-policy.service';
import { DashboardOverviewService } from '../../dashboard/application/dashboard-overview.service';
import { parseDashboardRange } from '../../dashboard/application/dashboard-range';
import { resolveDashboardBranchFilter } from '../../dashboard/application/dashboard-branch-scope';
import { JwtClaimsVO } from '../../auth/domain/value-objects/jwt-claims.vo';
import { RecordMetricHandler } from '../application/handlers/record-metric.handler';
import { CreateDashboardHandler } from '../application/handlers/create-dashboard.handler';
import { GenerateAnalyticsReportHandler } from '../application/handlers/generate-analytics-report.handler';
import { GetMetricQueryHandler, ListMetricsQueryHandler } from '../application/handlers/get-metric-query.handler';
import { GetDashboardQueryHandler, ListDashboardsQueryHandler } from '../application/handlers/get-dashboard-query.handler';
import { GetAnalyticsReportQueryHandler, ListAnalyticsReportsQueryHandler } from '../application/handlers/get-analytics-report-query.handler';
import { AnalyticsReportGenerationService } from '../application/services/analytics-report-generation.service';
import { AnalyticsDomainService } from '../application/services/analytics-domain.service';
import { AnalyticsAlertsService } from '../application/services/analytics-alerts.service';
import { AnalyticsFilterPresetService } from '../application/services/analytics-filter-preset.service';
import { AnalyticsLayoutService } from '../application/services/analytics-layout.service';
import { UpdateAnalyticsReportHandler, DeleteAnalyticsReportHandler, UpdateAnalyticsReportCommand } from '../application/handlers/update-analytics-report.handler';
import { ReportAccessService } from '../../reporting/application/services/report-access.service';
import { ReportFormat, ReportStatus } from '../domain/entities/analytics-report.entity';
import { GetMetricQuery, ListMetricsQuery, GetDashboardQuery, ListDashboardsQuery, GetAnalyticsReportQuery, ListAnalyticsReportsQuery } from '../application/queries';
import { RecordMetricCommand } from '../application/commands/record-metric.command';
import { CreateDashboardCommand } from '../application/commands/create-dashboard.command';
import { GenerateAnalyticsReportCommand } from '../application/commands/generate-analytics-report.command';
import {
  RecordMetricRequestDTO,
  CreateDashboardRequestDTO,
  GenerateAnalyticsReportRequestDTO,
} from '../application/dto/request.dto';

/**
 * Analytics API Controller
 * Routes for metrics, dashboards, and reports
 */
@Controller('analytics')
@UseGuards(AnalyticsPermissionGuard)
@RequireLicensedModule('analytics')
@RequireLicensedFeature('analytics')
export class AnalyticsController {
  constructor(
    private readonly policy: AnalyticsPolicy,
    private readonly overviewService: DashboardOverviewService,
    private readonly recordMetricHandler: RecordMetricHandler,
    private readonly createDashboardHandler: CreateDashboardHandler,
    private readonly generateReportHandler: GenerateAnalyticsReportHandler,
    private readonly getMetricHandler: GetMetricQueryHandler,
    private readonly listMetricsHandler: ListMetricsQueryHandler,
    private readonly getDashboardHandler: GetDashboardQueryHandler,
    private readonly listDashboardsHandler: ListDashboardsQueryHandler,
    private readonly getReportHandler: GetAnalyticsReportQueryHandler,
    private readonly listReportsHandler: ListAnalyticsReportsQueryHandler,
    private readonly reportGeneration: AnalyticsReportGenerationService,
    private readonly updateReportHandler: UpdateAnalyticsReportHandler,
    private readonly deleteReportHandler: DeleteAnalyticsReportHandler,
    private readonly reportAccess: ReportAccessService,
    private readonly domainService: AnalyticsDomainService,
    private readonly alertsService: AnalyticsAlertsService,
    private readonly filterPresetService: AnalyticsFilterPresetService,
    private readonly layoutService: AnalyticsLayoutService,
  ) {}

  /**
   * GET /analytics/overview
   * Clinic analytics summary — same payload as dashboard overview, analytics permission.
   */
  @Get('overview')
  @RequirePermission('api.analytics', 'view')
  async overview(
    @Req() request: {
      analyticsContext: {
        tenantId: string;
        userId: string;
        userRoles: string[];
        userBranchId?: string;
      };
    },
    @Query('branchId') branchId?: string,
    @Query('range') range?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    const context = request.analyticsContext;
    const claims = new JwtClaimsVO({
      sub: context.userId,
      tenantId: context.tenantId,
      branchId: context.userBranchId ?? null,
      roles: context.userRoles,
      sessionId: 'analytics-overview',
    });
    const branchFilter = resolveDashboardBranchFilter(claims, branchId);
    return this.overviewService.getOverview(
      context.tenantId,
      branchFilter,
      parseDashboardRange(range),
      context.userId,
      from,
      to,
    );
  }

  /**
   * GET /analytics/domains/:domainId
   * Domain-specific analytics overview (KPIs, charts, tables).
   */
  @Get('domains/:domainId')
  @RequirePermission('api.analytics', 'view')
  async domainOverview(
    @Param('domainId') domainId: string,
    @Req() request: {
      analyticsContext: {
        tenantId: string;
        userId: string;
        userRoles: string[];
        userBranchId?: string;
      };
    },
    @Query('branchId') branchId?: string,
    @Query('range') range?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    const context = request.analyticsContext;
    const claims = new JwtClaimsVO({
      sub: context.userId,
      tenantId: context.tenantId,
      branchId: context.userBranchId ?? null,
      roles: context.userRoles,
      sessionId: 'analytics-domain',
    });
    const branchFilter = resolveDashboardBranchFilter(claims, branchId);
    return this.domainService.getDomainOverview(
      context.tenantId,
      context.userId,
      domainId,
      branchFilter,
      range,
      from,
      to,
    );
  }

  /**
   * GET /analytics/alerts
   * Operational alerts derived from overview metrics.
   */
  @Get('alerts')
  @RequirePermission('api.analytics', 'view')
  async alerts(
    @Req() request: {
      analyticsContext: {
        tenantId: string;
        userId: string;
        userRoles: string[];
        userBranchId?: string;
      };
    },
    @Query('branchId') branchId?: string,
    @Query('range') range?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    const context = request.analyticsContext;
    const claims = new JwtClaimsVO({
      sub: context.userId,
      tenantId: context.tenantId,
      branchId: context.userBranchId ?? null,
      roles: context.userRoles,
      sessionId: 'analytics-alerts',
    });
    const branchFilter = resolveDashboardBranchFilter(claims, branchId);
    const overview = await this.overviewService.getOverview(
      context.tenantId,
      branchFilter,
      parseDashboardRange(range),
      context.userId,
      from,
      to,
    );
    return { alerts: this.alertsService.computeAlerts(overview) };
  }

  @Get('filter-presets')
  @RequirePermission('api.analytics', 'view')
  async listFilterPresets(@Req() request: { analyticsContext: { tenantId: string; userId: string } }) {
    const context = request.analyticsContext;
    return { presets: await this.filterPresetService.list(context.tenantId, context.userId) };
  }

  @Post('filter-presets')
  @RequirePermission('api.analytics', 'create')
  async createFilterPreset(
    @Body() body: { name: string; filters: Record<string, unknown> },
    @Req() request: { analyticsContext: { tenantId: string; userId: string } },
  ) {
    const context = request.analyticsContext;
    return this.filterPresetService.create(context.tenantId, context.userId, body.name, body.filters ?? {});
  }

  @Delete('filter-presets/:presetId')
  @RequirePermission('api.analytics', 'create')
  async deleteFilterPreset(
    @Param('presetId') presetId: string,
    @Req() request: { analyticsContext: { tenantId: string; userId: string } },
  ) {
    const context = request.analyticsContext;
    await this.filterPresetService.delete(context.tenantId, context.userId, presetId);
    return { ok: true };
  }

  @Get('layout')
  @RequirePermission('api.analytics', 'view')
  async getLayout(
    @Query('profile') profile: string,
    @Req() request: { analyticsContext: { tenantId: string; userId: string } },
  ) {
    const context = request.analyticsContext;
    return { layout: await this.layoutService.getLayout(context.tenantId, context.userId, profile || 'default') };
  }

  @Put('layout')
  @RequirePermission('api.analytics', 'create')
  async saveLayout(
    @Body()
    body: {
      profile?: string;
      widgetOrder: string[];
      hiddenWidgets: string[];
      gridLayout?: Array<{ i: string; x: number; y: number; w: number; h: number }>;
    },
    @Req() request: { analyticsContext: { tenantId: string; userId: string } },
  ) {
    const context = request.analyticsContext;
    return this.layoutService.saveLayout(context.tenantId, context.userId, body.profile || 'default', {
      widgetOrder: body.widgetOrder ?? [],
      hiddenWidgets: body.hiddenWidgets ?? [],
      gridLayout: body.gridLayout,
    });
  }

  @Delete('layout')
  @RequirePermission('api.analytics', 'create')
  async clearLayout(
    @Query('profile') profile: string,
    @Req() request: { analyticsContext: { tenantId: string; userId: string } },
  ) {
    const context = request.analyticsContext;
    await this.layoutService.clearLayout(context.tenantId, context.userId, profile || 'default');
    return { ok: true };
  }

  /**
   * POST /analytics/metrics
   * Record a new metric
   */
  @Post('metrics')
  @RequirePermission('api.analytics', 'create')
  async recordMetric(@Body() body: RecordMetricRequestDTO, @Req() request: any) {
    const context = request.analyticsContext;

    return await this.recordMetricHandler.execute(
      new RecordMetricCommand(
        context.tenantId,
        body.metricName,
        body.metricValue,
        context.userId,
        body.timestamp,
        body.branchId,
        body.dimensions,
        body.tags,
        body.metadata,
      ),
    );
  }

  /**
   * GET /analytics/metrics/:metricId
   * Get a single metric
   */
  @Get('metrics/:metricId')
  @RequirePermission('api.analytics', 'view')
  async getMetric(@Param('metricId') metricId: string, @Req() request: any) {
    const context = request.analyticsContext;
    return await this.getMetricHandler.execute(new GetMetricQuery(metricId, context.tenantId));
  }

  /**
   * GET /analytics/metrics
   * List metrics with filters and pagination
   */
  @Get('metrics')
  @RequirePermission('api.analytics', 'view')
  async listMetrics(
    @Query('branchId') branchId?: string,
    @Query('metricName') metricName?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
    @Req() request?: any,
  ) {
    const context = request.analyticsContext;
    const limitNum = Math.min(parseInt(limit ?? '50') || 50, 100);
    const offsetNum = Math.max(parseInt(offset ?? '0') || 0, 0);

    return await this.listMetricsHandler.execute(
      new ListMetricsQuery(context.tenantId, branchId?.trim(), metricName?.trim(), startDate?.trim(), endDate?.trim(), limitNum, offsetNum),
    );
  }

  /**
   * POST /analytics/dashboards
   * Create a new dashboard
   */
  @Post('dashboards')
  @RequirePermission('api.analytics', 'create')
  async createDashboard(@Body() body: CreateDashboardRequestDTO, @Req() request: any) {
    const context = request.analyticsContext;

    // Check authorization
    if (!this.policy.canCreateDashboard(context.userRoles)) {
      throw new BadRequestException('You do not have permission to create dashboards');
    }

    return await this.createDashboardHandler.execute(
      new CreateDashboardCommand(
        context.tenantId,
        body.name,
        body.dashboardType,
        context.userId,
        body.widgets,
        body.description,
        body.branchId,
        body.isDefault,
        body.isPublic,
      ),
    );
  }

  /**
   * GET /analytics/dashboards/:dashboardId
   * Get a single dashboard
   */
  @Get('dashboards/:dashboardId')
  @RequirePermission('api.analytics', 'view')
  async getDashboard(@Param('dashboardId') dashboardId: string, @Req() request: any) {
    const context = request.analyticsContext;
    return await this.getDashboardHandler.execute(new GetDashboardQuery(dashboardId, context.tenantId));
  }

  /**
   * GET /analytics/dashboards
   * List dashboards
   */
  @Get('dashboards')
  @RequirePermission('api.analytics', 'view')
  async listDashboards(
    @Query('branchId') branchId?: string,
    @Query('dashboardType') dashboardType?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
    @Req() request?: any,
  ) {
    const context = request.analyticsContext;
    const limitNum = Math.min(parseInt(limit ?? '20') || 20, 100);
    const offsetNum = Math.max(parseInt(offset ?? '0') || 0, 0);

    const rows = await this.listDashboardsHandler.execute(
      new ListDashboardsQuery(context.tenantId, branchId?.trim(), dashboardType?.trim(), limitNum, offsetNum),
    );

    return {
      dashboards: rows.map((d) => ({
        ...d.toJSON(),
        widgetCount: d.widgets?.length ?? 0,
      })),
      total: rows.length,
      limit: limitNum,
      offset: offsetNum,
    };
  }

  /**
   * POST /analytics/reports
   * Generate a new analytics report
   */
  @Post('reports')
  @RequirePermission('api.analytics', 'create')
  async generateReport(@Body() body: GenerateAnalyticsReportRequestDTO, @Req() request: any) {
    const context = request.analyticsContext;

    // Check authorization
    if (!this.policy.canGenerateReport(context.userRoles)) {
      throw new BadRequestException('You do not have permission to generate reports');
    }

    return await this.generateReportHandler.execute(
      new GenerateAnalyticsReportCommand(
        context.tenantId,
        body.name,
        body.reportType,
        body.format,
        context.userId,
        body.description,
        body.branchId,
        body.parameters,
        body.recipientEmails,
        body.isScheduled,
        body.scheduleFrequency,
      ),
    );
  }

  /**
   * GET /analytics/reports/:reportId/download
   * Download a generated report file.
   */
  @Get('reports/:reportId/download')
  @RequirePermission('api.analytics', 'export')
  async downloadReport(
    @Param('reportId') reportId: string,
    @Req() request: { analyticsContext: { tenantId: string } },
    @Res() res: Response,
  ) {
    const context = request.analyticsContext;
    const report = await this.getReportHandler.execute(
      new GetAnalyticsReportQuery(reportId, context.tenantId),
    );

    if (report.createdBy !== context.userId) {
      const allowed = await this.reportAccess.canAccessReport(
        context.tenantId,
        reportId,
        context.userId,
        context.userRoles ?? [],
        context.branchId,
      );
      if (!allowed) throw new ForbiddenException('Report access denied');
    }

    if (report.status !== ReportStatus.COMPLETED) {
      throw new BadRequestException('Report is not ready for download');
    }

    const filePath = this.reportGeneration.resolveFilePath(
      context.tenantId,
      reportId,
      report.format as ReportFormat,
    );

    if (!existsSync(filePath)) {
      throw new NotFoundException('Report file not found');
    }

    const ext =
      report.format === ReportFormat.JSON
        ? 'json'
        : report.format === ReportFormat.EXCEL
          ? 'xlsx'
          : report.format;
    const mime: Record<string, string> = {
      pdf: 'application/pdf',
      csv: 'text/csv; charset=utf-8',
      excel: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      json: 'application/json',
    };

    res.setHeader('Content-Type', mime[report.format] ?? 'application/octet-stream');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${report.name.replace(/[^\w\s-]/g, '')}.${ext}"`,
    );
    createReadStream(filePath).pipe(res);
  }

  /**
   * GET /analytics/reports/:reportId
   * Get a single report
   */
  @Get('reports/:reportId')
  @RequirePermission('api.analytics', 'view')
  async getReport(@Param('reportId') reportId: string, @Req() request: any) {
    const context = request.analyticsContext;
    const report = await this.getReportHandler.execute(
      new GetAnalyticsReportQuery(reportId, context.tenantId),
    );
    if (report.createdBy !== context.userId) {
      const allowed = await this.reportAccess.canAccessReport(
        context.tenantId,
        reportId,
        context.userId,
        context.userRoles ?? [],
        context.branchId,
      );
      if (!allowed) throw new ForbiddenException('Report access denied');
    }
    return report.toJSON();
  }

  @Patch('reports/:reportId')
  @RequirePermission('api.analytics', 'create')
  async updateReport(
    @Param('reportId') reportId: string,
    @Body()
    body: {
      isScheduled?: boolean;
      scheduleFrequency?: 'daily' | 'weekly' | 'monthly';
      recipientEmails?: string[];
      name?: string;
    },
    @Req() request: any,
  ) {
    const context = request.analyticsContext;
    return this.updateReportHandler.execute(
      new UpdateAnalyticsReportCommand(
        reportId,
        context.tenantId,
        body.isScheduled,
        body.scheduleFrequency,
        body.recipientEmails,
        body.name,
      ),
    );
  }

  @Delete('reports/:reportId')
  @RequirePermission('api.analytics', 'create')
  async deleteReport(@Param('reportId') reportId: string, @Req() request: any) {
    const context = request.analyticsContext;
    return this.deleteReportHandler.execute(reportId, context.tenantId);
  }

  /**
   * GET /analytics/reports
   * List analytics reports
   */
  @Get('reports')
  @RequirePermission('api.analytics', 'view')
  async listReports(
    @Query('branchId') branchId?: string,
    @Query('reportType') reportType?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
    @Req() request?: any,
  ) {
    const context = request.analyticsContext;
    const limitNum = Math.min(parseInt(limit ?? '20') || 20, 100);
    const offsetNum = Math.max(parseInt(offset ?? '0') || 0, 0);

    const rows = await this.listReportsHandler.execute(
      new ListAnalyticsReportsQuery(context.tenantId, branchId?.trim(), reportType?.trim(), limitNum, offsetNum),
    );

    return {
      reports: rows.map((r) => r.toJSON()),
      total: rows.length,
      limit: limitNum,
      offset: offsetNum,
    };
  }
}
