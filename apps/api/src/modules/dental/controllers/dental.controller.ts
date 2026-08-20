import { BadRequestException, Body, Controller, Get, Param, Patch, Post, Query, NotFoundException, UseGuards } from '@nestjs/common';

import { DentalPermissionGuard } from '../api/dental-permission.guard';

import { RequirePermission } from '../../auth/api/guards/permission.guard';
import { RequireLicensedModule } from '../../subscription/api/decorators/require-licensed-module.decorator';

import { CurrentUser } from '../../auth/api/decorators/current-user.decorator';

import { JwtClaimsVO } from '../../auth/domain/value-objects/jwt-claims.vo';

import { CreateTreatmentDTO } from '../application/dto/create-treatment.dto';

import { CreateDentalChartDTO, UpdateDentalTeethDTO } from '../application/dto/dental.dto';

import {

  CreateTreatmentPlanDTO,

  RecordConsentDTO,

  UpdateItemStatusDTO,

  UpdateTreatmentPlanDTO,

} from '../application/dto/treatment-plan.dto';

import { CreateTreatmentHandler } from '../application/handlers/create-treatment.handler';

import { GetDentalChartHandler } from '../application/handlers/get-dental-chart.handler';

import {

  ApproveTreatmentPlanHandler,

  CreateTreatmentPlanHandler,

  GetTreatmentPlanHandler,

  ListTreatmentPlansHandler,

  RecordTreatmentConsentHandler,

  SubmitTreatmentPlanHandler,

  TreatmentPlanAnalyticsHandler,

  UpdateTreatmentItemStatusHandler,

  UpdateTreatmentPlanHandler,

} from '../application/handlers/treatment-plan.handlers';

import {

  CreateDentalChartHandler,

  DentalMetricsHandler,

  DentalOverviewHandler,

  UpdateDentalTeethHandler,

} from '../application/handlers/dental.handlers';

import {

  ComparePeriodontalExamsHandler,

  CreatePeriodontalExamHandler,

  GetPeriodontalExamHandler,

  ListPeriodontalExamsHandler,

  PeriodontalProgressHandler,

  UpdatePeriodontalExamHandler,

} from '../application/handlers/perio.handlers';

import { CreatePeriodontalExamDTO, UpdatePeriodontalExamDTO } from '../application/dto/perio.dto';
import {
  CreateDentalClinicalNoteDTO,
  CreateImplantRecordDTO,
  CreateOrthodonticCaseDTO,
  UpdateImplantRecordDTO,
  UpdateOdontogramModeDTO,
  UpdateOrthodonticCaseDTO,
} from '../application/dto/dental-extended.dto';
import {
  CreateDentalClinicalNoteHandler,
  CreateImplantRecordHandler,
  CreateOrthodonticCaseHandler,
  CreateTreatmentPlanInvoiceHandler,
  DentalPatientSummaryHandler,
  DentalTimelineHandler,
  ListDentalClinicalNotesHandler,
  ListImplantRecordsHandler,
  ListOrthodonticCasesHandler,
  UpdateImplantRecordHandler,
  UpdateOdontogramModeHandler,
  UpdateOrthodonticCaseHandler,
} from '../application/handlers/dental-extended.handlers';
import { DentalDashboardHandler } from '../application/handlers/dental-dashboard.handler';
import {
  ConsumeDentalMaterialDTO,
  ConsumeDentalMaterialsBatchDTO,
  CreateDentalProcedureMaterialDTO,
} from '../application/dto/dental-material.dto';
import {
  ConsumeDentalMaterialHandler,
  CreateDentalProcedureMaterialHandler,
  ListDentalProcedureMaterialsHandler,
  ListPatientDentalMaterialsHandler,
  SearchDentalClinicalInventoryHandler,
} from '../application/handlers/dental-material.handlers';



@Controller('dental')

@UseGuards(DentalPermissionGuard)

@RequireLicensedModule('dental')

export class DentalController {

