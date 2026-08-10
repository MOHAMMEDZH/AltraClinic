/**
 * Release 47 Step 13–14 — Platform Plans & Plan Versions service.
 * Step 13: commercial metadata SoR. Step 14: entitlement/Limit readiness, fingerprint v2, clone children.
 * Not a tenant runtime entitlement resolver. LicensingEngineService remains authoritative for runtime.
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
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../infrastructure/prisma.service';
import { PlatformAuthorizationService } from '../../auth/platform-rbac/platform-authorization.service';
import { PlatformAssuranceService } from '../../auth/application/services/platform-assurance.service';
import type { PlatformRefreshTokenRepository } from '../../auth/domain/repositories/platform-refresh-token.repository.interface';
import type { JwtClaimsVO } from '../../auth/domain/value-objects/jwt-claims.vo';
import { PLATFORM_REFRESH_TOKEN_REPOSITORY } from '../../auth/platform-auth.tokens';
import { PLATFORM_AUDIT_SENTINEL_TENANT_ID } from '../../platform-tenants/platform-tenants.tokens';
import { CorrelationContextService } from '../../observability/application/logging/correlation-context.service';
import { resolveOperationCorrelationId } from '../../platform-audit-center/application/operation-correlation';
import {
  isForbiddenPlanKey,
  isValidPlanKey,
  normalizeAliasValue,
  PLAN_ALIAS_NAMESPACES,
  PLATFORM_PLANS_CONFIG,
  PLATFORM_PLANS_TX_FAILURE_HOOK,
  type PlanTxFailureHook,
  type PlanTxFailurePoint,
} from '../platform-plans.tokens';
import { UNRESOLVED_PLAN_IDENTIFIERS } from '../domain/plan-seed.inventory';
import {
  canTransitionPlanLifecycle,
  canTransitionVersionLifecycle,
  isVersionMutable,
} from '../domain/plan-lifecycle';
import { buildPublicationFingerprintV2 } from '../domain/publication-fingerprint';
import {
  PlanIdempotencyService,
  IdempotencyEquivalentRaceLostError,
  IdempotencyEquivalentReplayTimeoutError,
  type PlanIdempotencyOperation,
} from './plan-idempotency.service';
import { PlanEntitlementsService } from './plan-entitlements.service';
import type { PlatformPlansAuditLog } from './ports/plan-audit-log.port';
import { PLATFORM_PLANS_AUDIT_LOG } from '../platform-plans.tokens';
import {
  loadPlatformPlansConfig,
  type PlatformPlansConfig,
} from '../config/platform-plans.config';

type RateBucket = 'mutation' | 'highImpact' | 'readHeavy';

@Injectable()
export class PlatformPlansService {
  private readonly logger = new Logger(PlatformPlansService.name);
  private readonly rateHits = new Map<string, number[]>();
  private readonly config: PlatformPlansConfig;

  constructor(
    private readonly prisma: PrismaService,
    private readonly authorization: PlatformAuthorizationService,
    @Inject(PLATFORM_PLANS_AUDIT_LOG)
    private readonly audit: PlatformPlansAuditLog,
    @Inject(PLATFORM_REFRESH_TOKEN_REPOSITORY)
    private readonly refreshRepo: PlatformRefreshTokenRepository,
    private readonly assurance: PlatformAssuranceService,
    private readonly idempotency: PlanIdempotencyService,
    private readonly entitlements: PlanEntitlementsService,
    @Optional() @Inject(PLATFORM_PLANS_CONFIG) config?: PlatformPlansConfig,
    @Optional() @Inject(PLATFORM_PLANS_TX_FAILURE_HOOK)
    private readonly failureHook?: PlanTxFailureHook,
    @Optional() private readonly correlation?: CorrelationContextService,
  ) {
    this.config = config ?? loadPlatformPlansConfig();
  }

  private async maybeFail(point: PlanTxFailurePoint): Promise<void> {
    if (!this.failureHook) return;
    await this.failureHook(point);
  }

  private async recoverEquivalentReplay<T>(
    claim: { idempotencyKey: string; requestHash: string } | null,
    operation: PlanIdempotencyOperation,
    actorId: string,
    err: unknown,
    load: (resultResourceId: string) => Promise<T>,
  ): Promise<T | null> {
    if (!claim) return null;
    if (err instanceof IdempotencyEquivalentRaceLostError) {
      return load(err.resultResourceId);
    }
    const msg = err instanceof ConflictException ? String(err.message) : '';
    const stale = err instanceof ConflictException && /Stale version/i.test(msg);
    if (!stale) return null;
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
      throw new HttpException('Plans rate limit exceeded.', HttpStatus.TOO_MANY_REQUESTS);
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
   * Step 21 Model A — durable SUCCESS audit. Appends the AuditEntry inside the
   * same `withPlatformBypass` transaction client as the business mutation it
   * documents, and intentionally does NOT swallow failures: if the audit write
   * fails, this throws and the whole transaction (including the mutation)
   * rolls back. There is no code path where a Plan/Plan Version mutation
   * succeeds without its durable audit evidence.
   */
  private async appendSuccessAudit(
    client: Prisma.TransactionClient,
    claims: JwtClaimsVO,
    action: string,
    resourceId: string,
    details: Record<string, string>,
  ): Promise<void> {
    await this.audit.recordInTransaction(client, {
      tenantId: PLATFORM_AUDIT_SENTINEL_TENANT_ID,
      action,
      resourceId,
      actorId: claims.sub,
      actorRoles: ['platform'],
      locale: null,
      descriptionEn: 'Platform plan mutation',
      descriptionAr: 'تعديل خطة المنصة',
      details,
      correlationId: resolveOperationCorrelationId({
        fromContext: this.correlation?.getCorrelationId?.() ?? null,
      }),
    });
  }

  private validateTranslations(
    translations: Array<{ locale: string; displayName?: string; shortDescription?: string; releaseLabel?: string }>,
    mode: 'plan' | 'version',
  ) {
    if (!translations?.length) throw new BadRequestException('Translations are required.');
    const locales = new Set<string>();
    for (const tr of translations) {
      if (tr.locale !== 'en-US' && tr.locale !== 'ar-SY') {
        throw new BadRequestException('Only en-US and ar-SY locales are supported.');
      }
      if (locales.has(tr.locale)) throw new BadRequestException('Duplicate locale.');
      locales.add(tr.locale);
      if (mode === 'plan') {
        if (!tr.displayName?.trim() || !tr.shortDescription?.trim()) {
          throw new BadRequestException('Plan translation displayName and shortDescription required.');
        }
      } else if (!tr.releaseLabel?.trim() || !tr.shortDescription?.trim()) {
        throw new BadRequestException('Version translation releaseLabel and shortDescription required.');
      }
    }
    if (!locales.has('en-US') || !locales.has('ar-SY')) {
      throw new BadRequestException('Both en-US and ar-SY translations are required.');
    }
  }

  private toPlanSummary(row: {
    id: string;
    canonicalKey: string;
    lifecycle: string;
    sortOrder: number;
    version: number;
    createdAt: Date;
    updatedAt: Date;
    translations: Array<{ locale: string; displayName: string; shortDescription: string }>;
    versions?: Array<{ versionNumber: number; lifecycle: string }>;
    legacyAssignmentCount?: number;
  }) {
    const en = row.translations.find((t) => t.locale === 'en-US');
    const versions = row.versions ?? [];
    const draft = versions.find((v) => v.lifecycle === 'DRAFT');
    const published = versions
      .filter((v) => v.lifecycle === 'PUBLISHED')
      .sort((a, b) => b.versionNumber - a.versionNumber)[0];
    return {
      id: row.id,
      canonicalKey: row.canonicalKey,
      lifecycle: row.lifecycle,
      sortOrder: row.sortOrder,
      displayName: en?.displayName ?? row.canonicalKey,
      translations: row.translations.map((t) => ({
        locale: t.locale,
        displayName: t.displayName,
        shortDescription: t.shortDescription,
      })),
      versionCount: versions.length,
      latestVersionNumber: versions.reduce((m, v) => Math.max(m, v.versionNumber), 0) || null,
      latestPublishedVersionNumber: published?.versionNumber ?? null,
      hasOpenDraft: Boolean(draft),
      legacyAssignmentCount: row.legacyAssignmentCount ?? null,
      planVersionSubscriberCount: {
        status: 'unavailable' as const,
        reason: 'no_plan_version_fk',
      },
      version: row.version,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  private toVersionDto(row: {
    id: string;
    planId: string;
    versionNumber: number;
    lifecycle: string;
    rowVersion: number;
    effectiveFrom: Date | null;
    retireAt: Date | null;
    trialDefaultEnabled: boolean | null;
    trialDefaultDays: number | null;
    priceAmountMinor: number | null;
    priceCurrency: string | null;
    billingInterval: string | null;
    billingIntervalCount: number | null;
    publishedAt: Date | null;
    publishedByPlatformUserId: string | null;
    publicationFingerprint: string | null;
    sourceVersionId: string | null;
    translations: Array<{ locale: string; releaseLabel: string; shortDescription: string }>;
  }) {
    const pricingPresent =
      row.priceAmountMinor != null && row.priceCurrency != null && row.billingInterval != null;
    return {
      id: row.id,
      planId: row.planId,
      versionNumber: row.versionNumber,
      lifecycle: row.lifecycle,
      rowVersion: row.rowVersion,
      effectiveFrom: row.effectiveFrom?.toISOString() ?? null,
      retireAt: row.retireAt?.toISOString() ?? null,
      trialDefault: {
        status: row.trialDefaultEnabled == null ? ('unavailable' as const) : ('present' as const),
        enabled: row.trialDefaultEnabled,
        days: row.trialDefaultDays,
      },
      pricing: {
        status: pricingPresent ? ('present' as const) : ('unavailable' as const),
        amountMinor: row.priceAmountMinor,
        currency: row.priceCurrency,
        billingInterval: row.billingInterval,
        billingIntervalCount: row.billingIntervalCount,
      },
      publishedAt: row.publishedAt?.toISOString() ?? null,
      publishedByPlatformUserId: row.publishedByPlatformUserId,
      publicationFingerprint: row.publicationFingerprint,
      sourceVersionId: row.sourceVersionId,
      translations: row.translations.map((t) => ({
        locale: t.locale,
        releaseLabel: t.releaseLabel,
        shortDescription: t.shortDescription,
      })),
      metadataReadiness: row.lifecycle === 'DRAFT' ? 'pending_check' : 'published_snapshot',
      entitlementReadiness: { status: 'unavailable' as const, reason: 'step_14_not_implemented' },
      subscriptionEligibility: false,
      runtimeEffective: false,
      immutable: row.lifecycle === 'PUBLISHED' || row.lifecycle === 'RETIRED',
    };
  }

  async listPlans(claims: JwtClaimsVO, query: { lifecycle?: string; search?: string; page?: string; pageSize?: string }) {
    const permissions = await this.perms(claims);
    this.require(permissions, 'plan.view');
    const page = Math.max(1, Number(query.page ?? 1) || 1);
    const pageSize = Math.min(50, Math.max(1, Number(query.pageSize ?? 20) || 20));
    const where: Prisma.PlatformPlanWhereInput = {};
    if (query.lifecycle) where.lifecycle = query.lifecycle as never;
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
    return this.prisma.withPlatformBypass(async (client) => {
      const [total, rows] = await Promise.all([
        client.platformPlan.count({ where }),
        client.platformPlan.findMany({
          where,
          include: { translations: true, versions: { select: { versionNumber: true, lifecycle: true } } },
          orderBy: [{ sortOrder: 'asc' }, { canonicalKey: 'asc' }],
          skip: (page - 1) * pageSize,
          take: pageSize,
        }),
      ]);
      const items = [];
      for (const row of rows) {
        const legacyAssignmentCount = await this.countLegacyAssignments(client, row.id);
        items.push(this.toPlanSummary({ ...row, legacyAssignmentCount }));
      }
      return { items, page, pageSize, total };
    });
  }

  async getPlan(claims: JwtClaimsVO, planId: string) {
    const permissions = await this.perms(claims);
    this.require(permissions, 'plan.view');
    return this.prisma.withPlatformBypass(async (client) => {
      const row = await client.platformPlan.findUnique({
        where: { id: planId },
        include: {
          translations: true,
          aliases: true,
          versions: { select: { versionNumber: true, lifecycle: true } },
        },
      });
      if (!row) throw new NotFoundException('Plan not found.');
      const legacyAssignmentCount = await this.countLegacyAssignments(client, row.id);
      return {
        ...this.toPlanSummary({ ...row, legacyAssignmentCount }),
        aliases: row.aliases.map((a) => ({
          id: a.id,
          sourceNamespace: a.sourceNamespace,
          aliasValue: a.aliasValue,
          lifecycle: a.lifecycle,
          migrationNote: a.migrationNote,
          version: a.version,
          retiredAt: a.retiredAt?.toISOString() ?? null,
        })),
        deferred: {
          entitlementsAndLimits: 'available',
          addOnsAndOverrides: 'available',
          subscriptionManagement: 'unavailable_until_step_16',
        },
      };
    });
  }

  private async countLegacyAssignments(
    client: Prisma.TransactionClient | PrismaService,
    planId: string,
  ): Promise<number> {
    const aliases = await (client as Prisma.TransactionClient).platformPlanAlias.findMany({
      where: { planId, lifecycle: 'ACTIVE', sourceNamespace: 'prisma_plan_enum' },
      select: { aliasValue: true },
    });
    if (!aliases.length) return 0;
    const enums = aliases.map((a) => a.aliasValue).filter((v) => ['LITE', 'PRO', 'ENTERPRISE'].includes(v));
    if (!enums.length) return 0;
    return (client as Prisma.TransactionClient).platformTenant.count({
      where: { plan: { in: enums as never[] } },
    });
  }

  async createPlan(
    claims: JwtClaimsVO,
    body: {
      canonicalKey: string;
      sortOrder?: number;
      translations: Array<{ locale: string; displayName: string; shortDescription: string }>;
    },
    idempotencyKey?: string | null,
  ) {
    const permissions = await this.perms(claims);
    this.require(permissions, 'plan.create');
    this.enforceRateLimit(claims.sub, 'mutation');
    if (!isValidPlanKey(body.canonicalKey)) {
      throw new BadRequestException('Invalid Plan canonical key.');
    }
    if (isForbiddenPlanKey(body.canonicalKey)) {
      throw new BadRequestException(
        'Canonical key is reserved — unresolved non-Plan commercial identifier.',
      );
    }
    this.validateTranslations(body.translations, 'plan');

    const fingerprint = this.idempotency.fingerprint({
      canonicalKey: body.canonicalKey.trim(),
      sortOrder: body.sortOrder ?? 0,
      translations: body.translations.map((t) => ({
        locale: t.locale,
        displayName: t.displayName.trim(),
        shortDescription: t.shortDescription.trim(),
      })),
    });
    let pending: { idempotencyKey: string; requestHash: string } | null = null;
    if (idempotencyKey?.trim()) {
      const gate = await this.idempotency.beginOrReplay({
        actorId: claims.sub,
        operation: 'plan.create',
        idempotencyKey: idempotencyKey.trim(),
        requestHash: fingerprint,
      });
      if (gate.kind === 'replay') return this.getPlan(claims, gate.resultResourceId);
      pending = { idempotencyKey: gate.idempotencyKey, requestHash: gate.requestHash };
    }

    try {
      const created = await this.prisma.withPlatformBypass(async (client) => {
        const row = await client.platformPlan.create({
          data: {
            canonicalKey: body.canonicalKey.trim(),
            lifecycle: 'DRAFT',
            sortOrder: body.sortOrder ?? 0,
            translations: {
              create: body.translations.map((t) => ({
                locale: t.locale,
                displayName: t.displayName.trim().slice(0, 200),
                shortDescription: t.shortDescription.trim().slice(0, 500),
              })),
            },
          },
          include: { translations: true, versions: true },
        });
        if (pending) {
          await this.idempotency.completeInTransaction(client, {
            actorId: claims.sub,
            operation: 'plan.create',
            idempotencyKey: pending.idempotencyKey,
            requestHash: pending.requestHash,
            resultResourceType: 'plan',
            resultResourceId: row.id,
          });
        }
        await this.appendSuccessAudit(client, claims, 'platform_plan.created', row.id, {
          canonicalKey: row.canonicalKey,
          result: 'success',
        });
        return row;
      });
      return this.toPlanSummary(created);
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw new ConflictException('Plan canonical key already exists.');
      }
      throw err;
    }
  }

  async updatePlan(
    claims: JwtClaimsVO,
    planId: string,
    body: {
      expectedVersion: number;
      sortOrder?: number;
      translations?: Array<{ locale: string; displayName: string; shortDescription: string }>;
    },
  ) {
    const permissions = await this.perms(claims);
    this.require(permissions, 'plan.edit');
    this.enforceRateLimit(claims.sub, 'mutation');
    if (body.translations) this.validateTranslations(body.translations, 'plan');

    const updated = await this.prisma.withPlatformBypass(async (client) => {
      const existing = await client.platformPlan.findUnique({ where: { id: planId } });
      if (!existing) throw new NotFoundException('Plan not found.');
      const result = await client.platformPlan.updateMany({
        where: { id: planId, version: body.expectedVersion },
        data: {
          sortOrder: body.sortOrder ?? undefined,
          version: { increment: 1 },
        },
      });
      if (result.count !== 1) throw new ConflictException('Stale version — reload and retry.');
      if (body.translations) {
        for (const tr of body.translations) {
          await client.platformPlanTranslation.upsert({
            where: { planId_locale: { planId, locale: tr.locale } },
            create: {
              planId,
              locale: tr.locale,
              displayName: tr.displayName.trim().slice(0, 200),
              shortDescription: tr.shortDescription.trim().slice(0, 500),
            },
            update: {
              displayName: tr.displayName.trim().slice(0, 200),
              shortDescription: tr.shortDescription.trim().slice(0, 500),
            },
          });
        }
      }
      const row = await client.platformPlan.findUniqueOrThrow({
        where: { id: planId },
        include: { translations: true, versions: true },
      });
      await this.appendSuccessAudit(client, claims, 'platform_plan.updated', planId, {
        canonicalKey: row.canonicalKey,
        fields: body.translations ? 'translations,metadata' : 'metadata',
        expectedVersion: String(body.expectedVersion),
        resultingVersion: String(row.version),
        result: 'success',
      });
      return row;
    });
    return this.toPlanSummary(updated);
  }

  async transitionPlanLifecycle(
    claims: JwtClaimsVO,
    planId: string,
    to: 'ACTIVE' | 'ARCHIVED',
    body: { expectedVersion: number; reason: string },
  ) {
    const permissions = await this.perms(claims);
    this.require(permissions, 'plan.lifecycle');
    this.enforceRateLimit(claims.sub, 'highImpact');
    await this.requireFreshStepUp(claims);
    if (!body.reason?.trim() || body.reason.trim().length < 3) {
      throw new BadRequestException('Reason is required.');
    }

    const updated = await this.prisma.withPlatformBypass(async (client) => {
      const existing = await client.platformPlan.findUnique({ where: { id: planId } });
      if (!existing) throw new NotFoundException('Plan not found.');
      const fromLifecycle = existing.lifecycle;
      if (!canTransitionPlanLifecycle(existing.lifecycle as never, to)) {
        throw new BadRequestException(`Plan transition ${existing.lifecycle} → ${to} not allowed.`);
      }
      const result = await client.platformPlan.updateMany({
        where: { id: planId, version: body.expectedVersion },
        data: { lifecycle: to, version: { increment: 1 } },
      });
      if (result.count !== 1) throw new ConflictException('Stale version — reload and retry.');
      const row = await client.platformPlan.findUniqueOrThrow({
        where: { id: planId },
        include: { translations: true, versions: true },
      });
      const action =
        to === 'ARCHIVED'
          ? 'platform_plan.archived'
          : fromLifecycle === 'ARCHIVED'
            ? 'platform_plan.reactivated'
            : 'platform_plan.activated';
      await this.appendSuccessAudit(client, claims, action, planId, {
        canonicalKey: row.canonicalKey,
        from: String(fromLifecycle),
        to,
        expectedVersion: String(body.expectedVersion),
        resultingVersion: String(row.version),
        result: 'success',
      });
      return row;
    });
    return this.toPlanSummary(updated);
  }

  async addAlias(
    claims: JwtClaimsVO,
    planId: string,
    body: {
      aliasValue: string;
      sourceNamespace: string;
      migrationNote?: string;
      expectedVersion: number;
      idempotencyKey?: string;
    },
  ) {
    const permissions = await this.perms(claims);
    this.require(permissions, 'plan.alias.manage');
    if (!(PLAN_ALIAS_NAMESPACES as readonly string[]).includes(body.sourceNamespace)) {
      throw new BadRequestException('Unknown alias namespace.');
    }
    const aliasValue = body.aliasValue?.trim();
    if (!aliasValue || aliasValue.length > 128) throw new BadRequestException('Invalid alias value.');
    const normalized = normalizeAliasValue(aliasValue);
    if (
      normalized === 'business' ||
      UNRESOLVED_PLAN_IDENTIFIERS.some((u) => normalizeAliasValue(u.value) === normalized)
    ) {
      throw new BadRequestException(
        'Alias value is an unresolved non-Plan commercial identifier and cannot be mapped.',
      );
    }
    this.enforceRateLimit(claims.sub, 'mutation');

    const fingerprint = this.idempotency.fingerprint({
      planId,
      aliasValue,
      sourceNamespace: body.sourceNamespace,
    });
    let pending: { idempotencyKey: string; requestHash: string } | null = null;
    if (body.idempotencyKey?.trim()) {
      const gate = await this.idempotency.beginOrReplay({
        actorId: claims.sub,
        operation: 'plan.createAlias',
        idempotencyKey: body.idempotencyKey.trim(),
        requestHash: fingerprint,
      });
      if (gate.kind === 'replay') return this.getPlan(claims, planId);
      pending = { idempotencyKey: gate.idempotencyKey, requestHash: gate.requestHash };
    }

    try {
      await this.prisma.withPlatformBypass(async (client) => {
        const plan = await client.platformPlan.findUnique({ where: { id: planId } });
        if (!plan) throw new NotFoundException('Plan not found.');
        if (normalizeAliasValue(plan.canonicalKey) === normalized) {
          throw new ConflictException('Alias cannot collide with the canonical Plan key.');
        }
        const bumped = await client.platformPlan.updateMany({
          where: { id: planId, version: body.expectedVersion },
          data: { version: { increment: 1 } },
        });
        if (bumped.count !== 1) throw new ConflictException('Stale version — reload and retry.');
        const alias = await client.platformPlanAlias.create({
          data: {
            planId,
            aliasValue,
            normalizedValue: normalized,
            sourceNamespace: body.sourceNamespace,
            lifecycle: 'ACTIVE',
            migrationNote: body.migrationNote?.trim().slice(0, 500) ?? null,
          },
        });
        if (pending) {
          await this.idempotency.completeInTransaction(client, {
            actorId: claims.sub,
            operation: 'plan.createAlias',
            idempotencyKey: pending.idempotencyKey,
            requestHash: pending.requestHash,
            resultResourceType: 'planAlias',
            resultResourceId: alias.id,
          });
        }
        await this.appendSuccessAudit(client, claims, 'platform_plan.alias.added', planId, {
          aliasNamespace: body.sourceNamespace,
          result: 'success',
        });
      });
      return this.getPlan(claims, planId);
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw new ConflictException('Alias already exists in this namespace.');
      }
      throw err;
    }
  }

  async retireAlias(
    claims: JwtClaimsVO,
    planId: string,
    aliasId: string,
    body: { expectedVersion: number; reason: string },
  ) {
    const permissions = await this.perms(claims);
    this.require(permissions, 'plan.alias.manage');
    if (!body.reason?.trim() || body.reason.trim().length < 3) {
      throw new BadRequestException('Reason is required.');
    }

    await this.prisma.withPlatformBypass(async (client) => {
      const alias = await client.platformPlanAlias.findFirst({
        where: { id: aliasId, planId },
      });
      if (!alias) throw new NotFoundException('Alias not found.');
      if (alias.lifecycle === 'RETIRED') {
        await this.appendSuccessAudit(client, claims, 'platform_plan.alias.retired', planId, {
          result: 'success',
        });
        return;
      }
      if (alias.sourceNamespace === 'prisma_plan_enum') {
        const usage = await this.countLegacyAssignments(client, planId);
        if (usage > 0) await this.requireFreshStepUp(claims);
      }
      const bumped = await client.platformPlan.updateMany({
        where: { id: planId, version: body.expectedVersion },
        data: { version: { increment: 1 } },
      });
      if (bumped.count !== 1) throw new ConflictException('Stale version — reload and retry.');
      await client.platformPlanAlias.update({
        where: { id: aliasId },
        data: {
          lifecycle: 'RETIRED',
          retiredAt: new Date(),
          version: { increment: 1 },
          migrationNote: body.reason.trim().slice(0, 500),
        },
      });
      await this.appendSuccessAudit(client, claims, 'platform_plan.alias.retired', planId, {
        result: 'success',
      });
    });
    return this.getPlan(claims, planId);
  }

  async listVersions(claims: JwtClaimsVO, planId: string) {
    const permissions = await this.perms(claims);
    this.require(permissions, 'plan-version.view');
    return this.prisma.withPlatformBypass(async (client) => {
      const plan = await client.platformPlan.findUnique({ where: { id: planId } });
      if (!plan) throw new NotFoundException('Plan not found.');
      const rows = await client.platformPlanVersion.findMany({
        where: { planId },
        include: { translations: true },
        orderBy: { versionNumber: 'desc' },
      });
      return { items: rows.map((r) => this.toVersionDto(r)) };
    });
  }

  async getVersion(claims: JwtClaimsVO, planId: string, versionId: string) {
    const permissions = await this.perms(claims);
    this.require(permissions, 'plan-version.view');
    return this.prisma.withPlatformBypass(async (client) => {
      const row = await client.platformPlanVersion.findFirst({
        where: { id: versionId, planId },
        include: { translations: true },
      });
      if (!row) throw new NotFoundException('Plan Version not found.');
      return this.toVersionDto(row);
    });
  }

  async createDraftVersion(
    claims: JwtClaimsVO,
    planId: string,
    body: {
      translations: Array<{ locale: string; releaseLabel: string; shortDescription: string }>;
      effectiveFrom?: string | null;
      trialDefaultEnabled?: boolean | null;
      trialDefaultDays?: number | null;
    },
    idempotencyKey?: string | null,
  ) {
    const permissions = await this.perms(claims);
    this.require(permissions, 'plan-version.create');
    this.enforceRateLimit(claims.sub, 'mutation');
    this.validateTranslations(body.translations, 'version');
    if (body.trialDefaultDays != null && body.trialDefaultDays < 0) {
      throw new BadRequestException('Trial days cannot be negative.');
    }

    const fingerprint = this.idempotency.fingerprint({
      planId,
      translations: body.translations,
      effectiveFrom: body.effectiveFrom ?? null,
      trialDefaultEnabled: body.trialDefaultEnabled ?? null,
      trialDefaultDays: body.trialDefaultDays ?? null,
    });
    let pending: { idempotencyKey: string; requestHash: string } | null = null;
    if (idempotencyKey?.trim()) {
      const gate = await this.idempotency.beginOrReplay({
        actorId: claims.sub,
        operation: 'plan.createDraftVersion',
        idempotencyKey: idempotencyKey.trim(),
        requestHash: fingerprint,
      });
      if (gate.kind === 'replay') return this.getVersion(claims, planId, gate.resultResourceId);
      pending = { idempotencyKey: gate.idempotencyKey, requestHash: gate.requestHash };
    }

    try {
      const created = await this.prisma.withPlatformBypass(async (client) => {
        const plan = await client.platformPlan.findUnique({ where: { id: planId } });
        if (!plan) throw new NotFoundException('Plan not found.');
        if (plan.lifecycle === 'ARCHIVED') {
          throw new BadRequestException('Archived Plan cannot accept new Draft versions.');
        }
        const agg = await client.platformPlanVersion.aggregate({
          where: { planId },
          _max: { versionNumber: true },
        });
        const versionNumber = (agg._max.versionNumber ?? 0) + 1;
        const row = await client.platformPlanVersion.create({
          data: {
            planId,
            versionNumber,
            lifecycle: 'DRAFT',
            // Administrator-created Drafts are never seed-owned, including intentionally empty.
            commercialDefinitionOwnership: 'ADMINISTRATOR_OWNED',
            effectiveFrom: body.effectiveFrom ? new Date(body.effectiveFrom) : null,
            trialDefaultEnabled: body.trialDefaultEnabled ?? null,
            trialDefaultDays: body.trialDefaultDays ?? null,
            translations: {
              create: body.translations.map((t) => ({
                locale: t.locale,
                releaseLabel: t.releaseLabel.trim().slice(0, 200),
                shortDescription: t.shortDescription.trim().slice(0, 500),
              })),
            },
          },
          include: { translations: true },
        });
        if (pending) {
          await this.idempotency.completeInTransaction(client, {
            actorId: claims.sub,
            operation: 'plan.createDraftVersion',
            idempotencyKey: pending.idempotencyKey,
            requestHash: pending.requestHash,
            resultResourceType: 'planVersion',
            resultResourceId: row.id,
          });
        }
        await this.appendSuccessAudit(client, claims, 'platform_plan_version.created', row.id, {
          planId,
          versionNumber: String(row.versionNumber),
          result: 'success',
        });
        return row;
      });
      return this.toVersionDto(created);
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw new ConflictException('Open Draft already exists for this Plan, or version number conflict.');
      }
      throw err;
    }
  }

  async updateDraftVersion(
    claims: JwtClaimsVO,
    planId: string,
    versionId: string,
    body: {
      expectedRowVersion: number;
      translations?: Array<{ locale: string; releaseLabel: string; shortDescription: string }>;
      effectiveFrom?: string | null;
      trialDefaultEnabled?: boolean | null;
      trialDefaultDays?: number | null;
      internalReleaseNotes?: string | null;
    },
  ) {
    const permissions = await this.perms(claims);
    this.require(permissions, 'plan-version.create');
    if (body.translations) this.validateTranslations(body.translations, 'version');

    const updated = await this.prisma.withPlatformBypass(async (client) => {
      const existing = await client.platformPlanVersion.findFirst({
        where: { id: versionId, planId },
      });
      if (!existing) throw new NotFoundException('Plan Version not found.');
      if (!isVersionMutable(existing.lifecycle as never)) {
        throw new ConflictException('Published and Retired Plan Versions are immutable.');
      }
      const result = await client.platformPlanVersion.updateMany({
        where: { id: versionId, rowVersion: body.expectedRowVersion, lifecycle: 'DRAFT' },
        data: {
          effectiveFrom:
            body.effectiveFrom === undefined
              ? undefined
              : body.effectiveFrom
                ? new Date(body.effectiveFrom)
                : null,
          trialDefaultEnabled:
            body.trialDefaultEnabled === undefined ? undefined : body.trialDefaultEnabled,
          trialDefaultDays: body.trialDefaultDays === undefined ? undefined : body.trialDefaultDays,
          internalReleaseNotes:
            body.internalReleaseNotes === undefined
              ? undefined
              : body.internalReleaseNotes?.slice(0, 2000) ?? null,
          rowVersion: { increment: 1 },
        },
      });
      if (result.count !== 1) throw new ConflictException('Stale version — reload and retry.');
      if (body.translations) {
        for (const tr of body.translations) {
          await client.platformPlanVersionTranslation.upsert({
            where: { planVersionId_locale: { planVersionId: versionId, locale: tr.locale } },
            create: {
              planVersionId: versionId,
              locale: tr.locale,
              releaseLabel: tr.releaseLabel.trim().slice(0, 200),
              shortDescription: tr.shortDescription.trim().slice(0, 500),
            },
            update: {
              releaseLabel: tr.releaseLabel.trim().slice(0, 200),
              shortDescription: tr.shortDescription.trim().slice(0, 500),
            },
          });
        }
      }
      const row = await client.platformPlanVersion.findUniqueOrThrow({
        where: { id: versionId },
        include: { translations: true },
      });
      await this.appendSuccessAudit(client, claims, 'platform_plan_version.updated', versionId, {
        planId,
        fields: body.translations ? 'translations,metadata' : 'metadata',
        expectedVersion: String(body.expectedRowVersion),
        resultingVersion: String(row.rowVersion),
        result: 'success',
      });
      return row;
    });
    return this.toVersionDto(updated);
  }

  async getReadiness(
    claims: JwtClaimsVO,
    planId: string,
    versionId: string,
    options?: { skipRateLimit?: boolean },
  ) {
    const permissions = await this.perms(claims);
    this.require(permissions, 'plan-version.review');
    if (!options?.skipRateLimit) {
      this.enforceRateLimit(claims.sub, 'readHeavy');
    }
    return this.prisma.withPlatformBypass(async (client) => {
      const plan = await client.platformPlan.findUnique({ where: { id: planId } });
      const version = await client.platformPlanVersion.findFirst({
        where: { id: versionId, planId },
        include: { translations: true },
      });
      if (!plan || !version) throw new NotFoundException('Plan Version not found.');

      if (version.lifecycle !== 'DRAFT') {
        const entitlementCount = await client.platformPlanVersionEntitlement.count({
          where: { planVersionId: versionId },
        });
        const limitCount = await client.platformPlanVersionLimit.count({
          where: { planVersionId: versionId },
        });
        const legacyUnconfigured = entitlementCount === 0 && limitCount === 0;
        return {
          metadataReady: true,
          translationReady: true,
          entitlementReady: !legacyUnconfigured,
          dependencyReady: !legacyUnconfigured,
          compatibilityReady: !legacyUnconfigured,
          limitReady: !legacyUnconfigured,
          catalogLifecycleReady: true,
          entitlementReadiness: legacyUnconfigured
            ? { status: 'LEGACY_UNCONFIGURED', reason: 'metadata_only_publication' }
            : { status: 'immutable_snapshot', reason: 'published_or_retired' },
          addonReadiness: { status: 'available', reason: 'step_15_commercial_definition' },
          overrideReadiness: { status: 'available', reason: 'step_15_commercial_definition' },
          subscriptionEligibility: false,
          runtimeEffective: false,
          publicationReady: false,
          blockers: legacyUnconfigured
            ? [
                {
                  code: 'legacy_unconfigured_entitlements',
                  message:
                    'This Published version has no Step 14 entitlement/Limit snapshot. Clone to a new Draft to configure entitlements and Limits.',
                  category: 'entitlement',
                },
              ]
            : [],
          warnings: [
            {
              code: 'immutable_version',
              message: 'Published and Retired versions are immutable commercial snapshots.',
              category: 'metadata',
            },
          ],
        };
      }

      const readiness = await this.entitlements.computeCommercialReadiness(client, plan, version);
      return readiness;
    });
  }

  async publishVersion(
    claims: JwtClaimsVO,
    planId: string,
    versionId: string,
    body: { expectedRowVersion: number; reason: string },
    idempotencyKey?: string | null,
  ) {
    const permissions = await this.perms(claims);
    this.require(permissions, 'plan-version.publish');
    this.enforceRateLimit(claims.sub, 'highImpact');
    await this.requireFreshStepUp(claims);
    if (!body.reason?.trim() || body.reason.trim().length < 3) {
      throw new BadRequestException('Reason is required.');
    }

    const fingerprintPayload = {
      planId,
      versionId,
      expectedRowVersion: body.expectedRowVersion,
      reason: body.reason.trim(),
    };
    const requestHash = this.idempotency.fingerprint(fingerprintPayload);
    let claim: { idempotencyKey: string; requestHash: string } | null = null;
    if (idempotencyKey?.trim()) {
      const gate = await this.idempotency.beginOrReplay({
        actorId: claims.sub,
        operation: 'plan.publishVersion',
        idempotencyKey: idempotencyKey.trim(),
        requestHash,
      });
      if (gate.kind === 'replay') return this.getVersion(claims, planId, gate.resultResourceId);
      claim = { idempotencyKey: gate.idempotencyKey, requestHash: gate.requestHash };
    }

    const readiness = await this.getReadiness(claims, planId, versionId, { skipRateLimit: true });
    if (!readiness.publicationReady) {
      throw new BadRequestException({
        code: 'publication_not_ready',
        message: 'Publication readiness failed.',
        blockers: readiness.blockers,
      });
    }

    try {
      const published = await this.prisma.withPlatformBypass(async (client) => {
      const plan = await client.platformPlan.findUniqueOrThrow({ where: { id: planId } });
      const existing = await client.platformPlanVersion.findFirst({
        where: { id: versionId, planId },
        include: {
          translations: true,
          entitlements: { include: { catalogItem: true } },
          limits: { include: { catalogItem: true } },
        },
      });
      if (!existing) throw new NotFoundException('Plan Version not found.');
      if (!canTransitionVersionLifecycle(existing.lifecycle as never, 'PUBLISHED')) {
        throw new BadRequestException(`Cannot publish from ${existing.lifecycle}.`);
      }
      const fp = buildPublicationFingerprintV2({
        planCanonicalKey: plan.canonicalKey,
        versionNumber: existing.versionNumber,
        effectiveFrom: existing.effectiveFrom?.toISOString() ?? null,
        retireAt: existing.retireAt?.toISOString() ?? null,
        trialDefaultEnabled: existing.trialDefaultEnabled,
        trialDefaultDays: existing.trialDefaultDays,
        priceAmountMinor: existing.priceAmountMinor,
        priceCurrency: existing.priceCurrency,
        billingInterval: existing.billingInterval,
        billingIntervalCount: existing.billingIntervalCount,
        translations: existing.translations.map((t) => ({
          locale: t.locale,
          releaseLabel: t.releaseLabel,
          shortDescription: t.shortDescription,
        })),
        sourceVersionId: existing.sourceVersionId,
        entitlements: existing.entitlements.map((e) => ({
          canonicalKey: e.catalogItem.canonicalKey,
          kind: e.catalogItem.kind,
        })),
        limits: existing.limits.map((l) => ({
          canonicalKey: l.catalogItem.canonicalKey,
          unlimited: l.unlimited,
          valueText: l.valueText,
        })),
      });
      await this.maybeFail('after_fingerprint_before_commit');
      const now = new Date();
      const result = await client.platformPlanVersion.updateMany({
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
      const row = await client.platformPlanVersion.findUniqueOrThrow({
        where: { id: versionId },
        include: { translations: true },
      });
      if (claim) {
        await this.maybeFail('before_idempotency_complete');
        await this.idempotency.completeInTransaction(client, {
          actorId: claims.sub,
          operation: 'plan.publishVersion',
          idempotencyKey: claim.idempotencyKey,
          requestHash: claim.requestHash,
          resultResourceType: 'planVersion',
          resultResourceId: row.id,
        });
      }

      // Business mutation staging complete → append SUCCESS audit before commit.
      // D04/D05 injection points (before_idempotency_complete / before_transaction_commit)
      // bracket this call so failure-after-audit and failure-after-business tests
      // both observe a full rollback.
      await this.appendSuccessAudit(client, claims, 'platform_plan_version.published', versionId, {
        planId,
        versionNumber: String(row.versionNumber),
        expectedVersion: String(body.expectedRowVersion),
        resultingVersion: String(row.rowVersion),
        entitlementCount: String(existing.entitlements.length),
        limitCount: String(existing.limits.length),
        fingerprintSchemaVersion: '2',
        readinessResult: readiness.publicationReady ? 'ready' : 'blocked',
        result: 'success',
      });

      await this.maybeFail('before_transaction_commit');
      return {
        row,
        entitlementCount: existing.entitlements.length,
        limitCount: existing.limits.length,
        fingerprintSchemaVersion: '2',
      };
    });

      return this.toVersionDto(published.row);
    } catch (err) {
      const recovered = await this.recoverEquivalentReplay(
        claim,
        'plan.publishVersion',
        claims.sub,
        err,
        (id) => this.getVersion(claims, planId, id),
      );
      if (recovered) return recovered;
      throw err;
    }
  }

  async retireVersion(
    claims: JwtClaimsVO,
    planId: string,
    versionId: string,
    body: { expectedRowVersion: number; reason: string },
  ) {
    const permissions = await this.perms(claims);
    this.require(permissions, 'plan-version.retire');
    this.enforceRateLimit(claims.sub, 'highImpact');
    await this.requireFreshStepUp(claims);
    if (!body.reason?.trim() || body.reason.trim().length < 3) {
      throw new BadRequestException('Reason is required.');
    }

    const retired = await this.prisma.withPlatformBypass(async (client) => {
      const existing = await client.platformPlanVersion.findFirst({
        where: { id: versionId, planId },
      });
      if (!existing) throw new NotFoundException('Plan Version not found.');
      if (!canTransitionVersionLifecycle(existing.lifecycle as never, 'RETIRED')) {
        throw new BadRequestException(`Cannot retire from ${existing.lifecycle}.`);
      }
      const result = await client.platformPlanVersion.updateMany({
        where: {
          id: versionId,
          rowVersion: body.expectedRowVersion,
          lifecycle: { in: ['DRAFT', 'PUBLISHED'] },
        },
        data: {
          lifecycle: 'RETIRED',
          retireAt: new Date(),
          rowVersion: { increment: 1 },
        },
      });
      if (result.count !== 1) throw new ConflictException('Stale version — reload and retry.');
      const row = await client.platformPlanVersion.findUniqueOrThrow({
        where: { id: versionId },
        include: { translations: true },
      });
      await this.appendSuccessAudit(client, claims, 'platform_plan_version.retired', versionId, {
        planId,
        versionNumber: String(row.versionNumber),
        result: 'success',
      });
      return row;
    });
    return this.toVersionDto(retired);
  }

  async cloneVersion(
    claims: JwtClaimsVO,
    planId: string,
    versionId: string,
    idempotencyKey?: string | null,
  ) {
    const permissions = await this.perms(claims);
    this.require(permissions, 'plan-version.create');
    this.enforceRateLimit(claims.sub, 'highImpact');

    const fingerprint = this.idempotency.fingerprint({ planId, sourceVersionId: versionId });
    let claim: { idempotencyKey: string; requestHash: string } | null = null;
    if (idempotencyKey?.trim()) {
      const gate = await this.idempotency.beginOrReplay({
        actorId: claims.sub,
        operation: 'plan.cloneVersion',
        idempotencyKey: idempotencyKey.trim(),
        requestHash: fingerprint,
      });
      if (gate.kind === 'replay') return this.getVersion(claims, planId, gate.resultResourceId);
      claim = { idempotencyKey: gate.idempotencyKey, requestHash: gate.requestHash };
    }

    try {
      const cloned = await this.prisma.withPlatformBypass(async (client) => {
        const plan = await client.platformPlan.findUnique({ where: { id: planId } });
        if (!plan) throw new NotFoundException('Plan not found.');
        if (plan.lifecycle === 'ARCHIVED') {
          throw new BadRequestException('Archived Plan cannot accept new Draft versions.');
        }
        const source = await client.platformPlanVersion.findFirst({
          where: { id: versionId, planId },
          include: {
            translations: true,
            entitlements: true,
            limits: true,
          },
        });
        if (!source) throw new NotFoundException('Source Plan Version not found.');
        if (source.lifecycle === 'DRAFT') {
          throw new BadRequestException('Clone source must be Published or Retired.');
        }
        const agg = await client.platformPlanVersion.aggregate({
          where: { planId },
          _max: { versionNumber: true },
        });
        const versionNumber = (agg._max.versionNumber ?? 0) + 1;
        const row = await client.platformPlanVersion.create({
          data: {
            planId,
            versionNumber,
            lifecycle: 'DRAFT',
            // Clone is an administrator action; seed must never overwrite the copied definition.
            commercialDefinitionOwnership: 'ADMINISTRATOR_OWNED',
            effectiveFrom: source.effectiveFrom,
            trialDefaultEnabled: source.trialDefaultEnabled,
            trialDefaultDays: source.trialDefaultDays,
            priceAmountMinor: source.priceAmountMinor,
            priceCurrency: source.priceCurrency,
            billingInterval: source.billingInterval,
            billingIntervalCount: source.billingIntervalCount,
            sourceVersionId: source.id,
            translations: {
              create: source.translations.map((t) => ({
                locale: t.locale,
                releaseLabel: t.releaseLabel,
                shortDescription: t.shortDescription,
              })),
            },
          },
          include: { translations: true },
        });
        await this.maybeFail('after_clone_source_linkage');

        if (source.entitlements.length) {
          const mid = Math.max(1, Math.ceil(source.entitlements.length / 2));
          const first = source.entitlements.slice(0, mid);
          const rest = source.entitlements.slice(mid);
          await client.platformPlanVersionEntitlement.createMany({
            data: first.map((e) => ({
              planVersionId: row.id,
              catalogItemId: e.catalogItemId,
            })),
          });
          await this.maybeFail('after_clone_entitlement_partial');
          if (rest.length) {
            await client.platformPlanVersionEntitlement.createMany({
              data: rest.map((e) => ({
                planVersionId: row.id,
                catalogItemId: e.catalogItemId,
              })),
            });
          }
        }

        if (source.limits.length) {
          const mid = Math.max(1, Math.ceil(source.limits.length / 2));
          const first = source.limits.slice(0, mid);
          const rest = source.limits.slice(mid);
          await client.platformPlanVersionLimit.createMany({
            data: first.map((l) => ({
              planVersionId: row.id,
              catalogItemId: l.catalogItemId,
              unlimited: l.unlimited,
              valueText: l.valueText,
            })),
          });
          await this.maybeFail('after_clone_limit_partial');
          if (rest.length) {
            await client.platformPlanVersionLimit.createMany({
              data: rest.map((l) => ({
                planVersionId: row.id,
                catalogItemId: l.catalogItemId,
                unlimited: l.unlimited,
                valueText: l.valueText,
              })),
            });
          }
        }

        if (claim) {
          await this.maybeFail('before_idempotency_complete');
          await this.idempotency.completeInTransaction(client, {
            actorId: claims.sub,
            operation: 'plan.cloneVersion',
            idempotencyKey: claim.idempotencyKey,
            requestHash: claim.requestHash,
            resultResourceType: 'planVersion',
            resultResourceId: row.id,
          });
        }

        await this.appendSuccessAudit(client, claims, 'platform_plan_version.cloned', row.id, {
          planId,
          sourceVersionId: versionId,
          sourceVersionNumber: String(source.versionNumber),
          versionNumber: String(row.versionNumber),
          entitlementCount: String(source.entitlements.length),
          limitCount: String(source.limits.length),
          result: 'success',
        });

        await this.maybeFail('before_transaction_commit');
        return {
          row,
          entitlementCount: source.entitlements.length,
          limitCount: source.limits.length,
          sourceVersionNumber: source.versionNumber,
        };
      });
      return this.toVersionDto(cloned.row);
    } catch (err) {
      const recovered = await this.recoverEquivalentReplay(
        claim,
        'plan.cloneVersion',
        claims.sub,
        err,
        (id) => this.getVersion(claims, planId, id),
      );
      if (recovered) return recovered;
      // Concurrent equivalent clone: loser may hit the one-open-Draft unique before
      // observing the winner's completed idempotency row — poll for replay.
      if (
        claim &&
        ((err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') ||
          (err instanceof ConflictException && /Open Draft already exists/i.test(String(err.message))))
      ) {
        const replay = await this.idempotency.awaitEquivalentReplay({
          actorId: claims.sub,
          operation: 'plan.cloneVersion',
          idempotencyKey: claim.idempotencyKey,
          requestHash: claim.requestHash,
        });
        if (replay) {
          return this.getVersion(claims, planId, replay.resultResourceId);
        }
        throw new ConflictException('Open Draft already exists for this Plan.');
      }
      throw err;
    }
  }

  async compareVersions(claims: JwtClaimsVO, planId: string, leftId: string, rightId: string) {
    const permissions = await this.perms(claims);
    this.require(permissions, 'plan-version.view');
    this.enforceRateLimit(claims.sub, 'readHeavy');
    return this.prisma.withPlatformBypass(async (client) => {
      const [left, right] = await Promise.all([
        client.platformPlanVersion.findFirst({
          where: { id: leftId, planId },
          include: {
            translations: true,
            entitlements: { include: { catalogItem: true } },
            limits: { include: { catalogItem: true } },
          },
        }),
        client.platformPlanVersion.findFirst({
          where: { id: rightId, planId },
          include: {
            translations: true,
            entitlements: { include: { catalogItem: true } },
            limits: { include: { catalogItem: true } },
          },
        }),
      ]);
      if (!left || !right) throw new NotFoundException('Plan Version not found.');

      const leftEnt = new Map(
        left.entitlements.map((e) => [e.catalogItem.canonicalKey, e.catalogItem.kind]),
      );
      const rightEnt = new Map(
        right.entitlements.map((e) => [e.catalogItem.canonicalKey, e.catalogItem.kind]),
      );
      const entitlementAdded = [...rightEnt.keys()]
        .filter((k) => !leftEnt.has(k))
        .sort()
        .map((k) => ({ canonicalKey: k, kind: rightEnt.get(k)! }));
      const entitlementRemoved = [...leftEnt.keys()]
        .filter((k) => !rightEnt.has(k))
        .sort()
        .map((k) => ({ canonicalKey: k, kind: leftEnt.get(k)! }));
      const entitlementUnchanged = [...leftEnt.keys()]
        .filter((k) => rightEnt.has(k))
        .sort()
        .map((k) => ({ canonicalKey: k, kind: leftEnt.get(k)! }));

      const leftLim = new Map(
        left.limits.map((l) => [
          l.catalogItem.canonicalKey,
          { unlimited: l.unlimited, valueText: l.valueText },
        ]),
      );
      const rightLim = new Map(
        right.limits.map((l) => [
          l.catalogItem.canonicalKey,
          { unlimited: l.unlimited, valueText: l.valueText },
        ]),
      );
      const limitAdded = [...rightLim.keys()]
        .filter((k) => !leftLim.has(k))
        .sort()
        .map((k) => ({ canonicalKey: k, ...rightLim.get(k)! }));
      const limitRemoved = [...leftLim.keys()]
        .filter((k) => !rightLim.has(k))
        .sort()
        .map((k) => ({ canonicalKey: k, ...leftLim.get(k)! }));
      const legacyMetadataOnlyComparison =
        left.entitlements.length === 0 &&
        right.entitlements.length === 0 &&
        left.limits.length === 0 &&
        right.limits.length === 0;

      const limitChanged = [...leftLim.keys()]
        .filter((k) => rightLim.has(k))
        .filter((k) => {
          const a = leftLim.get(k)!;
          const b = rightLim.get(k)!;
          return a.unlimited !== b.unlimited || a.valueText !== b.valueText;
        })
        .sort()
        .map((k) => ({
          canonicalKey: k,
          left: leftLim.get(k)!,
          right: rightLim.get(k)!,
        }));

      return {
        planId,
        left: this.toVersionDto(left),
        right: this.toVersionDto(right),
        disclaimer: {
          commercialDefinitionOnly: true,
          notTenantRuntimeDecision: true,
        },
        entitlements: legacyMetadataOnlyComparison
          ? {
              status: 'unavailable' as const,
              reason: 'step_14_metadata_only',
              added: [],
              removed: [],
              unchanged: [],
            }
          : {
              status: 'available' as const,
              added: entitlementAdded,
              removed: entitlementRemoved,
              unchanged: entitlementUnchanged,
              modules: {
                left: entitlementUnchanged
                  .concat(entitlementRemoved)
                  .filter((e) => e.kind === 'MODULE')
                  .map((e) => e.canonicalKey),
                right: entitlementUnchanged
                  .concat(entitlementAdded)
                  .filter((e) => e.kind === 'MODULE')
                  .map((e) => e.canonicalKey),
              },
              features: {
                left: [...leftEnt.entries()]
                  .filter(([, kind]) => kind === 'FEATURE')
                  .map(([k]) => k)
                  .sort(),
                right: [...rightEnt.entries()]
                  .filter(([, kind]) => kind === 'FEATURE')
                  .map(([k]) => k)
                  .sort(),
              },
            },
        limits: legacyMetadataOnlyComparison
          ? {
              status: 'unavailable' as const,
              reason: 'step_14_metadata_only',
              added: [],
              removed: [],
              changed: [],
            }
          : {
              status: 'available' as const,
              added: limitAdded,
              removed: limitRemoved,
              changed: limitChanged,
            },
        entitlementDiff: legacyMetadataOnlyComparison
          ? undefined
          : {
              status: 'available' as const,
              added: entitlementAdded.map((e) => e.canonicalKey),
              removed: entitlementRemoved.map((e) => e.canonicalKey),
              unchanged: entitlementUnchanged.map((e) => e.canonicalKey),
              leftCount: left.entitlements.length,
              rightCount: right.entitlements.length,
            },
        limitDiff: legacyMetadataOnlyComparison
          ? undefined
          : {
              status: 'available' as const,
              entries: [
                ...limitAdded.map((l) => ({
                  canonicalKey: l.canonicalKey,
                  displayName: l.canonicalKey,
                  leftLabel: '—',
                  rightLabel: l.unlimited ? 'UNLIMITED' : (l.valueText ?? '—'),
                  changed: true,
                })),
                ...limitRemoved.map((l) => ({
                  canonicalKey: l.canonicalKey,
                  displayName: l.canonicalKey,
                  leftLabel: l.unlimited ? 'UNLIMITED' : (l.valueText ?? '—'),
                  rightLabel: '—',
                  changed: true,
                })),
                ...limitChanged.map((l) => ({
                  canonicalKey: l.canonicalKey,
                  displayName: l.canonicalKey,
                  leftLabel: l.left.unlimited ? 'UNLIMITED' : (l.left.valueText ?? '—'),
                  rightLabel: l.right.unlimited ? 'UNLIMITED' : (l.right.valueText ?? '—'),
                  changed: true,
                })),
              ],
            },
        fingerprintSchemaVersion: {
          left: left.publicationFingerprint ? 'persisted' : null,
          right: right.publicationFingerprint ? 'persisted' : null,
        },
        fields: [
          { field: 'versionNumber', left: left.versionNumber, right: right.versionNumber },
          { field: 'lifecycle', left: left.lifecycle, right: right.lifecycle },
          {
            field: 'publishedAt',
            left: left.publishedAt?.toISOString() ?? null,
            right: right.publishedAt?.toISOString() ?? null,
          },
          {
            field: 'effectiveFrom',
            left: left.effectiveFrom?.toISOString() ?? null,
            right: right.effectiveFrom?.toISOString() ?? null,
          },
          {
            field: 'trialDefaultDays',
            left: left.trialDefaultDays,
            right: right.trialDefaultDays,
          },
          {
            field: 'priceAmountMinor',
            left: left.priceAmountMinor,
            right: right.priceAmountMinor,
          },
          {
            field: 'entitlementCount',
            left: left.entitlements.length,
            right: right.entitlements.length,
          },
          {
            field: 'limitCount',
            left: left.limits.length,
            right: right.limits.length,
          },
        ],
      };
    });
  }

  async getReferences(claims: JwtClaimsVO, planId: string) {
    const permissions = await this.perms(claims);
    this.require(permissions, 'plan.view');
    return this.prisma.withPlatformBypass(async (client) => {
      const plan = await client.platformPlan.findUnique({
        where: { id: planId },
        include: { aliases: true, versions: true },
      });
      if (!plan) throw new NotFoundException('Plan not found.');
      const legacyAssignmentCount = await this.countLegacyAssignments(client, planId);
      return {
        planId,
        versionCount: plan.versions.length,
        aliasCount: plan.aliases.filter((a) => a.lifecycle === 'ACTIVE').length,
        legacyAssignmentCount,
        planVersionSubscriberCount: { status: 'unavailable', reason: 'no_plan_version_fk' },
        entitlements: { status: 'available', reason: 'step_14_commercial_definition' },
        addOns: { status: 'available', reason: 'step_15_commercial_definition' },
        overrides: { status: 'available', reason: 'step_15_commercial_definition' },
        directSubscriptions: { status: 'unavailable', reason: 'step_16_not_implemented' },
      };
    });
  }

  async getLegacyMappings(claims: JwtClaimsVO) {
    const permissions = await this.perms(claims);
    this.require(permissions, 'plan.view');
    return this.prisma.withPlatformBypass(async (client) => {
      const aliases = await client.platformPlanAlias.findMany({
        where: {
          NOT: {
            AND: [{ aliasValue: 'business' }, { sourceNamespace: 'clinic_ui_plan' }],
          },
        },
        include: { plan: { select: { id: true, canonicalKey: true, lifecycle: true } } },
        orderBy: [{ sourceNamespace: 'asc' }, { aliasValue: 'asc' }],
      });
      const items = [];
      for (const a of aliases) {
        let usageCount: number | null = null;
        if (a.sourceNamespace === 'prisma_plan_enum' && a.lifecycle === 'ACTIVE') {
          usageCount = await client.platformTenant.count({
            where: { plan: a.aliasValue as never },
          });
        }
        items.push({
          id: a.id,
          sourceNamespace: a.sourceNamespace,
          aliasValue: a.aliasValue,
          canonicalKey: a.plan.canonicalKey,
          planId: a.plan.id,
          planLifecycle: a.plan.lifecycle,
          aliasLifecycle: a.lifecycle,
          migrationNote: a.migrationNote,
          usageCount,
          unresolvedAmbiguity: null as string | null,
        });
      }
      return {
        items,
        unresolved: UNRESOLVED_PLAN_IDENTIFIERS.map((u) => ({
          value: u.value,
          status: 'unresolved',
          classification: u.classification,
          confidence: 'medium',
          note: u.note,
          canonicalMapping: null,
        })),
      };
    });
  }
}
