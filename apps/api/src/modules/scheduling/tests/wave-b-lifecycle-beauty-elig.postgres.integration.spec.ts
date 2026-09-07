/**
 * Phase 48 Wave B — Queue lifecycle commercial lock/actor,
 * Beauty LEGACY create concurrency, eligibility flag independence.
 */
import { randomUUID } from 'crypto';
import { BadRequestException, ConflictException, ForbiddenException } from '@nestjs/common';
import type { PrismaClient } from '@prisma/client';
import { BookingConcurrencyService } from '../application/services/booking-concurrency.service';
import { AppointmentSnapshotService } from '../application/services/appointment-snapshot.service';
import { AppointmentLifecycleMutationService } from '../application/services/appointment-lifecycle-mutation.service';
import { ProviderEligibilityService } from '../application/services/provider-eligibility.service';
import { ServiceResourceRequirementService } from '../application/services/service-resource-requirement.service';
import { UpdateAppointmentHandler } from '../application/handlers/appointment.handlers';
import { WalkInQueueHandler } from '../../queue/application/handlers/walk-in-queue.handler';
import { CheckInQueueHandler } from '../../queue/application/handlers/queue-board.handlers';
import { UpdateQueueStatusHandler } from '../../queue/application/handlers/update-queue-status.handler';
import { QueueBoardService } from '../../queue/application/services/queue-board.service';
import { BeautySessionSyncService } from '../../beauty/application/services/beauty-session-sync.service';
import { Appointment } from '../domain/appointment.entity';
import {
  createClinicalPrismaWrapper,
  createPlatformDbSecurityClient,
  platformDbSecurityEnabled,
} from '../../clinical-catalog/tests/clinical-catalog-db.harness';
import { PrismaAppointmentRepository } from '../infrastructure/prisma-appointment.repository';

jest.setTimeout(180_000);
const describeDb = platformDbSecurityEnabled() ? describe : describe.skip;

const fakeAudit = {
  calls: [] as Array<{ actorId: string; action: string }>,
  async record(entry: { actorId: string; action: string }) {
    this.calls.push({ actorId: entry.actorId, action: entry.action });
  },
  async recordInTransaction(_c: unknown, entry: { actorId: string; action: string }) {
    this.calls.push({ actorId: entry.actorId, action: entry.action });
  },
  reset() {
    this.calls = [];
  },
};

const fakeEvents = {
  records: [] as Array<{ actorUserId?: string | null; action: string }>,
  async record(input: { actorUserId?: string | null; action: string }, _client?: unknown) {
    this.records.push({ actorUserId: input.actorUserId ?? null, action: input.action });
  },
  reset() {
    this.records = [];
  },
};

