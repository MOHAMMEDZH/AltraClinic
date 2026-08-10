import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/prisma.service';
import { isPlatformAuditSentinelTenantId } from '../../platform-tenants/platform-tenants.tokens';
import { composeCommercialPreview } from '../../platform-addons/domain/commercial-composition';
import {
  computeSubscriptionCommercialFingerprint,
  SUBSCRIPTION_COMMERCIAL_FINGERPRINT_SCHEMA,
} from '../../platform-subscriptions/domain/subscription-commercial-fingerprint';
import {
  EFFECTIVE_ENTITLEMENT_RESOLVER_SCHEMA,
  type EffectiveEntitlementBundle,
  type EffectiveLimit,
  type EntitlementDecision,
  type EntitlementExplanation,
} from '../domain/effective-entitlement.types';
import {
  normalizeCanonicalKey,
  validateCommercialSnapshotPayload,
} from '../domain/snapshot-validation';
import {
  buildEffectiveEntitlementCacheKey,
  EffectiveEntitlementCache,
  identityFromProbe,
} from './effective-entitlement.cache';
import {
  classifyRuntimeProvenance,
  isRuntimeDenyCode,
  type RuntimeAuthorityProbe,
} from '../domain/runtime-provenance';

export type EffectiveEntitlementClock = () => Date;

@Injectable()
export class EffectiveEntitlementRuntimeService {
  private readonly logger = new Logger(EffectiveEntitlementRuntimeService.name);
  private cache = new EffectiveEntitlementCache();
  private clock: EffectiveEntitlementClock = () => new Date();
  /** Test-only failure injection. Production leaves unset. */
  private failureHook?: (point: string) => void | Promise<void>;

  constructor(private readonly prisma: PrismaService) {}

  /** Test seam — injectable UTC clock. */
  setClock(clock: EffectiveEntitlementClock): void {
    this.clock = clock;
  }

  /** Test seam — never registered by production module. */
  setFailureHook(hook?: (point: string) => void | Promise<void>): void {
    this.failureHook = hook;
  }

  /** Test seam — independent process-local cache for multi-instance graphs. */
  replaceCacheForTests(cache: EffectiveEntitlementCache): void {
    this.cache = cache;
  }

  invalidateTenant(tenantId: string): void {
    this.cache.invalidateTenant(tenantId);
  }

  private async maybeFail(point: string): Promise<void> {
    if (this.failureHook) await this.failureHook(point);
  }

  private nowIso(): string {
    return this.clock().toISOString();
  }

  async resolveEffectiveEntitlements(tenantId: string): Promise<EffectiveEntitlementBundle> {
    if (isPlatformAuditSentinelTenantId(tenantId)) {
      return this.denyBundle(tenantId, 'tenant_not_found');
    }
    await this.maybeFail('after_tenant_resolution');

    // Option B: always re-read authoritative identity from PostgreSQL before cache.
    const probe = await this.classifyAuthority(tenantId);
    await this.maybeFail('after_provenance_classification');

    const identity = identityFromProbe({
      tenantId,
      provenance: probe.provenance,
      source: probe.source,
      lifecycle: probe.lifecycle,
      snapshotId: probe.snapshotId,
      fingerprint: probe.fingerprint,
    });
    const cacheKey = buildEffectiveEntitlementCacheKey({
      tenantId,
      provenance: probe.provenance,
      source: probe.source,
      lifecycle: probe.lifecycle,
      snapshotId: probe.snapshotId,
      fingerprint: probe.fingerprint,
    });

    await this.maybeFail('before_cache_lookup');
    return this.cache.singleFlight(cacheKey, identity, async () => {
      await this.maybeFail('after_cache_lookup');
      if (probe.source === 'LEGACY') {
        return this.legacyBundle(tenantId, probe.code, probe.provenance);
      }
      if (probe.errorCode || !probe.snapshotId) {
        return this.denyBundle(tenantId, probe.errorCode ?? probe.code, {
          source: 'SNAPSHOT',
          provenance: probe.provenance,
          configId: probe.configId,
          snapshotId: probe.snapshotId,
          fingerprint: probe.fingerprint,
          lifecycle: probe.lifecycle,
          platformTenantId: probe.platformTenantId,
        });
      }
      const resolved = await this.resolveFromSnapshot(tenantId, probe);
      return { ...resolved, provenance: probe.provenance };
    });
  }

