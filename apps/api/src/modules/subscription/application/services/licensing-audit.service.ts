import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../../infrastructure/prisma.service';

export type LicensingAuditAction =
  | 'module.denied'
  | 'feature.denied'
  | 'usage.exceeded'
  | 'license.read_only'
  | 'license.inactive'
  | 'plan.upgrade'
  | 'plan.downgrade'
  | 'plan.activated'
  | 'grace.started'
  | 'grace.ended'
  | 'suspension'
  | 'reactivation'
  | 'api.rejected';

/** System actor for licensing events without a user context. */
export const LICENSING_SYSTEM_ACTOR_ID = '00000000-0000-0000-0000-000000000001';

export type LicenseAuditDecision = 'allowed' | 'denied' | 'warning';

export interface LicenseAuditEventInput {
  tenantId: string;
  actorId?: string;
  eventType: string;
  previousPlan?: string;
  newPlan?: string;
  previousStatus?: string;
  newStatus?: string;
  moduleId?: string;
  featureId?: string;
  usageLimit?: string;
  decision: LicenseAuditDecision;
  reason: string;
  correlationId?: string;
  requestId?: string;
  source: string;
  metadata?: Record<string, unknown>;
}

export interface LicensingAuditEvent {
  tenantId: string;
  action: LicensingAuditAction;
  resourceType: string;
  resourceId?: string;
  actorId?: string;
  reason: string;
  metadata?: Record<string, unknown>;
}

/**
 * Authoritative immutable licensing audit persistence (LicenseAuditEvent table).
 * Mirrors denial events to AuditEntry for operational search compatibility.
 */
@Injectable()
export class LicensingAuditService {
  private readonly logger = new Logger(LicensingAuditService.name);

  constructor(private readonly prisma: PrismaService) {}

  async recordLicenseEvent(event: LicenseAuditEventInput): Promise<void> {
    try {
      await this.prisma.licenseAuditEvent.create({
        data: {
          tenantId: event.tenantId,
          actorId: event.actorId ?? null,
          eventType: event.eventType,
          previousPlan: event.previousPlan ?? null,
          newPlan: event.newPlan ?? null,
          previousStatus: event.previousStatus ?? null,
          newStatus: event.newStatus ?? null,
          moduleId: event.moduleId ?? null,
          featureId: event.featureId ?? null,
          usageLimit: event.usageLimit ?? null,
          decision: event.decision,
          reason: event.reason,
          correlationId: event.correlationId ?? null,
          requestId: event.requestId ?? null,
          source: event.source,
          metadata: event.metadata ? (event.metadata as object) : undefined,
        },
      });

      if (event.decision === 'denied') {
        await this.prisma.auditEntry.create({
          data: {
            tenantId: event.tenantId,
            actorId: event.actorId ?? LICENSING_SYSTEM_ACTOR_ID,
            actorRoles: [],
            action: event.eventType,
            resourceType: 'licensing',
            resourceId: event.tenantId,
            category: 'licensing',
            reason: event.reason,
            correlationId: event.correlationId ?? null,
            details: {
              decision: event.decision,
              source: event.source,
              moduleId: event.moduleId,
              featureId: event.featureId,
              usageLimit: event.usageLimit,
              ...event.metadata,
            },
          },
        });
      }
    } catch (error) {
      this.logger.warn(
        `Failed to persist license audit: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  async record(event: LicensingAuditEvent): Promise<void> {
    await this.recordLicenseEvent({
      tenantId: event.tenantId,
      actorId: event.actorId,
      eventType: event.action,
      moduleId: event.metadata?.moduleId as string | undefined,
      featureId: event.metadata?.featureId as string | undefined,
      decision: 'denied',
      reason: event.reason,
      source: 'http.guard',
      metadata: event.metadata,
    });
  }
}
