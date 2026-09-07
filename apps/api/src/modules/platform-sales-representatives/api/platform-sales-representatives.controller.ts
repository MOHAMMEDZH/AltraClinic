import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  HttpException,
  Param,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { PlatformAuthRoute } from '../../auth/api/decorators/platform-auth-route.decorator';
import { RequirePlatformPermission } from '../../auth/api/decorators/require-platform-permission.decorator';
import { PlatformPermissionGuard } from '../../auth/api/guards/platform-permission.guard';
import { CurrentUser } from '../../auth/api/decorators/current-user.decorator';
import { JwtClaimsVO } from '../../auth/domain/value-objects/jwt-claims.vo';
import { PlatformAuthorizationService } from '../../auth/platform-rbac/platform-authorization.service';
import { SalesRepresentativeAdminService } from '../application/sales-representative-admin.service';
import { SalesCustomerOwnershipService } from '../application/sales-customer-ownership.service';
import { SALES_REP_PERMISSIONS } from '../platform-sales-representatives.constants';
import {
  AssignManagerDto,
  AssignOwnershipDto,
  AssignRoleDto,
  CreateSalesRepresentativeDto,
  LifecycleActionDto,
  OptionalReasonDto,
  ReassignOwnershipDto,
  RemoveOwnershipDto,
  UpdateSalesRepresentativeProfileDto,
  UpdateSalesRepresentativeTargetDto,
} from './dto/sales-representative.dto';
import { SalesRepError, SalesRepValidationError } from '../domain/sales-representative.errors';

@Controller('platform/sales/representatives')
@PlatformAuthRoute()
@UseGuards(PlatformPermissionGuard)
export class PlatformSalesRepresentativesController {
  constructor(
    private readonly reps: SalesRepresentativeAdminService,
    private readonly ownership: SalesCustomerOwnershipService,
    private readonly authz: PlatformAuthorizationService,
  ) {}

  private async perms(user: JwtClaimsVO): Promise<Set<string>> {
    return new Set(await this.authz.resolveEffectivePermissions(user.sub));
  }

  private wrap<T>(fn: () => Promise<T>): Promise<T> {
    return fn().catch((err) => {
      if (err instanceof SalesRepError) {
        throw new HttpException({ statusCode: err.httpStatus, code: err.code, message: err.message }, err.httpStatus);
      }
      throw err;
    });
  }

  @Get()
  @RequirePlatformPermission(SALES_REP_PERMISSIONS.view)
  list(@Query() q: { page?: string; pageSize?: string; status?: string; search?: string }) {
    const page = Math.max(1, Number(q.page) || 1);
    const pageSize = Math.min(100, Math.max(1, Number(q.pageSize) || 25));
    return this.wrap(() => this.reps.list({ page, pageSize, status: q.status, search: q.search }));
  }

  @Get(':id')
  @RequirePlatformPermission(SALES_REP_PERMISSIONS.view)
  detail(@Param('id') id: string) {
    return this.wrap(() => this.reps.getById(id));
  }

  @Post()
  @RequirePlatformPermission(SALES_REP_PERMISSIONS.manage)
  create(
    @CurrentUser() user: JwtClaimsVO,
    @Body() body: CreateSalesRepresentativeDto,
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    return this.wrap(async () => {
      if (!idempotencyKey?.trim()) throw new SalesRepValidationError('Idempotency-Key header is required.');
      return this.reps.create(user, await this.perms(user), body, idempotencyKey);
    });
  }

  @Put(':id/profile')
  @RequirePlatformPermission(SALES_REP_PERMISSIONS.manage)
  updateProfile(@CurrentUser() user: JwtClaimsVO, @Param('id') id: string, @Body() body: UpdateSalesRepresentativeProfileDto) {
    return this.wrap(async () => this.reps.updateProfile(user, await this.perms(user), id, body));
  }

  @Put(':id/target')
  @RequirePlatformPermission(SALES_REP_PERMISSIONS.manage)
  updateTarget(@CurrentUser() user: JwtClaimsVO, @Param('id') id: string, @Body() body: UpdateSalesRepresentativeTargetDto) {
    return this.wrap(async () => this.reps.updateTarget(user, await this.perms(user), id, body));
  }

