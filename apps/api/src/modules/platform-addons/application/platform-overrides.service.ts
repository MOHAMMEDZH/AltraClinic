/**
 * Release 47 Step 15 — Platform Commercial Overrides service.
 * Maker-checker approve via PlatformSodService. Step-up on publish/approve/revoke.
 * No tenantId assignment. Does not call the licensing engine resolve path.
 */
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  Optional,
  ServiceUnavailableException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PrismaService } from '../../../infrastructure/prisma.service';
import { PlatformAuthorizationService } from '../../auth/platform-rbac/platform-authorization.service';
import { PlatformAssuranceService } from '../../auth/application/services/platform-assurance.service';
import { PlatformSodService } from '../../auth/platform-rbac/platform-sod.service';
import type { PlatformRefreshTokenRepository } from '../../auth/domain/repositories/platform-refresh-token.repository.interface';
import type { JwtClaimsVO } from '../../auth/domain/value-objects/jwt-claims.vo';
import { PLATFORM_REFRESH_TOKEN_REPOSITORY } from '../../auth/platform-auth.tokens';
import { PLATFORM_AUDIT_SENTINEL_TENANT_ID } from '../../platform-tenants/platform-tenants.tokens';
import {
  COMMERCIAL_OVERRIDE_EFFECT_KINDS,
  COMMERCIAL_OVERRIDE_REASON_CODES,
  PLATFORM_ADDONS_AUDIT_LOG,
  PLATFORM_ADDONS_CONFIG,
  PLATFORM_ADDONS_TX_FAILURE_HOOK,
  type AddonTxFailureHook,
  type AddonTxFailurePoint,
  type CommercialOverrideEffectKind,
  type CommercialOverrideReasonCode,
} from '../platform-addons.tokens';
import {
  canTransitionOverrideLifecycle,
  isOverrideMutable,
} from '../domain/override-lifecycle';
import { buildOverrideCompositionFingerprint } from '../domain/publication-fingerprint';
import {
  AddonIdempotencyService,
  IdempotencyEquivalentRaceLostError,
  IdempotencyEquivalentReplayTimeoutError,
  type AddonIdempotencyOperation,
} from './addon-idempotency.service';
import type { PlatformAddonsAuditLog } from './ports/addon-audit-log.port';
import {
  loadPlatformAddonsConfig,
  type PlatformAddonsConfig,
} from '../config/platform-addons.config';
import { resolveOperationCorrelationId } from '../../platform-audit-center/application/operation-correlation';

/** Prisma tx client; `any` avoids contravariant upsert arg mismatch with Prisma generics. */
type AuditTxClient = any;

type RateBucket = 'mutation' | 'highImpact' | 'readHeavy';

const MAX_EFFECTS = 100;
const MAX_REASON_NOTE = 500;

@Injectable()
export class PlatformOverridesService {
  private readonly logger = new Logger(PlatformOverridesService.name);
  private readonly rateHits = new Map<string, number[]>();
  private readonly config: PlatformAddonsConfig;

  constructor(
    private readonly prisma: PrismaService,
    private readonly authorization: PlatformAuthorizationService,
    @Inject(PLATFORM_ADDONS_AUDIT_LOG)
    private readonly audit: PlatformAddonsAuditLog,
    @Inject(PLATFORM_REFRESH_TOKEN_REPOSITORY)
    private readonly refreshRepo: PlatformRefreshTokenRepository,
    private readonly assurance: PlatformAssuranceService,
    private readonly sod: PlatformSodService,
    private readonly idempotency: AddonIdempotencyService,
    @Optional() @Inject(PLATFORM_ADDONS_CONFIG) config?: PlatformAddonsConfig,
    @Optional() @Inject(PLATFORM_ADDONS_TX_FAILURE_HOOK)
    private readonly failureHook?: AddonTxFailureHook,
  ) {
    this.config = config ?? loadPlatformAddonsConfig();
  }

  private async maybeFail(point: AddonTxFailurePoint): Promise<void> {
    if (!this.failureHook) return;
    await this.failureHook(point);
  }

  private async recoverEquivalentReplay<T>(
    claim: { idempotencyKey: string; requestHash: string } | null,
    operation: AddonIdempotencyOperation,
    actorId: string,
    err: unknown,
    load: (resultResourceId: string) => Promise<T>,
  ): Promise<T | null> {
    if (!claim) return null;
    if (err instanceof IdempotencyEquivalentRaceLostError) {
      return load(err.resultResourceId);
    }
    const conflictMsg = err instanceof ConflictException ? String(err.message) : '';
    const badRequestMsg = err instanceof BadRequestException ? String(err.message) : '';
    const prismaUnique =
      typeof err === 'object' &&
      err !== null &&
      'code' in err &&
      (err as { code?: string }).code === 'P2002';
    // Concurrent equivalent losers may hit OCC stale, unique-key, or a post-commit
    // lifecycle read (winner already transitioned → BadRequest "Cannot … from").
    const recoverable =
      prismaUnique ||
      (err instanceof ConflictException &&
        (/Stale version/i.test(conflictMsg) || /already exists/i.test(conflictMsg))) ||
      (err instanceof BadRequestException &&
        /^Cannot (?:submit|approve|reject|revoke)\b/i.test(badRequestMsg));
    if (!recoverable) return null;
    const replay = await this.idempotency.awaitEquivalentReplay({
      actorId,
      operation,
      idempotencyKey: claim.idempotencyKey,
      requestHash: claim.requestHash,
    });
    if (!replay) {
      throw new ServiceUnavailableException(new IdempotencyEquivalentReplayTimeoutError().message);
    }
    return load(replay.resultResourceId);
  }

