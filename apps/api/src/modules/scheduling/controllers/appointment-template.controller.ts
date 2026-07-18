import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { TenantScopedAccessGuard } from '../../../common/tenant-scoped-access.guard';
import { RequirePermission } from '../../auth/api/guards/permission.guard';
import { RequireLicensedModule } from '../../subscription/api/decorators/require-licensed-module.decorator';
import { RequireLicensedFeature } from '../../subscription/api/decorators/require-licensed-feature.decorator';
import { CreateAppointmentTemplateDTO } from '../application/dto/appointment-template.dto';
import {
  CreateAppointmentTemplateHandler,
  DeleteAppointmentTemplateHandler,
  ListAppointmentTemplatesHandler,
} from '../application/handlers/appointment-templates.handlers';

@Controller('scheduling/templates')
@UseGuards(TenantScopedAccessGuard)
@RequireLicensedModule('scheduling')
@RequireLicensedFeature('scheduling')
export class AppointmentTemplateController {
  constructor(
    private readonly listHandler: ListAppointmentTemplatesHandler,
    private readonly createHandler: CreateAppointmentTemplateHandler,
    private readonly deleteHandler: DeleteAppointmentTemplateHandler,
  ) {}

  @Get()
  @RequirePermission('api.scheduling', 'view')
  async list() {
    return this.listHandler.execute();
  }

  @Post()
  @RequirePermission('api.scheduling', 'create')
  async create(@Body() body: CreateAppointmentTemplateDTO) {
    return this.createHandler.execute(body);
  }

  @Delete(':id')
  @RequirePermission('api.scheduling', 'delete')
  async remove(@Param('id') id: string) {
    return this.deleteHandler.execute(id);
  }
}
