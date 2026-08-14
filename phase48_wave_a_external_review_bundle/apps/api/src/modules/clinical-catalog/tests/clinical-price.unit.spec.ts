/**
 * Wave A clinical price — overlap, lock key, lookup commercial identity,
 * future-effective no-gap (PA-04), foreign-branch fail-closed (PA-06).
 */
import { ClinicalPriceVersionService } from '../application/clinical-price-version.service';
import {
  ClinicalPriceLookupFailClosedError,
  ClinicalCatalogValidationError,
} from '../domain/clinical-catalog.errors';
import { FakeClinicalCatalogAuditLog } from './support/fake-clinical-catalog-audit-log';

const TENANT = '11111111-1111-4111-8111-111111111111';
const SERVICE = '33333333-3333-4333-8333-333333333333';
const BRANCH = '44444444-4444-4444-8444-444444444444';
const FOREIGN_BRANCH = '55555555-5555-4555-8555-555555555555';
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
  return new ClinicalPriceVersionService(prisma as never, audit as never);
}

describe('ClinicalPriceVersionService overlap + lock key', () => {
  const service = buildPriceService({});

  it('detects overlapping effective ranges', () => {
    const from = new Date('2026-01-01T00:00:00.000Z');
    const mid = new Date('2026-06-01T00:00:00.000Z');
    const to = new Date('2026-12-31T00:00:00.000Z');

    expect(service.rangesOverlap(from, to, mid, null)).toBe(true);
    expect(service.rangesOverlap(from, mid, to, null)).toBe(false);
  });

  it('builds deterministic commercial lock key', () => {
    const key = service.commercialLockKey({
      tenantId: TENANT,
      branchId: null,
      clinicalServiceId: SERVICE,
      pricingUnit: 'PER_VISIT',
      currency: 'syp',
      serviceVariantId: null,
    });
    expect(key).toBe(
      `clinical-price|${TENANT}|default|${SERVICE}|PER_VISIT|SYP|`,
    );
  });
});

describe('ClinicalPriceVersionService lookup commercial identity (PA-07)', () => {
  it('filters by pricingUnit/currency/serviceVariantId', async () => {
    const match = {
      id: 'price-match',
      tenantId: TENANT,
      branchId: null,
      clinicalServiceId: SERVICE,
      pricingUnit: 'PER_PROCEDURE',
      currency: 'USD',
      serviceVariantId: null,
      status: 'ACTIVE',
      effectiveFrom: new Date('2026-01-01'),
      effectiveTo: null,
    };

    const findMany = jest.fn().mockResolvedValue([match]);
    const client = {
      clinicalServicePriceVersion: { findMany },
    };

    const service = buildPriceService(client);
    const result = await service.lookupActivePrice(actor, SERVICE, null, {
      pricingUnit: 'PER_PROCEDURE',
      currency: 'usd',
      serviceVariantId: null,
    });
    expect(result.price.id).toBe('price-match');
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          pricingUnit: 'PER_PROCEDURE',
          currency: 'USD',
          serviceVariantId: null,
        }),
      }),
    );
  });

  it('rejects missing/invalid commercial dimensions', async () => {
    const service = buildPriceService({});
    await expect(
      service.lookupActivePrice(actor, SERVICE, null, {
        pricingUnit: 'NOT_A_UNIT' as never,
        currency: 'SYP',
      }),
    ).rejects.toBeInstanceOf(ClinicalCatalogValidationError);

    await expect(
      service.lookupActivePrice(actor, SERVICE, null, {
        pricingUnit: 'PER_VISIT',
        currency: 'XX',
      }),
    ).rejects.toBeInstanceOf(ClinicalCatalogValidationError);
  });
});

describe('ClinicalPriceVersionService lookup precedence + PA-06', () => {
  it('returns branch ACTIVE before tenant default', async () => {
    const branchPrice = {
      id: 'price-branch',
      tenantId: TENANT,
      branchId: BRANCH,
      clinicalServiceId: SERVICE,
      status: 'ACTIVE',
      effectiveFrom: new Date('2026-01-01'),
      effectiveTo: null,
    };

    const client = {
      branch: {
        findFirst: jest.fn().mockResolvedValue({ id: BRANCH }),
      },
      clinicalServicePriceVersion: {
        findMany: jest.fn().mockResolvedValueOnce([branchPrice]),
      },
    };

    const service = buildPriceService(client);
    const result = await service.lookupActivePrice(actor, SERVICE, BRANCH, DEFAULT_DIMS);
    expect(result.scope).toBe('branch');
    expect(result.price.id).toBe('price-branch');
  });

  it('falls back to tenant default when own branch missing override', async () => {
    const tenantPrice = {
      id: 'price-tenant',
      tenantId: TENANT,
      branchId: null,
      clinicalServiceId: SERVICE,
      status: 'ACTIVE',
      effectiveFrom: new Date('2026-01-01'),
      effectiveTo: null,
    };

    const client = {
      branch: {
        findFirst: jest.fn().mockResolvedValue({ id: BRANCH }),
      },
      clinicalServicePriceVersion: {
        findMany: jest
          .fn()
          .mockResolvedValueOnce([])
          .mockResolvedValueOnce([tenantPrice]),
      },
    };

    const service = buildPriceService(client);
    const result = await service.lookupActivePrice(actor, SERVICE, BRANCH, DEFAULT_DIMS);
    expect(result.scope).toBe('tenant');
    expect(result.price.id).toBe('price-tenant');
  });

  it('fail-closed when no ACTIVE price exists', async () => {
    const client = {
      branch: {
        findFirst: jest.fn().mockResolvedValue({ id: BRANCH }),
      },
      clinicalServicePriceVersion: {
        findMany: jest.fn().mockResolvedValue([]),
      },
    };
    const service = buildPriceService(client);
    await expect(
      service.lookupActivePrice(actor, SERVICE, BRANCH, DEFAULT_DIMS),
    ).rejects.toBeInstanceOf(ClinicalPriceLookupFailClosedError);
  });

  it('denies foreign branch before tenant fallback (PA-06)', async () => {
    const client = {
      branch: {
        findFirst: jest.fn().mockResolvedValue(null),
      },
      clinicalServicePriceVersion: {
        findMany: jest.fn(),
      },
    };
    const service = buildPriceService(client);
    await expect(
      service.lookupActivePrice(actor, SERVICE, FOREIGN_BRANCH, DEFAULT_DIMS),
    ).rejects.toBeInstanceOf(ClinicalCatalogValidationError);
    expect(client.clinicalServicePriceVersion.findMany).not.toHaveBeenCalled();
  });
});

