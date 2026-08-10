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
import { redactOpsDetails } from './ops-redaction';
import { isOperationsConsoleFailureInjectionActive } from '../platform-operations-console.constants';
import { OpsConsoleError } from '../domain/operations-console.types';

export type OpsAuditRecord = {
  action: string;
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

@Injectable()
export class OpsAuditLog {
  private readonly factory = new AuditEntryFactory();

  constructor(private readonly prisma: PrismaService) {}

  async record(entry: OpsAuditRecord): Promise<string> {
    return this.prisma.withPlatformBypass((client) => this.recordInTransaction(client, entry));
  }

  /** Atomic with durable idempotency completeInTransaction. */
  async recordInTransaction(
    client: Prisma.TransactionClient,
    entry: OpsAuditRecord,
  ): Promise<string> {
    if (isOperationsConsoleFailureInjectionActive('after_audit_staging_before_commit')) {
      throw new OpsConsoleError('injected_failure', 'Injected after audit staging', 500);
    }
    if (isOperationsConsoleFailureInjectionActive('redaction')) {
      throw new OpsConsoleError('injected_failure', 'Injected redaction failure', 500);
    }
    const correlationId = resolveOperationCorrelationId({ explicit: entry.correlationId });
    const redacted = redactOpsDetails({
      ...(entry.details ?? {}),
      result: entry.result,
    });
    const auditEntry = this.factory.create(
      randomUUID(),
      PLATFORM_AUDIT_SENTINEL_TENANT_ID,
      null,
      null,
      entry.action,
      'operations',
      entry.resourceId,
      entry.actorId,
      entry.actorRoles,
      redacted,
      null,
      'operations_console',
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
        descriptionEn:
          (auditEntry.description as { en?: string | null } | null)?.en ?? null,
        descriptionAr:
          (auditEntry.description as { ar?: string | null } | null)?.ar ?? null,
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
