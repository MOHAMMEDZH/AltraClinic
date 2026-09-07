/** @vitest-environment node */
import { describe, expect, it } from 'vitest';
import {
  buildConfigListQueryParams,
  buildConfigUpsertPayload,
  buildPriceDraftPayload,
  buildPriceListQueryParams,
} from './clinical-catalog-api';

describe('clinical-catalog-api branch/scope payloads (PA-05)', () => {
  it('tenant-default config omits branchId', () => {
    const body = buildConfigUpsertPayload({
      clinicalServiceId: 'svc-1',
      enabled: true,
      branchId: null,
    });
    expect(body).toEqual({ clinicalServiceId: 'svc-1', enabled: true });
    expect(body).not.toHaveProperty('branchId');
  });

  it('branch config includes branchId', () => {
    const body = buildConfigUpsertPayload({
      clinicalServiceId: 'svc-1',
      enabled: false,
      branchId: 'branch-1',
    });
    expect(body.branchId).toBe('branch-1');
  });

  it('tenant-default price list uses scope=tenant without branchId', () => {
    const params = buildPriceListQueryParams({ scope: 'tenant' });
    expect(params).toEqual({ scope: 'tenant' });
    expect(params).not.toHaveProperty('branchId');
  });

  it('branch price list requires branchId', () => {
    const params = buildPriceListQueryParams({ scope: 'branch', branchId: 'branch-9' });
    expect(params).toEqual({ scope: 'branch', branchId: 'branch-9' });
    expect(() => buildPriceListQueryParams({ scope: 'branch' })).toThrow(/branchId/);
  });

  it('config list all-scope is explicit', () => {
    expect(buildConfigListQueryParams({ scope: 'all' })).toEqual({ scope: 'all' });
  });

  it('tenant-default price draft omits branchId', () => {
    const body = buildPriceDraftPayload({
      clinicalServiceId: 'svc-1',
      currency: 'SYP',
      unitPrice: 10,
      effectiveFrom: '2026-08-01T00:00:00.000Z',
    });
    expect(body).not.toHaveProperty('branchId');
  });

  it('branch price draft includes branchId', () => {
    const body = buildPriceDraftPayload({
      clinicalServiceId: 'svc-1',
      branchId: 'branch-9',
      currency: 'USD',
      unitPrice: 12,
      pricingUnit: 'PER_PROCEDURE',
      effectiveFrom: '2026-08-01T00:00:00.000Z',
    });
    expect(body.branchId).toBe('branch-9');
  });
});
