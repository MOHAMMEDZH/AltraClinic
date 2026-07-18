import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards, Req } from '@nestjs/common';
import { IsArray, IsBoolean, IsNumber, IsOptional, IsString, MaxLength } from 'class-validator';
import { TenantScopedAccessGuard } from '../../../common/tenant-scoped-access.guard';
import { RequirePermission } from '../../auth/api/guards/permission.guard';
import { RequireLicensedModule } from '../../subscription/api/decorators/require-licensed-module.decorator';
import {
  EmrClinicalSearchHandler,
  EmrDashboardHandler,
  ListPatientProblemsHandler,
  CreatePatientProblemHandler,
  ResolvePatientProblemHandler,
  GetPrescriptionHistoryHandler,
} from '../application/handlers/emr-extended.handlers';
import {
  CheckDrugInteractionsHandler,
  CreateEmrTreatmentPlanHandler,
  CreateLabResultHandler,
  CreateNoteTemplateHandler,
  DeleteNoteTemplateHandler,
  ListLabResultsHandler,
  ListNoteTemplatesHandler,
  ListPatientTreatmentPlansHandler,
  UpdateEmrTreatmentItemStatusHandler,
  UpdateEmrTreatmentPlanHandler,
  UpdateNoteTemplateHandler,
} from '../application/handlers/emr-supplementary.handlers';

class CreateProblemBody {
  @IsString() @MaxLength(500) description!: string;
  @IsOptional() @IsString() code?: string | null;
  @IsOptional() @IsString() codingSystem?: string | null;
  @IsOptional() @IsString() onsetDate?: string | null;
}

class CreateLabResultBody {
  @IsOptional() @IsString() encounterId?: string | null;
  @IsString() @MaxLength(200) testName!: string;
  @IsString() @MaxLength(100) value!: string;
  @IsOptional() @IsString() unit?: string | null;
  @IsOptional() @IsString() referenceRange?: string | null;
  @IsOptional() @IsString() status?: string | null;
  @IsString() resultedAt!: string;
  @IsOptional() @IsString() notes?: string | null;
}

class NoteTemplateBody {
  @IsOptional() @IsString() @MaxLength(200) name?: string;
  @IsOptional() @IsString() noteType?: string;
  @IsOptional() soapNotes?: { subjective?: string; objective?: string; assessment?: string; plan?: string };
  @IsOptional() @IsString() body?: string | null;
  @IsOptional() @IsBoolean() isActive?: boolean;
  @IsOptional() @IsNumber() sortOrder?: number;
}

class DrugCheckBody {
  @IsArray() @IsString({ each: true }) medications!: string[];
  @IsOptional() @IsArray() @IsString({ each: true }) allergies?: string[];
}

class CreateCarePlanBody {
  @IsString() @MaxLength(200) title!: string;
  @IsOptional() @IsString() clinicalNotes?: string | null;
  @IsOptional()
  items?: Array<{ code: string; description: string; estimatedCost?: number }>;
}

class UpdateCarePlanBody {
  @IsOptional() @IsString() @MaxLength(200) title?: string;
  @IsOptional() @IsString() clinicalNotes?: string | null;
  @IsOptional()
  items?: Array<{ id?: string; code: string; description: string; estimatedCost?: number; status?: string }>;
}

class UpdateItemStatusBody {
  @IsString() status!: string;
}

@Controller('emr')
@UseGuards(TenantScopedAccessGuard)
@RequireLicensedModule('emr')
export class EmrController {
  constructor(
    private readonly dashboard: EmrDashboardHandler,
    private readonly search: EmrClinicalSearchHandler,
    private readonly listProblems: ListPatientProblemsHandler,
    private readonly createProblem: CreatePatientProblemHandler,
    private readonly resolveProblem: ResolvePatientProblemHandler,
    private readonly prescriptionHistory: GetPrescriptionHistoryHandler,
    private readonly listLabs: ListLabResultsHandler,
    private readonly createLab: CreateLabResultHandler,
    private readonly listTemplates: ListNoteTemplatesHandler,
    private readonly createTemplate: CreateNoteTemplateHandler,
    private readonly updateTemplate: UpdateNoteTemplateHandler,
    private readonly deleteTemplate: DeleteNoteTemplateHandler,
    private readonly listTreatmentPlans: ListPatientTreatmentPlansHandler,
    private readonly createCarePlan: CreateEmrTreatmentPlanHandler,
    private readonly updateCarePlan: UpdateEmrTreatmentPlanHandler,
    private readonly updateItemStatus: UpdateEmrTreatmentItemStatusHandler,
    private readonly drugCheck: CheckDrugInteractionsHandler,
  ) {}