  @Put(':id/manager')
  @RequirePlatformPermission(SALES_REP_PERMISSIONS.manage)
  assignManager(@CurrentUser() user: JwtClaimsVO, @Param('id') id: string, @Body() body: AssignManagerDto) {
    return this.wrap(async () =>
      this.reps.assignManager(user, await this.perms(user), id, {
        managerRepresentativeId: body.managerRepresentativeId ?? null,
        expectedRowVersion: body.expectedRowVersion,
        reason: body.reason,
      }),
    );
  }

  @Post(':id/activate')
  @RequirePlatformPermission(SALES_REP_PERMISSIONS.manage)
  activate(@CurrentUser() user: JwtClaimsVO, @Param('id') id: string, @Body() body: OptionalReasonDto) {
    return this.wrap(async () => this.reps.activate(user, await this.perms(user), id, body?.reason));
  }

  @Post(':id/suspend')
  @RequirePlatformPermission(SALES_REP_PERMISSIONS.manage)
  suspend(@CurrentUser() user: JwtClaimsVO, @Param('id') id: string, @Body() body: LifecycleActionDto) {
    return this.wrap(async () => this.reps.suspend(user, await this.perms(user), id, body.reason));
  }

  @Post(':id/reactivate')
  @RequirePlatformPermission(SALES_REP_PERMISSIONS.manage)
  reactivate(@CurrentUser() user: JwtClaimsVO, @Param('id') id: string, @Body() body: LifecycleActionDto) {
    return this.wrap(async () => this.reps.reactivate(user, await this.perms(user), id, body.reason));
  }

  @Post(':id/sessions/revoke-all')
  @RequirePlatformPermission(SALES_REP_PERMISSIONS.manage)
  revokeSessions(@CurrentUser() user: JwtClaimsVO, @Param('id') id: string, @Body() body: LifecycleActionDto) {
    return this.wrap(async () => this.reps.revokeSessions(user, await this.perms(user), id, body.reason));
  }

  @Post(':id/roles')
  @RequirePlatformPermission(SALES_REP_PERMISSIONS.manage)
  assignRole(@CurrentUser() user: JwtClaimsVO, @Param('id') id: string, @Body() body: AssignRoleDto) {
    return this.wrap(async () => this.reps.assignRole(user, await this.perms(user), id, body.roleKey, body.reason));
  }

  @Delete(':id/roles/:roleKey')
  @RequirePlatformPermission(SALES_REP_PERMISSIONS.manage)
  removeRole(@CurrentUser() user: JwtClaimsVO, @Param('id') id: string, @Param('roleKey') roleKey: string) {
    return this.wrap(async () => this.reps.removeRole(user, await this.perms(user), id, roleKey));
  }

  @Get('customer-ownership/:platformTenantId')
  @RequirePlatformPermission(SALES_REP_PERMISSIONS.view)
  getOwnership(@Param('platformTenantId') platformTenantId: string) {
    return this.wrap(async () => {
      const row = await this.ownership.getByTenant(platformTenantId);
      return row ?? { platformTenantId, representativeId: null };
    });
  }

  @Post('customer-ownership')
  @RequirePlatformPermission(SALES_REP_PERMISSIONS.manage)
  assignOwnership(@CurrentUser() user: JwtClaimsVO, @Body() body: AssignOwnershipDto) {
    return this.wrap(async () =>
      this.ownership.assign(user, await this.perms(user), {
        representativeId: body.representativeId,
        platformTenantId: body.platformTenantId,
        reason: body.reason,
      }),
    );
  }

  @Put('customer-ownership/:platformTenantId')
  @RequirePlatformPermission(SALES_REP_PERMISSIONS.manage)
  reassignOwnership(
    @CurrentUser() user: JwtClaimsVO,
    @Param('platformTenantId') platformTenantId: string,
    @Body() body: ReassignOwnershipDto,
  ) {
    return this.wrap(async () => this.ownership.reassign(user, await this.perms(user), platformTenantId, body));
  }

  @Delete('customer-ownership/:platformTenantId')
  @RequirePlatformPermission(SALES_REP_PERMISSIONS.manage)
  removeOwnership(
    @CurrentUser() user: JwtClaimsVO,
    @Param('platformTenantId') platformTenantId: string,
    @Body() body: RemoveOwnershipDto,
  ) {
    return this.wrap(async () => this.ownership.remove(user, await this.perms(user), platformTenantId, body));
  }
}