  private enforceRateLimit(actorId: string, bucket: RateBucket): void {
    const limit =
      bucket === 'mutation'
        ? this.config.mutationRateLimitPerMinute
        : bucket === 'highImpact'
          ? this.config.highImpactRateLimitPerMinute
          : this.config.readHeavyRateLimitPerMinute;
    const key = `${bucket}:${actorId}`;
    const now = Date.now();
    const windowStart = now - 60_000;
    const hits = (this.rateHits.get(key) ?? []).filter((t) => t > windowStart);
    if (hits.length >= limit) {
      throw new HttpException('Overrides rate limit exceeded.', HttpStatus.TOO_MANY_REQUESTS);
    }
    hits.push(now);
    this.rateHits.set(key, hits);
  }

  private async perms(claims: JwtClaimsVO): Promise<Set<string>> {
    const list = await this.authorization.resolveEffectivePermissions(claims.sub);
    return new Set(list);
  }

  private require(permissions: Set<string>, key: string): void {
    if (!permissions.has(key)) {
      throw new ForbiddenException(`Missing ${key} permission.`);
    }
  }

  private async requireFreshStepUp(claims: JwtClaimsVO): Promise<void> {
    if (!claims.sessionId) throw new ForbiddenException('Session unavailable.');
    const session = await this.refreshRepo.findBySessionId(claims.sessionId);
    if (!session) throw new ForbiddenException('Session unavailable.');
    this.assurance.requireStepUp(session);
  }

  /**
   * Non-authoritative best-effort audit for outcomes that are not the
   * durable success record (e.g. rejections). Failures are logged, never
   * thrown, and never block the already-committed business mutation.
   */
  private async safeAudit(
    claims: JwtClaimsVO,
    action: string,
    resourceId: string,
    details: Record<string, string>,
  ) {
    try {
      await this.audit.record({
        tenantId: PLATFORM_AUDIT_SENTINEL_TENANT_ID,
        action,
        resourceId,
        actorId: claims.sub,
        actorRoles: ['platform'],
        locale: null,
        descriptionEn: 'Platform commercial override mutation',
        descriptionAr: 'تعديل استثناء تجاري للمنصة',
        details,
        // Non-authoritative rejection evidence only — not a required success path.
        correlationId: resolveOperationCorrelationId({ explicit: null }),
      });
    } catch (err) {
      this.logger.warn(`Override audit failed: ${(err as Error)?.name ?? 'Error'}`);
    }
  }

  /**
   * Step 21 A09 — durable success AuditEntry append (Model A). Must be
   * called with the same transaction client as the business mutation it
   * documents; throws on failure so the whole transaction rolls back
   * rather than silently losing the audit trail.
   */
  private async auditInTransaction(
    client: AuditTxClient,
    claims: JwtClaimsVO,
    action: string,
    resourceId: string,
    details: Record<string, string>,
  ): Promise<void> {
    const correlationId = resolveOperationCorrelationId({ explicit: null });
    await this.audit.recordInTransaction(client, {
      tenantId: PLATFORM_AUDIT_SENTINEL_TENANT_ID,
      action,
      resourceId,
      actorId: claims.sub,
      actorRoles: ['platform'],
      locale: null,
      descriptionEn: 'Platform commercial override mutation',
      descriptionAr: 'تعديل استثناء تجاري للمنصة',
      details,
      correlationId,
    });
  }

  private assertReasonCode(code: string): CommercialOverrideReasonCode {
    if (!COMMERCIAL_OVERRIDE_REASON_CODES.includes(code as CommercialOverrideReasonCode)) {
      throw new BadRequestException('Invalid reasonCode.');
    }
    return code as CommercialOverrideReasonCode;
  }

  private assertEffects(
    effects: Array<{
      effectKind: string;
      catalogItemId: string;
      unlimited?: boolean;
      valueText?: string | null;
    }>,
  ) {
    if (!effects?.length) throw new BadRequestException('At least one effect is required.');
    if (effects.length > MAX_EFFECTS) {
      throw new BadRequestException(`At most ${MAX_EFFECTS} effects allowed.`);
    }
    for (const e of effects) {
      if (!COMMERCIAL_OVERRIDE_EFFECT_KINDS.includes(e.effectKind as CommercialOverrideEffectKind)) {
        throw new BadRequestException(`Invalid effectKind: ${e.effectKind}`);
      }
      if (!e.catalogItemId?.trim()) {
        throw new BadRequestException('catalogItemId is required on each effect.');
      }
      if (e.effectKind === 'LIMIT_SET_UNLIMITED') {
        if (e.valueText != null) {
          throw new BadRequestException('LIMIT_SET_UNLIMITED cannot include valueText.');
        }
      } else if (
        (e.effectKind === 'LIMIT_SET_ABSOLUTE' || e.effectKind === 'LIMIT_INCREASE_BY') &&
        (e.valueText == null || e.valueText === '') &&
        e.unlimited !== true
      ) {
        throw new BadRequestException(`${e.effectKind} requires valueText.`);
      }
    }
  }

