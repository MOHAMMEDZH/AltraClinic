import { createHash, randomBytes } from 'crypto';
import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { TenantContextService } from '../../../../infrastructure/tenant-context.service';
import {
  EVENT_PUBLISHER,
  PORTAL_ACCOUNT_REPOSITORY,
  PORTAL_AUDIT_LOG,
} from '../../../../infrastructure/provider.tokens';
import { PortalAccountRepository } from '../../domain/repositories/portal-account.repository.interface';
import { PortalAuditLog } from '../ports/portal-audit-log.port';
import { EventPublisherInterface } from '../../../../infrastructure/event-publisher.interface';
import { CaregiverAccessGrantedEvent } from '../../domain/events/caregiver-access-granted.event';
import { CaregiverAccessRevokedEvent } from '../../domain/events/caregiver-access-revoked.event';
import {
  CaregiverAccessScope,
  isCaregiverAccessScope,
  isCaregiverMvpScope,
} from '../../domain/value-objects/caregiver-access-scope';
import { NotificationIntentProducerService } from '../../../notifications/delivery/notification-intent-producer.service';
import { PatientPortalActivityEmitter } from './patient-portal-activity.emitter';
import { PatientPortalObservabilityContracts } from '../patient-portal-observability.contracts';
import { PATIENT_PORTAL_ERROR_CODES } from '../../patient-portal.constants';
import { buildPatientPortalSafeError } from '../../api/patient-portal-safe-errors';
import { PrismaService } from '../../../../infrastructure/prisma.service';
import { SubscriptionEnforcementService } from '../../../subscription/application/services/subscription-enforcement.service';
import { isPatientPortalCaregiverEnabled } from '../../config/patient-portal-config';
import { toPortalAccountDto } from '../mappers/portal-account.mapper';

const PRODUCER = 'patient-portal.caregiver';
const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

function hashToken(raw: string): string {
  return createHash('sha256').update(raw).digest('hex');
}

@Injectable()
export class PortalCaregiverLifecycleService {
  private readonly logger = new Logger(PortalCaregiverLifecycleService.name);

  constructor(
    @Inject(PORTAL_ACCOUNT_REPOSITORY) private readonly repository: PortalAccountRepository,
    private readonly tenantContext: TenantContextService,
    @Inject(EVENT_PUBLISHER) private readonly eventPublisher: EventPublisherInterface,
    @Inject(PORTAL_AUDIT_LOG) private readonly auditLog: PortalAuditLog,
    private readonly notifications: NotificationIntentProducerService,
    private readonly activity: PatientPortalActivityEmitter,
    private readonly observability: PatientPortalObservabilityContracts,
    private readonly prisma: PrismaService,
    private readonly enforcement: SubscriptionEnforcementService,
  ) {}

  private async assertCaregiverCapability(tenantId: string): Promise<void> {
    if (!isPatientPortalCaregiverEnabled()) {
      throw new ForbiddenException(
        buildPatientPortalSafeError(PATIENT_PORTAL_ERROR_CODES.CAREGIVER_DISABLED),
      );
    }
    try {
      await this.enforcement.enforceFeature(tenantId, 'caregiverAccess');
    } catch {
      throw new ForbiddenException(
        buildPatientPortalSafeError(PATIENT_PORTAL_ERROR_CODES.CAREGIVER_LICENSE_DENIED),
      );
    }
  }

