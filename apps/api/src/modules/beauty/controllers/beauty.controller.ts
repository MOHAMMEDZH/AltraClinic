import { Body, Controller, Get, GoneException, Header, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';

import { BeautyPermissionGuard } from '../api/beauty-permission.guard';

import { RequirePermission } from '../../auth/api/guards/permission.guard';
import { RequireLicensedModule } from '../../subscription/api/decorators/require-licensed-module.decorator';

import { CurrentUser } from '../../auth/api/decorators/current-user.decorator';

import { JwtClaimsVO } from '../../auth/domain/value-objects/jwt-claims.vo';

import { CreateBeautyRecordDto } from '../application/dto/create-beauty-record.dto';

import { UpdateBeautyRecordDto } from '../application/dto/update-beauty-record.dto';

import { CreateBeautyAnnotationDto } from '../application/dto/create-beauty-annotation.dto';

import {
  ConsumeBeautyMaterialDTO,
  ConsumeBeautyMaterialsBatchDTO,
  CreateBeautyProcedureMaterialDTO,
} from '../application/dto/beauty-material.dto';

import {
  ConsumeBeautyMaterialHandler,
  CreateBeautyProcedureMaterialHandler,
  ListBeautyProcedureMaterialsHandler,
  ListPatientBeautyMaterialsHandler,
  SearchBeautyClinicalInventoryHandler,
} from '../application/handlers/beauty-material.handlers';

import { BeautyRecordService } from '../application/services/beauty-record.service';

import { BeautyDashboardHandler } from '../application/handlers/beauty-dashboard.handler';

import {
  BeautyPatientSummaryHandler,
  BeautyTimelineHandler,
  DeleteBeautyAnnotationHandler,
  UpdateBeautyAnnotationHandler,
} from '../application/handlers/beauty-extended.handlers';

import {
  ApproveBeautyPlanHandler,
  AssertBeautyConsentHandler,
  ExportBeautyRecordHandler,
} from '../application/handlers/beauty-plan.handlers';

import { TenantContextService } from '../../../infrastructure/tenant-context.service';

import { TenantContextContract } from '../../../contracts/tenant-context.contract';

import { logDeprecatedBeautyRoute } from '../api/legacy-route-telemetry';



@Controller('beauty')

@UseGuards(BeautyPermissionGuard)

@RequireLicensedModule('beauty')

export class BeautyController {

  constructor(

    private readonly recordService: BeautyRecordService,

    private readonly tenant: TenantContextService,

    private readonly listProcedureMaterialsHandler: ListBeautyProcedureMaterialsHandler,

    private readonly createProcedureMaterialHandler: CreateBeautyProcedureMaterialHandler,

    private readonly searchClinicalInventoryHandler: SearchBeautyClinicalInventoryHandler,

    private readonly listPatientMaterialsHandler: ListPatientBeautyMaterialsHandler,

    private readonly consumeMaterialHandler: ConsumeBeautyMaterialHandler,

    private readonly dashboardHandler: BeautyDashboardHandler,

    private readonly patientSummaryHandler: BeautyPatientSummaryHandler,

    private readonly timelineHandler: BeautyTimelineHandler,

    private readonly updateAnnotationHandler: UpdateBeautyAnnotationHandler,

    private readonly deleteAnnotationHandler: DeleteBeautyAnnotationHandler,

    private readonly approvePlanHandler: ApproveBeautyPlanHandler,

    private readonly exportRecordHandler: ExportBeautyRecordHandler,

    private readonly assertConsentHandler: AssertBeautyConsentHandler,

  ) {}



  private async tenantId(): Promise<string> {

    const ctx = (await this.tenant.resolve()) as TenantContextContract;

    return ctx.tenantId;

  }



  @Get('metrics/summary')

  @RequirePermission('api.beauty', 'view')

  async metrics() {

    return this.recordService.getMetrics(await this.tenantId());

  }



  @Get('overview')

  @RequirePermission('api.beauty', 'view')

  async overview(@Query('limit') limit?: string) {

    return this.recordService.listOverview(await this.tenantId(), limit ? Number(limit) : undefined);

  }



  @Get('analytics')
  @RequirePermission('api.beauty', 'view')
  async analytics() {
    return this.recordService.getAnalytics(await this.tenantId());
  }

  @Get('dashboard')
  @RequirePermission('api.beauty', 'view')
  async dashboard() {
    return this.dashboardHandler.execute();
  }

  @Get('patients/:patientId/summary')
  @RequirePermission('api.beauty', 'view')
  async patientSummary(@Param('patientId') patientId: string) {
    return this.patientSummaryHandler.execute(patientId);
  }

  @Get('patients/:patientId/timeline')
  @RequirePermission('api.beauty', 'view')
  async timeline(@Param('patientId') patientId: string, @Query('limit') limit?: string) {
    return this.timelineHandler.execute(patientId, limit ? Number(limit) : undefined);
  }

  @Patch('annotations/:annotationId')
  @RequirePermission('api.beauty', 'update')
  async updateAnnotation(
    @Param('annotationId') annotationId: string,
    @Body() body: { zone?: string; treatment?: string; parameters?: Record<string, unknown>; notes?: string | null },
  ) {
    return this.updateAnnotationHandler.execute(annotationId, body);
  }

  @Post('annotations/:annotationId/delete')
  @RequirePermission('api.beauty', 'delete')
  async deleteAnnotation(@Param('annotationId') annotationId: string) {
    return this.deleteAnnotationHandler.execute(annotationId);
  }

  @Post('record/:patientId/plans/:planId/approve')
  @RequirePermission('api.beauty', 'approve')
  async approvePlan(
    @Param('patientId') patientId: string,
    @Param('planId') planId: string,
    @Req() req: { user?: { userId?: string; sub?: string } },
  ) {
    const approvedBy = req.user?.userId ?? req.user?.sub ?? '';
    return this.approvePlanHandler.execute(patientId, planId, approvedBy);
  }

  @Get('patients/:patientId/export')
  @RequirePermission('api.beauty', 'export')
  async exportRecord(@Param('patientId') patientId: string) {
    return this.exportRecordHandler.execute(patientId);
  }

  @Get('patients/:patientId/consent/:type')
  @RequirePermission('api.beauty', 'view')
  async checkConsent(@Param('patientId') patientId: string, @Param('type') type: 'photo' | 'treatment') {
    return this.assertConsentHandler.execute(patientId, type);
  }

  @Get('record/:patientId')

  @RequirePermission('api.beauty', 'view')

  async getRecord(@Param('patientId') patientId: string) {

    const record = await this.recordService.getRecord(await this.tenantId(), patientId);

    if (!record) return null;

    return record;

  }



  @Post('record')

  @RequirePermission('api.beauty', 'create')

  async createRecord(@Body() body: CreateBeautyRecordDto) {

    return this.recordService.createRecord(await this.tenantId(), body.patientId);

  }



  @Patch('record/:patientId')

  @RequirePermission('api.beauty', 'update')

  async updateRecord(
    @Param('patientId') patientId: string,
    @Body() body: UpdateBeautyRecordDto,
    @CurrentUser() user: JwtClaimsVO,
  ) {
    return this.recordService.updateBodyMapState(
      await this.tenantId(),
      patientId,
      body.bodyMapState,
      user.sub,
    );
  }



  @Post('record/:patientId/annotations')

  @RequirePermission('api.beauty', 'create')

  async addAnnotation(

    @Param('patientId') patientId: string,

    @Body() body: CreateBeautyAnnotationDto,

    @Req() req: { user?: { userId?: string; sub?: string } },

  ) {

    const userId = req.user?.userId ?? req.user?.sub ?? '';

    return this.recordService.addAnnotation(await this.tenantId(), patientId, userId, body);

  }



  @Get('procedure-materials')
  @RequirePermission('api.beauty', 'view')
  async listProcedureMaterials(@Query('procedureCode') procedureCode?: string) {
    return this.listProcedureMaterialsHandler.execute(procedureCode ?? '');
  }

  @Post('procedure-materials')
  @RequirePermission('api.beauty', 'manage')
  async createProcedureMaterial(@Body() body: CreateBeautyProcedureMaterialDTO) {
    return this.createProcedureMaterialHandler.execute({
      procedureCode: body.procedureCode,
      itemId: body.itemId,
      defaultQuantity: body.defaultQuantity,
      notes: body.notes ?? null,
    });
  }

  @Get('clinical-inventory/items')
  @RequirePermission('api.beauty', 'view')
  async searchClinicalInventory(
    @Query('q') q?: string,
    @Query('limit') limit?: string,
  ) {
    return this.searchClinicalInventoryHandler.execute({
      q,
      limit: limit ? Number(limit) : undefined,
    });
  }

  @Get('record/:patientId/materials')
  @RequirePermission('api.beauty', 'view')
  async listPatientMaterials(
    @Param('patientId') patientId: string,
    @Query('procedureCode') procedureCode?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.listPatientMaterialsHandler.execute(patientId, {
      procedureCode,
      limit: limit ? Number(limit) : undefined,
      offset: offset ? Number(offset) : undefined,
    });
  }

  @Post('record/:patientId/materials')
  @RequirePermission('api.beauty', 'update')
  async consumePatientMaterial(
    @Param('patientId') patientId: string,
    @Body() body: ConsumeBeautyMaterialDTO,
    @CurrentUser() user: JwtClaimsVO,
  ) {
    return this.consumeMaterialHandler.execute(patientId, {
      itemId: body.itemId,
      quantity: body.quantity,
      procedureCode: body.procedureCode ?? null,
      encounterId: body.encounterId ?? null,
      notes: body.notes ?? null,
      warehouseId: body.warehouseId ?? null,
      consumedBy: user.sub,
    });
  }

  @Post('record/:patientId/materials/batch')
  @RequirePermission('api.beauty', 'update')
  async consumePatientMaterialsBatch(
    @Param('patientId') patientId: string,
    @Body() body: ConsumeBeautyMaterialsBatchDTO,
    @CurrentUser() user: JwtClaimsVO,
  ) {
    const results = [];
    for (const line of body.items) {
      const result = await this.consumeMaterialHandler.execute(patientId, {
        itemId: line.itemId,
        quantity: line.quantity,
        procedureCode: body.procedureCode ?? null,
        encounterId: body.encounterId ?? null,
        notes: body.notes ?? null,
        consumedBy: user.sub,
      });
      results.push(result);
    }
    return { consumed: results.length, results };
  }



  /**
   * @deprecated Use `POST /beauty/record` and {@link BeautyRecordService.createRecord} instead.
   * @see docs/BEAUTY_API.md
   */
  @Post('service')
  @Header('Deprecation', 'true')
  @Header('Sunset', 'Sat, 15 Sep 2026 00:00:00 GMT')
  @Header('Link', '</beauty/record>; rel="successor-version"')
  @RequirePermission('api.beauty', 'create')
  async createService(
    @Req() req: { user?: { userId?: string; sub?: string } },
  ) {
    logDeprecatedBeautyRoute({
      method: 'POST',
      path: '/beauty/service',
      replacement: 'POST /beauty/record',
      tenantId: await this.tenantId(),
      userId: req.user?.userId ?? req.user?.sub,
    });

    throw new GoneException({
      message: 'Legacy beauty service endpoint removed. Use POST /beauty/record instead.',
      successor: '/beauty/record',
    });
  }



  /**
   * @deprecated Use `GET /beauty/record/:patientId` and {@link BeautyRecordService.getRecord} instead.
   * @see docs/BEAUTY_API.md
   */
  @Get('service/:id')
  @Header('Deprecation', 'true')
  @Header('Sunset', 'Sat, 15 Sep 2026 00:00:00 GMT')
  @Header('Link', '</beauty/record/:patientId>; rel="successor-version"')
  @RequirePermission('api.beauty', 'view')
  async getService(
    @Param('id') id: string,
    @Req() req: { user?: { userId?: string; sub?: string } },
  ) {
    logDeprecatedBeautyRoute({
      method: 'GET',
      path: '/beauty/service/:id',
      replacement: 'GET /beauty/record/:patientId',
      tenantId: await this.tenantId(),
      userId: req.user?.userId ?? req.user?.sub,
    });

    throw new GoneException({
      message: 'Legacy beauty service endpoint removed. Use GET /beauty/record/:patientId instead.',
      successor: '/beauty/record/:patientId',
    });
  }

}


