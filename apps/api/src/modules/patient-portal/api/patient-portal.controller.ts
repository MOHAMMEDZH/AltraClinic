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
import { PatientPortalPermissionGuard } from './patient-portal-permission.guard';
import { PatientPortalCenterEnabledGuard } from './patient-portal-center.guard';
import { PortalDomainExceptionFilter } from './patient-portal-domain-exception.filter';
import { RequirePermission } from '../../auth/api/guards/permission.guard';
import { RequireLicensedModule } from '../../subscription/api/decorators/require-licensed-module.decorator';
import { InvitePortalAccountDto } from '../application/dto/invite-portal-account.dto';
import { ActivatePortalAccountDto } from '../application/dto/activate-portal-account.dto';
import { SuspendPortalAccountDto } from '../application/dto/suspend-portal-account.dto';
import { DeactivatePortalAccountDto } from '../application/dto/deactivate-portal-account.dto';
import { UpdatePortalPreferencesDto } from '../application/dto/update-portal-preferences.dto';
import { GrantCaregiverAccessDto } from '../application/dto/grant-caregiver-access.dto';
import { RevokeCaregiverAccessDto } from '../application/dto/revoke-caregiver-access.dto';
import { InvitePortalAccountHandler } from '../application/handlers/invite-portal-account.handler';
import { ActivatePortalAccountHandler } from '../application/handlers/activate-portal-account.handler';
import { SuspendPortalAccountHandler } from '../application/handlers/suspend-portal-account.handler';
import { ReactivatePortalAccountHandler } from '../application/handlers/reactivate-portal-account.handler';
import { DeactivatePortalAccountHandler } from '../application/handlers/deactivate-portal-account.handler';
import { UpdatePortalPreferencesHandler } from '../application/handlers/update-portal-preferences.handler';
import { GrantCaregiverAccessHandler } from '../application/handlers/grant-caregiver-access.handler';
import { RevokeCaregiverAccessHandler } from '../application/handlers/revoke-caregiver-access.handler';
import { GetPortalAccountHandler } from '../application/handlers/get-portal-account.handler';
import { ListPortalAccountsHandler } from '../application/handlers/list-portal-accounts.handler';
import { isPortalAccountStatus, PortalAccountStatus } from '../domain/value-objects/portal-account-status';

interface AuthenticatedRequest {
  user?: { id: string; roles: string[]; tenantId?: string };
  headers?: Record<string, unknown>;
}

@Controller('patient-portal/accounts')
@UseGuards(PatientPortalCenterEnabledGuard, PatientPortalPermissionGuard)
@UseFilters(PortalDomainExceptionFilter)
@RequireLicensedModule('patientPortal')
export class PatientPortalController {
  constructor(
    private readonly inviteHandler: InvitePortalAccountHandler,
    private readonly activateHandler: ActivatePortalAccountHandler,
    private readonly suspendHandler: SuspendPortalAccountHandler,
    private readonly reactivateHandler: ReactivatePortalAccountHandler,
    private readonly deactivateHandler: DeactivatePortalAccountHandler,
    private readonly updatePreferencesHandler: UpdatePortalPreferencesHandler,
    private readonly grantCaregiverHandler: GrantCaregiverAccessHandler,
    private readonly revokeCaregiverHandler: RevokeCaregiverAccessHandler,
    private readonly getHandler: GetPortalAccountHandler,
    private readonly listHandler: ListPortalAccountsHandler,
  ) {}

  private actor(request: AuthenticatedRequest): { id: string; roles: string[] } {
    return { id: request.user?.id ?? '', roles: request.user?.roles ?? [] };
  }

  private correlationId(request: AuthenticatedRequest): string | null {
    const header = request.headers?.['x-correlation-id'];
    return typeof header === 'string' && header.trim() ? header.trim() : null;
  }

  @Post()
  @RequirePermission('api.patient_portal', 'create')
  async invite(@Body() body: InvitePortalAccountDto, @Req() request: AuthenticatedRequest) {
    const actor = this.actor(request);
    return this.inviteHandler.execute({
      patientId: body.patientId,
      invitedBy: actor.id,
      invitedByRoles: actor.roles,
      locale: body.locale ?? null,
      correlationId: this.correlationId(request),
    });
  }

  @Post(':portalAccountId/activate')
  @RequirePermission('api.patient_portal', 'approve')
  async activate(
    @Param('portalAccountId') portalAccountId: string,
    @Body() body: ActivatePortalAccountDto,
    @Req() request: AuthenticatedRequest,
  ) {
    const actor = this.actor(request);
    await this.activateHandler.execute({
      portalAccountId,
      userId: body.userId,
      actorId: actor.id,
      actorRoles: actor.roles,
      correlationId: this.correlationId(request),
    });
    return { status: 'ok' };
  }

