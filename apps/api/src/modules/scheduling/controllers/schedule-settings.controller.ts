import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
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
import {
  CreateAvailabilityExceptionHandler,
  ListAvailabilityExceptionsHandler,
  SoftDeleteAvailabilityExceptionHandler,
} from '../application/handlers/availability-exception.handlers';

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
    private readonly createAvailabilityException: CreateAvailabilityExceptionHandler,
    private readonly listAvailabilityExceptions: ListAvailabilityExceptionsHandler,
    private readonly softDeleteAvailabilityException: SoftDeleteAvailabilityExceptionHandler,
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

  /** Wave G1 / P1-11 — AvailabilityException SoR (schedule.admin ≈ api.scheduling manage). */
  @Get('availability-exceptions')
  @RequirePermission('api.scheduling', 'view')
  async listExceptions(
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('branchId') branchId?: string,
  ) {
    return this.listAvailabilityExceptions.execute({ from, to, branchId });
  }

  @Post('availability-exceptions')
  @RequirePermission('api.scheduling', 'manage')
  async createException(
    @Body()
    body: {
      type: string;
      startsAt: string;
      endsAt: string;
      branchId?: string | null;
      providerId?: string | null;
      resourceId?: string | null;
      reason?: string | null;
    },
    @CurrentUser() user: JwtClaimsVO,
  ) {
    return this.createAvailabilityException.execute({
      type: body.type,
      startsAt: body.startsAt,
      endsAt: body.endsAt,
      branchId: body.branchId,
      providerId: body.providerId,
      resourceId: body.resourceId,
      reason: body.reason,
      actorId: user.sub,
      actorRoles: [...user.roles],
    });
  }

  @Delete('availability-exceptions/:id')
  @RequirePermission('api.scheduling', 'manage')
  async deleteException(
    @Param('id') id: string,
    @CurrentUser() user: JwtClaimsVO,
  ) {
    return this.softDeleteAvailabilityException.execute(id, user.sub, [...user.roles]);
  }
}
