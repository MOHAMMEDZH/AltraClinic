import { BadRequestException, ForbiddenException, Inject, Injectable } from '@nestjs/common';
import { InvitePortalAccountCommand } from '../commands/invite-portal-account.command';
import { PortalAccountRepository } from '../../domain/repositories/portal-account.repository.interface';
import { PortalAuditLog } from '../ports/portal-audit-log.port';
import {
  PORTAL_ACCOUNT_REPOSITORY,
  PORTAL_AUDIT_LOG,
  EVENT_PUBLISHER,
} from '../../../../infrastructure/provider.tokens';
import { TenantContextService } from '../../../../infrastructure/tenant-context.service';
import { TenantContextContract } from '../../../../contracts/tenant-context.contract';
import { EventPublisherInterface } from '../../../../infrastructure/event-publisher.interface';
import { PatientPortalPolicy } from '../../policies/patient-portal-policy.service';
import { PortalAccount } from '../../domain/entities/portal-account.entity';
import { PortalStateError } from '../../domain/exceptions/portal-domain.exception';
import { PortalAccountInvitedEvent } from '../../domain/events/portal-account-invited.event';

@Injectable()
export class InvitePortalAccountHandler {
  constructor(
    @Inject(PORTAL_ACCOUNT_REPOSITORY) private readonly repository: PortalAccountRepository,
    private readonly tenantContext: TenantContextService,
    @Inject(EVENT_PUBLISHER) private readonly eventPublisher: EventPublisherInterface,
    @Inject(PORTAL_AUDIT_LOG) private readonly auditLog: PortalAuditLog,
    private readonly policy: PatientPortalPolicy,
  ) {}

  async execute(
    command: InvitePortalAccountCommand,
  ): Promise<{ portalAccountId: string; enrollmentToken: string }> {
    const tenant = (await this.tenantContext.resolve()) as TenantContextContract;
    if (!tenant?.tenantId) {
      throw new BadRequestException('Tenant context could not be resolved');
    }
    if (!command.patientId?.trim()) {
      throw new BadRequestException('Patient identifier is required');
    }
    if (!this.policy.canManageEnrollment(command.invitedByRoles)) {
      throw new ForbiddenException('User does not have permission to invite portal accounts');
    }

    // One portal account per patient per tenant.
    const existing = await this.repository.findByPatientId(command.patientId, tenant.tenantId);
    if (existing) {
      throw new PortalStateError('This patient already has a portal account');
    }

    const account = PortalAccount.invite({
      tenantId: tenant.tenantId,
      branchId: tenant.branchId ?? null,
      patientId: command.patientId,
      invitedBy: command.invitedBy,
      locale: command.locale ?? (tenant.locale?.toLowerCase().startsWith('ar') ? 'ar' : 'en'),
    });

    await this.repository.save(account);

    const enrollmentToken = await this.issueToken(account, command);

    await this.eventPublisher.publish(
      new PortalAccountInvitedEvent(
        account.tenantId,
        account.branchId,
        account.id,
        account.patientId,
        command.invitedBy,
      ),
    );

    await this.auditLog.record({
      tenantId: account.tenantId,
      branchId: account.branchId,
      action: 'patient_portal.account.invited',
      resourceId: account.id,
      actorId: command.invitedBy,
      actorRoles: command.invitedByRoles,
      locale: tenant.locale ?? null,
      reason: null,
      details: { patientId: account.patientId },
      correlationId: command.correlationId,
    });

    return { portalAccountId: account.id, enrollmentToken };
  }

  private async issueToken(
    account: PortalAccount,
    command: InvitePortalAccountCommand,
  ): Promise<string> {
    const raw = account.issueEnrollmentToken();
    await this.repository.save(account);
    await this.auditLog.record({
      tenantId: account.tenantId,
      branchId: account.branchId,
      action: 'patient_portal.enrollment.token_issued',
      resourceId: account.id,
      actorId: command.invitedBy,
      actorRoles: command.invitedByRoles,
      locale: null,
      reason: null,
      details: {
        expiresAt: account.enrollmentTokenExpiresAt?.toISOString() ?? '',
      },
      correlationId: command.correlationId,
    });
    return raw;
  }
}
