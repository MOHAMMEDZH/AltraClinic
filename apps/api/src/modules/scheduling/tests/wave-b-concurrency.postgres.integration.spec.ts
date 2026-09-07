/**
 * Wave B — Booking concurrency B-CON-01..20 (real PostgreSQL advisory locks).
 *
 * Run:
 *   ALLOW_TEST_DATABASE_RESET=true RUN_PLATFORM_DB_SECURITY=true \
 *   npx jest --runInBand --testPathIgnorePatterns=[] \
 *     --testPathPattern=wave-b-concurrency.postgres.integration.spec
 */
import { randomUUID } from 'crypto';
import { ConflictException } from '@nestjs/common';
import type { PrismaClient } from '@prisma/client';
import { BookingConcurrencyService } from '../application/services/booking-concurrency.service';
import {
  createClinicalPrismaWrapper,
  createPlatformDbSecurityClient,
  platformDbSecurityEnabled,
} from '../../clinical-catalog/tests/clinical-catalog-db.harness';

jest.setTimeout(180_000);
const describeDb = platformDbSecurityEnabled() ? describe : describe.skip;

describeDb('Wave B booking concurrency B-CON-01..20 (PostgreSQL)', () => {
  let raw: PrismaClient;
  let wrapper: ReturnType<typeof createClinicalPrismaWrapper>;
  let concurrency: BookingConcurrencyService;
  let tenantId: string;
  let otherTenantId: string;
  let patientId: string;
  let providerId: string;
  let resourceId: string;

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
    otherTenantId = randomUUID();
    patientId = randomUUID();
    providerId = randomUUID();
    resourceId = randomUUID();
    await wrapper.withPlatformBypass(async (c) => {
      await c.tenant.create({
        data: { id: tenantId, name: 'WB Conc', slug: `wb-conc-${tenantId.slice(0, 8)}` },
      });
      await c.tenant.create({
        data: {
          id: otherTenantId,
          name: 'WB Conc Other',
          slug: `wb-conc-o-${otherTenantId.slice(0, 8)}`,
        },
      });
      await c.patient.create({
        data: { id: patientId, tenantId, firstName: 'A', lastName: 'B' },
      });
      await c.schedulingResource.create({
        data: {
          id: resourceId,
          tenantId,
          name: 'Excl Room',
          resourceType: 'ROOM',
          isActive: true,
        },
      });
    });
  });

  afterEach(async () => {
    await wrapper.withPlatformBypass(async (c) => {
      await c.$executeRaw`SELECT set_config('app.wave_b_snapshot_migration', 'true', true)`;
      await c.appointment.updateMany({
        where: { tenantId: { in: [tenantId, otherTenantId] } },
        data: { effectiveSnapshotRevisionId: null },
      });
      await c.appointmentServiceSnapshotRevision.deleteMany({
        where: { tenantId: { in: [tenantId, otherTenantId] } },
      });
      await c.appointmentResourceAllocation.deleteMany({
        where: { tenantId: { in: [tenantId, otherTenantId] } },
      });
      await c.portalSchedulingIdempotencyLedger.deleteMany({
        where: { tenantId: { in: [tenantId, otherTenantId] } },
      });
      await c.appointment.deleteMany({
        where: { tenantId: { in: [tenantId, otherTenantId] } },
      });
      await c.schedulingResource.deleteMany({
        where: { tenantId: { in: [tenantId, otherTenantId] } },
      });
      await c.patient.deleteMany({ where: { tenantId: { in: [tenantId, otherTenantId] } } });
      await c.tenant.deleteMany({ where: { id: { in: [tenantId, otherTenantId] } } });
    });
  });

  async function bookOnce(opts: {
    providerId: string;
    start: Date;
    end: Date;
    resourceIds?: string[];
    tenant?: string;
    patient?: string;
  }) {
    const id = randomUUID();
    const tid = opts.tenant ?? tenantId;
    const pid = opts.patient ?? patientId;
    await concurrency.withBookingTransaction(async (client) => {
      await concurrency.assertSlotAvailableUnderLock(client, {
        tenantId: tid,
        providerId: opts.providerId,
        resourceIds: opts.resourceIds ?? [],
        start: opts.start,
        end: opts.end,
      });
      await client.appointment.create({
        data: {
          id,
          tenantId: tid,
          patientId: pid,
          providerId: opts.providerId,
          scheduledStart: opts.start,
          scheduledEnd: opts.end,
          status: 'PENDING',
          resourceId: opts.resourceIds?.[0] ?? null,
        },
      });
    });
    return id;
  }

  async function seedConsuming(status: string, start: Date, end: Date) {
    const id = randomUUID();
    await wrapper.withPlatformBypass(async (c) => {
      await c.appointment.create({
        data: {
          id,
          tenantId,
          patientId,
          providerId,
          scheduledStart: start,
          scheduledEnd: end,
          status: status as never,
        },
      });
    });
    return id;
  }

  it('B-CON-01 — same provider + no existing row + concurrent create → exactly one success', async () => {
    const start = new Date('2026-09-01T10:00:00.000Z');
    const end = new Date('2026-09-01T10:30:00.000Z');
    const settled = await Promise.allSettled([
      bookOnce({ providerId, start, end }),
      bookOnce({ providerId, start, end }),
    ]);
    expect(settled.filter((s) => s.status === 'fulfilled')).toHaveLength(1);
    expect(settled.filter((s) => s.status === 'rejected')).toHaveLength(1);
    expect((settled.find((s) => s.status === 'rejected') as PromiseRejectedResult).reason).toBeInstanceOf(
      ConflictException,
    );
    const count = await wrapper.withPlatformBypass((c) =>
      c.appointment.count({
        where: { tenantId, providerId, deletedAt: null, status: 'PENDING' },
      }),
    );
    expect(count).toBe(1);
  });

  it('B-CON-02 — same exclusive resource concurrent create → exactly one success', async () => {
    const start = new Date('2026-09-02T10:00:00.000Z');
    const end = new Date('2026-09-02T10:30:00.000Z');
    const p2 = randomUUID();
    const settled = await Promise.allSettled([
      bookOnce({ providerId, resourceIds: [resourceId], start, end }),
      bookOnce({ providerId: p2, resourceIds: [resourceId], start, end }),
    ]);
    expect(settled.filter((s) => s.status === 'fulfilled')).toHaveLength(1);
    expect(settled.filter((s) => s.status === 'rejected')).toHaveLength(1);
  });

  it('B-CON-03 — lock keys sorted deterministically', () => {
    const keys = concurrency.buildLockKeys({
      tenantId: 't1',
      providerId: 'p1',
      resourceIds: ['r-b', 'r-a'],
    });
    expect(keys).toEqual([...keys].sort());
    expect(keys[0]).toBe('booking:provider:t1:p1');
    expect(keys).toEqual(['booking:provider:t1:p1', 'booking:resource:t1:r-a', 'booking:resource:t1:r-b']);
  });

  it('B-CON-04 — overlap reread occurs after lock (second waiter sees first commit)', async () => {
    const start = new Date('2026-09-03T10:00:00.000Z');
    const end = new Date('2026-09-03T10:30:00.000Z');
    let firstInside = false;
    const first = concurrency.withBookingTransaction(async (client) => {
      await concurrency.assertSlotAvailableUnderLock(client, {
        tenantId,
        providerId,
        resourceIds: [],
        start,
        end,
      });
      firstInside = true;
      await new Promise((r) => setTimeout(r, 80));
      await client.appointment.create({
        data: {
          id: randomUUID(),
          tenantId,
          patientId,
          providerId,
          scheduledStart: start,
          scheduledEnd: end,
          status: 'PENDING',
        },
      });
    });
    await new Promise((r) => setTimeout(r, 20));
    const second = bookOnce({ providerId, start, end });
    const settled = await Promise.allSettled([first, second]);
    expect(firstInside).toBe(true);
    expect(settled.filter((s) => s.status === 'fulfilled')).toHaveLength(1);
    expect(settled.filter((s) => s.status === 'rejected')).toHaveLength(1);
  });

  it('B-CON-05 — non-overlapping provider slots both succeed', async () => {
    const aStart = new Date('2026-09-04T10:00:00.000Z');
    const aEnd = new Date('2026-09-04T10:30:00.000Z');
    const bStart = new Date('2026-09-04T11:00:00.000Z');
    const bEnd = new Date('2026-09-04T11:30:00.000Z');
    const settled = await Promise.allSettled([
      bookOnce({ providerId, start: aStart, end: aEnd }),
      bookOnce({ providerId, start: bStart, end: bEnd }),
    ]);
    expect(settled.every((s) => s.status === 'fulfilled')).toBe(true);
  });

  it('B-CON-06 — different providers + same exclusive resource → one success', async () => {
    const start = new Date('2026-09-05T10:00:00.000Z');
    const end = new Date('2026-09-05T10:30:00.000Z');
    const p2 = randomUUID();
    const settled = await Promise.allSettled([
      bookOnce({ providerId, resourceIds: [resourceId], start, end }),
      bookOnce({ providerId: p2, resourceIds: [resourceId], start, end }),
    ]);
    expect(settled.filter((s) => s.status === 'fulfilled')).toHaveLength(1);
  });

  it('B-CON-07 — reschedule race deterministic (one winner for target slot)', async () => {
    const startA = new Date('2026-09-06T10:00:00.000Z');
    const endA = new Date('2026-09-06T10:30:00.000Z');
    const startB = new Date('2026-09-06T11:00:00.000Z');
    const endB = new Date('2026-09-06T11:30:00.000Z');
    const targetStart = new Date('2026-09-06T12:00:00.000Z');
    const targetEnd = new Date('2026-09-06T12:30:00.000Z');
    const id1 = await bookOnce({ providerId, start: startA, end: endA });
    const id2 = await bookOnce({ providerId, start: startB, end: endB });
    const move = async (appointmentId: string) => {
      await concurrency.withBookingTransaction(async (client) => {
        await concurrency.assertSlotAvailableUnderLock(client, {
          tenantId,
          providerId,
          resourceIds: [],
          start: targetStart,
          end: targetEnd,
          excludeAppointmentId: appointmentId,
        });
        await client.appointment.update({
          where: { id: appointmentId },
          data: { scheduledStart: targetStart, scheduledEnd: targetEnd },
        });
      });
    };
    const settled = await Promise.allSettled([move(id1), move(id2)]);
    expect(settled.filter((s) => s.status === 'fulfilled')).toHaveLength(1);
    expect(settled.filter((s) => s.status === 'rejected')).toHaveLength(1);
  });

  it('B-CON-08 — cancel/rebook race deterministic', async () => {
    const start = new Date('2026-09-07T10:00:00.000Z');
    const end = new Date('2026-09-07T10:30:00.000Z');
    const existing = await bookOnce({ providerId, start, end });
    const cancel = concurrency.withBookingTransaction(async (client) => {
      await client.appointment.update({
        where: { id: existing },
        data: { status: 'CANCELLED' },
      });
    });
    const rebook = bookOnce({ providerId, start, end });
    await Promise.allSettled([cancel, rebook]);
    const pending = await wrapper.withPlatformBypass((c) =>
      c.appointment.count({
        where: { tenantId, providerId, status: 'PENDING', deletedAt: null },
      }),
    );
    expect(pending).toBeLessThanOrEqual(1);
    if (pending === 0) {
      await expect(bookOnce({ providerId, start, end })).resolves.toBeTruthy();
    }
  });

  it('B-CON-09 — PENDING consumes slot', async () => {
    const start = new Date('2026-09-08T10:00:00.000Z');
    const end = new Date('2026-09-08T10:30:00.000Z');
    await seedConsuming('PENDING', start, end);
    await expect(bookOnce({ providerId, start, end })).rejects.toBeInstanceOf(ConflictException);
  });

  it('B-CON-10 — CONFIRMED consumes slot', async () => {
    const start = new Date('2026-09-09T10:00:00.000Z');
    const end = new Date('2026-09-09T10:30:00.000Z');
    await seedConsuming('CONFIRMED', start, end);
    await expect(bookOnce({ providerId, start, end })).rejects.toBeInstanceOf(ConflictException);
  });

  it('B-CON-11 — CHECKED_IN consumes slot', async () => {
    const start = new Date('2026-09-10T10:00:00.000Z');
    const end = new Date('2026-09-10T10:30:00.000Z');
    await seedConsuming('CHECKED_IN', start, end);
    await expect(bookOnce({ providerId, start, end })).rejects.toBeInstanceOf(ConflictException);
  });

  it('B-CON-12 — IN_PROGRESS consumes slot', async () => {
    const start = new Date('2026-09-11T10:00:00.000Z');
    const end = new Date('2026-09-11T10:30:00.000Z');
    await seedConsuming('IN_PROGRESS', start, end);
    await expect(bookOnce({ providerId, start, end })).rejects.toBeInstanceOf(ConflictException);
  });

  it('B-CON-13 — CANCELLED non-consuming', async () => {
    const start = new Date('2026-09-12T10:00:00.000Z');
    const end = new Date('2026-09-12T10:30:00.000Z');
    await seedConsuming('CANCELLED', start, end);
    await expect(bookOnce({ providerId, start, end })).resolves.toBeTruthy();
  });

  it('B-CON-14 — COMPLETED non-consuming', async () => {
    const start = new Date('2026-09-13T10:00:00.000Z');
    const end = new Date('2026-09-13T10:30:00.000Z');
    await seedConsuming('COMPLETED', start, end);
    await expect(bookOnce({ providerId, start, end })).resolves.toBeTruthy();
  });

  it('B-CON-15 — NO_SHOW non-consuming', async () => {
    const start = new Date('2026-09-14T10:00:00.000Z');
    const end = new Date('2026-09-14T10:30:00.000Z');
    await seedConsuming('NO_SHOW', start, end);
    await expect(bookOnce({ providerId, start, end })).resolves.toBeTruthy();
  });

  it('B-CON-16 — soft-deleted non-consuming', async () => {
    const start = new Date('2026-09-15T10:00:00.000Z');
    const end = new Date('2026-09-15T10:30:00.000Z');
    await wrapper.withPlatformBypass(async (c) => {
      await c.appointment.create({
        data: {
          id: randomUUID(),
          tenantId,
          patientId,
          providerId,
          scheduledStart: start,
          scheduledEnd: end,
          status: 'PENDING',
          deletedAt: new Date(),
        },
      });
    });
    await expect(bookOnce({ providerId, start, end })).resolves.toBeTruthy();
  });

  it('B-CON-17 / WB03-IDEMP-01 — duplicate portal idempotency key does not duplicate (DB ledger)', async () => {
    const { PortalSchedulingIdempotencyService } = await import(
      '../../patient-portal/application/services/portal-scheduling-idempotency.service'
    );
    const idem = new PortalSchedulingIdempotencyService(wrapper as never);
    const start = new Date('2026-09-16T10:00:00.000Z');
    const end = new Date('2026-09-16T10:30:00.000Z');
    const fingerprint = idem.fingerprint({ providerId, start: start.toISOString() });
    const key = `idem-${randomUUID()}`;
    const beforeSnap = await wrapper.withPlatformBypass((c) =>
      c.appointmentServiceSnapshotRevision.count({ where: { tenantId } }),
    );

    const run = async () => {
      const gate = await idem.beginOrReplay({
        tenantId,
        patientId,
        operation: 'book',
        idempotencyKey: key,
        fingerprint,
      });
      if (gate.kind === 'replay') return gate.result as { id: string };
      const id = await bookOnce({ providerId, start, end });
      await idem.complete(gate.rowId, fingerprint, { id }, gate.ownerToken);
      return { id };
    };

    const settled = await Promise.allSettled([run(), run()]);
    const fulfilled = settled
      .filter((s) => s.status === 'fulfilled')
      .map((s) => (s as PromiseFulfilledResult<{ id: string }>).value);
    expect(fulfilled.length).toBeGreaterThanOrEqual(1);
    const ids = new Set(fulfilled.map((f) => f.id));
    expect(ids.size).toBe(1);
    const count = await wrapper.withPlatformBypass((c) =>
      c.appointment.count({ where: { tenantId, providerId, status: 'PENDING', deletedAt: null } }),
    );
    expect(count).toBe(1);
    const replay = await idem.beginOrReplay({
      tenantId,
      patientId,
      operation: 'book',
      idempotencyKey: key,
      fingerprint,
    });
    expect(replay.kind).toBe('replay');
    if (replay.kind === 'replay') {
      expect((replay.result as { id: string }).id).toBe([...ids][0]);
    }
    const afterSnap = await wrapper.withPlatformBypass((c) =>
      c.appointmentServiceSnapshotRevision.count({ where: { tenantId } }),
    );
    expect(afterSnap).toBe(beforeSnap);
  });

  it('B-CON-18 — distinct competing requests still protected by locks', async () => {
    const start = new Date('2026-09-17T10:00:00.000Z');
    const end = new Date('2026-09-17T10:30:00.000Z');
    const settled = await Promise.allSettled([
      bookOnce({ providerId, start, end }),
      bookOnce({ providerId, start, end }),
      bookOnce({ providerId, start, end }),
    ]);
    expect(settled.filter((s) => s.status === 'fulfilled')).toHaveLength(1);
    expect(settled.filter((s) => s.status === 'rejected')).toHaveLength(2);
  });

  it('B-CON-19 — cross-tenant isolation correct', async () => {
    const start = new Date('2026-09-18T10:00:00.000Z');
    const end = new Date('2026-09-18T10:30:00.000Z');
    const otherPatient = randomUUID();
    await wrapper.withPlatformBypass(async (c) => {
      await c.patient.create({
        data: { id: otherPatient, tenantId: otherTenantId, firstName: 'X', lastName: 'Y' },
      });
    });
    await bookOnce({ providerId, start, end, tenant: tenantId });
    await expect(
      bookOnce({
        providerId,
        start,
        end,
        tenant: otherTenantId,
        patient: otherPatient,
      }),
    ).resolves.toBeTruthy();
  });

  it('B-CON-20 / WB03-ROLLBACK-01 — failure after create before snapshot rolls back both', async () => {
    const start = new Date('2026-09-19T11:00:00.000Z');
    const end = new Date('2026-09-19T11:30:00.000Z');
    const beforeAppt = await wrapper.withPlatformBypass((c) =>
      c.appointment.count({ where: { tenantId, providerId } }),
    );
    const beforeSnap = await wrapper.withPlatformBypass((c) =>
      c.appointmentServiceSnapshotRevision.count({ where: { tenantId } }),
    );

    await expect(
      concurrency.withBookingTransaction(async (client) => {
        await concurrency.assertSlotAvailableUnderLock(client, {
          tenantId,
          providerId,
          resourceIds: [],
          start,
          end,
        });
        const appointmentId = randomUUID();
        await client.appointment.create({
          data: {
            id: appointmentId,
            tenantId,
            patientId,
            providerId,
            scheduledStart: start,
            scheduledEnd: end,
            status: 'PENDING',
          },
        });
        // Force failure after appointment create before snapshot capture.
        throw new Error('forced snapshot-path failure');
      }),
    ).rejects.toThrow(/forced snapshot-path failure/);

    const afterAppt = await wrapper.withPlatformBypass((c) =>
      c.appointment.count({ where: { tenantId, providerId } }),
    );
    const afterSnap = await wrapper.withPlatformBypass((c) =>
      c.appointmentServiceSnapshotRevision.count({ where: { tenantId } }),
    );
    expect(afterAppt).toBe(beforeAppt);
    expect(afterSnap).toBe(beforeSnap);
  });
});
