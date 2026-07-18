import { BadRequestException, ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { GrantCaregiverAccessCommand } from '../commands/grant-caregiver-access.command';
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
import { CaregiverAccessGrantedEvent } from '../../domain/events/caregiver-access-granted.event';
import { assertPortalAccountOwner } from './portal-ownership.guard';

@Injectable()
export class GrantCaregiverAccessHandler {
  constructor(
    @Inject(PORTAL_ACCOUNT_REPOSITORY) private readonly repository: PortalAccountRepository,
    private readonly tenantContext: TenantContextService,
    @Inject(EVENT_PUBLISHER) private readonly eventPublisher: EventPublisherInterface,
    @Inject(PORTAL_AUDIT_LOG) private readonly auditLog: PortalAuditLog,
  ) {}

  async execute(command: GrantCaregiverAccessCommand): Promise<{ grantId: string }> {
    const tenant = (await this.tenantContext.resolve()) as TenantContextContract;
    if (!tenant?.tenantId) {
      throw new BadRequestException('Tenant context could not be resolved');
    }
    if (!command.portalAccountId?.trim()) {
      throw new BadRequestException('Portal account identifier is required');
    }

    const account = await this.repository.findById(command.portalAccountId, tenant.tenantId);
    if (!account) {
      throw new NotFoundException(`Portal account ${command.portalAccountId} not found`);
    }

    // Caregiver consent is personal: only the owning patient may grant it.
    assertPortalAccountOwner(account, command.actorId, 'grant caregiver access');

    const expiresAt = command.expiresAt ? new Date(command.expiresAt) : null;
    if (expiresAt && Number.isNaN(expiresAt.getTime())) {
      throw new BadRequestException('Invalid caregiver access expiry date');
    }

    const grant = account.grantCaregiverAccess({
      caregiverContact: command.caregiverContact,
      caregiverName: command.caregiverName,
      scopes: command.scopes,
      grantedBy: command.actorId,
      expiresAt,
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
        command.actorId,
        grant.expiresAt?.toISOString() ?? null,
      ),
    );

    await this.auditLog.record({
      tenantId: account.tenantId,
      branchId: account.branchId,
      action: 'patient_portal.caregiver_access.granted',
      resourceId: account.id,
      actorId: command.actorId,
      actorRoles: command.actorRoles,
      locale: tenant.locale ?? null,
      reason: null,
      details: {
        grantId: grant.grantId,
        caregiverContact: grant.caregiverContact,
        scopes: grant.scopes.join(','),
      },
      correlationId: command.correlationId,
    });

    return { grantId: grant.grantId };
  }
}
