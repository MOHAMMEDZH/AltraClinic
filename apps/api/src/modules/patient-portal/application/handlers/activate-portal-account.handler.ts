import { BadRequestException, ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { ActivatePortalAccountCommand } from '../commands/activate-portal-account.command';
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
import { PortalAccountActivatedEvent } from '../../domain/events/portal-account-activated.event';

@Injectable()
export class ActivatePortalAccountHandler {
  constructor(
    @Inject(PORTAL_ACCOUNT_REPOSITORY) private readonly repository: PortalAccountRepository,
    private readonly tenantContext: TenantContextService,
    @Inject(EVENT_PUBLISHER) private readonly eventPublisher: EventPublisherInterface,
    @Inject(PORTAL_AUDIT_LOG) private readonly auditLog: PortalAuditLog,
    private readonly policy: PatientPortalPolicy,
  ) {}

  async execute(command: ActivatePortalAccountCommand): Promise<void> {
    const tenant = (await this.tenantContext.resolve()) as TenantContextContract;
    if (!tenant?.tenantId) {
      throw new BadRequestException('Tenant context could not be resolved');
    }
    if (!command.portalAccountId?.trim()) {
      throw new BadRequestException('Portal account identifier is required');
    }
    if (!command.userId?.trim()) {
      throw new BadRequestException('A linked user identifier is required');
    }
    if (!this.policy.canManageEnrollment(command.actorRoles)) {
      throw new ForbiddenException('User does not have permission to activate portal accounts');
    }

    const account = await this.repository.findById(command.portalAccountId, tenant.tenantId);
    if (!account) {
      throw new NotFoundException(`Portal account ${command.portalAccountId} not found`);
    }

    account.activate(command.userId);
    await this.repository.save(account);

    await this.eventPublisher.publish(
      new PortalAccountActivatedEvent(
        account.tenantId,
        account.branchId,
        account.id,
        account.patientId,
        command.userId,
      ),
    );

    await this.auditLog.record({
      tenantId: account.tenantId,
      branchId: account.branchId,
      action: 'patient_portal.account.activated',
      resourceId: account.id,
      actorId: command.actorId,
      actorRoles: command.actorRoles,
      locale: tenant.locale ?? null,
      reason: null,
      details: { userId: command.userId },
      correlationId: command.correlationId,
    });
  }
}