  @Get('dashboard')
  @RequirePermission('api.emr', 'view')
  async getDashboard() {
    return this.dashboard.execute();
  }

  @Get('search')
  @RequirePermission('api.emr', 'view')
  async clinicalSearch(@Query('q') q?: string, @Query('limit') limit?: string) {
    return this.search.execute(q ?? '', limit ? Number(limit) : undefined);
  }

  @Post('drug-interactions/check')
  @RequirePermission('api.emr', 'view')
  async checkDrugs(@Body() body: DrugCheckBody) {
    return this.drugCheck.execute(body.medications, body.allergies ?? []);
  }

  @Get('note-templates')
  @RequirePermission('api.emr', 'view')
  async noteTemplates(@Query('all') all?: string) {
    return this.listTemplates.execute(all !== '1');
  }

  @Post('note-templates')
  @RequirePermission('api.emr', 'update')
  async createNoteTemplate(@Body() body: NoteTemplateBody) {
    return this.createTemplate.execute({
      name: body.name ?? 'Untitled template',
      noteType: body.noteType ?? 'consultation',
      soapNotes: body.soapNotes,
      body: body.body,
      sortOrder: body.sortOrder,
    });
  }

  @Patch('note-templates/:id')
  @RequirePermission('api.emr', 'update')
  async updateNoteTemplate(@Param('id') id: string, @Body() body: NoteTemplateBody) {
    return this.updateTemplate.execute(id, body);
  }

  @Delete('note-templates/:id')
  @RequirePermission('api.emr', 'update')
  async deleteNoteTemplate(@Param('id') id: string) {
    return this.deleteTemplate.execute(id);
  }

  @Get('patients/:patientId/problems')
  @RequirePermission('api.emr', 'view')
  async problems(@Param('patientId') patientId: string, @Query('status') status?: string) {
    return this.listProblems.execute(patientId, status);
  }

  @Post('patients/:patientId/problems')
  @RequirePermission('api.emr', 'update')
  async addProblem(@Param('patientId') patientId: string, @Body() body: CreateProblemBody) {
    return this.createProblem.execute(patientId, body);
  }

  @Get('patients/:patientId/prescriptions/history')
  @RequirePermission('api.emr', 'view')
  async prescriptions(@Param('patientId') patientId: string) {
    return this.prescriptionHistory.execute(patientId);
  }

  @Get('patients/:patientId/lab-results')
  @RequirePermission('api.emr', 'view')
  async labResults(@Param('patientId') patientId: string, @Query('encounterId') encounterId?: string) {
    return this.listLabs.execute(patientId, encounterId);
  }

  @Post('patients/:patientId/lab-results')
  @RequirePermission('api.emr', 'update')
  async addLabResult(@Param('patientId') patientId: string, @Body() body: CreateLabResultBody) {
    return this.createLab.execute(patientId, body);
  }

  @Get('patients/:patientId/treatment-plans')
  @RequirePermission('api.emr', 'view')
  async treatmentPlans(@Param('patientId') patientId: string) {
    return this.listTreatmentPlans.execute(patientId);
  }

  @Post('patients/:patientId/treatment-plans')
  @RequirePermission('api.emr', 'update')
  async createTreatmentPlan(
    @Param('patientId') patientId: string,
    @Body() body: CreateCarePlanBody,
    @Req() req: { user?: { userId?: string; sub?: string } },
  ) {
    const userId = req.user?.userId ?? req.user?.sub ?? '';
    return this.createCarePlan.execute(userId, { ...body, patientId });
  }

  @Patch('treatment-plans/:planId')
  @RequirePermission('api.emr', 'update')
  async updateTreatmentPlan(@Param('planId') planId: string, @Body() body: UpdateCarePlanBody) {
    return this.updateCarePlan.execute(planId, body);
  }

  @Patch('treatment-plans/:planId/items/:itemId/status')
  @RequirePermission('api.emr', 'update')
  async updateTreatmentItemStatus(
    @Param('planId') planId: string,
    @Param('itemId') itemId: string,
    @Body() body: UpdateItemStatusBody,
    @Req() req: { user?: { userId?: string; sub?: string } },
  ) {
    const userId = req.user?.userId ?? req.user?.sub ?? '';
    return this.updateItemStatus.execute(planId, itemId, userId, body.status);
  }

  @Patch('problems/:problemId/resolve')
  @RequirePermission('api.emr', 'update')
  async resolveProblemRoute(@Param('problemId') problemId: string) {
    return this.resolveProblem.execute(problemId);
  }
}
