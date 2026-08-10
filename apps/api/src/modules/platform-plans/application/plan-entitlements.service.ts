/**
 * Release 47 Step 14 — Plan Version entitlements and typed Limits (commercial definition).
 * Not a tenant runtime entitlement resolver.
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
import type { JwtClaimsVO } from '../../auth/domain/value-objects/jwt-claims.vo';
import {
  evaluateCompatibilitySelection,
  type EvalCatalogItem,
  type EvalRule,
} from '../../platform-healthcare-catalog/domain/compatibility.evaluator';
import { isVersionMutable } from '../domain/plan-lifecycle';
import { ENTITLEMENT_ELIGIBLE_KINDS } from '../domain/plan-entitlement-seed.inventory';
import {
  validateLimitAssignment,
  type CatalogLimitMeta,
} from '../domain/limit-value.validator';
import {
  PlanIdempotencyService,
  IdempotencyEquivalentRaceLostError,
  IdempotencyEquivalentReplayTimeoutError,
} from './plan-idempotency.service';
import type { PlanIdempotencyOperation } from './plan-idempotency.service';
import type { PlatformPlansAuditLog } from './ports/plan-audit-log.port';
import {
  PLATFORM_PLANS_AUDIT_LOG,
  PLATFORM_PLANS_CONFIG,
  PLATFORM_PLANS_TX_FAILURE_HOOK,
  type PlanTxFailureHook,
  type PlanTxFailurePoint,
} from '../platform-plans.tokens';
import {
  loadPlatformPlansConfig,
  type PlatformPlansConfig,
} from '../config/platform-plans.config';
import { PLATFORM_AUDIT_SENTINEL_TENANT_ID } from '../../platform-tenants/platform-tenants.tokens';
import { CorrelationContextService } from '../../observability/application/logging/correlation-context.service';
import { resolveOperationCorrelationId } from '../../platform-audit-center/application/operation-correlation';

const MAX_ENTITLEMENT_KEYS = 200;
const MAX_LIMIT_ASSIGNMENTS = 100;
const AUDIT_KEY_BOUND = 40;

function isModuleOrFeatureCatalogKey(key: string): boolean {
  return key.startsWith('module.') || key.startsWith('feature.');
}

/** Plan Version commercial grants are MODULE/FEATURE only (Step 14). */
function rulesForCommercialEntitlementReadiness(rules: EvalRule[]): EvalRule[] {
  return rules.filter((rule) => {
    switch (rule.ruleType) {
      case 'REQUIRES':
      case 'INCOMPATIBLE_WITH':
        return (
          isModuleOrFeatureCatalogKey(rule.subjectKey) &&
          isModuleOrFeatureCatalogKey(rule.targetKey)
        );
      case 'REQUIRES_ANY_OF':
        return (
          isModuleOrFeatureCatalogKey(rule.subjectKey) &&
          isModuleOrFeatureCatalogKey(rule.targetKey)
        );
      case 'ALLOWED_FOR':
      case 'NOT_ALLOWED_FOR':
        return false;
      default:
        return false;
    }
  });
}

@Injectable()
export class PlanEntitlementsService {
  private readonly logger = new Logger(PlanEntitlementsService.name);
  private readonly rateHits = new Map<string, number[]>();
  private readonly config: PlatformPlansConfig;

  constructor(
    private readonly prisma: PrismaService,
    private readonly authorization: PlatformAuthorizationService,
    @Inject(PLATFORM_PLANS_AUDIT_LOG)
    private readonly audit: PlatformPlansAuditLog,
    private readonly idempotency: PlanIdempotencyService,
    @Optional() @Inject(PLATFORM_PLANS_CONFIG) config?: PlatformPlansConfig,
    @Optional() @Inject(PLATFORM_PLANS_TX_FAILURE_HOOK)
    private readonly failureHook?: PlanTxFailureHook,
    @Optional() private readonly correlation?: CorrelationContextService,
  ) {
    this.config = config ?? loadPlatformPlansConfig();
  }

  /** Test-only; no-op when hook is absent (production). */
  private async maybeFail(point: PlanTxFailurePoint): Promise<void> {
    if (!this.failureHook) return;
    await this.failureHook(point);
  }

  private enforceRateLimit(actorId: string, bucket: 'mutation' | 'readHeavy'): void {
    const limit =
      bucket === 'mutation'
        ? this.config.mutationRateLimitPerMinute
        : this.config.readHeavyRateLimitPerMinute;
    const key = `${bucket}:ent:${actorId}`;
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
    return new Set(await this.authorization.resolveEffectivePermissions(claims.sub));
  }

  private require(permissions: Set<string>, key: string): void {
    if (!permissions.has(key)) {
      throw new ForbiddenException(`Missing ${key} permission.`);
    }
  }

