import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { RevokeCaregiverAccessCommand } from '../commands/revoke-caregiver-access.command';
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
import { CaregiverAccessRevokedEvent } from '../../domain/events/caregiver-access-revoked.event';
import { assertPortalAccountOwner } from './portal-ownership.guard';

@Injectable()
export class RevokeCaregiverAccessHandler {
  constructor(
    @Inject(PORTAL_ACCOUNT_REPOSITORY) private readonly repository: PortalAccountRepository,
    private readonly tenantContext: TenantContextService,
    @Inject(EVENT_PUBLISHER) private readonly eventPublisher: EventPublisherInterface,
    @Inject(PORTAL_AUDIT_LOG) private readonly auditLog: PortalAuditLog,
  ) {}

  async execute(command: RevokeCaregiverAccessCommand): Promise<void> {
    const tenant = (await this.tenantContext.resolve()) as TenantContextContract;
    if (!tenant?.tenantId) {
      throw new BadRequestException('Tenant context could not be resolved');
    }
    if (!command.portalAccountId?.trim()) {
      throw new BadRequestException('Portal account identifier is required');
    }
    if (!command.grantId?.trim()) {
      throw new BadRequestException('Caregiver grant identifier is required');
    }

    const account = await this.repository.findById(command.portalAccountId, tenant.tenantId);
    if (!account) {
      throw new NotFoundException(`Portal account ${command.portalAccountId} not found`);
    }

    // Revoking consent is personal: only the owning patient may do it.
    assertPortalAccountOwner(account, command.actorId, 'revoke caregiver access');

    account.revokeCaregiverAccess(command.grantId, command.reason);
    await this.repository.save(account);

    await this.eventPublisher.publish(
      new CaregiverAccessRevokedEvent(
        account.tenantId,
        account.branchId,
        account.id,
        account.patientId,
        command.grantId,
        command.reason,
        command.actorId,
      ),
    );

    await this.auditLog.record({
      tenantId: account.tenantId,
      branchId: account.branchId,
      action: 'patient_portal.caregiver_access.revoked',
      resourceId: account.id,
      actorId: command.actorId,
      actorRoles: command.actorRoles,
      locale: tenant.locale ?? null,
      reason: command.reason,
      details: { grantId: command.grantId },
      correlationId: command.correlationId,
    });
  }
}
