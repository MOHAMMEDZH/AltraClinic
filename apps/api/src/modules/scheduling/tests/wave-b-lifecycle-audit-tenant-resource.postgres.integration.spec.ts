/**
 * Phase 48 Wave B — lifecycle row-lock, QueueTicketEvent TX,
 * Beauty tenant isolation, Beauty resource requirements.
 */
import { randomUUID } from 'crypto';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import type { PrismaClient } from '@prisma/client';
import { BookingConcurrencyService } from '../application/services/booking-concurrency.service';
import { AppointmentSnapshotService } from '../application/services/appointment-snapshot.service';
import { AppointmentLifecycleMutationService } from '../application/services/appointment-lifecycle-mutation.service';
import { ProviderEligibilityService } from '../application/services/provider-eligibility.service';
import { ServiceResourceRequirementService } from '../application/services/service-resource-requirement.service';
import { UpdateAppointmentHandler } from '../application/handlers/appointment.handlers';
import { CheckInQueueHandler, CallNextQueueHandler } from '../../queue/application/handlers/queue-board.handlers';
import { UpdateQueueStatusHandler } from '../../queue/application/handlers/update-queue-status.handler';
import { QueueBoardService } from '../../queue/application/services/queue-board.service';
import { QueueEventService } from '../../queue/application/services/queue-event.service';
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
  failNext: false,
  async record(entry: { actorId: string; action: string }) {
    this.calls.push({ actorId: entry.actorId, action: entry.action });
  },
  async recordInTransaction(_c: unknown, entry: { actorId: string; action: string }) {
    if (this.failNext) {
      this.failNext = false;
      throw new Error('forced audit failure');
    }
    this.calls.push({ actorId: entry.actorId, action: entry.action });
  },
  reset() {
    this.calls = [];
    this.failNext = false;
  },
};

