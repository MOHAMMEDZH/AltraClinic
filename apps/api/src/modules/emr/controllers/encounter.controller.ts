import { Body, Controller, Get, Param, Patch, Post, Query, NotFoundException, UseGuards, Req } from '@nestjs/common';
import { TenantScopedAccessGuard } from '../../../common/tenant-scoped-access.guard';
import { RequirePermission } from '../../auth/api/guards/permission.guard';
import { RequireLicensedModule } from '../../subscription/api/decorators/require-licensed-module.decorator';
import { CreateEncounterDTO } from '../application/dto/create-encounter.dto';
import { UpdateEncounterDTO } from '../application/dto/update-encounter.dto';
import { CreateEncounterHandler } from '../application/handlers/create-encounter.handler';
import { GetEncounterHandler } from '../application/handlers/get-encounter.handler';
import {
  EmrMetricsHandler,
  ListEncountersHandler,
  UpdateEncounterHandler,
} from '../application/handlers/encounter.handlers';
import { ListEncounterMaterialsHandler } from '../application/handlers/list-encounter-materials.handler';
import { ConsumeEncounterMaterialHandler } from '../application/handlers/consume-encounter-material.handler';
import { SearchClinicalInventoryHandler } from '../application/handlers/search-clinical-inventory.handler';
import { ConsumeEncounterMaterialDTO } from '../application/dto/consume-encounter-material.dto';
import {
  AppendVitalsHandler,
  CompleteEncounterHandler,
  GetEncounterAuditHandler,
  SignEncounterHandler,
  UpdateSoapNotesHandler,
} from '../application/handlers/emr-extended.handlers';
import {
  GetEncounterBillingHandler,
  RecordMedicationRefillHandler,
  UpdateStructuredNotesHandler,
  CoSignEncounterHandler,
} from '../application/handlers/emr-supplementary.handlers';
import { IsArray, IsNumber, IsOptional, IsString } from 'class-validator';

class VitalsBody {
  @IsArray()
  observations!: { type: string; value: string; unit?: string }[];
}

class SoapBody {
  @IsOptional() @IsString() subjective?: string;
  @IsOptional() @IsString() objective?: string;
  @IsOptional() @IsString() assessment?: string;
  @IsOptional() @IsString() plan?: string;
}

class StructuredNotesBody {
  @IsArray()
  notes!: Array<{
    id: string;
    type: string;
    title?: string | null;
    body?: string | null;
    soap?: SoapBody;
    createdAt: string;
  }>;
}

class RefillBody {
  @IsNumber()
  medicationIndex!: number;
}

@Controller('emr/encounters')
@UseGuards(TenantScopedAccessGuard)
@RequireLicensedModule('emr')
export class EncounterController {
  constructor(
    private readonly createHandler: CreateEncounterHandler,
    private readonly getHandler: GetEncounterHandler,
    private readonly listHandler: ListEncountersHandler,
    private readonly metricsHandler: EmrMetricsHandler,
    private readonly updateHandler: UpdateEncounterHandler,
    private readonly listMaterialsHandler: ListEncounterMaterialsHandler,
    private readonly consumeMaterialHandler: ConsumeEncounterMaterialHandler,
    private readonly searchClinicalInventoryHandler: SearchClinicalInventoryHandler,
    private readonly completeHandler: CompleteEncounterHandler,
    private readonly signHandler: SignEncounterHandler,
    private readonly vitalsHandler: AppendVitalsHandler,
    private readonly auditHandler: GetEncounterAuditHandler,
    private readonly soapHandler: UpdateSoapNotesHandler,
    private readonly structuredNotesHandler: UpdateStructuredNotesHandler,
    private readonly refillHandler: RecordMedicationRefillHandler,
    private readonly billingHandler: GetEncounterBillingHandler,
    private readonly coSignHandler: CoSignEncounterHandler,
  ) {}

  @Get('metrics/summary')
  @RequirePermission('api.emr', 'view')
  async metrics() {
    return this.metricsHandler.execute();
  }

  @Get()
  @RequirePermission('api.emr', 'view')
  async list(
    @Query('q') q?: string,
    @Query('patientId') patientId?: string,
    @Query('clinicianId') clinicianId?: string,
    @Query('appointmentId') appointmentId?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('status') status?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.listHandler.execute({
      q,
      patientId,
      clinicianId,
      appointmentId,
      from,
      to,
      status,
      limit: limit ? Number(limit) : undefined,
      offset: offset ? Number(offset) : undefined,
    });
  }

  @Post()
  @RequirePermission('api.emr', 'create')
  async create(
    @Body() body: CreateEncounterDTO,
    @Req() req: { user?: { userId?: string; sub?: string } },
  ) {
    const userId = req.user?.userId ?? req.user?.sub;
    const result = await this.createHandler.execute({
      patientId: body.patientId,
      clinicianId: body.clinicianId,
      chiefComplaint: body.chiefComplaint,
      clinicalNotes: body.clinicalNotes,
      appointmentId: body.appointmentId,
      followUpDate: body.followUpDate,
      diagnoses: body.diagnoses ?? [],
      medications: body.medications ?? [],
      observations: body.observations ?? [],
    }, userId);
    return { id: result.encounterId };
  }

