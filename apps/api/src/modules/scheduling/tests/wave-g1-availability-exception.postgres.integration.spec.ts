/**
 * Wave G1 / P1-11 — AvailabilityException SoR tenant isolation (PostgreSQL).
 *
 * Run:
 *   ALLOW_TEST_DATABASE_RESET=true RUN_PLATFORM_DB_SECURITY=true \
 *   npx jest --runInBand --testPathIgnorePatterns=[] \
 *     --testPathPattern=wave-g1-availability-exception.postgres
 */
import { randomUUID } from 'crypto';
import { PrismaClient } from '@prisma/client';
import {
  createClinicalPrismaWrapper,
  createPlatformDbSecurityClient,
  platformDbSecurityEnabled,
} from '../../clinical-catalog/tests/clinical-catalog-db.harness';
import { AvailabilityExceptionQueryService } from '../application/services/availability-exception-query.service';
import { buildProviderAvailabilitySlots } from '../application/services/availability-slot-builder';

jest.setTimeout(120_000);
const describeDb = platformDbSecurityEnabled() ? describe : describe.skip;

const BOOKING_APP_URL =
  'postgresql://booking_app:booking_app@localhost:5433/booking_test?schema=public';

function createTenantAwarePrisma(raw: PrismaClient) {
  const base = createClinicalPrismaWrapper(raw);
  return {
    ...base,
    withTenantContext: async <T>(
      tenantId: string,
      fn: (client: PrismaClient) => Promise<T>,
    ): Promise<T> =>
      raw.$transaction(
        async (tx) => {
          await tx.$executeRaw`SELECT set_config('app.current_tenant_id', ${tenantId}, true)`;
          await tx.$executeRaw`SELECT set_config('app.platform_rls_bypass', 'false', true)`;
          return fn(tx as unknown as PrismaClient);
        },
        { maxWait: 20_000, timeout: 60_000 },
      ),
  };
}

