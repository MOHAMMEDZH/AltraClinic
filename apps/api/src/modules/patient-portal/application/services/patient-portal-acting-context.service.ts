import { ForbiddenException, Injectable, Logger } from '@nestjs/common';
import { Inject } from '@nestjs/common';
import { PrismaService } from '../../../../infrastructure/prisma.service';
import { TenantContextService } from '../../../../infrastructure/tenant-context.service';
import { PORTAL_ACCOUNT_REPOSITORY } from '../../../../infrastructure/provider.tokens';
import { PortalAccountRepository } from '../../domain/repositories/portal-account.repository.interface';
import { CaregiverAccessDomainService } from '../../domain/services/caregiver-access.domain-service';
import {
  CaregiverAccessScope,
  isCaregiverMvpScope,
} from '../../domain/value-objects/caregiver-access-scope';
import { PATIENT_PORTAL_ERROR_CODES } from '../../patient-portal.constants';
import { buildPatientPortalSafeError } from '../../api/patient-portal-safe-errors';
import { PatientPortalObservabilityContracts } from '../patient-portal-observability.contracts';
import { PortalAuditLog } from '../ports/portal-audit-log.port';
import { PORTAL_AUDIT_LOG } from '../../../../infrastructure/provider.tokens';
import { isPatientPortalCaregiverEnabled } from '../../config/patient-portal-config';
import { SubscriptionEnforcementService } from '../../../subscription/application/services/subscription-enforcement.service';

export type PortalActingMode = 'self' | 'caregiver';

export interface PortalActingContext {
  mode: PortalActingMode;
  actorUserId: string;
  actorRoles: string[];
  /** Patient identity whose data is being accessed. */
  subjectPatientId: string;
  subjectPortalAccountId: string;
  grantId: string | null;
  scopes: CaregiverAccessScope[];
  correlationId?: string | null;
}

export interface ResolveActingContextInput {
  actorUserId: string;
  actorRoles: string[];
  actingContextHeader?: string | null;
  subjectPatientIdHeader?: string | null;
  requiredScope?: CaregiverAccessScope;
  correlationId?: string | null;
}

/**
 * Phase 46d — per-request acting context + caregiver scope enforcement.
 * Roles alone never authorize delegated PHI.
 */
