import { BadRequestException, ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { RevokePrivilegedAccessCommand } from '../commands/platform-admin.commands';
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
import { PrivilegedAccessRevokedEvent } from '../../domain/events/privileged-access-revoked.event';
import { resolveOperatorLocale } from './resolve-operator-locale.util';

@Injectable()
export class RevokePrivilegedAccessHandler {
  constructor(
    @Inject(PLATFORM_TENANT_REPOSITORY) private readonly repository: PlatformTenantRepository,
    private readonly tenantContext: TenantContextService,
    @Inject(EVENT_PUBLISHER) private readonly eventPublisher: EventPublisherInterface,
    @Inject(PLATFORM_ADMIN_AUDIT_LOG) private readonly auditLog: PlatformAdminAuditLog,
    private readonly policy: PlatformAdminPolicy,
  ) {}

  async execute(command: RevokePrivilegedAccessCommand): Promise<void> {
    if (!command.platformTenantId?.trim() || !command.grantId?.trim()) {
      throw new BadRequestException('Platform tenant and grant identifiers are required');
    }
    if (!this.policy.canReviewPrivilegedAccess(command.actorRoles)) {
      throw new ForbiddenException('User does not have permission to revoke privileged access');
    }

    const platformTenant = await this.repository.findById(command.platformTenantId);
    if (!platformTenant) {
      throw new NotFoundException(`Platform tenant ${command.platformTenantId} not found`);
    }

    const grant = platformTenant.revokePrivilegedAccess(command.grantId, command.reason);
    await this.repository.save(platformTenant);

    await this.eventPublisher.publish(
      new PrivilegedAccessRevokedEvent(
        platformTenant.tenantId,
        platformTenant.id,
        grant.grantId,
        grant.adminId,
        command.actorId,
        command.reason?.trim() || null,
      ),
    );

    await this.auditLog.record({
      tenantId: platformTenant.tenantId,
      action: 'platform_admin.privileged_access.revoked',
      resourceId: platformTenant.id,
      actorId: command.actorId,
      actorRoles: command.actorRoles,
      locale: await resolveOperatorLocale(this.tenantContext),
      reason: command.reason?.trim() || null,
      descriptionEn: `Revoked privileged access for ${grant.adminName} on ${platformTenant.displayName}`,
      descriptionAr: `تم إلغاء الوصول المميز لـ ${grant.adminName} على ${platformTenant.displayName}`,
      details: { grantId: grant.grantId, requestedBy: grant.adminId },
      correlationId: command.correlationId,
    });
  }
}
