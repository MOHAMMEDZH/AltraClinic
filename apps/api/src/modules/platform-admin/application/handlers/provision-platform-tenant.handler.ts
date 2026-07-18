import { BadRequestException, ConflictException, ForbiddenException, Inject, Injectable } from '@nestjs/common';
import { ProvisionPlatformTenantCommand } from '../commands/platform-admin.commands';
import { PlatformTenant } from '../../domain/entities/platform-tenant.entity';
import { PlatformTenantRepository } from '../../domain/repositories/platform-tenant.repository.interface';
import { PlatformAdminAuditLog } from '../ports/platform-admin-audit-log.port';
import {
  PLATFORM_TENANT_REPOSITORY,
  PLATFORM_ADMIN_AUDIT_LOG,
  EVENT_PUBLISHER,
} from '../../../../infrastructure/provider.tokens';
import { TenantContextService } from '../../../../infrastructure/tenant-context.service';
import { EventPublisherInterface } from '../../../../infrastructure/event-publisher.interface';
import { PlatformAdminPolicy } from '../../policies/platform-admin-policy.service';
import { PlatformTenantProvisionedEvent } from '../../domain/events/platform-tenant-provisioned.event';
import { resolveOperatorLocale } from './resolve-operator-locale.util';

@Injectable()
export class ProvisionPlatformTenantHandler {
  constructor(
    @Inject(PLATFORM_TENANT_REPOSITORY) private readonly repository: PlatformTenantRepository,
    private readonly tenantContext: TenantContextService,
    @Inject(EVENT_PUBLISHER) private readonly eventPublisher: EventPublisherInterface,
    @Inject(PLATFORM_ADMIN_AUDIT_LOG) private readonly auditLog: PlatformAdminAuditLog,
    private readonly policy: PlatformAdminPolicy,
  ) {}

  async execute(command: ProvisionPlatformTenantCommand): Promise<{ platformTenantId: string }> {
    if (!command.tenantId?.trim()) {
      throw new BadRequestException('Tenant identifier is required');
    }
    if (!this.policy.canManageTenantLifecycle(command.actorRoles)) {
      throw new ForbiddenException('User does not have permission to provision platform tenants');
    }

    const existing = await this.repository.findByTenantId(command.tenantId.trim());
    if (existing) {
      throw new ConflictException(`Tenant ${command.tenantId} is already registered on the platform`);
    }

    const platformTenant = PlatformTenant.provision({
      tenantId: command.tenantId,
      displayName: command.displayName,
      region: command.region,
      plan: command.plan,
      provisionedBy: command.actorId,
    });
    await this.repository.save(platformTenant);

    await this.eventPublisher.publish(
      new PlatformTenantProvisionedEvent(
        platformTenant.tenantId,
        platformTenant.id,
        platformTenant.displayName,
        platformTenant.region.value,
        platformTenant.plan.value,
        command.actorId,
      ),
    );

    await this.auditLog.record({
      tenantId: platformTenant.tenantId,
      action: 'platform_admin.tenant.provisioned',
      resourceId: platformTenant.id,
      actorId: command.actorId,
      actorRoles: command.actorRoles,
      locale: await resolveOperatorLocale(this.tenantContext),
      reason: null,
      descriptionEn: `Provisioned tenant ${platformTenant.displayName} (${platformTenant.region.value}, ${platformTenant.plan.value})`,
      descriptionAr: `تم تجهيز المستأجر ${platformTenant.displayName} (${platformTenant.region.value}، ${platformTenant.plan.value})`,
      details: {
        tenantId: platformTenant.tenantId,
        region: platformTenant.region.value,
        plan: platformTenant.plan.value,
      },
      correlationId: command.correlationId,
    });

    return { platformTenantId: platformTenant.id };
  }
}
