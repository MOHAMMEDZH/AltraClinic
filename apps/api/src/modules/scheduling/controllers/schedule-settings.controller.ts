import { Body, Controller, Get, Param, Post, Put, UseGuards } from '@nestjs/common';
import { TenantScopedAccessGuard } from '../../../common/tenant-scoped-access.guard';
import { RequirePermission } from '../../auth/api/guards/permission.guard';
import { RequireLicensedModule } from '../../subscription/api/decorators/require-licensed-module.decorator';
import { RequireLicensedFeature } from '../../subscription/api/decorators/require-licensed-feature.decorator';
import { CurrentUser } from '../../auth/api/decorators/current-user.decorator';
import { JwtClaimsVO } from '../../auth/domain/value-objects/jwt-claims.vo';
import {
  GetBranchHoursHandler,
  GetProviderScheduleHandler,
  UpsertBranchHoursHandler,
  UpsertProviderScheduleHandler,
} from '../application/handlers/schedule-settings.handlers';
import { CreateSchedulingResourceHandler } from '../application/handlers/scheduling-resources.handlers';
import { CreateSchedulingResourceDTO } from '../application/dto/create-scheduling-resource.dto';

@Controller('scheduling')
@UseGuards(TenantScopedAccessGuard)
@RequireLicensedModule('scheduling')
@RequireLicensedFeature('scheduling')
export class ScheduleSettingsController {
  constructor(
    private readonly getBranchHours: GetBranchHoursHandler,
    private readonly upsertBranchHours: UpsertBranchHoursHandler,
    private readonly getProviderSchedule: GetProviderScheduleHandler,
    private readonly upsertProviderSchedule: UpsertProviderScheduleHandler,
    private readonly createResource: CreateSchedulingResourceHandler,
  ) { }

  @Get('branches/:branchId/hours')
  @RequirePermission('api.scheduling', 'view')
  async branchHours(@Param('branchId') branchId: string) {
    return this.getBranchHours.execute(branchId);
  }

  @Put('branches/:branchId/hours')
  @RequirePermission('api.scheduling', 'manage')
  async updateBranchHours(
    @Param('branchId') branchId: string,
    @Body() body: { days: Array<{
      dayOfWeek: number;
      openHour: number;
      openMin?: number;
      closeHour: number;
      closeMin?: number;
      isClosed?: boolean;
    }> },
  ) {
    return this.upsertBranchHours.execute(branchId, body.days ?? []);
  }

  @Get('providers/:providerId/schedule')
  @RequirePermission('api.scheduling', 'view')
  async providerSchedule(@Param('providerId') providerId: string) {
    return this.getProviderSchedule.execute(providerId);
  }

  @Put('providers/:providerId/schedule')
  @RequirePermission('api.scheduling', 'manage')
  async updateProviderSchedule(
    @Param('providerId') providerId: string,
    @Body() body: { days: Array<{
      dayOfWeek: number;
      startHour: number;
      startMin?: number;
      endHour: number;
      endMin?: number;
      isOff?: boolean;
    }> },
  ) {
    return this.upsertProviderSchedule.execute(providerId, body.days ?? []);
  }

  @Post('resources')
  @RequirePermission('api.scheduling', 'manage')
  async createSchedulingResource(
    @Body() body: CreateSchedulingResourceDTO,
    @CurrentUser() user: JwtClaimsVO,
  ) {
    return this.createResource.execute({
      name: body.name,
      resourceType: body.resourceType,
      branchId: body.branchId,
      displaySubtype: body.displaySubtype,
      actorId: user.sub,
      actorRoles: [...user.roles],
    });
  }
}