  /**
   * Step 21 Model A — durable SUCCESS audit. Appends the AuditEntry inside the
   * same `withPlatformBypass` transaction client as the business mutation it
   * documents, and intentionally does NOT swallow failures: if the audit write
   * fails, this throws and the whole transaction (including the mutation)
   * rolls back. There is no code path where an entitlement/Limit mutation
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
      descriptionEn: 'Platform plan entitlement mutation',
      descriptionAr: 'تعديل استحقاق خطة المنصة',
      details,
      correlationId: resolveOperationCorrelationId({
        fromContext: this.correlation?.getCorrelationId?.() ?? null,
      }),
    });
  }

  /**
   * After losing OCC or an equivalent uniqueness race, reload the winner's durable result.
   * Does not emit a second success audit.
   */
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
      // Bounded poll exhausted — safe retryable outcome, not conflicting reuse.
      throw new ServiceUnavailableException(new IdempotencyEquivalentReplayTimeoutError().message);
    }
    return load(replay.resultResourceId);
  }

  async getEntitlements(claims: JwtClaimsVO, planId: string, versionId: string) {
    const permissions = await this.perms(claims);
    this.require(permissions, 'plan-entitlement.view');
    this.enforceRateLimit(claims.sub, 'readHeavy');
    return this.prisma.withPlatformBypass(async (client) => {
      const ctx = await this.loadVersionContext(client, planId, versionId);
      const entitlementRows = await client.platformPlanVersionEntitlement.findMany({
        where: { planVersionId: versionId },
        include: {
          catalogItem: {
            include: {
              translations: true,
              owningModule: { select: { canonicalKey: true } },
            },
          },
        },
        orderBy: { createdAt: 'asc' },
      });
      const catalogPool = await client.healthcareCatalogItem.findMany({
        where: {
          kind: { in: ['MODULE', 'FEATURE', 'FACILITY_TYPE', 'SPECIALTY'] },
        },
        include: {
          translations: true,
          owningModule: { select: { canonicalKey: true } },
        },
        orderBy: [{ kind: 'asc' }, { sortOrder: 'asc' }],
      });
      const grantedKeys = new Set(entitlementRows.map((e) => e.catalogItem.canonicalKey));
      const evaluation = await this.evaluateEntitlementSet(client, [...grantedKeys]);
      const byKeyName = new Map(
        catalogPool.map((c) => [
          c.canonicalKey,
          c.translations.find((t) => t.locale === 'en-US')?.displayName ?? c.canonicalKey,
        ]),
      );

      const grants = entitlementRows.map((row) => ({
        canonicalKey: row.catalogItem.canonicalKey,
        kind: row.catalogItem.kind,
        source: 'explicit' as const,
      }));

      const catalogItems = catalogPool.map((item) => {
        const eligible = (ENTITLEMENT_ELIGIBLE_KINDS as readonly string[]).includes(item.kind);
        const retired = item.lifecycle === 'RETIRED';
        return {
          canonicalKey: item.canonicalKey,
          kind: item.kind,
          displayName:
            item.translations.find((t) => t.locale === 'en-US')?.displayName ?? item.canonicalKey,
          lifecycle: item.lifecycle,
          selectable: eligible && !retired && isVersionMutable(ctx.version.lifecycle as never),
          unselectableReason: !eligible
            ? 'not_entitlement_eligible'
            : retired
              ? 'retired'
              : !isVersionMutable(ctx.version.lifecycle as never)
                ? 'immutable_version'
                : null,
          owningModuleKey: item.owningModule?.canonicalKey ?? null,
        };
      });

      const dependencyWarnings = evaluation.compatibility.warnings
        .concat(
          evaluation.missingRequired.map((k) => ({
            reasonCode: 'missing_required_dependency',
            message: `Missing required dependency: ${k}`,
            subjectKey: undefined,
            targetKey: k,
          })),
        )
        .slice(0, 50)
        .map((w) => ({
          code: w.reasonCode,
          message: w.message,
          subjectKey: w.subjectKey ?? '',
          missingKeys: w.targetKey ? [w.targetKey] : [],
        }));

      const legacyUnconfigured =
        ctx.version.lifecycle !== 'DRAFT' && entitlementRows.length === 0;
      const byKind: Record<string, unknown[]> = {
        MODULE: [],
        FEATURE: [],
        FACILITY_TYPE: [],
        SPECIALTY: [],
      };
      for (const g of grants) {
        const bucket = byKind[g.kind] ?? (byKind[g.kind] = []);
        bucket.push({
          canonicalKey: g.canonicalKey,
          kind: g.kind,
          explicit: true,
        });
      }

      return {
        planId,
        planKey: ctx.plan.canonicalKey,
        planVersionId: versionId,
        versionId,
        versionNumber: ctx.version.versionNumber,
        lifecycle: ctx.version.lifecycle,
        rowVersion: ctx.version.rowVersion,
        readOnly: !isVersionMutable(ctx.version.lifecycle as never),
        legacyUnconfigured,
        catalogItems,
        grants,
        dependencyWarnings,
        requiredMissing: evaluation.missingRequired.map((canonicalKey) => ({
          canonicalKey,
          displayName: byKeyName.get(canonicalKey) ?? canonicalKey,
        })),
        disclaimer: {
          commercialDefinitionOnly: true,
          notTenantRuntimeDecision: true,
          notLicensingEngineDecision: true,
        },
        entitlementsByKind: byKind,
        entitlementCount: entitlementRows.length,
        snapshotStatus: legacyUnconfigured ? 'LEGACY_UNCONFIGURED' : 'CONFIGURED',
        lastModifiedAt: ctx.version.updatedAt.toISOString(),
      };
    });
  }

  async putEntitlements(
    claims: JwtClaimsVO,
    planId: string,
    versionId: string,
    body: {
      expectedRowVersion: number;
      entitlementKeys?: string[];
      grants?: Array<{ canonicalKey: string; kind?: string }>;
    },
    idempotencyKey?: string | null,
  ) {
    const permissions = await this.perms(claims);
    this.require(permissions, 'plan-entitlement.manage');
    this.enforceRateLimit(claims.sub, 'mutation');

    const fromGrants = (body.grants ?? []).map((g) => g.canonicalKey.trim()).filter(Boolean);
    const fromKeys = (body.entitlementKeys ?? []).map((k) => k.trim()).filter(Boolean);
    const keys = [...new Set(fromGrants.length ? fromGrants : fromKeys)];
    if (keys.length > MAX_ENTITLEMENT_KEYS) {
      throw new BadRequestException(`At most ${MAX_ENTITLEMENT_KEYS} entitlements allowed.`);
    }

    const requestHash = this.idempotency.fingerprint({
      planId,
      versionId,
      expectedRowVersion: body.expectedRowVersion,
      entitlementKeys: [...keys].sort(),
    });
    let claim: { idempotencyKey: string; requestHash: string } | null = null;
    if (idempotencyKey?.trim()) {
      const gate = await this.idempotency.beginOrReplay({
        actorId: claims.sub,
        operation: 'plan.replaceEntitlements',
        idempotencyKey: idempotencyKey.trim(),
        requestHash,
      });
      if (gate.kind === 'replay') {
        return this.getEntitlements(claims, planId, gate.resultResourceId);
      }
      claim = { idempotencyKey: gate.idempotencyKey, requestHash: gate.requestHash };
    }

    try {
      await this.prisma.withPlatformBypass(async (client) => {
      const ctx = await this.loadVersionContext(client, planId, versionId);
      if (!isVersionMutable(ctx.version.lifecycle as never)) {
        throw new ConflictException('Published and Retired Plan Versions are immutable.');
      }
      const catalogItems = await client.healthcareCatalogItem.findMany({
        where: { canonicalKey: { in: keys } },
      });
      const byKey = new Map(catalogItems.map((c) => [c.canonicalKey, c]));
      const invalid: string[] = [];
      for (const key of keys) {
        const item = byKey.get(key);
        if (!item) {
          invalid.push(key);
          continue;
        }
        if (!(ENTITLEMENT_ELIGIBLE_KINDS as readonly string[]).includes(item.kind)) {
          throw new BadRequestException({
            code: 'entitlement_invalid_kind',
            message: `Catalog kind ${item.kind} is not entitlement-eligible: ${key}`,
          });
        }
        if (item.kind === 'LIMIT') {
          throw new BadRequestException({
            code: 'entitlement_limit_not_allowed',
            message: `Limit items cannot be capability entitlements: ${key}`,
          });
        }
        if (item.lifecycle === 'RETIRED') {
          throw new BadRequestException({
            code: 'entitlement_retired_item',
            message: `Retired Catalog item cannot be entitled: ${key}`,
          });
        }
      }
      if (invalid.length) {
        throw new BadRequestException({
          code: 'entitlement_unknown_key',
          message: 'Unknown Catalog keys.',
          keys: invalid.slice(0, 20),
        });
      }

      const existing = await client.platformPlanVersionEntitlement.findMany({
        where: { planVersionId: versionId },
        include: { catalogItem: { select: { canonicalKey: true } } },
      });
      const existingKeys = new Set(existing.map((e) => e.catalogItem.canonicalKey));
      const nextKeys = new Set(keys);
      const added = keys.filter((k) => !existingKeys.has(k));
      const removed = [...existingKeys].filter((k) => !nextKeys.has(k));

      const bumped = await client.platformPlanVersion.updateMany({
        where: { id: versionId, rowVersion: body.expectedRowVersion, lifecycle: 'DRAFT' },
        data: {
          rowVersion: { increment: 1 },
          commercialDefinitionOwnership: 'ADMINISTRATOR_OWNED',
        },
      });
      if (bumped.count !== 1) throw new ConflictException('Stale version — reload and retry.');
      await this.maybeFail('after_row_version_bump');

      await client.platformPlanVersionEntitlement.deleteMany({ where: { planVersionId: versionId } });
      await this.maybeFail('after_entitlement_delete');
      if (keys.length) {
        const mid = Math.max(1, Math.ceil(keys.length / 2));
        const first = keys.slice(0, mid);
        const rest = keys.slice(mid);
        await client.platformPlanVersionEntitlement.createMany({
          data: first.map((k) => ({
            planVersionId: versionId,
            catalogItemId: byKey.get(k)!.id,
          })),
        });
        await this.maybeFail('after_entitlement_partial_insert');
        if (rest.length) {
          await client.platformPlanVersionEntitlement.createMany({
            data: rest.map((k) => ({
              planVersionId: versionId,
              catalogItemId: byKey.get(k)!.id,
            })),
          });
        }
      }

      if (claim) {
        await this.maybeFail('before_idempotency_complete');
        await this.idempotency.completeInTransaction(client, {
          actorId: claims.sub,
          operation: 'plan.replaceEntitlements',
          idempotencyKey: claim.idempotencyKey,
          requestHash: claim.requestHash,
          resultResourceType: 'planVersion',
          resultResourceId: versionId,
        });
      }

      // Business mutation staging complete → append SUCCESS audit before commit
      // (D04/D05 injection points, where present, land between staging and here).
      await this.appendSuccessAudit(
        client,
        claims,
        'platform_plan_version.entitlements_replaced',
        versionId,
        {
          planId,
          addedCount: String(added.length),
          removedCount: String(removed.length),
          addedKeys: added.slice(0, AUDIT_KEY_BOUND).join(','),
          removedKeys: removed.slice(0, AUDIT_KEY_BOUND).join(','),
          expectedVersion: String(body.expectedRowVersion),
          result: 'success',
        },
      );

      await this.maybeFail('before_transaction_commit');
      return { added, removed };
    });
      return this.getEntitlements(claims, planId, versionId);
    } catch (err) {
      const recovered = await this.recoverEquivalentReplay(
        claim,
        'plan.replaceEntitlements',
        claims.sub,
        err,
        (id) => this.getEntitlements(claims, planId, id),
      );
      if (recovered) return recovered;
      throw err;
    }
  }

  async applyRequiredDependencies(
    claims: JwtClaimsVO,
    planId: string,
    versionId: string,
    body: { expectedRowVersion: number; confirm?: boolean },
    idempotencyKey?: string | null,
  ) {
    const permissions = await this.perms(claims);
    this.require(permissions, 'plan-entitlement.manage');
    this.enforceRateLimit(claims.sub, 'mutation');
    // Dedicated apply-required route; UI ConfirmationDialog is the human confirm.
    // Explicit confirm:false still rejected.
    if (body.confirm === false) {
      throw new BadRequestException('Confirmation required to apply required dependencies.');
    }

    const requestHash = this.idempotency.fingerprint({
      planId,
      versionId,
      expectedRowVersion: body.expectedRowVersion,
      op: 'applyRequired',
    });
    let claim: { idempotencyKey: string; requestHash: string } | null = null;
    if (idempotencyKey?.trim()) {
      const gate = await this.idempotency.beginOrReplay({
        actorId: claims.sub,
        operation: 'plan.applyRequiredDeps',
        idempotencyKey: idempotencyKey.trim(),
        requestHash,
      });
      if (gate.kind === 'replay') {
        return this.getEntitlements(claims, planId, gate.resultResourceId);
      }
      claim = { idempotencyKey: gate.idempotencyKey, requestHash: gate.requestHash };
    }

    try {
      await this.prisma.withPlatformBypass(async (client) => {
      const ctx = await this.loadVersionContext(client, planId, versionId);
      if (!isVersionMutable(ctx.version.lifecycle as never)) {
        throw new ConflictException('Published and Retired Plan Versions are immutable.');
      }
      const current = await client.platformPlanVersionEntitlement.findMany({
        where: { planVersionId: versionId },
        include: { catalogItem: true },
      });
      const selectedKeys = current.map((c) => c.catalogItem.canonicalKey);
      const { missingRequired } = await this.evaluateEntitlementSet(client, selectedKeys);
      if (!missingRequired.length) {
        // Idempotent no-op still requires a matching OCC token.
        if (ctx.version.rowVersion !== body.expectedRowVersion) {
          throw new ConflictException('Stale version — reload and retry.');
        }
        if (claim) {
          await this.idempotency.completeInTransaction(client, {
            actorId: claims.sub,
            operation: 'plan.applyRequiredDeps',
            idempotencyKey: claim.idempotencyKey,
            requestHash: claim.requestHash,
            resultResourceType: 'planVersion',
            resultResourceId: versionId,
          });
        }
        return [] as string[];
      }

      // Reject if any required target would be incompatible with current set
      const proposed = [...new Set([...selectedKeys, ...missingRequired])];
      const evalResult = await this.evaluateEntitlementSet(client, proposed);
      if (!evalResult.compatibility.valid) {
        throw new BadRequestException({
          code: 'incompatible_entitlements',
          message: 'Applying required dependencies would introduce incompatibilities.',
          violations: evalResult.compatibility.violations.slice(0, 20),
        });
      }

      const catalogItems = await client.healthcareCatalogItem.findMany({
        where: { canonicalKey: { in: missingRequired } },
      });
      for (const item of catalogItems) {
        if (!(ENTITLEMENT_ELIGIBLE_KINDS as readonly string[]).includes(item.kind)) {
          throw new BadRequestException({
            code: 'entitlement_invalid_kind',
            message: `Required dependency ${item.canonicalKey} is not entitlement-eligible.`,
          });
        }
        if (item.lifecycle === 'RETIRED') {
          throw new BadRequestException({
            code: 'entitlement_retired_item',
            message: `Required dependency ${item.canonicalKey} is retired.`,
          });
        }
      }
      const byKey = new Map(catalogItems.map((c) => [c.canonicalKey, c]));

      const bumped = await client.platformPlanVersion.updateMany({
        where: { id: versionId, rowVersion: body.expectedRowVersion, lifecycle: 'DRAFT' },
        data: {
          rowVersion: { increment: 1 },
          commercialDefinitionOwnership: 'ADMINISTRATOR_OWNED',
        },
      });
      if (bumped.count !== 1) throw new ConflictException('Stale version — reload and retry.');

      await client.platformPlanVersionEntitlement.createMany({
        data: missingRequired
          .filter((k) => byKey.has(k))
          .map((k) => ({
            planVersionId: versionId,
            catalogItemId: byKey.get(k)!.id,
          })),
        skipDuplicates: true,
      });

      if (claim) {
        await this.idempotency.completeInTransaction(client, {
          actorId: claims.sub,
          operation: 'plan.applyRequiredDeps',
          idempotencyKey: claim.idempotencyKey,
          requestHash: claim.requestHash,
          resultResourceType: 'planVersion',
          resultResourceId: versionId,
        });
      }

      // No-op (nothing missing) is handled above via early return — complete
      // idempotency only, without a mutation SUCCESS audit. Only a genuine
      // change to the entitlement set is audited here, inside the same
      // transaction as the mutation it documents.
      await this.appendSuccessAudit(
        client,
        claims,
        'platform_plan_version.required_dependencies_applied',
        versionId,
        {
          planId,
          addedCount: String(missingRequired.length),
          addedKeys: missingRequired.slice(0, AUDIT_KEY_BOUND).join(','),
          expectedVersion: String(body.expectedRowVersion),
          result: 'success',
        },
      );

      return missingRequired;
    });

      return this.getEntitlements(claims, planId, versionId);
    } catch (err) {
      const recovered = await this.recoverEquivalentReplay(
        claim,
        'plan.applyRequiredDeps',
        claims.sub,
        err,
        (id) => this.getEntitlements(claims, planId, id),
      );
      if (recovered) return recovered;
      throw err;
    }
  }

  async getLimits(claims: JwtClaimsVO, planId: string, versionId: string) {
    const permissions = await this.perms(claims);
    this.require(permissions, 'plan-limit.view');
    this.enforceRateLimit(claims.sub, 'readHeavy');
    return this.prisma.withPlatformBypass(async (client) => {
      const ctx = await this.loadVersionContext(client, planId, versionId);
      const limitCatalog = await client.healthcareCatalogItem.findMany({
        where: { kind: 'LIMIT' },
        include: {
          translations: true,
          owningModule: { select: { canonicalKey: true, translations: true } },
        },
        orderBy: { sortOrder: 'asc' },
      });
      const assignments = await client.platformPlanVersionLimit.findMany({
        where: { planVersionId: versionId },
        include: { catalogItem: true },
      });
      const byCatalogId = new Map(assignments.map((a) => [a.catalogItemId, a]));
      const entitled = await client.platformPlanVersionEntitlement.findMany({
        where: { planVersionId: versionId },
        include: { catalogItem: { select: { canonicalKey: true } } },
      });
      const entitledKeys = new Set(entitled.map((e) => e.catalogItem.canonicalKey));

      const toDef = (item: (typeof limitCatalog)[number]) => {
        const asg = byCatalogId.get(item.id);
        const ownerKey = item.owningModule?.canonicalKey ?? null;
        const state = asg
          ? asg.unlimited
            ? ('UNLIMITED' as const)
            : ('VALUE' as const)
          : ('UNCONFIGURED' as const);
        return {
          catalogItemId: item.id,
          canonicalKey: item.canonicalKey,
          displayName:
            item.translations.find((t) => t.locale === 'en-US')?.displayName ?? item.canonicalKey,
          valueType: item.limitValueType ?? 'COUNT',
          unit: item.limitUnit ?? 'count',
          min: item.limitMin?.toString() ?? null,
          max: item.limitMax?.toString() ?? null,
          minimum: item.limitMin?.toString() ?? null,
          maximum: item.limitMax?.toString() ?? null,
          zeroValid: item.limitZeroValid ?? true,
          zeroAllowed: item.limitZeroValid ?? true,
          unlimitedSupported: item.limitUnlimitedSupported ?? true,
          unlimitedAllowed: item.limitUnlimitedSupported ?? true,
          owningModuleKey: ownerKey,
          owningCapabilityKey: ownerKey,
          ownerModuleGranted: ownerKey ? entitledKeys.has(ownerKey) : true,
          owningCapabilityEntitled: ownerKey ? entitledKeys.has(ownerKey) : null,
          assignment: {
            state,
            value: asg && !asg.unlimited ? asg.valueText : null,
          },
          configuredState:
            state === 'VALUE' ? 'CONFIGURED' : state === 'UNLIMITED' ? 'UNLIMITED' : 'UNCONFIGURED',
          unlimited: asg?.unlimited ?? false,
          valueText: asg?.valueText ?? null,
          catalogLifecycle: item.lifecycle,
        };
      };

      const defs = limitCatalog.map(toDef);
      const groupMap = new Map<
        string,
        { moduleKey: string; moduleDisplayName: string; limits: ReturnType<typeof toDef>[] }
      >();
      const ungrouped: ReturnType<typeof toDef>[] = [];
      for (const def of defs) {
        if (!def.owningModuleKey) {
          ungrouped.push(def);
          continue;
        }
        const moduleItem = limitCatalog.find((l) => l.owningModule?.canonicalKey === def.owningModuleKey)
          ?.owningModule;
        const g =
          groupMap.get(def.owningModuleKey) ??
          ({
            moduleKey: def.owningModuleKey,
            moduleDisplayName:
              moduleItem?.translations.find((t) => t.locale === 'en-US')?.displayName ??
              def.owningModuleKey,
            limits: [],
          } as {
            moduleKey: string;
            moduleDisplayName: string;
            limits: ReturnType<typeof toDef>[];
          });
        g.limits.push(def);
        groupMap.set(def.owningModuleKey, g);
      }

      const legacyUnconfigured =
        ctx.version.lifecycle !== 'DRAFT' && assignments.length === 0;

      return {
        planId,
        planKey: ctx.plan.canonicalKey,
        planVersionId: versionId,
        versionId,
        versionNumber: ctx.version.versionNumber,
        lifecycle: ctx.version.lifecycle,
        rowVersion: ctx.version.rowVersion,
        readOnly: !isVersionMutable(ctx.version.lifecycle as never),
        legacyUnconfigured,
        groups: [...groupMap.values()].sort((a, b) => a.moduleKey.localeCompare(b.moduleKey)),
        ungrouped,
        items: defs,
        disclaimer: {
          commercialDefinitionOnly: true,
          notTenantUsage: true,
          missingMeansUnconfigured: true,
          missingDoesNotMeanUnlimited: true,
        },
        snapshotStatus: legacyUnconfigured ? 'LEGACY_UNCONFIGURED' : 'CONFIGURED',
      };
    });
  }

  async putLimits(
    claims: JwtClaimsVO,
    planId: string,
    versionId: string,
    body: {
      expectedRowVersion: number;
      limits?: Array<{ canonicalKey: string; unlimited: boolean; valueText?: string | null }>;
      assignments?: Array<{
        canonicalKey: string;
        state: string;
        value?: string | null;
      }>;
    },
    idempotencyKey?: string | null,
  ) {
    const permissions = await this.perms(claims);
    this.require(permissions, 'plan-limit.manage');
    this.enforceRateLimit(claims.sub, 'mutation');

    let proposed: Array<{ canonicalKey: string; unlimited: boolean; valueText: string | null }> =
      [];
    if (body.assignments?.length) {
      proposed = body.assignments
        .filter((a) => a.state === 'VALUE' || a.state === 'UNLIMITED')
        .map((a) => ({
          canonicalKey: a.canonicalKey.trim(),
          unlimited: a.state === 'UNLIMITED',
          valueText: a.state === 'UNLIMITED' ? null : (a.value ?? null),
        }));
    } else {
      proposed = (body.limits ?? []).map((p) => ({
        canonicalKey: p.canonicalKey.trim(),
        unlimited: !!p.unlimited,
        valueText: p.unlimited ? null : (p.valueText ?? null),
      }));
    }

    if (proposed.length > MAX_LIMIT_ASSIGNMENTS) {
      throw new BadRequestException(`At most ${MAX_LIMIT_ASSIGNMENTS} Limit assignments allowed.`);
    }
    const keys = proposed.map((p) => p.canonicalKey.trim());
    if (new Set(keys).size !== keys.length) {
      throw new BadRequestException({ code: 'limit_duplicate', message: 'Duplicate Limit keys.' });
    }

    const requestHash = this.idempotency.fingerprint({
      planId,
      versionId,
      expectedRowVersion: body.expectedRowVersion,
      limits: proposed
        .map((p) => ({
          k: p.canonicalKey,
          u: p.unlimited,
          v: p.unlimited ? null : (p.valueText ?? null),
        }))
        .sort((a, b) => a.k.localeCompare(b.k)),
    });
    let claim: { idempotencyKey: string; requestHash: string } | null = null;
    if (idempotencyKey?.trim()) {
      const gate = await this.idempotency.beginOrReplay({
        actorId: claims.sub,
        operation: 'plan.replaceLimits',
        idempotencyKey: idempotencyKey.trim(),
        requestHash,
      });
      if (gate.kind === 'replay') {
        return this.getLimits(claims, planId, gate.resultResourceId);
      }
      claim = { idempotencyKey: gate.idempotencyKey, requestHash: gate.requestHash };
    }

    try {
      await this.prisma.withPlatformBypass(async (client) => {
      const ctx = await this.loadVersionContext(client, planId, versionId);
      if (!isVersionMutable(ctx.version.lifecycle as never)) {
        throw new ConflictException('Published and Retired Plan Versions are immutable.');
      }

      const entitled = await client.platformPlanVersionEntitlement.findMany({
        where: { planVersionId: versionId },
        include: { catalogItem: { select: { canonicalKey: true } } },
      });
      const entitledKeys = new Set(entitled.map((e) => e.catalogItem.canonicalKey));

      const catalogItems = await client.healthcareCatalogItem.findMany({
        where: { canonicalKey: { in: keys } },
        include: { owningModule: { select: { canonicalKey: true } } },
      });
      const byKey = new Map(catalogItems.map((c) => [c.canonicalKey, c]));
      const issues = [];
      for (const p of proposed) {
        const item = byKey.get(p.canonicalKey);
        const meta: CatalogLimitMeta | undefined = item
          ? {
              canonicalKey: item.canonicalKey,
              kind: item.kind,
              lifecycle: item.lifecycle,
              limitValueType: item.limitValueType as never,
              limitUnit: item.limitUnit,
              limitMin: item.limitMin?.toString() ?? null,
              limitMax: item.limitMax?.toString() ?? null,
              limitZeroValid: item.limitZeroValid,
              limitUnlimitedSupported: item.limitUnlimitedSupported,
              owningModuleCanonicalKey: item.owningModule?.canonicalKey ?? null,
              owningFeatureCanonicalKey: null,
            }
          : undefined;
        issues.push(
          ...validateLimitAssignment(
            {
              canonicalKey: p.canonicalKey,
              unlimited: !!p.unlimited,
              valueText: p.unlimited ? null : (p.valueText ?? null),
            },
            meta,
            entitledKeys,
          ),
        );
      }
      if (issues.length) {
        throw new BadRequestException({
          code: 'limit_validation_failed',
          message: 'Limit validation failed.',
          issues: issues.slice(0, 50),
        });
      }

      const bumped = await client.platformPlanVersion.updateMany({
        where: { id: versionId, rowVersion: body.expectedRowVersion, lifecycle: 'DRAFT' },
        data: {
          rowVersion: { increment: 1 },
          commercialDefinitionOwnership: 'ADMINISTRATOR_OWNED',
        },
      });
      if (bumped.count !== 1) throw new ConflictException('Stale version — reload and retry.');
      await this.maybeFail('after_row_version_bump');

      await client.platformPlanVersionLimit.deleteMany({ where: { planVersionId: versionId } });
      await this.maybeFail('after_limit_delete');
      if (proposed.length) {
        const mid = Math.max(1, Math.ceil(proposed.length / 2));
        const first = proposed.slice(0, mid);
        const rest = proposed.slice(mid);
        await client.platformPlanVersionLimit.createMany({
          data: first.map((p) => ({
            planVersionId: versionId,
            catalogItemId: byKey.get(p.canonicalKey)!.id,
            unlimited: !!p.unlimited,
            valueText: p.unlimited ? null : String(p.valueText).trim(),
          })),
        });
        await this.maybeFail('after_limit_partial_insert');
        if (rest.length) {
          await client.platformPlanVersionLimit.createMany({
            data: rest.map((p) => ({
              planVersionId: versionId,
              catalogItemId: byKey.get(p.canonicalKey)!.id,
              unlimited: !!p.unlimited,
              valueText: p.unlimited ? null : String(p.valueText).trim(),
            })),
          });
        }
      }

      if (claim) {
        await this.maybeFail('before_idempotency_complete');
        await this.idempotency.completeInTransaction(client, {
          actorId: claims.sub,
          operation: 'plan.replaceLimits',
          idempotencyKey: claim.idempotencyKey,
          requestHash: claim.requestHash,
          resultResourceType: 'planVersion',
          resultResourceId: versionId,
        });
      }

      // Business mutation staging complete → append SUCCESS audit before commit
      // (D04/D05 injection points, where present, land between staging and here).
      await this.appendSuccessAudit(client, claims, 'platform_plan_version.limits_replaced', versionId, {
        planId,
        limitCount: String(proposed.length),
        unlimitedCount: String(proposed.filter((p) => p.unlimited).length),
        expectedVersion: String(body.expectedRowVersion),
        result: 'success',
      });

      await this.maybeFail('before_transaction_commit');
    });

      return this.getLimits(claims, planId, versionId);
    } catch (err) {
      const recovered = await this.recoverEquivalentReplay(
        claim,
        'plan.replaceLimits',
        claims.sub,
        err,
        (id) => this.getLimits(claims, planId, id),
      );
      if (recovered) return recovered;
      throw err;
    }
  }

  async getEntitlementPreview(claims: JwtClaimsVO, planId: string, versionId: string) {
    const permissions = await this.perms(claims);
    this.require(permissions, 'plan-entitlement.view');
    this.enforceRateLimit(claims.sub, 'readHeavy');
    return this.prisma.withPlatformBypass(async (client) => {
      const ctx = await this.loadVersionContext(client, planId, versionId);
      const entitlements = await client.platformPlanVersionEntitlement.findMany({
        where: { planVersionId: versionId },
        include: { catalogItem: true },
      });
      const keys = entitlements.map((e) => e.catalogItem.canonicalKey);
      const evaluation = await this.evaluateEntitlementSet(client, keys);
      const limits = await client.platformPlanVersionLimit.findMany({
        where: { planVersionId: versionId },
        include: { catalogItem: true },
      });
      return {
        disclaimer:
          'This preview is a commercial Plan Version definition. It is not a tenant runtime entitlement decision.',
        planId,
        planVersionId: versionId,
        planKey: ctx.plan.canonicalKey,
        explicitCapabilities: keys.sort(),
        modules: keys.filter((k) => k.startsWith('module.')),
        features: keys.filter((k) => k.startsWith('feature.')),
        facilityTypes: keys.filter((k) => k.startsWith('facility_type.')),
        specialties: keys.filter((k) => k.startsWith('specialty.')),
        missingDependencies: evaluation.missingRequired,
        incompatibilities: evaluation.compatibility.violations,
        compatibilityWarnings: evaluation.compatibility.warnings,
        configuredLimits: limits.map((l) => ({
          canonicalKey: l.catalogItem.canonicalKey,
          unlimited: l.unlimited,
          valueText: l.valueText,
        })),
        runtimeEffective: false,
      };
    });
  }

  /** Shared readiness computation for Step 14 + publish gate. */
  async computeCommercialReadiness(
    client: Prisma.TransactionClient | PrismaService,
    plan: { lifecycle: string; canonicalKey: string },
    version: {
      id: string;
      lifecycle: string;
      translations: Array<{ locale: string; releaseLabel: string; shortDescription: string }>;
    },
  ) {
    const blockers: Array<{ code: string; message: string; category: string }> = [];
    const warnings: Array<{ code: string; message: string; category: string }> = [];

    if (plan.lifecycle !== 'ACTIVE') {
      blockers.push({
        code: 'plan_not_active',
        message: 'Plan must be ACTIVE to publish.',
        category: 'metadata',
      });
    }
    if (version.lifecycle !== 'DRAFT') {
      blockers.push({
        code: 'version_not_draft',
        message: 'Only Draft versions can be published.',
        category: 'metadata',
      });
    }
    const locales = new Set(version.translations.map((t) => t.locale));
    const translationReady = locales.has('en-US') && locales.has('ar-SY');
    if (!translationReady) {
      blockers.push({
        code: 'missing_translations',
        message: 'en-US and ar-SY release labels are required.',
        category: 'translation',
      });
    }
    for (const tr of version.translations) {
      if (!tr.releaseLabel.trim() || !tr.shortDescription.trim()) {
        blockers.push({
          code: 'incomplete_translation',
          message: `Incomplete translation ${tr.locale}`,
          category: 'translation',
        });
      }
    }

    const entitlementRows = await (client as Prisma.TransactionClient).platformPlanVersionEntitlement.findMany({
      where: { planVersionId: version.id },
      include: { catalogItem: true },
    });
    const keys = entitlementRows.map((e) => e.catalogItem.canonicalKey);
    if (keys.length === 0) {
      warnings.push({
        code: 'empty_entitlement_set',
        message: 'No explicit entitlements selected. Empty set is allowed but unusual.',
        category: 'entitlement',
      });
    }
    for (const row of entitlementRows) {
      if (!(ENTITLEMENT_ELIGIBLE_KINDS as readonly string[]).includes(row.catalogItem.kind)) {
        blockers.push({
          code: 'entitlement_invalid_kind',
          message: `Invalid entitlement kind for ${row.catalogItem.canonicalKey}`,
          category: 'entitlement',
        });
      }
      if (row.catalogItem.lifecycle === 'RETIRED') {
        blockers.push({
          code: 'entitlement_retired_item',
          message: `Retired Catalog item entitled: ${row.catalogItem.canonicalKey}`,
          category: 'catalog_lifecycle',
        });
      }
      if (row.catalogItem.lifecycle === 'DEPRECATED') {
        warnings.push({
          code: 'deprecated_catalog_item',
          message: `Deprecated Catalog item entitled: ${row.catalogItem.canonicalKey}`,
          category: 'catalog_lifecycle',
        });
      }
    }

    const evaluation = await this.evaluateEntitlementSet(client as Prisma.TransactionClient, keys);
    for (const miss of evaluation.missingRequired) {
      blockers.push({
        code: 'missing_required_dependency',
        message: `Missing required dependency: ${miss}`,
        category: 'dependency',
      });
    }
    for (const v of evaluation.compatibility.violations) {
      blockers.push({
        code: v.reasonCode || 'incompatible_entitlements',
        message: v.message,
        category: 'compatibility',
      });
    }
    for (const w of evaluation.compatibility.warnings) {
      warnings.push({
        code: w.reasonCode || 'compatibility_warning',
        message: w.message,
        category: 'compatibility',
      });
    }

    const limitRows = await (client as Prisma.TransactionClient).platformPlanVersionLimit.findMany({
      where: { planVersionId: version.id },
      include: {
        catalogItem: { include: { owningModule: { select: { canonicalKey: true } } } },
      },
    });
    const entitledKeys = new Set(keys);
    for (const row of limitRows) {
      const meta: CatalogLimitMeta = {
        canonicalKey: row.catalogItem.canonicalKey,
        kind: row.catalogItem.kind,
        lifecycle: row.catalogItem.lifecycle,
        limitValueType: row.catalogItem.limitValueType as never,
        limitUnit: row.catalogItem.limitUnit,
        limitMin: row.catalogItem.limitMin?.toString() ?? null,
        limitMax: row.catalogItem.limitMax?.toString() ?? null,
        limitZeroValid: row.catalogItem.limitZeroValid,
        limitUnlimitedSupported: row.catalogItem.limitUnlimitedSupported,
        owningModuleCanonicalKey: row.catalogItem.owningModule?.canonicalKey ?? null,
        owningFeatureCanonicalKey: null,
      };
      const issues = validateLimitAssignment(
        {
          canonicalKey: row.catalogItem.canonicalKey,
          unlimited: row.unlimited,
          valueText: row.valueText,
        },
        meta,
        entitledKeys,
      );
      for (const issue of issues) {
        blockers.push({
          code: issue.code,
          message: issue.message,
          category: 'limit',
        });
      }
    }

    // Step 15 commercial definition SoR exists (catalog may be empty).
    // Publication readiness does not require Add-on/Override definitions.

    const metadataReady = !blockers.some((b) => b.category === 'metadata' || b.category === 'translation');
    const entitlementReady = !blockers.some((b) => b.category === 'entitlement');
    const dependencyReady = !blockers.some((b) => b.category === 'dependency');
    const compatibilityReady = !blockers.some((b) => b.category === 'compatibility');
    const limitReady = !blockers.some((b) => b.category === 'limit');
    const catalogLifecycleReady = !blockers.some((b) => b.category === 'catalog_lifecycle');
    const publicationReady =
      metadataReady &&
      entitlementReady &&
      dependencyReady &&
      compatibilityReady &&
      limitReady &&
      catalogLifecycleReady;

    return {
      metadataReady,
      translationReady,
      translationsReady: translationReady,
      entitlementReady,
      entitlementsReady: entitlementReady,
      dependencyReady,
      dependenciesReady: dependencyReady,
      compatibilityReady,
      limitReady,
      limitsReady: limitReady,
      catalogLifecycleReady,
      entitlementReadiness: {
        status: entitlementReady && dependencyReady && compatibilityReady ? 'available' : 'not_ready',
        reason: publicationReady ? 'commercial_definition_ready' : 'commercial_definition_incomplete',
      },
      addonReadiness: { status: 'available' as const, reason: 'step_15_commercial_definition' },
      overrideReadiness: { status: 'available' as const, reason: 'step_15_commercial_definition' },
      addOns: { status: 'available' as const, reason: 'step_15_commercial_definition' },
      overrides: { status: 'available' as const, reason: 'step_15_commercial_definition' },
      subscriptionEligibility: false,
      runtimeEffective: false,
      publicationReady,
      blockers,
      warnings,
    };
  }

  async evaluateEntitlementSet(
    client: Prisma.TransactionClient,
    selectedKeys: string[],
  ): Promise<{
    missingRequired: string[];
    compatibility: ReturnType<typeof evaluateCompatibilitySelection>;
  }> {
    const items = await client.healthcareCatalogItem.findMany({
      select: { id: true, canonicalKey: true, kind: true, lifecycle: true },
    });
    const rules = await client.healthcareCatalogCompatibilityRule.findMany({
      where: { lifecycle: { in: ['ACTIVE', 'DEPRECATED'] } },
      include: {
        subject: { select: { canonicalKey: true } },
        target: { select: { canonicalKey: true } },
      },
    });
    const catalog: EvalCatalogItem[] = items.map((i) => ({
      canonicalKey: i.canonicalKey,
      kind: i.kind,
      lifecycle: i.lifecycle as never,
    }));
    const evalRules: EvalRule[] = rules.map((r) => ({
      id: r.id,
      ruleType: r.ruleType as never,
      subjectKey: r.subject.canonicalKey,
      targetKey: r.target.canonicalKey,
      anyOfGroupKey: r.anyOfGroupKey ?? '',
      lifecycle: r.lifecycle as never,
    }));

    const moduleKeys = selectedKeys.filter((k) => k.startsWith('module.'));
    const featureKeys = selectedKeys.filter((k) => k.startsWith('feature.'));
    const specialtyKeys = selectedKeys.filter((k) => k.startsWith('specialty.'));
    const facilityTypeKey = selectedKeys.find((k) => k.startsWith('facility_type.'));

    const commercialRules = rulesForCommercialEntitlementReadiness(evalRules);
    const compatibility = evaluateCompatibilitySelection(
      {
        facilityTypeKey,
        specialtyKeys,
        moduleKeys,
        featureKeys,
      },
      catalog,
      commercialRules,
    );

    const selected = new Set(selectedKeys);
    const missingRequired: string[] = [];
    for (const rule of commercialRules.filter((r) => r.ruleType === 'REQUIRES')) {
      if (selected.has(rule.subjectKey) && !selected.has(rule.targetKey)) {
        missingRequired.push(rule.targetKey);
      }
    }
    // REQUIRES_ANY_OF: if subject selected and none of group present
    const anyOfGroups = new Map<string, { subject: string; targets: string[] }>();
    for (const rule of commercialRules.filter((r) => r.ruleType === 'REQUIRES_ANY_OF')) {
      if (!selected.has(rule.subjectKey)) continue;
      const gk = `${rule.subjectKey}::${rule.anyOfGroupKey}`;
      const g = anyOfGroups.get(gk) ?? { subject: rule.subjectKey, targets: [] };
      g.targets.push(rule.targetKey);
      anyOfGroups.set(gk, g);
    }
    for (const g of anyOfGroups.values()) {
      if (!g.targets.some((t) => selected.has(t))) {
        // Surface first target as missing representative for helper; helper adds all? Spec says add required.
        // For ANY_OF we don't auto-pick — report as missing dependency set.
        missingRequired.push(...g.targets);
      }
    }

    return {
      missingRequired: [...new Set(missingRequired)].sort(),
      compatibility,
    };
  }

  private async loadVersionContext(
    client: Prisma.TransactionClient | PrismaService,
    planId: string,
    versionId: string,
  ) {
    const plan = await (client as Prisma.TransactionClient).platformPlan.findUnique({
      where: { id: planId },
    });
    const version = await (client as Prisma.TransactionClient).platformPlanVersion.findFirst({
      where: { id: versionId, planId },
      include: { translations: true },
    });
    if (!plan || !version) throw new NotFoundException('Plan Version not found.');
    return { plan, version };
  }
}
