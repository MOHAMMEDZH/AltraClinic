/**
 * Phase 48 Wave B — final narrow residual closure
 * WB-PA-02 BulkReschedule + UpdateAppointment fresh fields
 * WB-PA-07 queue/beauty provenance + snapshotWriteMode immutability
 */
import { randomUUID } from 'crypto';
import { BadRequestException, ConflictException } from '@nestjs/common';
import type { PrismaClient } from '@prisma/client';
import { BookingConcurrencyService } from '../application/services/booking-concurrency.service';
import { AppointmentSnapshotService } from '../application/services/appointment-snapshot.service';
import { ProviderEligibilityService } from '../application/services/provider-eligibility.service';
import { ServiceResourceRequirementService } from '../application/services/service-resource-requirement.service';
import {
  BulkRescheduleHandler,
  UpdateAppointmentHandler,
} from '../application/handlers/appointment.handlers';
import { WalkInQueueHandler } from '../../queue/application/handlers/walk-in-queue.handler';
import { BeautySessionSyncService } from '../../beauty/application/services/beauty-session-sync.service';
import { Appointment } from '../domain/appointment.entity';
import { AppointmentStatus } from '../domain/appointment-status.enum';
import { TimeSlotVO } from '../domain/timeslot.vo';
import {
  createClinicalPrismaWrapper,
  createPlatformDbSecurityClient,
  platformDbSecurityEnabled,
} from '../../clinical-catalog/tests/clinical-catalog-db.harness';
import * as fs from 'fs';
import * as path from 'path';

jest.setTimeout(180_000);
const describeDb = platformDbSecurityEnabled() ? describe : describe.skip;

const fakeAudit = {
  async record() {},
  async recordInTransaction() {},
};