describeDb('Wave B lifecycle / beauty create / eligibility independence (PostgreSQL)', () => {
  let raw: PrismaClient;
  let wrapper: ReturnType<typeof createClinicalPrismaWrapper>;
  let concurrency: BookingConcurrencyService;
  let snapshots: AppointmentSnapshotService;
  let lifecycle: AppointmentLifecycleMutationService;
  let eligibility: ProviderEligibilityService;
  let resources: ServiceResourceRequirementService;
  let tenantId: string;
  let patientId: string;
  let providerId: string;
  let providerB: string;
  let clinicalServiceId: string;
  let branchId: string;
  let actorU1: string;
  let actorU2: string;

  beforeAll(async () => {
    raw = createPlatformDbSecurityClient();
    wrapper = createClinicalPrismaWrapper(raw);
    concurrency = new BookingConcurrencyService(wrapper as never);
    snapshots = new AppointmentSnapshotService();
    lifecycle = new AppointmentLifecycleMutationService(
      snapshots,
      concurrency,
      fakeAudit as never,
    );
    eligibility = new ProviderEligibilityService(wrapper as never, fakeAudit as never);
    resources = new ServiceResourceRequirementService(wrapper as never, fakeAudit as never);
  });

  afterAll(async () => {
    await raw.$disconnect();
  });

  beforeEach(async () => {
    fakeAudit.reset();
    fakeEvents.reset();
    tenantId = randomUUID();
    patientId = randomUUID();
    providerId = randomUUID();
    providerB = randomUUID();
    clinicalServiceId = randomUUID();
    branchId = randomUUID();
    actorU1 = randomUUID();
    actorU2 = randomUUID();
    await wrapper.withPlatformBypass(async (c) => {
      await c.tenant.create({
        data: {
          id: tenantId,
          name: 'LifeInt',
          slug: `life-${tenantId.slice(0, 8)}`,
          features: {
            'booking.eligibility.enforcement': true,
            'catalog.canonical.write': true,
          },
        },
      });
      await c.branch.create({ data: { id: branchId, tenantId, name: 'Main' } });
      for (const [uid, name] of [
        [providerId, 'PA'],
        [providerB, 'PB'],
        [actorU1, 'U1'],
        [actorU2, 'U2'],
      ] as const) {
        await c.user.create({
          data: {
            id: uid,
            tenantId,
            email: `life-${uid.slice(0, 8)}@t.local`,
            passwordHash: 'x',
            firstName: name,
            lastName: 'T',
            roles: { create: [{ role: 'DOCTOR' }] },
          },
        });
      }
      await c.patient.create({ data: { id: patientId, tenantId, firstName: 'P', lastName: 'A' } });
      await c.canonicalClinicalServiceDefinition.create({
        data: {
          id: clinicalServiceId,
          tenantId: null,
          provenance: 'SYSTEM_CANONICAL',
          stableKey: `canonical.life_${clinicalServiceId.slice(0, 8)}`,
          domain: 'GENERAL',
          lifecycle: 'PUBLISHED',
          publishedAt: new Date(),
          translations: { create: [{ locale: 'en', displayName: 'Svc' }] },
        },
      });
      await c.tenantServiceConfiguration.create({
        data: { id: randomUUID(), tenantId, clinicalServiceId, enabled: true },
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
      await c.queueTicketEvent.deleteMany({ where: { tenantId } }).catch(() => undefined);
      await c.queueTicket.deleteMany({ where: { tenantId } }).catch(() => undefined);
      await c.appointmentServiceSnapshotRevision.deleteMany({ where: { tenantId } });
      await c.appointmentResourceAllocation.deleteMany({ where: { tenantId } });
      await c.appointment.deleteMany({ where: { tenantId } });
      await c.providerServiceEligibility.deleteMany({ where: { tenantId } });
      await c.tenantServiceConfiguration.deleteMany({ where: { tenantId } });
      await c.clinicalServiceTranslation.deleteMany({ where: { clinicalServiceId } });
      await c.canonicalClinicalServiceDefinition.deleteMany({ where: { id: clinicalServiceId } });
      await c.userRoleAssignment.deleteMany({
        where: { userId: { in: [providerId, providerB, actorU1, actorU2] } },
      });
      await c.user.deleteMany({ where: { tenantId } });
      await c.patient.deleteMany({ where: { tenantId } });
      await c.branch.deleteMany({ where: { tenantId } });
      await c.tenant.deleteMany({ where: { id: tenantId } }).catch(() => undefined);
    });
  });

  async function setFeatures(features: Record<string, boolean>) {
    await wrapper.withPlatformBypass(async (c) => {
      await c.tenant.update({ where: { id: tenantId }, data: { features } });
    });
  }

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

  function buildTestPrisma() {
    return {
      withPlatformBypass: wrapper.withPlatformBypass.bind(wrapper),
      $transaction: async (fn: (tx: unknown) => Promise<unknown>) =>
        raw.$transaction(
          async (tx) => {
            await tx.$executeRaw`SELECT set_config('app.platform_rls_bypass', 'true', true)`;
            await tx.$executeRaw`SELECT set_config('app.current_tenant_id', '', true)`;
            return fn(tx);
          },
          { maxWait: 20_000, timeout: 60_000 },
        ),
      patient: {
        findFirst: (args: never) =>
          wrapper.withPlatformBypass((c) => c.patient.findFirst(args)),
      },
      appointment: {
        findFirst: (args: never) =>
          wrapper.withPlatformBypass((c) => c.appointment.findFirst(args)),
        findUnique: (args: never) =>
          wrapper.withPlatformBypass((c) => c.appointment.findUnique(args)),
        findUniqueOrThrow: (args: never) =>
          wrapper.withPlatformBypass((c) => c.appointment.findUniqueOrThrow(args)),
        create: (args: never) =>
          wrapper.withPlatformBypass((c) => c.appointment.create(args)),
        update: (args: never) =>
          wrapper.withPlatformBypass((c) => c.appointment.update(args)),
        updateMany: (args: never) =>
          wrapper.withPlatformBypass((c) => c.appointment.updateMany(args)),
      },
      queueTicket: {
        findFirst: (args: never) =>
          wrapper.withPlatformBypass((c) => c.queueTicket.findFirst(args)),
        findMany: (args: never) =>
          wrapper.withPlatformBypass((c) => c.queueTicket.findMany(args)),
        update: (args: never) =>
          wrapper.withPlatformBypass((c) => c.queueTicket.update(args)),
        create: (args: never) =>
          wrapper.withPlatformBypass((c) => c.queueTicket.create(args)),
        count: (args: never) =>
          wrapper.withPlatformBypass((c) => c.queueTicket.count(args)),
        aggregate: (args: never) =>
          wrapper.withPlatformBypass((c) => c.queueTicket.aggregate(args)),
      },
      tenant: {
        findUnique: (args: never) =>
          wrapper.withPlatformBypass((c) => c.tenant.findUnique(args)),
      },
    };
  }

  function buildBoard() {
    return new QueueBoardService(buildTestPrisma() as never, lifecycle, fakeEvents as never);
  }

  function buildCheckIn() {
    return new CheckInQueueHandler(
      buildBoard(),
      { resolve: async () => ({ tenantId, branchId }) } as never,
      { publish: async () => undefined } as never,
      { notifyCheckIn: async () => undefined } as never,
    );
  }

  function buildUpdateStatus() {
    return new UpdateQueueStatusHandler(
      { resolve: async () => ({ tenantId, branchId }) } as never,
      buildTestPrisma() as never,
      buildBoard(),
      { publish: async () => undefined } as never,
      { notifyCalled: async () => undefined } as never,
      fakeEvents as never,
      lifecycle,
    );
  }

  function buildWalkIn() {
    return new WalkInQueueHandler(
      buildTestPrisma() as never,
      {
        getMetrics: async () => ({ avgWaitMinutes: 0 }),
        getWaitingPosition: async () => 1,
        toBoardItem: (ticket: { id: string; appointmentId?: string }) => ({
          id: ticket.id,
          appointmentId: ticket.appointmentId,
        }),
      } as never,
      { resolve: async () => ({ tenantId, branchId }) } as never,
      { publish: async () => undefined } as never,
      { notifyCheckIn: async () => undefined } as never,
      concurrency,
      snapshots,
      {
        resolveCanonical: async () => ({
          clinicalServiceId,
          stableKey: 'canonical.life',
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
        }),
      } as never,
      eligibility,
      resources,
      fakeAudit as never,
    );
  }

  function buildBeauty() {
    return new BeautySessionSyncService(
      buildTestPrisma() as never,
      buildUpdateHandler(),
      concurrency,
      eligibility,
      resources,
      fakeAudit as never,
    );
  }

  function createAuthoritativeRepo() {
    const run = async <T>(fn: (repo: PrismaAppointmentRepository) => Promise<T>) =>
      wrapper.withPlatformBypass(async (c) => fn(new PrismaAppointmentRepository(c as never)));
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

  function buildUpdateHandler() {
    return new UpdateAppointmentHandler(
      createAuthoritativeRepo() as never,
      { resolve: async () => ({ tenantId, branchId }) } as never,
      { publish: async () => undefined } as never,
      concurrency,
      eligibility,
      resources,
      snapshots,
      { resolveCanonical: async () => null } as never,
      buildTestPrisma() as never,
      fakeAudit as never,
    );
  }

  async function seedPendingAppointment(startIso: string, endIso: string, pid = providerId) {
    const id = randomUUID();
    await wrapper.withPlatformBypass(async (c) => {
      await c.appointment.create({
        data: {
          id,
          tenantId,
          branchId,
          patientId,
          providerId: pid,
          scheduledStart: new Date(startIso),
          scheduledEnd: new Date(endIso),
          status: 'PENDING',
          serviceType: 'consult',
          snapshotWriteMode: 'LEGACY',
          commercialLockedAt: null,
        },
      });
      await c.queueTicket.create({
        data: {
          id: randomUUID(),
          tenantId,
          branchId,
          appointmentId: id,
          patientId,
          providerId: pid,
          scheduledStart: new Date(startIso),
          scheduledEnd: new Date(endIso),
          status: 'WAITING',
          priority: 'NORMAL',
          sortOrder: 1,
        },
      });
    });
    return id;
  }

  it('WB01-QUEUE-LIFECYCLE-LOCK-01 — check-in sets commercialLockedAt atomically', async () => {
    const apptId = await seedPendingAppointment(
      '2030-05-01T10:00:00.000Z',
      '2030-05-01T10:30:00.000Z',
    );
    await buildCheckIn().execute(apptId, actorU1);
    const row = await wrapper.withPlatformBypass((c) =>
      c.appointment.findUniqueOrThrow({ where: { id: apptId } }),
    );
    expect(row.status).toBe('CHECKED_IN');
    expect(row.commercialLockedAt).toBeTruthy();
  });

  it('WB01-QUEUE-LIFECYCLE-LOCK-02 — serving sets commercialLockedAt if null', async () => {
    const apptId = await seedPendingAppointment(
      '2030-05-02T10:00:00.000Z',
      '2030-05-02T10:30:00.000Z',
    );
    const ticket = await wrapper.withPlatformBypass((c) =>
      c.queueTicket.findFirstOrThrow({ where: { appointmentId: apptId } }),
    );
    await buildUpdateStatus().execute(ticket.id, 'serving', actorU1);
    const row = await wrapper.withPlatformBypass((c) =>
      c.appointment.findUniqueOrThrow({ where: { id: apptId } }),
    );
    expect(row.status).toBe('IN_PROGRESS');
    expect(row.commercialLockedAt).toBeTruthy();
  });

  it('WB01-QUEUE-LIFECYCLE-LOCK-03 — existing lock preserved on COMPLETED', async () => {
    const apptId = await seedPendingAppointment(
      '2030-05-03T10:00:00.000Z',
      '2030-05-03T10:30:00.000Z',
    );
    const t1 = new Date('2029-01-01T00:00:00.000Z');
    await wrapper.withPlatformBypass(async (c) => {
      await c.appointment.update({
        where: { id: apptId },
        data: { status: 'CHECKED_IN', commercialLockedAt: t1 },
      });
    });
    const ticket = await wrapper.withPlatformBypass((c) =>
      c.queueTicket.findFirstOrThrow({ where: { appointmentId: apptId } }),
    );
    await buildUpdateStatus().execute(ticket.id, 'completed', actorU1);
    const row = await wrapper.withPlatformBypass((c) =>
      c.appointment.findUniqueOrThrow({ where: { id: apptId } }),
    );
    expect(row.status).toBe('COMPLETED');
    expect(row.commercialLockedAt?.toISOString()).toBe(t1.toISOString());
  });

  it('WB06-QUEUE-LIFECYCLE-ACTOR-01 — check-in actor U1 != provider', async () => {
    const apptId = await seedPendingAppointment(
      '2030-05-04T10:00:00.000Z',
      '2030-05-04T10:30:00.000Z',
    );
    await buildCheckIn().execute(apptId, actorU1);
    expect(fakeEvents.records.some((r) => r.action === 'checked_in' && r.actorUserId === actorU1)).toBe(
      true,
    );
    expect(fakeAudit.calls.some((c) => c.actorId === actorU1)).toBe(true);
    expect(fakeAudit.calls.every((c) => c.actorId !== providerId)).toBe(true);
  });

  it('WB06-QUEUE-LIFECYCLE-ACTOR-02 — status change actor U2', async () => {
    const apptId = await seedPendingAppointment(
      '2030-05-05T10:00:00.000Z',
      '2030-05-05T10:30:00.000Z',
    );
    const ticket = await wrapper.withPlatformBypass((c) =>
      c.queueTicket.findFirstOrThrow({ where: { appointmentId: apptId } }),
    );
    await buildUpdateStatus().execute(ticket.id, 'serving', actorU2);
    expect(
      fakeEvents.records.some((r) => r.action === 'status_changed' && r.actorUserId === actorU2),
    ).toBe(true);
    expect(fakeAudit.calls.some((c) => c.actorId === actorU2)).toBe(true);
  });

  it('WB06-QUEUE-LIFECYCLE-ACTOR-03 — missing actor fail closed', async () => {
    const apptId = await seedPendingAppointment(
      '2030-05-06T10:00:00.000Z',
      '2030-05-06T10:30:00.000Z',
    );
    await expect(buildCheckIn().execute(apptId, '')).rejects.toBeInstanceOf(BadRequestException);
    const row = await wrapper.withPlatformBypass((c) =>
      c.appointment.findUniqueOrThrow({ where: { id: apptId } }),
    );
    expect(row.status).toBe('PENDING');
    expect(row.commercialLockedAt).toBeNull();
  });

  it('WB02-BEAUTY-CREATE-CONCURRENCY-01 — concurrent overlapping creates → exactly one', async () => {
    await setFeatures({
      'catalog.canonical.write': false,
      'booking.eligibility.enforcement': false,
    });
    const beauty = buildBeauty();
    const start = '2030-06-01T10:00:00.000Z';
    const results = await Promise.allSettled([
      beauty.syncSessions(
        tenantId,
        branchId,
        patientId,
        [],
        [{ id: 'b1', status: 'scheduled', scheduledAt: start, clinicianId: providerId, type: 'a' }],
        actorU1,
      ),
      beauty.syncSessions(
        tenantId,
        branchId,
        patientId,
        [],
        [{ id: 'b2', status: 'scheduled', scheduledAt: start, clinicianId: providerId, type: 'b' }],
        actorU2,
      ),
    ]);
    const ok = results.filter((r) => r.status === 'fulfilled').length;
    const fail = results.filter((r) => r.status === 'rejected').length;
    expect(ok).toBe(1);
    expect(fail).toBe(1);
    const count = await wrapper.withPlatformBypass((c) =>
      c.appointment.count({ where: { tenantId, providerId } }),
    );
    expect(count).toBe(1);
  });

  it('WB02-BEAUTY-CREATE-CONCURRENCY-02 — existing conflict denies Beauty create', async () => {
    await setFeatures({
      'catalog.canonical.write': false,
      'booking.eligibility.enforcement': false,
    });
    const start = new Date('2030-06-02T10:00:00.000Z');
    const end = new Date(start.getTime() + 60 * 60 * 1000);
    await concurrency.withBookingTransaction(async (client) => {
      await client.appointment.create({
        data: {
          id: randomUUID(),
          tenantId,
          branchId,
          patientId,
          providerId,
          scheduledStart: start,
          scheduledEnd: end,
          status: 'PENDING',
          serviceType: 'consult',
          snapshotWriteMode: 'LEGACY',
        },
      });
    });
    await expect(
      buildBeauty().syncSessions(
        tenantId,
        branchId,
        patientId,
        [],
        [
          {
            id: 'bx',
            status: 'scheduled',
            scheduledAt: start.toISOString(),
            clinicianId: providerId,
            type: 'facial',
          },
        ],
        actorU1,
      ),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('WB02-BEAUTY-CREATE-CONCURRENCY-03 — different providers same time both succeed', async () => {
    await setFeatures({
      'catalog.canonical.write': false,
      'booking.eligibility.enforcement': false,
    });
    const start = '2030-06-03T10:00:00.000Z';
    const beauty = buildBeauty();
    await beauty.syncSessions(
      tenantId,
      branchId,
      patientId,
      [],
      [{ id: 'p1', status: 'scheduled', scheduledAt: start, clinicianId: providerId, type: 'a' }],
      actorU1,
    );
    await beauty.syncSessions(
      tenantId,
      branchId,
      patientId,
      [],
      [{ id: 'p2', status: 'scheduled', scheduledAt: start, clinicianId: providerB, type: 'b' }],
      actorU2,
    );
    const count = await wrapper.withPlatformBypass((c) =>
      c.appointment.count({ where: { tenantId } }),
    );
    expect(count).toBe(2);
  });

  it('WB02-BEAUTY-CREATE-CONCURRENCY-04 — Beauty + normal create share lock namespace', async () => {
    await setFeatures({
      'catalog.canonical.write': false,
      'booking.eligibility.enforcement': false,
    });
    const start = new Date('2030-06-04T10:00:00.000Z');
    const end = new Date(start.getTime() + 60 * 60 * 1000);
    const beauty = buildBeauty();
    const results = await Promise.allSettled([
      beauty.syncSessions(
        tenantId,
        branchId,
        patientId,
        [],
        [
          {
            id: 'race',
            status: 'scheduled',
            scheduledAt: start.toISOString(),
            clinicianId: providerId,
            type: 'facial',
          },
        ],
        actorU1,
      ),
      concurrency.withBookingTransaction(async (client) => {
        await concurrency.assertSlotAvailableUnderLock(client, {
          tenantId,
          providerId,
          resourceIds: [],
          start,
          end,
        });
        await client.appointment.create({
          data: {
            id: randomUUID(),
            tenantId,
            branchId,
            patientId,
            providerId,
            scheduledStart: start,
            scheduledEnd: end,
            status: 'PENDING',
            serviceType: 'normal',
            snapshotWriteMode: 'LEGACY',
          },
        });
      }),
    ]);
    const ok = results.filter((r) => r.status === 'fulfilled').length;
    expect(ok).toBe(1);
    const count = await wrapper.withPlatformBypass((c) =>
      c.appointment.count({ where: { tenantId, providerId } }),
    );
    expect(count).toBe(1);
  });

  it('WB07-QUEUE-ELIG-FLAG-INDEPENDENCE-01 — elig ON + no clinicalServiceId fail closed', async () => {
    await setFeatures({
      'catalog.canonical.write': false,
      'booking.eligibility.enforcement': true,
    });
    await expect(
      buildWalkIn().execute(
        { patientId, providerId, priority: 'walk_in' },
        actorU1,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    const appts = await wrapper.withPlatformBypass((c) =>
      c.appointment.count({ where: { tenantId } }),
    );
    const tickets = await wrapper.withPlatformBypass((c) =>
      c.queueTicket.count({ where: { tenantId } }),
    );
    expect(appts).toBe(0);
    expect(tickets).toBe(0);
  });

  it('WB07-QUEUE-ELIG-FLAG-INDEPENDENCE-02 — elig ON + valid service → LEGACY success', async () => {
    await setFeatures({
      'catalog.canonical.write': false,
      'booking.eligibility.enforcement': true,
    });
    await createElig();
    await buildWalkIn().execute(
      { patientId, providerId, clinicalServiceId, priority: 'walk_in' },
      actorU1,
    );
    const row = await wrapper.withPlatformBypass((c) =>
      c.appointment.findFirstOrThrow({ where: { tenantId } }),
    );
    expect(row.snapshotWriteMode).toBe('LEGACY');
    expect(row.commercialLockedAt).toBeTruthy();
  });

  it('WB07-QUEUE-ELIG-FLAG-INDEPENDENCE-03 — elig OFF legacy without clinicalServiceId', async () => {
    await setFeatures({
      'catalog.canonical.write': false,
      'booking.eligibility.enforcement': false,
    });
    await buildWalkIn().execute({ patientId, providerId, priority: 'walk_in' }, actorU1);
    const row = await wrapper.withPlatformBypass((c) =>
      c.appointment.findFirstOrThrow({ where: { tenantId } }),
    );
    expect(row.snapshotWriteMode).toBe('LEGACY');
  });

  it('WB07-BEAUTY-ELIG-FLAG-INDEPENDENCE-01 — elig ON + no service identity fail closed', async () => {
    await setFeatures({
      'catalog.canonical.write': false,
      'booking.eligibility.enforcement': true,
    });
    await expect(
      buildBeauty().syncSessions(
        tenantId,
        branchId,
        patientId,
        [],
        [
          {
            id: 'no-svc',
            status: 'scheduled',
            scheduledAt: '2030-07-01T10:00:00.000Z',
            clinicianId: providerId,
            type: 'facial',
          },
        ],
        actorU1,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('WB07-BEAUTY-ELIG-FLAG-INDEPENDENCE-02 — elig ON + ineligible provider deny', async () => {
    await setFeatures({
      'catalog.canonical.write': false,
      'booking.eligibility.enforcement': true,
    });
    await expect(
      buildBeauty().syncSessions(
        tenantId,
        branchId,
        patientId,
        [],
        [
          {
            id: 'inel',
            status: 'scheduled',
            scheduledAt: '2030-07-02T10:00:00.000Z',
            clinicianId: providerId,
            type: 'facial',
            clinicalServiceId,
          },
        ],
        actorU1,
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('WB07-BEAUTY-ELIG-FLAG-INDEPENDENCE-03 — elig ON + valid → LEGACY create', async () => {
    await setFeatures({
      'catalog.canonical.write': false,
      'booking.eligibility.enforcement': true,
    });
    await createElig();
    const synced = await buildBeauty().syncSessions(
      tenantId,
      branchId,
      patientId,
      [],
      [
        {
          id: 'ok',
          status: 'scheduled',
          scheduledAt: '2030-07-03T10:00:00.000Z',
          clinicianId: providerId,
          type: 'facial',
          clinicalServiceId,
        },
      ],
      actorU1,
    );
    const row = await wrapper.withPlatformBypass((c) =>
      c.appointment.findUniqueOrThrow({ where: { id: synced[0]!.appointmentId! } }),
    );
    expect(row.snapshotWriteMode).toBe('LEGACY');
    expect(row.clinicalServiceId).toBe(clinicalServiceId);
  });

  it('WB07-BEAUTY-ELIG-FLAG-INDEPENDENCE-04 — elig OFF Beauty LEGACY allowed', async () => {
    await setFeatures({
      'catalog.canonical.write': false,
      'booking.eligibility.enforcement': false,
    });
    const synced = await buildBeauty().syncSessions(
      tenantId,
      branchId,
      patientId,
      [],
      [
        {
          id: 'legacy',
          status: 'scheduled',
          scheduledAt: '2030-07-04T10:00:00.000Z',
          clinicianId: providerId,
          type: 'facial',
        },
      ],
      actorU1,
    );
    expect(synced[0]!.appointmentId).toBeTruthy();
  });
});