  constructor(

    private readonly createHandler: CreateTreatmentHandler,

    private readonly getHandler: GetDentalChartHandler,

    private readonly createChartHandler: CreateDentalChartHandler,

    private readonly updateTeethHandler: UpdateDentalTeethHandler,

    private readonly metricsHandler: DentalMetricsHandler,

    private readonly overviewHandler: DentalOverviewHandler,

    private readonly listPlansHandler: ListTreatmentPlansHandler,

    private readonly getPlanHandler: GetTreatmentPlanHandler,

    private readonly createPlanHandler: CreateTreatmentPlanHandler,

    private readonly updatePlanHandler: UpdateTreatmentPlanHandler,

    private readonly submitPlanHandler: SubmitTreatmentPlanHandler,

    private readonly approvePlanHandler: ApproveTreatmentPlanHandler,

    private readonly consentPlanHandler: RecordTreatmentConsentHandler,

    private readonly updateItemStatusHandler: UpdateTreatmentItemStatusHandler,

    private readonly planAnalyticsHandler: TreatmentPlanAnalyticsHandler,

    private readonly listPerioHandler: ListPeriodontalExamsHandler,

    private readonly getPerioHandler: GetPeriodontalExamHandler,

    private readonly createPerioHandler: CreatePeriodontalExamHandler,

    private readonly updatePerioHandler: UpdatePeriodontalExamHandler,

    private readonly perioProgressHandler: PeriodontalProgressHandler,

    private readonly comparePerioHandler: ComparePeriodontalExamsHandler,

    private readonly listProcedureMaterialsHandler: ListDentalProcedureMaterialsHandler,

    private readonly createProcedureMaterialHandler: CreateDentalProcedureMaterialHandler,

    private readonly listPatientMaterialsHandler: ListPatientDentalMaterialsHandler,

    private readonly consumeMaterialHandler: ConsumeDentalMaterialHandler,

    private readonly searchClinicalInventoryHandler: SearchDentalClinicalInventoryHandler,

    private readonly patientSummaryHandler: DentalPatientSummaryHandler,

    private readonly timelineHandler: DentalTimelineHandler,

    private readonly listOrthoHandler: ListOrthodonticCasesHandler,

    private readonly createOrthoHandler: CreateOrthodonticCaseHandler,

    private readonly updateOrthoHandler: UpdateOrthodonticCaseHandler,

    private readonly listImplantsHandler: ListImplantRecordsHandler,

    private readonly createImplantHandler: CreateImplantRecordHandler,

    private readonly updateImplantHandler: UpdateImplantRecordHandler,

    private readonly listNotesHandler: ListDentalClinicalNotesHandler,

    private readonly createNoteHandler: CreateDentalClinicalNoteHandler,

    private readonly updateModeHandler: UpdateOdontogramModeHandler,

    private readonly createPlanInvoiceHandler: CreateTreatmentPlanInvoiceHandler,

    private readonly dashboardHandler: DentalDashboardHandler,

  ) {}



  @Get('metrics/summary')

  @RequirePermission('api.dental', 'view')

  async metrics() {

    return this.metricsHandler.execute();

  }

  @Get('dashboard')
  @RequirePermission('api.dental', 'view')
  async dashboard() {
    return this.dashboardHandler.execute();
  }



  @Get('overview')

  @RequirePermission('api.dental', 'view')

  async overview(@Query('limit') limit?: string) {

    return this.overviewHandler.execute(limit ? Number(limit) : undefined);

  }



  @Get('procedure-materials')
  @RequirePermission('api.dental', 'view')
  async listProcedureMaterials(@Query('procedureCode') procedureCode?: string) {
    return this.listProcedureMaterialsHandler.execute(procedureCode ?? '');
  }

  @Post('procedure-materials')
  @RequirePermission('api.dental', 'manage')
  async createProcedureMaterial(@Body() body: CreateDentalProcedureMaterialDTO) {
    return this.createProcedureMaterialHandler.execute({
      procedureCode: body.procedureCode,
      itemId: body.itemId,
      defaultQuantity: body.defaultQuantity,
      notes: body.notes ?? null,
    });
  }

  @Get('clinical-inventory/items')
  @RequirePermission('api.dental', 'view')
  async searchClinicalInventory(
    @Query('q') q?: string,
    @Query('limit') limit?: string,
  ) {
    return this.searchClinicalInventoryHandler.execute({
      q,
      limit: limit ? Number(limit) : undefined,
    });
  }

  @Get('chart/:patientId/materials')
  @RequirePermission('api.dental', 'view')
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

  @Post('chart/:patientId/materials')
  @RequirePermission('api.dental', 'update')
  async consumePatientMaterial(
    @Param('patientId') patientId: string,
    @Body() body: ConsumeDentalMaterialDTO,
    @CurrentUser() user: JwtClaimsVO,
  ) {
    return this.consumeMaterialHandler.execute(patientId, {
      itemId: body.itemId,
      quantity: body.quantity,
      procedureCode: body.procedureCode ?? null,
      encounterId: body.encounterId ?? null,
      appointmentId: body.appointmentId ?? null,
      clinicalServiceId: body.clinicalServiceId ?? null,
      notes: body.notes ?? null,
      warehouseId: body.warehouseId ?? null,
      consumedBy: user.sub,
      usedByUserId: body.usedByUserId,
    });
  }

