import { BadRequestException, ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { SuspendPlatformTenantCommand } from '../commands/platform-admin.commands';
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
import { PlatformTenantSuspendedEvent } from '../../domain/events/platform-tenant-suspended.event';
import { resolveOperatorLocale } from './resolve-operator-locale.util';

@Injectable()
export class SuspendPlatformTenantHandler {
  constructor(
    @Inject(PLATFORM_TENANT_REPOSITORY) private readonly repository: PlatformTenantRepository,
    private readonly tenantContext: TenantContextService,
    @Inject(EVENT_PUBLISHER) private readonly eventPublisher: EventPublisherInterface,
    @Inject(PLATFORM_ADMIN_AUDIT_LOG) private readonly auditLog: PlatformAdminAuditLog,
    private readonly policy: PlatformAdminPolicy,
  ) {}

  async execute(command: SuspendPlatformTenantCommand): Promise<void> {
    if (!command.platformTenantId?.trim()) {
      throw new BadRequestException('Platform tenant identifier is required');
    }
    if (!command.reason?.trim()) {
      throw new BadRequestException('A reason is required to suspend a platform tenant');
    }
    if (!this.policy.canManageTenantLifecycle(command.actorRoles)) {
      throw new ForbiddenException('User does not have permission to suspend platform tenants');
    }

    const platformTenant = await this.repository.findById(command.platformTenantId);
    if (!platformTenant) {
      throw new NotFoundException(`Platform tenant ${command.platformTenantId} not found`);
    }

    platformTenant.suspend(command.reason);
    await this.repository.save(platformTenant);

    await this.eventPublisher.publish(
      new PlatformTenantSuspendedEvent(
        platformTenant.tenantId,
        platformTenant.id,
        command.reason.trim(),
        command.actorId,
      ),
    );

    await this.auditLog.record({
      tenantId: platformTenant.tenantId,
      action: 'platform_admin.tenant.suspended',
      resourceId: platformTenant.id,
      actorId: command.actorId,
      actorRoles: command.actorRoles,
      locale: await resolveOperatorLocale(this.tenantContext),
      reason: command.reason.trim(),
      descriptionEn: `Suspended tenant ${platformTenant.displayName}`,
      descriptionAr: `تم تعليق المستأجر ${platformTenant.displayName}`,
      details: { tenantId: platformTenant.tenantId },
      correlationId: command.correlationId,
    });
  }
}