  async canUseModule(tenantId: string, moduleKey: string): Promise<EntitlementDecision> {
    const key = normalizeCanonicalKey(moduleKey);
    const evaluatedAt = this.nowIso();
    if (!key) {
      return { allowed: false, code: 'canonical_key_invalid', source: 'SNAPSHOT', evaluatedAt };
    }
    if (key === 'plan.business') {
      return { allowed: false, code: 'plan_business_rejected', source: 'SNAPSHOT', evaluatedAt };
    }
    const bundle = await this.resolveEffectiveEntitlements(tenantId);
    const canonical = key.startsWith('module.') ? key : `module.${key}`;
    const alt = key.includes('.') ? key : this.toCatalogModule(key);
    const allowed =
      bundle.modules.includes(canonical) ||
      bundle.modules.includes(alt) ||
      bundle.modules.includes(key);
    return {
      allowed: allowed && !this.isLifecycleDeny(bundle),
      code: this.isLifecycleDeny(bundle)
        ? bundle.code
        : allowed
          ? 'module_allowed'
          : 'module_denied',
      source: bundle.source,
      sourceId: bundle.configId ?? bundle.snapshotId,
      fingerprint: bundle.fingerprint,
      evaluatedAt,
    };
  }

  async canUseFeature(tenantId: string, featureKey: string): Promise<EntitlementDecision> {
    const key = normalizeCanonicalKey(featureKey);
    const evaluatedAt = this.nowIso();
    if (!key) {
      return { allowed: false, code: 'canonical_key_invalid', source: 'SNAPSHOT', evaluatedAt };
    }
    const bundle = await this.resolveEffectiveEntitlements(tenantId);
    const canonical = key.startsWith('feature.') ? key : `feature.${this.toSnake(key)}`;
    const allowed =
      bundle.features.includes(canonical) ||
      bundle.features.includes(key) ||
      bundle.features.includes(`feature.${key}`);
    return {
      allowed: allowed && !this.isLifecycleDeny(bundle),
      code: this.isLifecycleDeny(bundle)
        ? bundle.code
        : allowed
          ? 'feature_allowed'
          : 'feature_denied',
      source: bundle.source,
      sourceId: bundle.configId ?? bundle.snapshotId,
      fingerprint: bundle.fingerprint,
      evaluatedAt,
    };
  }

  async canUseSpecialty(tenantId: string, specialtyKey: string): Promise<EntitlementDecision> {
    const key = normalizeCanonicalKey(specialtyKey);
    const evaluatedAt = this.nowIso();
    if (!key) {
      return { allowed: false, code: 'canonical_key_invalid', source: 'SNAPSHOT', evaluatedAt };
    }
    const bundle = await this.resolveEffectiveEntitlements(tenantId);
    const allowed = bundle.specialties.includes(key);
    return {
      allowed: allowed && !this.isLifecycleDeny(bundle),
      code: this.isLifecycleDeny(bundle)
        ? bundle.code
        : allowed
          ? 'specialty_allowed'
          : 'specialty_denied',
      source: bundle.source,
      sourceId: bundle.configId ?? bundle.snapshotId,
      fingerprint: bundle.fingerprint,
      evaluatedAt,
    };
  }