  private toOverrideDto(row: {
    id: string;
    lifecycle: string;
    rowVersion: number;
    reasonCode: string;
    reasonNote: string;
    effectiveFrom: Date | null;
    expiresAt: Date | null;
    createdByPlatformUserId: string;
    submittedByPlatformUserId: string | null;
    approvedByPlatformUserId: string | null;
    rejectedByPlatformUserId: string | null;
    revokedByPlatformUserId: string | null;
    submittedAt: Date | null;
    approvedAt: Date | null;
    rejectedAt: Date | null;
    revokedAt: Date | null;
    rejectionReason: string | null;
    revocationReason: string | null;
    predecessorId: string | null;
    compositionFingerprint: string | null;
    createdAt: Date;
    updatedAt: Date;
    effects?: Array<{
      id: string;
      effectKind: string;
      catalogItemId: string;
      unlimited: boolean;
      valueText: string | null;
      catalogItem?: { canonicalKey: string; kind: string };
    }>;
  }) {
    return {
      id: row.id,
      lifecycle: row.lifecycle,
      rowVersion: row.rowVersion,
      reasonCode: row.reasonCode,
      reasonNote: row.reasonNote,
      effectiveFrom: row.effectiveFrom?.toISOString() ?? null,
      expiresAt: row.expiresAt?.toISOString() ?? null,
      createdByPlatformUserId: row.createdByPlatformUserId,
      submittedByPlatformUserId: row.submittedByPlatformUserId,
      approvedByPlatformUserId: row.approvedByPlatformUserId,
      rejectedByPlatformUserId: row.rejectedByPlatformUserId,
      revokedByPlatformUserId: row.revokedByPlatformUserId,
      submittedAt: row.submittedAt?.toISOString() ?? null,
      approvedAt: row.approvedAt?.toISOString() ?? null,
      rejectedAt: row.rejectedAt?.toISOString() ?? null,
      revokedAt: row.revokedAt?.toISOString() ?? null,
      rejectionReason: row.rejectionReason,
      revocationReason: row.revocationReason,
      predecessorId: row.predecessorId,
      compositionFingerprint: row.compositionFingerprint,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
      effects: (row.effects ?? []).map((e) => ({
        id: e.id,
        effectKind: e.effectKind,
        catalogItemId: e.catalogItemId,
        canonicalKey: e.catalogItem?.canonicalKey ?? null,
        kind: e.catalogItem?.kind ?? null,
        unlimited: e.unlimited,
        valueText: e.valueText,
      })),
      runtimeEffective: false as const,
      tenantAssignment: 'unavailable_until_step_16' as const,
    };
  }

  async listOverrides(
    claims: JwtClaimsVO,
    query: { lifecycle?: string; page?: string; pageSize?: string },
  ) {
    const permissions = await this.perms(claims);
    this.require(permissions, 'override.view');
    const page = Math.max(1, Number(query.page ?? 1) || 1);
    const pageSize = Math.min(100, Math.max(1, Number(query.pageSize ?? 20) || 20));
    return this.prisma.withPlatformBypass(async (client) => {
      const where: Record<string, unknown> = {};
      if (query.lifecycle) where.lifecycle = query.lifecycle;
      const [total, rows] = await Promise.all([
        client.platformCommercialOverride.count({ where }),
        client.platformCommercialOverride.findMany({
          where,
          include: { effects: { include: { catalogItem: true } } },
          orderBy: { createdAt: 'desc' },
          skip: (page - 1) * pageSize,
          take: pageSize,
        }),
      ]);
      return {
        items: rows.map((r) => this.toOverrideDto(r)),
        page,
        pageSize,
        total,
        emptyCatalog: total === 0,
      };
    });
  }

  async getOverride(claims: JwtClaimsVO, overrideId: string) {
    const permissions = await this.perms(claims);
    this.require(permissions, 'override.view');
    return this.prisma.withPlatformBypass(async (client) => {
      const row = await client.platformCommercialOverride.findUnique({
        where: { id: overrideId },
        include: { effects: { include: { catalogItem: true } } },
      });
      if (!row) throw new NotFoundException('Commercial override not found.');
      return this.toOverrideDto(row);
    });
  }

