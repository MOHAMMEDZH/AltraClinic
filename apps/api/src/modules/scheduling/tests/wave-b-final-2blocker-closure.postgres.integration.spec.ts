/**
 * Phase 48 Wave B — final 2-blocker closure tests (WB-PA-02 discovery/locks/reread + WB-PA-07 boundary).
 */
import { randomUUID } from 'crypto';
import { ConflictException } from '@nestjs/common';
import type { PrismaClient } from '@prisma/client';
import { BookingConcurrencyService } from '../application/services/booking-concurrency.service';
import { AppointmentSnapshotService } from '../application/services/appointment-snapshot.service';
import { ProviderEligibilityService } from '../application/services/provider-eligibility.service';
import { ServiceResourceRequirementService } from '../application/services/service-resource-requirement.service';
import { UpdateAppointmentHandler } from '../application/handlers/appointment.handlers';
import {
  classifyMissingSnapshotAppointment,
  CLASS,
  PSEUDO_CUTOVER_FORBIDDEN,
  CUTOVER_MARKER_KEY,
  loadCutoverWatermark,
  runPhase48WaveBSnapshotBackfill,
  countClassifiedRemaining,
} from '../application/services/phase48-wave-b-snapshot-backfill';
import { CreateAppointmentHandler } from '../application/handlers/create-appointment.handler';
import { CreateAppointmentCommand } from '../application/commands/create-appointment.command';
import { PrismaAppointmentRepository } from '../infrastructure/prisma-appointment.repository';
import { Appointment } from '../domain/appointment.entity';
import { AppointmentStatus } from '../domain/appointment-status.enum';
import { TimeSlotVO } from '../domain/timeslot.vo';
import {
  createClinicalPrismaWrapper,
  createPlatformDbSecurityClient,
  platformDbSecurityEnabled,
} from '../../clinical-catalog/tests/clinical-catalog-db.harness';

jest.setTimeout(180_000);
const describeDb = platformDbSecurityEnabled() ? describe : describe.skip;

const fakeAudit = {
  async record() {},
  async recordInTransaction() {},
};

