import { createHash, randomUUID } from 'crypto';
import { ForbiddenException, Inject, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../infrastructure/prisma.service';
import type { JwtClaimsVO } from '../../auth/domain/value-objects/jwt-claims.vo';
import { PlatformAssuranceService } from '../../auth/application/services/platform-assurance.service';
import { PLATFORM_REFRESH_TOKEN_REPOSITORY } from '../../auth/platform-auth.tokens';
import type { PlatformRefreshTokenRepository } from '../../auth/domain/repositories/platform-refresh-token.repository.interface';
import { AuditEntryFactory } from '../../audit/domain/audit-entry.factory';
import {
  PLATFORM_AUDIT_SENTINEL_DISPLAY_NAME,
  PLATFORM_AUDIT_SENTINEL_SLUG,
  PLATFORM_AUDIT_SENTINEL_TENANT_ID,
} from '../../platform-tenants/platform-tenants.tokens';
import {
  AUDIT_CENTER_EXPORT_MAX_ROWS,
  AUDIT_CENTER_EXPORT_TTL_MS,
  AUDIT_CENTER_OPERATIONS,
  AUDIT_CENTER_PERMISSIONS,
  isAuditCenterFailureInjectionActive,
} from '../platform-audit-center.constants';
import { isAuditCenterEnabled } from '../config/audit-center-flags';
import { AuditCenterError, type AuditCenterExportInput } from '../domain/audit-center.types';
import { AuditCenterQueryService } from './audit-center-query.service';
import { AuditCenterRateLimitService } from './audit-center-rate-limit.service';
import { csvSafeCell } from './audit-center-redaction';

function fingerprint(filters: unknown): string {
  return createHash('sha256').update(JSON.stringify(filters)).digest('hex');
}

@Injectable()
export class AuditCenterExportService {
  private readonly factory = new AuditEntryFactory();
  /** Ephemeral CSV bodies keyed by export id — not a public URL store. */
  private readonly bodies = new Map<string, { csv: string; tokenHash: string; expiresAt: number }>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly query: AuditCenterQueryService,
    private readonly rateLimit: AuditCenterRateLimitService,
    private readonly assurance: PlatformAssuranceService,
    @Inject(PLATFORM_REFRESH_TOKEN_REPOSITORY)
    private readonly platformSessions: PlatformRefreshTokenRepository,
  ) {}

  private maybeInject(point: string): void {
    if (isAuditCenterFailureInjectionActive(point)) {
      throw new AuditCenterError('injected_failure', `Injected failure at ${point}`, 500);
    }
  }

  assertEnabled(): void {
    if (!isAuditCenterEnabled()) {
      throw new AuditCenterError('audit_center_disabled', 'Audit Center is disabled', 503);
    }
  }

  private async requireFreshStepUp(claims: JwtClaimsVO): Promise<void> {
    if (!claims.sessionId) throw new ForbiddenException('Fresh step-up required.');
    const session = await this.platformSessions.findBySessionId(claims.sessionId);
    if (!session) throw new ForbiddenException('Fresh step-up required.');
    this.assurance.requireStepUp(session);
  }

  async preview(input: AuditCenterExportInput, perms: Set<string>) {
    if (!perms.has(AUDIT_CENTER_PERMISSIONS.export)) {
      throw new AuditCenterError('forbidden', 'Missing audit.export', 403);
    }
    const fp = fingerprint(input.filters);
    return {
      filterFingerprint: fp,
      maxRows: AUDIT_CENTER_EXPORT_MAX_ROWS,
      warnings: [] as string[],
      blockers: [] as string[],
      expiresHintSeconds: Math.floor(AUDIT_CENTER_EXPORT_TTL_MS / 1000),
    };
  }

  async execute(
    claims: JwtClaimsVO,
    input: AuditCenterExportInput,
    perms: Set<string>,
    idempotencyKey: string,
  ) {
    this.assertEnabled();
    await this.requireFreshStepUp(claims);
    if (!perms.has(AUDIT_CENTER_PERMISSIONS.export)) {
      throw new AuditCenterError('forbidden', 'Missing audit.export', 403);
    }
    const actorId = claims.sub;
    if (!actorId) throw new AuditCenterError('actor_required', 'Actor required', 401);
    this.rateLimit.assertAllowed(actorId, 'export');
    const reason = input.reason?.trim();
    if (!reason || reason.length > 2000) {
      throw new AuditCenterError('invalid_reason', 'Reason required', 400);
    }
    const fp = fingerprint(input.filters);
    if (input.filterFingerprint !== fp) {
      throw new AuditCenterError('stale_fingerprint', 'Export filter fingerprint mismatch', 409);
    }

    const existing = await this.prisma.withPlatformBypass((c) =>
      c.platformAuditExportIdempotencyRecord.findUnique({
        where: {
          actorId_operation_idempotencyKey: {
            actorId,
            operation: AUDIT_CENTER_OPERATIONS.EXPORT_REQUEST,
            idempotencyKey,
          },
        },
      }),
    );
    if (existing) {
      if (existing.requestHash !== fp) {
        throw new AuditCenterError('idempotency_conflict', 'Idempotency key reused with different payload', 409);
      }
      return existing.resultPayload;
    }

    this.maybeInject('before_export_generate');
    const { items } = await this.query.search(
      { ...input.filters, limit: AUDIT_CENTER_EXPORT_MAX_ROWS },
      perms,
    );
    if (items.length >= AUDIT_CENTER_EXPORT_MAX_ROWS) {
      throw new AuditCenterError(
        'export_too_large',
        `Export exceeds ${AUDIT_CENTER_EXPORT_MAX_ROWS} rows`,
        400,
      );
    }

    const header = [
      'id',
      'occurredAt',
      'action',
      'category',
      'resourceType',
      'resourceId',
      'actorId',
      'reason',
      'correlationId',
      'tenantId',
    ];
    const lines = [header.join(',')];
    for (const row of items) {
      lines.push(
        [
          row.id,
          row.occurredAt,
          row.action,
          row.category,
          row.resourceType,
          row.resourceId,
          row.actorId,
          row.reason,
          row.correlationId,
          row.tenantId,
        ]
          .map(csvSafeCell)
          .join(','),
      );
    }
    const csv = `\uFEFF${lines.join('\n')}\n`;
    const contentSha = createHash('sha256').update(csv).digest('hex');
    const downloadToken = randomUUID();
    const tokenHash = createHash('sha256').update(downloadToken).digest('hex');
    const correlationId = randomUUID();
    const expiresAt = new Date(Date.now() + AUDIT_CENTER_EXPORT_TTL_MS);
    const fileName = `audit-export-${new Date().toISOString().slice(0, 10)}.csv`;

    this.maybeInject('after_export_staging');
    const exportRow = await this.prisma.withPlatformBypass(async (tx) => {
      const row = await tx.platformAuditExportRecord.create({
        data: {
          actorPlatformUserId: actorId,
          status: 'COMPLETED',
          filterJson: input.filters as Prisma.InputJsonValue,
          filterFingerprint: fp,
          rowCount: items.length,
          reason,
          fileName,
          contentSha256: contentSha,
          downloadTokenHash: tokenHash,
          expiresAt,
          correlationId,
          completedAt: new Date(),
        },
      });
      this.maybeInject('after_export_audit_staging');
      await this.writeExportAudit(tx, {
        actorId,
        exportId: row.id,
        reason,
        correlationId,
        rowCount: items.length,
      });
      await tx.platformAuditExportIdempotencyRecord.create({
        data: {
          actorId,
          operation: AUDIT_CENTER_OPERATIONS.EXPORT_REQUEST,
          idempotencyKey,
          requestHash: fp,
          resultResourceType: 'auditExport',
          resultResourceId: row.id,
          status: 'completed',
          resultPayload: {
            exportId: row.id,
            fileName,
            rowCount: items.length,
            expiresAt: expiresAt.toISOString(),
            downloadToken,
            contentSha256: contentSha,
          } as Prisma.InputJsonValue,
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        },
      });
      this.maybeInject('before_commit');
      return row;
    });

    this.bodies.set(exportRow.id, {
      csv,
      tokenHash,
      expiresAt: expiresAt.getTime(),
    });
    this.maybeInject('after_commit_before_response');
    return {
      exportId: exportRow.id,
      fileName,
      rowCount: items.length,
      expiresAt: expiresAt.toISOString(),
      downloadToken,
      contentSha256: contentSha,
    };
  }

  async getExport(exportId: string, actorId: string, perms: Set<string>) {
    if (!perms.has(AUDIT_CENTER_PERMISSIONS.export)) {
      throw new AuditCenterError('forbidden', 'Missing audit.export', 403);
    }
    const row = await this.prisma.withPlatformBypass((c) =>
      c.platformAuditExportRecord.findUnique({ where: { id: exportId } }),
    );
    if (!row) throw new AuditCenterError('not_found', 'Export not found', 404);
    if (row.actorPlatformUserId !== actorId) {
      throw new AuditCenterError('forbidden', 'Export belongs to another principal', 403);
    }
    return {
      exportId: row.id,
      status: row.status,
      fileName: row.fileName,
      rowCount: row.rowCount,
      expiresAt: row.expiresAt?.toISOString() ?? null,
      contentSha256: row.contentSha256,
    };
  }

  async download(exportId: string, actorId: string, token: string, perms: Set<string>) {
    if (!perms.has(AUDIT_CENTER_PERMISSIONS.export)) {
      throw new AuditCenterError('forbidden', 'Missing audit.export', 403);
    }
    const meta = await this.getExport(exportId, actorId, perms);
    const body = this.bodies.get(exportId);
    const row = await this.prisma.withPlatformBypass((c) =>
      c.platformAuditExportRecord.findUnique({ where: { id: exportId } }),
    );
    if (!row?.expiresAt || row.expiresAt.getTime() < Date.now()) {
      this.bodies.delete(exportId);
      throw new AuditCenterError('export_expired', 'Export download expired', 410);
    }
    const tokenHash = createHash('sha256').update(token).digest('hex');
    if (!body || body.tokenHash !== tokenHash || body.tokenHash !== row.downloadTokenHash) {
      throw new AuditCenterError('forbidden', 'Invalid download token', 403);
    }
    return { fileName: meta.fileName, csv: body.csv, contentSha256: meta.contentSha256 };
  }

  private async writeExportAudit(
    tx: Prisma.TransactionClient,
    input: {
      actorId: string;
      exportId: string;
      reason: string;
      correlationId: string;
      rowCount: number;
    },
  ) {
    await tx.tenant.upsert({
      where: { id: PLATFORM_AUDIT_SENTINEL_TENANT_ID },
      create: {
        id: PLATFORM_AUDIT_SENTINEL_TENANT_ID,
        name: PLATFORM_AUDIT_SENTINEL_DISPLAY_NAME,
        slug: PLATFORM_AUDIT_SENTINEL_SLUG,
      },
      update: {},
    });
    const entry = this.factory.create(
      randomUUID(),
      PLATFORM_AUDIT_SENTINEL_TENANT_ID,
      null,
      'en',
      AUDIT_CENTER_OPERATIONS.EXPORT_COMPLETE,
      'audit_export',
      input.exportId,
      input.actorId,
      ['platform'],
      { rowCount: String(input.rowCount) },
      null,
      'audit_export',
      'Audit export completed',
      null,
      input.reason,
      null,
      null,
      input.correlationId,
    );
    await tx.auditEntry.create({
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
        descriptionEn: 'Audit export completed',
        descriptionAr: null,
        details: { rowCount: input.rowCount },
        changes: Prisma.JsonNull,
        reason: input.reason,
        ipAddress: null,
        userAgent: null,
        correlationId: input.correlationId,
        locale: 'en',
        createdAt: entry.createdAt,
      },
    });
  }
}