@Injectable()
export class PatientPortalActingContextService {
  private readonly logger = new Logger(PatientPortalActingContextService.name);
  private readonly domain = new CaregiverAccessDomainService();

  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantContext: TenantContextService,
    @Inject(PORTAL_ACCOUNT_REPOSITORY) private readonly portalRepo: PortalAccountRepository,
    private readonly observability: PatientPortalObservabilityContracts,
    @Inject(PORTAL_AUDIT_LOG) private readonly auditLog: PortalAuditLog,
    private readonly enforcement: SubscriptionEnforcementService,
  ) {}

  async resolve(input: ResolveActingContextInput): Promise<PortalActingContext> {
    const tenant = await this.tenantContext.resolve();
    const rawMode = (input.actingContextHeader ?? 'self').trim().toLowerCase();
    if (rawMode !== 'self' && rawMode !== 'caregiver') {
      throw new ForbiddenException(
        buildPatientPortalSafeError(PATIENT_PORTAL_ERROR_CODES.ACTING_CONTEXT_INVALID),
      );
    }

    const actorAccount = await this.portalRepo.findByUserId(input.actorUserId, tenant.tenantId);
    if (!actorAccount || actorAccount.status.value !== 'active') {
      throw new ForbiddenException(
        buildPatientPortalSafeError(PATIENT_PORTAL_ERROR_CODES.INVALID_SESSION),
      );
    }

    if (rawMode === 'self') {
      if (input.subjectPatientIdHeader && input.subjectPatientIdHeader !== actorAccount.patientId) {
        throw new ForbiddenException(
          buildPatientPortalSafeError(PATIENT_PORTAL_ERROR_CODES.ACTING_CONTEXT_INVALID),
        );
      }
      return {
        mode: 'self',
        actorUserId: input.actorUserId,
        actorRoles: input.actorRoles,
        subjectPatientId: actorAccount.patientId,
        subjectPortalAccountId: actorAccount.id,
        grantId: null,
        scopes: [],
        correlationId: input.correlationId,
      };
    }

    // Caregiver path — fail closed on flag, license, grant, scope.
    if (!isPatientPortalCaregiverEnabled()) {
      throw new ForbiddenException(
        buildPatientPortalSafeError(PATIENT_PORTAL_ERROR_CODES.CAREGIVER_DISABLED),
      );
    }
    try {
      await this.enforcement.enforceFeature(tenant.tenantId, 'caregiverAccess');
    } catch {
      throw new ForbiddenException(
        buildPatientPortalSafeError(PATIENT_PORTAL_ERROR_CODES.CAREGIVER_LICENSE_DENIED),
      );
    }

    const subjectPatientId = input.subjectPatientIdHeader?.trim();
    if (!subjectPatientId) {
      throw new ForbiddenException(
        buildPatientPortalSafeError(PATIENT_PORTAL_ERROR_CODES.ACTING_CONTEXT_INVALID),
      );
    }
    if (subjectPatientId === actorAccount.patientId) {
      throw new ForbiddenException(
        buildPatientPortalSafeError(PATIENT_PORTAL_ERROR_CODES.ACTING_CONTEXT_INVALID),
      );
    }

    const subjectAccount = await this.portalRepo.findByPatientId(subjectPatientId, tenant.tenantId);
    if (!subjectAccount || subjectAccount.status.value !== 'active') {
      await this.deny(input, tenant.tenantId, 'grant');
      throw new ForbiddenException(
        buildPatientPortalSafeError(PATIENT_PORTAL_ERROR_CODES.GRANT_DENIED),
      );
    }

    const actorEmail = await this.resolveActorEmail(input.actorUserId, tenant.tenantId);
    const now = new Date();
    const matching = subjectAccount
      .activeCaregiverGrants(now)
      .filter(
        (g) =>
          g.caregiverUserId === input.actorUserId ||
          (actorEmail && g.caregiverContact.toLowerCase() === actorEmail),
      );

    if (matching.length === 0) {
      await this.deny(input, tenant.tenantId, 'grant');
      throw new ForbiddenException(
        buildPatientPortalSafeError(PATIENT_PORTAL_ERROR_CODES.GRANT_DENIED),
      );
    }

    const requiredScope = input.requiredScope;
    if (requiredScope) {
      if (!isCaregiverMvpScope(requiredScope)) {
        await this.deny(input, tenant.tenantId, 'scope');
        throw new ForbiddenException(
          buildPatientPortalSafeError(PATIENT_PORTAL_ERROR_CODES.SCOPE_DENIED),
        );
      }
      const decision = this.domain.decide(
        subjectAccount,
        matching[0].caregiverContact,
        requiredScope,
        now,
      );
      if (!decision.allowed) {
        await this.deny(input, tenant.tenantId, 'scope');
        throw new ForbiddenException(
          buildPatientPortalSafeError(PATIENT_PORTAL_ERROR_CODES.SCOPE_DENIED),
        );
      }
      const scoped = matching.find((g) => g.hasScope(requiredScope));
      if (!scoped) {
        await this.deny(input, tenant.tenantId, 'scope');
        throw new ForbiddenException(
          buildPatientPortalSafeError(PATIENT_PORTAL_ERROR_CODES.SCOPE_DENIED),
        );
      }

      this.logger.log(
        this.observability.createFoundationLogFields({
          event: 'caregiver.authz.allow',
          tenantId: tenant.tenantId,
          correlationId: input.correlationId,
        }),
      );

      return {
        mode: 'caregiver',
        actorUserId: input.actorUserId,
        actorRoles: input.actorRoles,
        subjectPatientId: subjectAccount.patientId,
        subjectPortalAccountId: subjectAccount.id,
        grantId: scoped.grantId,
        scopes: scoped.scopes,
        correlationId: input.correlationId,
      };
    }

    const grant = matching[0];
    return {
      mode: 'caregiver',
      actorUserId: input.actorUserId,
      actorRoles: input.actorRoles,
      subjectPatientId: subjectAccount.patientId,
      subjectPortalAccountId: subjectAccount.id,
      grantId: grant.grantId,
      scopes: grant.scopes,
      correlationId: input.correlationId,
    };
  }

  private async resolveActorEmail(userId: string, tenantId: string): Promise<string | null> {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, tenantId, deletedAt: null },
      select: { email: true },
    });
    return user?.email?.trim().toLowerCase() ?? null;
  }

  private async deny(
    input: ResolveActingContextInput,
    tenantId: string,
    kind: 'grant' | 'scope',
  ): Promise<void> {
    this.logger.log(
      this.observability.createFoundationLogFields({
        event: kind === 'scope' ? 'caregiver.scope.deny' : 'caregiver.authz.deny',
        tenantId,
        correlationId: input.correlationId,
      }),
    );
    await this.auditLog.record({
      tenantId,
      branchId: null,
      action:
        kind === 'scope'
          ? 'patient_portal.caregiver.scope_denied'
          : 'patient_portal.caregiver.access_denied',
      resourceId: input.subjectPatientIdHeader ?? input.actorUserId,
      actorId: input.actorUserId,
      actorRoles: input.actorRoles,
      locale: null,
      reason: null,
      details: {
        actorType: 'patient',
        actingContext: 'caregiver',
        result: 'denied',
      },
      correlationId: input.correlationId ?? null,
    });
  }
}
