import { Body, Controller, Delete, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { TenantScopedAccessGuard } from '../../../common/tenant-scoped-access.guard';
import { RequirePermission } from '../../auth/api/guards/permission.guard';
import { RequireLicensedModule } from '../../subscription/api/decorators/require-licensed-module.decorator';
import { RequireLicensedFeature } from '../../subscription/api/decorators/require-licensed-feature.decorator';
import { CreateWaitlistDTO } from '../application/dto/scheduling-support.dto';
import {
  CancelWaitlistHandler,
  CreateWaitlistHandler,
  ListWaitlistHandler,
} from '../application/handlers/waitlist.handlers';
import { BookWaitlistEntryHandler } from '../application/handlers/schedule-settings.handlers';

@Controller('scheduling/waitlist')
@UseGuards(TenantScopedAccessGuard)
@RequireLicensedModule('scheduling')
@RequireLicensedFeature('scheduling')
export class WaitlistController {
  constructor(
    private readonly listHandler: ListWaitlistHandler,
    private readonly createHandler: CreateWaitlistHandler,
    private readonly cancelHandler: CancelWaitlistHandler,
    private readonly bookHandler: BookWaitlistEntryHandler,
  ) {}

  @Get()
  @RequirePermission('api.scheduling', 'view')
  async list(@Query('status') status?: string) {
    return this.listHandler.execute(status);
  }

  @Post()
  @RequirePermission('api.scheduling', 'create')
  async create(@Body() body: CreateWaitlistDTO) {
    return this.createHandler.execute(body);
  }

  @Post(':id/book')
  @RequirePermission('api.scheduling', 'create')
  async book(
    @Param('id') id: string,
    @Body() body: { start: string; end: string; providerId?: string },
  ) {
    return this.bookHandler.execute(id, body);
  }

  @Delete(':id')
  @RequirePermission('api.scheduling', 'delete')
  async cancel(@Param('id') id: string) {
    return this.cancelHandler.execute(id);
  }
}