  async createOverride(
    claims: JwtClaimsVO,
    body: {
      reasonCode: string;
      reasonNote: string;
      effectiveFrom?: string | null;
      expiresAt?: string | null;
      effects: Array<{
        effectKind: string;
        catalogItemId: string;
        unlimited?: boolean;
        valueText?: string | null;
      }>;
      predecessorId?: string | null;
    },
    idempotencyKey?: string | null,
    auditOverride?: { action: string; details: Record<string, string> },
  ) {
    const permissions = await this.perms(claims);
    this.require(permissions, 'override.request');
    this.enforceRateLimit(claims.sub, 'mutation');
    const reasonCode = this.assertReasonCode(body.reasonCode);
    const reasonNote = body.reasonNote?.trim() ?? '';
    if (!reasonNote || reasonNote.length > MAX_REASON_NOTE) {
      throw new BadRequestException(`reasonNote required (max ${MAX_REASON_NOTE}).`);
    }
    this.assertEffects(body.effects);

    const requestHash = this.idempotency.fingerprint(body);
    let claim: { idempotencyKey: string; requestHash: string } | null = null;
    if (idempotencyKey?.trim()) {
      const gate = await this.idempotency.beginOrReplay({
        actorId: claims.sub,
        operation: 'override.create',
        idempotencyKey: idempotencyKey.trim(),
        requestHash,
      });
      if (gate.kind === 'replay') return this.getOverride(claims, gate.resultResourceId);
      claim = { idempotencyKey: gate.idempotencyKey, requestHash: gate.requestHash };
    }

    try {
      const created = await this.prisma.withPlatformBypass(async (client) => {
        const catalogIds = body.effects.map((e) => e.catalogItemId);
        const items = await client.healthcareCatalogItem.findMany({
          where: { id: { in: catalogIds } },
          select: { id: true, kind: true, canonicalKey: true },
        });
        if (items.length !== new Set(catalogIds).size) {
          throw new BadRequestException('One or more catalogItemIds are unknown.');
        }
        const byId = new Map(items.map((i) => [i.id, i]));
        for (const e of body.effects) {
          const item = byId.get(e.catalogItemId)!;
          if (
            (e.effectKind === 'ENTITLEMENT_GRANT' || e.effectKind === 'ENTITLEMENT_SUPPRESS') &&
            item.kind !== 'MODULE' &&
            item.kind !== 'FEATURE'
          ) {
            throw new BadRequestException(
              `Entitlement effects require MODULE/FEATURE (got ${item.kind}).`,
            );
          }
          if (
            (e.effectKind === 'LIMIT_SET_ABSOLUTE' ||
              e.effectKind === 'LIMIT_INCREASE_BY' ||
              e.effectKind === 'LIMIT_SET_UNLIMITED') &&
            item.kind !== 'LIMIT'
          ) {
            throw new BadRequestException(`Limit effects require LIMIT kind (got ${item.kind}).`);
          }
        }
        if (body.predecessorId) {
          const pred = await client.platformCommercialOverride.findUnique({
            where: { id: body.predecessorId },
          });
          if (!pred) throw new BadRequestException('predecessorId not found.');
        }
        const id = randomUUID();
        const fingerprint = buildOverrideCompositionFingerprint({
          reasonCode,
          reasonNote,
          effectiveFrom: body.effectiveFrom ?? null,
          expiresAt: body.expiresAt ?? null,
          effects: body.effects.map((e) => ({
            effectKind: e.effectKind,
            catalogItemCanonicalKey: byId.get(e.catalogItemId)!.canonicalKey,
            unlimited: e.unlimited === true || e.effectKind === 'LIMIT_SET_UNLIMITED',
            valueText: e.effectKind === 'LIMIT_SET_UNLIMITED' ? null : (e.valueText ?? null),
          })),
        });
        const row = await client.platformCommercialOverride.create({
          data: {
            id,
            lifecycle: 'DRAFT',
            reasonCode,
            reasonNote: reasonNote.slice(0, MAX_REASON_NOTE),
            effectiveFrom: body.effectiveFrom ? new Date(body.effectiveFrom) : null,
            expiresAt: body.expiresAt ? new Date(body.expiresAt) : null,
            createdByPlatformUserId: claims.sub,
            predecessorId: body.predecessorId ?? null,
            compositionFingerprint: fingerprint,
            ...(body.predecessorId
              ? {}
              : {
                  effects: {
                    create: body.effects.map((e) => ({
                      id: randomUUID(),
                      effectKind: e.effectKind as CommercialOverrideEffectKind,
                      catalogItemId: e.catalogItemId,
                      unlimited: e.unlimited === true || e.effectKind === 'LIMIT_SET_UNLIMITED',
                      valueText:
                        e.effectKind === 'LIMIT_SET_UNLIMITED' ? null : (e.valueText ?? null),
                    })),
                  },
                }),
          },
          include: { effects: { include: { catalogItem: true } } },
        });
        if (body.predecessorId) {
          await this.maybeFail('after_supersede_draft');
          if (body.effects.length) {
            const mid = Math.max(1, Math.ceil(body.effects.length / 2));
            const first = body.effects.slice(0, mid);
            const rest = body.effects.slice(mid);
            await client.platformCommercialOverrideEffect.createMany({
              data: first.map((e) => ({
                id: randomUUID(),
                overrideId: row.id,
                effectKind: e.effectKind as CommercialOverrideEffectKind,
                catalogItemId: e.catalogItemId,
                unlimited: e.unlimited === true || e.effectKind === 'LIMIT_SET_UNLIMITED',
                valueText: e.effectKind === 'LIMIT_SET_UNLIMITED' ? null : (e.valueText ?? null),
              })),
            });
            await this.maybeFail('after_supersede_partial_effects');
            if (rest.length) {
              await client.platformCommercialOverrideEffect.createMany({
                data: rest.map((e) => ({
                  id: randomUUID(),
                  overrideId: row.id,
                  effectKind: e.effectKind as CommercialOverrideEffectKind,
                  catalogItemId: e.catalogItemId,
                  unlimited: e.unlimited === true || e.effectKind === 'LIMIT_SET_UNLIMITED',
                  valueText: e.effectKind === 'LIMIT_SET_UNLIMITED' ? null : (e.valueText ?? null),
                })),
              });
            }
          }
          await this.maybeFail('after_supersede_successor_create');
          await this.maybeFail('before_supersede_commit');
        }
        if (claim) {
          await this.idempotency.completeInTransaction(client, {
            actorId: claims.sub,
            operation: 'override.create',
            idempotencyKey: claim.idempotencyKey,
            requestHash: claim.requestHash,
            resultResourceType: 'override',
            resultResourceId: row.id,
          });
        }
        await this.auditInTransaction(
          client,
          claims,
          auditOverride?.action ?? 'platform_override.created',
          row.id,
          auditOverride?.details ?? { reasonCode, result: 'success' },
        );
        return client.platformCommercialOverride.findUniqueOrThrow({
          where: { id: row.id },
          include: { effects: { include: { catalogItem: true } } },
        });
      });
      return this.toOverrideDto(created);
    } catch (err) {
      const recovered = await this.recoverEquivalentReplay(
        claim,
        'override.create',
        claims.sub,
        err,
        (id) => this.getOverride(claims, id),
      );
      if (recovered) return recovered;
      throw err;
    }
  }

