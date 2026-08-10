import { PlatformDashboardService } from '../application/platform-dashboard.service';
import { PLATFORM_DASHBOARD_METRICS } from '../application/metric-registry';
import type { PlatformDashboardConfig } from '../config/platform-dashboard.config';
import type { JwtClaimsVO } from '../../auth/domain/value-objects/jwt-claims.vo';
import type { MetricDto } from '../application/dto/platform-dashboard.dto';

const CONFIG: PlatformDashboardConfig = {
  cacheTtlSeconds: 60,
  staleAfterSeconds: 120,
  refreshRateLimitPerMinute: 10,
};

const CLAIMS = { sub: 'platform-user-1' } as unknown as JwtClaimsVO;

interface MockClientOverrides {
  tenantCountTotal?: number;
  tenantCountTrialing?: number;
  tenantStatusRows?: Array<{ status: string; _count: { _all: number } }>;
  tenantPlanRows?: Array<{ plan: string; _count: { _all: number } }>;
  subscriptionStatusRows?: Array<{ status: string; _count: { _all: number } }>;
  tenantFeatures?: Array<{ features: unknown }>;
  throwOnSubscriptionGroupBy?: boolean;
}

function classifyFacilityForMock(features: unknown): string {
  if (!features || typeof features !== 'object') return 'unclassified';
  const clinicProfile = (features as Record<string, unknown>).clinicProfile;
  if (!clinicProfile || typeof clinicProfile !== 'object') return 'unclassified';
  const clinicType = (clinicProfile as Record<string, unknown>).clinicType;
  if (typeof clinicType !== 'string') return 'unclassified';
  const normalized = clinicType.trim().toLowerCase();
  return ['medical', 'dental', 'beauty', 'multi'].includes(normalized) ? normalized : 'unclassified';
}

function makeMockClient(overrides: MockClientOverrides = {}) {
  return {
    platformTenant: {
      count: jest.fn(async (args?: { where?: { trialEndsAt?: unknown } }) => {
        if (args?.where?.trialEndsAt) return overrides.tenantCountTrialing ?? 0;
        return overrides.tenantCountTotal ?? 0;
      }),
      groupBy: jest.fn(async (args: { by: string[] }) => {
        if (args.by.includes('plan')) return overrides.tenantPlanRows ?? [];
        return overrides.tenantStatusRows ?? [];
      }),
    },
    platformSubscription: {
      groupBy: jest.fn(async () => {
        if (overrides.throwOnSubscriptionGroupBy) throw new Error('boom');
        return overrides.subscriptionStatusRows ?? [];
      }),
    },
    tenant: {
      findMany: jest.fn(async () => overrides.tenantFeatures ?? []),
    },
    $queryRaw: jest.fn(async () => {
      const counts = new Map<string, number>();
      for (const row of overrides.tenantFeatures ?? []) {
        const bucket = classifyFacilityForMock(row.features);
        counts.set(bucket, (counts.get(bucket) ?? 0) + 1);
      }
      return Array.from(counts.entries()).map(([bucket, count]) => ({ bucket, count }));
    }),
  };
}

function makeService(opts: {
  permissions: string[];
  client?: ReturnType<typeof makeMockClient>;
}) {
  const client = opts.client ?? makeMockClient();
  const prisma = {
    withPlatformBypass: jest.fn(async (fn: (c: unknown) => Promise<unknown>) => fn(client)),
  };
  const authz = {
    resolveEffectivePermissions: jest.fn(async () => opts.permissions),
  };
  const service = new PlatformDashboardService(
    prisma as never,
    authz as never,
    CONFIG,
  );
  return { service, prisma, authz, client };
}

function byId(metrics: MetricDto[], id: string): MetricDto {
  const found = metrics.find((m) => m.id === id);
  if (!found) throw new Error(`metric ${id} not found`);
  return found;
}