  async getLimit(tenantId: string, limitKey: string): Promise<EffectiveLimit> {
    const key = normalizeCanonicalKey(limitKey);
    const evaluatedAt = this.nowIso();
    if (!key) {
      return {
        state: 'UNCONFIGURED',
        code: 'canonical_key_invalid',
        source: 'SNAPSHOT',
        evaluatedAt,
      };
    }
    const bundle = await this.resolveEffectiveEntitlements(tenantId);
    if (this.isLifecycleDeny(bundle)) {
      return {
        state: 'UNCONFIGURED',
        code: bundle.code,
        source: bundle.source,
        sourceId: bundle.configId,
        fingerprint: bundle.fingerprint,
        evaluatedAt,
      };
    }
    const canonical = key.startsWith('limit.') ? key : `limit.${this.toSnake(key)}`;
    return (
      bundle.limits[canonical] ??
      bundle.limits[key] ?? {
        state: 'UNCONFIGURED',
        code: 'limit_unconfigured',
        source: bundle.source,
        sourceId: bundle.configId,
        fingerprint: bundle.fingerprint,
        evaluatedAt,
      }
    );
  }

  async explainEntitlement(
    tenantId: string,
    entitlementKey: string,
  ): Promise<EntitlementExplanation> {
    const key = normalizeCanonicalKey(entitlementKey) ?? entitlementKey;
    const bundle = await this.resolveEffectiveEntitlements(tenantId);
    const evaluatedAt = this.nowIso();
    let allowed = false;
    let code = 'entitlement_denied';
    let catalogKind: string | undefined;
    let limitState: string | undefined;

    if (key.startsWith('limit.') || (!key.includes('.') && key.startsWith('max'))) {
      const limit = await this.getLimit(tenantId, key);
      allowed = limit.state === 'CONFIGURED' || limit.state === 'UNLIMITED';
      code = limit.code;
      catalogKind = 'LIMIT';
      limitState = limit.state;
    } else if (key.startsWith('module.') || await this.isModuleish(key)) {
      const d = await this.canUseModule(tenantId, key);
      allowed = d.allowed;
      code = d.code;
      catalogKind = 'MODULE';
    } else if (key.startsWith('feature.')) {
      const d = await this.canUseFeature(tenantId, key);
      allowed = d.allowed;
      code = d.code;
      catalogKind = 'FEATURE';
    } else {
      const d = await this.canUseSpecialty(tenantId, key);
      allowed = d.allowed;
      code = d.code;
      catalogKind = 'SPECIALTY';
    }

    return {
      key,
      catalogKind,
      allowed,
      code,
      source: bundle.source,
      sourceId: bundle.configId,
      snapshotId: bundle.snapshotId,
      fingerprintSchema: bundle.fingerprintSchema,
      fingerprint: bundle.fingerprint,
      planCanonicalKey: bundle.planCanonicalKey,
      planVersionNumber: bundle.planVersionNumber,
      lifecycle: bundle.lifecycle,
      limitState,
      evaluatedAt,
      attribution: [
        {
          code: bundle.source === 'LEGACY' ? 'legacy_runtime' : 'snapshot_runtime',
          source: bundle.source,
          canonicalKey: key,
        },
      ],
    };
  }

  private isLifecycleDeny(bundle: EffectiveEntitlementBundle): boolean {
    return isRuntimeDenyCode(bundle.code);
  }

  private async isModuleish(key: string): Promise<boolean> {
    return !key.includes('.') || key.startsWith('module.');
  }

  private toSnake(key: string): string {
    return key.replace(/([A-Z])/g, '_$1').toLowerCase().replace(/^_/, '');
  }

  private toCatalogModule(licensedId: string): string {
    return `module.${this.toSnake(licensedId)}`;
  }

  private denyBundle(
    tenantId: string,
    code: string,
    extra: Partial<EffectiveEntitlementBundle> = {},
  ): EffectiveEntitlementBundle {
    const { code: _ignored, ...safeExtra } = extra;
    return {
      source: safeExtra.source ?? 'SNAPSHOT',
      tenantId,
      modules: [],
      features: [],
      specialties: [],
      limits: {},
      evaluatedAt: this.nowIso(),
      resolverSchema: EFFECTIVE_ENTITLEMENT_RESOLVER_SCHEMA,
      ...safeExtra,
      code,
    };
  }