  async updateDraft(
    claims: JwtClaimsVO,
    overrideId: string,
    body: {
      expectedRowVersion: number;
      reasonCode?: string;
      reasonNote?: string;
      effectiveFrom?: string | null;
      expiresAt?: string | null;
      effects?: Array<{
        effectKind: string;
        catalogItemId: string;
        unlimited?: boolean;
        valueText?: string | null;
      }>;
    },
    idempotencyKey?: string | null,
  ) {
    const permissions = await this.perms(claims);
    this.require(permissions, 'override.request');
    this.enforceRateLimit(claims.sub, 'mutation');
    if (body.effects) this.assertEffects(body.effects);

    const requestHash = this.idempotency.fingerprint({
      overrideId,
      expectedRowVersion: body.expectedRowVersion,
      reasonCode: body.reasonCode ?? null,
      reasonNote: body.reasonNote ?? null,
      effectiveFrom: body.effectiveFrom !== undefined ? body.effectiveFrom : undefined,
      expiresAt: body.expiresAt !== undefined ? body.expiresAt : undefined,
      effects: body.effects ?? null,
    });
    let claim: { idempotencyKey: string; requestHash: string } | null = null;
    if (idempotencyKey?.trim()) {
      const gate = await this.idempotency.beginOrReplay({
        actorId: claims.sub,
        operation: 'override.updateDraft',
        idempotencyKey: idempotencyKey.trim(),
        requestHash,
      });
      if (gate.kind === 'replay') return this.getOverride(claims, gate.resultResourceId);
      claim = { idempotencyKey: gate.idempotencyKey, requestHash: gate.requestHash };
    }

    try {
      await this.prisma.withPlatformBypass(async (client) => {
        const existing = await client.platformCommercialOverride.findUnique({
          where: { id: overrideId },
          include: { effects: { include: { catalogItem: true } } },
        });
        if (!existing) throw new NotFoundException('Commercial override not found.');
        if (!isOverrideMutable(existing.lifecycle as never)) {
          throw new BadRequestException('Only Draft overrides are mutable.');
        }
        const reasonCode = body.reasonCode
          ? this.assertReasonCode(body.reasonCode)
          : (existing.reasonCode as CommercialOverrideReasonCode);
        const reasonNote = body.reasonNote?.trim() ?? existing.reasonNote;
        if (!reasonNote || reasonNote.length > MAX_REASON_NOTE) {
          throw new BadRequestException(`reasonNote required (max ${MAX_REASON_NOTE}).`);
        }

        if (body.effects) {
          const catalogIds = body.effects.map((e) => e.catalogItemId);
          const items = await client.healthcareCatalogItem.findMany({
            where: { id: { in: catalogIds } },
            select: { id: true, kind: true, canonicalKey: true },
          });
          if (items.length !== new Set(catalogIds).size) {
            throw new BadRequestException('One or more catalogItemIds are unknown.');
          }
          await client.platformCommercialOverrideEffect.deleteMany({ where: { overrideId } });
          if (body.effects.length) {
            const mid = Math.max(1, Math.ceil(body.effects.length / 2));
            const first = body.effects.slice(0, mid);
            const rest = body.effects.slice(mid);
            await client.platformCommercialOverrideEffect.createMany({
              data: first.map((e) => ({
                id: randomUUID(),
                overrideId,
                effectKind: e.effectKind as CommercialOverrideEffectKind,
                catalogItemId: e.catalogItemId,
                unlimited: e.unlimited === true || e.effectKind === 'LIMIT_SET_UNLIMITED',
                valueText: e.effectKind === 'LIMIT_SET_UNLIMITED' ? null : (e.valueText ?? null),
              })),
            });
            await this.maybeFail('after_override_effect_partial');
            if (rest.length) {
              await client.platformCommercialOverrideEffect.createMany({
                data: rest.map((e) => ({
                  id: randomUUID(),
                  overrideId,
                  effectKind: e.effectKind as CommercialOverrideEffectKind,
                  catalogItemId: e.catalogItemId,
                  unlimited: e.unlimited === true || e.effectKind === 'LIMIT_SET_UNLIMITED',
                  valueText: e.effectKind === 'LIMIT_SET_UNLIMITED' ? null : (e.valueText ?? null),
                })),
              });
            }
          }
        }

        const effectsForFp =
          body.effects ??
          existing.effects.map((e) => ({
            effectKind: e.effectKind,
            catalogItemCanonicalKey: e.catalogItem.canonicalKey,
            unlimited: e.unlimited,
            valueText: e.valueText,
          }));

        const catalogForFp = body.effects
          ? await client.healthcareCatalogItem.findMany({
              where: { id: { in: body.effects.map((e) => e.catalogItemId) } },
              select: { id: true, canonicalKey: true },
            })
          : [];
        const keyById = new Map(catalogForFp.map((c) => [c.id, c.canonicalKey]));

        const fingerprint = buildOverrideCompositionFingerprint({
          reasonCode,
          reasonNote,
          effectiveFrom:
            body.effectiveFrom !== undefined
              ? body.effectiveFrom
              : (existing.effectiveFrom?.toISOString() ?? null),
          expiresAt:
            body.expiresAt !== undefined
              ? body.expiresAt
              : (existing.expiresAt?.toISOString() ?? null),
          effects: body.effects
            ? body.effects.map((e) => ({
                effectKind: e.effectKind,
                catalogItemCanonicalKey: keyById.get(e.catalogItemId) ?? e.catalogItemId,
                unlimited: e.unlimited === true || e.effectKind === 'LIMIT_SET_UNLIMITED',
                valueText: e.effectKind === 'LIMIT_SET_UNLIMITED' ? null : (e.valueText ?? null),
              }))
            : (effectsForFp as Array<{
                effectKind: string;
                catalogItemCanonicalKey: string;
                unlimited: boolean;
                valueText: string | null;
              }>),
        });

        const bumped = await client.platformCommercialOverride.updateMany({
          where: { id: overrideId, rowVersion: body.expectedRowVersion, lifecycle: 'DRAFT' },
          data: {
            reasonCode,
            reasonNote: reasonNote.slice(0, MAX_REASON_NOTE),
            effectiveFrom:
              body.effectiveFrom !== undefined
                ? body.effectiveFrom
                  ? new Date(body.effectiveFrom)
                  : null
                : undefined,
            expiresAt:
              body.expiresAt !== undefined
                ? body.expiresAt
                  ? new Date(body.expiresAt)
                  : null
                : undefined,
            compositionFingerprint: fingerprint,
            rowVersion: { increment: 1 },
          },
        });
        if (bumped.count !== 1) throw new ConflictException('Stale version — reload and retry.');
        await this.maybeFail('after_override_row_version_bump');
        if (claim) {
          await this.idempotency.completeInTransaction(client, {
            actorId: claims.sub,
            operation: 'override.updateDraft',
            idempotencyKey: claim.idempotencyKey,
            requestHash: claim.requestHash,
            resultResourceType: 'override',
            resultResourceId: overrideId,
          });
        }
        await this.auditInTransaction(client, claims, 'platform_override.updated', overrideId, {
          result: 'success',
        });
      });
      return this.getOverride(claims, overrideId);
    } catch (err) {
      const recovered = await this.recoverEquivalentReplay(
        claim,
        'override.updateDraft',
        claims.sub,
        err,
        (id) => this.getOverride(claims, id),
      );
      if (recovered) return recovered;
      throw err;
    }
  }

