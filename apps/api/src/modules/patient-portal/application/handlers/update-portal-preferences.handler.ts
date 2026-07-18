import { BadRequestException, ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { UpdatePortalPreferencesCommand } from '../commands/update-portal-preferences.command';
import { PortalAccountRepository } from '../../domain/repositories/portal-account.repository.interface';
import {
  PORTAL_ACCOUNT_REPOSITORY,
  EVENT_PUBLISHER,
} from '../../../../infrastructure/provider.tokens';
import { TenantContextService } from '../../../../infrastructure/tenant-context.service';
import { TenantContextContract } from '../../../../contracts/tenant-context.contract';
import { EventPublisherInterface } from '../../../../infrastructure/event-publisher.interface';
import { PortalPreferencesVO } from '../../domain/value-objects/portal-preferences.vo';
import { PortalPreferencesUpdatedEvent } from '../../domain/events/portal-preferences-updated.event';
import { assertPortalAccountOwner } from './portal-ownership.guard';

@Injectable()
export class UpdatePortalPreferencesHandler {
  constructor(
    @Inject(PORTAL_ACCOUNT_REPOSITORY) private readonly repository: PortalAccountRepository,
    private readonly tenantContext: TenantContextService,
    @Inject(EVENT_PUBLISHER) private readonly eventPublisher: EventPublisherInterface,
  ) {}

  async execute(command: UpdatePortalPreferencesCommand): Promise<void> {
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

    // Preferences are personal: only the owning patient may change them.
    assertPortalAccountOwner(account, command.actorId, 'update portal preferences');

    const preferences = new PortalPreferencesVO(command.locale, command.channels);
    const changed = account.updatePreferences(preferences);
    if (!changed) {
      return;
    }

    await this.repository.save(account);

    await this.eventPublisher.publish(
      new PortalPreferencesUpdatedEvent(
        account.tenantId,
        account.branchId,
        account.id,
        account.patientId,
        preferences.locale,
        preferences.channels,
      ),
    );
  }
}