  private legacyBundle(
    tenantId: string,
    code: string,
    provenance = 'NEVER_MANAGED',
  ): EffectiveEntitlementBundle {
    return {
      source: 'LEGACY',
      code,
      provenance,
      tenantId,
      modules: [],
      features: [],
      specialties: [],
      limits: {},
      evaluatedAt: this.nowIso(),
      resolverSchema: EFFECTIVE_ENTITLEMENT_RESOLVER_SCHEMA,
    };
  }

  /**
   * Authoritative identity classification from Step 16 history.
   * Never selects by createdAt. Legacy only for NEVER_MANAGED.
   */
  private async classifyAuthority(tenantId: string): Promise<RuntimeAuthorityProbe> {
    const platformTenant = await this.prisma.platformTenant.findUnique({
      where: { tenantId },
      select: { id: true, status: true },
    });
    if (!platformTenant) {
      // No platform tenant: treat as never-managed for Clinic tenants without PlatformTenant row.
      return {
        provenance: 'NEVER_MANAGED',
        source: 'LEGACY',
        code: 'legacy_never_managed',
      };
    }

    // Flexible Step 19 — SUSPENDED/ARCHIVED are authoritative denies on every resolve
    // so warmed EER cache keys cannot preserve allow after lifecycle actions.
    // PROVISIONING must NOT short-circuit here: Step 17 AWAITING_ACTIVATION tenants remain
    // PROVISIONING while commercial SNAPSHOT yields runtime_pending_activation (not LEGACY).
    if (platformTenant.status === 'SUSPENDED' || platformTenant.status === 'ARCHIVED') {
      const code =
        platformTenant.status === 'SUSPENDED'
          ? 'platform_tenant_suspended'
          : 'platform_tenant_archived';
      return {
        provenance: 'AUTHORITATIVE_SUSPENDED',
        source: 'SNAPSHOT',
        code,
        errorCode: code,
        platformTenantId: platformTenant.id,
        lifecycle: platformTenant.status,
      };
    }

    const [configCount, snapshotCount, fingerprintCount, terminalConfigCount, activatedConfigCount, currents] =
      await Promise.all([
        this.prisma.platformSubscriptionCommercialConfig.count({
          where: { platformTenantId: platformTenant.id },
        }),
        this.prisma.platformSubscriptionCommercialSnapshot.count({
          where: { config: { platformTenantId: platformTenant.id } },
        }),
        this.prisma.platformSubscriptionCommercialConfig.count({
          where: {
            platformTenantId: platformTenant.id,
            commercialFingerprint: { not: null },
          },
        }),
        this.prisma.platformSubscriptionCommercialConfig.count({
          where: {
            platformTenantId: platformTenant.id,
            lifecycle: { in: ['CANCELLED', 'EXPIRED', 'SUPERSEDED'] },
          },
        }),
        this.prisma.platformSubscriptionCommercialConfig.count({
          where: {
            platformTenantId: platformTenant.id,
            activatedAt: { not: null },
          },
        }),
        this.prisma.platformSubscriptionCommercialConfig.findMany({
          where: { platformTenantId: platformTenant.id, isCurrent: true },
          include: { snapshots: true },
        }),
      ]);
    await this.maybeFail('after_current_configuration_resolution');

    let probe = classifyRuntimeProvenance({
      platformTenantId: platformTenant.id,
      configCount,
      snapshotCount,
      fingerprintCount,
      terminalConfigCount,
      activatedConfigCount,
      currentCount: currents.length,
      currents: currents.map((c) => ({
        id: c.id,
        lifecycle: c.lifecycle,
        predecessorId: c.predecessorId,
        platformTenantId: c.platformTenantId,
        snapshot: c.snapshots[0]
          ? { id: c.snapshots[0].id, fingerprint: c.snapshots[0].fingerprint }
          : null,
      })),
    });

    if (probe.predecessorHandoff && currents[0]?.predecessorId) {
      await this.maybeFail('after_predecessor_chain_resolution');
      probe = await this.resolvePredecessorHandoff(probe, currents[0].predecessorId, platformTenant.id);
    }

    return probe;
  }

