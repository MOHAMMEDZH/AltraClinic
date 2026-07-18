import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseFilters,
  UseGuards,
} from '@nestjs/common';
import { PlatformAdminPermissionGuard } from './platform-admin-permission.guard';
import { PlatformAdminDomainExceptionFilter } from './platform-admin-domain-exception.filter';
import { RequirePermission } from '../../auth/api/guards/permission.guard';
import {
  ProvisionPlatformTenantDto,
  SuspendPlatformTenantDto,
  ArchivePlatformTenantDto,
  ChangePlatformTenantPlanDto,
  RequestPrivilegedAccessDto,
  RejectPrivilegedAccessDto,
  RevokePrivilegedAccessDto,
} from '../application/dto/platform-admin.request-dto';
import { ProvisionPlatformTenantHandler } from '../application/handlers/provision-platform-tenant.handler';
import { ActivatePlatformTenantHandler } from '../application/handlers/activate-platform-tenant.handler';
import { SuspendPlatformTenantHandler } from '../application/handlers/suspend-platform-tenant.handler';
import { ResumePlatformTenantHandler } from '../application/handlers/resume-platform-tenant.handler';
import { ArchivePlatformTenantHandler } from '../application/handlers/archive-platform-tenant.handler';
import { ChangePlatformTenantPlanHandler } from '../application/handlers/change-platform-tenant-plan.handler';
import { RequestPrivilegedAccessHandler } from '../application/handlers/request-privileged-access.handler';
import { ApprovePrivilegedAccessHandler } from '../application/handlers/approve-privileged-access.handler';
import { RejectPrivilegedAccessHandler } from '../application/handlers/reject-privileged-access.handler';
import { RevokePrivilegedAccessHandler } from '../application/handlers/revoke-privileged-access.handler';
import { GetPlatformTenantHandler } from '../application/handlers/get-platform-tenant.handler';
import { ListPlatformTenantsHandler } from '../application/handlers/list-platform-tenants.handler';
import { isPlatformTenantStatus, PlatformTenantStatus } from '../domain/value-objects/platform-tenant-status';
import { isPlatformRegion, PlatformRegion } from '../domain/value-objects/platform-region';
import { isEntitlementPlan, EntitlementPlan } from '../domain/value-objects/entitlement-plan';

interface AuthenticatedRequest {
  user?: { id: string; roles: string[] };
  headers?: Record<string, unknown>;
}

/**
 * Super Admin Platform control-plane API. Controllers carry NO business logic;
 * they translate the authenticated request into a command/query and delegate.
 * Domain invariant violations are mapped to 409/422 by
 * {@link PlatformAdminDomainExceptionFilter}.
 */
@Controller('platform/tenants')
@UseGuards(PlatformAdminPermissionGuard)
@UseFilters(PlatformAdminDomainExceptionFilter)
export class PlatformAdminController {
  constructor(
    private readonly provisionHandler: ProvisionPlatformTenantHandler,
    private readonly activateHandler: ActivatePlatformTenantHandler,
    private readonly suspendHandler: SuspendPlatformTenantHandler,
    private readonly resumeHandler: ResumePlatformTenantHandler,
    private readonly archiveHandler: ArchivePlatformTenantHandler,
    private readonly changePlanHandler: ChangePlatformTenantPlanHandler,
    private readonly requestAccessHandler: RequestPrivilegedAccessHandler,
    private readonly approveAccessHandler: ApprovePrivilegedAccessHandler,
    private readonly rejectAccessHandler: RejectPrivilegedAccessHandler,
    private readonly revokeAccessHandler: RevokePrivilegedAccessHandler,
    private readonly getHandler: GetPlatformTenantHandler,
    private readonly listHandler: ListPlatformTenantsHandler,
  ) {}

  private actor(request: AuthenticatedRequest): { id: string; roles: string[] } {
    return { id: request.user?.id ?? '', roles: request.user?.roles ?? [] };
  }

  private correlationId(request: AuthenticatedRequest): string | null {
    const header = request.headers?.['x-correlation-id'];
    return typeof header === 'string' && header.trim() ? header.trim() : null;
  }

  @Post()
  @RequirePermission('api.platform_admin', 'create')
  async provision(@Body() body: ProvisionPlatformTenantDto, @Req() request: AuthenticatedRequest) {
    const actor = this.actor(request);
    return this.provisionHandler.execute({
      tenantId: body.tenantId,
      displayName: body.displayName,
      region: body.region,
      plan: body.plan,
      actorId: actor.id,
      actorRoles: actor.roles,
      correlationId: this.correlationId(request),
    });
  }

  @Post(':platformTenantId/activate')
  @RequirePermission('api.platform_admin', 'approve')
  async activate(@Param('platformTenantId') platformTenantId: string, @Req() request: AuthenticatedRequest) {
    const actor = this.actor(request);
    await this.activateHandler.execute({
      platformTenantId,
      actorId: actor.id,
      actorRoles: actor.roles,
      correlationId: this.correlationId(request),
    });
    return { status: 'ok' };
  }

  @Post(':platformTenantId/suspend')
  @RequirePermission('api.platform_admin', 'approve')
  async suspend(
    @Param('platformTenantId') platformTenantId: string,
    @Body() body: SuspendPlatformTenantDto,
    @Req() request: AuthenticatedRequest,
  ) {
    const actor = this.actor(request);
    await this.suspendHandler.execute({
      platformTenantId,
      reason: body.reason,
      actorId: actor.id,
      actorRoles: actor.roles,
      correlationId: this.correlationId(request),
    });
    return { status: 'ok' };
  }

