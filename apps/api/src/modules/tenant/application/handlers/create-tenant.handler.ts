import { ConflictException, Inject, Injectable } from '@nestjs/common';
import { CreateTenantCommand } from '../commands/create-tenant.command';
import { Tenant } from '../../domain/tenant.entity';
import { TenantDomainVO } from '../../domain/tenant-domain.vo';
import { TenantSettingsVO } from '../../domain/tenant-settings.vo';
import { TenantRepository } from '../../domain/tenant.repository.interface';
import { TENANT_REPOSITORY, EVENT_PUBLISHER } from '../../../../infrastructure/provider.tokens';
import { EventPublisherInterface } from '../../../../infrastructure/event-publisher.interface';
import { TenantCreatedEvent } from '../../domain/events/tenant-created.event';

function genId() {
  return typeof crypto !== 'undefined' && typeof (crypto as any).randomUUID === 'function'
    ? (crypto as any).randomUUID()
    : `tenant_${Date.now().toString(36)}_${Math.random().toString(36).slice(2,8)}`;
}

@Injectable()
export class CreateTenantHandler {
  constructor(
    @Inject(TENANT_REPOSITORY) private readonly repo: TenantRepository,
    @Inject(EVENT_PUBLISHER) private readonly eventPublisher: EventPublisherInterface,
  ) {}

  async execute(cmd: CreateTenantCommand) {
    const domainVO = cmd.domain ? new TenantDomainVO(cmd.domain) : null;

    if (domainVO) {
      const exists = await this.repo.findByDomain(domainVO.value);
      if (exists) throw new ConflictException('Domain already registered');
    }

    const id = genId();
    const settings = new TenantSettingsVO(cmd.timezone ?? 'UTC');
    const tenant = new Tenant(id, cmd.name.trim(), domainVO, settings);
    await this.repo.save(tenant);
    await this.eventPublisher.publish(new TenantCreatedEvent(tenant.id, null, tenant.name, tenant.domain?.value ?? null));
    return { tenantId: id };
  }
}