  private async resolvePredecessorHandoff(
    probe: RuntimeAuthorityProbe,
    predecessorId: string,
    platformTenantId: string,
  ): Promise<RuntimeAuthorityProbe> {
    const seen = new Set<string>();
    let currentId: string | null = predecessorId;
    let hops = 0;

    while (currentId) {
      if (seen.has(currentId) || hops > 32) {
        return {
          provenance: 'AUTHORITATIVE_INVALID',
          source: 'SNAPSHOT',
          code: 'runtime_predecessor_loop',
          errorCode: 'runtime_predecessor_loop',
          configId: probe.configId,
          lifecycle: probe.lifecycle,
          platformTenantId,
        };
      }
      seen.add(currentId);
      hops += 1;

      type PredWalkRow = {
        id: string;
        platformTenantId: string;
        lifecycle: string;
        predecessorId: string | null;
        snapshots: Array<{ id: string; fingerprint: string }>;
      };
      const pred = (await this.prisma.platformSubscriptionCommercialConfig.findUnique({
        where: { id: currentId },
        include: { snapshots: true },
      })) as PredWalkRow | null;
      if (!pred) {
        return {
          provenance: 'AUTHORITATIVE_INVALID',
          source: 'SNAPSHOT',
          code: 'runtime_predecessor_missing',
          errorCode: 'runtime_predecessor_missing',
          configId: probe.configId,
          lifecycle: probe.lifecycle,
          platformTenantId,
        };
      }
      if (pred.platformTenantId !== platformTenantId) {
        return {
          provenance: 'AUTHORITATIVE_INVALID',
          source: 'SNAPSHOT',
          code: 'runtime_predecessor_cross_tenant',
          errorCode: 'runtime_predecessor_cross_tenant',
          configId: probe.configId,
          lifecycle: probe.lifecycle,
          platformTenantId,
        };
      }

      // Prefer last runtime-effective active/suspended predecessor with snapshot.
      if (
        (pred.lifecycle === 'ACTIVE_COMMERCIAL' ||
          pred.lifecycle === 'SUSPENDED' ||
          pred.lifecycle === 'SUPERSEDED') &&
        pred.snapshots[0]
      ) {
        if (pred.lifecycle === 'SUSPENDED') {
          return {
            provenance: 'AUTHORITATIVE_SUSPENDED',
            source: 'SNAPSHOT',
            code: 'runtime_suspended',
            errorCode: 'runtime_suspended',
            configId: pred.id,
            snapshotId: pred.snapshots[0].id,
            fingerprint: pred.snapshots[0].fingerprint,
            lifecycle: 'SUSPENDED',
            platformTenantId,
            predecessorHandoff: true,
          };
        }
        // SUPERSEDED or was active — use its activation snapshot.
        return {
          provenance: 'AUTHORITATIVE_PENDING_SUCCESSOR',
          source: 'SNAPSHOT',
          code: 'snapshot_active',
          configId: pred.id,
          snapshotId: pred.snapshots[0].id,
          fingerprint: pred.snapshots[0].fingerprint,
          lifecycle: pred.lifecycle === 'SUPERSEDED' ? 'ACTIVE_COMMERCIAL' : pred.lifecycle,
          platformTenantId,
          predecessorHandoff: true,
        };
      }

      // Walk further if predecessor itself is Draft/Scheduled with another predecessor.
      const nextPredecessorId: string | null =
        (pred.lifecycle === 'DRAFT' || pred.lifecycle === 'SCHEDULED') && pred.predecessorId
          ? pred.predecessorId
          : null;
      if (nextPredecessorId) {
        currentId = nextPredecessorId;
        continue;
      }

      return {
        provenance: 'AUTHORITATIVE_INVALID',
        source: 'SNAPSHOT',
        code: 'runtime_predecessor_inactive',
        errorCode: 'runtime_predecessor_inactive',
        configId: probe.configId,
        lifecycle: probe.lifecycle,
        platformTenantId,
      };
    }

    return {
      provenance: 'AUTHORITATIVE_INVALID',
      source: 'SNAPSHOT',
      code: 'runtime_predecessor_missing',
      errorCode: 'runtime_predecessor_missing',
      configId: probe.configId,
      lifecycle: probe.lifecycle,
      platformTenantId,
    };
  }