  @Get('clinical-inventory/items')
  @RequirePermission('api.emr', 'view')
  async searchClinicalInventory(
    @Query('q') q?: string,
    @Query('limit') limit?: string,
  ) {
    return this.searchClinicalInventoryHandler.execute({
      q,
      limit: limit ? Number(limit) : undefined,
    });
  }

  @Get(':id/materials')
  @RequirePermission('api.emr', 'view')
  async listMaterials(
    @Param('id') id: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.listMaterialsHandler.execute(id, {
      limit: limit ? Number(limit) : undefined,
      offset: offset ? Number(offset) : undefined,
    });
  }

  @Post(':id/materials')
  @RequirePermission('api.emr', 'update')
  async consumeMaterial(
    @Param('id') id: string,
    @Body() body: ConsumeEncounterMaterialDTO,
    @Req() req: { user?: { userId?: string; sub?: string } },
  ) {
    const userId = req.user?.userId ?? req.user?.sub ?? '';
    return this.consumeMaterialHandler.execute(id, {
      itemId: body.itemId,
      quantity: body.quantity,
      notes: body.notes ?? null,
      warehouseId: body.warehouseId ?? null,
      consumedBy: userId,
    });
  }

  @Get(':id/audit')
  @RequirePermission('api.emr', 'view')
  async audit(@Param('id') id: string) {
    return this.auditHandler.execute(id);
  }

  @Post(':id/complete')
  @RequirePermission('api.emr', 'update')
  async complete(@Param('id') id: string, @Req() req: { user?: { userId?: string; sub?: string } }) {
    const userId = req.user?.userId ?? req.user?.sub;
    return this.completeHandler.execute(id, userId);
  }

  @Post(':id/sign')
  @RequirePermission('api.emr', 'approve')
  async sign(@Param('id') id: string, @Req() req: { user?: { userId?: string; sub?: string } }) {
    const userId = req.user?.userId ?? req.user?.sub ?? '';
    return this.signHandler.execute(id, userId);
  }

  @Post(':id/vitals')
  @RequirePermission('api.emr', 'update')
  async vitals(
    @Param('id') id: string,
    @Body() body: VitalsBody,
    @Req() req: { user?: { userId?: string; sub?: string } },
  ) {
    const userId = req.user?.userId ?? req.user?.sub;
    return this.vitalsHandler.execute(id, body.observations, userId);
  }

  @Patch(':id/soap')
  @RequirePermission('api.emr', 'update')
  async soap(
    @Param('id') id: string,
    @Body() body: SoapBody,
    @Req() req: { user?: { userId?: string; sub?: string } },
  ) {
    const userId = req.user?.userId ?? req.user?.sub;
    return this.soapHandler.execute(id, body, userId);
  }

  @Patch(':id/structured-notes')
  @RequirePermission('api.emr', 'update')
  async structuredNotes(
    @Param('id') id: string,
    @Body() body: StructuredNotesBody,
    @Req() req: { user?: { userId?: string; sub?: string } },
  ) {
    const userId = req.user?.userId ?? req.user?.sub;
    return this.structuredNotesHandler.execute(id, body.notes, userId);
  }

  @Post(':id/refill')
  @RequirePermission('api.emr', 'update')
  async refill(
    @Param('id') id: string,
    @Body() body: RefillBody,
    @Req() req: { user?: { userId?: string; sub?: string } },
  ) {
    const userId = req.user?.userId ?? req.user?.sub;
    return this.refillHandler.execute(id, body.medicationIndex, userId);
  }

  @Post(':id/co-sign')
  @RequirePermission('api.emr', 'approve')
  async coSign(@Param('id') id: string, @Req() req: { user?: { userId?: string; sub?: string } }) {
    const userId = req.user?.userId ?? req.user?.sub ?? '';
    return this.coSignHandler.execute(id, userId);
  }

  @Get(':id/billing')
  @RequirePermission('api.emr', 'view')
  async billing(@Param('id') id: string) {
    return this.billingHandler.execute(id);
  }

  @Get(':id')
  @RequirePermission('api.emr', 'view')
  async get(@Param('id') id: string) {
    const result = await this.getHandler.execute({ id });
    if (!result) throw new NotFoundException('Encounter not found');
    return result;
  }

  @Patch(':id')
  @RequirePermission('api.emr', 'update')
  async update(
    @Param('id') id: string,
    @Body() body: UpdateEncounterDTO,
    @Req() req: { user?: { userId?: string; sub?: string } },
  ) {
    const userId = req.user?.userId ?? req.user?.sub;
    return this.updateHandler.execute(id, body, userId);
  }
}
