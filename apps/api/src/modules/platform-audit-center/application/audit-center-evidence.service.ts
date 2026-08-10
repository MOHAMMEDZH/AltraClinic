import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/prisma.service';
import {
  AUDIT_CENTER_PERMISSIONS,
  isAuditCenterFailureInjectionActive,
} from '../platform-audit-center.constants';
import { AuditCenterError } from '../domain/audit-center.types';
import { redactJson } from './audit-center-redaction';

/**
 * Evidence views — read-only adapters over accepted Sources of Record.
 * Never mutates Plan Versions, Overrides, flags, or settings.
 */
@Injectable()
export class AuditCenterEvidenceService {
  constructor(private readonly prisma: PrismaService) {}

  private maybeInject(point: string): void {
    if (isAuditCenterFailureInjectionActive(point)) {
      throw new AuditCenterError('injected_failure', `Injected failure at ${point}`, 500);
    }
  }

  async planVersionEvidence(planVersionId: string, perms: Set<string>) {
    if (!perms.has(AUDIT_CENTER_PERMISSIONS.view)) {
      throw new AuditCenterError('forbidden', 'Missing audit.view', 403);
    }
    this.maybeInject('after_source_lookup');
    const version = await this.prisma.withPlatformBypass((c) =>
      c.platformPlanVersion.findUnique({
        where: { id: planVersionId },
        include: {
          entitlements: { take: 200 },
          limits: { take: 200 },
        },
      }),
    );
    if (!version) throw new AuditCenterError('not_found', 'Plan version not found', 404);

    const audits = await this.prisma.withPlatformBypass((c) =>
      c.auditEntry.findMany({
        where: {
          OR: [
            { resourceType: 'platform_plan_version', resourceId: planVersionId },
            { resourceType: 'platform_plan', resourceId: version.planId },
          ],
        },
        orderBy: { createdAt: 'asc' },
        take: 200,
      }),
    );

    return {
      planVersionId: version.id,
      planId: version.planId,
      versionNumber: version.versionNumber,
      lifecycle: version.lifecycle,
      immutableIdentity: version.id,
      publicationFingerprint: version.publicationFingerprint,
      entitlementCatalogItemIds: (version.entitlements ?? []).map((e) => e.catalogItemId),
      limitCatalogItemIds: (version.limits ?? []).map((l) => l.catalogItemId),
      auditTrail: audits.map((a) => ({
        id: a.id,
        occurredAt: a.createdAt.toISOString(),
        action: a.action,
        actorId: a.actorId,
        reason: a.reason,
        correlationId: a.correlationId,
        beforeAfter: redactJson(a.changes, { allowSensitive: false }),
      })),
    };
  }

  async overrideEvidence(overrideId: string, perms: Set<string>) {
    if (!perms.has(AUDIT_CENTER_PERMISSIONS.view)) {
      throw new AuditCenterError('forbidden', 'Missing audit.view', 403);
    }
    this.maybeInject('after_source_lookup');
    const override = await this.prisma.withPlatformBypass((c) =>
      c.platformCommercialOverride.findUnique({
        where: { id: overrideId },
        include: { effects: true },
      }),
    );
    if (!override) throw new AuditCenterError('not_found', 'Override not found', 404);

    const audits = await this.prisma.withPlatformBypass((c) =>
      c.auditEntry.findMany({
        where: {
          OR: [
            { resourceType: 'platform_override', resourceId: overrideId },
            { resourceType: 'commercial_override', resourceId: overrideId },
          ],
        },
        orderBy: { createdAt: 'asc' },
        take: 200,
      }),
    );

    return {
      overrideId: override.id,
      lifecycle: override.lifecycle,
      reasonCode: override.reasonCode,
      reasonNote: override.reasonNote,
      approvedByPlatformUserId: override.approvedByPlatformUserId,
      effects: redactJson(override.effects, { allowSensitive: false }),
      auditTrail: audits.map((a) => ({
        id: a.id,
        occurredAt: a.createdAt.toISOString(),
        action: a.action,
        actorId: a.actorId,
        reason: a.reason,
        correlationId: a.correlationId,
        beforeAfter: redactJson(a.changes, { allowSensitive: false }),
      })),
    };
  }

  async flagHistoryEvidence(flagId: string, perms: Set<string>) {
    if (!perms.has(AUDIT_CENTER_PERMISSIONS.view)) {
      throw new AuditCenterError('forbidden', 'Missing audit.view', 403);
    }
    const flag = await this.prisma.withPlatformBypass((c) =>
      c.platformFeatureFlag.findUnique({
        where: { id: flagId },
        include: { history: { orderBy: { createdAt: 'asc' }, take: 200 } },
      }),
    );
    if (!flag) throw new AuditCenterError('not_found', 'Flag not found', 404);
    return {
      flagId: flag.id,
      canonicalKey: flag.canonicalKey,
      history: flag.history.map((h) => ({
        id: h.id,
        occurredAt: h.createdAt.toISOString(),
        operation: h.operation,
        actorId: h.actorPlatformUserId,
        reason: h.reason,
        correlationId: h.correlationId,
        before: redactJson(h.beforeSummaryJson, { allowSensitive: false }),
        after: redactJson(h.afterSummaryJson, { allowSensitive: false }),
      })),
    };
  }

  /**
   * Model A — bounded EER decision evidence from existing provenance when available.
   * Does not invent decision rows; returns safe empty when no provenance.
   */
  async eerDecisionEvidence(
    input: { tenantId: string; capabilityKey?: string },
    perms: Set<string>,
  ) {
    if (!perms.has(AUDIT_CENTER_PERMISSIONS.view)) {
      throw new AuditCenterError('forbidden', 'Missing audit.view', 403);
    }
    const allowSensitive = perms.has(AUDIT_CENTER_PERMISSIONS.sensitiveView);
    // Prefer reading existing activation/subscription audit pointers — no raw snapshot.
    const audits = await this.prisma.withPlatformBypass((c) =>
      c.auditEntry.findMany({
        where: {
          OR: [
            { resourceType: 'subscription', details: { path: ['tenantId'], equals: input.tenantId } },
            { tenantId: input.tenantId, category: 'entitlement' },
          ],
        },
        orderBy: { createdAt: 'desc' },
        take: 20,
      }),
    );
    return {
      model: 'A' as const,
      tenantId: input.tenantId,
      capabilityKey: input.capabilityKey ?? null,
      decisions: audits.map((a) => ({
        id: a.id,
        occurredAt: a.createdAt.toISOString(),
        action: a.action,
        reason: a.reason,
        correlationId: a.correlationId,
        summary: redactJson(a.details, { allowSensitive }),
      })),
      note: 'Model A read adapter — no ordinary Clinic auth flood; no raw snapshots',
    };
  }
}
