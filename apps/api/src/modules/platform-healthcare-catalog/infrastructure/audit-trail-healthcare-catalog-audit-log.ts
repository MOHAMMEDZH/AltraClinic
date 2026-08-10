import { randomUUID } from 'crypto';
import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../infrastructure/prisma.service';
import { AuditEntryFactory } from '../../audit/domain/audit-entry.factory';
import {
  PLATFORM_AUDIT_SENTINEL_DISPLAY_NAME,
  PLATFORM_AUDIT_SENTINEL_SLUG,
  PLATFORM_AUDIT_SENTINEL_TENANT_ID,
  isPlatformAuditSentinelTenantId,
} from '../../platform-tenants/platform-tenants.tokens';
import {
  HealthcareCatalogAuditLog,
  HealthcareCatalogAuditRecord,
} from '../application/ports/catalog-audit-log.port';

function asUuidOrNull(value: string | null | undefined): string | null {
  if (!value?.trim()) return null;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value.trim(),
  )
    ? value.trim()
    : null;
}

@Injectable()
export class AuditTrailHealthcareCatalogAuditLog implements HealthcareCatalogAuditLog {
  private readonly factory = new AuditEntryFactory();

  constructor(private readonly prisma: PrismaService) {}

  async record(entry: HealthcareCatalogAuditRecord): Promise<void> {
    const correlationId = asUuidOrNull(entry.correlationId);
    const auditEntry = this.factory.create(
      randomUUID(),
      entry.tenantId,
      null,
      entry.locale,
      entry.action,
      'healthcare_catalog',
      entry.resourceId,
      entry.actorId,
      entry.actorRoles,
      entry.details,
      null,
      'healthcare_catalog',
      entry.descriptionEn,
      entry.descriptionAr,
      null,
      null,
      null,
      correlationId,
    );

    await this.prisma.withPlatformBypass(async (client) => {
      if (isPlatformAuditSentinelTenantId(entry.tenantId)) {
        await client.tenant.upsert({
          where: { id: PLATFORM_AUDIT_SENTINEL_TENANT_ID },
          create: {
            id: PLATFORM_AUDIT_SENTINEL_TENANT_ID,
            name: PLATFORM_AUDIT_SENTINEL_DISPLAY_NAME,
            slug: PLATFORM_AUDIT_SENTINEL_SLUG,
          },
          update: {},
        });
      }

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
    });
  }

  /**
   * Step 21 Model A — insert the AuditEntry using the caller's open transaction
   * client (same `withPlatformBypass` transaction as the business mutation it
   * documents). Intentionally does not catch: a failure here must propagate so
   * the whole transaction rolls back and the mutation is never durably applied
   * without its audit evidence.
   */
  async recordInTransaction(
    client: Prisma.TransactionClient,
    entry: HealthcareCatalogAuditRecord,
  ): Promise<void> {
    const correlationId = asUuidOrNull(entry.correlationId);
    const auditEntry = this.factory.create(
      randomUUID(),
      entry.tenantId,
      null,
      entry.locale,
      entry.action,
      'healthcare_catalog',
      entry.resourceId,
      entry.actorId,
      entry.actorRoles,
      entry.details,
      null,
      'healthcare_catalog',
      entry.descriptionEn,
      entry.descriptionAr,
      null,
      null,
      null,
      correlationId,
    );

    if (isPlatformAuditSentinelTenantId(entry.tenantId)) {
      await client.tenant.upsert({
        where: { id: PLATFORM_AUDIT_SENTINEL_TENANT_ID },
        create: {
          id: PLATFORM_AUDIT_SENTINEL_TENANT_ID,
          name: PLATFORM_AUDIT_SENTINEL_DISPLAY_NAME,
          slug: PLATFORM_AUDIT_SENTINEL_SLUG,
        },
        update: {},
      });
    }

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
  }
}
