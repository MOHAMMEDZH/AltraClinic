import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../infrastructure/prisma.service';
import { AuditEntryFactory } from '../../audit/domain/audit-entry.factory';
import {
  PLATFORM_AUDIT_SENTINEL_DISPLAY_NAME,
  PLATFORM_AUDIT_SENTINEL_SLUG,
  PLATFORM_AUDIT_SENTINEL_TENANT_ID,
  isPlatformAuditSentinelTenantId,
} from '../../platform-tenants/platform-tenants.tokens';

export type ProvisioningAuditRecord = {
  /** Clinic tenant id when known; otherwise sentinel for platform-only work. */
  tenantId: string;
  action: string;
  resourceId: string;
  actorId: string;
  actorRoles: string[];
  locale?: string | null;
  correlationId?: string | null;
  reason?: string | null;
  descriptionEn: string;
  descriptionAr: string;
  details?: Record<string, unknown> | null;
};

const FORBIDDEN_DETAIL_KEYS = [
  'token',
  'rawToken',
  'invitationToken',
  'password',
  'tempPassword',
  'temporaryPassword',
  'secret',
  'session',
  'cookie',
  'mfa',
  'mfaSecret',
  'snapshot',
  'rawSnapshot',
  'payload',
  'requestPayload',
  'phi',
  'sql',
  'stack',
  'prisma',
];

export function redactProvisioningAuditDetails(
  details: Record<string, unknown> | null | undefined,
): Record<string, string> | null {
  if (!details) return null;
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(details)) {
    const lower = key.toLowerCase();
    if (FORBIDDEN_DETAIL_KEYS.some((f) => lower.includes(f))) continue;
    if (value === null || value === undefined) continue;
    if (typeof value === 'object') continue;
    const text = String(value);
    out[key] = text.length > 500 ? text.slice(0, 500) : text;
  }
  return Object.keys(out).length ? out : null;
}

function asUuidOrNull(value: string | null | undefined): string | null {
  if (!value?.trim()) return null;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value.trim(),
  )
    ? value.trim()
    : null;
}

/**
 * Durable Platform audit for Step 17 external commands.
 * Must be invoked inside the same successful command transaction when possible,
 * or immediately after durable commit with completed-only idempotency protecting replay.
 */
@Injectable()
export class TenantProvisioningAuditLog {
  private readonly factory = new AuditEntryFactory();

  constructor(private readonly prisma: PrismaService) {}

  async record(entry: ProvisioningAuditRecord): Promise<void> {
    const correlationId = asUuidOrNull(entry.correlationId);
    const redacted = redactProvisioningAuditDetails(entry.details);
    const auditEntry = this.factory.create(
      randomUUID(),
      entry.tenantId,
      null,
      entry.locale ?? null,
      entry.action,
      'tenant_provisioning',
      entry.resourceId,
      entry.actorId,
      entry.actorRoles,
      redacted,
      null,
      'tenant_provisioning',
      entry.descriptionEn,
      entry.descriptionAr,
      entry.reason ?? null,
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

  /** Insert audit inside an open Prisma transaction client (same TX as command). */
  async recordInTransaction(
    client: {
      tenant: { upsert: (args: unknown) => Promise<unknown> };
      auditEntry: { create: (args: unknown) => Promise<unknown> };
    },
    entry: ProvisioningAuditRecord,
  ): Promise<void> {
    const correlationId = asUuidOrNull(entry.correlationId);
    const redacted = redactProvisioningAuditDetails(entry.details);
    const auditEntry = this.factory.create(
      randomUUID(),
      entry.tenantId,
      null,
      entry.locale ?? null,
      entry.action,
      'tenant_provisioning',
      entry.resourceId,
      entry.actorId,
      entry.actorRoles,
      redacted,
      null,
      'tenant_provisioning',
      entry.descriptionEn,
      entry.descriptionAr,
      entry.reason ?? null,
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