  @Post(':platformTenantId/resume')
  @RequirePermission('api.platform_admin', 'approve')
  async resume(@Param('platformTenantId') platformTenantId: string, @Req() request: AuthenticatedRequest) {
    const actor = this.actor(request);
    await this.resumeHandler.execute({
      platformTenantId,
      actorId: actor.id,
      actorRoles: actor.roles,
      correlationId: this.correlationId(request),
    });
    return { status: 'ok' };
  }

  @Post(':platformTenantId/archive')
  @RequirePermission('api.platform_admin', 'delete')
  async archive(
    @Param('platformTenantId') platformTenantId: string,
    @Body() body: ArchivePlatformTenantDto,
    @Req() request: AuthenticatedRequest,
  ) {
    const actor = this.actor(request);
    await this.archiveHandler.execute({
      platformTenantId,
      reason: body.reason,
      actorId: actor.id,
      actorRoles: actor.roles,
      correlationId: this.correlationId(request),
    });
    return { status: 'ok' };
  }

  @Patch(':platformTenantId/plan')
  @RequirePermission('api.platform_admin', 'manage')
  async changePlan(
    @Param('platformTenantId') platformTenantId: string,
    @Body() body: ChangePlatformTenantPlanDto,
    @Req() request: AuthenticatedRequest,
  ) {
    const actor = this.actor(request);
    return this.changePlanHandler.execute({
      platformTenantId,
      plan: body.plan,
      actorId: actor.id,
      actorRoles: actor.roles,
      correlationId: this.correlationId(request),
    });
  }

  @Post(':platformTenantId/privileged-access')
  @RequirePermission('api.platform_admin', 'create')
  async requestPrivilegedAccess(
    @Param('platformTenantId') platformTenantId: string,
    @Body() body: RequestPrivilegedAccessDto,
    @Req() request: AuthenticatedRequest,
  ) {
    const actor = this.actor(request);
    return this.requestAccessHandler.execute({
      platformTenantId,
      adminName: body.adminName,
      scopes: body.scopes,
      justification: body.justification,
      expiresAt: body.expiresAt,
      breakGlass: body.breakGlass ?? false,
      actorId: actor.id,
      actorRoles: actor.roles,
      correlationId: this.correlationId(request),
    });
  }

  @Post(':platformTenantId/privileged-access/:grantId/approve')
  @RequirePermission('api.platform_admin', 'approve')
  async approvePrivilegedAccess(
    @Param('platformTenantId') platformTenantId: string,
    @Param('grantId') grantId: string,
    @Req() request: AuthenticatedRequest,
  ) {
    const actor = this.actor(request);
    await this.approveAccessHandler.execute({
      platformTenantId,
      grantId,
      actorId: actor.id,
      actorRoles: actor.roles,
      correlationId: this.correlationId(request),
    });
    return { status: 'ok' };
  }

  @Post(':platformTenantId/privileged-access/:grantId/reject')
  @RequirePermission('api.platform_admin', 'approve')
  async rejectPrivilegedAccess(
    @Param('platformTenantId') platformTenantId: string,
    @Param('grantId') grantId: string,
    @Body() body: RejectPrivilegedAccessDto,
    @Req() request: AuthenticatedRequest,
  ) {
    const actor = this.actor(request);
    await this.rejectAccessHandler.execute({
      platformTenantId,
      grantId,
      reason: body.reason ?? null,
      actorId: actor.id,
      actorRoles: actor.roles,
      correlationId: this.correlationId(request),
    });
    return { status: 'ok' };
  }

  @Post(':platformTenantId/privileged-access/:grantId/revoke')
  @RequirePermission('api.platform_admin', 'delete')
  async revokePrivilegedAccess(
    @Param('platformTenantId') platformTenantId: string,
    @Param('grantId') grantId: string,
    @Body() body: RevokePrivilegedAccessDto,
    @Req() request: AuthenticatedRequest,
  ) {
    const actor = this.actor(request);
    await this.revokeAccessHandler.execute({
      platformTenantId,
      grantId,
      reason: body.reason ?? null,
      actorId: actor.id,
      actorRoles: actor.roles,
      correlationId: this.correlationId(request),
    });
    return { status: 'ok' };
  }

  @Get(':platformTenantId')
  @RequirePermission('api.platform_admin', 'view')
  async get(@Param('platformTenantId') platformTenantId: string, @Req() request: AuthenticatedRequest) {
    const actor = this.actor(request);
    return this.getHandler.execute({
      platformTenantId,
      actorId: actor.id,
      actorRoles: actor.roles,
    });
  }

  @Get()
  @RequirePermission('api.platform_admin', 'view')
  async list(
    @Req() request: AuthenticatedRequest,
    @Query('status') status?: string,
    @Query('region') region?: string,
    @Query('plan') plan?: string,
    @Query('search') search?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    const actor = this.actor(request);
    const normalizedStatus: PlatformTenantStatus | null =
      status && isPlatformTenantStatus(status) ? status : null;
    const normalizedRegion: PlatformRegion | null = region && isPlatformRegion(region) ? region : null;
    const normalizedPlan: EntitlementPlan | null = plan && isEntitlementPlan(plan) ? plan : null;

    return this.listHandler.execute({
      actorId: actor.id,
      actorRoles: actor.roles,
      status: normalizedStatus,
      region: normalizedRegion,
      plan: normalizedPlan,
      search: search?.trim() || null,
      limit: limit ? Number(limit) : Number.NaN,
      offset: offset ? Number(offset) : 0,
    });
  }
}
