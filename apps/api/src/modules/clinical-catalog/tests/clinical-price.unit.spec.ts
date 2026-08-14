/**
 * Wave A clinical price — precedence, fail-closed, append-only semantics (mocked prisma).
 */
import { ClinicalPriceVersionService } from '../application/clinical-price-version.service';
import { ClinicalPriceLookupFailClosedError, ClinicalCatalogValidationError } from '../domain/clinical-catalog.errors';
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

describe('ClinicalPriceVersionService lookup precedence', () => {
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
      clinicalServicePriceVersion: {
        findMany: jest
          .fn()
          .mockResolvedValueOnce([branchPrice])
          .mockResolvedValueOnce([]),
      },
    };

    const service = buildPriceService(client);
    const result = await service.lookupActivePrice(actor, SERVICE, BRANCH);
    expect(result.scope).toBe('branch');
    expect(result.price.id).toBe('price-branch');
  });

  it('falls back to tenant default when branch missing', async () => {
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
      clinicalServicePriceVersion: {
        findMany: jest
          .fn()
          .mockResolvedValueOnce([])
          .mockResolvedValueOnce([tenantPrice]),
      },
    };

    const service = buildPriceService(client);
    const result = await service.lookupActivePrice(actor, SERVICE, BRANCH);
    expect(result.scope).toBe('tenant');
    expect(result.price.id).toBe('price-tenant');
  });

  it('fail-closed when no ACTIVE price exists', async () => {
    const client = {
      clinicalServicePriceVersion: {
        findMany: jest.fn().mockResolvedValue([]),
      },
    };
    const service = buildPriceService(client);
    await expect(service.lookupActivePrice(actor, SERVICE, BRANCH)).rejects.toBeInstanceOf(
      ClinicalPriceLookupFailClosedError,
    );
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