  @Post('chart/:patientId/materials/batch')
  @RequirePermission('api.dental', 'update')
  async consumePatientMaterialsBatch(
    @Param('patientId') patientId: string,
    @Body() body: ConsumeDentalMaterialsBatchDTO,
    @CurrentUser() user: JwtClaimsVO,
  ) {
    const results = [];
    for (const line of body.items) {
      const usedBy = line.usedByUserId ?? body.usedByUserId;
      if (!usedBy?.trim()) {
        throw new BadRequestException(
          'usedByUserId is required for clinical dental material consumption',
        );
      }
      const result = await this.consumeMaterialHandler.execute(patientId, {
        itemId: line.itemId,
        quantity: line.quantity,
        procedureCode: body.procedureCode ?? null,
        encounterId: body.encounterId ?? null,
        notes: body.notes ?? null,
        consumedBy: user.sub,
        usedByUserId: usedBy,
      });
      results.push(result);
    }
    return { consumed: results.length, results };
  }

  @Post('chart')

  @RequirePermission('api.dental', 'create')

  async createChart(@Body() body: CreateDentalChartDTO) {

    return this.createChartHandler.execute(body.patientId);

  }



  @Get('chart/:patientId')

  @RequirePermission('api.dental', 'view')

  async getChart(@Param('patientId') patientId: string) {

    const result = await this.getHandler.execute({ patientId });

    if (!result) throw new NotFoundException('Dental chart not found');

    return result;

  }



  @Patch('chart/:patientId/teeth')

  @RequirePermission('api.dental', 'update')

  async updateTeeth(@Param('patientId') patientId: string, @Body() body: UpdateDentalTeethDTO) {

    return this.updateTeethHandler.execute(patientId, body.teeth);

  }



  @Post('treatment')

  @RequirePermission('api.dental', 'create')

  async createTreatment(@Body() body: CreateTreatmentDTO) {

    return this.createHandler.execute({

      patientId: body.patientId,

      providerId: body.providerId,

      procedures: body.procedures,

      notes: body.notes ?? null,

    });

  }



  @Get('treatment-plans/analytics')

  @RequirePermission('api.dental', 'view')

  async planAnalytics() {

    return this.planAnalyticsHandler.execute();

  }



  @Get('treatment-plans')

  @RequirePermission('api.dental', 'view')

  async listPlans(@Query('patientId') patientId?: string, @Query('status') status?: string) {

    return this.listPlansHandler.execute({ patientId, status });

  }



  @Get('treatment-plans/:planId')

  @RequirePermission('api.dental', 'view')

  async getPlan(@Param('planId') planId: string) {

    return this.getPlanHandler.execute(planId);

  }



  @Post('treatment-plans')

  @RequirePermission('api.dental', 'create')

  async createPlan(@Body() body: CreateTreatmentPlanDTO, @CurrentUser() user: JwtClaimsVO) {

    return this.createPlanHandler.execute(user.sub, body);

  }



  @Patch('treatment-plans/:planId')

  @RequirePermission('api.dental', 'update')

  async updatePlan(@Param('planId') planId: string, @Body() body: UpdateTreatmentPlanDTO) {

    return this.updatePlanHandler.execute(planId, body);

  }



  @Post('treatment-plans/:planId/submit')

  @RequirePermission('api.dental', 'update')

  async submitPlan(@Param('planId') planId: string, @CurrentUser() user: JwtClaimsVO) {

    return this.submitPlanHandler.execute(planId, user.sub);

  }



  @Post('treatment-plans/:planId/approve')

  @RequirePermission('api.dental', 'approve')

  async approvePlan(@Param('planId') planId: string, @CurrentUser() user: JwtClaimsVO) {

    return this.approvePlanHandler.execute(planId, user.sub);

  }



  @Post('treatment-plans/:planId/consent')

  @RequirePermission('api.dental', 'update')

  async recordConsent(

    @Param('planId') planId: string,

    @Body() body: RecordConsentDTO,

    @CurrentUser() user: JwtClaimsVO,

  ) {

    return this.consentPlanHandler.execute(planId, user.sub, body);

  }



  @Patch('treatment-plans/:planId/items/:itemId/status')

  @RequirePermission('api.dental', 'update')

  async updateItemStatus(

    @Param('planId') planId: string,

    @Param('itemId') itemId: string,

    @Body() body: UpdateItemStatusDTO,

    @CurrentUser() user: JwtClaimsVO,

  ) {

    return this.updateItemStatusHandler.execute(planId, itemId, user.sub, body);

  }

