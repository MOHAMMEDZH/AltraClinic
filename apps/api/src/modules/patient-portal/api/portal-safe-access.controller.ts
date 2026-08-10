import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Inject,
  Param,
  Patch,
  Post,
  Req,
  UseFilters,
  UseGuards,
} from '@nestjs/common';
import { PatientPortalCenterEnabledGuard } from './patient-portal-center.guard';
import { PatientPortalCaregiverEnabledGuard } from './patient-portal-caregiver.guard';
import { PatientPortalEnrollmentCompleteGuard } from './patient-portal-enrollment.guard';
import { PatientPortalPermissionGuard } from './patient-portal-permission.guard';
import { PortalDomainExceptionFilter } from './patient-portal-domain-exception.filter';
import { RequirePermission } from '../../auth/api/guards/permission.guard';
import { RequireLicensedModule } from '../../subscription/api/decorators/require-licensed-module.decorator';
import { requireAuthenticatedPrincipal } from '../../../common/authenticated-principal.util';
import { PortalCaregiverLifecycleService } from '../application/services/portal-caregiver-lifecycle.service';
import { GetPortalSafeProfileHandler } from '../application/handlers/portal-safe-profile.handler';
import { PatientPortalResultReleaseGate } from '../application/services/patient-portal-result-release.gate';
import { TenantContextService } from '../../../infrastructure/tenant-context.service';
import { CaregiverAccessScope } from '../domain/value-objects/caregiver-access-scope';
import { UpdatePortalPreferencesHandler } from '../application/handlers/update-portal-preferences.handler';
import { UpdatePortalPreferencesCommand } from '../application/commands/update-portal-preferences.command';
import { PORTAL_ACCOUNT_REPOSITORY, PORTAL_AUDIT_LOG } from '../../../infrastructure/provider.tokens';
import { PortalAccountRepository } from '../domain/repositories/portal-account.repository.interface';
import { PATIENT_PORTAL_ERROR_CODES } from '../patient-portal.constants';
import { buildPatientPortalSafeError } from './patient-portal-safe-errors';
import { PortalLocale } from '../domain/value-objects/portal-preferences.vo';
import { PatientPortalActivityEmitter } from '../application/services/patient-portal-activity.emitter';
import { PortalAuditLog } from '../application/ports/portal-audit-log.port';

interface AuthenticatedRequest {
  user?: { id?: string; sub?: string; roles?: string[] };
  headers?: Record<string, string | string[] | undefined>;
}

class InviteCaregiverDto {
  caregiverContact!: string;
  caregiverName!: string;
  scopes!: CaregiverAccessScope[];
  expiresAt?: string | null;
}

class InvitationTokenDto {
  invitationToken!: string;
}

class RevokeGrantDto {
  reason?: string | null;
}

class UpdateMyPreferencesDto {
  locale!: PortalLocale;
  channels!: { email: boolean; sms: boolean; push: boolean };
}

@Controller('patient-portal/me')
@UseGuards(
  PatientPortalCenterEnabledGuard,
  PatientPortalEnrollmentCompleteGuard,
  PatientPortalPermissionGuard,
)
@UseFilters(PortalDomainExceptionFilter)
@RequireLicensedModule('patientPortal')
export class PortalSafeAccessController {
  constructor(
    private readonly caregivers: PortalCaregiverLifecycleService,
    private readonly profile: GetPortalSafeProfileHandler,
    private readonly resultsGate: PatientPortalResultReleaseGate,
    private readonly tenantContext: TenantContextService,
    private readonly updatePreferencesHandler: UpdatePortalPreferencesHandler,
    @Inject(PORTAL_ACCOUNT_REPOSITORY) private readonly portalRepo: PortalAccountRepository,
    private readonly activity: PatientPortalActivityEmitter,
    @Inject(PORTAL_AUDIT_LOG) private readonly auditLog: PortalAuditLog,
  ) {}

  private actor(request: AuthenticatedRequest) {
    const { id, roles } = requireAuthenticatedPrincipal(request);
    const correlationHeader = request.headers?.['x-correlation-id'];
    const correlationId = Array.isArray(correlationHeader)
      ? correlationHeader[0]
      : correlationHeader;
    return { id, roles, correlationId: correlationId ?? null };
  }

  private header(
    request: AuthenticatedRequest,
    name: string,
  ): string | null {
    const value = request.headers?.[name] ?? request.headers?.[name.toLowerCase()];
    if (Array.isArray(value)) return value[0] ?? null;
    return typeof value === 'string' ? value : null;
  }

  @Get('profile')
  @RequirePermission('api.patient_portal', 'view')
  async getProfile(@Req() request: AuthenticatedRequest) {
    const actor = this.actor(request);
    return this.profile.execute({
      actorUserId: actor.id,
      actorRoles: actor.roles,
      actingContextHeader: this.header(request, 'x-portal-acting-context'),
      subjectPatientIdHeader: this.header(request, 'x-portal-subject-patient-id'),
      correlationId: actor.correlationId,
    });
  }