  async getReadiness(claims: JwtClaimsVO, overrideId: string) {
    const permissions = await this.perms(claims);
    this.require(permissions, 'override.view');
    this.enforceRateLimit(claims.sub, 'readHeavy');
    return this.prisma.withPlatformBypass(async (client) => {
      const row = await client.platformCommercialOverride.findUnique({
        where: { id: overrideId },
        include: { effects: true },
      });
      if (!row) throw new NotFoundException('Commercial override not found.');
      const blockers: Array<{ code: string; message: string }> = [];
      if (!row.effects.length) {
        blockers.push({ code: 'effects_required', message: 'At least one effect is required.' });
      }
      if (!row.reasonNote?.trim()) {
        blockers.push({ code: 'reason_required', message: 'reasonNote is required.' });
      }
      return {
        status: 'available' as const,
        reason: 'step_15_commercial_definition',
        submitReady: row.lifecycle === 'DRAFT' && blockers.length === 0,
        blockers,
        runtimeEffective: false,
      };
    });
  }

  async submit(
    claims: JwtClaimsVO,
    overrideId: string,
    body: { expectedRowVersion: number },
    idempotencyKey?: string | null,
  ) {
    const permissions = await this.perms(claims);
    this.require(permissions, 'override.request');
    this.enforceRateLimit(claims.sub, 'mutation');

    const requestHash = this.idempotency.fingerprint({
      overrideId,
      expectedRowVersion: body.expectedRowVersion,
    });
    let claim: { idempotencyKey: string; requestHash: string } | null = null;
    if (idempotencyKey?.trim()) {
      const gate = await this.idempotency.beginOrReplay({
        actorId: claims.sub,
        operation: 'override.submit',
        idempotencyKey: idempotencyKey.trim(),
        requestHash,
      });
      if (gate.kind === 'replay') return this.getOverride(claims, gate.resultResourceId);
      claim = { idempotencyKey: gate.idempotencyKey, requestHash: gate.requestHash };
    }

    const readiness = await this.getReadiness(claims, overrideId);
    if (!readiness.submitReady) {
      throw new BadRequestException({
        code: 'submit_not_ready',
        blockers: readiness.blockers,
      });
    }

    try {
      await this.prisma.withPlatformBypass(async (client) => {
        const existing = await client.platformCommercialOverride.findUnique({
          where: { id: overrideId },
        });
        if (!existing) throw new NotFoundException('Commercial override not found.');
        if (!canTransitionOverrideLifecycle(existing.lifecycle as never, 'PENDING_APPROVAL')) {
          throw new BadRequestException(`Cannot submit from ${existing.lifecycle}.`);
        }
        const result = await client.platformCommercialOverride.updateMany({
          where: { id: overrideId, rowVersion: body.expectedRowVersion, lifecycle: 'DRAFT' },
          data: {
            lifecycle: 'PENDING_APPROVAL',
            submittedByPlatformUserId: claims.sub,
            submittedAt: new Date(),
            rowVersion: { increment: 1 },
          },
        });
        if (result.count !== 1) throw new ConflictException('Stale version — reload and retry.');
        await this.maybeFail('after_submit_lifecycle');
        await this.maybeFail('before_submit_commit');
        if (claim) {
          await this.idempotency.completeInTransaction(client, {
            actorId: claims.sub,
            operation: 'override.submit',
            idempotencyKey: claim.idempotencyKey,
            requestHash: claim.requestHash,
            resultResourceType: 'override',
            resultResourceId: overrideId,
          });
        }
        await this.auditInTransaction(client, claims, 'platform_override.submitted', overrideId, {
          result: 'success',
        });
      });
      return this.getOverride(claims, overrideId);
    } catch (err) {
      const recovered = await this.recoverEquivalentReplay(
        claim,
        'override.submit',
        claims.sub,
        err,
        (id) => this.getOverride(claims, id),
      );
      if (recovered) return recovered;
      throw err;
    }
  }

