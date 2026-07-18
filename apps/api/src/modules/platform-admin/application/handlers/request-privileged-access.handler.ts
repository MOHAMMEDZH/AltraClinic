import { BadRequestException, ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { RequestPrivilegedAccessCommand } from '../commands/platform-admin.commands';
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
import { PrivilegedAccessRequestedEvent } from '../../domain/events/privileged-access-requested.event';
import { PrivilegedAccessGrantedEvent } from '../../domain/events/privileged-access-granted.event';
import { resolveOperatorLocale } from './resolve-operator-locale.util';

@Injectable()
export class RequestPrivilegedAccessHandler {
  constructor(
    @Inject(PLATFORM_TENANT_REPOSITORY) private readonly repository: PlatformTenantRepository,
    private readonly tenantContext: TenantContextService,
    @Inject(EVENT_PUBLISHER) private readonly eventPublisher: EventPublisherInterface,
    @Inject(PLATFORM_ADMIN_AUDIT_LOG) private readonly auditLog: PlatformAdminAuditLog,
    private readonly policy: PlatformAdminPolicy,
  ) {}

  async execute(command: RequestPrivilegedAccessCommand): Promise<{ grantId: string; status: string }> {
    if (!command.platformTenantId?.trim()) {
      throw new BadRequestException('Platform tenant identifier is required');
    }
    if (!this.policy.canRequestPrivilegedAccess(command.actorRoles)) {
      throw new ForbiddenException('User does not have permission to request privileged access');
    }

    const expiresAt = new Date(command.expiresAt);
    if (Number.isNaN(expiresAt.getTime())) {
      throw new BadRequestException('expiresAt must be a valid ISO-8601 timestamp');
    }

    const platformTenant = await this.repository.findById(command.platformTenantId);
    if (!platformTenant) {
      throw new NotFoundException(`Platform tenant ${command.platformTenantId} not found`);
    }

    const grant = platformTenant.requestPrivilegedAccess({
      adminId: command.actorId,
      adminName: command.adminName,
      scopes: command.scopes,
      justification: command.justification,
      expiresAt,
      breakGlass: command.breakGlass,
    });
    await this.repository.save(platformTenant);

    // Break-glass grants are active immediately and emit a distinct event so the
    // mandatory post-event review pipeline can single them out.
    if (grant.breakGlass) {
      await this.eventPublisher.publish(
        new PrivilegedAccessGrantedEvent(
          platformTenant.tenantId,
          platformTenant.id,
          grant.grantId,
          grant.adminId,
          grant.scopes,
          true,
          grant.expiresAt.toISOString(),
        ),
      );
    } else {
      await this.eventPublisher.publish(
        new PrivilegedAccessRequestedEvent(
          platformTenant.tenantId,
          platformTenant.id,
          grant.grantId,
          grant.adminId,
          grant.scopes,
          grant.expiresAt.toISOString(),
        ),
      );
    }

    await this.auditLog.record({
      tenantId: platformTenant.tenantId,
      action: grant.breakGlass
        ? 'platform_admin.privileged_access.break_glass'
        : 'platform_admin.privileged_access.requested',
      resourceId: platformTenant.id,
      actorId: command.actorId,
      actorRoles: command.actorRoles,
      locale: await resolveOperatorLocale(this.tenantContext),
      reason: command.justification.trim(),
      descriptionEn: grant.breakGlass
        ? `BREAK-GLASS access activated for ${platformTenant.displayName} (scopes: ${grant.scopes.join(', ')})`
        : `Privileged access requested for ${platformTenant.displayName} (scopes: ${grant.scopes.join(', ')})`,
      descriptionAr: grant.breakGlass
        ? `تم تفعيل وصول الطوارئ للمستأجر ${platformTenant.displayName} (الصلاحيات: ${grant.scopes.join(', ')})`
        : `تم طلب وصول مميز للمستأجر ${platformTenant.displayName} (الصلاحيات: ${grant.scopes.join(', ')})`,
      details: {
        grantId: grant.grantId,
        scopes: grant.scopes.join(','),
        breakGlass: String(grant.breakGlass),
        expiresAt: grant.expiresAt.toISOString(),
      },
      correlationId: command.correlationId,
    });

    return { grantId: grant.grantId, status: grant.status };
  }
}