describeDb('Wave B lifecycle rowlock / queue event TX / beauty tenant+resource (PostgreSQL)', () => {
  let raw: PrismaClient;
  let wrapper: ReturnType<typeof createClinicalPrismaWrapper>;
  let concurrency: BookingConcurrencyService;
  let snapshots: AppointmentSnapshotService;
  let lifecycle: AppointmentLifecycleMutationService;
  let eligibility: ProviderEligibilityService;
  let resources: ServiceResourceRequirementService;
  let tenantId: string;
  let tenantB: string;
  let patientId: string;
  let providerId: string;
  let foreignProviderId: string;
  let clinicalServiceId: string;
  let foreignCustomServiceId: string;
  let tenantCustomServiceId: string;
  let branchId: string;
  let roomId: string;
  let foreignRoomId: string;
  let actorU1: string;

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
    tenantId = randomUUID();
    tenantB = randomUUID();
    patientId = randomUUID();
    providerId = randomUUID();
    foreignProviderId = randomUUID();
    clinicalServiceId = randomUUID();
    foreignCustomServiceId = randomUUID();
    tenantCustomServiceId = randomUUID();
    branchId = randomUUID();
    roomId = randomUUID();
    foreignRoomId = randomUUID();
    actorU1 = randomUUID();
    await wrapper.withPlatformBypass(async (c) => {
      await c.tenant.create({
        data: {
          id: tenantId,
          name: 'Lat',
          slug: `lat-${tenantId.slice(0, 8)}`,
          features: {
            'booking.eligibility.enforcement': false,
            'catalog.canonical.write': false,
          },
        },
      });
      await c.tenant.create({
        data: {
          id: tenantB,
          name: 'LatB',
          slug: `latb-${tenantB.slice(0, 8)}`,
          features: {},
        },
      });
      await c.branch.create({ data: { id: branchId, tenantId, name: 'Main' } });
      for (const [uid, name] of [
        [providerId, 'PA'],
        [actorU1, 'U1'],
      ] as const) {
        await c.user.create({
          data: {
            id: uid,
            tenantId,
            email: `lat-${uid.slice(0, 8)}@t.local`,
            passwordHash: 'x',
            firstName: name,
            lastName: 'T',
            roles: { create: [{ role: 'DOCTOR' }] },
          },
        });
      }
      await c.user.create({
        data: {
          id: foreignProviderId,
          tenantId: tenantB,
          email: `lat-fp-${foreignProviderId.slice(0, 8)}@t.local`,
          passwordHash: 'x',
          firstName: 'FP',
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
          stableKey: `canonical.lat_${clinicalServiceId.slice(0, 8)}`,
          domain: 'GENERAL',
          lifecycle: 'PUBLISHED',
          publishedAt: new Date(),
          translations: { create: [{ locale: 'en', displayName: 'Svc' }] },
        },
      });
      await c.canonicalClinicalServiceDefinition.create({
        data: {
          id: tenantCustomServiceId,
          tenantId,
          provenance: 'TENANT_CUSTOM',
          stableKey: `tenant.custom_lat_${tenantCustomServiceId.slice(0, 8)}`,
          domain: 'GENERAL',
          lifecycle: 'PUBLISHED',
          publishedAt: new Date(),
          translations: { create: [{ locale: 'en', displayName: 'Custom' }] },
        },
      });
      await c.canonicalClinicalServiceDefinition.create({
        data: {
          id: foreignCustomServiceId,
          tenantId: tenantB,
          provenance: 'TENANT_CUSTOM',
          stableKey: `tenant.custom_latb_${foreignCustomServiceId.slice(0, 8)}`,
          domain: 'GENERAL',
          lifecycle: 'PUBLISHED',
          publishedAt: new Date(),
          translations: { create: [{ locale: 'en', displayName: 'Foreign' }] },
        },
      });
      await c.tenantServiceConfiguration.create({
        data: { id: randomUUID(), tenantId, clinicalServiceId, enabled: true },
      });
      await c.schedulingResource.create({
        data: {
          id: roomId,
          tenantId,
          branchId,
          name: 'Room1',
          resourceType: 'ROOM',
          isActive: true,
        },
      });
      await c.schedulingResource.create({
        data: {
          id: foreignRoomId,
          tenantId: tenantB,
          branchId: null,
          name: 'ForeignRoom',
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
        where: { tenantId: { in: [tenantId, tenantB] } },
        data: { effectiveSnapshotRevisionId: null },
      });
      await c.queueTicketEvent.deleteMany({ where: { tenantId: { in: [tenantId, tenantB] } } }).catch(() => undefined);
      await c.queueTicket.deleteMany({ where: { tenantId: { in: [tenantId, tenantB] } } }).catch(() => undefined);
      await c.appointmentResourceAllocation.deleteMany({
        where: { tenantId: { in: [tenantId, tenantB] } },
      });
      await c.appointment.deleteMany({ where: { tenantId: { in: [tenantId, tenantB] } } });
      await c.serviceResourceRequirement.deleteMany({
        where: { tenantId: { in: [tenantId, tenantB] } },
      });
      await c.providerServiceEligibility.deleteMany({
        where: { tenantId: { in: [tenantId, tenantB] } },
      });
      await c.tenantServiceConfiguration.deleteMany({
        where: { tenantId: { in: [tenantId, tenantB] } },
      });
      await c.schedulingResource.deleteMany({ where: { tenantId: { in: [tenantId, tenantB] } } });
      await c.clinicalServiceTranslation.deleteMany({
        where: {
          clinicalServiceId: {
            in: [clinicalServiceId, tenantCustomServiceId, foreignCustomServiceId],
          },
        },
      });
      await c.canonicalClinicalServiceDefinition.deleteMany({
        where: { id: { in: [clinicalServiceId, tenantCustomServiceId, foreignCustomServiceId] } },
      });
      await c.userRoleAssignment.deleteMany({
        where: { userId: { in: [providerId, foreignProviderId, actorU1] } },
      });
      await c.user.deleteMany({ where: { tenantId: { in: [tenantId, tenantB] } } });
      await c.patient.deleteMany({ where: { tenantId: { in: [tenantId, tenantB] } } });
      await c.branch.deleteMany({ where: { tenantId: { in: [tenantId, tenantB] } } });
      await c.tenant.deleteMany({ where: { id: { in: [tenantId, tenantB] } } }).catch(() => undefined);
    });
  });

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
      queueTicket: {
        findFirst: (args: never) =>
          wrapper.withPlatformBypass((c) => c.queueTicket.findFirst(args)),
        findMany: (args: never) =>
          wrapper.withPlatformBypass((c) => c.queueTicket.findMany(args)),
        update: (args: never) =>
          wrapper.withPlatformBypass((c) => c.queueTicket.update(args)),
        count: (args: never) =>
          wrapper.withPlatformBypass((c) => c.queueTicket.count(args)),
        aggregate: (args: never) =>
          wrapper.withPlatformBypass((c) => c.queueTicket.aggregate(args)),
      },
      queueTicketEvent: {
        create: (args: never) =>
          wrapper.withPlatformBypass((c) => c.queueTicketEvent.create(args)),
      },
      appointment: {
        findFirst: (args: never) =>
          wrapper.withPlatformBypass((c) => c.appointment.findFirst(args)),
      },
      tenant: {
        findUnique: (args: never) =>
          wrapper.withPlatformBypass((c) => c.tenant.findUnique(args)),
      },
    };
  }

  function buildEvents(fail = false) {
    const base = new QueueEventService(buildTestPrisma() as never);
    if (!fail) return base;
    return {
      record: async () => {
        throw new Error('forced queue event failure');
      },
    } as unknown as QueueEventService;
  }

  function buildBoard(events = buildEvents()) {
    return new QueueBoardService(buildTestPrisma() as never, lifecycle, events);
  }

  function buildCheckIn(events = buildEvents()) {
    return new CheckInQueueHandler(
      buildBoard(events),
      { resolve: async () => ({ tenantId, branchId }) } as never,
      { publish: async () => undefined } as never,
      { notifyCheckIn: async () => undefined } as never,
    );
  }

  function buildCallNext(events = buildEvents()) {
    return new CallNextQueueHandler(
      buildBoard(events),
      { resolve: async () => ({ tenantId, branchId }) } as never,
      { publish: async () => undefined } as never,
      { notifyCalled: async () => undefined } as never,
    );
  }

  function buildUpdateStatus(events = buildEvents()) {
    return new UpdateQueueStatusHandler(
      { resolve: async () => ({ tenantId, branchId }) } as never,
      buildTestPrisma() as never,
      buildBoard(events),
      { publish: async () => undefined } as never,
      { notifyCalled: async () => undefined } as never,
      events,
      lifecycle,
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

  function buildBeauty() {
    return new BeautySessionSyncService(
      buildTestPrisma() as never,
      new UpdateAppointmentHandler(
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
      ),
      concurrency,
      eligibility,
      resources,
      fakeAudit as never,
    );
  }

  async function seedPendingWithTicket(startIso: string, endIso: string) {
    const apptId = randomUUID();
    const ticketId = randomUUID();
    await wrapper.withPlatformBypass(async (c) => {
      await c.appointment.create({
        data: {
          id: apptId,
          tenantId,
          branchId,
          patientId,
          providerId,
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
          id: ticketId,
          tenantId,
          branchId,
          appointmentId: apptId,
          patientId,
          providerId,
          scheduledStart: new Date(startIso),
          scheduledEnd: new Date(endIso),
          status: 'WAITING',
          priority: 'NORMAL',
          sortOrder: 1,
        },
      });
    });
    return { apptId, ticketId };
  }

  it('WB01-LIFECYCLE-ROWLOCK-01 — concurrent CHECKED_IN + IN_PROGRESS stamps lock once', async () => {
    const { apptId } = await seedPendingWithTicket(
      '2031-01-01T10:00:00.000Z',
      '2031-01-01T10:30:00.000Z',
    );
    const nowA = new Date('2031-01-01T10:00:01.000Z');
    const nowB = new Date('2031-01-01T10:00:02.000Z');
    const results = await Promise.allSettled([
      concurrency.withBookingTransaction((client) =>
        lifecycle.applyStatus(client, {
          tenantId,
          appointmentId: apptId,
          nextStatus: 'CHECKED_IN',
          now: nowA,
          actorId: actorU1,
        }),
      ),
      concurrency.withBookingTransaction((client) =>
        lifecycle.applyStatus(client, {
          tenantId,
          appointmentId: apptId,
          nextStatus: 'IN_PROGRESS',
          now: nowB,
          actorId: actorU1,
        }),
      ),
    ]);
    expect(results.every((r) => r.status === 'fulfilled')).toBe(true);
    const row = await wrapper.withPlatformBypass((c) =>
      c.appointment.findUniqueOrThrow({ where: { id: apptId } }),
    );
    expect(row.commercialLockedAt).toBeTruthy();
    const lockMs = row.commercialLockedAt!.getTime();
    expect([nowA.getTime(), nowB.getTime()]).toContain(lockMs);
    expect(row.status === 'CHECKED_IN' || row.status === 'IN_PROGRESS').toBe(true);
  });

  it('WB01-LIFECYCLE-ROWLOCK-02 — post-lock terminal denies stale non-terminal transition', async () => {
    const { apptId } = await seedPendingWithTicket(
      '2031-01-02T10:00:00.000Z',
      '2031-01-02T10:30:00.000Z',
    );
    await concurrency.withBookingTransaction((client) =>
      lifecycle.applyStatus(client, {
        tenantId,
        appointmentId: apptId,
        nextStatus: 'COMPLETED',
        now: new Date(),
        actorId: actorU1,
        statusNotIn: ['CANCELLED', 'NO_SHOW'],
      }),
    );
    const denied = await concurrency.withBookingTransaction((client) =>
      lifecycle.applyStatus(client, {
        tenantId,
        appointmentId: apptId,
        nextStatus: 'IN_PROGRESS',
        now: new Date(),
        actorId: actorU1,
        statusNotIn: ['CANCELLED', 'COMPLETED', 'NO_SHOW'],
      }),
    );
    expect(denied.applied).toBe(false);
    const row = await wrapper.withPlatformBypass((c) =>
      c.appointment.findUniqueOrThrow({ where: { id: apptId } }),
    );
    expect(row.status).toBe('COMPLETED');
  });

  it('WB01-LIFECYCLE-ROWLOCK-03 — existing commercialLockedAt T1 preserved under concurrency', async () => {
    const { apptId } = await seedPendingWithTicket(
      '2031-01-03T10:00:00.000Z',
      '2031-01-03T10:30:00.000Z',
    );
    const t1 = new Date('2031-01-03T09:00:00.000Z');
    await wrapper.withPlatformBypass(async (c) => {
      await c.appointment.update({
        where: { id: apptId },
        data: { status: 'CHECKED_IN', commercialLockedAt: t1 },
      });
    });
    await Promise.all([
      concurrency.withBookingTransaction((client) =>
        lifecycle.applyStatus(client, {
          tenantId,
          appointmentId: apptId,
          nextStatus: 'IN_PROGRESS',
          now: new Date('2031-01-03T10:01:00.000Z'),
          actorId: actorU1,
        }),
      ),
      concurrency.withBookingTransaction((client) =>
        lifecycle.applyStatus(client, {
          tenantId,
          appointmentId: apptId,
          nextStatus: 'COMPLETED',
          now: new Date('2031-01-03T10:02:00.000Z'),
          actorId: actorU1,
          statusNotIn: ['CANCELLED', 'NO_SHOW'],
        }),
      ),
    ]);
    const row = await wrapper.withPlatformBypass((c) =>
      c.appointment.findUniqueOrThrow({ where: { id: apptId } }),
    );
    expect(row.commercialLockedAt!.getTime()).toBe(t1.getTime());
  });

  it('WB01-QUEUE-APPLIED-FALSE-01 — terminal appointment rejects status; ticket+event roll back', async () => {
    const { apptId, ticketId } = await seedPendingWithTicket(
      '2031-01-04T10:00:00.000Z',
      '2031-01-04T10:30:00.000Z',
    );
    await wrapper.withPlatformBypass(async (c) => {
      await c.appointment.update({
        where: { id: apptId },
        data: { status: 'COMPLETED', commercialLockedAt: new Date() },
      });
    });
    await expect(buildUpdateStatus().execute(ticketId, 'serving', actorU1)).rejects.toBeInstanceOf(
      ConflictException,
    );
    const ticket = await wrapper.withPlatformBypass((c) =>
      c.queueTicket.findUniqueOrThrow({ where: { id: ticketId } }),
    );
    expect(ticket.status).toBe('WAITING');
    const events = await wrapper.withPlatformBypass((c) =>
      c.queueTicketEvent.count({ where: { queueTicketId: ticketId } }),
    );
    expect(events).toBe(0);
  });

  it('WB01-QUEUE-APPLIED-FALSE-02 — missing appointment check-in fails closed', async () => {
    await expect(buildCheckIn().execute(randomUUID(), actorU1)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('WB06-QUEUE-EVENT-TX-01 — check-in commits ticket+lifecycle+event together', async () => {
    const { apptId, ticketId } = await seedPendingWithTicket(
      '2031-02-01T10:00:00.000Z',
      '2031-02-01T10:30:00.000Z',
    );
    await buildCheckIn().execute(apptId, actorU1);
    const appt = await wrapper.withPlatformBypass((c) =>
      c.appointment.findUniqueOrThrow({ where: { id: apptId } }),
    );
    const ticket = await wrapper.withPlatformBypass((c) =>
      c.queueTicket.findUniqueOrThrow({ where: { id: ticketId } }),
    );
    const events = await wrapper.withPlatformBypass((c) =>
      c.queueTicketEvent.findMany({ where: { queueTicketId: ticketId } }),
    );
    expect(appt.status).toBe('CHECKED_IN');
    expect(appt.commercialLockedAt).toBeTruthy();
    expect(ticket.checkedInAt).toBeTruthy();
    expect(events).toHaveLength(1);
    expect(events[0]!.action).toBe('checked_in');
    expect(fakeAudit.calls.some((c) => c.action === 'scheduling.lifecycle.status')).toBe(true);
  });

  it('WB06-QUEUE-EVENT-TX-02 — event insert failure rolls back check-in', async () => {
    const { apptId, ticketId } = await seedPendingWithTicket(
      '2031-02-02T10:00:00.000Z',
      '2031-02-02T10:30:00.000Z',
    );
    await expect(buildCheckIn(buildEvents(true)).execute(apptId, actorU1)).rejects.toThrow(
      /forced queue event failure/,
    );
    const appt = await wrapper.withPlatformBypass((c) =>
      c.appointment.findUniqueOrThrow({ where: { id: apptId } }),
    );
    const ticket = await wrapper.withPlatformBypass((c) =>
      c.queueTicket.findUniqueOrThrow({ where: { id: ticketId } }),
    );
    const events = await wrapper.withPlatformBypass((c) =>
      c.queueTicketEvent.count({ where: { queueTicketId: ticketId } }),
    );
    expect(appt.status).toBe('PENDING');
    expect(appt.commercialLockedAt).toBeNull();
    expect(ticket.status).toBe('WAITING');
    expect(events).toBe(0);
  });

  it('WB06-QUEUE-EVENT-TX-03 — call-next event failure leaves WAITING', async () => {
    const { ticketId } = await seedPendingWithTicket(
      '2031-02-03T10:00:00.000Z',
      '2031-02-03T10:30:00.000Z',
    );
    await expect(buildCallNext(buildEvents(true)).execute(null, branchId, actorU1)).rejects.toThrow(
      /forced queue event failure/,
    );
    const ticket = await wrapper.withPlatformBypass((c) =>
      c.queueTicket.findUniqueOrThrow({ where: { id: ticketId } }),
    );
    expect(ticket.status).toBe('WAITING');
  });

  it('WB06-QUEUE-EVENT-TX-04 — QueueTicketEvent.actorUserId = authenticated U1', async () => {
    const { apptId, ticketId } = await seedPendingWithTicket(
      '2031-02-04T10:00:00.000Z',
      '2031-02-04T10:30:00.000Z',
    );
    await buildCheckIn().execute(apptId, actorU1);
    const ev = await wrapper.withPlatformBypass((c) =>
      c.queueTicketEvent.findFirstOrThrow({ where: { queueTicketId: ticketId } }),
    );
    expect(ev.actorUserId).toBe(actorU1);
    expect(ev.actorUserId).not.toBe(providerId);
  });

  it('WB05-BEAUTY-PROVIDER-TENANT-01 — foreign provider denied when eligibility OFF', async () => {
    await expect(
      buildBeauty().syncSessions(
        tenantId,
        branchId,
        patientId,
        [],
        [
          {
            id: randomUUID(),
            status: 'scheduled',
            scheduledAt: '2031-03-01T10:00:00.000Z',
            clinicianId: foreignProviderId,
            type: 'facial',
          },
        ],
        actorU1,
      ),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(
      await wrapper.withPlatformBypass((c) => c.appointment.count({ where: { tenantId } })),
    ).toBe(0);
  });

  it('WB05-BEAUTY-PROVIDER-TENANT-02 — unknown provider fail closed', async () => {
    await expect(
      buildBeauty().syncSessions(
        tenantId,
        branchId,
        patientId,
        [],
        [
          {
            id: randomUUID(),
            status: 'scheduled',
            scheduledAt: '2031-03-02T10:00:00.000Z',
            clinicianId: randomUUID(),
            type: 'facial',
          },
        ],
        actorU1,
      ),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('WB05-BEAUTY-SERVICE-TENANT-01 — foreign TENANT_CUSTOM clinicalService denied', async () => {
    await expect(
      buildBeauty().syncSessions(
        tenantId,
        branchId,
        patientId,
        [],
        [
          {
            id: randomUUID(),
            status: 'scheduled',
            scheduledAt: '2031-03-03T10:00:00.000Z',
            clinicianId: providerId,
            clinicalServiceId: foreignCustomServiceId,
            type: 'facial',
          },
        ],
        actorU1,
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('WB05-BEAUTY-SERVICE-TENANT-02 — same-tenant TENANT_CUSTOM allowed', async () => {
    const synced = await buildBeauty().syncSessions(
      tenantId,
      branchId,
      patientId,
      [],
      [
        {
          id: randomUUID(),
          status: 'scheduled',
          scheduledAt: '2031-03-04T10:00:00.000Z',
          clinicianId: providerId,
          clinicalServiceId: tenantCustomServiceId,
          type: 'facial',
        },
      ],
      actorU1,
    );
    const row = await wrapper.withPlatformBypass((c) =>
      c.appointment.findUniqueOrThrow({ where: { id: synced[0]!.appointmentId! } }),
    );
    expect(row.snapshotWriteMode).toBe('LEGACY');
    expect(row.clinicalServiceId).toBe(tenantCustomServiceId);
  });

  it('WB05-BEAUTY-SERVICE-TENANT-03 — GLOBAL SYSTEM_CANONICAL allowed', async () => {
    const synced = await buildBeauty().syncSessions(
      tenantId,
      branchId,
      patientId,
      [],
      [
        {
          id: randomUUID(),
          status: 'scheduled',
          scheduledAt: '2031-03-05T10:00:00.000Z',
          clinicianId: providerId,
          clinicalServiceId,
          type: 'facial',
        },
      ],
      actorU1,
    );
    expect(synced[0]!.appointmentId).toBeTruthy();
  });

  it('WB07-BEAUTY-RESOURCE-01 — required ROOM missing → fail closed', async () => {
    await resources.upsertRequirement({
      tenantId,
      clinicalServiceId,
      resourceType: 'ROOM',
      quantity: 1,
      actorId: actorU1,
    });
    await expect(
      buildBeauty().syncSessions(
        tenantId,
        branchId,
        patientId,
        [],
        [
          {
            id: randomUUID(),
            status: 'scheduled',
            scheduledAt: '2031-04-01T10:00:00.000Z',
            clinicianId: providerId,
            clinicalServiceId,
            type: 'facial',
          },
        ],
        actorU1,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(
      await wrapper.withPlatformBypass((c) => c.appointment.count({ where: { tenantId } })),
    ).toBe(0);
    expect(
      await wrapper.withPlatformBypass((c) =>
        c.appointmentResourceAllocation.count({ where: { tenantId } }),
      ),
    ).toBe(0);
  });

  it('WB07-BEAUTY-RESOURCE-02 — valid ROOM → allocation persisted', async () => {
    await resources.upsertRequirement({
      tenantId,
      clinicalServiceId,
      resourceType: 'ROOM',
      quantity: 1,
      actorId: actorU1,
    });
    const synced = await buildBeauty().syncSessions(
      tenantId,
      branchId,
      patientId,
      [],
      [
        {
          id: randomUUID(),
          status: 'scheduled',
          scheduledAt: '2031-04-02T10:00:00.000Z',
          clinicianId: providerId,
          clinicalServiceId,
          resourceId: roomId,
          type: 'facial',
        },
      ],
      actorU1,
    );
    const apptId = synced[0]!.appointmentId!;
    const alloc = await wrapper.withPlatformBypass((c) =>
      c.appointmentResourceAllocation.findMany({ where: { appointmentId: apptId } }),
    );
    const row = await wrapper.withPlatformBypass((c) =>
      c.appointment.findUniqueOrThrow({ where: { id: apptId } }),
    );
    expect(alloc).toHaveLength(1);
    expect(alloc[0]!.schedulingResourceId).toBe(roomId);
    expect(row.resourceId).toBe(roomId);
  });

  it('WB07-BEAUTY-RESOURCE-03 — foreign tenant resource denied', async () => {
    await resources.upsertRequirement({
      tenantId,
      clinicalServiceId,
      resourceType: 'ROOM',
      quantity: 1,
      actorId: actorU1,
    });
    await expect(
      buildBeauty().syncSessions(
        tenantId,
        branchId,
        patientId,
        [],
        [
          {
            id: randomUUID(),
            status: 'scheduled',
            scheduledAt: '2031-04-03T10:00:00.000Z',
            clinicianId: providerId,
            clinicalServiceId,
            resourceId: foreignRoomId,
            type: 'facial',
          },
        ],
        actorU1,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('WB07-BEAUTY-RESOURCE-04 — concurrent exclusive ROOM → exactly one', async () => {
    await resources.upsertRequirement({
      tenantId,
      clinicalServiceId,
      resourceType: 'ROOM',
      quantity: 1,
      actorId: actorU1,
    });
    const start = '2031-04-04T10:00:00.000Z';
    const results = await Promise.allSettled([
      buildBeauty().syncSessions(
        tenantId,
        branchId,
        patientId,
        [],
        [
          {
            id: randomUUID(),
            status: 'scheduled',
            scheduledAt: start,
            clinicianId: providerId,
            clinicalServiceId,
            resourceId: roomId,
            type: 'facial',
          },
        ],
        actorU1,
      ),
      buildBeauty().syncSessions(
        tenantId,
        branchId,
        patientId,
        [],
        [
          {
            id: randomUUID(),
            status: 'scheduled',
            scheduledAt: start,
            clinicianId: providerId,
            clinicalServiceId,
            resourceId: roomId,
            type: 'facial',
          },
        ],
        actorU1,
      ),
    ]);
    const ok = results.filter((r) => r.status === 'fulfilled');
    const fail = results.filter((r) => r.status === 'rejected');
    expect(ok).toHaveLength(1);
    expect(fail).toHaveLength(1);
    expect(
      await wrapper.withPlatformBypass((c) => c.appointment.count({ where: { tenantId } })),
    ).toBe(1);
  });

  it('WB07-BEAUTY-RESOURCE-05 — no requirements → empty resources allowed', async () => {
    const synced = await buildBeauty().syncSessions(
      tenantId,
      branchId,
      patientId,
      [],
      [
        {
          id: randomUUID(),
          status: 'scheduled',
          scheduledAt: '2031-04-05T10:00:00.000Z',
          clinicianId: providerId,
          clinicalServiceId,
          type: 'facial',
        },
      ],
      actorU1,
    );
    expect(synced[0]!.appointmentId).toBeTruthy();
  });
});
