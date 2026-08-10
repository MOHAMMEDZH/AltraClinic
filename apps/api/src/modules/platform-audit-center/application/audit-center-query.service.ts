import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../infrastructure/prisma.service';
import { PLATFORM_AUDIT_SENTINEL_TENANT_ID } from '../../platform-tenants/platform-tenants.tokens';
import {
  AUDIT_CENTER_CORRELATION_MAX,
  AUDIT_CENTER_DEFAULT_PAGE_SIZE,
  AUDIT_CENTER_MAX_DATE_RANGE_DAYS,
  AUDIT_CENTER_MAX_PAGE_SIZE,
  AUDIT_CENTER_PERMISSIONS,
  isAuditCenterFailureInjectionActive,
} from '../platform-audit-center.constants';
import {
  AuditCenterError,
  type AuditCenterCursor,
  type AuditCenterListItem,
  type AuditCenterSearchFilters,
} from '../domain/audit-center.types';
import { maskIp, redactJson, summarizeUserAgent } from './audit-center-redaction';

@Injectable()
export class AuditCenterQueryService {
  constructor(private readonly prisma: PrismaService) {}

  private maybeInject(point: string): void {
    if (isAuditCenterFailureInjectionActive(point)) {
      throw new AuditCenterError('injected_failure', `Injected failure at ${point}`, 500);
    }
  }

  decodeCursor(raw?: string): AuditCenterCursor | null {
    if (!raw?.trim()) return null;
    this.maybeInject('after_cursor_decode');
    try {
      const parsed = JSON.parse(Buffer.from(raw, 'base64url').toString('utf8')) as AuditCenterCursor;
      if (!parsed?.createdAt || !parsed?.id) {
        throw new Error('bad');
      }
      return parsed;
    } catch {
      throw new AuditCenterError('invalid_cursor', 'Invalid pagination cursor', 400);
    }
  }

  encodeCursor(createdAt: Date, id: string): string {
    return Buffer.from(JSON.stringify({ createdAt: createdAt.toISOString(), id }), 'utf8').toString(
      'base64url',
    );
  }

  private assertDateRange(from?: Date, to?: Date): void {
    if (from && to && from > to) {
      throw new AuditCenterError('invalid_date_range', 'from must be <= to', 400);
    }
    if (from && to) {
      const days = (to.getTime() - from.getTime()) / (24 * 60 * 60 * 1000);
      if (days > AUDIT_CENTER_MAX_DATE_RANGE_DAYS) {
        throw new AuditCenterError(
          'date_range_too_large',
          `Date range exceeds ${AUDIT_CENTER_MAX_DATE_RANGE_DAYS} days`,
          400,
        );
      }
    }
  }

