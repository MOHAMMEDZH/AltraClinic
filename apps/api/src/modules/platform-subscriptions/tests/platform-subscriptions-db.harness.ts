/**
 * Safe isolated PostgreSQL harness for Step 16 commercial subscription tests.
 */
import { PrismaClient } from '@prisma/client';
import {
  assertSafePlatformTestDatabaseUrl,
  createPlatformDbSecurityClient,
  DEFAULT_PLATFORM_DB_SECURITY_URL,
  platformDbSecurityEnabled,
} from '../../auth/tests/platform-db-security.harness';
import { PlatformSubscriptionsService } from '../application/platform-subscriptions.service';
import { SubscriptionIdempotencyService } from '../application/subscription-idempotency.service';
import { CommercialCompositionService } from '../../platform-addons/application/commercial-composition.service';
import { PlatformAssuranceService } from '../../auth/application/services/platform-assurance.service';
import type {
  PlatformSubscriptionsAuditLog,
  PlatformSubscriptionsAuditRecord,
} from '../application/ports/subscription-audit-log.port';
import type { PlatformSubscriptionsConfig } from '../platform-subscriptions.tokens';
import type { SubscriptionTxFailureHook } from '../platform-subscriptions.tokens';

export {
  assertSafePlatformTestDatabaseUrl,
  createPlatformDbSecurityClient,
  DEFAULT_PLATFORM_DB_SECURITY_URL,
  platformDbSecurityEnabled,
};

export async function cleanupPlatformSubscriptionCommercialTables(
  prisma: PrismaClient,
  url = DEFAULT_PLATFORM_DB_SECURITY_URL,
): Promise<void> {
  assertSafePlatformTestDatabaseUrl(url);
  await prisma.$executeRawUnsafe(`
    TRUNCATE TABLE
      "platform_subscription_commercial_idempotency",
      "platform_subscription_commercial_changes",
      "platform_subscription_commercial_snapshots",
      "platform_subscription_override_assignments",
      "platform_subscription_addon_assignments",
      "platform_subscription_commercial_configs"
    RESTART IDENTITY CASCADE
  `);
}

export async function cleanupFixtureRuntimeSubscriptions(
  prisma: PrismaClient,
  platformTenantId: string,
): Promise<void> {
  await prisma.platformSubscription.deleteMany({ where: { platformTenantId } });
}

export function createSubscriptionsPrismaWrapper(prisma: PrismaClient) {
  return {
    withPlatformBypass: async <T>(fn: (client: PrismaClient) => Promise<T>): Promise<T> =>
      prisma.$transaction(
        async (tx) => {
          await tx.$executeRaw`SELECT set_config('app.platform_rls_bypass', 'true', true)`;
          await tx.$executeRaw`SELECT set_config('app.current_tenant_id', '', true)`;
          return fn(tx as unknown as PrismaClient);
        },
        { maxWait: 15_000, timeout: 60_000 },
      ),
  };
}

export class FakeSubscriptionAuditLog implements PlatformSubscriptionsAuditLog {
  readonly records: Array<{
    action: string;
    resourceId: string;
    actorId: string;
    details?: Record<string, unknown> | null;
  }> = [];

  async record(entry: PlatformSubscriptionsAuditRecord): Promise<void> {
    this.records.push({
      action: entry.action,
      resourceId: entry.resourceId,
      actorId: entry.actorId,
      details: entry.details,
    });
  }

  async recordInTransaction(
    _client: unknown,
    entry: PlatformSubscriptionsAuditRecord,
  ): Promise<void> {
    await this.record(entry);
  }
}

function defaultConfig(
  partial?: Partial<PlatformSubscriptionsConfig>,
): PlatformSubscriptionsConfig {
  return {
    mutationRateLimitPerMinute: partial?.mutationRateLimitPerMinute ?? 60,
    highImpactRateLimitPerMinute: partial?.highImpactRateLimitPerMinute ?? 30,
    readHeavyRateLimitPerMinute: partial?.readHeavyRateLimitPerMinute ?? 120,
  };
}

export function createSubscriptionsService(opts: {
  prisma: PrismaClient;
  permissions: string[];
  audit?: PlatformSubscriptionsAuditLog;
  stepUpFresh?: boolean;
  config?: Partial<PlatformSubscriptionsConfig>;
  failureHook?: SubscriptionTxFailureHook;
  composition?: CommercialCompositionService;
  effectiveEntitlements?: import('../../effective-entitlement-runtime/application/effective-entitlement-runtime.service').EffectiveEntitlementRuntimeService;
}): PlatformSubscriptionsService {
  const authz = {
    resolveEffectivePermissions: jest.fn(async () => opts.permissions),
  };
  const refreshRepo = {
    findBySessionId: jest.fn(async () =>
      opts.stepUpFresh === false
        ? null
        : { id: 's1', platformUserId: 'u1', isStepUpFresh: () => true },
    ),
  };
  const assurance =
    opts.stepUpFresh === false
      ? ({
          requireStepUp: jest.fn(async () => {
            const { ForbiddenException } = await import('@nestjs/common');
            throw new ForbiddenException('Fresh step-up required.');
          }),
        } as unknown as PlatformAssuranceService)
      : ({ requireStepUp: jest.fn(async () => undefined) } as unknown as PlatformAssuranceService);
  const wrapper = createSubscriptionsPrismaWrapper(opts.prisma);
  const audit = opts.audit ?? new FakeSubscriptionAuditLog();
  const idempotency = new SubscriptionIdempotencyService(wrapper as never);
  const composition =
    opts.composition ??
    ({
      preview: jest.fn(async () => ({
        runtimeEffective: false,
        disclaimer: 'Static commercial definition preview only.',
        modules: [],
        features: [],
        limits: [],
      })),
    } as unknown as CommercialCompositionService);

  return new PlatformSubscriptionsService(
    wrapper as never,
    authz as never,
    audit,
    refreshRepo as never,
    assurance,
    idempotency,
    composition,
    defaultConfig(opts.config),
    opts.failureHook,
    opts.effectiveEntitlements,
  );
}

