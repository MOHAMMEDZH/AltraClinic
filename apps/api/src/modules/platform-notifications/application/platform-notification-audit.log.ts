import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../infrastructure/prisma.service';
import { AuditEntryFactory } from '../../audit/domain/audit-entry.factory';
import {
  PLATFORM_AUDIT_SENTINEL_DISPLAY_NAME,
  PLATFORM_AUDIT_SENTINEL_SLUG,
  PLATFORM_AUDIT_SENTINEL_TENANT_ID,
} from '../../platform-tenants/platform-tenants.tokens';
import { resolveOperationCorrelationId } from '../../platform-audit-center/application/operation-correlation';
import {
  PLATFORM_NOTIFICATION_AUDIT_CATEGORY,
  isPlatformNotificationFailureInjectionActive,
} from '../platform-notifications.constants';
import { PlatformNotificationError } from '../domain/platform-notifications.errors';

export type PlatformNotificationAuditRecord = {
  action: string;
  resourceType: string;
  resourceId: string;
  actorId: string;
  reason?: string | null;
  correlationId?: string | null;
  details?: Record<string, unknown> | null;
  result: 'success' | 'failure' | 'denied';
  descriptionEn: string;
  descriptionAr: string;
};

/**
 * Flexible Step 27 — durable audit writer for platform notification management actions
 * (dispatch, preview, preference changes, retries). Sentinel tenant scoped; no PHI/secrets.
 * Mirrors `CommissionAuditLog` (Step 26) — `AuditEntry` has no `result`/`actorType` columns,
 * so `result` is folded into `details`.
 */
@Injectable()
export class PlatformNotificationAuditLog {
  private readonly factory = new AuditEntryFactory();

  constructor(private readonly prisma: PrismaService) {}

  async record(entry: PlatformNotificationAuditRecord): Promise<string> {
    return this.prisma.withPlatformBypass((client) => this.recordInTransaction(client, entry));
  }

  async recordInTransaction(
    client: Prisma.TransactionClient,
    entry: PlatformNotificationAuditRecord,
  ): Promise<string> {
    if (isPlatformNotificationFailureInjectionActive('audit_write')) {
      throw new PlatformNotificationError('injected_failure', 'Injected audit write failure', 500);
    }
    const correlationId = resolveOperationCorrelationId({ explicit: entry.correlationId ?? undefined });
    const details = { ...(entry.details ?? {}), result: entry.result };

    const auditEntry = this.factory.create(
      randomUUID(),
      PLATFORM_AUDIT_SENTINEL_TENANT_ID,
      null,
      null,
      entry.action,
      entry.resourceType,
      entry.resourceId,
      entry.actorId,
      ['platform'],
      details as unknown as Record<string, string>,
      null,
      PLATFORM_NOTIFICATION_AUDIT_CATEGORY,
      entry.descriptionEn,
      entry.descriptionAr,
      entry.reason ?? null,
      null,
      null,
      correlationId,
    );

    await client.tenant.upsert({
      where: { id: PLATFORM_AUDIT_SENTINEL_TENANT_ID },
      create: {
        id: PLATFORM_AUDIT_SENTINEL_TENANT_ID,
        name: PLATFORM_AUDIT_SENTINEL_DISPLAY_NAME,
        slug: PLATFORM_AUDIT_SENTINEL_SLUG,
      },
      update: {},
    });
    await client.auditEntry.create({
      data: {
        id: auditEntry.id,
        tenantId: auditEntry.tenantId,
        branchId: auditEntry.branchId,
        actorId: auditEntry.actorId,
        actorRoles: auditEntry.actorRoles as never,
        action: auditEntry.action,
        resourceType: auditEntry.resourceType,
        resourceId: auditEntry.resourceId,
        category: auditEntry.category,
        descriptionEn: (auditEntry.description as { en?: string | null } | null)?.en ?? null,
        descriptionAr: (auditEntry.description as { ar?: string | null } | null)?.ar ?? null,
        reason: auditEntry.reason,
        details:
          auditEntry.details !== null
            ? (auditEntry.details as Prisma.InputJsonValue)
            : Prisma.JsonNull,
        correlationId: auditEntry.correlationId,
        locale: auditEntry.locale,
        createdAt: auditEntry.createdAt,
      },
    });
    return correlationId;
  }
}