  async search(
    filters: AuditCenterSearchFilters,
    perms: Set<string>,
  ): Promise<{ items: AuditCenterListItem[]; nextCursor: string | null }> {
    this.maybeInject('after_authorization');
    this.maybeInject('after_query_parse');
    if (!perms.has(AUDIT_CENTER_PERMISSIONS.view)) {
      throw new AuditCenterError('forbidden', 'Missing audit.view', 403);
    }
    const limit = Math.min(
      Math.max(1, filters.limit ?? AUDIT_CENTER_DEFAULT_PAGE_SIZE),
      AUDIT_CENTER_MAX_PAGE_SIZE,
    );
    const from = filters.from ? new Date(filters.from) : undefined;
    const to = filters.to ? new Date(filters.to) : undefined;
    if ((from && Number.isNaN(from.getTime())) || (to && Number.isNaN(to.getTime()))) {
      throw new AuditCenterError('invalid_date', 'Invalid ISO date', 400);
    }
    this.assertDateRange(from, to);
    const cursor = this.decodeCursor(filters.cursor);
    const allowNetwork = perms.has(AUDIT_CENTER_PERMISSIONS.networkMetadataView);
    const allowSensitive = perms.has(AUDIT_CENTER_PERMISSIONS.sensitiveView);

    const where: Prisma.AuditEntryWhereInput = {
      tenantId: filters.tenantId?.trim() || PLATFORM_AUDIT_SENTINEL_TENANT_ID,
    };
    if (filters.actorId) where.actorId = filters.actorId;
    if (filters.action) where.action = filters.action;
    if (filters.category) where.category = filters.category;
    if (filters.resourceType) where.resourceType = filters.resourceType;
    if (filters.resourceId) where.resourceId = filters.resourceId;
    if (filters.correlationId) where.correlationId = filters.correlationId;
    if (from || to || cursor) {
      where.AND = [];
      if (from || to) {
        where.createdAt = {
          ...(from ? { gte: from } : {}),
          ...(to ? { lte: to } : {}),
        };
      }
      if (cursor) {
        (where.AND as Prisma.AuditEntryWhereInput[]).push({
          OR: [
            { createdAt: { lt: new Date(cursor.createdAt) } },
            { createdAt: new Date(cursor.createdAt), id: { lt: cursor.id } },
          ],
        });
      }
    }

    const rows = await this.prisma.withPlatformBypass((c) =>
      c.auditEntry.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: limit + 1,
      }),
    );

    const page = rows.slice(0, limit);
    const items = page.map((r) => this.toListItem(r, allowNetwork, allowSensitive));
    const next =
      rows.length > limit
        ? this.encodeCursor(page[page.length - 1].createdAt, page[page.length - 1].id)
        : null;
    return { items, nextCursor: next };
  }

  async getById(
    id: string,
    perms: Set<string>,
  ): Promise<AuditCenterListItem & { details: unknown; changes: unknown }> {
    if (!perms.has(AUDIT_CENTER_PERMISSIONS.view)) {
      throw new AuditCenterError('forbidden', 'Missing audit.view', 403);
    }
    const row = await this.prisma.withPlatformBypass((c) =>
      c.auditEntry.findUnique({ where: { id } }),
    );
    if (!row) throw new AuditCenterError('not_found', 'Audit entry not found', 404);
    const allowNetwork = perms.has(AUDIT_CENTER_PERMISSIONS.networkMetadataView);
    const allowSensitive = perms.has(AUDIT_CENTER_PERMISSIONS.sensitiveView);
    const base = this.toListItem(row, allowNetwork, allowSensitive);
    return {
      ...base,
      details: redactJson(row.details, { allowSensitive }),
      changes: redactJson(row.changes, { allowSensitive }),
    };
  }

  async correlationTimeline(correlationId: string, perms: Set<string>) {
    if (!perms.has(AUDIT_CENTER_PERMISSIONS.view)) {
      throw new AuditCenterError('forbidden', 'Missing audit.view', 403);
    }
    if (!/^[0-9a-f-]{36}$/i.test(correlationId)) {
      throw new AuditCenterError('invalid_correlation', 'Invalid correlation id', 400);
    }
    const allowNetwork = perms.has(AUDIT_CENTER_PERMISSIONS.networkMetadataView);
    const allowSensitive = perms.has(AUDIT_CENTER_PERMISSIONS.sensitiveView);
    const rows = await this.prisma.withPlatformBypass((c) =>
      c.auditEntry.findMany({
        where: { correlationId },
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
        take: AUDIT_CENTER_CORRELATION_MAX,
      }),
    );
    return {
      correlationId,
      items: rows.map((r) => this.toListItem(r, allowNetwork, allowSensitive)),
    };
  }

  /** Application immutability — no update API. */
  async denyUpdate(): Promise<never> {
    this.maybeInject('immutability_update_attempt');
    throw new AuditCenterError('immutable', 'Audit records cannot be updated', 405);
  }

  async denyDelete(): Promise<never> {
    this.maybeInject('immutability_delete_attempt');
    throw new AuditCenterError('immutable', 'Audit records cannot be deleted', 405);
  }

  private toListItem(
    row: {
      id: string;
      createdAt: Date;
      action: string;
      category: string | null;
      resourceType: string;
      resourceId: string;
      actorId: string;
      actorRoles: string[];
      reason: string | null;
      correlationId: string | null;
      tenantId: string;
      descriptionEn: string | null;
      descriptionAr: string | null;
      changes: unknown;
      ipAddress: string | null;
      userAgent: string | null;
    },
    allowNetwork: boolean,
    allowSensitive: boolean,
  ): AuditCenterListItem {
    this.maybeInject('redaction_failure');
    return {
      id: row.id,
      occurredAt: row.createdAt.toISOString(),
      action: row.action,
      category: row.category,
      resourceType: row.resourceType,
      resourceId: row.resourceId,
      actorId: row.actorId,
      actorRoles: row.actorRoles ?? [],
      reason: row.reason,
      correlationId: row.correlationId,
      tenantId: row.tenantId,
      descriptionEn: row.descriptionEn,
      descriptionAr: row.descriptionAr,
      beforeAfterSummary: redactJson(row.changes, { allowSensitive }) as Record<
        string,
        unknown
      > | null,
      ipAddress: allowNetwork ? row.ipAddress : maskIp(row.ipAddress),
      userAgentSummary: allowNetwork
        ? row.userAgent
        : summarizeUserAgent(row.userAgent),
      accessClass: allowNetwork
        ? 'network_metadata'
        : allowSensitive
          ? 'sensitive'
          : 'standard',
    };
  }
}
