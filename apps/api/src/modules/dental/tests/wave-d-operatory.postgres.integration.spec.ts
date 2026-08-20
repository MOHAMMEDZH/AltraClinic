/**
 * Wave D P1-03 — OPERATORY uses the same advisory-lock concurrency as ROOM.
 */
import { randomUUID } from 'crypto';
import { ConflictException } from '@nestjs/common';
import type { PrismaClient } from '@prisma/client';
import { BookingConcurrencyService } from '../../scheduling/application/services/booking-concurrency.service';
import {
  createClinicalPrismaWrapper,
  createPlatformDbSecurityClient,
  platformDbSecurityEnabled,
} from '../../clinical-catalog/tests/clinical-catalog-db.harness';

jest.setTimeout(180_000);
const describeDb = platformDbSecurityEnabled() ? describe : describe.skip;

describeDb('Wave D OPERATORY concurrency (PostgreSQL)', () => {
  let raw: PrismaClient;
  let wrapper: ReturnType<typeof createClinicalPrismaWrapper>;
  let concurrency: BookingConcurrencyService;
  let tenantId: string;
  let patientId: string;
  let providerId: string;
  let operatoryId: string;

  beforeAll(async () => {
    raw = await createPlatformDbSecurityClient();
    wrapper = createClinicalPrismaWrapper(raw);
    concurrency = new BookingConcurrencyService(wrapper as never);
  });

  afterAll(async () => {
    await raw.$disconnect();
  });

  beforeEach(async () => {
    tenantId = randomUUID();
    patientId = randomUUID();
    providerId = randomUUID();
    operatoryId = randomUUID();
    await wrapper.withPlatformBypass(async (c) => {
      await c.tenant.create({
        data: { id: tenantId, name: 'WD Op', slug: `wd-op-${tenantId.slice(0, 8)}` },
      });
      await c.patient.create({
        data: { id: patientId, tenantId, firstName: 'A', lastName: 'B' },
      });
      await c.schedulingResource.create({
        data: {
          id: operatoryId,
          tenantId,
          name: 'Chair 1',
          resourceType: 'OPERATORY',
          displaySubtype: 'chair',
          isActive: true,
        },
      });
    });
  });

  async function bookOnce(start: Date, end: Date, provider = providerId) {
    const id = randomUUID();
    await concurrency.withBookingTransaction(async (client) => {
      await concurrency.assertSlotAvailableUnderLock(client, {
        tenantId,
        providerId: provider,
        resourceIds: [operatoryId],
        start,
        end,
      });
      await client.appointment.create({
        data: {
          id,
          tenantId,
          patientId,
          providerId: provider,
          scheduledStart: start,
          scheduledEnd: end,
          status: 'PENDING',
          resourceId: operatoryId,
        },
      });
    });
    return id;
  }

  it('two overlapping OPERATORY bookings → exactly one success', async () => {
    const start = new Date('2026-09-01T10:00:00.000Z');
    const end = new Date('2026-09-01T10:30:00.000Z');
    const p2 = randomUUID();
    const settled = await Promise.allSettled([bookOnce(start, end, providerId), bookOnce(start, end, p2)]);
    expect(settled.filter((s) => s.status === 'fulfilled')).toHaveLength(1);
    expect(settled.filter((s) => s.status === 'rejected')).toHaveLength(1);
    expect((settled.find((s) => s.status === 'rejected') as PromiseRejectedResult).reason).toBeInstanceOf(
      ConflictException,
    );
  });
});
