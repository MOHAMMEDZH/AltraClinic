import { Injectable, OnModuleInit, Optional } from '@nestjs/common';
import { DomainEvent } from '../../../../common/event.base';
import { DomainEventBus } from '../../../../infrastructure/domain-event-bus.service';
import { DomainEventHandler } from '../../../../infrastructure/domain-event-handler.interface';
import { PlatformTenantPlanChangedEvent } from '../../../platform-admin/domain/events/platform-tenant-plan-changed.event';
import { PlatformTenantSuspendedEvent } from '../../../platform-admin/domain/events/platform-tenant-suspended.event';
import { PlatformTenantResumedEvent } from '../../../platform-admin/domain/events/platform-tenant-resumed.event';
import { PlatformTenantArchivedEvent } from '../../../platform-admin/domain/events/platform-tenant-archived.event';
import {
  gainedFeaturesOnUpgrade,
  lostFeaturesOnDowngrade,
} from '../../domain/config/licensing.config';
import { subscriptionPlanToUiPlan } from '../../domain/config/plan-name.mapper';
import { LicensingCommercialAuditService } from '../services/licensing-commercial-audit.service';
import { LicensingLifecycleStateService } from '../services/licensing-lifecycle-state.service';
import { LicensingEngineService } from '../services/licensing-engine.service';

/**
 * Records commercially significant licensing events to LicenseAuditEvent
 * when platform lifecycle domain events are published.
 */
@Injectable()
export class LicensingCommercialAuditListener implements DomainEventHandler, OnModuleInit {
  constructor(
    @Optional() private readonly bus: DomainEventBus,
    private readonly commercialAudit: LicensingCommercialAuditService,
    private readonly lifecycleState: LicensingLifecycleStateService,
    private readonly licensing: LicensingEngineService,
  ) {}

  onModuleInit(): void {
    this.bus?.register(this);
  }

  async handle(event: DomainEvent): Promise<void> {
    if (event instanceof PlatformTenantPlanChangedEvent) {
      const fromUi = subscriptionPlanToUiPlan(event.previousPlan as 'lite' | 'pro' | 'enterprise');
      const toUi = subscriptionPlanToUiPlan(event.newPlan as 'lite' | 'pro' | 'enterprise');

      if (fromUi === toUi) {
        await this.commercialAudit.recordPlanRenewal({
          tenantId: event.tenantId,
          actorId: event.changedBy,
          plan: event.newPlan,
          source: 'event.platform.plan_changed',
          correlationId: event.eventId,
        });
        return;
      }

      await this.commercialAudit.recordPlanChange({
        tenantId: event.tenantId,
        actorId: event.changedBy,
        previousPlan: event.previousPlan,
        newPlan: event.newPlan,
        source: 'event.platform.plan_changed',
        correlationId: event.eventId,
      });

      for (const feature of lostFeaturesOnDowngrade(fromUi, toUi)) {
        await this.commercialAudit.recordFeatureDisable({
          tenantId: event.tenantId,
          actorId: event.changedBy,
          featureId: feature.id,
          plan: toUi,
          source: 'event.platform.plan_changed',
          correlationId: event.eventId,
        });
      }
      for (const feature of gainedFeaturesOnUpgrade(fromUi, toUi)) {
        await this.commercialAudit.recordFeatureEnable({
          tenantId: event.tenantId,
          actorId: event.changedBy,
          featureId: feature.id,
          plan: toUi,
          source: 'event.platform.plan_changed',
          correlationId: event.eventId,
        });
      }

      this.licensing.invalidateCache(event.tenantId);
      return;
    }

    if (event instanceof PlatformTenantSuspendedEvent) {
      await this.commercialAudit.recordSuspension({
        tenantId: event.tenantId,
        actorId: event.suspendedBy,
        reason: event.reason,
        source: 'event.platform.suspended',
        correlationId: event.eventId,
      });
      await this.lifecycleState.persistKnownStatus(event.tenantId, 'suspended');
      this.licensing.invalidateCache(event.tenantId);
      return;
    }

    if (event instanceof PlatformTenantResumedEvent) {
      await this.commercialAudit.recordReactivation({
        tenantId: event.tenantId,
        actorId: event.resumedBy,
        source: 'event.platform.resumed',
        correlationId: event.eventId,
      });
      await this.lifecycleState.persistKnownStatus(event.tenantId, 'active');
      this.licensing.invalidateCache(event.tenantId);
      return;
    }

    if (event instanceof PlatformTenantArchivedEvent) {
      await this.commercialAudit.recordCancellation({
        tenantId: event.tenantId,
        actorId: event.archivedBy,
        reason: event.reason,
        source: 'event.platform.archived',
        correlationId: event.eventId,
      });
      await this.lifecycleState.persistKnownStatus(event.tenantId, 'cancelled');
      this.licensing.invalidateCache(event.tenantId);
    }
  }
}
