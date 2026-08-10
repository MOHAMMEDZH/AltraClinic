import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../infrastructure/prisma.service';
import { AuditEntryFactory } from '../../audit/domain/audit-entry.factory';
import { PLATFORM_AUDIT_SENTINEL_TENANT_ID } from '../../platform-tenants/platform-tenants.tokens';
import { redactProvisioningAuditDetails } from '../../tenant-provisioning/application/tenant-provisioning-audit.log';

export type LifecycleAuditRecord = {
  tenantId: string;
  action: string;
  resourceId: string;
  actorId: string;
  actorRoles: string[];
  correlationId?: string | null;
  reason?: string | null;
  descriptionEn: string;
  descriptionAr: string;
  details?: Record<string, unknown> | null;
};

@Injectable()
export class TenantLifecycleAuditLog {
  private readonly factory = new AuditEntryFactory();

  constructor(private readonly prisma: PrismaService) {}

  async record(entry: LifecycleAuditRecord): Promise<void> {
    const redacted = redactProvisioningAuditDetails(entry.details);
    const auditEntry = this.factory.create(
      randomUUID(),
      entry.tenantId || PLATFORM_AUDIT_SENTINEL_TENANT_ID,
      null,
      null,
      entry.action,
      'tenant_lifecycle',
      entry.resourceId,
      entry.actorId,
      entry.actorRoles,
      redacted,
      null,
      'tenant_lifecycle',
      entry.descriptionEn,
      entry.descriptionAr,
      entry.reason ?? null,
      null,
      null,
      entry.correlationId ?? null,
    );

    await this.prisma.withPlatformBypass(async (client) => {
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
    });
  }

  /**
   * Step 21 A12 — append the AuditEntry using an already-open transaction
   * client so the write commits atomically with the business lifecycle
   * mutation (Model A). Throws on failure; never swallows.
   */
  async recordInTransaction(
    client: {
      auditEntry: { create: (args: unknown) => Promise<unknown> };
    },
    entry: LifecycleAuditRecord,
  ): Promise<void> {
    const redacted = redactProvisioningAuditDetails(entry.details);
    const auditEntry = this.factory.create(
      randomUUID(),
      entry.tenantId || PLATFORM_AUDIT_SENTINEL_TENANT_ID,
      null,
      null,
      entry.action,
      'tenant_lifecycle',
      entry.resourceId,
      entry.actorId,
      entry.actorRoles,
      redacted,
      null,
      'tenant_lifecycle',
      entry.descriptionEn,
      entry.descriptionAr,
      entry.reason ?? null,
      null,
      null,
      entry.correlationId ?? null,
    );

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
  }
}