export const ALL_SUBSCRIPTION_PERMS = [
  'subscription.view',
  'subscription.assign',
  'subscription.migrate',
  'subscription.suspend',
  'subscription.cancel',
  'plan.view',
  'addon.view',
  'override.view',
];

/** Ensures Catalog + Published Plan Version + PlatformTenant exist after destructive suite runs. */
export async function ensurePlatformSubscriptionFixtures(prisma: PrismaClient): Promise<{
  platformTenantId: string;
  publishedPlanVersionId: string;
  planCanonicalKey: string;
}> {
  const { randomUUID } = await import('crypto');
  const { PLATFORM_AUDIT_SENTINEL_TENANT_ID } = await import(
    '../../platform-tenants/platform-tenants.tokens'
  );

  if (
    !(await prisma.healthcareCatalogItem.findUnique({
      where: { canonicalKey: 'module.dashboard' },
    }))
  ) {
    const { HealthcareCatalogSeedService } = await import(
      '../../platform-healthcare-catalog/application/catalog-seed.service'
    );
    await new HealthcareCatalogSeedService({
      withPlatformBypass: async <T>(fn: (client: typeof prisma) => Promise<T>) =>
        prisma.$transaction(async (tx) => {
          await tx.$executeRaw`SELECT set_config('app.platform_rls_bypass', 'true', true)`;
          return fn(tx as unknown as typeof prisma);
        }),
    } as never).seedAll();
  }

  let published = await prisma.platformPlanVersion.findFirst({
    where: {
      lifecycle: 'PUBLISHED',
      publicationFingerprint: { not: null },
      plan: { canonicalKey: { not: 'plan.business' } },
    },
    include: { plan: true },
  });
  if (!published) {
    const { createPlansSeedService } = await import(
      '../../platform-plans/tests/platform-plans-db.harness'
    );
    await createPlansSeedService(prisma).seedAll({ includeCommercialDefinitions: true });
    const draft = await prisma.platformPlanVersion.findFirst({
      where: {
        lifecycle: 'DRAFT',
        plan: { canonicalKey: { not: 'plan.business' } },
      },
      include: {
        plan: true,
        entitlements: true,
        limits: true,
      },
      orderBy: { versionNumber: 'asc' },
    });
    if (draft) {
      const { createHash, randomUUID: rid } = await import('crypto');
      const fingerprint = createHash('sha256')
        .update(
          JSON.stringify({
            plan: draft.plan.canonicalKey,
            entitlements: draft.entitlements.map((e) => e.catalogItemId).sort(),
            limits: draft.limits.map((l) => `${l.catalogItemId}:${l.valueText}:${l.unlimited}`).sort(),
          }),
        )
        .digest('hex');
      published = await prisma.platformPlanVersion.update({
        where: { id: draft.id },
        data: {
          lifecycle: 'PUBLISHED',
          publishedAt: new Date(),
          publishedByPlatformUserId: rid(),
          publicationFingerprint: fingerprint,
          publicationReason: 'step16_test_fixture_publish',
        },
        include: { plan: true },
      });
    } else {
      published = await prisma.platformPlanVersion.findFirst({
        where: {
          lifecycle: 'PUBLISHED',
          publicationFingerprint: { not: null },
          plan: { canonicalKey: { not: 'plan.business' } },
        },
        include: { plan: true },
      });
    }
  }
  if (!published) {
    throw new Error('Published Plan Version fixture required for Step 16 tests.');
  }

  let platformTenant = await prisma.platformTenant.findFirst({
    where: {
      tenantId: { not: PLATFORM_AUDIT_SENTINEL_TENANT_ID },
      status: 'ACTIVE',
    },
  });
  if (!platformTenant) {
    const tenant = await prisma.tenant.create({
      data: {
        name: 'Step16 Fixture',
        slug: `s16-${randomUUID().slice(0, 8)}`,
        features: {},
      },
    });
    platformTenant = await prisma.platformTenant.create({
      data: {
        tenantId: tenant.id,
        displayName: 'Step16 Fixture',
        region: 'ME_SOUTH',
        plan: 'PRO',
        status: 'ACTIVE',
        provisionedBy: randomUUID(),
      },
    });
  }

  return {
    platformTenantId: platformTenant.id,
    publishedPlanVersionId: published.id,
    planCanonicalKey: published.plan.canonicalKey,
  };
}