  async approve(
    claims: JwtClaimsVO,
    overrideId: string,
    body: { expectedRowVersion: number },
    idempotencyKey?: string | null,
  ) {
    const permissions = await this.perms(claims);
    this.require(permissions, 'override.approve');
    this.enforceRateLimit(claims.sub, 'highImpact');
    await this.requireFreshStepUp(claims);

    const requestHash = this.idempotency.fingerprint({
      overrideId,
      expectedRowVersion: body.expectedRowVersion,
    });
    let claim: { idempotencyKey: string; requestHash: string } | null = null;
    if (idempotencyKey?.trim()) {
      const gate = await this.idempotency.beginOrReplay({
        actorId: claims.sub,
        operation: 'override.approve',
        idempotencyKey: idempotencyKey.trim(),
        requestHash,
      });
      if (gate.kind === 'replay') return this.getOverride(claims, gate.resultResourceId);
      claim = { idempotencyKey: gate.idempotencyKey, requestHash: gate.requestHash };
    }

    try {
      await this.prisma.withPlatformBypass(async (client) => {
        const existing = await client.platformCommercialOverride.findUnique({
          where: { id: overrideId },
        });
        if (!existing) throw new NotFoundException('Commercial override not found.');
        if (!canTransitionOverrideLifecycle(existing.lifecycle as never, 'APPROVED')) {
          throw new BadRequestException(`Cannot approve from ${existing.lifecycle}.`);
        }
        const creatorId =
          existing.submittedByPlatformUserId ?? existing.createdByPlatformUserId;
        this.sod.assertOverrideApproveSod(creatorId, claims.sub);

        const result = await client.platformCommercialOverride.updateMany({
          where: {
            id: overrideId,
            rowVersion: body.expectedRowVersion,
            lifecycle: 'PENDING_APPROVAL',
          },
          data: {
            lifecycle: 'APPROVED',
            approvedByPlatformUserId: claims.sub,
            approvedAt: new Date(),
            rowVersion: { increment: 1 },
          },
        });
        if (result.count !== 1) throw new ConflictException('Stale version — reload and retry.');
        await this.maybeFail('after_approve_lifecycle');
        await this.maybeFail('before_approve_commit');
        if (claim) {
          await this.idempotency.completeInTransaction(client, {
            actorId: claims.sub,
            operation: 'override.approve',
            idempotencyKey: claim.idempotencyKey,
            requestHash: claim.requestHash,
            resultResourceType: 'override',
            resultResourceId: overrideId,
          });
        }
        await this.auditInTransaction(client, claims, 'platform_override.approved', overrideId, {
          result: 'success',
          runtimeChanged: 'false',
        });
      });
      return this.getOverride(claims, overrideId);
    } catch (err) {
      const recovered = await this.recoverEquivalentReplay(
        claim,
        'override.approve',
        claims.sub,
        err,
        (id) => this.getOverride(claims, id),
      );
      if (recovered) return recovered;
      throw err;
    }
  }

  async reject(
    claims: JwtClaimsVO,
    overrideId: string,
    body: { expectedRowVersion: number; reason: string },
    idempotencyKey?: string | null,
  ) {
    const permissions = await this.perms(claims);
    this.require(permissions, 'override.approve');
    this.enforceRateLimit(claims.sub, 'highImpact');
    await this.requireFreshStepUp(claims);
    if (!body.reason?.trim() || body.reason.trim().length < 3) {
      throw new BadRequestException('Reason is required.');
    }

    const requestHash = this.idempotency.fingerprint({
      overrideId,
      expectedRowVersion: body.expectedRowVersion,
      reason: body.reason.trim(),
    });
    let claim: { idempotencyKey: string; requestHash: string } | null = null;
    if (idempotencyKey?.trim()) {
      const gate = await this.idempotency.beginOrReplay({
        actorId: claims.sub,
        operation: 'override.reject',
        idempotencyKey: idempotencyKey.trim(),
        requestHash,
      });
      if (gate.kind === 'replay') return this.getOverride(claims, gate.resultResourceId);
      claim = { idempotencyKey: gate.idempotencyKey, requestHash: gate.requestHash };
    }

    try {
      await this.prisma.withPlatformBypass(async (client) => {
        const existing = await client.platformCommercialOverride.findUnique({
          where: { id: overrideId },
        });
        if (!existing) throw new NotFoundException('Commercial override not found.');
        if (!canTransitionOverrideLifecycle(existing.lifecycle as never, 'REJECTED')) {
          throw new BadRequestException(`Cannot reject from ${existing.lifecycle}.`);
        }
        const creatorId =
          existing.submittedByPlatformUserId ?? existing.createdByPlatformUserId;
        this.sod.assertOverrideApproveSod(creatorId, claims.sub);

        const result = await client.platformCommercialOverride.updateMany({
          where: {
            id: overrideId,
            rowVersion: body.expectedRowVersion,
            lifecycle: 'PENDING_APPROVAL',
          },
          data: {
            lifecycle: 'REJECTED',
            rejectedByPlatformUserId: claims.sub,
            rejectedAt: new Date(),
            rejectionReason: body.reason.trim().slice(0, MAX_REASON_NOTE),
            rowVersion: { increment: 1 },
          },
        });
        if (result.count !== 1) throw new ConflictException('Stale version — reload and retry.');
        await this.maybeFail('after_reject_lifecycle');
        await this.maybeFail('before_reject_commit');
        if (claim) {
          await this.idempotency.completeInTransaction(client, {
            actorId: claims.sub,
            operation: 'override.reject',
            idempotencyKey: claim.idempotencyKey,
            requestHash: claim.requestHash,
            resultResourceType: 'override',
            resultResourceId: overrideId,
          });
        }
      });
      await this.safeAudit(claims, 'platform_override.rejected', overrideId, {
        reasonCode: 'rejection',
        result: 'success',
      });
      return this.getOverride(claims, overrideId);
    } catch (err) {
      const recovered = await this.recoverEquivalentReplay(
        claim,
        'override.reject',
        claims.sub,
        err,
        (id) => this.getOverride(claims, id),
      );
      if (recovered) return recovered;
      throw err;
    }
  }

