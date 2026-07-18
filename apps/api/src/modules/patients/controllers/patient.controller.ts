import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  NotFoundException,
  UseGuards,
} from '@nestjs/common';
import { TenantScopedAccessGuard } from '../../../common/tenant-scoped-access.guard';
import { RequirePermission } from '../../auth/api/guards/permission.guard';
import { RequireLicensedModule } from '../../subscription/api/decorators/require-licensed-module.decorator';
import { RequireLicensedFeature } from '../../subscription/api/decorators/require-licensed-feature.decorator';
import {
  CreatePatientDTO,
  QuickRegisterPatientDTO,
  UpdatePatientDTO,
  MergePatientsDTO,
  ListPatientsQueryDTO,
} from '../application/dto/patient.dto';
import { CreatePatientHandler } from '../application/handlers/create-patient.handler';
import { GetPatientHandler } from '../application/handlers/get-patient.handler';
import { CreatePatientCommand } from '../application/commands/create-patient.command';
import {
  QuickRegisterPatientHandler,
  ListPatientsHandler,
  UpdatePatientHandler,
  ArchivePatientHandler,
  ReactivatePatientHandler,
  MergePatientsHandler,
  GetPatientTimelineHandler,
  GetPatientDuplicatesHandler,
} from '../application/handlers/patient.handlers';

@Controller('patients')
@UseGuards(TenantScopedAccessGuard)
@RequireLicensedModule('patients')
@RequireLicensedFeature('patients')
export class PatientController {
  constructor(
    private readonly createHandler: CreatePatientHandler,
    private readonly quickRegisterHandler: QuickRegisterPatientHandler,
    private readonly listHandler: ListPatientsHandler,
    private readonly getHandler: GetPatientHandler,
    private readonly updateHandler: UpdatePatientHandler,
    private readonly archiveHandler: ArchivePatientHandler,
    private readonly reactivateHandler: ReactivatePatientHandler,
    private readonly mergeHandler: MergePatientsHandler,
    private readonly timelineHandler: GetPatientTimelineHandler,
    private readonly duplicatesHandler: GetPatientDuplicatesHandler,
  ) {}

  @Get()
  @RequirePermission('api.patients', 'view')
  async list(@Query() query: ListPatientsQueryDTO) {
    return this.listHandler.execute({
      q: query.q,
      status: query.status,
      gender: query.gender,
      branchId: query.branchId,
      limit: query.limit ? Number(query.limit) : undefined,
      offset: query.offset ? Number(query.offset) : undefined,
    });
  }

  @Post('quick')
  @RequirePermission('api.patients', 'create')
  async quickRegister(@Body() body: QuickRegisterPatientDTO) {
    const result = await this.quickRegisterHandler.execute(body);
    return { id: result.patientId };
  }

  @Post('merge')
  @RequirePermission('api.patients', 'manage')
  async merge(@Body() body: MergePatientsDTO) {
    return this.mergeHandler.execute(body.targetId, body.sourceId);
  }

  @Post()
  @RequirePermission('api.patients', 'create')
  async create(@Body() body: CreatePatientDTO) {
    const result = await this.createHandler.execute(
      new CreatePatientCommand(
        body.firstName,
        body.lastName,
        body.dateOfBirth,
        body.gender,
        body.addressLine1,
        body.city,
        body.state,
        body.postalCode,
        body.country,
        body.firstNameAr,
        body.lastNameAr,
        body.phone,
        body.email,
        body.nationalId,
        body.bloodGroup,
        body.notes,
        body.profileData,
      ),
    );
    return { id: result.patientId };
  }

  @Get(':id/timeline')
  @RequirePermission('api.patients', 'view')
  async timeline(@Param('id') id: string, @Query('limit') limit?: string) {
    return this.timelineHandler.execute(id, limit ? Number(limit) : undefined);
  }

  @Get(':id/duplicates')
  @RequirePermission('api.patients', 'view')
  async duplicates(@Param('id') id: string) {
    return this.duplicatesHandler.execute(id);
  }

  @Get(':id')
  @RequirePermission('api.patients', 'view')
  async get(@Param('id') id: string) {
    const result = await this.getHandler.execute({ id });
    if (!result) throw new NotFoundException('Patient not found');
    return result;
  }

  @Patch(':id')
  @RequirePermission('api.patients', 'update')
  async update(@Param('id') id: string, @Body() body: UpdatePatientDTO) {
    return this.updateHandler.execute(id, body);
  }

  @Post(':id/archive')
  @RequirePermission('api.patients', 'delete')
  async archive(@Param('id') id: string) {
    return this.archiveHandler.execute(id);
  }

  @Post(':id/reactivate')
  @RequirePermission('api.patients', 'approve')
  async reactivate(@Param('id') id: string) {
    return this.reactivateHandler.execute(id);
  }
}
