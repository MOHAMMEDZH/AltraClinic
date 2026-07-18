import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  NotFoundException,
  UseGuards,
  BadRequestException,
  Req,
  Res,
} from '@nestjs/common';
import { createReadStream, existsSync } from 'fs';
import type { Response } from 'express';
import { ReportingPermissionGuard } from '../api/reporting-permission.guard';
import { RequirePermission } from '../../auth/api/guards/permission.guard';
import { RequireLicensedModule } from '../../subscription/api/decorators/require-licensed-module.decorator';
import { RequireLicensedFeature } from '../../subscription/api/decorators/require-licensed-feature.decorator';
import { RequestReportDTO } from '../application/dto/request-report.dto';
import { RequestReportHandler } from '../application/handlers/request-report.handler';
import { GetReportHandler } from '../application/handlers/get-report.handler';
import { ListReportsHandler } from '../application/handlers/list-reports.handler';
import { RequestReportCommand } from '../application/commands/request-report.command';
import { GetReportQuery } from '../application/queries/get-report.query';
import { ListReportsQuery } from '../application/queries/list-reports.query';
import { OperationalReportGenerationService } from '../application/services/operational-report-generation.service';
import { ReportWorkspaceService } from '../application/services/report-workspace.service';

interface AuthRequest {
  headers: Record<string, string | undefined>;
  user?: { id?: string; tenantId?: string };
}

@Controller('reporting')
@UseGuards(ReportingPermissionGuard)
@RequireLicensedModule('reporting')
@RequireLicensedFeature('reports')
export class ReportingController {
  constructor(
    private readonly requestReportHandler: RequestReportHandler,
    private readonly getReportHandler: GetReportHandler,
    private readonly listReportsHandler: ListReportsHandler,
    private readonly reportGeneration: OperationalReportGenerationService,
    private readonly workspace: ReportWorkspaceService,
  ) {}

  @Post('reports')
  @RequirePermission('api.reporting', 'create')
  async requestReport(@Req() request: AuthRequest, @Body() body: RequestReportDTO) {
    const createdBy = body.createdBy?.trim() || request.user?.id?.trim() || '';
    if (!createdBy) throw new BadRequestException('Authenticated user required');
    const name =
      body.name?.trim() ||
      `${body.type.replace(/-/g, ' ')} ${body.startDate} – ${body.endDate}`;
    return await this.requestReportHandler.execute(
      new RequestReportCommand(
        createdBy,
        name,
        body.type,
        body.format,
        body.startDate,
        body.endDate,
        body.parameters ?? {},
        body.branchId,
      ),
    );
  }

  @Get('activity')
  @RequirePermission('api.reporting', 'view')
  async listRecentActivity(@Req() request: AuthRequest, @Query('limit') limit?: string) {
    const tenantId = this.requireTenantId(request);
    const parsedLimit = limit ? Math.min(50, Math.max(1, Number(limit))) : 20;
    return { entries: await this.workspace.listRecentActivity(tenantId, parsedLimit) };
  }

  @Get('filter-presets')
  @RequirePermission('api.reporting', 'view')
  async listFilterPresets(@Req() request: AuthRequest) {
    const tenantId = this.requireTenantId(request);
    const userId = request.user?.id?.trim();
    if (!userId) throw new BadRequestException('Authenticated user required');
    return { presets: await this.workspace.listFilterPresets(tenantId, userId) };
  }

  @Post('filter-presets')
  @RequirePermission('api.reporting', 'view')
  async saveFilterPreset(
    @Req() request: AuthRequest,
    @Body() body: { id?: string; name: string; filters: Record<string, unknown> },
  ) {
    const tenantId = this.requireTenantId(request);
    const userId = request.user?.id?.trim();
    if (!userId) throw new BadRequestException('Authenticated user required');
    if (!body.name?.trim()) throw new BadRequestException('Preset name is required');
    const preset = await this.workspace.saveFilterPreset(tenantId, userId, body);
    return { preset };
  }

  @Delete('filter-presets/:presetId')
  @RequirePermission('api.reporting', 'view')
  async deleteFilterPreset(@Req() request: AuthRequest, @Param('presetId') presetId: string) {
    const tenantId = this.requireTenantId(request);
    const userId = request.user?.id?.trim();
    if (!userId) throw new BadRequestException('Authenticated user required');
    await this.workspace.deleteFilterPreset(tenantId, userId, presetId);
    return { ok: true };
  }

  @Get('custom-definitions')
  @RequirePermission('api.reporting', 'view')
  async listCustomDefinitions(@Req() request: AuthRequest) {
    const tenantId = this.requireTenantId(request);
    const userId = request.user?.id?.trim();
    if (!userId) throw new BadRequestException('Authenticated user required');
    return { definitions: await this.workspace.listCustomDefinitions(tenantId, userId) };
  }

  @Post('custom-definitions')
  @RequirePermission('api.reporting', 'create')
  async saveCustomDefinition(
    @Req() request: AuthRequest,
    @Body()
    body: {
      id?: string;
      name: string;
      reportType: string;
      format: string;
      visualization: string;
      dataset: string;
      dimensions: string[];
      measures: string[];
      filters: Record<string, unknown>;
      isScheduled?: boolean;
      scheduleFrequency?: string | null;
      recipientEmails?: string[];
    },
  ) {
    const tenantId = this.requireTenantId(request);
    const userId = request.user?.id?.trim();
    if (!userId) throw new BadRequestException('Authenticated user required');
    if (!body.name?.trim()) throw new BadRequestException('Definition name is required');
    const definition = await this.workspace.saveCustomDefinition(tenantId, userId, body);
    return { definition };
  }