  @Get('preferences')
  @RequirePermission('api.patient_portal', 'view')
  async getPreferences(@Req() request: AuthenticatedRequest) {
    const actor = this.actor(request);
    const tenant = await this.tenantContext.resolve();
    const account = await this.portalRepo.findByUserId(actor.id, tenant.tenantId);
    if (!account) {
      throw new ForbiddenException(
        buildPatientPortalSafeError(PATIENT_PORTAL_ERROR_CODES.INVALID_SESSION),
      );
    }
    return {
      locale: account.preferences.locale,
      channels: { ...account.preferences.channels },
    };
  }

  @Patch('preferences')
  @RequirePermission('api.patient_portal', 'update')
  async patchPreferences(
    @Req() request: AuthenticatedRequest,
    @Body() body: UpdateMyPreferencesDto,
  ) {
    const actor = this.actor(request);
    const tenant = await this.tenantContext.resolve();
    const account = await this.portalRepo.findByUserId(actor.id, tenant.tenantId);
    if (!account) {
      throw new ForbiddenException(
        buildPatientPortalSafeError(PATIENT_PORTAL_ERROR_CODES.INVALID_SESSION),
      );
    }
    await this.updatePreferencesHandler.execute(
      new UpdatePortalPreferencesCommand(
        account.id,
        body.locale,
        body.channels,
        actor.id,
        actor.roles,
        actor.correlationId,
      ),
    );
    await this.auditLog.record({
      tenantId: account.tenantId,
      branchId: account.branchId,
      action: 'patient_portal.preferences.updated',
      resourceId: account.id,
      actorId: actor.id,
      actorRoles: actor.roles,
      locale: body.locale,
      reason: null,
      details: {
        actorType: 'patient',
        actingContext: 'self',
        result: 'success',
      } as Record<string, string>,
      correlationId: actor.correlationId,
    });
    this.activity.emit({
      event: 'preferences_updated',
      tenantId: account.tenantId,
      correlationId: actor.correlationId,
    });
    return { ok: true };
  }

  @Get('results/gate')
  @RequirePermission('api.patient_portal', 'view')
  async resultsGateStatus(@Req() request: AuthenticatedRequest) {
    const actor = this.actor(request);
    const tenant = await this.tenantContext.resolve();
    const decision = this.resultsGate.evaluate({
      tenantId: tenant.tenantId,
      subjectPatientId: 'n/a',
      correlationId: actor.correlationId,
    });
    return {
      productEnabled: false,
      readable: decision.allowed,
      code: decision.allowed ? null : decision.code,
      message: 'Clinical results display is not available in this release',
    };
  }

  @Get('caregivers')
  @UseGuards(PatientPortalCaregiverEnabledGuard)
  @RequirePermission('api.patient_portal', 'view')
  async listCaregivers(@Req() request: AuthenticatedRequest) {
    const actor = this.actor(request);
    return { items: await this.caregivers.listMine(actor.id) };
  }

  @Post('caregivers')
  @UseGuards(PatientPortalCaregiverEnabledGuard)
  @RequirePermission('api.patient_portal', 'create')
  async inviteCaregiver(@Req() request: AuthenticatedRequest, @Body() body: InviteCaregiverDto) {
    const actor = this.actor(request);
    return this.caregivers.invite({
      actorUserId: actor.id,
      actorRoles: actor.roles,
      caregiverContact: body.caregiverContact,
      caregiverName: body.caregiverName,
      scopes: body.scopes,
      expiresAt: body.expiresAt,
      correlationId: actor.correlationId,
    });
  }

  @Post('caregivers/:grantId/revoke')
  @UseGuards(PatientPortalCaregiverEnabledGuard)
  @RequirePermission('api.patient_portal', 'update')
  async revokeCaregiver(
    @Req() request: AuthenticatedRequest,
    @Param('grantId') grantId: string,
    @Body() body: RevokeGrantDto,
  ) {
    const actor = this.actor(request);
    return this.caregivers.revoke({
      actorUserId: actor.id,
      actorRoles: actor.roles,
      grantId,
      reason: body.reason,
      correlationId: actor.correlationId,
    });
  }

  @Post('caregiver-invitations/accept')
  @UseGuards(PatientPortalCaregiverEnabledGuard)
  @RequirePermission('api.patient_portal', 'update')
  async acceptInvitation(@Req() request: AuthenticatedRequest, @Body() body: InvitationTokenDto) {
    const actor = this.actor(request);
    return this.caregivers.acceptInvitation({
      actorUserId: actor.id,
      actorRoles: actor.roles,
      invitationToken: body.invitationToken,
      correlationId: actor.correlationId,
    });
  }

  @Post('caregiver-invitations/decline')
  @UseGuards(PatientPortalCaregiverEnabledGuard)
  @RequirePermission('api.patient_portal', 'update')
  async declineInvitation(@Req() request: AuthenticatedRequest, @Body() body: InvitationTokenDto) {
    const actor = this.actor(request);
    return this.caregivers.declineInvitation({
      actorUserId: actor.id,
      actorRoles: actor.roles,
      invitationToken: body.invitationToken,
      correlationId: actor.correlationId,
    });
  }

  @Get('delegated-patients')
  @UseGuards(PatientPortalCaregiverEnabledGuard)
  @RequirePermission('api.patient_portal', 'view')
  async delegatedPatients(@Req() request: AuthenticatedRequest) {
    const actor = this.actor(request);
    return this.caregivers.listDelegatedPatients(actor.id);
  }
}
