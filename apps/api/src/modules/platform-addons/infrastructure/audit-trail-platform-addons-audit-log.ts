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
import type {
  PlatformAddonsAuditLog,
  PlatformAddonsAuditRecord,
} from '../application/ports/addon-audit-log.port';
import { redactAddonAuditDetails } from '../application/addon-audit-redaction';

function asUuidOrNull(value: string | null | undefined): string | null {
  if (!value?.trim()) return null;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value.trim(),
  )
    ? value.trim()
    : null;
}

@Injectable()
export class AuditTrailPlatformAddonsAuditLog implements PlatformAddonsAuditLog {
  private readonly factory = new AuditEntryFactory();

  constructor(private readonly prisma: PrismaService) {}

  async record(entry: PlatformAddonsAuditRecord): Promise<void> {
    const correlationId = asUuidOrNull(entry.correlationId);
    const redactedDetails = redactAddonAuditDetails(entry.details);
    const auditEntry = this.factory.create(
      randomUUID(),
      entry.tenantId,
      null,
      entry.locale,
      entry.action,
      'platform_addon',
      entry.resourceId,
      entry.actorId,
      entry.actorRoles,
      redactedDetails,
      null,
      'platform_addon',
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
   * Step 21 A09 — append the AuditEntry using an already-open transaction
   * client so the write commits atomically with the business mutation
   * (Model A). Throws on failure; never swallows.
   */
  async recordInTransaction(
    client: {
      tenant: { upsert: (args: unknown) => Promise<unknown> };
      auditEntry: { create: (args: unknown) => Promise<unknown> };
    },
    entry: PlatformAddonsAuditRecord,
  ): Promise<void> {
    const correlationId = asUuidOrNull(entry.correlationId);
    const redactedDetails = redactAddonAuditDetails(entry.details);
    const auditEntry = this.factory.create(
      randomUUID(),
      entry.tenantId,
      null,
      entry.locale,
      entry.action,
      'platform_addon',
      entry.resourceId,
      entry.actorId,
      entry.actorRoles,
      redactedDetails,
      null,
      'platform_addon',
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
