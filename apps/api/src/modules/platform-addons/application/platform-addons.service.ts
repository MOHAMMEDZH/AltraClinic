/**
 * Release 47 Step 15 — Platform Add-ons service (commercial definition only).
 * Publish does not call the licensing engine resolve path or change tenant runtime.
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
import type { PlatformRefreshTokenRepository } from '../../auth/domain/repositories/platform-refresh-token.repository.interface';
import type { JwtClaimsVO } from '../../auth/domain/value-objects/jwt-claims.vo';
import { PLATFORM_REFRESH_TOKEN_REPOSITORY } from '../../auth/platform-auth.tokens';
import { PLATFORM_AUDIT_SENTINEL_TENANT_ID } from '../../platform-tenants/platform-tenants.tokens';
import {
  isValidAddOnKey,
  PLATFORM_ADDONS_AUDIT_LOG,
  PLATFORM_ADDONS_CONFIG,
  PLATFORM_ADDONS_TX_FAILURE_HOOK,
  type AddonTxFailureHook,
  type AddonTxFailurePoint,
  type AddOnLimitEffectType,
} from '../platform-addons.tokens';
import {
  canTransitionAddOnLifecycle,
  canTransitionAddOnVersionLifecycle,
  isAddOnVersionMutable,
} from '../domain/addon-lifecycle';
import { validateAddOnLimitEffect } from '../domain/limit-effect';
import { buildAddonPublicationFingerprint } from '../domain/publication-fingerprint';
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

const MAX_ENTITLEMENTS = 200;
const MAX_LIMIT_EFFECTS = 100;
const MAX_APPLICABILITY = 50;

@Injectable()
export class PlatformAddonsService {
  private readonly logger = new Logger(PlatformAddonsService.name);
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
    // Concurrent equivalent losers may hit OCC stale, unique-key, open-draft, or a
    // post-commit lifecycle read (winner already transitioned → BadRequest "Cannot … from").
    const recoverable =
      prismaUnique ||
      (err instanceof ConflictException &&
        (/Stale version/i.test(conflictMsg) ||
          /already exists/i.test(conflictMsg) ||
          /open Draft/i.test(conflictMsg))) ||
      (err instanceof BadRequestException &&
        /^Cannot (?:transition|publish|retire)\b/i.test(badRequestMsg));
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
      throw new HttpException('Add-ons rate limit exceeded.', HttpStatus.TOO_MANY_REQUESTS);
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
      descriptionEn: 'Platform add-on mutation',
      descriptionAr: 'تعديل إضافة المنصة',
      details,
      correlationId,
    });
  }

  private validateTranslations(
    translations: Array<{
      locale: string;
      displayName?: string;
      shortDescription?: string;
      releaseLabel?: string;
    }>,
    mode: 'addon' | 'version',
  ) {
    if (!translations?.length) throw new BadRequestException('Translations are required.');
    const locales = new Set<string>();
    for (const tr of translations) {
      if (tr.locale !== 'en-US' && tr.locale !== 'ar-SY') {
        throw new BadRequestException('Only en-US and ar-SY locales are supported.');
      }
      if (locales.has(tr.locale)) throw new BadRequestException('Duplicate locale.');
      locales.add(tr.locale);
      if (mode === 'addon') {
        if (!tr.displayName?.trim() || !tr.shortDescription?.trim()) {
          throw new BadRequestException('Add-on translation displayName and shortDescription required.');
        }
      } else if (!tr.releaseLabel?.trim() || !tr.shortDescription?.trim()) {
        throw new BadRequestException('Version translation releaseLabel and shortDescription required.');
      }
    }
    if (!locales.has('en-US') || !locales.has('ar-SY')) {
      throw new BadRequestException('Both en-US and ar-SY translations are required.');
    }
  }

  private toAddOnSummary(row: {
    id: string;
    canonicalKey: string;
    lifecycle: string;
    rowVersion: number;
    systemSeeded: boolean;
    createdAt: Date;
    updatedAt: Date;
    translations?: Array<{ locale: string; displayName: string; shortDescription: string }>;
  }) {
    return {
      id: row.id,
      canonicalKey: row.canonicalKey,
      lifecycle: row.lifecycle,
      rowVersion: row.rowVersion,
      systemSeeded: row.systemSeeded,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
      translations: (row.translations ?? []).map((t) => ({
        locale: t.locale,
        displayName: t.displayName,
        shortDescription: t.shortDescription,
      })),
    };
  }

  private toVersionDto(row: {
    id: string;
    addOnId: string;
    versionNumber: number;
    lifecycle: string;
    rowVersion: number;
    publishedAt: Date | null;
    publishedByPlatformUserId: string | null;
    publicationFingerprint: string | null;
    publicationReason: string | null;
    sourceVersionId: string | null;
    createdAt: Date;
    updatedAt: Date;
    translations?: Array<{ locale: string; releaseLabel: string; shortDescription: string }>;
  }) {
    return {
      id: row.id,
      addOnId: row.addOnId,
      versionNumber: row.versionNumber,
      lifecycle: row.lifecycle,
      rowVersion: row.rowVersion,
      publishedAt: row.publishedAt?.toISOString() ?? null,
      publishedByPlatformUserId: row.publishedByPlatformUserId,
      publicationFingerprint: row.publicationFingerprint,
      publicationReason: row.publicationReason,
      sourceVersionId: row.sourceVersionId,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
      translations: (row.translations ?? []).map((t) => ({
        locale: t.locale,
        releaseLabel: t.releaseLabel,
        shortDescription: t.shortDescription,
      })),
      runtimeEffective: false as const,
    };
  }

  async listAddOns(
    claims: JwtClaimsVO,
    query: { lifecycle?: string; search?: string; page?: string; pageSize?: string },
  ) {
    const permissions = await this.perms(claims);
    this.require(permissions, 'addon.view');
    const page = Math.max(1, Number(query.page ?? 1) || 1);
    const pageSize = Math.min(100, Math.max(1, Number(query.pageSize ?? 20) || 20));
    return this.prisma.withPlatformBypass(async (client) => {
      const where: Record<string, unknown> = {};
      if (query.lifecycle) where.lifecycle = query.lifecycle;
      if (query.search?.trim()) {
        where.OR = [
          { canonicalKey: { contains: query.search.trim(), mode: 'insensitive' } },
          {
            translations: {
              some: { displayName: { contains: query.search.trim(), mode: 'insensitive' } },
            },
          },
        ];
      }
      const [total, rows] = await Promise.all([
        client.platformAddOn.count({ where }),
        client.platformAddOn.findMany({
          where,
          include: { translations: true },
          orderBy: { canonicalKey: 'asc' },
          skip: (page - 1) * pageSize,
          take: pageSize,
        }),
      ]);
      return {
        items: rows.map((r) => this.toAddOnSummary(r)),
        page,
        pageSize,
        total,
        emptyCatalog: total === 0,
      };
    });
  }

  async createAddOn(
    claims: JwtClaimsVO,
    body: {
      canonicalKey: string;
      translations: Array<{ locale: string; displayName: string; shortDescription: string }>;
    },
    idempotencyKey?: string | null,
  ) {
    const permissions = await this.perms(claims);
    this.require(permissions, 'addon.manage');
    this.enforceRateLimit(claims.sub, 'mutation');
    const key = body.canonicalKey?.trim();
    if (!key || !isValidAddOnKey(key)) {
      throw new BadRequestException('canonicalKey must match addon.<snake_name>.');
    }
    this.validateTranslations(body.translations, 'addon');

    const requestHash = this.idempotency.fingerprint({
      canonicalKey: key,
      translations: body.translations,
    });
    let claim: { idempotencyKey: string; requestHash: string } | null = null;
    if (idempotencyKey?.trim()) {
      const gate = await this.idempotency.beginOrReplay({
        actorId: claims.sub,
        operation: 'addon.create',
        idempotencyKey: idempotencyKey.trim(),
        requestHash,
      });
      if (gate.kind === 'replay') return this.getAddOn(claims, gate.resultResourceId);
      claim = { idempotencyKey: gate.idempotencyKey, requestHash: gate.requestHash };
    }

    try {
      const created = await this.prisma.withPlatformBypass(async (client) => {
        const existing = await client.platformAddOn.findUnique({ where: { canonicalKey: key } });
        if (existing) throw new ConflictException('Add-on canonicalKey already exists.');
        const id = randomUUID();
        const row = await client.platformAddOn.create({
          data: {
            id,
            canonicalKey: key,
            lifecycle: 'DRAFT',
            systemSeeded: false,
            translations: {
              create: body.translations.map((t) => ({
                id: randomUUID(),
                locale: t.locale,
                displayName: t.displayName.trim(),
                shortDescription: t.shortDescription.trim(),
              })),
            },
          },
          include: { translations: true },
        });
        if (claim) {
          await this.idempotency.completeInTransaction(client, {
            actorId: claims.sub,
            operation: 'addon.create',
            idempotencyKey: claim.idempotencyKey,
            requestHash: claim.requestHash,
            resultResourceType: 'addOn',
            resultResourceId: row.id,
          });
        }
        await this.auditInTransaction(client, claims, 'platform_addon.created', row.id, {
          canonicalKey: key,
          result: 'success',
        });
        return row;
      });
      return this.toAddOnSummary(created);
    } catch (err) {
      const recovered = await this.recoverEquivalentReplay(
        claim,
        'addon.create',
        claims.sub,
        err,
        (id) => this.getAddOn(claims, id),
      );
      if (recovered) return recovered;
      throw err;
    }
  }

  async getAddOn(claims: JwtClaimsVO, addOnId: string) {
    const permissions = await this.perms(claims);
    this.require(permissions, 'addon.view');
    return this.prisma.withPlatformBypass(async (client) => {
      const row = await client.platformAddOn.findUnique({
        where: { id: addOnId },
        include: {
          translations: true,
          versions: { select: { id: true, versionNumber: true, lifecycle: true } },
        },
      });
      if (!row) throw new NotFoundException('Add-on not found.');
      return {
        ...this.toAddOnSummary(row),
        versions: row.versions,
        deferred: {
          subscriptionAssignment: 'unavailable_until_step_16',
          runtimeEffective: false,
        },
      };
    });
  }

  async updateAddOn(
    claims: JwtClaimsVO,
    addOnId: string,
    body: {
      expectedRowVersion: number;
      translations?: Array<{ locale: string; displayName: string; shortDescription: string }>;
    },
    idempotencyKey?: string | null,
  ) {
    const permissions = await this.perms(claims);
    this.require(permissions, 'addon.manage');
    this.enforceRateLimit(claims.sub, 'mutation');
    if (body.translations) this.validateTranslations(body.translations, 'addon');

    const requestHash = this.idempotency.fingerprint({
      addOnId,
      expectedRowVersion: body.expectedRowVersion,
      translations: body.translations ?? null,
    });
    let claim: { idempotencyKey: string; requestHash: string } | null = null;
    if (idempotencyKey?.trim()) {
      const gate = await this.idempotency.beginOrReplay({
        actorId: claims.sub,
        operation: 'addon.update',
        idempotencyKey: idempotencyKey.trim(),
        requestHash,
      });
      if (gate.kind === 'replay') return this.getAddOn(claims, gate.resultResourceId);
      claim = { idempotencyKey: gate.idempotencyKey, requestHash: gate.requestHash };
    }

    try {
      const updated = await this.prisma.withPlatformBypass(async (client) => {
        const existing = await client.platformAddOn.findUnique({ where: { id: addOnId } });
        if (!existing) throw new NotFoundException('Add-on not found.');
        if (existing.lifecycle === 'ARCHIVED') {
          throw new BadRequestException('Cannot edit archived Add-on.');
        }
        const result = await client.platformAddOn.updateMany({
          where: { id: addOnId, rowVersion: body.expectedRowVersion },
          data: { rowVersion: { increment: 1 } },
        });
        if (result.count !== 1) throw new ConflictException('Stale version — reload and retry.');
        if (body.translations) {
          await client.platformAddOnTranslation.deleteMany({ where: { addOnId } });
          await client.platformAddOnTranslation.createMany({
            data: body.translations.map((t) => ({
              id: randomUUID(),
              addOnId,
              locale: t.locale,
              displayName: t.displayName.trim(),
              shortDescription: t.shortDescription.trim(),
            })),
          });
        }
        if (claim) {
          await this.idempotency.completeInTransaction(client, {
            actorId: claims.sub,
            operation: 'addon.update',
            idempotencyKey: claim.idempotencyKey,
            requestHash: claim.requestHash,
            resultResourceType: 'addOn',
            resultResourceId: addOnId,
          });
        }
        const row = await client.platformAddOn.findUniqueOrThrow({
          where: { id: addOnId },
          include: { translations: true },
        });
        await this.auditInTransaction(client, claims, 'platform_addon.updated', addOnId, {
          expectedVersion: String(body.expectedRowVersion),
          resultingVersion: String(row.rowVersion),
          lifecycle: row.lifecycle,
          result: 'success',
        });
        return row;
      });
      return this.toAddOnSummary(updated);
    } catch (err) {
      const recovered = await this.recoverEquivalentReplay(
        claim,
        'addon.update',
        claims.sub,
        err,
        (id) => this.getAddOn(claims, id),
      );
      if (recovered) return recovered;
      throw err;
    }
  }

  async transitionAddOnLifecycle(
    claims: JwtClaimsVO,
    addOnId: string,
    to: 'ACTIVE' | 'ARCHIVED',
    body: { expectedRowVersion: number; reason: string },
    idempotencyKey?: string | null,
  ) {
    const permissions = await this.perms(claims);
    this.require(permissions, 'addon.manage');
    this.enforceRateLimit(claims.sub, 'highImpact');
    await this.requireFreshStepUp(claims);
    if (!body.reason?.trim() || body.reason.trim().length < 3) {
      throw new BadRequestException('Reason is required.');
    }

    const operation: AddonIdempotencyOperation =
      to === 'ARCHIVED' ? 'addon.archive' : 'addon.activate';
    const requestHash = this.idempotency.fingerprint({
      addOnId,
      to,
      expectedRowVersion: body.expectedRowVersion,
      reason: body.reason.trim(),
    });
    let claim: { idempotencyKey: string; requestHash: string } | null = null;
    if (idempotencyKey?.trim()) {
      const gate = await this.idempotency.beginOrReplay({
        actorId: claims.sub,
        operation,
        idempotencyKey: idempotencyKey.trim(),
        requestHash,
      });
      if (gate.kind === 'replay') return this.getAddOn(claims, gate.resultResourceId);
      claim = { idempotencyKey: gate.idempotencyKey, requestHash: gate.requestHash };
    }

    try {
      const row = await this.prisma.withPlatformBypass(async (client) => {
        const existing = await client.platformAddOn.findUnique({ where: { id: addOnId } });
        if (!existing) throw new NotFoundException('Add-on not found.');
        if (!canTransitionAddOnLifecycle(existing.lifecycle as never, to)) {
          throw new BadRequestException(`Cannot transition from ${existing.lifecycle} to ${to}.`);
        }
        const fromLifecycle = existing.lifecycle;
        const result = await client.platformAddOn.updateMany({
          where: { id: addOnId, rowVersion: body.expectedRowVersion },
          data: { lifecycle: to, rowVersion: { increment: 1 } },
        });
        if (result.count !== 1) throw new ConflictException('Stale version — reload and retry.');
        if (claim) {
          await this.idempotency.completeInTransaction(client, {
            actorId: claims.sub,
            operation,
            idempotencyKey: claim.idempotencyKey,
            requestHash: claim.requestHash,
            resultResourceType: 'addOn',
            resultResourceId: addOnId,
          });
        }
        const updated = await client.platformAddOn.findUniqueOrThrow({
          where: { id: addOnId },
          include: { translations: true },
        });
        const auditAction =
          to === 'ARCHIVED'
            ? 'platform_addon.archived'
            : fromLifecycle === 'ARCHIVED'
              ? 'platform_addon.reactivated'
              : 'platform_addon.activated';
        await this.auditInTransaction(client, claims, auditAction, addOnId, {
          lifecycleBefore: fromLifecycle,
          lifecycleAfter: to,
          expectedVersion: String(body.expectedRowVersion),
          resultingVersion: String(updated.rowVersion),
          reasonCode: 'lifecycle_transition',
          result: 'success',
        });
        return { updated, fromLifecycle };
      });
      return this.toAddOnSummary(row.updated);
    } catch (err) {
      const recovered = await this.recoverEquivalentReplay(
        claim,
        operation,
        claims.sub,
        err,
        (id) => this.getAddOn(claims, id),
      );
      if (recovered) return recovered;
      throw err;
    }
  }

  async listVersions(claims: JwtClaimsVO, addOnId: string) {
    const permissions = await this.perms(claims);
    this.require(permissions, 'addon.view');
    return this.prisma.withPlatformBypass(async (client) => {
      const addOn = await client.platformAddOn.findUnique({ where: { id: addOnId } });
      if (!addOn) throw new NotFoundException('Add-on not found.');
      const rows = await client.platformAddOnVersion.findMany({
        where: { addOnId },
        include: { translations: true },
        orderBy: { versionNumber: 'desc' },
      });
      return { items: rows.map((r) => this.toVersionDto(r)) };
    });
  }

  async createDraftVersion(
    claims: JwtClaimsVO,
    addOnId: string,
    body: {
      translations: Array<{ locale: string; releaseLabel: string; shortDescription: string }>;
    },
    idempotencyKey?: string | null,
  ) {
    const permissions = await this.perms(claims);
    this.require(permissions, 'addon.manage');
    this.enforceRateLimit(claims.sub, 'mutation');
    this.validateTranslations(body.translations, 'version');

    const requestHash = this.idempotency.fingerprint({ addOnId, translations: body.translations });
    let claim: { idempotencyKey: string; requestHash: string } | null = null;
    if (idempotencyKey?.trim()) {
      const gate = await this.idempotency.beginOrReplay({
        actorId: claims.sub,
        operation: 'addon.createDraftVersion',
        idempotencyKey: idempotencyKey.trim(),
        requestHash,
      });
      if (gate.kind === 'replay') return this.getVersion(claims, addOnId, gate.resultResourceId);
      claim = { idempotencyKey: gate.idempotencyKey, requestHash: gate.requestHash };
    }

    try {
      const created = await this.prisma.withPlatformBypass(async (client) => {
        const addOn = await client.platformAddOn.findUnique({ where: { id: addOnId } });
        if (!addOn) throw new NotFoundException('Add-on not found.');
        const openDraft = await client.platformAddOnVersion.findFirst({
          where: { addOnId, lifecycle: 'DRAFT' },
        });
        if (openDraft) throw new ConflictException('An open Draft Add-on Version already exists.');
        const max = await client.platformAddOnVersion.aggregate({
          where: { addOnId },
          _max: { versionNumber: true },
        });
        const versionNumber = (max._max.versionNumber ?? 0) + 1;
        const id = randomUUID();
        const row = await client.platformAddOnVersion.create({
          data: {
            id,
            addOnId,
            versionNumber,
            lifecycle: 'DRAFT',
            translations: {
              create: body.translations.map((t) => ({
                id: randomUUID(),
                locale: t.locale,
                releaseLabel: t.releaseLabel.trim(),
                shortDescription: t.shortDescription.trim(),
              })),
            },
          },
          include: { translations: true },
        });
        if (claim) {
          await this.idempotency.completeInTransaction(client, {
            actorId: claims.sub,
            operation: 'addon.createDraftVersion',
            idempotencyKey: claim.idempotencyKey,
            requestHash: claim.requestHash,
            resultResourceType: 'addOnVersion',
            resultResourceId: row.id,
          });
        }
        await this.auditInTransaction(client, claims, 'platform_addon_version.created', row.id, {
          addOnId,
          versionNumber: String(row.versionNumber),
          result: 'success',
        });
        return row;
      });
      return this.toVersionDto(created);
    } catch (err) {
      const recovered = await this.recoverEquivalentReplay(
        claim,
        'addon.createDraftVersion',
        claims.sub,
        err,
        (id) => this.getVersion(claims, addOnId, id),
      );
      if (recovered) return recovered;
      throw err;
    }
  }

  async getVersion(claims: JwtClaimsVO, addOnId: string, versionId: string) {
    const permissions = await this.perms(claims);
    this.require(permissions, 'addon.view');
    return this.prisma.withPlatformBypass(async (client) => {
      const row = await client.platformAddOnVersion.findFirst({
        where: { id: versionId, addOnId },
        include: {
          translations: true,
          entitlements: { include: { catalogItem: { select: { canonicalKey: true, kind: true } } } },
          limitEffects: { include: { catalogItem: { select: { canonicalKey: true } } } },
          applicability: true,
        },
      });
      if (!row) throw new NotFoundException('Add-on Version not found.');
      return {
        ...this.toVersionDto(row),
        entitlements: row.entitlements.map((e) => ({
          catalogItemId: e.catalogItemId,
          canonicalKey: e.catalogItem.canonicalKey,
          kind: e.catalogItem.kind,
        })),
        limitEffects: row.limitEffects.map((l) => ({
          catalogItemId: l.catalogItemId,
          canonicalKey: l.catalogItem.canonicalKey,
          effectType: l.effectType,
          unlimited: l.unlimited,
          valueText: l.valueText,
        })),
        applicability: row.applicability.map((a) => ({
          planCanonicalKey: a.planCanonicalKey,
        })),
      };
    });
  }

  async replaceEntitlements(
    claims: JwtClaimsVO,
    addOnId: string,
    versionId: string,
    body: { expectedRowVersion: number; catalogItemIds: string[] },
    idempotencyKey?: string | null,
  ) {
    const permissions = await this.perms(claims);
    this.require(permissions, 'addon.manage');
    this.enforceRateLimit(claims.sub, 'mutation');
    const ids = [...new Set(body.catalogItemIds ?? [])];
    if (ids.length > MAX_ENTITLEMENTS) {
      throw new BadRequestException(`At most ${MAX_ENTITLEMENTS} entitlements allowed.`);
    }

    const requestHash = this.idempotency.fingerprint({
      addOnId,
      versionId,
      expectedRowVersion: body.expectedRowVersion,
      catalogItemIds: [...ids].sort(),
    });
    let claim: { idempotencyKey: string; requestHash: string } | null = null;
    if (idempotencyKey?.trim()) {
      const gate = await this.idempotency.beginOrReplay({
        actorId: claims.sub,
        operation: 'addon.replaceEntitlements',
        idempotencyKey: idempotencyKey.trim(),
        requestHash,
      });
      if (gate.kind === 'replay') return this.getVersion(claims, addOnId, gate.resultResourceId);
      claim = { idempotencyKey: gate.idempotencyKey, requestHash: gate.requestHash };
    }

    try {
      await this.prisma.withPlatformBypass(async (client) => {
        const version = await client.platformAddOnVersion.findFirst({
          where: { id: versionId, addOnId },
        });
        if (!version) throw new NotFoundException('Add-on Version not found.');
        if (!isAddOnVersionMutable(version.lifecycle as never)) {
          throw new BadRequestException('Only Draft Add-on Versions are mutable.');
        }
        if (ids.length) {
          const items = await client.healthcareCatalogItem.findMany({
            where: { id: { in: ids } },
            select: { id: true, kind: true },
          });
          if (items.length !== ids.length) {
            throw new BadRequestException('One or more catalogItemIds are unknown.');
          }
          for (const item of items) {
            if (item.kind !== 'MODULE' && item.kind !== 'FEATURE') {
              throw new BadRequestException(
                `Add-on entitlements allow MODULE/FEATURE only (got ${item.kind}).`,
              );
            }
          }
        }
        await client.platformAddOnVersionEntitlement.deleteMany({ where: { addOnVersionId: versionId } });
        await this.maybeFail('after_entitlement_delete');
        if (ids.length) {
          const mid = Math.max(1, Math.ceil(ids.length / 2));
          const first = ids.slice(0, mid);
          const rest = ids.slice(mid);
          await client.platformAddOnVersionEntitlement.createMany({
            data: first.map((catalogItemId) => ({
              id: randomUUID(),
              addOnVersionId: versionId,
              catalogItemId,
            })),
          });
          await this.maybeFail('after_entitlement_partial_insert');
          if (rest.length) {
            await client.platformAddOnVersionEntitlement.createMany({
              data: rest.map((catalogItemId) => ({
                id: randomUUID(),
                addOnVersionId: versionId,
                catalogItemId,
              })),
            });
          }
        }
        const bumped = await client.platformAddOnVersion.updateMany({
          where: { id: versionId, rowVersion: body.expectedRowVersion, lifecycle: 'DRAFT' },
          data: { rowVersion: { increment: 1 } },
        });
        if (bumped.count !== 1) throw new ConflictException('Stale version — reload and retry.');
        await this.maybeFail('after_row_version_bump');
        if (claim) {
          await this.maybeFail('before_idempotency_complete');
          await this.idempotency.completeInTransaction(client, {
            actorId: claims.sub,
            operation: 'addon.replaceEntitlements',
            idempotencyKey: claim.idempotencyKey,
            requestHash: claim.requestHash,
            resultResourceType: 'addOnVersion',
            resultResourceId: versionId,
          });
        }
        await this.auditInTransaction(
          client,
          claims,
          'platform_addon_version.entitlements_replaced',
          versionId,
          { count: String(ids.length), result: 'success' },
        );
        await this.maybeFail('before_transaction_commit');
      });
      return this.getVersion(claims, addOnId, versionId);
    } catch (err) {
      const recovered = await this.recoverEquivalentReplay(
        claim,
        'addon.replaceEntitlements',
        claims.sub,
        err,
        (id) => this.getVersion(claims, addOnId, id),
      );
      if (recovered) return recovered;
      throw err;
    }
  }

  async replaceLimitEffects(
    claims: JwtClaimsVO,
    addOnId: string,
    versionId: string,
    body: {
      expectedRowVersion: number;
      effects: Array<{
        catalogItemId: string;
        effectType: AddOnLimitEffectType;
        unlimited?: boolean;
        valueText?: string | null;
      }>;
    },
    idempotencyKey?: string | null,
  ) {
    const permissions = await this.perms(claims);
    this.require(permissions, 'addon.manage');
    this.enforceRateLimit(claims.sub, 'mutation');
    const effects = body.effects ?? [];
    if (effects.length > MAX_LIMIT_EFFECTS) {
      throw new BadRequestException(`At most ${MAX_LIMIT_EFFECTS} limit effects allowed.`);
    }

    const requestHash = this.idempotency.fingerprint({
      addOnId,
      versionId,
      expectedRowVersion: body.expectedRowVersion,
      effects,
    });
    let claim: { idempotencyKey: string; requestHash: string } | null = null;
    if (idempotencyKey?.trim()) {
      const gate = await this.idempotency.beginOrReplay({
        actorId: claims.sub,
        operation: 'addon.replaceLimitEffects',
        idempotencyKey: idempotencyKey.trim(),
        requestHash,
      });
      if (gate.kind === 'replay') return this.getVersion(claims, addOnId, gate.resultResourceId);
      claim = { idempotencyKey: gate.idempotencyKey, requestHash: gate.requestHash };
    }

    try {
      await this.prisma.withPlatformBypass(async (client) => {
        const version = await client.platformAddOnVersion.findFirst({
          where: { id: versionId, addOnId },
        });
        if (!version) throw new NotFoundException('Add-on Version not found.');
        if (!isAddOnVersionMutable(version.lifecycle as never)) {
          throw new BadRequestException('Only Draft Add-on Versions are mutable.');
        }
        const catalogIds = effects.map((e) => e.catalogItemId);
        const items =
          catalogIds.length === 0
            ? []
            : await client.healthcareCatalogItem.findMany({
                where: { id: { in: catalogIds } },
                select: { id: true, kind: true, canonicalKey: true },
              });
        const byId = new Map(items.map((i) => [i.id, i]));
        for (const effect of effects) {
          const item = byId.get(effect.catalogItemId);
          const issues = validateAddOnLimitEffect(
            {
              canonicalKey: item?.canonicalKey ?? effect.catalogItemId,
              effectType: effect.effectType,
              unlimited: effect.unlimited === true,
              valueText: effect.valueText ?? null,
            },
            item?.kind,
          );
          if (issues.length) {
            throw new BadRequestException({
              code: 'limit_effect_invalid',
              issues,
            });
          }
        }
        await client.platformAddOnVersionLimitEffect.deleteMany({
          where: { addOnVersionId: versionId },
        });
        await this.maybeFail('after_limit_effect_delete');
        if (effects.length) {
          const mid = Math.max(1, Math.ceil(effects.length / 2));
          const first = effects.slice(0, mid);
          const rest = effects.slice(mid);
          await client.platformAddOnVersionLimitEffect.createMany({
            data: first.map((e) => ({
              id: randomUUID(),
              addOnVersionId: versionId,
              catalogItemId: e.catalogItemId,
              effectType: e.effectType,
              unlimited: e.effectType === 'SET_UNLIMITED' || e.unlimited === true,
              valueText: e.effectType === 'SET_UNLIMITED' ? null : (e.valueText ?? null),
            })),
          });
          await this.maybeFail('after_limit_effect_partial_insert');
          if (rest.length) {
            await client.platformAddOnVersionLimitEffect.createMany({
              data: rest.map((e) => ({
                id: randomUUID(),
                addOnVersionId: versionId,
                catalogItemId: e.catalogItemId,
                effectType: e.effectType,
                unlimited: e.effectType === 'SET_UNLIMITED' || e.unlimited === true,
                valueText: e.effectType === 'SET_UNLIMITED' ? null : (e.valueText ?? null),
              })),
            });
          }
        }
        const bumped = await client.platformAddOnVersion.updateMany({
          where: { id: versionId, rowVersion: body.expectedRowVersion, lifecycle: 'DRAFT' },
          data: { rowVersion: { increment: 1 } },
        });
        if (bumped.count !== 1) throw new ConflictException('Stale version — reload and retry.');
        await this.maybeFail('after_row_version_bump');
        if (claim) {
          await this.maybeFail('before_idempotency_complete');
          await this.idempotency.completeInTransaction(client, {
            actorId: claims.sub,
            operation: 'addon.replaceLimitEffects',
            idempotencyKey: claim.idempotencyKey,
            requestHash: claim.requestHash,
            resultResourceType: 'addOnVersion',
            resultResourceId: versionId,
          });
        }
        await this.auditInTransaction(
          client,
          claims,
          'platform_addon_version.limit_effects_replaced',
          versionId,
          { count: String(effects.length), result: 'success' },
        );
        await this.maybeFail('before_transaction_commit');
      });
      return this.getVersion(claims, addOnId, versionId);
    } catch (err) {
      const recovered = await this.recoverEquivalentReplay(
        claim,
        'addon.replaceLimitEffects',
        claims.sub,
        err,
        (id) => this.getVersion(claims, addOnId, id),
      );
      if (recovered) return recovered;
      throw err;
    }
  }

  async replaceApplicability(
    claims: JwtClaimsVO,
    addOnId: string,
    versionId: string,
    body: { expectedRowVersion: number; planCanonicalKeys: string[] },
    idempotencyKey?: string | null,
  ) {
    const permissions = await this.perms(claims);
    this.require(permissions, 'addon.manage');
    this.enforceRateLimit(claims.sub, 'mutation');
    const keys = [...new Set((body.planCanonicalKeys ?? []).map((k) => k.trim()).filter(Boolean))];
    if (keys.length > MAX_APPLICABILITY) {
      throw new BadRequestException(`At most ${MAX_APPLICABILITY} plan keys allowed.`);
    }

    const requestHash = this.idempotency.fingerprint({
      addOnId,
      versionId,
      expectedRowVersion: body.expectedRowVersion,
      planCanonicalKeys: [...keys].sort(),
    });
    let claim: { idempotencyKey: string; requestHash: string } | null = null;
    if (idempotencyKey?.trim()) {
      const gate = await this.idempotency.beginOrReplay({
        actorId: claims.sub,
        operation: 'addon.replaceApplicability',
        idempotencyKey: idempotencyKey.trim(),
        requestHash,
      });
      if (gate.kind === 'replay') return this.getVersion(claims, addOnId, gate.resultResourceId);
      claim = { idempotencyKey: gate.idempotencyKey, requestHash: gate.requestHash };
    }

    try {
      await this.prisma.withPlatformBypass(async (client) => {
        const version = await client.platformAddOnVersion.findFirst({
          where: { id: versionId, addOnId },
        });
        if (!version) throw new NotFoundException('Add-on Version not found.');
        if (!isAddOnVersionMutable(version.lifecycle as never)) {
          throw new BadRequestException('Only Draft Add-on Versions are mutable.');
        }
        if (keys.length) {
          const plans = await client.platformPlan.findMany({
            where: { canonicalKey: { in: keys } },
            select: { canonicalKey: true },
          });
          const found = new Set(plans.map((p) => p.canonicalKey));
          const missing = keys.filter((k) => !found.has(k));
          if (missing.length) {
            throw new BadRequestException({
              code: 'unknown_plan_keys',
              message: 'One or more planCanonicalKeys do not exist.',
              missing,
            });
          }
        }
        await client.platformAddOnVersionApplicability.deleteMany({
          where: { addOnVersionId: versionId },
        });
        await this.maybeFail('after_applicability_delete');
        if (keys.length) {
          const mid = Math.max(1, Math.ceil(keys.length / 2));
          const first = keys.slice(0, mid);
          const rest = keys.slice(mid);
          await client.platformAddOnVersionApplicability.createMany({
            data: first.map((planCanonicalKey) => ({
              id: randomUUID(),
              addOnVersionId: versionId,
              planCanonicalKey,
            })),
          });
          await this.maybeFail('after_applicability_partial_insert');
          if (rest.length) {
            await client.platformAddOnVersionApplicability.createMany({
              data: rest.map((planCanonicalKey) => ({
                id: randomUUID(),
                addOnVersionId: versionId,
                planCanonicalKey,
              })),
            });
          }
        }
        const bumped = await client.platformAddOnVersion.updateMany({
          where: { id: versionId, rowVersion: body.expectedRowVersion, lifecycle: 'DRAFT' },
          data: { rowVersion: { increment: 1 } },
        });
        if (bumped.count !== 1) throw new ConflictException('Stale version — reload and retry.');
        await this.maybeFail('after_row_version_bump');
        if (claim) {
          await this.maybeFail('before_idempotency_complete');
          await this.idempotency.completeInTransaction(client, {
            actorId: claims.sub,
            operation: 'addon.replaceApplicability',
            idempotencyKey: claim.idempotencyKey,
            requestHash: claim.requestHash,
            resultResourceType: 'addOnVersion',
            resultResourceId: versionId,
          });
        }
        await this.auditInTransaction(
          client,
          claims,
          'platform_addon_version.applicability_replaced',
          versionId,
          { count: String(keys.length), result: 'success' },
        );
        await this.maybeFail('before_transaction_commit');
      });
      return this.getVersion(claims, addOnId, versionId);
    } catch (err) {
      const recovered = await this.recoverEquivalentReplay(
        claim,
        'addon.replaceApplicability',
        claims.sub,
        err,
        (id) => this.getVersion(claims, addOnId, id),
      );
      if (recovered) return recovered;
      throw err;
    }
  }

  async getReadiness(claims: JwtClaimsVO, addOnId: string, versionId: string) {
    const permissions = await this.perms(claims);
    this.require(permissions, 'addon.view');
    this.enforceRateLimit(claims.sub, 'readHeavy');
    return this.prisma.withPlatformBypass(async (client) => {
      const addOn = await client.platformAddOn.findUnique({ where: { id: addOnId } });
      const version = await client.platformAddOnVersion.findFirst({
        where: { id: versionId, addOnId },
        include: {
          translations: true,
          entitlements: true,
          limitEffects: true,
          applicability: true,
        },
      });
      if (!addOn || !version) throw new NotFoundException('Add-on Version not found.');
      const blockers: Array<{ code: string; message: string }> = [];
      const locales = new Set(version.translations.map((t) => t.locale));
      if (!locales.has('en-US') || !locales.has('ar-SY')) {
        blockers.push({ code: 'translations_incomplete', message: 'Both en-US and ar-SY required.' });
      }
      const publicationReady = version.lifecycle === 'DRAFT' && blockers.length === 0;
      return {
        status: 'available' as const,
        reason: 'step_15_commercial_definition',
        translationReady: blockers.length === 0,
        entitlementCount: version.entitlements.length,
        limitEffectCount: version.limitEffects.length,
        applicabilityCount: version.applicability.length,
        publicationReady,
        blockers,
        runtimeEffective: false,
        emptyDefinitionAllowed: true,
      };
    });
  }

  async publishVersion(
    claims: JwtClaimsVO,
    addOnId: string,
    versionId: string,
    body: { expectedRowVersion: number; reason: string },
    idempotencyKey?: string | null,
  ) {
    const permissions = await this.perms(claims);
    this.require(permissions, 'addon.manage');
    this.enforceRateLimit(claims.sub, 'highImpact');
    await this.requireFreshStepUp(claims);
    if (!body.reason?.trim() || body.reason.trim().length < 3) {
      throw new BadRequestException('Reason is required.');
    }

    const requestHash = this.idempotency.fingerprint({
      addOnId,
      versionId,
      expectedRowVersion: body.expectedRowVersion,
      reason: body.reason.trim(),
    });
    let claim: { idempotencyKey: string; requestHash: string } | null = null;
    if (idempotencyKey?.trim()) {
      const gate = await this.idempotency.beginOrReplay({
        actorId: claims.sub,
        operation: 'addon.publishVersion',
        idempotencyKey: idempotencyKey.trim(),
        requestHash,
      });
      if (gate.kind === 'replay') return this.getVersion(claims, addOnId, gate.resultResourceId);
      claim = { idempotencyKey: gate.idempotencyKey, requestHash: gate.requestHash };
    }

    const readiness = await this.getReadiness(claims, addOnId, versionId);
    if (!readiness.publicationReady) {
      throw new BadRequestException({
        code: 'publication_not_ready',
        message: 'Publication readiness failed.',
        blockers: readiness.blockers,
      });
    }

    try {
      await this.prisma.withPlatformBypass(async (client) => {
        const addOn = await client.platformAddOn.findUniqueOrThrow({ where: { id: addOnId } });
        const existing = await client.platformAddOnVersion.findFirst({
          where: { id: versionId, addOnId },
          include: {
            translations: true,
            entitlements: { include: { catalogItem: true } },
            limitEffects: { include: { catalogItem: true } },
            applicability: true,
          },
        });
        if (!existing) throw new NotFoundException('Add-on Version not found.');
        if (!canTransitionAddOnVersionLifecycle(existing.lifecycle as never, 'PUBLISHED')) {
          throw new BadRequestException(`Cannot publish from ${existing.lifecycle}.`);
        }
        const fp = buildAddonPublicationFingerprint({
          addOnCanonicalKey: addOn.canonicalKey,
          versionNumber: existing.versionNumber,
          sourceVersionId: existing.sourceVersionId,
          translations: existing.translations.map((t) => ({
            locale: t.locale,
            releaseLabel: t.releaseLabel,
            shortDescription: t.shortDescription,
          })),
          entitlements: existing.entitlements.map((e) => ({
            canonicalKey: e.catalogItem.canonicalKey,
            kind: e.catalogItem.kind,
          })),
          limitEffects: existing.limitEffects.map((l) => ({
            canonicalKey: l.catalogItem.canonicalKey,
            effectType: l.effectType as AddOnLimitEffectType,
            unlimited: l.unlimited,
            valueText: l.valueText,
          })),
          applicabilityPlanKeys: existing.applicability.map((a) => a.planCanonicalKey),
        });
        await this.maybeFail('after_fingerprint_before_commit');
        const now = new Date();
        const result = await client.platformAddOnVersion.updateMany({
          where: { id: versionId, rowVersion: body.expectedRowVersion, lifecycle: 'DRAFT' },
          data: {
            lifecycle: 'PUBLISHED',
            publishedAt: now,
            publishedByPlatformUserId: claims.sub,
            publicationFingerprint: fp,
            publicationReason: body.reason.trim().slice(0, 500),
            rowVersion: { increment: 1 },
          },
        });
        if (result.count !== 1) throw new ConflictException('Stale version — reload and retry.');
        await this.maybeFail('after_publish_lifecycle_update');
        if (claim) {
          await this.maybeFail('before_idempotency_complete');
          await this.idempotency.completeInTransaction(client, {
            actorId: claims.sub,
            operation: 'addon.publishVersion',
            idempotencyKey: claim.idempotencyKey,
            requestHash: claim.requestHash,
            resultResourceType: 'addOnVersion',
            resultResourceId: versionId,
          });
        }
        await this.auditInTransaction(client, claims, 'platform_addon_version.published', versionId, {
          addOnId,
          fingerprint: fp,
          result: 'success',
          runtimeChanged: 'false',
        });
        await this.maybeFail('before_transaction_commit');
      });
      return this.getVersion(claims, addOnId, versionId);
    } catch (err) {
      const recovered = await this.recoverEquivalentReplay(
        claim,
        'addon.publishVersion',
        claims.sub,
        err,
        (id) => this.getVersion(claims, addOnId, id),
      );
      if (recovered) return recovered;
      throw err;
    }
  }

  async retireVersion(
    claims: JwtClaimsVO,
    addOnId: string,
    versionId: string,
    body: { expectedRowVersion: number; reason: string },
    idempotencyKey?: string | null,
  ) {
    const permissions = await this.perms(claims);
    this.require(permissions, 'addon.manage');
    this.enforceRateLimit(claims.sub, 'highImpact');
    await this.requireFreshStepUp(claims);
    if (!body.reason?.trim() || body.reason.trim().length < 3) {
      throw new BadRequestException('Reason is required.');
    }
    const reason = body.reason.trim();

    const requestHash = this.idempotency.fingerprint({
      addOnId,
      versionId,
      expectedRowVersion: body.expectedRowVersion,
      reason,
    });
    let claim: { idempotencyKey: string; requestHash: string } | null = null;
    if (idempotencyKey?.trim()) {
      const gate = await this.idempotency.beginOrReplay({
        actorId: claims.sub,
        operation: 'addon.retireVersion',
        idempotencyKey: idempotencyKey.trim(),
        requestHash,
      });
      if (gate.kind === 'replay') return this.getVersion(claims, addOnId, gate.resultResourceId);
      claim = { idempotencyKey: gate.idempotencyKey, requestHash: gate.requestHash };
    }

    try {
      await this.prisma.withPlatformBypass(async (client) => {
        const existing = await client.platformAddOnVersion.findFirst({
          where: { id: versionId, addOnId },
        });
        if (!existing) throw new NotFoundException('Add-on Version not found.');
        if (!canTransitionAddOnVersionLifecycle(existing.lifecycle as never, 'RETIRED')) {
          throw new BadRequestException(`Cannot retire from ${existing.lifecycle}.`);
        }
        const result = await client.platformAddOnVersion.updateMany({
          where: { id: versionId, rowVersion: body.expectedRowVersion },
          data: { lifecycle: 'RETIRED', rowVersion: { increment: 1 } },
        });
        if (result.count !== 1) throw new ConflictException('Stale version — reload and retry.');
        await this.maybeFail('after_retire_lifecycle_update');
        if (claim) {
          await this.maybeFail('before_idempotency_complete');
          await this.idempotency.completeInTransaction(client, {
            actorId: claims.sub,
            operation: 'addon.retireVersion',
            idempotencyKey: claim.idempotencyKey,
            requestHash: claim.requestHash,
            resultResourceType: 'addOnVersion',
            resultResourceId: versionId,
          });
        }
        await this.auditInTransaction(client, claims, 'platform_addon_version.retired', versionId, {
          addOnId,
          lifecycleBefore: 'PUBLISHED',
          lifecycleAfter: 'RETIRED',
          expectedVersion: String(body.expectedRowVersion),
          reasonCode: 'retirement',
          result: 'success',
          runtimeChanged: 'false',
        });
        await this.maybeFail('before_retire_commit');
      });
      return this.getVersion(claims, addOnId, versionId);
    } catch (err) {
      const recovered = await this.recoverEquivalentReplay(
        claim,
        'addon.retireVersion',
        claims.sub,
        err,
        (id) => this.getVersion(claims, addOnId, id),
      );
      if (recovered) return recovered;
      throw err;
    }
  }

  async cloneVersion(
    claims: JwtClaimsVO,
    addOnId: string,
    versionId: string,
    body: {
      translations?: Array<{ locale: string; releaseLabel: string; shortDescription: string }>;
    },
    idempotencyKey?: string | null,
  ) {
    const permissions = await this.perms(claims);
    this.require(permissions, 'addon.manage');
    this.enforceRateLimit(claims.sub, 'highImpact');

    const requestHash = this.idempotency.fingerprint({
      addOnId,
      versionId,
      translations: body.translations ?? null,
    });
    let claim: { idempotencyKey: string; requestHash: string } | null = null;
    if (idempotencyKey?.trim()) {
      const gate = await this.idempotency.beginOrReplay({
        actorId: claims.sub,
        operation: 'addon.cloneVersion',
        idempotencyKey: idempotencyKey.trim(),
        requestHash,
      });
      if (gate.kind === 'replay') return this.getVersion(claims, addOnId, gate.resultResourceId);
      claim = { idempotencyKey: gate.idempotencyKey, requestHash: gate.requestHash };
    }

    try {
      const cloned = await this.prisma.withPlatformBypass(async (client) => {
        const source = await client.platformAddOnVersion.findFirst({
          where: { id: versionId, addOnId },
          include: {
            translations: true,
            entitlements: true,
            limitEffects: true,
            applicability: true,
          },
        });
        if (!source) throw new NotFoundException('Add-on Version not found.');
        const openDraft = await client.platformAddOnVersion.findFirst({
          where: { addOnId, lifecycle: 'DRAFT' },
        });
        if (openDraft) throw new ConflictException('An open Draft Add-on Version already exists.');
        const max = await client.platformAddOnVersion.aggregate({
          where: { addOnId },
          _max: { versionNumber: true },
        });
        const versionNumber = (max._max.versionNumber ?? 0) + 1;
        const translations = body.translations?.length
          ? body.translations
          : source.translations.map((t) => ({
              locale: t.locale,
              releaseLabel: t.releaseLabel,
              shortDescription: t.shortDescription,
            }));
        this.validateTranslations(translations, 'version');
        const id = randomUUID();
        const row = await client.platformAddOnVersion.create({
          data: {
            id,
            addOnId,
            versionNumber,
            lifecycle: 'DRAFT',
            sourceVersionId: source.id,
            translations: {
              create: translations.map((t) => ({
                id: randomUUID(),
                locale: t.locale,
                releaseLabel: t.releaseLabel.trim(),
                shortDescription: t.shortDescription.trim(),
              })),
            },
          },
          include: { translations: true },
        });
        await this.maybeFail('after_clone_source_linkage');
        await this.maybeFail('after_clone_identity');
        await this.maybeFail('after_clone_translation_partial');
        if (source.entitlements.length) {
          const mid = Math.max(1, Math.ceil(source.entitlements.length / 2));
          const first = source.entitlements.slice(0, mid);
          const rest = source.entitlements.slice(mid);
          await client.platformAddOnVersionEntitlement.createMany({
            data: first.map((e) => ({
              id: randomUUID(),
              addOnVersionId: row.id,
              catalogItemId: e.catalogItemId,
            })),
          });
          await this.maybeFail('after_clone_entitlement_partial');
          if (rest.length) {
            await client.platformAddOnVersionEntitlement.createMany({
              data: rest.map((e) => ({
                id: randomUUID(),
                addOnVersionId: row.id,
                catalogItemId: e.catalogItemId,
              })),
            });
          }
        }
        if (source.limitEffects.length) {
          const mid = Math.max(1, Math.ceil(source.limitEffects.length / 2));
          const first = source.limitEffects.slice(0, mid);
          const rest = source.limitEffects.slice(mid);
          await client.platformAddOnVersionLimitEffect.createMany({
            data: first.map((l) => ({
              id: randomUUID(),
              addOnVersionId: row.id,
              catalogItemId: l.catalogItemId,
              effectType: l.effectType,
              unlimited: l.unlimited,
              valueText: l.valueText,
            })),
          });
          await this.maybeFail('after_clone_limit_partial');
          if (rest.length) {
            await client.platformAddOnVersionLimitEffect.createMany({
              data: rest.map((l) => ({
                id: randomUUID(),
                addOnVersionId: row.id,
                catalogItemId: l.catalogItemId,
                effectType: l.effectType,
                unlimited: l.unlimited,
                valueText: l.valueText,
              })),
            });
          }
        }
        if (source.applicability.length) {
          const mid = Math.max(1, Math.ceil(source.applicability.length / 2));
          const first = source.applicability.slice(0, mid);
          const rest = source.applicability.slice(mid);
          await client.platformAddOnVersionApplicability.createMany({
            data: first.map((a) => ({
              id: randomUUID(),
              addOnVersionId: row.id,
              planCanonicalKey: a.planCanonicalKey,
            })),
          });
          await this.maybeFail('after_clone_applicability_partial');
          if (rest.length) {
            await client.platformAddOnVersionApplicability.createMany({
              data: rest.map((a) => ({
                id: randomUUID(),
                addOnVersionId: row.id,
                planCanonicalKey: a.planCanonicalKey,
              })),
            });
          }
        }
        if (claim) {
          await this.maybeFail('before_idempotency_complete');
          await this.idempotency.completeInTransaction(client, {
            actorId: claims.sub,
            operation: 'addon.cloneVersion',
            idempotencyKey: claim.idempotencyKey,
            requestHash: claim.requestHash,
            resultResourceType: 'addOnVersion',
            resultResourceId: row.id,
          });
        }
        await this.auditInTransaction(client, claims, 'platform_addon_version.cloned', row.id, {
          sourceVersionId: versionId,
          result: 'success',
        });
        await this.maybeFail('before_transaction_commit');
        return row;
      });
      return this.getVersion(claims, addOnId, cloned.id);
    } catch (err) {
      const recovered = await this.recoverEquivalentReplay(
        claim,
        'addon.cloneVersion',
        claims.sub,
        err,
        (id) => this.getVersion(claims, addOnId, id),
      );
      if (recovered) return recovered;
      throw err;
    }
  }

  async compareVersions(claims: JwtClaimsVO, addOnId: string, leftId: string, rightId: string) {
    const permissions = await this.perms(claims);
    this.require(permissions, 'addon.view');
    this.enforceRateLimit(claims.sub, 'readHeavy');
    const [left, right] = await Promise.all([
      this.getVersion(claims, addOnId, leftId),
      this.getVersion(claims, addOnId, rightId),
    ]);
    const leftEnt = new Set(left.entitlements.map((e) => e.canonicalKey));
    const rightEnt = new Set(right.entitlements.map((e) => e.canonicalKey));
    return {
      left: { id: left.id, versionNumber: left.versionNumber, lifecycle: left.lifecycle },
      right: { id: right.id, versionNumber: right.versionNumber, lifecycle: right.lifecycle },
      entitlementsAdded: [...rightEnt].filter((k) => !leftEnt.has(k)).sort(),
      entitlementsRemoved: [...leftEnt].filter((k) => !rightEnt.has(k)).sort(),
      runtimeEffective: false,
    };
  }
}
