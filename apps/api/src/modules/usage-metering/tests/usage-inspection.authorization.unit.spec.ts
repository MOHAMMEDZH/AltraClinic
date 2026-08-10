/**
 * Platform usage inspection permission denial (usage.view / usage.reconcile).
 */
import { ForbiddenException } from '@nestjs/common';
import { UsageInspectionService } from '../application/usage-inspection.service';
import type { JwtClaimsVO } from '../../auth/domain/value-objects/jwt-claims.vo';

const CLAIMS = {
  sub: '00000000-0000-4000-8000-000000000088',
  sessionId: '11111111-1111-4111-8111-111111111188',
} as JwtClaimsVO;

function makeInspection(permissions: string[]) {
  const authorization = {
    resolveEffectivePermissions: jest.fn(async () => permissions),
  };
  const prisma = {
    platformUsageReconciliationCheckpoint: {
      findUnique: jest.fn(async () => {
        throw new Error('must not reach repository when unauthorized');
      }),
    },
  };
  const counters = {
    getOrCreate: jest.fn(async () => {
      throw new Error('must not reach counters when unauthorized');
    }),
  };
  const periods = { resolve: jest.fn(), now: () => new Date() };
  const enforcement = { evaluate: jest.fn() };
  const reconciliation = { reconcile: jest.fn() };
  const service = new UsageInspectionService(
    prisma as never,
    authorization as never,
    counters as never,
    periods as never,
    enforcement as never,
    reconciliation as never,
  );
  return { service, prisma, counters, authorization };
}

describe('UsageInspectionService authorization', () => {
  const prev = process.env.USAGE_METERING_ENABLED;
  beforeAll(() => {
    process.env.USAGE_METERING_ENABLED = 'true';
  });
  afterAll(() => {
    process.env.USAGE_METERING_ENABLED = prev;
  });

  it('denies listMeters without usage.view', async () => {
    const { service, counters } = makeInspection(['tenant.view']);
    await expect(service.listMeters(CLAIMS, 't1')).rejects.toBeInstanceOf(ForbiddenException);
    expect(counters.getOrCreate).not.toHaveBeenCalled();
  });

  it('denies getMeter without usage.view', async () => {
    const { service, counters } = makeInspection([]);
    await expect(service.getMeter(CLAIMS, 't1', 'meter.max_users')).rejects.toBeInstanceOf(ForbiddenException);
    expect(counters.getOrCreate).not.toHaveBeenCalled();
  });

  it('denies reconcile without usage.reconcile even with usage.view', async () => {
    const { service } = makeInspection(['usage.view']);
    await expect(service.reconcile(CLAIMS, 't1', 'meter.max_users')).rejects.toBeInstanceOf(ForbiddenException);
  });
});
