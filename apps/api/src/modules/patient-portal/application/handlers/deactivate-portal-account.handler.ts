import { BadRequestException, ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { DeactivatePortalAccountCommand } from '../commands/deactivate-portal-account.command';
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
import { PortalAccountDeactivatedEvent } from '../../domain/events/portal-account-deactivated.event';
import { CaregiverAccessRevokedEvent } from '../../domain/events/caregiver-access-revoked.event';

@Injectable()
export class DeactivatePortalAccountHandler {
  constructor(
    @Inject(PORTAL_ACCOUNT_REPOSITORY) private readonly repository: PortalAccountRepository,
    private readonly tenantContext: TenantContextService,
    @Inject(EVENT_PUBLISHER) private readonly eventPublisher: EventPublisherInterface,
    @Inject(PORTAL_AUDIT_LOG) private readonly auditLog: PortalAuditLog,
    private readonly policy: PatientPortalPolicy,
  ) {}

  async execute(command: DeactivatePortalAccountCommand): Promise<void> {
    const tenant = (await this.tenantContext.resolve()) as TenantContextContract;
    if (!tenant?.tenantId) {
      throw new BadRequestException('Tenant context could not be resolved');
    }
    if (!command.portalAccountId?.trim()) {
      throw new BadRequestException('Portal account identifier is required');
    }
    if (!this.policy.canGovernAccounts(command.actorRoles)) {
      throw new ForbiddenException('User does not have permission to deactivate portal accounts');
    }

    const account = await this.repository.findById(command.portalAccountId, tenant.tenantId);
    if (!account) {
      throw new NotFoundException(`Portal account ${command.portalAccountId} not found`);
    }

    const now = new Date();
    const grantsRevokedByCascade = account.activeCaregiverGrants(now).map((grant) => grant.grantId);

    account.deactivate(command.reason, now);
    await this.repository.save(account);

    await this.eventPublisher.publish(
      new PortalAccountDeactivatedEvent(
        account.tenantId,
        account.branchId,
        account.id,
        account.patientId,
        command.reason,
        command.actorId,
        grantsRevokedByCascade,
      ),
    );

    // Emit an explicit revocation event per cascaded grant so downstream
    // consumers that track caregiver access stay consistent.
    for (const grantId of grantsRevokedByCascade) {
      await this.eventPublisher.publish(
        new CaregiverAccessRevokedEvent(
          account.tenantId,
          account.branchId,
          account.id,
          account.patientId,
          grantId,
          'portal_account_deactivated',
          command.actorId,
        ),
      );
    }

    await this.auditLog.record({
      tenantId: account.tenantId,
      branchId: account.branchId,
      action: 'patient_portal.account.deactivated',
      resourceId: account.id,
      actorId: command.actorId,
      actorRoles: command.actorRoles,
      locale: tenant.locale ?? null,
      reason: command.reason,
      details: {
        patientId: account.patientId,
        revokedGrantCount: String(grantsRevokedByCascade.length),
      },
      correlationId: command.correlationId,
    });
  }
}
