import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../infrastructure/prisma.service';
import { AuditEntry } from '../domain/audit-entry.entity';
import {
  AuditEntryRepository,
  AuditEntrySearchQuery,
} from '../domain/audit-entry.repository.interface';
import { LocalizedTextVO } from '../domain/value-objects/localized-text.vo';

/**
 * Append-only: uses `create` not `upsert`.
 * DB trigger enforces this at the database layer as a second guard.
 *
 * AuditEntry schema stores description as two nullable text columns
 * (descriptionEn, descriptionAr) rather than JSONB, to allow full-text
 * indexing and filtering by language without JSON extraction.
 */
@Injectable()
export class PrismaAuditEntryRepository implements AuditEntryRepository {
  constructor(private readonly prisma: PrismaService) {}

  async save(entry: AuditEntry): Promise<void> {
    await this.prisma.auditEntry.create({
      data: {
        id: entry.id,
        tenantId: entry.tenantId,
        branchId: entry.branchId,
        actorId: entry.actorId,
        actorRoles: entry.actorRoles,
        action: entry.action,
        resourceType: entry.resourceType,
        resourceId: entry.resourceId,
        category: entry.category,
        descriptionEn: (entry.description as { en?: string | null } | null)?.en ?? null,
        descriptionAr: (entry.description as { ar?: string | null } | null)?.ar ?? null,
        details: entry.details !== null ? (entry.details as Prisma.InputJsonValue) : Prisma.JsonNull,
        changes: entry.changes !== null ? (entry.changes as Prisma.InputJsonValue) : Prisma.JsonNull,
        reason: entry.reason,
        ipAddress: entry.ipAddress,
        userAgent: entry.userAgent,
        correlationId: entry.correlationId,
        locale: entry.locale,
        createdAt: entry.createdAt,
      },
    });
  }

  async findById(id: string, tenantId: string): Promise<AuditEntry | null> {
    const row = await this.prisma.auditEntry.findFirst({
      where: { id, tenantId },
    });
    return row ? this.toDomain(row) : null;
  }

  async search(query: AuditEntrySearchQuery): Promise<AuditEntry[]> {
    const rows = await this.prisma.auditEntry.findMany({
      where: {
        tenantId: query.tenantId,
        ...(query.action ? { action: query.action } : {}),
        ...(query.resourceType ? { resourceType: query.resourceType } : {}),
        ...(query.resourceId ? { resourceId: query.resourceId } : {}),
        ...(query.actorId ? { actorId: query.actorId } : {}),
      },
      orderBy: { createdAt: 'desc' },
      skip: query.offset,
      take: query.limit,
    });
    return rows.map((r) => this.toDomain(r));
  }

  private toDomain(row: {
    id: string;
    tenantId: string;
    branchId: string | null;
    action: string;
    resourceType: string;
    resourceId: string;
    actorId: string;
    actorRoles: string[];
    details: unknown;
    changes: unknown;
    category: string | null;
    descriptionEn: string | null;
    descriptionAr: string | null;
    reason: string | null;
    ipAddress: string | null;
    userAgent: string | null;
    correlationId: string | null;
    locale: string | null;
    createdAt: Date;
  }): AuditEntry {
    const descVO = (row.descriptionEn || row.descriptionAr)
      ? new LocalizedTextVO(row.descriptionAr, row.descriptionEn)
      : null;

    return new AuditEntry(
      row.id,
      row.tenantId,
      row.branchId,
      row.action,
      row.resourceType,
      row.resourceId,
      row.actorId,
      row.actorRoles,
      (row.details as Record<string, string> | null) ?? null,
      (row.changes as Record<string, { before?: string | null; after?: string | null }> | null) ?? null,
      row.category,
      descVO,
      row.reason,
      row.ipAddress,
      row.userAgent,
      row.correlationId,
      row.locale,
      row.createdAt,
    );
  }
}