  async revoke(
    claims: JwtClaimsVO,
    overrideId: string,
    body: { expectedRowVersion: number; reason: string },
    idempotencyKey?: string | null,
  ) {
    const permissions = await this.perms(claims);
    this.require(permissions, 'override.approve');
    this.enforceRateLimit(claims.sub, 'highImpact');
    await this.requireFreshStepUp(claims);
    if (!body.reason?.trim() || body.reason.trim().length < 3) {
      throw new BadRequestException('Reason is required.');
    }

    const requestHash = this.idempotency.fingerprint({
      overrideId,
      expectedRowVersion: body.expectedRowVersion,
      reason: body.reason.trim(),
    });
    let claim: { idempotencyKey: string; requestHash: string } | null = null;
    if (idempotencyKey?.trim()) {
      const gate = await this.idempotency.beginOrReplay({
        actorId: claims.sub,
        operation: 'override.revoke',
        idempotencyKey: idempotencyKey.trim(),
        requestHash,
      });
      if (gate.kind === 'replay') return this.getOverride(claims, gate.resultResourceId);
      claim = { idempotencyKey: gate.idempotencyKey, requestHash: gate.requestHash };
    }

    try {
      await this.prisma.withPlatformBypass(async (client) => {
        const existing = await client.platformCommercialOverride.findUnique({
          where: { id: overrideId },
        });
        if (!existing) throw new NotFoundException('Commercial override not found.');
        if (!canTransitionOverrideLifecycle(existing.lifecycle as never, 'REVOKED')) {
          throw new BadRequestException(`Cannot revoke from ${existing.lifecycle}.`);
        }
        const result = await client.platformCommercialOverride.updateMany({
          where: { id: overrideId, rowVersion: body.expectedRowVersion, lifecycle: 'APPROVED' },
          data: {
            lifecycle: 'REVOKED',
            revokedByPlatformUserId: claims.sub,
            revokedAt: new Date(),
            revocationReason: body.reason.trim().slice(0, MAX_REASON_NOTE),
            rowVersion: { increment: 1 },
          },
        });
        if (result.count !== 1) throw new ConflictException('Stale version — reload and retry.');
        await this.maybeFail('after_revoke_lifecycle');
        await this.maybeFail('before_revoke_commit');
        if (claim) {
          await this.idempotency.completeInTransaction(client, {
            actorId: claims.sub,
            operation: 'override.revoke',
            idempotencyKey: claim.idempotencyKey,
            requestHash: claim.requestHash,
            resultResourceType: 'override',
            resultResourceId: overrideId,
          });
        }
        await this.auditInTransaction(client, claims, 'platform_override.revoked', overrideId, {
          reasonCode: 'revocation',
          result: 'success',
          runtimeChanged: 'false',
        });
      });
      return this.getOverride(claims, overrideId);
    } catch (err) {
      const recovered = await this.recoverEquivalentReplay(
        claim,
        'override.revoke',
        claims.sub,
        err,
        (id) => this.getOverride(claims, id),
      );
      if (recovered) return recovered;
      throw err;
    }
  }

  async supersede(
    claims: JwtClaimsVO,
    overrideId: string,
    body: {
      reasonCode: string;
      reasonNote: string;
      effectiveFrom?: string | null;
      expiresAt?: string | null;
      effects: Array<{
        effectKind: string;
        catalogItemId: string;
        unlimited?: boolean;
        valueText?: string | null;
      }>;
    },
    idempotencyKey?: string | null,
  ) {
    const permissions = await this.perms(claims);
    this.require(permissions, 'override.request');
    this.enforceRateLimit(claims.sub, 'mutation');

    const requestHash = this.idempotency.fingerprint({ overrideId, ...body });
    let claim: { idempotencyKey: string; requestHash: string } | null = null;
    if (idempotencyKey?.trim()) {
      const gate = await this.idempotency.beginOrReplay({
        actorId: claims.sub,
        operation: 'override.supersede',
        idempotencyKey: idempotencyKey.trim(),
        requestHash,
      });
      if (gate.kind === 'replay') return this.getOverride(claims, gate.resultResourceId);
      claim = { idempotencyKey: gate.idempotencyKey, requestHash: gate.requestHash };
    }

    try {
      const predecessor = await this.getOverride(claims, overrideId);
      if (predecessor.lifecycle !== 'APPROVED' && predecessor.lifecycle !== 'REVOKED') {
        throw new BadRequestException('Only APPROVED or REVOKED overrides can be superseded.');
      }
      // Create successor Draft without nested idempotency (outer gate owns the key).
      // Failure injection for supersede families runs inside createOverride TX when predecessorId is set.
      // The durable success audit (Model A) is written inside createOverride's own
      // transaction using the 'superseded' action so it commits atomically with the
      // successor Draft insert — no separate post-commit audit call is needed here.
      const created = await this.createOverride(
        claims,
        { ...body, predecessorId: overrideId },
        null,
        {
          action: 'platform_override.superseded',
          details: {
            predecessorClassification: 'approved_or_revoked_predecessor',
            successorClassification: 'draft_successor',
            result: 'success',
          },
        },
      );
      if (claim) {
        await this.prisma.withPlatformBypass(async (client) => {
          await this.idempotency.completeInTransaction(client, {
            actorId: claims.sub,
            operation: 'override.supersede',
            idempotencyKey: claim!.idempotencyKey,
            requestHash: claim!.requestHash,
            resultResourceType: 'override',
            resultResourceId: created.id,
          });
        });
      }
      return created;
    } catch (err) {
      const recovered = await this.recoverEquivalentReplay(
        claim,
        'override.supersede',
        claims.sub,
        err,
        (id) => this.getOverride(claims, id),
      );
      if (recovered) return recovered;
      throw err;
    }
  }

  async compare(claims: JwtClaimsVO, leftId: string, rightId: string) {
    const permissions = await this.perms(claims);
    this.require(permissions, 'override.view');
    this.enforceRateLimit(claims.sub, 'readHeavy');
    const [left, right] = await Promise.all([
      this.getOverride(claims, leftId),
      this.getOverride(claims, rightId),
    ]);
    const leftKeys = new Set(left.effects.map((e) => `${e.effectKind}:${e.canonicalKey}`));
    const rightKeys = new Set(right.effects.map((e) => `${e.effectKind}:${e.canonicalKey}`));
    return {
      left: { id: left.id, lifecycle: left.lifecycle, fingerprint: left.compositionFingerprint },
      right: { id: right.id, lifecycle: right.lifecycle, fingerprint: right.compositionFingerprint },
      effectsAdded: [...rightKeys].filter((k) => !leftKeys.has(k)).sort(),
      effectsRemoved: [...leftKeys].filter((k) => !rightKeys.has(k)).sort(),
      runtimeEffective: false,
    };
  }
}
