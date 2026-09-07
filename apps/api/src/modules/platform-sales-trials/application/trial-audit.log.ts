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
  SALES_TRIAL_AUDIT_CATEGORY,
  isSalesTrialsFailureInjectionActive,
} from '../platform-sales-trials.constants';
import { SalesTrialError } from '../domain/sales-trial.errors';

export type TrialAuditRecord = {
  action: string;
  resourceType: string;
  resourceId: string;
  actorId: string;
  actorRoles: string[];
  reason?: string | null;
  correlationId?: string | null;
  details?: Record<string, unknown> | null;
  result: 'success' | 'failure' | 'denied';
  descriptionEn: string;
  descriptionAr: string;
};

/**
 * Flexible Step 25 — Step 21 Model A durable audit writer for Trial governance.
 * Sentinel tenant scoped; no PHI, no secrets, no billing amounts.
 */
@Injectable()
export class TrialAuditLog {
  private readonly factory = new AuditEntryFactory();

  constructor(private readonly prisma: PrismaService) {}

  async record(entry: TrialAuditRecord): Promise<string> {
    return this.prisma.withPlatformBypass((client) => this.recordInTransaction(client, entry));
  }

  async recordInTransaction(
    client: Prisma.TransactionClient,
    entry: TrialAuditRecord,
  ): Promise<string> {
    if (isSalesTrialsFailureInjectionActive('after_audit_staging_before_commit')) {
      throw new SalesTrialError('injected_failure', 'Injected after audit staging', 500);
    }
    const correlationId = resolveOperationCorrelationId({ explicit: entry.correlationId });
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
      entry.actorRoles,
      details as unknown as Record<string, string>,
      null,
      SALES_TRIAL_AUDIT_CATEGORY,
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
