import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { TenantScopedAccessGuard } from '../../../common/tenant-scoped-access.guard';
import { RequirePermission } from '../../auth/api/guards/permission.guard';
import { RequireLicensedModule } from '../../subscription/api/decorators/require-licensed-module.decorator';
import { RequireLicensedFeature } from '../../subscription/api/decorators/require-licensed-feature.decorator';
import { AvailabilityQueryDTO } from '../application/dto/scheduling-support.dto';
import {
  GetAvailabilityHandler,
  ListProvidersHandler,
  ListServiceTypesHandler,
} from '../application/handlers/scheduling-support.handlers';
import { GetSchedulingContextHandler } from '../application/handlers/scheduling-context.handler';
import {
  GetResourceAvailabilityHandler,
  GetResourceDayStatusHandler,
  ListSchedulingResourcesHandler,
} from '../application/handlers/scheduling-resources.handlers';
import { ResourceAvailabilityQueryDTO } from '../application/dto/appointment-template.dto';

@Controller('scheduling')
@UseGuards(TenantScopedAccessGuard)
@RequireLicensedModule('scheduling')
@RequireLicensedFeature('scheduling')
export class SchedulingSupportController {
  constructor(
    private readonly listProvidersHandler: ListProvidersHandler,
    private readonly getAvailabilityHandler: GetAvailabilityHandler,
    private readonly listServiceTypesHandler: ListServiceTypesHandler,
    private readonly listResourcesHandler: ListSchedulingResourcesHandler,
    private readonly getResourceAvailabilityHandler: GetResourceAvailabilityHandler,
    private readonly getResourceDayStatusHandler: GetResourceDayStatusHandler,
    private readonly getSchedulingContextHandler: GetSchedulingContextHandler,
  ) {}

  @Get('context')
  @RequirePermission('api.scheduling', 'view')
  async context() {
    return this.getSchedulingContextHandler.execute();
  }

  @Get('providers')
  @RequirePermission('api.scheduling', 'view')
  async listProviders(
    @Query('branchId') branchId?: string,
    @Query('clinicalServiceId') clinicalServiceId?: string,
  ) {
    return this.listProvidersHandler.execute(branchId, clinicalServiceId);
  }

  @Get('service-types')
  @RequirePermission('api.scheduling', 'view')
  async listServiceTypes() {
    return this.listServiceTypesHandler.execute();
  }

  @Get('resources')
  @RequirePermission('api.scheduling', 'view')
  async listResources(@Query('branchId') branchId?: string, @Query('type') type?: string) {
    return this.listResourcesHandler.execute(branchId, type);
  }

  @Get('resources/status')
  @RequirePermission('api.scheduling', 'view')
  async resourceDayStatus(@Query('date') date: string, @Query('branchId') branchId?: string) {
    return this.getResourceDayStatusHandler.execute(date, branchId);
  }

  @Get('resources/availability')
  @RequirePermission('api.scheduling', 'view')
  async resourceAvailability(@Query() query: ResourceAvailabilityQueryDTO) {
    return this.getResourceAvailabilityHandler.execute({
      resourceId: query.resourceId,
      date: query.date,
      durationMin: query.durationMin ? Number(query.durationMin) : undefined,
    });
  }

  @Get('availability')
  @RequirePermission('api.scheduling', 'view')
  async availability(@Query() query: AvailabilityQueryDTO) {
    return this.getAvailabilityHandler.execute({
      providerId: query.providerId,
      date: query.date,
      durationMin: query.durationMin ? Number(query.durationMin) : undefined,
      branchId: query.branchId,
      clinicalServiceId: query.clinicalServiceId,
    });
  }
}