  @Get('perio/:patientId/exams')

  @RequirePermission('api.dental', 'view')

  async listPerioExams(@Param('patientId') patientId: string) {

    return this.listPerioHandler.execute(patientId);

  }

  @Get('perio/:patientId/progress')

  @RequirePermission('api.dental', 'view')

  async perioProgress(@Param('patientId') patientId: string) {

    return this.perioProgressHandler.execute(patientId);

  }

  @Get('perio/exams/compare')

  @RequirePermission('api.dental', 'view')

  async comparePerioExams(

    @Query('baselineExamId') baselineExamId: string,

    @Query('compareExamId') compareExamId: string,

  ) {

    return this.comparePerioHandler.execute(baselineExamId, compareExamId);

  }

  @Get('perio/exams/:examId')

  @RequirePermission('api.dental', 'view')

  async getPerioExam(@Param('examId') examId: string) {

    return this.getPerioHandler.execute(examId);

  }

  @Post('perio/:patientId/exams')

  @RequirePermission('api.dental', 'create')

  async createPerioExam(

    @Param('patientId') patientId: string,

    @Body() body: CreatePeriodontalExamDTO,

    @CurrentUser() user: JwtClaimsVO,

  ) {

    return this.createPerioHandler.execute(patientId, user.sub, body);

  }

  @Patch('perio/exams/:examId')

  @RequirePermission('api.dental', 'update')

  async updatePerioExam(@Param('examId') examId: string, @Body() body: UpdatePeriodontalExamDTO) {

    return this.updatePerioHandler.execute(examId, body);

  }

  @Get('patients/:patientId/summary')
  @RequirePermission('api.dental', 'view')
  async patientSummary(@Param('patientId') patientId: string) {
    return this.patientSummaryHandler.execute(patientId);
  }

  @Get('patients/:patientId/timeline')
  @RequirePermission('api.dental', 'view')
  async patientTimeline(@Param('patientId') patientId: string, @Query('limit') limit?: string) {
    return this.timelineHandler.execute(patientId, limit ? Number(limit) : undefined);
  }

  @Patch('chart/:patientId/mode')
  @RequirePermission('api.dental', 'update')
  async updateChartMode(@Param('patientId') patientId: string, @Body() body: UpdateOdontogramModeDTO) {
    return this.updateModeHandler.execute(patientId, body);
  }

  @Get('ortho/:patientId/cases')
  @RequirePermission('api.dental', 'view')
  async listOrthoCases(@Param('patientId') patientId: string) {
    return this.listOrthoHandler.execute(patientId);
  }

  @Post('ortho/cases')
  @RequirePermission('api.dental', 'create')
  async createOrthoCase(@Body() body: CreateOrthodonticCaseDTO, @CurrentUser() user: JwtClaimsVO) {
    return this.createOrthoHandler.execute(user.sub, body);
  }

  @Patch('ortho/cases/:caseId')
  @RequirePermission('api.dental', 'update')
  async updateOrthoCase(@Param('caseId') caseId: string, @Body() body: UpdateOrthodonticCaseDTO) {
    return this.updateOrthoHandler.execute(caseId, body);
  }

  @Get('implants/:patientId')
  @RequirePermission('api.dental', 'view')
  async listImplants(@Param('patientId') patientId: string) {
    return this.listImplantsHandler.execute(patientId);
  }

  @Post('implants')
  @RequirePermission('api.dental', 'create')
  async createImplant(@Body() body: CreateImplantRecordDTO, @CurrentUser() user: JwtClaimsVO) {
    return this.createImplantHandler.execute(user.sub, body);
  }

  @Patch('implants/:implantId')
  @RequirePermission('api.dental', 'update')
  async updateImplant(@Param('implantId') implantId: string, @Body() body: UpdateImplantRecordDTO) {
    return this.updateImplantHandler.execute(implantId, body);
  }

  @Get('notes/:patientId')
  @RequirePermission('api.dental', 'view')
  async listNotes(@Param('patientId') patientId: string) {
    return this.listNotesHandler.execute(patientId);
  }

  @Post('notes')
  @RequirePermission('api.dental', 'create')
  async createNote(@Body() body: CreateDentalClinicalNoteDTO, @CurrentUser() user: JwtClaimsVO) {
    return this.createNoteHandler.execute(user.sub, body);
  }

  @Post('treatment-plans/:planId/invoice')
  @RequirePermission('api.dental', 'update')
  async createPlanInvoice(@Param('planId') planId: string) {
    return this.createPlanInvoiceHandler.execute(planId);
  }

}