  async invite(input: {
    actorUserId: string;
    actorRoles: string[];
    caregiverContact: string;
    caregiverName: string;
    scopes: CaregiverAccessScope[];
    expiresAt?: string | null;
    correlationId?: string | null;
  }) {
    const tenant = await this.tenantContext.resolve();
    await this.assertCaregiverCapability(tenant.tenantId);

    const account = await this.repository.findByUserId(input.actorUserId, tenant.tenantId);
    if (!account) {
      throw new ForbiddenException(
        buildPatientPortalSafeError(PATIENT_PORTAL_ERROR_CODES.INVALID_SESSION),
      );
    }

    const scopes = input.scopes.filter(isCaregiverAccessScope);
    if (!scopes.length || !scopes.every(isCaregiverMvpScope)) {
      throw new BadRequestException(
        buildPatientPortalSafeError(PATIENT_PORTAL_ERROR_CODES.SCOPE_DENIED),
      );
    }

    const rawToken = randomBytes(32).toString('hex');
    const expiresAt = input.expiresAt ? new Date(input.expiresAt) : null;
    if (expiresAt && Number.isNaN(expiresAt.getTime())) {
      throw new BadRequestException('Invalid expiry');
    }

    const grant = account.grantCaregiverAccess({
      caregiverContact: input.caregiverContact,
      caregiverName: input.caregiverName,
      scopes,
      grantedBy: input.actorUserId,
      expiresAt,
      status: 'invited',
      invitationTokenHash: hashToken(rawToken),
      invitationExpiresAt: new Date(Date.now() + INVITE_TTL_MS),
    });
    await this.repository.save(account);

    await this.eventPublisher.publish(
      new CaregiverAccessGrantedEvent(
        account.tenantId,
        account.branchId,
        account.id,
        account.patientId,
        grant.grantId,
        grant.caregiverContact,
        grant.scopes,
        input.actorUserId,
        grant.expiresAt?.toISOString() ?? null,
      ),
    );

    await this.auditLog.record({
      tenantId: account.tenantId,
      branchId: account.branchId,
      action: 'patient_portal.caregiver.invited',
      resourceId: account.id,
      actorId: input.actorUserId,
      actorRoles: input.actorRoles,
      locale: null,
      reason: null,
      details: {
        grantId: grant.grantId,
        scopes: grant.scopes.join(','),
        actorType: 'patient',
        actingContext: 'self',
        result: 'success',
      },
      correlationId: input.correlationId ?? null,
    });
    this.activity.emit({
      event: 'caregiver_invited',
      tenantId: account.tenantId,
      correlationId: input.correlationId,
    });

    try {
      await this.notifications.produceInApp({
        tenantId: account.tenantId,
        branchId: account.branchId,
        recipientId: account.patientId,
        title: 'Caregiver invitation sent',
        body: 'A caregiver invitation was created for your portal account.',
        priority: 'medium',
        idempotencyKey: `portal-caregiver-invite:${account.tenantId}:${grant.grantId}`,
        producerModuleId: PRODUCER,
        correlationId: input.correlationId ?? undefined,
        metadata: { grantId: grant.grantId, event: 'caregiver_invited' },
      });
    } catch {
      this.logger.warn(
        this.observability.createFoundationLogFields({
          event: 'caregiver.notification_failed',
          tenantId: account.tenantId,
          correlationId: input.correlationId,
        }),
      );
    }

    return {
      grantId: grant.grantId,
      status: grant.status,
      invitationToken: rawToken,
      invitationExpiresAt: grant.invitationExpiresAt?.toISOString() ?? null,
    };
  }

  async listMine(actorUserId: string) {
    const tenant = await this.tenantContext.resolve();
    await this.assertCaregiverCapability(tenant.tenantId);
    const account = await this.repository.findByUserId(actorUserId, tenant.tenantId);
    if (!account) {
      throw new ForbiddenException(
        buildPatientPortalSafeError(PATIENT_PORTAL_ERROR_CODES.INVALID_SESSION),
      );
    }
    return toPortalAccountDto(account, { viewerIsOwner: true }).caregiverGrants;
  }

  async revoke(input: {
    actorUserId: string;
    actorRoles: string[];
    grantId: string;
    reason?: string | null;
    correlationId?: string | null;
  }) {
    const tenant = await this.tenantContext.resolve();
    await this.assertCaregiverCapability(tenant.tenantId);
    const account = await this.repository.findByUserId(input.actorUserId, tenant.tenantId);
    if (!account) {
      throw new ForbiddenException(
        buildPatientPortalSafeError(PATIENT_PORTAL_ERROR_CODES.INVALID_SESSION),
      );
    }
    account.revokeCaregiverAccess(input.grantId, input.reason ?? null);
    await this.repository.save(account);

    await this.eventPublisher.publish(
      new CaregiverAccessRevokedEvent(
        account.tenantId,
        account.branchId,
        account.id,
        account.patientId,
        input.grantId,
        input.reason ?? null,
        input.actorUserId,
      ),
    );
    await this.auditLog.record({
      tenantId: account.tenantId,
      branchId: account.branchId,
      action: 'patient_portal.caregiver.revoked',
      resourceId: account.id,
      actorId: input.actorUserId,
      actorRoles: input.actorRoles,
      locale: null,
      reason: input.reason ?? null,
      details: {
        grantId: input.grantId,
        actorType: 'patient',
        actingContext: 'self',
        result: 'success',
      },
      correlationId: input.correlationId ?? null,
    });
    this.activity.emit({
      event: 'caregiver_revoked',
      tenantId: account.tenantId,
      correlationId: input.correlationId,
    });

    try {
      await this.notifications.produceInApp({
        tenantId: account.tenantId,
        branchId: account.branchId,
        recipientId: account.patientId,
        title: 'Caregiver access revoked',
        body: 'A caregiver grant on your portal account was revoked.',
        priority: 'medium',
        idempotencyKey: `portal-caregiver-revoke:${account.tenantId}:${input.grantId}`,
        producerModuleId: PRODUCER,
        correlationId: input.correlationId ?? undefined,
        metadata: { grantId: input.grantId, event: 'caregiver_revoked' },
      });
    } catch {
      /* non-blocking */
    }

    return { status: 'ok' };
  }

