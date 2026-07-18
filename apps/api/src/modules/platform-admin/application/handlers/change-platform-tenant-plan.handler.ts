import { BadRequestException, ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { ChangePlatformTenantPlanCommand } from '../commands/platform-admin.commands';
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
import { PlatformTenantPlanChangedEvent } from '../../domain/events/platform-tenant-plan-changed.event';
import { resolveOperatorLocale } from './resolve-operator-locale.util';
import { normalizeEntitlementPlan } from '../../domain/value-objects/entitlement-plan';

@Injectable()
export class ChangePlatformTenantPlanHandler {
  constructor(
    @Inject(PLATFORM_TENANT_REPOSITORY) private readonly repository: PlatformTenantRepository,
    private readonly tenantContext: TenantContextService,
    @Inject(EVENT_PUBLISHER) private readonly eventPublisher: EventPublisherInterface,
    @Inject(PLATFORM_ADMIN_AUDIT_LOG) private readonly auditLog: PlatformAdminAuditLog,
    private readonly policy: PlatformAdminPolicy,
  ) {}

  async execute(command: ChangePlatformTenantPlanCommand): Promise<{ changed: boolean }> {
    if (!command.platformTenantId?.trim()) {
      throw new BadRequestException('Platform tenant identifier is required');
    }
    if (!command.plan?.trim()) {
      throw new BadRequestException('A target plan is required');
    }
    const normalizedPlan = normalizeEntitlementPlan(command.plan);
    if (!normalizedPlan) {
      throw new BadRequestException(`Unsupported plan: ${command.plan}`);
    }
    if (!this.policy.canManageTenantLifecycle(command.actorRoles)) {
      throw new ForbiddenException('User does not have permission to change platform tenant plans');
    }

    const platformTenant = await this.repository.findById(command.platformTenantId);
    if (!platformTenant) {
      throw new NotFoundException(`Platform tenant ${command.platformTenantId} not found`);
    }

    const previousPlan = platformTenant.plan.value;
    const changed = platformTenant.changePlan(normalizedPlan);
    if (!changed) {
      return { changed: false };
    }

    await this.repository.save(platformTenant);

    await this.eventPublisher.publish(
      new PlatformTenantPlanChangedEvent(
        platformTenant.tenantId,
        platformTenant.id,
        previousPlan,
        platformTenant.plan.value,
        command.actorId,
      ),
    );

    await this.auditLog.record({
      tenantId: platformTenant.tenantId,
      action: 'platform_admin.tenant.plan_changed',
      resourceId: platformTenant.id,
      actorId: command.actorId,
      actorRoles: command.actorRoles,
      locale: await resolveOperatorLocale(this.tenantContext),
      reason: null,
      descriptionEn: `Changed plan of ${platformTenant.displayName} from ${previousPlan} to ${platformTenant.plan.value}`,
      descriptionAr: `تم تغيير خطة ${platformTenant.displayName} من ${previousPlan} إلى ${platformTenant.plan.value}`,
      details: { tenantId: platformTenant.tenantId, previousPlan, newPlan: platformTenant.plan.value },
      correlationId: command.correlationId,
    });

    return { changed: true };
  }
}