  @Post(':portalAccountId/suspend')
  @RequirePermission('api.patient_portal', 'approve')
  async suspend(
    @Param('portalAccountId') portalAccountId: string,
    @Body() body: SuspendPortalAccountDto,
    @Req() request: AuthenticatedRequest,
  ) {
    const actor = this.actor(request);
    await this.suspendHandler.execute({
      portalAccountId,
      reason: body.reason,
      actorId: actor.id,
      actorRoles: actor.roles,
      correlationId: this.correlationId(request),
    });
    return { status: 'ok' };
  }

  @Post(':portalAccountId/reactivate')
  @RequirePermission('api.patient_portal', 'approve')
  async reactivate(
    @Param('portalAccountId') portalAccountId: string,
    @Req() request: AuthenticatedRequest,
  ) {
    const actor = this.actor(request);
    await this.reactivateHandler.execute({
      portalAccountId,
      actorId: actor.id,
      actorRoles: actor.roles,
      correlationId: this.correlationId(request),
    });
    return { status: 'ok' };
  }

  @Post(':portalAccountId/deactivate')
  @RequirePermission('api.patient_portal', 'delete')
  async deactivate(
    @Param('portalAccountId') portalAccountId: string,
    @Body() body: DeactivatePortalAccountDto,
    @Req() request: AuthenticatedRequest,
  ) {
    const actor = this.actor(request);
    await this.deactivateHandler.execute({
      portalAccountId,
      reason: body.reason ?? null,
      actorId: actor.id,
      actorRoles: actor.roles,
      correlationId: this.correlationId(request),
    });
    return { status: 'ok' };
  }

  @Patch(':portalAccountId/preferences')
  @RequirePermission('api.patient_portal', 'update')
  async updatePreferences(
    @Param('portalAccountId') portalAccountId: string,
    @Body() body: UpdatePortalPreferencesDto,
    @Req() request: AuthenticatedRequest,
  ) {
    const actor = this.actor(request);
    await this.updatePreferencesHandler.execute({
      portalAccountId,
      locale: body.locale,
      channels: body.channels,
      actorId: actor.id,
      actorRoles: actor.roles,
      correlationId: this.correlationId(request),
    });
    return { status: 'ok' };
  }

  @Post(':portalAccountId/caregiver-access')
  @RequirePermission('api.patient_portal', 'create')
  async grantCaregiverAccess(
    @Param('portalAccountId') portalAccountId: string,
    @Body() body: GrantCaregiverAccessDto,
    @Req() request: AuthenticatedRequest,
  ) {
    const actor = this.actor(request);
    return this.grantCaregiverHandler.execute({
      portalAccountId,
      caregiverContact: body.caregiverContact,
      caregiverName: body.caregiverName,
      scopes: body.scopes,
      expiresAt: body.expiresAt ?? null,
      actorId: actor.id,
      actorRoles: actor.roles,
      correlationId: this.correlationId(request),
    });
  }

  @Post(':portalAccountId/caregiver-access/:grantId/revoke')
  @RequirePermission('api.patient_portal', 'delete')
  async revokeCaregiverAccess(
    @Param('portalAccountId') portalAccountId: string,
    @Param('grantId') grantId: string,
    @Body() body: RevokeCaregiverAccessDto,
    @Req() request: AuthenticatedRequest,
  ) {
    const actor = this.actor(request);
    await this.revokeCaregiverHandler.execute({
      portalAccountId,
      grantId,
      reason: body.reason ?? null,
      actorId: actor.id,
      actorRoles: actor.roles,
      correlationId: this.correlationId(request),
    });
    return { status: 'ok' };
  }

  @Get(':portalAccountId')
  @RequirePermission('api.patient_portal', 'view')
  async get(@Param('portalAccountId') portalAccountId: string, @Req() request: AuthenticatedRequest) {
    const actor = this.actor(request);
    return this.getHandler.execute({
      portalAccountId,
      actorId: actor.id,
      actorRoles: actor.roles,
    });
  }

  @Get()
  @RequirePermission('api.patient_portal', 'view')
  async list(
    @Req() request: AuthenticatedRequest,
    @Query('branchId') branchId?: string,
    @Query('status') status?: string,
    @Query('patientId') patientId?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    const actor = this.actor(request);
    const normalizedStatus: PortalAccountStatus | null =
      status && isPortalAccountStatus(status) ? status : null;

    return this.listHandler.execute({
      branchId: branchId?.trim() || null,
      status: normalizedStatus,
      patientId: patientId?.trim() || null,
      limit: Number.isNaN(Number(limit)) ? 50 : Number(limit),
      offset: Number.isNaN(Number(offset)) ? 0 : Number(offset),
      actorRoles: actor.roles,
    });
  }
}