describeDb('Wave B final 2-blocker closure (PostgreSQL)', () => {
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
  let room2Id: string;
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
    room2Id = randomUUID();
    branchId = randomUUID();
    await wrapper.withPlatformBypass(async (c) => {
      await c.tenant.create({
        data: {
          id: tenantId,
          name: 'WB2B',
          slug: `wb2b-${tenantId.slice(0, 8)}`,
          features: { 'booking.eligibility.enforcement': true },
        },
      });
      await c.branch.create({ data: { id: branchId, tenantId, name: 'Main' } });
      await c.user.create({
        data: {
          id: providerId,
          tenantId,
          email: `2b-${providerId.slice(0, 8)}@t.local`,
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
          stableKey: `canonical.2b_${clinicalServiceId.slice(0, 8)}`,
          domain: 'GENERAL',
          lifecycle: 'PUBLISHED',
          publishedAt: new Date(),
          translations: { create: [{ locale: 'en', displayName: 'Svc' }] },
        },
      });
      await c.tenantServiceConfiguration.create({
        data: { id: randomUUID(), tenantId, clinicalServiceId, enabled: true },
      });
      for (const [id, name] of [
        [roomId, 'R1'],
        [room2Id, 'R2'],
      ] as const) {
        await c.schedulingResource.create({
          data: { id, tenantId, branchId, name, resourceType: 'ROOM', isActive: true },
        });
      }
    });
  });

  afterEach(async () => {
    await wrapper.withPlatformBypass(async (c) => {
      await c.$executeRaw`SELECT set_config('app.wave_b_snapshot_migration', 'true', true)`;
      await c.appointment.updateMany({
        where: { tenantId },
        data: { effectiveSnapshotRevisionId: null },
      });
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
    recurrenceSeriesId?: string | null;
    resourceId?: string | null;
    providerId?: string;
    status?: string;
    createdAt?: Date;
    clinicalServiceId?: string | null;
    serviceType?: string | null;
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
          clinicalServiceId:
            overrides.clinicalServiceId === undefined ? clinicalServiceId : overrides.clinicalServiceId,
          resourceId: overrides.resourceId ?? null,
          recurrenceSeriesId: overrides.recurrenceSeriesId ?? null,
          serviceType: overrides.serviceType ?? null,
          commercialLockedAt: new Date(),
          createdAt: overrides.createdAt ?? new Date('2026-08-14T12:00:00.000Z'),
          snapshotWriteMode: overrides.snapshotWriteMode ?? 'LEGACY',
        },
      });
    });
    return id;
  }

  function buildRealUpdateHandler() {
    const repo = createAuthoritativeSeriesRepo();
    return new UpdateAppointmentHandler(
      repo as never,
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

  function buildCreateHandler(opts?: {
    captureFault?: boolean;
    resolveCommercial?: boolean;
  }) {
    const snap = {
      captureCanonicalRevision1: async (client: never, args: never) => {
        if (opts?.captureFault) throw new Error('WB07_FAULT_INJECT_REVISION1');
        return snapshots.captureCanonicalRevision1(client, args);
      },
      shouldSetCommercialLock: snapshots.shouldSetCommercialLock.bind(snapshots),
      assertZeroAllowed: snapshots.assertZeroAllowed.bind(snapshots),
    };
    const commercial = {
      resolveCanonical: async () =>
        opts?.resolveCommercial === false
          ? null
          : {
              clinicalServiceId,
              stableKey: 'canonical.2b',
              displayNameAr: 'س',
              displayNameEn: 'S',
              tenantServiceConfigurationId: null,
              priceVersionId: null,
              pricingUnit: 'PER_VISIT',
              currency: 'SYP',
              unitPrice: 10,
              taxPercent: 0,
              quantity: 1,
              commercialReason: null,
            },
    };
    return new CreateAppointmentHandler(
      { findById: async () => ({ id: patientId }) } as never,
      { resolve: async () => ({ tenantId, branchId }) } as never,
      { publish: async () => undefined } as never,
      { enforceAppointmentLimit: async () => undefined } as never,
      { incrementAppointments: async () => undefined } as never,
      concurrency,
      snap as never,
      commercial as never,
      eligibility,
      resources,
      {
        withPlatformBypass: <T>(fn: (c: PrismaClient) => Promise<T>) => wrapper.withPlatformBypass(fn),
      } as never,
      fakeAudit as never,
    );
  }

  function end(d: Date) {
    return new Date(d.getTime() + 30 * 60_000);
  }

  /** Real Prisma repo methods under RLS bypass (production uses tenant request context). */
  function createAuthoritativeSeriesRepo() {
    const run = async <T>(fn: (repo: PrismaAppointmentRepository) => Promise<T>): Promise<T> =>
      wrapper.withPlatformBypass(async (c) => fn(new PrismaAppointmentRepository(c as never)));
    return {
      findById: (id: string, tid: string) => run((r) => r.findById(id, tid)),
      listSeriesFutureMembers: (params: {
        tenantId: string;
        recurrenceSeriesId: string;
        fromScheduledStart: string | Date;
        pageSize?: number;
      }) => run((r) => r.listSeriesFutureMembers(params)),
      list: (filter: never) => run((r) => r.list(filter)),
      save: (a: Appointment) => run(async (r) => {
        await r.save(a);
        return a;
      }),
      findDetailById: (id: string, tid: string) => run((r) => r.findDetailById(id, tid)),
    };
  }

  function buildHandler(
    peers: Array<{ id: string; start: Date; end: Date; providerId?: string; resourceId?: string | null }>,
    seriesId: string,
  ) {
    const listItems = peers.map((p) => ({
      id: p.id,
      providerId: p.providerId ?? providerId,
      recurrenceSeriesId: seriesId,
      start: p.start.toISOString(),
      end: p.end.toISOString(),
      status: 'confirmed',
      resourceId: p.resourceId ?? null,
    }));
    return new UpdateAppointmentHandler(
      {
        findById: async (id: string) => {
          const p = peers.find((x) => x.id === id);
          if (!p) return null;
          return new Appointment(
            p.id,
            tenantId,
            branchId,
            patientId,
            p.providerId ?? providerId,
            new TimeSlotVO(p.start.toISOString(), p.end.toISOString()),
            AppointmentStatus.Confirmed,
            undefined,
            undefined,
            undefined,
            undefined,
            undefined,
            seriesId,
            p.resourceId ?? null,
          );
        },
        listSeriesFutureMembers: async () => listItems,
        list: async () => ({ items: listItems, total: listItems.length }),
        save: async (a: Appointment) => a,
        findDetailById: async (id: string) => ({
          id,
          tenantId,
          branchId,
          patientId,
          patientName: 'P',
          providerId,
          start: peers[0]!.start.toISOString(),
          end: peers[0]!.end.toISOString(),
          status: 'confirmed',
          notes: null,
          serviceType: null,
          isEmergency: false,
          recurrenceSeriesId: seriesId,
          resourceId: null,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }),
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

  it('WB02-SERIES-DISCOVERY-01 — unrelated appointments cannot hide later series peers', async () => {
    await createElig();
    const repo = createAuthoritativeSeriesRepo();
    const seriesId = randomUUID();
    const t1 = new Date('2027-05-01T10:00:00.000Z');
    const t2 = new Date('2027-05-08T10:00:00.000Z');
    const t3 = new Date('2027-05-15T10:00:00.000Z');
    const a = await createAppt({ start: t1, end: end(t1), recurrenceSeriesId: seriesId });
    for (let i = 0; i < 12; i++) {
      await createAppt({
        start: new Date(`2027-05-03T${String(8 + (i % 8)).padStart(2, '0')}:00:00.000Z`),
        end: new Date(`2027-05-03T${String(8 + (i % 8)).padStart(2, '0')}:30:00.000Z`),
      });
    }
    const b = await createAppt({ start: t2, end: end(t2), recurrenceSeriesId: seriesId });
    const c = await createAppt({ start: t3, end: end(t3), recurrenceSeriesId: seriesId });
    const discovered = await repo.listSeriesFutureMembers({
      tenantId,
      recurrenceSeriesId: seriesId,
      fromScheduledStart: t1,
      pageSize: 2,
    });
    expect(discovered.map((d) => d.id).sort()).toEqual([a, b, c].sort());
    const handler = new UpdateAppointmentHandler(
      repo as never,
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
    process.env.WAVE_B_SERIES_PAGE_SIZE = '2';
    try {
      const ns = new Date('2027-05-02T10:00:00.000Z');
      await handler.execute(a, { start: ns.toISOString(), end: end(ns).toISOString(), seriesScope: 'future' }, providerId);
      const rows = await wrapper.withPlatformBypass((client) =>
        client.appointment.findMany({ where: { id: { in: [a, b, c] } }, orderBy: { scheduledStart: 'asc' } }),
      );
      expect(rows.map((r) => r.scheduledStart.toISOString())).toEqual([
        new Date('2027-05-02T10:00:00.000Z').toISOString(),
        new Date('2027-05-09T10:00:00.000Z').toISOString(),
        new Date('2027-05-16T10:00:00.000Z').toISOString(),
      ]);
    } finally {
      delete process.env.WAVE_B_SERIES_PAGE_SIZE;
    }
  });

  it('WB02-SERIES-DISCOVERY-02 — peers > pageSize all discovered across pages', async () => {
    const repo = createAuthoritativeSeriesRepo();
    const seriesId = randomUUID();
    const ids: string[] = [];
    for (let i = 0; i < 7; i++) {
      const start = new Date(Date.UTC(2027, 6, 1 + i * 7, 10, 0, 0));
      ids.push(await createAppt({ start, end: end(start), recurrenceSeriesId: seriesId }));
    }
    const discovered = await repo.listSeriesFutureMembers({
      tenantId,
      recurrenceSeriesId: seriesId,
      fromScheduledStart: new Date(Date.UTC(2027, 6, 1, 10, 0, 0)),
      pageSize: 3,
    });
    expect(discovered).toHaveLength(7);
    expect(discovered.map((d) => d.id)).toEqual(ids);
  });

  it('WB02-SERIES-LOCKORDER-01 — multi-provider/resource keys globally sorted once', async () => {
    await createElig();
    const seriesId = randomUUID();
    const provider2 = randomUUID();
    await wrapper.withPlatformBypass(async (c) => {
      await c.user.create({
        data: {
          id: provider2,
          tenantId,
          email: `lo-${provider2.slice(0, 8)}@t.local`,
          passwordHash: 'x',
          firstName: 'P2',
          lastName: 'D',
          roles: { create: [{ role: 'DOCTOR' }] },
        },
      });
    });
    await createElig(provider2);
    const t1 = new Date('2027-08-01T10:00:00.000Z');
    const t2 = new Date('2027-08-08T10:00:00.000Z');
    const a = await createAppt({ start: t1, end: end(t1), recurrenceSeriesId: seriesId, resourceId: roomId });
    const b = await createAppt({
      start: t2,
      end: end(t2),
      recurrenceSeriesId: seriesId,
      resourceId: room2Id,
      providerId: provider2,
    });
    const acquired: string[][] = [];
    const orig = concurrency.acquireSortedLockKeys.bind(concurrency);
    concurrency.acquireSortedLockKeys = async (client, keys) => {
      acquired.push([...keys]);
      return orig(client, keys);
    };
    try {
      const handler = buildHandler(
        [
          { id: a, start: t1, end: end(t1), resourceId: roomId },
          { id: b, start: t2, end: end(t2), providerId: provider2, resourceId: room2Id },
        ],
        seriesId,
      );
      const ns = new Date('2027-08-02T10:00:00.000Z');
      await handler.execute(a, { start: ns.toISOString(), end: end(ns).toISOString(), seriesScope: 'future' }, providerId);
      expect(acquired.length).toBeGreaterThanOrEqual(1);
      const pass = acquired[0]!;
      expect(pass).toEqual([...pass].sort());
      expect(pass.join('|')).toContain(providerId);
      expect(pass.join('|')).toContain(provider2);
      expect(pass.join('|')).toContain(roomId);
      expect(pass.join('|')).toContain(room2Id);
    } finally {
      concurrency.acquireSortedLockKeys = orig;
      await wrapper.withPlatformBypass(async (c) => {
        await c.providerServiceEligibility.deleteMany({ where: { providerUserId: provider2 } });
        await c.userRoleAssignment.deleteMany({ where: { userId: provider2 } });
        await c.user.deleteMany({ where: { id: provider2 } });
      });
    }
  });

  it('WB02-SERIES-LOCKORDER-02 — reverse composition competing series → no deadlock / no partial', async () => {
    await createElig();
    const seriesA = randomUUID();
    const seriesB = randomUUID();
    const a1s = new Date('2027-09-01T10:00:00.000Z');
    const a2s = new Date('2027-09-08T10:00:00.000Z');
    const b1s = new Date('2027-09-01T12:00:00.000Z');
    const b2s = new Date('2027-09-08T12:00:00.000Z');
    const a1 = await createAppt({ start: a1s, end: end(a1s), recurrenceSeriesId: seriesA, resourceId: roomId });
    const a2 = await createAppt({ start: a2s, end: end(a2s), recurrenceSeriesId: seriesA, resourceId: room2Id });
    const b1 = await createAppt({ start: b1s, end: end(b1s), recurrenceSeriesId: seriesB, resourceId: room2Id });
    const b2 = await createAppt({ start: b2s, end: end(b2s), recurrenceSeriesId: seriesB, resourceId: roomId });
    const target = new Date('2027-09-15T10:00:00.000Z');
    const handlerA = buildHandler(
      [
        { id: a1, start: a1s, end: end(a1s), resourceId: roomId },
        { id: a2, start: a2s, end: end(a2s), resourceId: room2Id },
      ],
      seriesA,
    );
    const handlerB = buildHandler(
      [
        { id: b1, start: b1s, end: end(b1s), resourceId: room2Id },
        { id: b2, start: b2s, end: end(b2s), resourceId: roomId },
      ],
      seriesB,
    );
    const results = await Promise.allSettled([
      handlerA.execute(a1, { start: target.toISOString(), end: end(target).toISOString(), seriesScope: 'future' }, providerId),
      handlerB.execute(b1, { start: target.toISOString(), end: end(target).toISOString(), seriesScope: 'future' }, providerId),
    ]);
    expect(results).toHaveLength(2);
    for (const [ids, starts] of [
      [[a1, a2], [a1s, a2s]],
      [[b1, b2], [b1s, b2s]],
    ] as const) {
      const rows = await wrapper.withPlatformBypass((c) =>
        c.appointment.findMany({ where: { id: { in: [...ids] } }, orderBy: { scheduledStart: 'asc' } }),
      );
      const allMoved = rows.every((r, i) => r.scheduledStart.getTime() !== starts[i]!.getTime());
      const noneMoved = rows.every((r, i) => r.scheduledStart.getTime() === starts[i]!.getTime());
      expect(allMoved || noneMoved).toBe(true);
    }
  });

  it('WB02-SERIES-LOCKORDER-03 — true reversed multi-provider/resource composition → no deadlock', async () => {
    await createElig();
    const providerP1 = providerId;
    const providerP2 = randomUUID();
    await wrapper.withPlatformBypass(async (c) => {
      await c.user.create({
        data: {
          id: providerP2,
          tenantId,
          email: `lo3-${providerP2.slice(0, 8)}@t.local`,
          passwordHash: 'x',
          firstName: 'P2',
          lastName: 'P',
          roles: { create: [{ role: 'DOCTOR' }] },
        },
      });
    });
    await createElig(providerP2);
    const sharedResource = roomId;
    const seriesA = randomUUID();
    const seriesB = randomUUID();
    // Shared advisory namespace: both series need P1 + P2 + R1 (reversed composition).
    const a1s = new Date('2027-11-01T10:00:00.000Z');
    const a2s = new Date('2027-11-08T10:00:00.000Z');
    const b1s = new Date('2027-11-01T12:00:00.000Z');
    const b2s = new Date('2027-11-08T12:00:00.000Z');
    const a1 = await createAppt({
      start: a1s,
      end: end(a1s),
      recurrenceSeriesId: seriesA,
      providerId: providerP1,
      resourceId: sharedResource,
    });
    const a2 = await createAppt({
      start: a2s,
      end: end(a2s),
      recurrenceSeriesId: seriesA,
      providerId: providerP2,
      resourceId: sharedResource,
    });
    const b1 = await createAppt({
      start: b1s,
      end: end(b1s),
      recurrenceSeriesId: seriesB,
      providerId: providerP2,
      resourceId: sharedResource,
    });
    const b2 = await createAppt({
      start: b2s,
      end: end(b2s),
      recurrenceSeriesId: seriesB,
      providerId: providerP1,
      resourceId: sharedResource,
    });

    const expectedShared = concurrency.buildGlobalLockKeys({
      tenantId,
      providerIds: [providerP1, providerP2],
      resourceIds: [sharedResource],
    });
    expect(expectedShared).toHaveLength(3);

    const acquirePasses: string[][] = [];
    const origAcquire = concurrency.acquireSortedLockKeys.bind(concurrency);
    concurrency.acquireSortedLockKeys = async (client, keys) => {
      const sorted = [...keys].sort();
      expect(keys).toEqual(sorted);
      acquirePasses.push([...keys]);
      return origAcquire(client, keys);
    };

    const target = new Date('2027-11-15T10:00:00.000Z');
    const handlerA = buildHandler(
      [
        { id: a1, start: a1s, end: end(a1s), providerId: providerP1, resourceId: sharedResource },
        { id: a2, start: a2s, end: end(a2s), providerId: providerP2, resourceId: sharedResource },
      ],
      seriesA,
    );
    const handlerB = buildHandler(
      [
        { id: b1, start: b1s, end: end(b1s), providerId: providerP2, resourceId: sharedResource },
        { id: b2, start: b2s, end: end(b2s), providerId: providerP1, resourceId: sharedResource },
      ],
      seriesB,
    );

    try {
      const results = await Promise.allSettled([
        handlerA.execute(
          a1,
          { start: target.toISOString(), end: end(target).toISOString(), seriesScope: 'future' },
          providerP1,
        ),
        handlerB.execute(
          b1,
          {
            start: new Date('2027-11-15T12:00:00.000Z').toISOString(),
            end: end(new Date('2027-11-15T12:00:00.000Z')).toISOString(),
            seriesScope: 'future',
          },
          providerP2,
        ),
      ]);
      expect(results).toHaveLength(2);
      expect(acquirePasses.length).toBeGreaterThanOrEqual(2);
      for (const pass of acquirePasses) {
        expect(pass).toEqual([...pass].sort());
        // Exact shared advisory keys (not disjoint namespaces).
        expect(pass).toEqual(expectedShared);
      }
      for (const [ids, starts] of [
        [[a1, a2], [a1s, a2s]],
        [[b1, b2], [b1s, b2s]],
      ] as const) {
        const rows = await wrapper.withPlatformBypass((c) =>
          c.appointment.findMany({ where: { id: { in: [...ids] } }, orderBy: { scheduledStart: 'asc' } }),
        );
        const allMoved = rows.every((r, i) => r.scheduledStart.getTime() !== starts[i]!.getTime());
        const noneMoved = rows.every((r, i) => r.scheduledStart.getTime() === starts[i]!.getTime());
        expect(allMoved || noneMoved).toBe(true);
      }
    } finally {
      concurrency.acquireSortedLockKeys = origAcquire;
      await wrapper.withPlatformBypass(async (c) => {
        await c.providerServiceEligibility.deleteMany({ where: { providerUserId: providerP2 } });
        await c.userRoleAssignment.deleteMany({ where: { userId: providerP2 } });
        await c.user.deleteMany({ where: { id: providerP2 } });
      });
    }
  });

  it('WB02-SERIES-RETRY-TX-01 — provider identity change aborts tx; new tx rebuilds global keys once', async () => {
    await createElig();
    const providerZ = providerId;
    const providerA = randomUUID();
    await wrapper.withPlatformBypass(async (c) => {
      await c.user.create({
        data: {
          id: providerA,
          tenantId,
          email: `rtx1-${providerA.slice(0, 8)}@t.local`,
          passwordHash: 'x',
          firstName: 'A',
          lastName: 'R',
          roles: { create: [{ role: 'DOCTOR' }] },
        },
      });
    });
    await createElig(providerA);
    const seriesId = randomUUID();
    const t1 = new Date('2027-12-01T10:00:00.000Z');
    const t2 = new Date('2027-12-08T10:00:00.000Z');
    const a = await createAppt({ start: t1, end: end(t1), recurrenceSeriesId: seriesId, providerId: providerZ });
    const b = await createAppt({ start: t2, end: end(t2), recurrenceSeriesId: seriesId, providerId: providerZ });

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
      expect(acquireInCurrentTx).toBe(1); // exactly one pass per transaction attempt
      acquireByTx.push([...keys]);
      await origAcquire(client, keys);
      if (acquireByTx.length === 1) {
        // Concurrent actor commits on a SEPARATE connection (survives abort of this tx).
        await wrapper.withPlatformBypass(async (c) => {
          await c.appointment.update({ where: { id: b }, data: { providerId: providerA } });
        });
      }
    };

    try {
      const handler = buildHandler(
        [
          { id: a, start: t1, end: end(t1), providerId: providerZ },
          { id: b, start: t2, end: end(t2), providerId: providerZ },
        ],
        seriesId,
      );
      const ns = new Date('2027-12-02T10:00:00.000Z');
      await handler.execute(a, { start: ns.toISOString(), end: end(ns).toISOString(), seriesScope: 'future' }, providerZ);
      expect(txStarts.length).toBeGreaterThanOrEqual(2);
      expect(acquireByTx.length).toBeGreaterThanOrEqual(2);
      expect(acquireByTx[0]!.join('|')).toContain(providerZ);
      expect(acquireByTx[0]!.join('|')).not.toContain(providerA);
      const second = acquireByTx[1]!;
      expect(second).toEqual([...second].sort());
      expect(second.join('|')).toContain(providerA);
      const rowB = await wrapper.withPlatformBypass((c) => c.appointment.findUniqueOrThrow({ where: { id: b } }));
      expect(rowB.providerId).toBe(providerA);
      expect(rowB.scheduledStart.toISOString()).toBe(new Date('2027-12-09T10:00:00.000Z').toISOString());
    } finally {
      concurrency.withBookingTransaction = origTx;
      concurrency.acquireSortedLockKeys = origAcquire;
      await wrapper.withPlatformBypass(async (c) => {
        await c.providerServiceEligibility.deleteMany({ where: { providerUserId: providerA } });
        await c.userRoleAssignment.deleteMany({ where: { userId: providerA } });
        await c.user.deleteMany({ where: { id: providerA } });
      });
    }
  });

  it('WB02-SERIES-RETRY-TX-02 — allocation change aborts tx; retry rebuilds resource keys', async () => {
    await createElig();
    const seriesId = randomUUID();
    const t1 = new Date('2028-01-01T10:00:00.000Z');
    const t2 = new Date('2028-01-08T10:00:00.000Z');
    const a = await createAppt({ start: t1, end: end(t1), recurrenceSeriesId: seriesId, resourceId: roomId });
    const b = await createAppt({ start: t2, end: end(t2), recurrenceSeriesId: seriesId, resourceId: roomId });
    await concurrency.withBookingTransaction(async (client) => {
      await client.appointmentResourceAllocation.create({
        data: { id: randomUUID(), tenantId, appointmentId: b, schedulingResourceId: roomId },
      });
    });

    const acquireByTx: string[][] = [];
    let acquireInCurrentTx = 0;
    const origTx = concurrency.withBookingTransaction.bind(concurrency);
    const origAcquire = concurrency.acquireSortedLockKeys.bind(concurrency);
    concurrency.withBookingTransaction = async (fn) => {
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
          await c.appointmentResourceAllocation.deleteMany({ where: { appointmentId: b } });
          await c.appointmentResourceAllocation.create({
            data: { id: randomUUID(), tenantId, appointmentId: b, schedulingResourceId: room2Id },
          });
          await c.appointment.update({ where: { id: b }, data: { resourceId: room2Id } });
        });
      }
    };

    try {
      const handler = buildHandler(
        [
          { id: a, start: t1, end: end(t1), resourceId: roomId },
          { id: b, start: t2, end: end(t2), resourceId: roomId },
        ],
        seriesId,
      );
      const ns = new Date('2028-01-02T10:00:00.000Z');
      await handler.execute(a, { start: ns.toISOString(), end: end(ns).toISOString(), seriesScope: 'future' }, providerId);
      expect(acquireByTx.length).toBeGreaterThanOrEqual(2);
      expect(acquireByTx[1]!.join('|')).toContain(room2Id);
      expect(acquireByTx[1]!).toEqual([...acquireByTx[1]!].sort());
    } finally {
      concurrency.withBookingTransaction = origTx;
      concurrency.acquireSortedLockKeys = origAcquire;
    }
  });

  it('WB02-SERIES-RETRY-TX-03 — identity changes every attempt → fail closed; zero peer updates', async () => {
    await createElig();
    const providerAlt = randomUUID();
    await wrapper.withPlatformBypass(async (c) => {
      await c.user.create({
        data: {
          id: providerAlt,
          tenantId,
          email: `rtx3-${providerAlt.slice(0, 8)}@t.local`,
          passwordHash: 'x',
          firstName: 'X',
          lastName: 'Y',
          roles: { create: [{ role: 'DOCTOR' }] },
        },
      });
    });
    await createElig(providerAlt);
    const seriesId = randomUUID();
    const t1 = new Date('2028-02-01T10:00:00.000Z');
    const t2 = new Date('2028-02-08T10:00:00.000Z');
    const a = await createAppt({ start: t1, end: end(t1), recurrenceSeriesId: seriesId });
    const b = await createAppt({ start: t2, end: end(t2), recurrenceSeriesId: seriesId });

    let flip = 0;
    const origAcquire = concurrency.acquireSortedLockKeys.bind(concurrency);
    concurrency.acquireSortedLockKeys = async (client, keys) => {
      flip += 1;
      await origAcquire(client, keys);
      const next = flip % 2 === 1 ? providerAlt : providerId;
      await wrapper.withPlatformBypass(async (c) => {
        await c.appointment.update({ where: { id: b }, data: { providerId: next } });
      });
    };

    try {
      const handler = buildHandler(
        [
          { id: a, start: t1, end: end(t1) },
          { id: b, start: t2, end: end(t2) },
        ],
        seriesId,
      );
      const ns = new Date('2028-02-02T10:00:00.000Z');
      await expect(
        handler.execute(a, { start: ns.toISOString(), end: end(ns).toISOString(), seriesScope: 'future' }, providerId),
      ).rejects.toBeInstanceOf(ConflictException);
      const rows = await wrapper.withPlatformBypass((c) =>
        c.appointment.findMany({ where: { id: { in: [a, b] } } }),
      );
      expect(rows.every((r) => r.scheduledStart.getTime() === t1.getTime() || r.scheduledStart.getTime() === t2.getTime())).toBe(
        true,
      );
      expect(rows.find((r) => r.id === a)!.scheduledStart.toISOString()).toBe(t1.toISOString());
      expect(rows.find((r) => r.id === b)!.scheduledStart.toISOString()).toBe(t2.toISOString());
    } finally {
      concurrency.acquireSortedLockKeys = origAcquire;
      await wrapper.withPlatformBypass(async (c) => {
        await c.providerServiceEligibility.deleteMany({ where: { providerUserId: providerAlt } });
        await c.userRoleAssignment.deleteMany({ where: { userId: providerAlt } });
        await c.user.deleteMany({ where: { id: providerAlt } });
      });
    }
  });

  it('WB02-SERIES-REREAD-01 — provider change under lock path → fresh reread / retry', async () => {
    await createElig();
    const seriesId = randomUUID();
    const provider2 = randomUUID();
    await wrapper.withPlatformBypass(async (c) => {
      await c.user.create({
        data: {
          id: provider2,
          tenantId,
          email: `rr-${provider2.slice(0, 8)}@t.local`,
          passwordHash: 'x',
          firstName: 'R',
          lastName: 'R',
          roles: { create: [{ role: 'DOCTOR' }] },
        },
      });
    });
    await createElig(provider2);
    const t1 = new Date('2027-10-01T10:00:00.000Z');
    const t2 = new Date('2027-10-08T10:00:00.000Z');
    const a = await createAppt({ start: t1, end: end(t1), recurrenceSeriesId: seriesId });
    const b = await createAppt({ start: t2, end: end(t2), recurrenceSeriesId: seriesId });
    let mutated = false;
    const orig = concurrency.acquireSortedLockKeys.bind(concurrency);
    concurrency.acquireSortedLockKeys = async (client, keys) => {
      await orig(client, keys);
      if (!mutated) {
        mutated = true;
        await wrapper.withPlatformBypass(async (c) => {
          await c.appointment.update({ where: { id: b }, data: { providerId: provider2 } });
        });
      }
    };
    try {
      const handler = buildHandler(
        [
          { id: a, start: t1, end: end(t1) },
          { id: b, start: t2, end: end(t2) },
        ],
        seriesId,
      );
      const ns = new Date('2027-10-02T10:00:00.000Z');
      await handler.execute(a, { start: ns.toISOString(), end: end(ns).toISOString(), seriesScope: 'future' }, providerId);
      const rowB = await wrapper.withPlatformBypass((c) => c.appointment.findUniqueOrThrow({ where: { id: b } }));
      expect(rowB.providerId).toBe(provider2);
      expect(rowB.scheduledStart.toISOString()).toBe(new Date('2027-10-09T10:00:00.000Z').toISOString());
    } finally {
      concurrency.acquireSortedLockKeys = orig;
      await wrapper.withPlatformBypass(async (c) => {
        await c.providerServiceEligibility.deleteMany({ where: { providerUserId: provider2 } });
        await c.userRoleAssignment.deleteMany({ where: { userId: provider2 } });
        await c.user.deleteMany({ where: { id: provider2 } });
      });
    }
  });

  it('WB02-SERIES-REREAD-02 — allocation change before lock → stale alloc unused', async () => {
    await createElig();
    const seriesId = randomUUID();
    const t1 = new Date('2027-11-01T10:00:00.000Z');
    const t2 = new Date('2027-11-08T10:00:00.000Z');
    const a = await createAppt({ start: t1, end: end(t1), recurrenceSeriesId: seriesId, resourceId: roomId });
    const b = await createAppt({ start: t2, end: end(t2), recurrenceSeriesId: seriesId, resourceId: roomId });
    await concurrency.withBookingTransaction(async (client) => {
      await concurrency.replaceResourceAllocations(client, { tenantId, appointmentId: b, resourceIds: [roomId] });
    });
    let mutated = false;
    const orig = concurrency.acquireSortedLockKeys.bind(concurrency);
    concurrency.acquireSortedLockKeys = async (client, keys) => {
      await orig(client, keys);
      if (!mutated) {
        mutated = true;
        await wrapper.withPlatformBypass(async (c) => {
          await c.appointmentResourceAllocation.deleteMany({ where: { appointmentId: b } });
          await c.appointmentResourceAllocation.create({
            data: { id: randomUUID(), tenantId, appointmentId: b, schedulingResourceId: room2Id },
          });
          await c.appointment.update({ where: { id: b }, data: { resourceId: room2Id } });
        });
      }
    };
    try {
      const handler = buildHandler(
        [
          { id: a, start: t1, end: end(t1), resourceId: roomId },
          { id: b, start: t2, end: end(t2), resourceId: roomId },
        ],
        seriesId,
      );
      const ns = new Date('2027-11-02T10:00:00.000Z');
      await handler.execute(a, { start: ns.toISOString(), end: end(ns).toISOString(), seriesScope: 'future' }, providerId);
      const allocs = await wrapper.withPlatformBypass((c) =>
        c.appointmentResourceAllocation.findMany({ where: { appointmentId: b } }),
      );
      expect(allocs.map((x) => x.schedulingResourceId)).toEqual([room2Id]);
    } finally {
      concurrency.acquireSortedLockKeys = orig;
    }
  });

  it('WB02-SERIES-REREAD-03 — cancel before locks → no stale write', async () => {
    await createElig();
    const seriesId = randomUUID();
    const t1 = new Date('2027-12-01T10:00:00.000Z');
    const t2 = new Date('2027-12-08T10:00:00.000Z');
    const a = await createAppt({ start: t1, end: end(t1), recurrenceSeriesId: seriesId });
    const b = await createAppt({ start: t2, end: end(t2), recurrenceSeriesId: seriesId });
    let mutated = false;
    const orig = concurrency.acquireSortedLockKeys.bind(concurrency);
    concurrency.acquireSortedLockKeys = async (client, keys) => {
      await orig(client, keys);
      if (!mutated) {
        mutated = true;
        await wrapper.withPlatformBypass(async (c) => {
          await c.appointment.update({ where: { id: b }, data: { status: 'CANCELLED' } });
        });
      }
    };
    try {
      const handler = buildHandler(
        [
          { id: a, start: t1, end: end(t1) },
          { id: b, start: t2, end: end(t2) },
        ],
        seriesId,
      );
      await expect(
        handler.execute(
          a,
          {
            start: new Date('2027-12-02T10:00:00.000Z').toISOString(),
            end: end(new Date('2027-12-02T10:00:00.000Z')).toISOString(),
            seriesScope: 'future',
          },
          providerId,
        ),
      ).rejects.toBeInstanceOf(ConflictException);
      const rowA = await wrapper.withPlatformBypass((c) => c.appointment.findUniqueOrThrow({ where: { id: a } }));
      expect(rowA.scheduledStart.toISOString()).toBe(t1.toISOString());
    } finally {
      concurrency.acquireSortedLockKeys = orig;
    }
  });

  it('WB07-BACKFILL-BOUNDARY-01 — legacy missing snapshot → LEGACY_BACKFILL_ELIGIBLE + synthetic', async () => {
    const id = await createAppt({
      start: new Date('2026-01-01T10:00:00.000Z'),
      end: new Date('2026-01-01T10:30:00.000Z'),
      status: 'PENDING',
      clinicalServiceId: null,
      serviceType: 'legacy-boundary',
      snapshotWriteMode: 'LEGACY',
      createdAt: new Date(), // post-marker timestamp must NOT force canonical
    });
    expect(
      classifyMissingSnapshotAppointment({ snapshotWriteMode: 'LEGACY' }),
    ).toBe(CLASS.LEGACY_BACKFILL_ELIGIBLE);
    const report = await runPhase48WaveBSnapshotBackfill(raw, { actorId: providerId, tenantId });
    expect(report.ok).toBe(true);
    const rev = await wrapper.withPlatformBypass((c) =>
      c.appointmentServiceSnapshotRevision.findFirst({ where: { appointmentId: id } }),
    );
    expect(rev).toBeTruthy();
  });

  it('WB07-BACKFILL-BOUNDARY-02 — CANONICAL_REQUIRED missing snapshot → integrity failure, no synthetic', async () => {
    const id = await createAppt({
      start: new Date('2026-09-01T10:00:00.000Z'),
      end: new Date('2026-09-01T10:30:00.000Z'),
      status: 'PENDING',
      snapshotWriteMode: 'CANONICAL_REQUIRED',
      createdAt: new Date('2020-01-01T00:00:00.000Z'), // pre-marker must NOT force legacy
    });
    expect(
      classifyMissingSnapshotAppointment({ snapshotWriteMode: 'CANONICAL_REQUIRED' }),
    ).toBe(CLASS.CANONICAL_INTEGRITY_FAILURE);
    await expect(runPhase48WaveBSnapshotBackfill(raw, { actorId: providerId, tenantId })).rejects.toThrow(
      /canonicalIntegrityFailures/,
    );
    const rev = await wrapper.withPlatformBypass((c) =>
      c.appointmentServiceSnapshotRevision.findFirst({ where: { appointmentId: id } }),
    );
    expect(rev).toBeNull();
  });

  it('WB07-BACKFILL-BOUNDARY-03 — mixed dataset processes only legacy', async () => {
    const legacyId = await createAppt({
      start: new Date('2026-01-02T10:00:00.000Z'),
      end: new Date('2026-01-02T10:30:00.000Z'),
      status: 'PENDING',
      clinicalServiceId: null,
      serviceType: 'mix-legacy',
      snapshotWriteMode: 'LEGACY',
    });
    const canonId = await createAppt({
      start: new Date('2026-09-02T10:00:00.000Z'),
      end: new Date('2026-09-02T10:30:00.000Z'),
      status: 'PENDING',
      snapshotWriteMode: 'CANONICAL_REQUIRED',
    });
    const snapped = await createAppt({
      start: new Date('2026-01-03T10:00:00.000Z'),
      end: new Date('2026-01-03T10:30:00.000Z'),
      status: 'PENDING',
      snapshotWriteMode: 'CANONICAL_REQUIRED',
    });
    await concurrency.withBookingTransaction(async (client) => {
      await snapshots.captureCanonicalRevision1(client, {
        tenantId,
        appointmentId: snapped,
        actorId: providerId,
        commercial: {
          clinicalServiceId,
          stableKey: 'canonical.2b',
          displayNameAr: 'س',
          displayNameEn: 'S',
          tenantServiceConfigurationId: null,
          priceVersionId: null,
          pricingUnit: 'PER_VISIT',
          currency: 'SYP',
          unitPrice: 10,
          taxPercent: 0,
          quantity: 1,
          commercialReason: null,
        },
      });
    });
    const beforeSnap = await wrapper.withPlatformBypass((c) =>
      c.appointment.findUniqueOrThrow({ where: { id: snapped } }),
    );
    await expect(runPhase48WaveBSnapshotBackfill(raw, { actorId: providerId, tenantId })).rejects.toThrow(
      /canonicalIntegrityFailures/,
    );
    const legacyRev = await wrapper.withPlatformBypass((c) =>
      c.appointmentServiceSnapshotRevision.findFirst({ where: { appointmentId: legacyId } }),
    );
    const canonRev = await wrapper.withPlatformBypass((c) =>
      c.appointmentServiceSnapshotRevision.findFirst({ where: { appointmentId: canonId } }),
    );
    const afterSnap = await wrapper.withPlatformBypass((c) =>
      c.appointment.findUniqueOrThrow({ where: { id: snapped } }),
    );
    expect(legacyRev).toBeTruthy();
    expect(canonRev).toBeNull();
    expect(afterSnap.effectiveSnapshotRevisionId).toBe(beforeSnap.effectiveSnapshotRevisionId);
  });

  it('WB07-BACKFILL-BOUNDARY-04 — rerun after legacy completion → legacyEligibleRemaining=0', async () => {
    await createAppt({
      start: new Date('2026-01-04T10:00:00.000Z'),
      end: new Date('2026-01-04T10:30:00.000Z'),
      status: 'PENDING',
      clinicalServiceId: null,
      serviceType: 'idem-boundary',
      snapshotWriteMode: 'LEGACY',
    });
    const first = await runPhase48WaveBSnapshotBackfill(raw, { actorId: providerId, tenantId });
    expect(first.legacyEligibleRemaining).toBe(0);
    expect(first.canonicalIntegrityFailures).toBe(0);
    const second = await runPhase48WaveBSnapshotBackfill(raw, { actorId: providerId, tenantId });
    expect(second.processed).toBe(0);
    expect(second.legacyEligibleRemaining).toBe(0);
  });

  it('WB07-BACKFILL-BOUNDARY-05 — classification deterministic across reruns', async () => {
    const legacy = { snapshotWriteMode: 'LEGACY' };
    const canon = { snapshotWriteMode: 'CANONICAL_REQUIRED' };
    expect(classifyMissingSnapshotAppointment(legacy)).toBe(CLASS.LEGACY_BACKFILL_ELIGIBLE);
    expect(classifyMissingSnapshotAppointment(canon)).toBe(CLASS.CANONICAL_INTEGRITY_FAILURE);
    expect(classifyMissingSnapshotAppointment(legacy)).toBe(CLASS.LEGACY_BACKFILL_ELIGIBLE);
    expect(classifyMissingSnapshotAppointment(canon)).toBe(CLASS.CANONICAL_INTEGRITY_FAILURE);
  });

  it('WB07-CUTOVER-REAL-01 — corrective migration uses CURRENT_TIMESTAMP; live marker is not pseudo', async () => {
    const fs = await import('fs');
    const path = await import('path');
    const corrective = fs.readFileSync(
      path.join(
        __dirname,
        '../../../../prisma/migrations/20260815240000_phase48_wave_b_cutover_execution_time/migration.sql',
      ),
      'utf8',
    );
    expect(corrective).toMatch(/CURRENT_TIMESTAMP/);
    expect(corrective).toMatch(/ON CONFLICT \("key"\) DO NOTHING/);
    // Corrective migration may reference the known pseudo timestamp ONLY in the UPDATE WHERE clause.
    expect(corrective).toMatch(/valueTimestamptz" = CURRENT_TIMESTAMP/);
    const insertSection = corrective.split('UPDATE')[0] ?? '';
    expect(insertSection).toMatch(/VALUES\s*\(\s*'snapshot_backfill_cutover_at',\s*CURRENT_TIMESTAMP/s);
    const cutover = await loadCutoverWatermark(raw);
    expect(cutover.getTime()).not.toBe(PSEUDO_CUTOVER_FORBIDDEN.getTime());
    expect(cutover.toISOString()).not.toBe('2026-08-15T01:00:00.000Z');
  });

  it('WB07-CUTOVER-REAL-02 — marker stable across redeploy simulation (no replace of corrected value)', async () => {
    const before = await loadCutoverWatermark(raw);
    await wrapper.withPlatformBypass(async (c) => {
      await c.$executeRaw`
        INSERT INTO "phase48_wave_b_runtime_markers" ("key", "valueTimestamptz", "note")
        VALUES (${CUTOVER_MARKER_KEY}, CURRENT_TIMESTAMP, 'redeploy sim')
        ON CONFLICT ("key") DO NOTHING
      `;
      await c.$executeRaw`
        UPDATE "phase48_wave_b_runtime_markers"
        SET "valueTimestamptz" = CURRENT_TIMESTAMP
        WHERE "key" = ${CUTOVER_MARKER_KEY}
          AND "valueTimestamptz" = TIMESTAMPTZ '2026-08-15 01:00:00+00'
      `;
    });
    const after = await loadCutoverWatermark(raw);
    expect(after.getTime()).toBe(before.getTime());
  });

  it('WB07-CUTOVER-REAL-03 — LEGACY provenance remains backfill-eligible independent of cutover timestamp', async () => {
    const cutover = await loadCutoverWatermark(raw);
    const createdAt = new Date(cutover.getTime() + 60_000); // AFTER marker — still LEGACY by provenance
    const id = await createAppt({
      start: new Date('2025-06-01T10:00:00.000Z'),
      end: new Date('2025-06-01T10:30:00.000Z'),
      status: 'PENDING',
      clinicalServiceId: null,
      serviceType: 'post-marker-legacy',
      createdAt,
      snapshotWriteMode: 'LEGACY',
    });
    expect(
      classifyMissingSnapshotAppointment({ snapshotWriteMode: 'LEGACY', createdAt }, cutover),
    ).toBe(CLASS.LEGACY_BACKFILL_ELIGIBLE);
    const report = await runPhase48WaveBSnapshotBackfill(raw, { actorId: providerId, tenantId });
    expect(report.ok).toBe(true);
    const rev = await wrapper.withPlatformBypass((c) =>
      c.appointmentServiceSnapshotRevision.findFirst({ where: { appointmentId: id } }),
    );
    expect(rev).toBeTruthy();
  });

  it('WB07-CUTOVER-REAL-04 — CANONICAL_REQUIRED missing snapshot → CANONICAL_INTEGRITY_FAILURE; no synthetic', async () => {
    const cutover = await loadCutoverWatermark(raw);
    const createdAt = new Date(cutover.getTime() - 60_000); // BEFORE marker — still canonical by provenance
    const id = await createAppt({
      start: new Date('2025-07-01T10:00:00.000Z'),
      end: new Date('2025-07-01T10:30:00.000Z'),
      status: 'PENDING',
      createdAt,
      snapshotWriteMode: 'CANONICAL_REQUIRED',
    });
    expect(
      classifyMissingSnapshotAppointment({ snapshotWriteMode: 'CANONICAL_REQUIRED', createdAt }, cutover),
    ).toBe(CLASS.CANONICAL_INTEGRITY_FAILURE);
    await expect(runPhase48WaveBSnapshotBackfill(raw, { actorId: providerId, tenantId })).rejects.toThrow(
      /canonicalIntegrityFailures/,
    );
    const rev = await wrapper.withPlatformBypass((c) =>
      c.appointmentServiceSnapshotRevision.findFirst({ where: { appointmentId: id } }),
    );
    expect(rev).toBeNull();
  });

  it('WB07-CUTOVER-REAL-05 — mixed LEGACY/CANONICAL_REQUIRED: only legacy processed; CLI fails on canonical', async () => {
    const legacyId = await createAppt({
      start: new Date('2025-08-01T10:00:00.000Z'),
      end: new Date('2025-08-01T10:30:00.000Z'),
      status: 'PENDING',
      clinicalServiceId: null,
      serviceType: 'real-mix-legacy',
      snapshotWriteMode: 'LEGACY',
      createdAt: new Date(),
    });
    const canonId = await createAppt({
      start: new Date('2025-08-02T10:00:00.000Z'),
      end: new Date('2025-08-02T10:30:00.000Z'),
      status: 'PENDING',
      snapshotWriteMode: 'CANONICAL_REQUIRED',
      createdAt: new Date('2020-01-01T00:00:00.000Z'),
    });
    await expect(runPhase48WaveBSnapshotBackfill(raw, { actorId: providerId, tenantId })).rejects.toThrow(
      /canonicalIntegrityFailures/,
    );
    const legacyRev = await wrapper.withPlatformBypass((c) =>
      c.appointmentServiceSnapshotRevision.findFirst({ where: { appointmentId: legacyId } }),
    );
    const canonRev = await wrapper.withPlatformBypass((c) =>
      c.appointmentServiceSnapshotRevision.findFirst({ where: { appointmentId: canonId } }),
    );
    expect(legacyRev).toBeTruthy();
    expect(canonRev).toBeNull();
  });

  it('WB02-SERIES-ROWLOCK-01 — concurrent provider A→B blocks or series retries; no stale A-validate/B-final', async () => {
    await createElig();
    const providerA = providerId;
    const providerB = randomUUID();
    await wrapper.withPlatformBypass(async (c) => {
      await c.user.create({
        data: {
          id: providerB,
          tenantId,
          email: `rl1-${providerB.slice(0, 8)}@t.local`,
          passwordHash: 'x',
          firstName: 'B',
          lastName: 'P',
          roles: { create: [{ role: 'DOCTOR' }] },
        },
      });
    });
    await createElig(providerB);
    const seriesId = randomUUID();
    const t1 = new Date('2028-03-01T10:00:00.000Z');
    const t2 = new Date('2028-03-08T10:00:00.000Z');
    const a = await createAppt({ start: t1, end: end(t1), recurrenceSeriesId: seriesId, providerId: providerA });
    const b = await createAppt({ start: t2, end: end(t2), recurrenceSeriesId: seriesId, providerId: providerA });

    let concurrentSettled = false;
    let concurrentPromise: Promise<unknown> | null = null;
    const origLock = concurrency.lockAppointmentsForUpdate.bind(concurrency);
    concurrency.lockAppointmentsForUpdate = async (client, params) => {
      const rows = await origLock(client, params);
      if (!concurrentPromise) {
        const updater = buildRealUpdateHandler();
        const ns = new Date(t2.getTime() + 24 * 3600_000);
        concurrentPromise = updater
          .execute(
            b,
            {
              start: ns.toISOString(),
              end: end(ns).toISOString(),
              providerId: providerB,
            },
            providerB,
          )
          .then(
            (v) => {
              concurrentSettled = true;
              return v;
            },
            (e) => {
              concurrentSettled = true;
              throw e;
            },
          ) as Promise<unknown>;
        await new Promise((r) => setTimeout(r, 80));
        expect(concurrentSettled).toBe(false);
      }
      return rows;
    };

    try {
      const handler = buildHandler(
        [
          { id: a, start: t1, end: end(t1), providerId: providerA },
          { id: b, start: t2, end: end(t2), providerId: providerA },
        ],
        seriesId,
      );
      const ns = new Date('2028-03-02T10:00:00.000Z');
      await handler.execute(a, { start: ns.toISOString(), end: end(ns).toISOString(), seriesScope: 'future' }, providerA);
      await Promise.resolve(concurrentPromise as Promise<unknown> | null).catch(() => undefined);
      const rowB = await wrapper.withPlatformBypass((c) => c.appointment.findUniqueOrThrow({ where: { id: b } }));
      // Series moved time under row lock; concurrent provider mutation cannot stale-commit mid-validation.
      expect(rowB.scheduledStart.toISOString()).toBe(new Date('2028-03-09T10:00:00.000Z').toISOString());
      if (rowB.providerId === providerB) {
        // Update applied after series — must have validated B (eligibility exists).
        expect(rowB.providerId).toBe(providerB);
      } else {
        expect(rowB.providerId).toBe(providerA);
      }
    } finally {
      concurrency.lockAppointmentsForUpdate = origLock;
      await wrapper.withPlatformBypass(async (c) => {
        await c.providerServiceEligibility.deleteMany({ where: { providerUserId: providerB } });
        await c.userRoleAssignment.deleteMany({ where: { userId: providerB } });
        await c.user.deleteMany({ where: { id: providerB } });
      });
    }
  });

  it('WB02-SERIES-ROWLOCK-02 — concurrent resource allocation mutation cannot stale-commit under row lock', async () => {
    await createElig();
    const seriesId = randomUUID();
    const t1 = new Date('2028-04-01T10:00:00.000Z');
    const t2 = new Date('2028-04-08T10:00:00.000Z');
    const a = await createAppt({ start: t1, end: end(t1), recurrenceSeriesId: seriesId, resourceId: roomId });
    const b = await createAppt({ start: t2, end: end(t2), recurrenceSeriesId: seriesId, resourceId: roomId });
    await concurrency.withBookingTransaction(async (client) => {
      await client.appointmentResourceAllocation.create({
        data: { id: randomUUID(), tenantId, appointmentId: b, schedulingResourceId: roomId },
      });
    });

    const origLock = concurrency.lockAppointmentsForUpdate.bind(concurrency);
    concurrency.lockAppointmentsForUpdate = async (client, params) => {
      const rows = await origLock(client, params);
      // Concurrent mutation on separate connection — blocked by FOR UPDATE until series commits.
      void wrapper.withPlatformBypass(async (c) => {
        await c.appointmentResourceAllocation.deleteMany({ where: { appointmentId: b } });
        await c.appointmentResourceAllocation.create({
          data: { id: randomUUID(), tenantId, appointmentId: b, schedulingResourceId: room2Id },
        });
        await c.appointment.update({ where: { id: b }, data: { resourceId: room2Id } });
      });
      await new Promise((r) => setTimeout(r, 50));
      return rows;
    };

    try {
      const handler = buildHandler(
        [
          { id: a, start: t1, end: end(t1), resourceId: roomId },
          { id: b, start: t2, end: end(t2), resourceId: roomId },
        ],
        seriesId,
      );
      const ns = new Date('2028-04-02T10:00:00.000Z');
      await handler.execute(a, { start: ns.toISOString(), end: end(ns).toISOString(), seriesScope: 'future' }, providerId);
      await new Promise((r) => setTimeout(r, 150));
      const rowB = await wrapper.withPlatformBypass((c) => c.appointment.findUniqueOrThrow({ where: { id: b } }));
      expect(rowB.scheduledStart.toISOString()).toBe(new Date('2028-04-09T10:00:00.000Z').toISOString());
      // Final resource is either original (series saw locked state) or post-commit mutation — never mid-tx stale.
      expect([roomId, room2Id]).toContain(rowB.resourceId);
    } finally {
      concurrency.lockAppointmentsForUpdate = origLock;
    }
  });

  it('WB02-SERIES-ROWLOCK-03 — overlapping advisory keys reversed composition + row locks → no deadlock', async () => {
    await createElig();
    const p1 = providerId;
    const p2 = randomUUID();
    await wrapper.withPlatformBypass(async (c) => {
      await c.user.create({
        data: {
          id: p2,
          tenantId,
          email: `rl3-${p2.slice(0, 8)}@t.local`,
          passwordHash: 'x',
          firstName: 'P2',
          lastName: 'R',
          roles: { create: [{ role: 'DOCTOR' }] },
        },
      });
    });
    await createElig(p2);
    const seriesA = randomUUID();
    const seriesB = randomUUID();
    const a1s = new Date('2028-05-01T10:00:00.000Z');
    const a2s = new Date('2028-05-08T10:00:00.000Z');
    const b1s = new Date('2028-05-01T14:00:00.000Z');
    const b2s = new Date('2028-05-08T14:00:00.000Z');
    const a1 = await createAppt({ start: a1s, end: end(a1s), recurrenceSeriesId: seriesA, providerId: p1, resourceId: roomId });
    const a2 = await createAppt({ start: a2s, end: end(a2s), recurrenceSeriesId: seriesA, providerId: p2, resourceId: roomId });
    const b1 = await createAppt({ start: b1s, end: end(b1s), recurrenceSeriesId: seriesB, providerId: p2, resourceId: roomId });
    const b2 = await createAppt({ start: b2s, end: end(b2s), recurrenceSeriesId: seriesB, providerId: p1, resourceId: roomId });
    const shared = concurrency.buildGlobalLockKeys({
      tenantId,
      providerIds: [p1, p2],
      resourceIds: [roomId],
    });
    const passes: string[][] = [];
    const orig = concurrency.acquireSortedLockKeys.bind(concurrency);
    concurrency.acquireSortedLockKeys = async (client, keys) => {
      passes.push([...keys]);
      expect(keys).toEqual(shared);
      return orig(client, keys);
    };
    try {
      const hA = buildHandler(
        [
          { id: a1, start: a1s, end: end(a1s), providerId: p1, resourceId: roomId },
          { id: a2, start: a2s, end: end(a2s), providerId: p2, resourceId: roomId },
        ],
        seriesA,
      );
      const hB = buildHandler(
        [
          { id: b1, start: b1s, end: end(b1s), providerId: p2, resourceId: roomId },
          { id: b2, start: b2s, end: end(b2s), providerId: p1, resourceId: roomId },
        ],
        seriesB,
      );
      const results = await Promise.allSettled([
        hA.execute(a1, { start: new Date('2028-05-15T10:00:00.000Z').toISOString(), end: end(new Date('2028-05-15T10:00:00.000Z')).toISOString(), seriesScope: 'future' }, p1),
        hB.execute(b1, { start: new Date('2028-05-15T14:00:00.000Z').toISOString(), end: end(new Date('2028-05-15T14:00:00.000Z')).toISOString(), seriesScope: 'future' }, p2),
      ]);
      expect(results.every((r) => r.status === 'fulfilled' || r.status === 'rejected')).toBe(true);
      for (const [ids, starts] of [
        [[a1, a2], [a1s, a2s]],
        [[b1, b2], [b1s, b2s]],
      ] as const) {
        const rows = await wrapper.withPlatformBypass((c) =>
          c.appointment.findMany({ where: { id: { in: [...ids] } }, orderBy: { scheduledStart: 'asc' } }),
        );
        const allMoved = rows.every((r, i) => r.scheduledStart.getTime() !== starts[i]!.getTime());
        const noneMoved = rows.every((r, i) => r.scheduledStart.getTime() === starts[i]!.getTime());
        expect(allMoved || noneMoved).toBe(true);
      }
    } finally {
      concurrency.acquireSortedLockKeys = orig;
      await wrapper.withPlatformBypass(async (c) => {
        await c.providerServiceEligibility.deleteMany({ where: { providerUserId: p2 } });
        await c.userRoleAssignment.deleteMany({ where: { userId: p2 } });
        await c.user.deleteMany({ where: { id: p2 } });
      });
    }
  });

  it('WB02-SERIES-ROWLOCK-04 — cancel after discovery blocked by row lock / fresh reread', async () => {
    await createElig();
    const seriesId = randomUUID();
    const t1 = new Date('2028-06-01T10:00:00.000Z');
    const t2 = new Date('2028-06-08T10:00:00.000Z');
    const a = await createAppt({ start: t1, end: end(t1), recurrenceSeriesId: seriesId });
    const b = await createAppt({ start: t2, end: end(t2), recurrenceSeriesId: seriesId });
    const origLock = concurrency.lockAppointmentsForUpdate.bind(concurrency);
    concurrency.lockAppointmentsForUpdate = async (client, params) => {
      // Concurrent cancel commits before series FOR UPDATE; fresh row-lock read must fail closed.
      await wrapper.withPlatformBypass(async (c) => {
        await c.appointment.update({ where: { id: b }, data: { status: 'CANCELLED' } });
      });
      return origLock(client, params);
    };
    try {
      const handler = buildHandler(
        [
          { id: a, start: t1, end: end(t1) },
          { id: b, start: t2, end: end(t2) },
        ],
        seriesId,
      );
      await expect(
        handler.execute(
          a,
          {
            start: new Date('2028-06-02T10:00:00.000Z').toISOString(),
            end: end(new Date('2028-06-02T10:00:00.000Z')).toISOString(),
            seriesScope: 'future',
          },
          providerId,
        ),
      ).rejects.toBeTruthy();
      const rowA = await wrapper.withPlatformBypass((c) => c.appointment.findUniqueOrThrow({ where: { id: a } }));
      expect(rowA.scheduledStart.toISOString()).toBe(t1.toISOString());
    } finally {
      concurrency.lockAppointmentsForUpdate = origLock;
    }
  });

  it('WB07-PROVENANCE-01 — pre-existing appointment after migration → snapshotWriteMode=LEGACY', async () => {
    const id = await createAppt({
      start: new Date('2024-01-01T10:00:00.000Z'),
      end: new Date('2024-01-01T10:30:00.000Z'),
      status: 'PENDING',
      clinicalServiceId: null,
      serviceType: 'hist',
    });
    const row = await wrapper.withPlatformBypass((c) => c.appointment.findUniqueOrThrow({ where: { id } }));
    expect(row.snapshotWriteMode).toBe('LEGACY');
    expect(classifyMissingSnapshotAppointment(row)).toBe(CLASS.LEGACY_BACKFILL_ELIGIBLE);
  });

  it('WB07-PROVENANCE-02 — flag OFF post-marker booking → LEGACY + LEGACY_BACKFILL_ELIGIBLE', async () => {
    await wrapper.withPlatformBypass(async (c) => {
      await c.tenant.update({
        where: { id: tenantId },
        data: {
          features: {
            'catalog.canonical.write': false,
            // Provenance-under-test: eligibility OFF so free-text LEGACY create remains bounded-compatible.
            'booking.eligibility.enforcement': false,
          },
        },
      });
    });
    const handler = buildCreateHandler({ resolveCommercial: false });
    const start = new Date('2028-07-01T10:00:00.000Z');
    const result = await handler.execute(
      new CreateAppointmentCommand(
        patientId,
        providerId,
        start.toISOString(),
        end(start).toISOString(),
        undefined,
        'legacy-off',
        false,
        undefined,
        null,
        null,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        providerId,
      ),
    );
    const row = await wrapper.withPlatformBypass((c) =>
      c.appointment.findUniqueOrThrow({ where: { id: result.appointmentId } }),
    );
    expect(row.snapshotWriteMode).toBe('LEGACY');
    expect(row.effectiveSnapshotRevisionId).toBeNull();
    expect(classifyMissingSnapshotAppointment(row)).toBe(CLASS.LEGACY_BACKFILL_ELIGIBLE);
  });

  it('WB07-PROVENANCE-03 — flag ON canonical booking → CANONICAL_REQUIRED + revision 1 atomic', async () => {
    await wrapper.withPlatformBypass(async (c) => {
      await c.tenant.update({
        where: { id: tenantId },
        data: { features: { 'catalog.canonical.write': true, 'booking.eligibility.enforcement': true } },
      });
    });
    await createElig();
    const handler = buildCreateHandler();
    const start = new Date('2028-07-02T10:00:00.000Z');
    const result = await handler.execute(
      new CreateAppointmentCommand(
        patientId,
        providerId,
        start.toISOString(),
        end(start).toISOString(),
        undefined,
        null,
        false,
        undefined,
        null,
        clinicalServiceId,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        providerId,
      ),
    );
    const row = await wrapper.withPlatformBypass((c) =>
      c.appointment.findUniqueOrThrow({ where: { id: result.appointmentId } }),
    );
    expect(row.snapshotWriteMode).toBe('CANONICAL_REQUIRED');
    expect(row.effectiveSnapshotRevisionId).toBeTruthy();
    const rev = await wrapper.withPlatformBypass((c) =>
      c.appointmentServiceSnapshotRevision.findFirst({
        where: { appointmentId: result.appointmentId, revisionNumber: 1 },
      }),
    );
    expect(rev).toBeTruthy();
  });

  it('WB07-PROVENANCE-04 — fault during revision-1 → appointment rolls back; no CANONICAL_REQUIRED orphan', async () => {
    await wrapper.withPlatformBypass(async (c) => {
      await c.tenant.update({
        where: { id: tenantId },
        data: { features: { 'catalog.canonical.write': true, 'booking.eligibility.enforcement': true } },
      });
    });
    await createElig();
    const before = await wrapper.withPlatformBypass((c) =>
      c.appointment.count({ where: { tenantId } }),
    );
    const handler = buildCreateHandler({ captureFault: true });
    const start = new Date('2028-07-03T10:00:00.000Z');
    await expect(
      handler.execute(
        new CreateAppointmentCommand(
          patientId,
          providerId,
          start.toISOString(),
          end(start).toISOString(),
          undefined,
          null,
          false,
          undefined,
          null,
          clinicalServiceId,
          undefined,
          undefined,
          undefined,
          undefined,
          undefined,
          providerId,
        ),
      ),
    ).rejects.toThrow(/WB07_FAULT_INJECT_REVISION1/);
    const after = await wrapper.withPlatformBypass((c) =>
      c.appointment.count({ where: { tenantId } }),
    );
    expect(after).toBe(before);
    const orphans = await wrapper.withPlatformBypass((c) =>
      c.appointment.count({
        where: { tenantId, snapshotWriteMode: 'CANONICAL_REQUIRED', effectiveSnapshotRevisionId: null },
      }),
    );
    expect(orphans).toBe(0);
  });

  it('WB07-PROVENANCE-05 — corrupted CANONICAL_REQUIRED → integrity failure; no synthetic; hard-fail', async () => {
    const id = await createAppt({
      start: new Date('2028-07-04T10:00:00.000Z'),
      end: new Date('2028-07-04T10:30:00.000Z'),
      status: 'PENDING',
      snapshotWriteMode: 'CANONICAL_REQUIRED',
    });
    await expect(runPhase48WaveBSnapshotBackfill(raw, { actorId: providerId, tenantId })).rejects.toThrow(
      /canonicalIntegrityFailures/,
    );
    const rev = await wrapper.withPlatformBypass((c) =>
      c.appointmentServiceSnapshotRevision.findFirst({ where: { appointmentId: id } }),
    );
    expect(rev).toBeNull();
  });

  it('WB07-PROVENANCE-06 — OFF→ON→OFF→ON preserves per-appointment provenance independent of timestamp', async () => {
    const ids: string[] = [];
    for (const [i, flagOn] of [
      [0, false],
      [1, true],
      [2, false],
      [3, true],
    ] as const) {
      await wrapper.withPlatformBypass(async (c) => {
        await c.tenant.update({
          where: { id: tenantId },
          data: {
            features: {
              'catalog.canonical.write': flagOn,
              'booking.eligibility.enforcement': true,
            },
          },
        });
      });
      await createElig();
      const handler = buildCreateHandler({ resolveCommercial: flagOn });
      const start = new Date(Date.UTC(2028, 7, 10 + i, 10, 0, 0));
      const result = await handler.execute(
        new CreateAppointmentCommand(
          patientId,
          providerId,
          start.toISOString(),
          end(start).toISOString(),
          undefined,
          flagOn ? null : `toggle-${i}`,
          false,
          undefined,
          null,
          // Eligibility ON requires clinicalServiceId even when canonical write is OFF (LEGACY commercial).
          clinicalServiceId,
          undefined,
          undefined,
          undefined,
          undefined,
          undefined,
          providerId,
        ),
      );
      ids.push(result.appointmentId);
    }
    const rows = await wrapper.withPlatformBypass((c) =>
      c.appointment.findMany({ where: { id: { in: ids } }, orderBy: { scheduledStart: 'asc' } }),
    );
    expect(rows.map((r) => r.snapshotWriteMode)).toEqual([
      'LEGACY',
      'CANONICAL_REQUIRED',
      'LEGACY',
      'CANONICAL_REQUIRED',
    ]);
    expect(classifyMissingSnapshotAppointment(rows[0]!)).toBe(CLASS.LEGACY_BACKFILL_ELIGIBLE);
    expect(rows[1]!.effectiveSnapshotRevisionId).toBeTruthy();
    expect(classifyMissingSnapshotAppointment(rows[2]!)).toBe(CLASS.LEGACY_BACKFILL_ELIGIBLE);
    expect(rows[3]!.effectiveSnapshotRevisionId).toBeTruthy();
  });

  it('WB07-PROVENANCE-07 — mixed dataset: only legacy processed; valid canonical untouched; corrupted hard-fails', async () => {
    const oldLegacy = await createAppt({
      start: new Date('2023-01-01T10:00:00.000Z'),
      end: new Date('2023-01-01T10:30:00.000Z'),
      status: 'PENDING',
      clinicalServiceId: null,
      serviceType: 'old',
      snapshotWriteMode: 'LEGACY',
    });
    const postOff = await createAppt({
      start: new Date('2028-08-01T10:00:00.000Z'),
      end: new Date('2028-08-01T10:30:00.000Z'),
      status: 'PENDING',
      clinicalServiceId: null,
      serviceType: 'post-off',
      snapshotWriteMode: 'LEGACY',
      createdAt: new Date(),
    });
    const validCanon = await createAppt({
      start: new Date('2028-08-02T10:00:00.000Z'),
      end: new Date('2028-08-02T10:30:00.000Z'),
      status: 'PENDING',
      snapshotWriteMode: 'CANONICAL_REQUIRED',
    });
    await concurrency.withBookingTransaction(async (client) => {
      await snapshots.captureCanonicalRevision1(client, {
        tenantId,
        appointmentId: validCanon,
        actorId: providerId,
        commercial: {
          clinicalServiceId,
          stableKey: 'canonical.2b',
          displayNameAr: 'س',
          displayNameEn: 'S',
          tenantServiceConfigurationId: null,
          priceVersionId: null,
          pricingUnit: 'PER_VISIT',
          currency: 'SYP',
          unitPrice: 10,
          taxPercent: 0,
          quantity: 1,
          commercialReason: null,
        },
      });
    });
    const beforeValid = await wrapper.withPlatformBypass((c) =>
      c.appointment.findUniqueOrThrow({ where: { id: validCanon } }),
    );
    const corrupted = await createAppt({
      start: new Date('2028-08-03T10:00:00.000Z'),
      end: new Date('2028-08-03T10:30:00.000Z'),
      status: 'PENDING',
      snapshotWriteMode: 'CANONICAL_REQUIRED',
    });
    await expect(runPhase48WaveBSnapshotBackfill(raw, { actorId: providerId, tenantId })).rejects.toThrow(
      /canonicalIntegrityFailures/,
    );
    expect(
      await wrapper.withPlatformBypass((c) =>
        c.appointmentServiceSnapshotRevision.findFirst({ where: { appointmentId: oldLegacy } }),
      ),
    ).toBeTruthy();
    expect(
      await wrapper.withPlatformBypass((c) =>
        c.appointmentServiceSnapshotRevision.findFirst({ where: { appointmentId: postOff } }),
      ),
    ).toBeTruthy();
    expect(
      await wrapper.withPlatformBypass((c) =>
        c.appointmentServiceSnapshotRevision.findFirst({ where: { appointmentId: corrupted } }),
      ),
    ).toBeNull();
    const afterValid = await wrapper.withPlatformBypass((c) =>
      c.appointment.findUniqueOrThrow({ where: { id: validCanon } }),
    );
    expect(afterValid.effectiveSnapshotRevisionId).toBe(beforeValid.effectiveSnapshotRevisionId);
  });

  it('WB07-COUNT-SCALE-01 — final count iterates in bounded batches with exact totals', async () => {
    for (let i = 0; i < 7; i++) {
      await createAppt({
        start: new Date(Date.UTC(2028, 8, 1, 8 + i, 0, 0)),
        end: new Date(Date.UTC(2028, 8, 1, 8 + i, 30, 0)),
        status: 'PENDING',
        clinicalServiceId: null,
        serviceType: `scale-${i}`,
        snapshotWriteMode: i % 3 === 0 ? 'CANONICAL_REQUIRED' : 'LEGACY',
      });
    }
    const counts = await countClassifiedRemaining(raw, tenantId, 2);
    expect(counts.legacyEligibleRemaining + counts.canonicalIntegrityFailures).toBe(7);
    expect(counts.legacyEligibleRemaining).toBe(4);
    expect(counts.canonicalIntegrityFailures).toBe(3);
  });

  it('WB07-COUNT-SCALE-02 — reduced batch-size equivalent of >50k scale exhausts deterministically', async () => {
    const n = 55;
    for (let i = 0; i < n; i++) {
      await createAppt({
        start: new Date(Date.UTC(2028, 9, 1 + Math.floor(i / 20), 6 + (i % 10), i % 60, 0)),
        end: new Date(Date.UTC(2028, 9, 1 + Math.floor(i / 20), 6 + (i % 10), (i % 60) + 20, 0)),
        status: 'PENDING',
        clinicalServiceId: null,
        serviceType: `big-${i}`,
        snapshotWriteMode: 'LEGACY',
      });
    }
    const first = await countClassifiedRemaining(raw, tenantId, 7);
    const second = await countClassifiedRemaining(raw, tenantId, 7);
    expect(first.legacyEligibleRemaining).toBe(n);
    expect(second.legacyEligibleRemaining).toBe(n);
    expect(first.canonicalIntegrityFailures).toBe(0);
  });
});
