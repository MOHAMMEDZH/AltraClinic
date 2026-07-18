import { BadRequestException, ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { SuspendPortalAccountCommand } from '../commands/suspend-portal-account.command';
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
import { PortalAccountSuspendedEvent } from '../../domain/events/portal-account-suspended.event';

@Injectable()
export class SuspendPortalAccountHandler {
  constructor(
    @Inject(PORTAL_ACCOUNT_REPOSITORY) private readonly repository: PortalAccountRepository,
    private readonly tenantContext: TenantContextService,
    @Inject(EVENT_PUBLISHER) private readonly eventPublisher: EventPublisherInterface,
    @Inject(PORTAL_AUDIT_LOG) private readonly auditLog: PortalAuditLog,
    private readonly policy: PatientPortalPolicy,
  ) {}

  async execute(command: SuspendPortalAccountCommand): Promise<void> {
    const tenant = (await this.tenantContext.resolve()) as TenantContextContract;
    if (!tenant?.tenantId) {
      throw new BadRequestException('Tenant context could not be resolved');
    }
    if (!command.portalAccountId?.trim()) {
      throw new BadRequestException('Portal account identifier is required');
    }
    if (!command.reason?.trim()) {
      throw new BadRequestException('A reason is required to suspend a portal account');
    }
    if (!this.policy.canGovernAccounts(command.actorRoles)) {
      throw new ForbiddenException('User does not have permission to suspend portal accounts');
    }

    const account = await this.repository.findById(command.portalAccountId, tenant.tenantId);
    if (!account) {
      throw new NotFoundException(`Portal account ${command.portalAccountId} not found`);
    }

    account.suspend(command.reason);
    await this.repository.save(account);

    await this.eventPublisher.publish(
      new PortalAccountSuspendedEvent(
        account.tenantId,
        account.branchId,
        account.id,
        account.patientId,
        command.reason.trim(),
        command.actorId,
      ),
    );

    await this.auditLog.record({
      tenantId: account.tenantId,
      branchId: account.branchId,
      action: 'patient_portal.account.suspended',
      resourceId: account.id,
      actorId: command.actorId,
      actorRoles: command.actorRoles,
      locale: tenant.locale ?? null,
      reason: command.reason.trim(),
      details: { patientId: account.patientId },
      correlationId: command.correlationId,
    });
  }
}