describe('PlatformDashboardService', () => {
  it('resolves tenant metrics with the mocked prisma aggregates', async () => {
    const client = makeMockClient({
      tenantCountTotal: 42,
      tenantCountTrialing: 7,
      tenantStatusRows: [
        { status: 'ACTIVE', _count: { _all: 30 } },
        { status: 'SUSPENDED', _count: { _all: 5 } },
      ],
    });
    const { service } = makeService({ permissions: ['tenant.view'], client });

    const dto = await service.getDashboard(CLAIMS);

    const total = byId(dto.metrics, 'tenant.total');
    expect(total.value).toBe(42);
    expect(total.status).toBe('available');

    const trialing = byId(dto.metrics, 'tenant.trialing');
    expect(trialing.value).toBe(7);

    const byStatus = byId(dto.metrics, 'tenant.byStatus');
    expect(byStatus.value).toBe(35); // 30 + 5, other statuses seeded at 0
    const active = byStatus.breakdown?.find((b) => b.key === 'ACTIVE');
    const archived = byStatus.breakdown?.find((b) => b.key === 'ARCHIVED');
    expect(active?.count).toBe(30);
    expect(archived?.count).toBe(0); // seeded, not omitted
  });

  it('marks metrics permission_limited (never resolved) when the caller lacks the permission', async () => {
    const { service, client } = makeService({ permissions: [] });

    const dto = await service.getDashboard(CLAIMS);

    const total = byId(dto.metrics, 'tenant.total');
    expect(total.status).toBe('permission_limited');
    expect(total.value).toBeNull();
    // The resolver must never run for an unauthorized metric.
    expect(client.platformTenant.count).not.toHaveBeenCalled();
    expect(client.platformSubscription.groupBy).not.toHaveBeenCalled();
  });

  it('does not resolve subscription data without subscription.view', async () => {
    const { service, client } = makeService({ permissions: ['tenant.view'] });

    const dto = await service.getDashboard(CLAIMS);

    expect(byId(dto.metrics, 'subscription.byStatus').status).toBe('permission_limited');
    expect(client.platformSubscription.groupBy).not.toHaveBeenCalled();
  });

  it('returns unavailable (with reasonCode, value null) — never zero — for metrics with no source', async () => {
    const { service } = makeService({
      permissions: ['plan-version.view', 'specialty.view', 'addon.view'],
    });

    const dto = await service.getDashboard(CLAIMS);

    const planVersion = byId(dto.metrics, 'planVersion.distribution');
    expect(planVersion.status).toBe('unavailable');
    expect(planVersion.value).toBeNull();
    expect(planVersion.value).not.toBe(0);
    expect(planVersion.reasonCode).toBe('no_plan_version_source');
  });

  it('does NOT label the legacy plan metric as a plan version', async () => {
    const client = makeMockClient({
      tenantPlanRows: [
        { plan: 'LITE', _count: { _all: 4 } },
        { plan: 'ENTERPRISE', _count: { _all: 1 } },
      ],
    });
    const { service } = makeService({ permissions: ['plan.view'], client });

    const dto = await service.getDashboard(CLAIMS);
    const legacy = byId(dto.metrics, 'legacyPlan.assignment');

    expect(legacy.availability).toBe('available_legacy');
    expect(legacy.value).toBe(5);
    expect(JSON.stringify(legacy).toLowerCase()).not.toContain('planversion');
    expect(legacy.breakdown?.find((b) => b.key === 'PRO')?.count).toBe(0);
  });

  it('isolates a single resolver failure as degraded without collapsing the dashboard', async () => {
    const client = makeMockClient({
      tenantCountTotal: 10,
      throwOnSubscriptionGroupBy: true,
    });
    const { service } = makeService({
      permissions: ['tenant.view', 'subscription.view'],
      client,
    });

    const dto = await service.getDashboard(CLAIMS);

    expect(byId(dto.metrics, 'tenant.total').status).toBe('available');
    expect(byId(dto.metrics, 'subscription.byStatus').status).toBe('degraded');
    expect(byId(dto.metrics, 'subscription.byStatus').value).toBeNull();
    expect(dto.warnings).toContain('partial_degraded');
  });

  it('buckets facility type into fixed labels and never exposes free text', async () => {
    const client = makeMockClient({
      tenantFeatures: [
        { features: { clinicProfile: { clinicType: 'dental' } } },
        { features: { clinicProfile: { clinicType: 'DENTAL' } } },
        { features: { clinicProfile: { clinicType: 'beauty' } } },
        { features: { clinicProfile: { clinicType: 'super-secret-free-text' } } },
        { features: {} },
        { features: null },
      ],
    });
    const { service } = makeService({ permissions: ['tenant.view'], client });

    const dto = await service.getDashboard(CLAIMS);
    const facility = byId(dto.metrics, 'facilityType.distribution');

    const keys = (facility.breakdown ?? []).map((b) => b.key);
    expect(keys).toEqual(['medical', 'dental', 'beauty', 'multi', 'unclassified']);
    expect(facility.breakdown?.find((b) => b.key === 'dental')?.count).toBe(2);
    expect(facility.breakdown?.find((b) => b.key === 'unclassified')?.count).toBe(3);
    expect(JSON.stringify(facility)).not.toContain('super-secret-free-text');
  });

  it('produces a DTO with only safe fields — no raw prisma shapes', async () => {
    const client = makeMockClient({
      tenantCountTotal: 3,
      tenantStatusRows: [{ status: 'ACTIVE', _count: { _all: 3 } }],
    });
    const { service } = makeService({
      permissions: ['tenant.view', 'subscription.view', 'plan.view'],
      client,
    });

    const dto = await service.getDashboard(CLAIMS);
    const serialized = JSON.stringify(dto);

    expect(serialized).not.toContain('_count');
    expect(serialized).not.toContain('_all');
    expect(serialized).not.toContain('"features"');
    expect(dto.attentionItems).toEqual([]);

    for (const metric of dto.metrics) {
      expect(metric.scope).toBe('platform');
      expect(['number', 'object']).toContain(typeof metric.value); // number | null
      for (const item of metric.breakdown ?? []) {
        expect(Object.keys(item).sort()).toEqual(['count', 'key', 'labelKey']);
      }
    }
  });

  it('serves cached values on a second call and bypasses cache on refresh', async () => {
    const client = makeMockClient({ tenantCountTotal: 11 });
    const { service } = makeService({ permissions: ['tenant.view'], client });

    await service.getDashboard(CLAIMS);
    await service.getDashboard(CLAIMS);
    // tenant.total resolver hit the DB only once (second call cached).
    expect(client.platformTenant.count).toHaveBeenCalledTimes(2); // total + trialing once

    await service.getDashboard(CLAIMS, { refresh: true });
    // refresh bypasses cache → resolves again.
    expect(client.platformTenant.count).toHaveBeenCalledTimes(4);
  });

  it('rate-limits manual refresh per user and warns when exhausted', async () => {
    const config: PlatformDashboardConfig = { ...CONFIG, refreshRateLimitPerMinute: 1 };
    const client = makeMockClient({ tenantCountTotal: 1 });
    const prisma = {
      withPlatformBypass: jest.fn(async (fn: (c: unknown) => Promise<unknown>) => fn(client)),
    };
    const authz = { resolveEffectivePermissions: jest.fn(async () => ['tenant.view']) };
    const service = new PlatformDashboardService(prisma as never, authz as never, config);

    const first = await service.getDashboard(CLAIMS, { refresh: true });
    expect(first.warnings).not.toContain('refresh_rate_limited');

    const second = await service.getDashboard(CLAIMS, { refresh: true });
    expect(second.warnings).toContain('refresh_rate_limited');
  });

  it('assembles the four sections and every registry metric appears exactly once', async () => {
    const { service } = makeService({ permissions: [] });
    const dto = await service.getDashboard(CLAIMS);

    expect(dto.metrics).toHaveLength(PLATFORM_DASHBOARD_METRICS.length);
    const sectionIds = dto.sections.map((s) => s.id);
    expect(sectionIds).toEqual(['footprint', 'commercial', 'operations', 'sales']);
  });
});