describeDb('Wave G1 AvailabilityException (PostgreSQL)', () => {
  let raw: PrismaClient;
  let wrapper: ReturnType<typeof createTenantAwarePrisma>;
  let query: AvailabilityExceptionQueryService;
  let tenantId: string;
  let otherTenantId: string;
  let branchId: string;
  let providerId: string;
  let actorId: string;
  let exceptionId: string;
  let otherExceptionId: string;

  beforeAll(async () => {
    raw = await createPlatformDbSecurityClient();
    wrapper = createTenantAwarePrisma(raw);
    query = new AvailabilityExceptionQueryService(wrapper as never);
  });

  afterAll(async () => {
    await raw.$disconnect();
  });

  beforeEach(async () => {
    tenantId = randomUUID();
    otherTenantId = randomUUID();
    branchId = randomUUID();
    providerId = randomUUID();
    actorId = randomUUID();
    exceptionId = randomUUID();
    otherExceptionId = randomUUID();

    await wrapper.withPlatformBypass(async (c) => {
      await c.tenant.create({
        data: { id: tenantId, name: 'G1 Ten', slug: `g1-${tenantId.slice(0, 8)}` },
      });
      await c.tenant.create({
        data: {
          id: otherTenantId,
          name: 'G1 Other',
          slug: `g1-o-${otherTenantId.slice(0, 8)}`,
        },
      });
      await c.branch.create({ data: { id: branchId, tenantId, name: 'Main' } });
      await c.user.create({
        data: {
          id: actorId,
          tenantId,
          email: `g1-actor-${actorId.slice(0, 8)}@test.local`,
          passwordHash: 'x',
          firstName: 'A',
          lastName: 'Ctor',
        },
      });
      await c.user.create({
        data: {
          id: providerId,
          tenantId,
          email: `g1-prov-${providerId.slice(0, 8)}@test.local`,
          passwordHash: 'x',
          firstName: 'P',
          lastName: 'Rov',
          roles: { create: [{ role: 'DOCTOR' }] },
        },
      });

      await c.availabilityException.create({
        data: {
          id: exceptionId,
          tenantId,
          branchId,
          type: 'PROVIDER_LEAVE',
          providerId,
          startsAt: new Date('2026-09-07T09:00:00.000Z'),
          endsAt: new Date('2026-09-07T10:00:00.000Z'),
          reason: 'Leave',
          createdBy: actorId,
        },
      });
      await c.availabilityException.create({
        data: {
          id: otherExceptionId,
          tenantId: otherTenantId,
          type: 'BRANCH_HOLIDAY',
          startsAt: new Date('2026-09-07T00:00:00.000Z'),
          endsAt: new Date('2026-09-07T23:59:00.000Z'),
          reason: 'Foreign holiday',
          createdBy: actorId,
        },
      });
    });
  });

  afterEach(async () => {
    await wrapper.withPlatformBypass(async (c) => {
      await c.availabilityException.deleteMany({
        where: { id: { in: [exceptionId, otherExceptionId] } },
      });
      await c.userRoleAssignment.deleteMany({
        where: { userId: { in: [providerId, actorId] } },
      });
      await c.user.deleteMany({ where: { id: { in: [providerId, actorId] } } });
      await c.branch.deleteMany({ where: { id: branchId } });
      await c.tenant.deleteMany({ where: { id: { in: [tenantId, otherTenantId] } } });
    });
  });

  it('G1-PG-01 — query loads tenant leave and denies overlapping weekly slot', async () => {
    const exceptions = await query.listOverlappingDay({
      tenantId,
      dateYmd: '2026-09-07',
      timezone: 'UTC',
      branchId,
    });
    expect(exceptions).toHaveLength(1);
    expect(exceptions[0].type).toBe('PROVIDER_LEAVE');

    const slots = buildProviderAvailabilitySlots({
      weekly: {
        start: new Date('2026-09-07T08:00:00.000Z'),
        end: new Date('2026-09-07T12:00:00.000Z'),
      },
      exceptions,
      providerId,
      branchId,
      durationMin: 30,
      busy: [],
    });
    expect(slots.some((s) => s.start === '2026-09-07T09:00:00.000Z')).toBe(false);
    expect(slots.some((s) => s.start === '2026-09-07T08:00:00.000Z')).toBe(true);
  });

  it('G1-PG-02 — EXTRA_AVAILABILITY row adds slots when weekly closed', async () => {
    const extraId = randomUUID();
    await wrapper.withPlatformBypass(async (c) => {
      await c.availabilityException.create({
        data: {
          id: extraId,
          tenantId,
          branchId,
          type: 'EXTRA_AVAILABILITY',
          providerId,
          startsAt: new Date('2026-09-07T18:00:00.000Z'),
          endsAt: new Date('2026-09-07T19:00:00.000Z'),
          createdBy: actorId,
        },
      });
    });

    try {
      const exceptions = await query.listOverlappingDay({
        tenantId,
        dateYmd: '2026-09-07',
        timezone: 'UTC',
        branchId,
      });
      const slots = buildProviderAvailabilitySlots({
        weekly: null,
        exceptions,
        providerId,
        branchId,
        durationMin: 30,
        busy: [],
      });
      expect(slots.some((s) => s.start === '2026-09-07T18:00:00.000Z')).toBe(true);
    } finally {
      await wrapper.withPlatformBypass(async (c) => {
        await c.availabilityException.deleteMany({ where: { id: extraId } });
      });
    }
  });

  it('G1-PG-03 — cross-tenant RLS deny via booking_app role', async () => {
    const app = new PrismaClient({
      datasources: { db: { url: BOOKING_APP_URL } },
    });
    try {
      const foreignVisible = await app.$transaction(async (tx) => {
        await tx.$executeRaw`SELECT set_config('app.platform_rls_bypass', 'false', true)`;
        await tx.$executeRaw`SELECT set_config('app.current_tenant_id', ${otherTenantId}, true)`;
        return tx.availabilityException.findMany({ where: { id: exceptionId } });
      });
      expect(foreignVisible).toEqual([]);

      const ownVisible = await app.$transaction(async (tx) => {
        await tx.$executeRaw`SELECT set_config('app.platform_rls_bypass', 'false', true)`;
        await tx.$executeRaw`SELECT set_config('app.current_tenant_id', ${tenantId}, true)`;
        return tx.availabilityException.findMany({ where: { id: exceptionId } });
      });
      expect(ownVisible).toHaveLength(1);

      await expect(
        app.$transaction(async (tx) => {
          await tx.$executeRaw`SELECT set_config('app.platform_rls_bypass', 'false', true)`;
          await tx.$executeRaw`SELECT set_config('app.current_tenant_id', ${otherTenantId}, true)`;
          await tx.availabilityException.update({
            where: { id: exceptionId },
            data: { reason: 'hijack' },
          });
        }),
      ).rejects.toBeTruthy();
    } finally {
      await app.$disconnect();
    }
  });

  it('G1-PG-04 — soft-deleted exception excluded from day query', async () => {
    await wrapper.withPlatformBypass(async (c) => {
      await c.availabilityException.update({
        where: { id: exceptionId },
        data: { deletedAt: new Date() },
      });
    });
    const exceptions = await query.listOverlappingDay({
      tenantId,
      dateYmd: '2026-09-07',
      timezone: 'UTC',
      branchId,
    });
    expect(exceptions).toEqual([]);
  });
});
