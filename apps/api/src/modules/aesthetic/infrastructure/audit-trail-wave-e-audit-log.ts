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
import { WaveEAuditLog, WaveEAuditRecord } from '../ports/wave-e-audit-log.port';

function asUuidOrNull(value: string | null | undefined): string | null {
  if (!value?.trim()) return null;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value.trim(),
  )
    ? value.trim()
    : null;
}

@Injectable()
export class AuditTrailWaveEAuditLog implements WaveEAuditLog {
  private readonly factory = new AuditEntryFactory();

  constructor(private readonly prisma: PrismaService) {}

  async record(entry: WaveEAuditRecord): Promise<void> {
    await this.prisma.withPlatformBypass(async (client) => {
      await this.writeAudit(client, entry);
    });
  }

  async recordInTransaction(client: unknown, entry: WaveEAuditRecord): Promise<void> {
    await this.writeAudit(client as Prisma.TransactionClient, entry);
  }

  private async writeAudit(client: Prisma.TransactionClient, entry: WaveEAuditRecord) {
    const actorRoles = entry.actorRoles?.length > 0 ? entry.actorRoles : ['aesthetic'];
    const detailsForFactory: Record<string, string> | null = entry.details
      ? Object.fromEntries(
          Object.entries(entry.details).map(([k, v]) => [
            k,
            v === null || v === undefined ? '' : String(v),
          ]),
        )
      : null;
    const auditEntry = this.factory.create(
      randomUUID(),
      entry.tenantId,
      null,
      null,
      entry.action,
      'aesthetic_wave_e',
      entry.resourceId,
      entry.actorId,
      actorRoles,
      detailsForFactory,
      null,
      'aesthetic_wave_e',
      entry.descriptionEn,
      entry.descriptionAr ?? null,
      null,
      null,
      null,
      asUuidOrNull(null),
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
        actorId: auditEntry.actorId,
        actorRoles: auditEntry.actorRoles as unknown as Prisma.InputJsonValue,
        action: auditEntry.action,
        resourceType: auditEntry.resourceType,
        resourceId: auditEntry.resourceId,
        descriptionEn: auditEntry.descriptionEn,
        descriptionAr: auditEntry.descriptionAr,
        details: (auditEntry.details ?? undefined) as Prisma.InputJsonValue | undefined,
        correlationId: auditEntry.correlationId,
        category: auditEntry.category,
        createdAt: auditEntry.createdAt,
      },
    });
  }
}
