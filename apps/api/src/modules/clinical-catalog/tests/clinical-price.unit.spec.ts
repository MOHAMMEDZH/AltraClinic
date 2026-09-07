/**
 * PA-04 frozen Option B — unit coverage for formulas, validation helpers, and lookup gate basics.
 */
import { ClinicalPriceVersionService } from '../application/clinical-price-version.service';
import {
  ClinicalPriceLookupFailClosedError,
  ClinicalCatalogValidationError,
  ClinicalCatalogConflictError,
} from '../domain/clinical-catalog.errors';
import { FakeClinicalCatalogAuditLog } from './support/fake-clinical-catalog-audit-log';

const TENANT = '11111111-1111-4111-8111-111111111111';
const SERVICE = '33333333-3333-4333-8333-333333333333';
const BRANCH = '44444444-4444-4444-8444-444444444444';
const ACTOR = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

const actor = {
  actorId: ACTOR,
  actorRoles: ['owner'],
  tenantId: TENANT,
  isPlatform: false,
};

const DEFAULT_DIMS = {
  pricingUnit: 'PER_VISIT' as const,
  currency: 'SYP',
  serviceVariantId: null as string | null,
};

function buildPriceService(clientImpl: Record<string, unknown>) {
  const audit = new FakeClinicalCatalogAuditLog();
  const prisma = {
    withPlatformBypass: jest.fn(async (fn: (c: unknown) => Promise<unknown>) => fn(clientImpl)),
  };
  return { service: new ClinicalPriceVersionService(prisma as never, audit as never), audit };
}

function activeRow(partial: Record<string, unknown>) {
  return {
    id: 'p1',
    tenantId: TENANT,
    branchId: null,
    clinicalServiceId: SERVICE,
    pricingUnit: 'PER_VISIT',
    currency: 'SYP',
    serviceVariantId: null,
    unitPrice: 10,
    taxPercent: 0,
    status: 'ACTIVE',
    effectiveFrom: new Date('2026-01-01T00:00:00.000Z'),
    effectiveTo: null,
    publishedAt: new Date('2026-01-01T00:00:00.000Z'),
    publishedBy: ACTOR,
    supersededAt: null,
    supersededByVersionId: null,
    inactivatedAt: null,
    inactivatedBy: null,
    ...partial,
  };
}

describe('PA-04 helpers — commercialEnd / never-effective / interval', () => {
  const { service } = buildPriceService({});

  it('T37/T38 — commercialEnd uses earliest of explicitTo, next From, inactivatedAt', () => {
    const v1 = {
      id: 'v1',
      effectiveFrom: new Date('2026-01-01'),
      effectiveTo: null as Date | null,
      inactivatedAt: null as Date | null,
      status: 'SUPERSEDED' as const,
    };
    const v2 = {
      id: 'v2',
      effectiveFrom: new Date('2026-06-01'),
      effectiveTo: null,
      inactivatedAt: null,
      status: 'ACTIVE' as const,
    };
    expect(service.commercialEnd(v1, [v1, v2])?.toISOString()).toBe(
      new Date('2026-06-01').toISOString(),
    );

    const withdrawn = {
      ...v1,
      status: 'INACTIVE' as const,
      inactivatedAt: new Date('2026-03-01'),
    };
    expect(service.commercialEnd(withdrawn, [withdrawn])?.toISOString()).toBe(
      new Date('2026-03-01').toISOString(),
    );
  });

  it('T21 — canceled-never-effective when inactivatedAt < effectiveFrom', () => {
    expect(
      service.isNeverEffective({
        effectiveFrom: new Date('2026-06-01'),
        inactivatedAt: new Date('2026-05-01'),
      }),
    ).toBe(true);
    expect(
      service.isNeverEffective({
        effectiveFrom: new Date('2026-01-01'),
        inactivatedAt: new Date('2026-05-01'),
      }),
    ).toBe(false);
  });

  it('T34 — ACTIVE outside explicit effectiveTo is not interval-valid', () => {
    const row = activeRow({
      effectiveTo: new Date('2026-05-01T00:00:00.000Z'),
    });
    expect(service.isIntervalValidAt(row as never, new Date('2026-06-01'))).toBe(false);
    expect(service.isIntervalValidAt(row as never, new Date('2026-04-01'))).toBe(true);
  });
});

