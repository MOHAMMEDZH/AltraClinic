import { BadRequestException, ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { ArchivePlatformTenantCommand } from '../commands/platform-admin.commands';
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
import { PlatformTenantArchivedEvent } from '../../domain/events/platform-tenant-archived.event';
import { PrivilegedAccessRevokedEvent } from '../../domain/events/privileged-access-revoked.event';
import { resolveOperatorLocale } from './resolve-operator-locale.util';

@Injectable()
export class ArchivePlatformTenantHandler {
  constructor(
    @Inject(PLATFORM_TENANT_REPOSITORY) private readonly repository: PlatformTenantRepository,
    private readonly tenantContext: TenantContextService,
    @Inject(EVENT_PUBLISHER) private readonly eventPublisher: EventPublisherInterface,
    @Inject(PLATFORM_ADMIN_AUDIT_LOG) private readonly auditLog: PlatformAdminAuditLog,
    private readonly policy: PlatformAdminPolicy,
  ) {}

  async execute(command: ArchivePlatformTenantCommand): Promise<void> {
    if (!command.platformTenantId?.trim()) {
      throw new BadRequestException('Platform tenant identifier is required');
    }
    if (!command.reason?.trim()) {
      throw new BadRequestException('A reason is required to archive a platform tenant');
    }
    if (!this.policy.canArchiveTenant(command.actorRoles)) {
      throw new ForbiddenException('User does not have permission to archive platform tenants');
    }

    const platformTenant = await this.repository.findById(command.platformTenantId);
    if (!platformTenant) {
      throw new NotFoundException(`Platform tenant ${command.platformTenantId} not found`);
    }

    // Capture grants that archival will cascade-revoke so each revocation is
    // observable as its own event (no silent loss of privileged access).
    const cascaded = platformTenant.activePrivilegedGrants();

    platformTenant.archive(command.reason);
    await this.repository.save(platformTenant);

    await this.eventPublisher.publish(
      new PlatformTenantArchivedEvent(
        platformTenant.tenantId,
        platformTenant.id,
        command.reason.trim(),
        command.actorId,
      ),
    );

    for (const grant of cascaded) {
      await this.eventPublisher.publish(
        new PrivilegedAccessRevokedEvent(
          platformTenant.tenantId,
          platformTenant.id,
          grant.grantId,
          grant.adminId,
          command.actorId,
          'platform_tenant_archived',
        ),
      );
    }

    await this.auditLog.record({
      tenantId: platformTenant.tenantId,
      action: 'platform_admin.tenant.archived',
      resourceId: platformTenant.id,
      actorId: command.actorId,
      actorRoles: command.actorRoles,
      locale: await resolveOperatorLocale(this.tenantContext),
      reason: command.reason.trim(),
      descriptionEn: `Archived tenant ${platformTenant.displayName}; revoked ${cascaded.length} privileged grant(s)`,
      descriptionAr: `تمت أرشفة المستأجر ${platformTenant.displayName}؛ تم إلغاء ${cascaded.length} من صلاحيات الوصول المميز`,
      details: {
        tenantId: platformTenant.tenantId,
        cascadedRevocations: String(cascaded.length),
      },
      correlationId: command.correlationId,
    });
  }
}
