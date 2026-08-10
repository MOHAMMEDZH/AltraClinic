import { randomUUID } from 'crypto';
import { Injectable } from '@nestjs/common';
import { Prisma, PrismaClient } from '@prisma/client';
import { PrismaService } from '../../../infrastructure/prisma.service';
import { AuditEntryFactory } from '../../audit/domain/audit-entry.factory';
import {
  PLATFORM_AUDIT_SENTINEL_DISPLAY_NAME,
  PLATFORM_AUDIT_SENTINEL_SLUG,
  PLATFORM_AUDIT_SENTINEL_TENANT_ID,
} from '../../platform-tenants/platform-tenants.tokens';

export type PlatformSecurityAuditRecord = {
  action: string;
  resourceId: string;
  actorId: string;
  actorRoles: string[];
  reason: string | null;
  correlationId: string | null;
  details: Record<string, string> | null;
  changes: Record<string, { before?: string | null; after?: string | null }> | null;
  ipAddress?: string | null;
  userAgent?: string | null;
};

type TxClient = PrismaClient | Prisma.TransactionClient;

/**
 * Step 21 A01/A02 — durable AuditEntry append for Platform RBAC / session security.
 * Required evidence must be written in the same PostgreSQL transaction as the
 * business mutation (Model A). Failures throw and roll back with the mutation.
 * No post-commit best-effort / swallowed success-audit path.
 */
@Injectable()
export class AuditTrailPlatformSecurityAuditLog {
  private readonly factory = new AuditEntryFactory();

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Append immutable AuditEntry using an already-open transaction client.
   * Throws on persistence failure (never swallows).
   */
  async appendInTransaction(client: TxClient, entry: PlatformSecurityAuditRecord): Promise<string> {
    const correlationId =
      entry.correlationId &&
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        entry.correlationId,
      )
        ? entry.correlationId
        : null;

    const auditEntry = this.factory.create(
      randomUUID(),
      PLATFORM_AUDIT_SENTINEL_TENANT_ID,
      null,
      'en-US',
      entry.action,
      'platform_user',
      entry.resourceId,
      entry.actorId,
      entry.actorRoles.length ? entry.actorRoles : ['platform'],
      entry.details,
      entry.changes,
      'platform_security',
      entry.action,
      null,
      entry.reason,
      entry.ipAddress ?? null,
      entry.userAgent ?? null,
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
        actorRoles: auditEntry.actorRoles,
        action: auditEntry.action,
        resourceType: auditEntry.resourceType,
        resourceId: auditEntry.resourceId,
        category: auditEntry.category,
        descriptionEn:
          (auditEntry.description as { en?: string | null } | null)?.en ?? null,
        descriptionAr:
          (auditEntry.description as { ar?: string | null } | null)?.ar ?? null,
        details:
          auditEntry.details !== null
            ? (auditEntry.details as Prisma.InputJsonValue)
            : Prisma.JsonNull,
        changes:
          auditEntry.changes !== null
            ? (auditEntry.changes as Prisma.InputJsonValue)
            : Prisma.JsonNull,
        reason: auditEntry.reason,
        ipAddress: auditEntry.ipAddress,
        userAgent: auditEntry.userAgent,
        correlationId: auditEntry.correlationId,
        locale: auditEntry.locale,
        createdAt: auditEntry.createdAt,
      },
    });

    return auditEntry.id;
  }
}
