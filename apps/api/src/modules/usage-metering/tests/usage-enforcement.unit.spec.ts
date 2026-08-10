import { ForbiddenException } from '@nestjs/common';
import { UsageEnforcementService } from '../application/usage-enforcement.service';
import type { EffectiveLimit } from '../../effective-entitlement-runtime/domain/effective-entitlement.types';

function makeService(limit: EffectiveLimit, current = '0', reserved = '0') {
  const entitlements = {
    getLimit: jest.fn().mockResolvedValue(limit),
  };
  const counters = {
    getOrCreate: jest.fn().mockResolvedValue({
      currentValue: current,
      reservedValue: reserved,
      lastObservationAt: new Date(),
      lastReconciledAt: new Date(),
    }),
    projectedValue: (c: string, r: string) => String(BigInt(c) + BigInt(r)),
    classifyStale: () => 'FRESH' as const,
  };
  const periods = {
    now: () => new Date('2026-07-30T12:00:00.000Z'),
    resolve: () => ({
      periodType: 'LIFETIME' as const,
      periodStart: new Date('1970-01-01T00:00:00.000Z'),
      periodEnd: new Date('9999-12-31T23:59:59.999Z'),
    }),
  };
  const readers = { readExpected: jest.fn() };
  const svc = new UsageEnforcementService(
    {} as any,
    entitlements as any,
    counters as any,
    periods as any,
    readers as any,
  );
  return { svc, entitlements };
}

describe('UsageEnforcementService', () => {
  const prev = process.env.USAGE_METERING_ENFORCEMENT_ENABLED;
  beforeAll(() => {
    process.env.USAGE_METERING_ENABLED = 'true';
    process.env.USAGE_METERING_ENFORCEMENT_ENABLED = 'true';
  });
  afterAll(() => {
    process.env.USAGE_METERING_ENFORCEMENT_ENABLED = prev;
  });

  it('allows UNLIMITED', async () => {
    const { svc } = makeService({
      state: 'UNLIMITED',
      code: 'ok',
      source: 'SNAPSHOT',
      evaluatedAt: new Date().toISOString(),
    });
    const d = await svc.evaluate('t1', 'meter.max_users', '1');
    expect(d.allowed).toBe(true);
    expect(d.code).toBe('unlimited');
  });

  it('denies UNCONFIGURED fail-closed', async () => {
    const { svc } = makeService({
      state: 'UNCONFIGURED',
      code: 'missing',
      source: 'LEGACY',
      evaluatedAt: new Date().toISOString(),
    });
    const d = await svc.evaluate('t1', 'meter.max_users', '1');
    expect(d.allowed).toBe(false);
    expect(d.code).toBe('limit_unconfigured');
  });

  it('denies when projected exceeds CONFIGURED limit', async () => {
    const { svc } = makeService(
      {
        state: 'CONFIGURED',
        value: '1',
        valueType: 'integer',
        code: 'ok',
        source: 'SNAPSHOT',
        evaluatedAt: new Date().toISOString(),
      },
      '1',
      '0',
    );
    const d = await svc.evaluate('t1', 'meter.max_users', '1');
    expect(d.allowed).toBe(false);
    expect(d.code).toBe('limit_exceeded');
    await expect(svc.assertAllowed('t1', 'meter.max_users', '1')).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('permits when within CONFIGURED limit', async () => {
    const { svc } = makeService(
      {
        state: 'CONFIGURED',
        value: '5',
        valueType: 'integer',
        code: 'ok',
        source: 'SNAPSHOT',
        evaluatedAt: new Date().toISOString(),
      },
      '2',
      '0',
    );
    const d = await svc.evaluate('t1', 'meter.max_users', '1');
    expect(d.allowed).toBe(true);
    expect(d.projectedValue).toBe('3');
  });
});