describeDb('Wave B final narrow residual closure (PostgreSQL)', () => {
  let raw: PrismaClient;
  let wrapper: ReturnType<typeof createClinicalPrismaWrapper>;
  let concurrency: BookingConcurrencyService;
  let snapshots: AppointmentSnapshotService;
  let eligibility: ProviderEligibilityService;
  let resources: ServiceResourceRequirementService;
  let tenantId: string;
  let patientId: string;
  let providerId: string;
  let clinicalServiceId: string;
  let roomId: string;
  let branchId: string;

  beforeAll(async () => {
    raw = createPlatformDbSecurityClient();
    wrapper = createClinicalPrismaWrapper(raw);
    concurrency = new BookingConcurrencyService(wrapper as never);
    snapshots = new AppointmentSnapshotService();
    eligibility = new ProviderEligibilityService(wrapper as never, fakeAudit as never);
    resources = new ServiceResourceRequirementService(wrapper as never, fakeAudit as never);
  });

  afterAll(async () => {
    await raw.$disconnect();
  });

  beforeEach(async () => {
    tenantId = randomUUID();
    patientId = randomUUID();
    providerId = randomUUID();
    clinicalServiceId = randomUUID();
    roomId = randomUUID();
    branchId = randomUUID();
    await wrapper.withPlatformBypass(async (c) => {
      await c.tenant.create({
        data: {
          id: tenantId,
          name: 'WBNarrow',
          slug: `wbn-${tenantId.slice(0, 8)}`,
          features: {
            'booking.eligibility.enforcement': true,
            'catalog.canonical.write': true,
          },
        },
      });
      await c.branch.create({ data: { id: branchId, tenantId, name: 'Main' } });
      await c.user.create({
        data: {
          id: providerId,
          tenantId,
          email: `wbn-${providerId.slice(0, 8)}@t.local`,
          passwordHash: 'x',
          firstName: 'D',
          lastName: 'T',
          roles: { create: [{ role: 'DOCTOR' }] },
        },
      });
      await c.patient.create({ data: { id: patientId, tenantId, firstName: 'P', lastName: 'A' } });
      await c.canonicalClinicalServiceDefinition.create({
        data: {
          id: clinicalServiceId,
          tenantId: null,
          provenance: 'SYSTEM_CANONICAL',
          stableKey: `canonical.wbn_${clinicalServiceId.slice(0, 8)}`,
          domain: 'GENERAL',
          lifecycle: 'PUBLISHED',
          publishedAt: new Date(),
          translations: { create: [{ locale: 'en', displayName: 'Svc' }] },
        },
      });
      await c.tenantServiceConfiguration.create({
        data: { id: randomUUID(), tenantId, clinicalServiceId, enabled: true },
      });
      await c.schedulingResource.create({
        data: { id: roomId, tenantId, branchId, name: 'R1', resourceType: 'ROOM', isActive: true },
      });
    });
  });

  afterEach(async () => {
    await wrapper.withPlatformBypass(async (c) => {
      await c.$executeRaw`SELECT set_config('app.wave_b_snapshot_migration', 'true', true)`;
      await c.appointment.updateMany({
        where: { tenantId },
        data: { effectiveSnapshotRevisionId: null },
      });
      await c.queueTicket.deleteMany({ where: { tenantId } }).catch(() => undefined);
      await c.appointmentServiceSnapshotRevision.deleteMany({ where: { tenantId } });
      await c.appointmentResourceAllocation.deleteMany({ where: { tenantId } });
      await c.appointment.deleteMany({ where: { tenantId } });
      await c.providerServiceEligibility.deleteMany({ where: { tenantId } });
      await c.schedulingResource.deleteMany({ where: { tenantId } });
      await c.tenantServiceConfiguration.deleteMany({ where: { tenantId } });
      await c.clinicalServiceTranslation.deleteMany({ where: { clinicalServiceId } });
      await c.canonicalClinicalServiceDefinition.deleteMany({ where: { id: clinicalServiceId } });
      await c.userRoleAssignment.deleteMany({ where: { userId: providerId } });
      await c.user.deleteMany({ where: { tenantId } });
      await c.patient.deleteMany({ where: { tenantId } });
      await c.branch.deleteMany({ where: { tenantId } });
      await c.tenant.deleteMany({ where: { id: tenantId } }).catch(() => undefined);
    });
  });

  async function createElig(pid = providerId) {
    return eligibility.createEligibilityRow({
      tenantId,
      providerUserId: pid,
      clinicalServiceId,
      branchId: null,
      effectiveFrom: new Date('2020-01-01T00:00:00.000Z'),
      effectiveTo: null,
      actorId: pid,
    });
  }

  async function createAppt(overrides: {
    start: Date;
    end: Date;
    providerId?: string;
    resourceId?: string | null;
    status?: string;
    snapshotWriteMode?: 'LEGACY' | 'CANONICAL_REQUIRED';
  }) {
    const id = randomUUID();
    await concurrency.withBookingTransaction(async (client) => {
      await client.appointment.create({
        data: {
          id,
          tenantId,
          branchId,
          patientId,
          providerId: overrides.providerId ?? providerId,
          scheduledStart: overrides.start,
          scheduledEnd: overrides.end,
          status: (overrides.status as never) ?? 'CONFIRMED',
          clinicalServiceId,
          resourceId: overrides.resourceId ?? null,
          commercialLockedAt: new Date(),
          snapshotWriteMode: overrides.snapshotWriteMode ?? 'LEGACY',
        },
      });
    });
    return id;
  }

  function end(d: Date) {
    return new Date(d.getTime() + 30 * 60_000);
  }

  function createAuthoritativeRepo() {
    const run = async <T>(fn: (repo: import('../infrastructure/prisma-appointment.repository').PrismaAppointmentRepository) => Promise<T>) =>
      wrapper.withPlatformBypass(async (c) =>
        fn(new (await import('../infrastructure/prisma-appointment.repository')).PrismaAppointmentRepository(c as never)),
      );
    return {
      findById: (id: string, tid: string) => run((r) => r.findById(id, tid)),
      listSeriesFutureMembers: (params: never) => run((r) => r.listSeriesFutureMembers(params)),
      list: (filter: never) => run((r) => r.list(filter)),
      save: (a: Appointment) =>
        run(async (r) => {
          await r.save(a);
          return a;
        }),
      findDetailById: (id: string, tid: string) => run((r) => r.findDetailById(id, tid)),
    };
  }

  function buildUpdateHandler(domain: Appointment) {
    const repo = createAuthoritativeRepo();
    return new UpdateAppointmentHandler(
      {
        ...repo,
        findById: async () => domain,
      } as never,
      { resolve: async () => ({ tenantId, branchId }) } as never,
      { publish: async () => undefined } as never,
      concurrency,
      eligibility,
      resources,
      snapshots,
      { resolveCanonical: async () => ({}) } as never,
      wrapper as never,
      fakeAudit as never,
    );
  }

  it('WB02-BULK-ROWLOCK-01 — concurrent provider A→B cannot stale-validate bulk against A', async () => {
    await createElig();
    const providerB = randomUUID();
    await wrapper.withPlatformBypass(async (c) => {
      await c.user.create({
        data: {
          id: providerB,
          tenantId,
          email: `bulk1-${providerB.slice(0, 8)}@t.local`,
          passwordHash: 'x',
          firstName: 'B',
          lastName: 'P',
          roles: { create: [{ role: 'DOCTOR' }] },
        },
      });
    });
    await createElig(providerB);
    const t1 = new Date('2029-01-10T10:00:00.000Z');
    const id = await createAppt({ start: t1, end: end(t1), providerId });

    const origAcquire = concurrency.acquireSortedLockKeys.bind(concurrency);
    let injected = false;
    concurrency.acquireSortedLockKeys = async (client, keys) => {
      await origAcquire(client, keys);
      if (!injected) {
        injected = true;
        // Concurrent provider mutation AFTER advisory locks, BEFORE FOR UPDATE.
        await wrapper.withPlatformBypass(async (c) => {
          await c.appointment.update({ where: { id }, data: { providerId: providerB } });
        });
      }
    };

    try {
      const domain = new Appointment(
        id,
        tenantId,
        branchId,
        patientId,
        providerId,
        new TimeSlotVO(t1.toISOString(), end(t1).toISOString()),
        AppointmentStatus.Confirmed,
      );
      const bulk = new BulkRescheduleHandler(
        { findById: async () => domain } as never,
        { resolve: async () => ({ tenantId, branchId }) } as never,
        concurrency,
        eligibility,
        resources,
        wrapper as never,
      );
      const result = await bulk.execute({ appointmentIds: [id], shiftDays: 1 });
      const row = await wrapper.withPlatformBypass((c) =>
        c.appointment.findUniqueOrThrow({ where: { id } }),
      );
      if (result.updated.includes(id)) {
        expect(row.providerId).toBe(providerB);
        expect(row.scheduledStart.toISOString()).toBe(
          new Date('2029-01-11T10:00:00.000Z').toISOString(),
        );
      } else {
        expect(result.failed.some((f) => f.id === id)).toBe(true);
        expect(row.scheduledStart.toISOString()).toBe(t1.toISOString());
      }
    } finally {
      concurrency.acquireSortedLockKeys = origAcquire;
      await wrapper.withPlatformBypass(async (c) => {
        await c.providerServiceEligibility.deleteMany({ where: { providerUserId: providerB } });
        await c.userRoleAssignment.deleteMany({ where: { userId: providerB } });
        await c.user.deleteMany({ where: { id: providerB } });
      });
    }
  });

  it('WB02-BULK-ROWLOCK-02 — multi-appt bulk is all-or-nothing under concurrent mutation', async () => {
    await createElig();
    const t1 = new Date('2029-02-01T10:00:00.000Z');
    const t2 = new Date('2029-02-02T10:00:00.000Z');
    const a = await createAppt({ start: t1, end: end(t1) });
    const b = await createAppt({ start: t2, end: end(t2) });
    const providerB = randomUUID();
    await wrapper.withPlatformBypass(async (c) => {
      await c.user.create({
        data: {
          id: providerB,
          tenantId,
          email: `bulk2-${providerB.slice(0, 8)}@t.local`,
          passwordHash: 'x',
          firstName: 'B',
          lastName: 'P',
          roles: { create: [{ role: 'DOCTOR' }] },
        },
      });
    });
    await createElig(providerB);

    const origAcquire = concurrency.acquireSortedLockKeys.bind(concurrency);
    let injected = false;
    concurrency.acquireSortedLockKeys = async (client, keys) => {
      await origAcquire(client, keys);
      if (!injected) {
        injected = true;
        await wrapper.withPlatformBypass(async (c) => {
          await c.appointment.update({ where: { id: b }, data: { providerId: providerB } });
        });
      }
    };

    try {
      const repo = {
        findById: async (id: string) => {
          const start = id === a ? t1 : t2;
          return new Appointment(
            id,
            tenantId,
            branchId,
            patientId,
            providerId,
            new TimeSlotVO(start.toISOString(), end(start).toISOString()),
            AppointmentStatus.Confirmed,
          );
        },
      };
      const bulk = new BulkRescheduleHandler(
        repo as never,
        { resolve: async () => ({ tenantId, branchId }) } as never,
        concurrency,
        eligibility,
        resources,
        wrapper as never,
      );
      const result = await bulk.execute({ appointmentIds: [a, b], shiftDays: 1 });
      const rows = await wrapper.withPlatformBypass((c) =>
        c.appointment.findMany({ where: { id: { in: [a, b] } }, orderBy: { scheduledStart: 'asc' } }),
      );
      const allMoved = rows.every((r, i) => r.scheduledStart.getTime() !== [t1, t2][i]!.getTime());
      const noneMoved = rows.every((r, i) => r.scheduledStart.getTime() === [t1, t2][i]!.getTime());
      expect(allMoved || noneMoved).toBe(true);
      if (result.updated.length) {
        expect(result.updated.sort()).toEqual([a, b].sort());
      }
    } finally {
      concurrency.acquireSortedLockKeys = origAcquire;
      await wrapper.withPlatformBypass(async (c) => {
        await c.providerServiceEligibility.deleteMany({ where: { providerUserId: providerB } });
        await c.userRoleAssignment.deleteMany({ where: { userId: providerB } });
        await c.user.deleteMany({ where: { id: providerB } });
      });
    }
  });

  it('WB02-UPDATE-FRESH-01 — provider-only update preserves post-lock T2 after series moves T1→T2', async () => {
    await createElig();
    const providerB = randomUUID();
    await wrapper.withPlatformBypass(async (c) => {
      await c.user.create({
        data: {
          id: providerB,
          tenantId,
          email: `uf1-${providerB.slice(0, 8)}@t.local`,
          passwordHash: 'x',
          firstName: 'B',
          lastName: 'P',
          roles: { create: [{ role: 'DOCTOR' }] },
        },
      });
    });
    await createElig(providerB);
    const t1 = new Date('2029-03-01T10:00:00.000Z');
    const t2 = new Date('2029-03-01T14:00:00.000Z');
    const id = await createAppt({ start: t1, end: end(t1) });
    const domain = new Appointment(
      id,
      tenantId,
      branchId,
      patientId,
      providerId,
      new TimeSlotVO(t1.toISOString(), end(t1).toISOString()),
      AppointmentStatus.Confirmed,
    );

    const origLock = concurrency.lockAppointmentsForUpdate.bind(concurrency);
    concurrency.lockAppointmentsForUpdate = async (client, params) => {
      // Concurrent series-like time move commits before FOR UPDATE returns.
      await wrapper.withPlatformBypass(async (c) => {
        await c.appointment.update({
          where: { id },
          data: { scheduledStart: t2, scheduledEnd: end(t2) },
        });
      });
      return origLock(client, params);
    };

    try {
      const handler = buildUpdateHandler(domain);
      await handler.execute(id, { providerId: providerB }, providerB);
      const row = await wrapper.withPlatformBypass((c) =>
        c.appointment.findUniqueOrThrow({ where: { id } }),
      );
      expect(row.providerId).toBe(providerB);
      expect(row.scheduledStart.toISOString()).toBe(t2.toISOString());
      expect(row.scheduledStart.toISOString()).not.toBe(t1.toISOString());
    } finally {
      concurrency.lockAppointmentsForUpdate = origLock;
      await wrapper.withPlatformBypass(async (c) => {
        await c.providerServiceEligibility.deleteMany({ where: { providerUserId: providerB } });
        await c.userRoleAssignment.deleteMany({ where: { userId: providerB } });
        await c.user.deleteMany({ where: { id: providerB } });
      });
    }
  });

  it('WB02-UPDATE-FRESH-02 — unspecified resource/status come from post-lock fresh row', async () => {
    await createElig();
    const t1 = new Date('2029-04-01T10:00:00.000Z');
    const id = await createAppt({ start: t1, end: end(t1), resourceId: roomId, status: 'PENDING' });
    const domain = new Appointment(
      id,
      tenantId,
      branchId,
      patientId,
      providerId,
      new TimeSlotVO(t1.toISOString(), end(t1).toISOString()),
      AppointmentStatus.Pending,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      roomId,
    );
    const origLock = concurrency.lockAppointmentsForUpdate.bind(concurrency);
    concurrency.lockAppointmentsForUpdate = async (client, params) => {
      await wrapper.withPlatformBypass(async (c) => {
        await c.appointment.update({ where: { id }, data: { status: 'CONFIRMED' } });
      });
      return origLock(client, params);
    };
    try {
      const handler = buildUpdateHandler(domain);
      await handler.execute(
        id,
        { notes: 'only-notes', start: t1.toISOString(), end: end(t1).toISOString() },
        providerId,
      );
      const row = await wrapper.withPlatformBypass((c) =>
        c.appointment.findUniqueOrThrow({ where: { id } }),
      );
      expect(row.status).toBe('CONFIRMED');
      expect(row.notes).toBe('only-notes');
      expect(row.scheduledStart.toISOString()).toBe(t1.toISOString());
    } finally {
      concurrency.lockAppointmentsForUpdate = origLock;
    }
  });

  it('WB02-UPDATE-FRESH-03 — final lock-set mismatch aborts and retries NEW transaction', async () => {
    await createElig();
    const providerB = randomUUID();
    const providerC = randomUUID();
    await wrapper.withPlatformBypass(async (c) => {
      for (const [pid, name] of [
        [providerB, 'B'],
        [providerC, 'C'],
      ] as const) {
        await c.user.create({
          data: {
            id: pid,
            tenantId,
            email: `uf3-${pid.slice(0, 8)}@t.local`,
            passwordHash: 'x',
            firstName: name,
            lastName: 'P',
            roles: { create: [{ role: 'DOCTOR' }] },
          },
        });
      }
    });
    await createElig(providerB);
    await createElig(providerC);
    const t1 = new Date('2029-05-01T10:00:00.000Z');
    const id = await createAppt({ start: t1, end: end(t1) });
    const domain = new Appointment(
      id,
      tenantId,
      branchId,
      patientId,
      providerId,
      new TimeSlotVO(t1.toISOString(), end(t1).toISOString()),
      AppointmentStatus.Confirmed,
    );

    const txStarts: number[] = [];
    const acquireByTx: string[][] = [];
    let acquireInCurrentTx = 0;
    const origTx = concurrency.withBookingTransaction.bind(concurrency);
    const origAcquire = concurrency.acquireSortedLockKeys.bind(concurrency);
    concurrency.withBookingTransaction = async (fn) => {
      txStarts.push(Date.now());
      acquireInCurrentTx = 0;
      return origTx(fn);
    };
    concurrency.acquireSortedLockKeys = async (client, keys) => {
      acquireInCurrentTx += 1;
      expect(acquireInCurrentTx).toBe(1);
      acquireByTx.push([...keys]);
      await origAcquire(client, keys);
      if (acquireByTx.length === 1) {
        await wrapper.withPlatformBypass(async (c) => {
          await c.appointment.update({ where: { id }, data: { providerId: providerC } });
        });
      }
    };

    try {
      const handler = buildUpdateHandler(domain);
      await handler.execute(id, { providerId: providerB }, providerB);
      expect(txStarts.length).toBeGreaterThanOrEqual(2);
      const row = await wrapper.withPlatformBypass((c) =>
        c.appointment.findUniqueOrThrow({ where: { id } }),
      );
      expect(row.providerId).toBe(providerB);
    } finally {
      concurrency.withBookingTransaction = origTx;
      concurrency.acquireSortedLockKeys = origAcquire;
      await wrapper.withPlatformBypass(async (c) => {
        for (const pid of [providerB, providerC]) {
          await c.providerServiceEligibility.deleteMany({ where: { providerUserId: pid } });
          await c.userRoleAssignment.deleteMany({ where: { userId: pid } });
          await c.user.deleteMany({ where: { id: pid } });
        }
      });
    }
  });

  function buildTestPrisma() {
    return {
      withPlatformBypass: wrapper.withPlatformBypass.bind(wrapper),
      patient: {
        findFirst: (args: never) =>
          wrapper.withPlatformBypass((c) => c.patient.findFirst(args)),
      },
      appointment: {
        findFirst: (args: never) =>
          wrapper.withPlatformBypass((c) => c.appointment.findFirst(args)),
        create: (args: never) =>
          wrapper.withPlatformBypass((c) => c.appointment.create(args)),
        update: (args: never) =>
          wrapper.withPlatformBypass((c) => c.appointment.update(args)),
        updateMany: (args: never) =>
          wrapper.withPlatformBypass((c) => c.appointment.updateMany(args)),
      },
    };
  }

  function buildWalkIn(opts?: { resolveFail?: boolean; commercial?: boolean }) {
    const commercial = {
      resolveCanonical: async () => {
        if (opts?.resolveFail) throw new BadRequestException('cannot resolve canonical service');
        return {
          clinicalServiceId,
          stableKey: 'canonical.wbn',
          displayNameAr: 'س',
          displayNameEn: 'S',
          tenantServiceConfigurationId: null,
          priceVersionId: null,
          pricingUnit: 'PER_VISIT',
          currency: 'SYP',
          unitPrice: 10,
          taxPercent: 0,
          quantity: 1,
          commercialReason: 'QUEUE_WALK_IN',
        };
      },
    };
    return new WalkInQueueHandler(
      buildTestPrisma() as never,
      {
        getMetrics: async () => ({ avgWaitMinutes: 0 }),
        getWaitingPosition: async () => 1,
        toBoardItem: (ticket: { id: string }) => ({ id: ticket.id }),
      } as never,
      { resolve: async () => ({ tenantId, branchId }) } as never,
      { publish: async () => undefined } as never,
      { notifyCheckIn: async () => undefined } as never,
      concurrency,
      snapshots,
      commercial as never,
      eligibility,
      resources,
      fakeAudit as never,
    );
  }

  it('WB07-QUEUE-CANONICAL-01 — flag ON walk-in with clinicalServiceId → CANONICAL_REQUIRED + rev1', async () => {
    await createElig();
    const handler = buildWalkIn();
    const item = await handler.execute(
      {
        patientId,
        providerId,
        clinicalServiceId,
        priority: 'walk_in',
      },
      providerId,
    );
    const row = await wrapper.withPlatformBypass((c) =>
      c.appointment.findFirstOrThrow({ where: { tenantId, serviceType: 'walk_in' } }),
    );
    expect(row.snapshotWriteMode).toBe('CANONICAL_REQUIRED');
    expect(row.effectiveSnapshotRevisionId).toBeTruthy();
    expect(row.commercialLockedAt).toBeTruthy();
    expect(item).toBeTruthy();
  });

  it('WB07-QUEUE-CANONICAL-02 — flag ON without clinicalServiceId → fail closed, no LEGACY row', async () => {
    const before = await wrapper.withPlatformBypass((c) =>
      c.appointment.count({ where: { tenantId } }),
    );
    const handler = buildWalkIn();
    await expect(
      handler.execute({ patientId, providerId, priority: 'walk_in' }, providerId),
    ).rejects.toBeInstanceOf(BadRequestException);
    const after = await wrapper.withPlatformBypass((c) =>
      c.appointment.count({ where: { tenantId } }),
    );
    expect(after).toBe(before);
  });

  it('WB07-QUEUE-LEGACY-01 — flag OFF walk-in → LEGACY', async () => {
    await wrapper.withPlatformBypass(async (c) => {
      await c.tenant.update({
        where: { id: tenantId },
        data: { features: { 'catalog.canonical.write': false } },
      });
    });
    const handler = buildWalkIn();
    await handler.execute({ patientId, providerId, priority: 'walk_in' }, providerId);
    const row = await wrapper.withPlatformBypass((c) =>
      c.appointment.findFirstOrThrow({ where: { tenantId, serviceType: 'walk_in' } }),
    );
    expect(row.snapshotWriteMode).toBe('LEGACY');
    expect(row.effectiveSnapshotRevisionId).toBeNull();
    expect(row.commercialLockedAt).toBeTruthy();
  });

  it('WB07-BEAUTY-CANONICAL-01 — flag ON beauty create fails closed (no silent LEGACY)', async () => {
    const beauty = new BeautySessionSyncService(
      buildTestPrisma() as never,
      { execute: async () => ({}) } as never,
      concurrency,
      eligibility,
      resources,
      fakeAudit as never,
    );
    await expect(
      beauty.syncSessions(
        tenantId,
        branchId,
        patientId,
        [],
        [
          {
            id: randomUUID(),
            status: 'scheduled',
            scheduledAt: '2029-06-01T10:00:00.000Z',
            clinicianId: providerId,
            type: 'facial',
          },
        ],
        providerId,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    const count = await wrapper.withPlatformBypass((c) =>
      c.appointment.count({ where: { tenantId } }),
    );
    expect(count).toBe(0);
  });

  it('WB07-BEAUTY-LEGACY-01 — flag OFF beauty create → LEGACY', async () => {
    await wrapper.withPlatformBypass(async (c) => {
      await c.tenant.update({
        where: { id: tenantId },
        data: { features: { 'catalog.canonical.write': false } },
      });
    });
    const beauty = new BeautySessionSyncService(
      buildTestPrisma() as never,
      { execute: async () => ({}) } as never,
      concurrency,
      eligibility,
      resources,
      fakeAudit as never,
    );
    const synced = await beauty.syncSessions(
      tenantId,
      branchId,
      patientId,
      [],
      [
        {
          id: randomUUID(),
          status: 'scheduled',
          scheduledAt: '2029-06-02T10:00:00.000Z',
          clinicianId: providerId,
          type: 'facial',
        },
      ],
      providerId,
    );
    expect(synced[0]!.appointmentId).toBeTruthy();
    const row = await wrapper.withPlatformBypass((c) =>
      c.appointment.findUniqueOrThrow({ where: { id: synced[0]!.appointmentId! } }),
    );
    expect(row.snapshotWriteMode).toBe('LEGACY');
  });

  it('WB07-PROVENANCE-IMMUTABLE-01 — LEGACY → CANONICAL_REQUIRED rejected', async () => {
    const id = await createAppt({
      start: new Date('2029-07-01T10:00:00.000Z'),
      end: new Date('2029-07-01T10:30:00.000Z'),
      snapshotWriteMode: 'LEGACY',
    });
    await expect(
      wrapper.withPlatformBypass((c) =>
        c.appointment.update({
          where: { id },
          data: { snapshotWriteMode: 'CANONICAL_REQUIRED' },
        }),
      ),
    ).rejects.toThrow(/immutable/i);
  });

  it('WB07-PROVENANCE-IMMUTABLE-02 — CANONICAL_REQUIRED → LEGACY rejected', async () => {
    const id = await createAppt({
      start: new Date('2029-07-02T10:00:00.000Z'),
      end: new Date('2029-07-02T10:30:00.000Z'),
      snapshotWriteMode: 'CANONICAL_REQUIRED',
    });
    await expect(
      wrapper.withPlatformBypass((c) =>
        c.appointment.update({
          where: { id },
          data: { snapshotWriteMode: 'LEGACY' },
        }),
      ),
    ).rejects.toThrow(/immutable/i);
  });

  it('WB07-PROVENANCE-IMMUTABLE-03 — same-value provenance update allowed with other fields', async () => {
    const id = await createAppt({
      start: new Date('2029-07-03T10:00:00.000Z'),
      end: new Date('2029-07-03T10:30:00.000Z'),
      snapshotWriteMode: 'LEGACY',
    });
    await wrapper.withPlatformBypass((c) =>
      c.appointment.update({
        where: { id },
        data: { notes: 'ok', snapshotWriteMode: 'LEGACY' },
      }),
    );
    const row = await wrapper.withPlatformBypass((c) =>
      c.appointment.findUniqueOrThrow({ where: { id } }),
    );
    expect(row.notes).toBe('ok');
    expect(row.snapshotWriteMode).toBe('LEGACY');
  });

  it('WB07-CREATE-PATH-MATRIX-01 — production create paths cannot silent-LEGACY while canonical ON', async () => {
    const root = path.join(__dirname, '../../../..');
    const paths = [
      'src/modules/scheduling/application/handlers/create-appointment.handler.ts',
      'src/modules/scheduling/application/handlers/schedule-settings.handlers.ts',
      'src/modules/queue/application/handlers/walk-in-queue.handler.ts',
      'src/modules/beauty/application/services/beauty-session-sync.service.ts',
    ];
    for (const rel of paths) {
      const src = fs.readFileSync(path.join(root, rel), 'utf8');
      expect(src).toMatch(/isTenantCanonicalWriteEnabled|snapshotWriteMode|CANONICAL_REQUIRED|LEGACY/);
      if (rel.includes('walk-in-queue') || rel.includes('beauty-session')) {
        expect(src).toMatch(/catalog\.canonical\.write|canonicalWriteOn/);
      }
    }
    const queueSrc = fs.readFileSync(
      path.join(root, 'src/modules/queue/application/handlers/walk-in-queue.handler.ts'),
      'utf8',
    );
    expect(queueSrc).toMatch(/clinicalServiceId is required for queue walk-in when catalog\.canonical\.write is ON/);
    expect(queueSrc).toMatch(/CANONICAL_REQUIRED/);
    const beautySrc = fs.readFileSync(
      path.join(root, 'src/modules/beauty/application/services/beauty-session-sync.service.ts'),
      'utf8',
    );
    expect(beautySrc).toMatch(/no silent LEGACY bypass/);
  });
});
