/**
 * Wave G2 / P1-10 — WaitlistOffer SoR (PostgreSQL): offer, TTL, accept, RLS.
 *
 * Run:
 *   ALLOW_TEST_DATABASE_RESET=true RUN_PLATFORM_DB_SECURITY=true \
 *   npx jest --runInBand --testPathIgnorePatterns=[] \
 *     --testPathPattern=wave-g2-waitlist-offer.postgres
 */
import { ConflictException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PrismaClient, WaitlistOfferStatus, WaitlistStatus } from '@prisma/client';
import {
  createClinicalPrismaWrapper,
  createPlatformDbSecurityClient,
  platformDbSecurityEnabled,
} from '../../clinical-catalog/tests/clinical-catalog-db.harness';
import { BookingConcurrencyService } from '../application/services/booking-concurrency.service';
import { AcceptWaitlistOfferHandler } from '../application/handlers/waitlist-offer.handlers';
import { canAcceptOffer } from '../domain/waitlist-offer.lifecycle';

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
    withPlatformBypass: base.withPlatformBypass,
  };
}

describeDb('Wave G2 WaitlistOffer (PostgreSQL)', () => {
  let raw: PrismaClient;
  let wrapper: ReturnType<typeof createTenantAwarePrisma>;
  let acceptHandler: AcceptWaitlistOfferHandler;
  let tenantId: string;
  let otherTenantId: string;
  let branchId: string;
  let patientId: string;
  let providerId: string;
  let waitlistId: string;
  let offerId: string;

  beforeAll(async () => {
    raw = await createPlatformDbSecurityClient();
    wrapper = createTenantAwarePrisma(raw);
    const concurrency = new BookingConcurrencyService(wrapper as never);
    acceptHandler = new AcceptWaitlistOfferHandler(
      wrapper as never,
      {
        resolve: async () => ({ tenantId, branchId, locale: 'en' }),
      } as never,
      concurrency,
      {
        async record() {},
        async recordInTransaction() {},
      } as never,
    );
  });

  afterAll(async () => {
    await raw.$disconnect();
  });

  beforeEach(async () => {
    tenantId = randomUUID();
    otherTenantId = randomUUID();
    branchId = randomUUID();
    patientId = randomUUID();
    providerId = randomUUID();
    waitlistId = randomUUID();
    offerId = randomUUID();

    await wrapper.withPlatformBypass(async (c) => {
      await c.tenant.create({
        data: { id: tenantId, name: 'G2 Ten', slug: `g2-${tenantId.slice(0, 8)}` },
      });
      await c.tenant.create({
        data: {
          id: otherTenantId,
          name: 'G2 Other',
          slug: `g2-o-${otherTenantId.slice(0, 8)}`,
        },
      });
      await c.branch.create({ data: { id: branchId, tenantId, name: 'Main' } });
      await c.patient.create({
        data: { id: patientId, tenantId, firstName: 'W', lastName: 'L' },
      });
      await c.user.create({
        data: {
          id: providerId,
          tenantId,
          email: `g2-${providerId.slice(0, 8)}@test.local`,
          passwordHash: 'x',
          firstName: 'Doc',
          lastName: 'Tor',
          roles: { create: [{ role: 'DOCTOR' }] },
        },
      });
      await c.appointmentWaitlist.create({
        data: {
          id: waitlistId,
          tenantId,
          branchId,
          patientId,
          providerId,
          durationMin: 30,
          status: WaitlistStatus.OPEN,
        },
      });
      await c.waitlistOffer.create({
        data: {
          id: offerId,
          tenantId,
          branchId,
          waitlistEntryId: waitlistId,
          providerId,
          offeredStartsAt: new Date('2026-09-08T10:00:00.000Z'),
          offeredEndsAt: new Date('2026-09-08T10:30:00.000Z'),
          expiresAt: new Date('2099-01-01T00:00:00.000Z'),
          status: WaitlistOfferStatus.PENDING,
        },
      });
    });
  });

  afterEach(async () => {
    await wrapper.withPlatformBypass(async (c) => {
      const offers = await c.waitlistOffer.findMany({
        where: { tenantId: { in: [tenantId, otherTenantId] } },
        select: { id: true, appointmentId: true },
      });
      const apptIds = offers.map((o) => o.appointmentId).filter(Boolean) as string[];
      await c.waitlistOffer.deleteMany({
        where: { tenantId: { in: [tenantId, otherTenantId] } },
      });
      if (apptIds.length) {
        await c.appointmentResourceAllocation.deleteMany({
          where: { appointmentId: { in: apptIds } },
        });
        await c.appointment.deleteMany({ where: { id: { in: apptIds } } });
      }
      await c.appointmentWaitlist.deleteMany({ where: { id: waitlistId } });
      await c.userRoleAssignment.deleteMany({ where: { userId: providerId } });
      await c.user.deleteMany({ where: { id: providerId } });
      await c.patient.deleteMany({ where: { id: patientId } });
      await c.branch.deleteMany({ where: { id: branchId } });
      await c.tenant.deleteMany({ where: { id: { in: [tenantId, otherTenantId] } } });
    });
  });

  it('G2-PG-01 — accept PENDING offer creates appointment and marks SCHEDULED', async () => {
    const result = await acceptHandler.execute(offerId, providerId, ['DOCTOR']);
    expect(result.status).toBe('ACCEPTED');
    expect(result.appointmentId).toBeTruthy();

    const offer = await wrapper.withPlatformBypass((c) =>
      c.waitlistOffer.findUnique({ where: { id: offerId } }),
    );
    expect(offer?.status).toBe('ACCEPTED');
    expect(offer?.appointmentId).toBe(result.appointmentId);

    const entry = await wrapper.withPlatformBypass((c) =>
      c.appointmentWaitlist.findUnique({ where: { id: waitlistId } }),
    );
    expect(entry?.status).toBe('SCHEDULED');

    const appt = await wrapper.withPlatformBypass((c) =>
      c.appointment.findUnique({ where: { id: result.appointmentId } }),
    );
    expect(appt?.patientId).toBe(patientId);
    expect(appt?.providerId).toBe(providerId);
  });

  it('G2-PG-02 — expired offer cannot be accepted', async () => {
    await wrapper.withPlatformBypass(async (c) => {
      await c.waitlistOffer.update({
        where: { id: offerId },
        data: { expiresAt: new Date('2000-01-01T00:00:00.000Z') },
      });
    });
    const row = await wrapper.withPlatformBypass((c) =>
      c.waitlistOffer.findUnique({ where: { id: offerId } }),
    );
    expect(canAcceptOffer(row!, new Date())).toBe(false);

    await expect(acceptHandler.execute(offerId, providerId, [])).rejects.toBeInstanceOf(
      ConflictException,
    );

    const after = await wrapper.withPlatformBypass((c) =>
      c.waitlistOffer.findUnique({ where: { id: offerId } }),
    );
    expect(after?.status).toBe('EXPIRED');
    expect(after?.appointmentId).toBeNull();
  });

  it('G2-PG-03 — second accept loses race (already ACCEPTED)', async () => {
    await acceptHandler.execute(offerId, providerId, []);
    await expect(acceptHandler.execute(offerId, providerId, [])).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  it('G2-PG-04 — cross-tenant RLS deny via booking_app', async () => {
    const app = new PrismaClient({
      datasources: { db: { url: BOOKING_APP_URL } },
    });
    try {
      const foreign = await app.$transaction(async (tx) => {
        await tx.$executeRaw`SELECT set_config('app.platform_rls_bypass', 'false', true)`;
        await tx.$executeRaw`SELECT set_config('app.current_tenant_id', ${otherTenantId}, true)`;
        return tx.waitlistOffer.findMany({ where: { id: offerId } });
      });
      expect(foreign).toEqual([]);

      const own = await app.$transaction(async (tx) => {
        await tx.$executeRaw`SELECT set_config('app.platform_rls_bypass', 'false', true)`;
        await tx.$executeRaw`SELECT set_config('app.current_tenant_id', ${tenantId}, true)`;
        return tx.waitlistOffer.findMany({ where: { id: offerId } });
      });
      expect(own).toHaveLength(1);

      await expect(
        app.$transaction(async (tx) => {
          await tx.$executeRaw`SELECT set_config('app.platform_rls_bypass', 'false', true)`;
          await tx.$executeRaw`SELECT set_config('app.current_tenant_id', ${otherTenantId}, true)`;
          await tx.waitlistOffer.update({
            where: { id: offerId },
            data: { status: WaitlistOfferStatus.REJECTED },
          });
        }),
      ).rejects.toBeTruthy();
    } finally {
      await app.$disconnect();
    }
  });

  it('G2-PG-05 — expire-due marks PENDING past TTL as EXPIRED without appointment', async () => {
    await wrapper.withPlatformBypass(async (c) => {
      await c.waitlistOffer.update({
        where: { id: offerId },
        data: { expiresAt: new Date('2000-01-01T00:00:00.000Z') },
      });
    });

    const now = new Date();
    await wrapper.withTenantContext(tenantId, async (c) => {
      await c.waitlistOffer.updateMany({
        where: {
          tenantId,
          status: WaitlistOfferStatus.PENDING,
          expiresAt: { lte: now },
        },
        data: {
          status: WaitlistOfferStatus.EXPIRED,
          expiredAt: now,
          updatedAt: now,
        },
      });
    });

    const offer = await wrapper.withPlatformBypass((c) =>
      c.waitlistOffer.findUnique({ where: { id: offerId } }),
    );
    expect(offer?.status).toBe('EXPIRED');
    expect(offer?.appointmentId).toBeNull();
  });
});