describe('ClinicalPriceVersionService createDraft validation (PA-08)', () => {
  it('rejects negative unitPrice', async () => {
    const service = buildPriceService({
      branch: { findFirst: jest.fn() },
      canonicalClinicalServiceDefinition: {
        findUnique: jest.fn().mockResolvedValue({
          id: SERVICE,
          provenance: 'SYSTEM_CANONICAL',
          tenantId: null,
        }),
      },
    });
    await expect(
      service.createDraft(actor, {
        clinicalServiceId: SERVICE,
        currency: 'SYP',
        unitPrice: -1,
        effectiveFrom: new Date().toISOString(),
      }),
    ).rejects.toBeInstanceOf(ClinicalCatalogValidationError);
  });

  it('rejects invalid taxPercent', async () => {
    const service = buildPriceService({
      canonicalClinicalServiceDefinition: {
        findUnique: jest.fn().mockResolvedValue({
          id: SERVICE,
          provenance: 'SYSTEM_CANONICAL',
          tenantId: null,
        }),
      },
    });
    await expect(
      service.createDraft(actor, {
        clinicalServiceId: SERVICE,
        currency: 'SYP',
        unitPrice: 10,
        taxPercent: 150,
        effectiveFrom: new Date().toISOString(),
      }),
    ).rejects.toBeInstanceOf(ClinicalCatalogValidationError);
  });

  it('rejects effectiveTo <= effectiveFrom', async () => {
    const service = buildPriceService({
      canonicalClinicalServiceDefinition: {
        findUnique: jest.fn().mockResolvedValue({
          id: SERVICE,
          provenance: 'SYSTEM_CANONICAL',
          tenantId: null,
        }),
      },
    });
    await expect(
      service.createDraft(actor, {
        clinicalServiceId: SERVICE,
        currency: 'SYP',
        unitPrice: 10,
        effectiveFrom: '2026-08-01T00:00:00.000Z',
        effectiveTo: '2026-07-01T00:00:00.000Z',
      }),
    ).rejects.toBeInstanceOf(ClinicalCatalogValidationError);
  });
});

describe('ClinicalPriceVersionService append-only publish', () => {
  it('rejects publish when version is not DRAFT', async () => {
    const client = {
      clinicalServicePriceVersion: {
        findFirst: jest.fn(async () => ({
          id: 'pv-1',
          tenantId: TENANT,
          branchId: null,
          clinicalServiceId: SERVICE,
          pricingUnit: 'PER_VISIT',
          currency: 'SYP',
          serviceVariantId: null,
          status: 'ACTIVE',
          effectiveFrom: new Date(),
          effectiveTo: null,
        })),
      },
    };

    const service = buildPriceService(client);
    await expect(service.publish(actor, 'pv-1')).rejects.toBeInstanceOf(ClinicalCatalogValidationError);
  });
});

describe('ClinicalPriceVersionService future-effective publish (PA-04 append-only + non-overlap)', () => {
  it('schedules future draft without mutating prior ACTIVE commercial fields', async () => {
    const futureFrom = new Date(Date.now() + 30 * 24 * 3600 * 1000);
    const prior = {
      id: 'pv-prior',
      tenantId: TENANT,
      branchId: null,
      clinicalServiceId: SERVICE,
      pricingUnit: 'PER_VISIT',
      currency: 'SYP',
      serviceVariantId: null,
      unitPrice: { toString: () => '100' },
      taxPercent: { toString: () => '0' },
      status: 'ACTIVE',
      effectiveFrom: new Date('2026-01-01T00:00:00.000Z'),
      effectiveTo: null,
    };
    const draft = {
      ...prior,
      id: 'pv-future',
      status: 'DRAFT',
      effectiveFrom: futureFrom,
      unitPrice: { toString: () => '200' },
    };

    const updates: Array<{ id: string; data: Record<string, unknown> }> = [];
    const client = {
      $executeRawUnsafe: jest.fn().mockResolvedValue(undefined),
      clinicalServicePriceVersion: {
        findFirst: jest.fn().mockResolvedValue(draft),
        findUniqueOrThrow: jest.fn().mockResolvedValue(draft),
        findMany: jest.fn().mockResolvedValue([]),
        update: jest.fn(async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
          updates.push({ id: where.id, data });
          return { ...draft, ...data, id: where.id, status: data.status ?? draft.status };
        }),
      },
    };

    const service = buildPriceService(client);
    await service.publish(actor, 'pv-future');

    expect(updates.every((u) => u.id !== 'pv-prior')).toBe(true);
    const publishUpdate = updates.find((u) => u.id === 'pv-future');
    expect(publishUpdate?.data.status).toBe('SCHEDULED');
    expect(publishUpdate?.data.effectiveTo).toBeUndefined();
    expect(publishUpdate?.data.unitPrice).toBeUndefined();
  });
});