describe('PA-04 lookup — ACTIVE-only after reconcile gate', () => {
  it('T1 — returns single interval-valid ACTIVE', async () => {
    const match = activeRow({ id: 'price-match' });
    const findMany = jest
      .fn()
      // loadPublishedScheduleMembers during reconcile
      .mockResolvedValueOnce([match])
      // loadActiveRows after reconcile
      .mockResolvedValueOnce([match])
      // loadActiveRows again inside resolve path — actually flow:
      // resolve: lock, reconcile (loadPublished once at start of expire loop, then members, due), loadActive
      .mockResolvedValue([match]);

    const client = {
      $executeRawUnsafe: jest.fn().mockResolvedValue(undefined),
      clinicalServicePriceVersion: {
        findMany,
        findUniqueOrThrow: jest.fn(),
        update: jest.fn(),
      },
    };

    const { service } = buildPriceService(client);
    const result = await service.lookupActivePrice(actor, SERVICE, null, DEFAULT_DIMS);
    expect(result.price.id).toBe('price-match');
    expect(result.scope).toBe('tenant');
  });

  it('T27 — zero ACTIVE fails closed', async () => {
    const client = {
      $executeRawUnsafe: jest.fn().mockResolvedValue(undefined),
      clinicalServicePriceVersion: {
        findMany: jest.fn().mockResolvedValue([]),
        update: jest.fn(),
      },
    };
    const { service } = buildPriceService(client);
    await expect(
      service.lookupActivePrice(actor, SERVICE, null, DEFAULT_DIMS),
    ).rejects.toBeInstanceOf(ClinicalPriceLookupFailClosedError);
  });

  it('T28 — multiple ACTIVE fails closed', async () => {
    const a = activeRow({ id: 'a' });
    const b = activeRow({ id: 'b', effectiveFrom: new Date('2026-02-01') });
    const client = {
      $executeRawUnsafe: jest.fn().mockResolvedValue(undefined),
      clinicalServicePriceVersion: {
        findMany: jest
          .fn()
          .mockResolvedValueOnce([a, b]) // reconcile published
          .mockResolvedValueOnce([a, b]) // after expire refresh
          .mockResolvedValueOnce([a, b]), // loadActiveRows
        update: jest.fn(),
      },
    };
    const { service } = buildPriceService(client);
    await expect(
      service.lookupActivePrice(actor, SERVICE, null, DEFAULT_DIMS),
    ).rejects.toBeInstanceOf(ClinicalCatalogConflictError);
  });

  it('rejects invalid commercial dims', async () => {
    const { service } = buildPriceService({});
    await expect(
      service.lookupActivePrice(actor, SERVICE, null, {
        pricingUnit: 'NOPE' as never,
        currency: 'SYP',
      }),
    ).rejects.toBeInstanceOf(ClinicalCatalogValidationError);
  });

  it('PA-06 foreign branch fail-closed before lookup', async () => {
    const client = {
      branch: { findFirst: jest.fn().mockResolvedValue(null) },
      $executeRawUnsafe: jest.fn(),
      clinicalServicePriceVersion: { findMany: jest.fn() },
    };
    const { service } = buildPriceService(client);
    await expect(
      service.lookupActivePrice(actor, SERVICE, BRANCH, DEFAULT_DIMS),
    ).rejects.toBeInstanceOf(ClinicalCatalogValidationError);
  });

  it('PA04-AT-04 — future at rejected', async () => {
    const { service } = buildPriceService({});
    await expect(
      service.lookupActivePrice(actor, SERVICE, null, {
        ...DEFAULT_DIMS,
        at: new Date(Date.now() + 86400000),
      }),
    ).rejects.toBeInstanceOf(ClinicalCatalogValidationError);
  });

  it('PA04-IMP-02 — manual supersede method removed', () => {
    const { service } = buildPriceService({});
    expect((service as { supersede?: unknown }).supersede).toBeUndefined();
  });
});

describe('PA-04 lock key', () => {
  it('builds deterministic commercial lock key', () => {
    const { service } = buildPriceService({});
    expect(
      service.commercialLockKey({
        tenantId: TENANT,
        branchId: null,
        clinicalServiceId: SERVICE,
        pricingUnit: 'PER_VISIT',
        currency: 'syp',
        serviceVariantId: null,
      }),
    ).toBe(`clinical-price|${TENANT}|default|${SERVICE}|PER_VISIT|SYP|`);
  });
});