  private async resolveFromSnapshot(
    tenantId: string,
    probe: {
      configId?: string;
      snapshotId?: string;
      fingerprint?: string;
      lifecycle?: string;
      platformTenantId?: string;
    },
  ): Promise<EffectiveEntitlementBundle> {
    const snap = await this.prisma.platformSubscriptionCommercialSnapshot.findUnique({
      where: { id: probe.snapshotId! },
    });
    await this.maybeFail('after_snapshot_load');
    if (!snap) {
      return this.denyBundle(tenantId, 'snapshot_missing', probe);
    }

    const validated = validateCommercialSnapshotPayload({
      platformTenantId: probe.platformTenantId!,
      configId: probe.configId!,
      storedFingerprint: snap.fingerprint,
      storedSchema: snap.fingerprintSchemaVersion,
      payload: snap.snapshotPayload,
    });
    await this.maybeFail('after_snapshot_validation');
    if (!validated.ok) {
      return this.denyBundle(tenantId, validated.code, {
        ...probe,
        fingerprint: snap.fingerprint,
        fingerprintSchema: snap.fingerprintSchemaVersion,
      });
    }
    const payload = validated.payload;

    const planVersion = await this.prisma.platformPlanVersion.findUnique({
      where: { id: payload.planVersionId! },
      include: {
        plan: true,
        entitlements: { include: { catalogItem: true } },
        limits: { include: { catalogItem: true } },
      },
    });
    if (!planVersion || planVersion.publicationFingerprint !== payload.planPublicationFingerprint) {
      return this.denyBundle(tenantId, 'snapshot_fingerprint_mismatch', {
        ...probe,
        fingerprint: snap.fingerprint,
      });
    }

    const addOnVersions =
      payload.addonVersionIds.length === 0
        ? []
        : await this.prisma.platformAddOnVersion.findMany({
            where: { id: { in: payload.addonVersionIds } },
            include: {
              entitlements: { include: { catalogItem: true } },
              limitEffects: { include: { catalogItem: true } },
            },
          });
    if (addOnVersions.length !== payload.addonVersionIds.length) {
      return this.denyBundle(tenantId, 'snapshot_addon_incomplete', probe);
    }

    const overrides =
      payload.overrideIds.length === 0
        ? []
        : await this.prisma.platformCommercialOverride.findMany({
            where: { id: { in: payload.overrideIds } },
            include: { effects: { include: { catalogItem: true } } },
          });
    if (overrides.length !== payload.overrideIds.length) {
      return this.denyBundle(tenantId, 'snapshot_override_incomplete', probe);
    }

    const recomputed = computeSubscriptionCommercialFingerprint({
      platformTenantId: payload.platformTenantId,
      platformSubscriptionId: payload.platformSubscriptionId,
      planCanonicalKey: payload.planCanonicalKey,
      planVersionId: payload.planVersionId!,
      planVersionNumber: payload.planVersionNumber,
      planPublicationFingerprint: payload.planPublicationFingerprint ?? '',
      addonVersionIds: payload.addonVersionIds,
      addonFingerprints: addOnVersions.map((v) => v.publicationFingerprint ?? ''),
      overrideIds: payload.overrideIds,
      overrideFingerprints: overrides.map((o) => o.compositionFingerprint ?? o.id),
      commercialStart: payload.commercialStart,
      commercialEnd: payload.commercialEnd,
      scheduledActivationAt: payload.scheduledActivationAt,
    });
    await this.maybeFail('after_fingerprint_validation');
    if (recomputed !== snap.fingerprint) {
      this.logger.warn('effective_entitlement_fingerprint_mismatch');
      return this.denyBundle(tenantId, 'snapshot_fingerprint_mismatch', {
        ...probe,
        fingerprint: snap.fingerprint,
      });
    }

    const composition = composeCommercialPreview({
      baseEntitlements: planVersion.entitlements.map((e) => e.catalogItem.canonicalKey),
      baseLimits: planVersion.limits.map((l) => ({
        canonicalKey: l.catalogItem.canonicalKey,
        unlimited: l.unlimited,
        valueText: l.valueText,
      })),
      addOns: addOnVersions.map((v) => ({
        addOnVersionId: v.id,
        entitlements: v.entitlements.map((e) => e.catalogItem.canonicalKey),
        limitEffects: v.limitEffects.map((e) => ({
          canonicalKey: e.catalogItem.canonicalKey,
          effectType: e.effectType as 'SET_ABSOLUTE' | 'INCREASE_BY' | 'SET_UNLIMITED',
          unlimited: e.unlimited,
          valueText: e.valueText,
        })),
      })),
      overrides: overrides.map((o) => ({
        overrideId: o.id,
        effects: o.effects.map((e) => ({
          effectKind: e.effectKind as
            | 'ENTITLEMENT_GRANT'
            | 'ENTITLEMENT_SUPPRESS'
            | 'LIMIT_SET_ABSOLUTE'
            | 'LIMIT_INCREASE_BY'
            | 'LIMIT_SET_UNLIMITED',
          canonicalKey: e.catalogItem.canonicalKey,
          unlimited: e.unlimited,
          valueText: e.valueText,
        })),
      })),
    });
    await this.maybeFail('after_composition');

    if (composition.conflicts.length) {
      return this.denyBundle(tenantId, 'composition_conflict', {
        ...probe,
        fingerprint: snap.fingerprint,
        planCanonicalKey: payload.planCanonicalKey,
        planVersionNumber: payload.planVersionNumber,
      });
    }

    const modules = composition.entitlements.filter((k) => k.startsWith('module.')).sort();
    const features = composition.entitlements.filter((k) => k.startsWith('feature.')).sort();
    const specialties = composition.entitlements
      .filter((k) => k.startsWith('specialty.') || (!k.startsWith('module.') && !k.startsWith('feature.') && !k.startsWith('limit.')))
      .sort();

    const evaluatedAt = this.nowIso();
    const limits: Record<string, EffectiveLimit> = {};
    for (const l of composition.limits) {
      if (l.unlimited) {
        limits[l.canonicalKey] = {
          state: 'UNLIMITED',
          code: 'limit_unlimited',
          source: 'SNAPSHOT',
          sourceId: probe.configId,
          fingerprint: snap.fingerprint,
          evaluatedAt,
        };
      } else if (l.valueText == null || l.valueText === '') {
        limits[l.canonicalKey] = {
          state: 'UNCONFIGURED',
          code: 'limit_unconfigured',
          source: 'SNAPSHOT',
          sourceId: probe.configId,
          fingerprint: snap.fingerprint,
          evaluatedAt,
        };
      } else {
        limits[l.canonicalKey] = {
          state: 'CONFIGURED',
          value: l.valueText,
          valueType: l.valueText.includes('.') ? 'decimal' : 'integer',
          code: 'limit_configured',
          source: 'SNAPSHOT',
          sourceId: probe.configId,
          fingerprint: snap.fingerprint,
          evaluatedAt,
        };
      }
    }

    await this.maybeFail('before_cache_write');
    return {
      source: 'SNAPSHOT',
      code: 'snapshot_resolved',
      tenantId,
      platformTenantId: probe.platformTenantId,
      configId: probe.configId,
      snapshotId: probe.snapshotId,
      fingerprint: snap.fingerprint,
      fingerprintSchema: SUBSCRIPTION_COMMERCIAL_FINGERPRINT_SCHEMA,
      lifecycle: probe.lifecycle,
      planCanonicalKey: payload.planCanonicalKey,
      planVersionNumber: payload.planVersionNumber,
      modules,
      features,
      specialties,
      limits,
      evaluatedAt,
      resolverSchema: EFFECTIVE_ENTITLEMENT_RESOLVER_SCHEMA,
    };
  }
}