  async acceptInvitation(input: {
    actorUserId: string;
    actorRoles: string[];
    invitationToken: string;
    correlationId?: string | null;
  }) {
    const tenant = await this.tenantContext.resolve();
    await this.assertCaregiverCapability(tenant.tenantId);
    const tokenHash = hashToken(input.invitationToken.trim());

    const row = await this.prisma.caregiverAccessGrant.findFirst({
      where: { invitationTokenHash: tokenHash },
      include: { portalAccount: true },
    });
    if (!row || row.portalAccount.tenantId !== tenant.tenantId) {
      throw new NotFoundException(
        buildPatientPortalSafeError(PATIENT_PORTAL_ERROR_CODES.GRANT_NOT_FOUND),
      );
    }

    const account = await this.repository.findById(row.portalAccountId, tenant.tenantId);
    if (!account) {
      throw new NotFoundException(
        buildPatientPortalSafeError(PATIENT_PORTAL_ERROR_CODES.GRANT_NOT_FOUND),
      );
    }

    const actorEmail = await this.prisma.user.findFirst({
      where: { id: input.actorUserId, tenantId: tenant.tenantId, deletedAt: null },
      select: { email: true },
    });
    if (
      !actorEmail?.email ||
      actorEmail.email.trim().toLowerCase() !== row.caregiverContact.toLowerCase()
    ) {
      throw new ForbiddenException(
        buildPatientPortalSafeError(PATIENT_PORTAL_ERROR_CODES.GRANT_DENIED),
      );
    }

    account.acceptCaregiverInvitation(row.id, input.actorUserId);
    await this.repository.save(account);

    await this.auditLog.record({
      tenantId: account.tenantId,
      branchId: account.branchId,
      action: 'patient_portal.caregiver.accepted',
      resourceId: account.id,
      actorId: input.actorUserId,
      actorRoles: input.actorRoles,
      locale: null,
      reason: null,
      details: {
        grantId: row.id,
        actorType: 'patient',
        actingContext: 'caregiver',
        result: 'success',
      },
      correlationId: input.correlationId ?? null,
    });
    this.activity.emit({
      event: 'caregiver_accepted',
      tenantId: account.tenantId,
      correlationId: input.correlationId,
    });

    try {
      await this.notifications.produceInApp({
        tenantId: account.tenantId,
        branchId: account.branchId,
        recipientId: account.patientId,
        title: 'Caregiver invitation accepted',
        body: 'A caregiver accepted an invitation to your portal account.',
        priority: 'medium',
        idempotencyKey: `portal-caregiver-accept:${account.tenantId}:${row.id}`,
        producerModuleId: PRODUCER,
        correlationId: input.correlationId ?? undefined,
        metadata: { grantId: row.id, event: 'caregiver_accepted' },
      });
    } catch {
      /* non-blocking */
    }

    return { grantId: row.id, status: 'active', subjectPatientId: account.patientId };
  }

  async declineInvitation(input: {
    actorUserId: string;
    actorRoles: string[];
    invitationToken: string;
    correlationId?: string | null;
  }) {
    const tenant = await this.tenantContext.resolve();
    await this.assertCaregiverCapability(tenant.tenantId);
    const tokenHash = hashToken(input.invitationToken.trim());
    const row = await this.prisma.caregiverAccessGrant.findFirst({
      where: { invitationTokenHash: tokenHash },
      include: { portalAccount: true },
    });
    if (!row || row.portalAccount.tenantId !== tenant.tenantId) {
      throw new NotFoundException(
        buildPatientPortalSafeError(PATIENT_PORTAL_ERROR_CODES.GRANT_NOT_FOUND),
      );
    }
    const account = await this.repository.findById(row.portalAccountId, tenant.tenantId);
    if (!account) {
      throw new NotFoundException(
        buildPatientPortalSafeError(PATIENT_PORTAL_ERROR_CODES.GRANT_NOT_FOUND),
      );
    }
    account.declineCaregiverInvitation(row.id);
    await this.repository.save(account);

    await this.auditLog.record({
      tenantId: account.tenantId,
      branchId: account.branchId,
      action: 'patient_portal.caregiver.declined',
      resourceId: account.id,
      actorId: input.actorUserId,
      actorRoles: input.actorRoles,
      locale: null,
      reason: null,
      details: {
        grantId: row.id,
        actorType: 'patient',
        actingContext: 'caregiver',
        result: 'success',
      },
      correlationId: input.correlationId ?? null,
    });
    this.activity.emit({
      event: 'caregiver_declined',
      tenantId: account.tenantId,
      correlationId: input.correlationId,
    });
    return { grantId: row.id, status: 'declined' };
  }

  async listDelegatedPatients(actorUserId: string) {
    const tenant = await this.tenantContext.resolve();
    await this.assertCaregiverCapability(tenant.tenantId);
    const now = new Date();
    const grants = await this.prisma.caregiverAccessGrant.findMany({
      where: {
        caregiverUserId: actorUserId,
        status: 'active',
        revokedAt: null,
        portalAccount: { tenantId: tenant.tenantId, status: 'ACTIVE' },
        OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
      },
      include: { portalAccount: { select: { patientId: true, id: true } } },
      take: 50,
    });
    return {
      items: grants.map((g) => ({
        grantId: g.id,
        subjectPatientId: g.portalAccount.patientId,
        subjectPortalAccountId: g.portalAccount.id,
        scopes: g.scopes,
        expiresAt: g.expiresAt?.toISOString() ?? null,
      })),
    };
  }
}