  @Delete('custom-definitions/:definitionId')
  @RequirePermission('api.reporting', 'create')
  async deleteCustomDefinition(
    @Req() request: AuthRequest,
    @Param('definitionId') definitionId: string,
  ) {
    const tenantId = this.requireTenantId(request);
    const userId = request.user?.id?.trim();
    if (!userId) throw new BadRequestException('Authenticated user required');
    await this.workspace.deleteCustomDefinition(tenantId, userId, definitionId);
    return { ok: true };
  }

  @Delete('shares/:shareId')
  @RequirePermission('api.reporting', 'create')
  async deleteShare(@Req() request: AuthRequest, @Param('shareId') shareId: string) {
    const tenantId = this.requireTenantId(request);
    await this.workspace.deleteShare(tenantId, shareId);
    return { ok: true };
  }

  @Get('reports/:reportId/shares')
  @RequirePermission('api.reporting', 'view')
  async listShares(@Req() request: AuthRequest, @Param('reportId') reportId: string) {
    const tenantId = this.requireTenantId(request);
    return { shares: await this.workspace.listShares(tenantId, reportId) };
  }

  @Post('reports/:reportId/shares')
  @RequirePermission('api.reporting', 'create')
  async createShare(
    @Req() request: AuthRequest,
    @Param('reportId') reportId: string,
    @Body()
    body: {
      reportKind?: string;
      targetType: string;
      targetId: string;
      access: string;
    },
  ) {
    const tenantId = this.requireTenantId(request);
    const userId = request.user?.id?.trim();
    if (!userId) throw new BadRequestException('Authenticated user required');
    const share = await this.workspace.createShare(tenantId, userId, {
      reportId,
      reportKind: body.reportKind ?? 'analytics',
      targetType: body.targetType,
      targetId: body.targetId,
      access: body.access,
    });
    return { share };
  }

  @Get('reports/:reportId/audit')
  @RequirePermission('api.reporting', 'view')
  async listAudit(
    @Req() request: AuthRequest,
    @Param('reportId') reportId: string,
    @Query('limit') limit?: string,
  ) {
    const tenantId = this.requireTenantId(request);
    const parsedLimit = limit ? Math.min(100, Math.max(1, Number(limit))) : 50;
    return { entries: await this.workspace.listAudit(tenantId, reportId, parsedLimit) };
  }

  @Post('reports/:reportId/audit')
  @RequirePermission('api.reporting', 'view')
  async recordAudit(
    @Req() request: AuthRequest,
    @Param('reportId') reportId: string,
    @Body() body: { action: string; details?: Record<string, unknown> },
  ) {
    const tenantId = this.requireTenantId(request);
    const userId = request.user?.id?.trim();
    if (!userId) throw new BadRequestException('Authenticated user required');
    if (!body.action?.trim()) throw new BadRequestException('Action is required');
    await this.workspace.recordAudit(tenantId, userId, reportId, body.action, body.details);
    return { ok: true };
  }

  @Get('reports/:reportId')
  @RequirePermission('api.reporting', 'view')
  async getReport(@Param('reportId') reportId: string) {
    return await this.getReportHandler.execute(new GetReportQuery(reportId));
  }

  @Get('reports')
  @RequirePermission('api.reporting', 'view')
  async listReports(
    @Query('branchId') branchId?: string,
    @Query('createdBy') createdBy?: string,
    @Query('type') type?: string,
    @Query('status') status?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return await this.listReportsHandler.execute(
      new ListReportsQuery(
        branchId?.trim() || null,
        createdBy?.trim() || null,
        type?.trim() || null,
        status?.trim() || null,
        startDate?.trim() || null,
        endDate?.trim() || null,
      ),
    );
  }

  @Get('reports/:reportId/download')
  @RequirePermission('api.reporting', 'export')
  async downloadReport(
    @Param('reportId') reportId: string,
    @Req() request: AuthRequest,
    @Res() res: Response,
  ) {
    const tenantId = this.requireTenantId(request);

    const report = await this.getReportHandler.execute(new GetReportQuery(reportId));
    if (report.status !== 'completed') {
      throw new BadRequestException('Report is not ready for download');
    }

    const filePath = this.reportGeneration.resolveFilePath(tenantId, reportId, report.format);
    if (!existsSync(filePath)) {
      throw new NotFoundException('Report file not found');
    }

    const ext = report.format === 'excel' ? 'xlsx' : report.format;
    const mime: Record<string, string> = {
      pdf: 'application/pdf',
      csv: 'text/csv; charset=utf-8',
      excel: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    };
    res.setHeader('Content-Type', mime[report.format] ?? 'application/octet-stream');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${report.name.replace(/[^\w\s-]/g, '')}.${ext}"`,
    );
    createReadStream(filePath).pipe(res);
  }

  private requireTenantId(request: AuthRequest): string {
    const tenantId =
      request.user?.tenantId?.trim() ||
      request.headers['x-tenant-id']?.trim() ||
      '';
    if (!tenantId) throw new BadRequestException('x-tenant-id header is required');
    return tenantId;
  }
}
