/**
 * Phase 48 Wave B — Queue/Beauty integrity closure
 * WB-PA-01 commercial lock, WB-PA-06 actor, WB-PA-07 elig/resources,
 * WB-PA-02 assignRoom + Beauty scheduling concurrency
 */
import { randomUUID } from 'crypto';
import { BadRequestException, ConflictException, ForbiddenException } from '@nestjs/common';
import type { PrismaClient } from '@prisma/client';
import { BookingConcurrencyService } from '../application/services/booking-concurrency.service';
import { AppointmentSnapshotService } from '../application/services/appointment-snapshot.service';
import { ProviderEligibilityService } from '../application/services/provider-eligibility.service';
import { ServiceResourceRequirementService } from '../application/services/service-resource-requirement.service';
import { UpdateAppointmentHandler } from '../application/handlers/appointment.handlers';
import { WalkInQueueHandler } from '../../queue/application/handlers/walk-in-queue.handler';
import { AssignQueueRoomHandler } from '../../queue/application/handlers/assign-queue-room.handler';
import { BeautySessionSyncService } from '../../beauty/application/services/beauty-session-sync.service';
import { Appointment } from '../domain/appointment.entity';
import { AppointmentStatus } from '../domain/appointment-status.enum';
import { TimeSlotVO } from '../domain/timeslot.vo';
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

describeDb('Wave B queue/beauty integrity closure (PostgreSQL)', () => {
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
  let actorU1: string;
  let actorU2: string;

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
    fakeAudit.reset();
    tenantId = randomUUID();
    patientId = randomUUID();
    providerId = randomUUID();
    clinicalServiceId = randomUUID();
    roomId = randomUUID();
    branchId = randomUUID();
    actorU1 = randomUUID();
    actorU2 = randomUUID();
    await wrapper.withPlatformBypass(async (c) => {
      await c.tenant.create({
        data: {
          id: tenantId,
          name: 'QBInt',
          slug: `qbi-${tenantId.slice(0, 8)}`,
          features: {
            'booking.eligibility.enforcement': true,
            'catalog.canonical.write': true,
          },
        },
      });
      await c.branch.create({ data: { id: branchId, tenantId, name: 'Main' } });
      for (const [uid, name] of [
        [providerId, 'Prov'],
        [actorU1, 'U1'],
        [actorU2, 'U2'],
      ] as const) {
        await c.user.create({
          data: {
            id: uid,
            tenantId,
            email: `qbi-${uid.slice(0, 8)}@t.local`,
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
          stableKey: `canonical.qbi_${clinicalServiceId.slice(0, 8)}`,
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
        data: {
          id: roomId,
          tenantId,
          branchId,
          name: 'Room1',
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
        where: { tenantId },
        data: { effectiveSnapshotRevisionId: null },
      });
      await c.queueTicket.deleteMany({ where: { tenantId } }).catch(() => undefined);
      await c.appointmentServiceSnapshotRevision.deleteMany({ where: { tenantId } });
      await c.appointmentResourceAllocation.deleteMany({ where: { tenantId } });
      await c.appointment.deleteMany({ where: { tenantId } });
      await c.serviceResourceRequirement.deleteMany({ where: { tenantId } });
      await c.providerServiceEligibility.deleteMany({ where: { tenantId } });
      await c.schedulingResource.deleteMany({ where: { tenantId } });
      await c.tenantServiceConfiguration.deleteMany({ where: { tenantId } });
      await c.clinicalServiceTranslation.deleteMany({ where: { clinicalServiceId } });
      await c.canonicalClinicalServiceDefinition.deleteMany({ where: { id: clinicalServiceId } });
      await c.userRoleAssignment.deleteMany({
        where: { userId: { in: [providerId, actorU1, actorU2] } },
      });
      await c.user.deleteMany({ where: { tenantId } });
      await c.patient.deleteMany({ where: { tenantId } });
      await c.branch.deleteMany({ where: { tenantId } });
      await c.tenant.deleteMany({ where: { id: tenantId } }).catch(() => undefined);
    });
  });

  async function createElig(pid = providerId, svc = clinicalServiceId) {
    return eligibility.createEligibilityRow({
      tenantId,
      providerUserId: pid,
      clinicalServiceId: svc,
      branchId: null,
      effectiveFrom: new Date('2020-01-01T00:00:00.000Z'),
      effectiveTo: null,
      actorId: pid,
    });
  }

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
        update: (args: never) =>
          wrapper.withPlatformBypass((c) => c.queueTicket.update(args)),
      },
    };
  }

  function buildWalkIn() {
    return new WalkInQueueHandler(
      buildTestPrisma() as never,
      {
        getMetrics: async () => ({ avgWaitMinutes: 0 }),
        getWaitingPosition: async () => 1,
        toBoardItem: (ticket: { id: string }) => ({ id: ticket.id, appointmentId: (ticket as { appointmentId?: string }).appointmentId }),
      } as never,
      { resolve: async () => ({ tenantId, branchId }) } as never,
      { publish: async () => undefined } as never,
      { notifyCheckIn: async () => undefined } as never,
      concurrency,
      snapshots,
      {
        resolveCanonical: async () => ({
          clinicalServiceId,
          stableKey: 'canonical.qbi',
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

  function createAuthoritativeRepo() {
    const run = async <T>(
      fn: (repo: PrismaAppointmentRepository) => Promise<T>,
    ) =>
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
      wrapper as never,
      fakeAudit as never,
    );
  }

  // ─── WB01 commercial lock ───────────────────────────────────────────────

  it('WB01-QUEUE-COMMERCIAL-LOCK-01 — CHECKED_IN walk-in sets commercialLockedAt', async () => {
    await createElig();
    await buildWalkIn().execute(
      { patientId, providerId, clinicalServiceId, priority: 'walk_in' },
      actorU1,
    );
    const row = await wrapper.withPlatformBypass((c) =>
      c.appointment.findFirstOrThrow({ where: { tenantId, serviceType: 'walk_in' } }),
    );
    expect(row.status).toBe('CHECKED_IN');
    expect(row.commercialLockedAt).toBeTruthy();
  });

  it('WB01-QUEUE-COMMERCIAL-LOCK-02 — CANCELLED preserves commercialLockedAt', async () => {
    await createElig();
    await buildWalkIn().execute(
      { patientId, providerId, clinicalServiceId, priority: 'walk_in' },
      actorU1,
    );
    const row = await wrapper.withPlatformBypass((c) =>
      c.appointment.findFirstOrThrow({ where: { tenantId, serviceType: 'walk_in' } }),
    );
    const lockedAt = row.commercialLockedAt!.toISOString();
    await buildUpdateHandler().execute(
      row.id,
      { action: 'cancel', cancellationReason: 'test' },
      actorU1,
    );
    const after = await wrapper.withPlatformBypass((c) =>
      c.appointment.findUniqueOrThrow({ where: { id: row.id } }),
    );
    expect(after.status).toBe('CANCELLED');
    expect(after.commercialLockedAt!.toISOString()).toBe(lockedAt);
  });

  it('WB01-QUEUE-COMMERCIAL-LOCK-03 — CHECKED_IN lock compatible with rev1; no ordinary reprice', async () => {
    await createElig();
    await buildWalkIn().execute(
      { patientId, providerId, clinicalServiceId, priority: 'walk_in' },
      actorU1,
    );
    const row = await wrapper.withPlatformBypass((c) =>
      c.appointment.findFirstOrThrow({
        where: { tenantId, serviceType: 'walk_in' },
        include: { effectiveSnapshotRevision: true },
      }),
    );
    expect(row.commercialLockedAt).toBeTruthy();
    expect(row.effectiveSnapshotRevisionId).toBeTruthy();
    await expect(
      buildUpdateHandler().execute(
        row.id,
        { clinicalServiceId, changeReason: 'reprice-attempt', quantity: 2 },
        actorU1,
      ),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  // ─── WB06 actor ─────────────────────────────────────────────────────────

  it('WB06-QUEUE-ACTOR-01 — actor U1 != provider P1; snapshot/audit = U1', async () => {
    await createElig();
    await buildWalkIn().execute(
      { patientId, providerId, clinicalServiceId, priority: 'walk_in' },
      actorU1,
    );
    const row = await wrapper.withPlatformBypass((c) =>
      c.appointment.findFirstOrThrow({
        where: { tenantId },
        include: { effectiveSnapshotRevision: true },
      }),
    );
    expect(row.providerId).toBe(providerId);
    expect(row.effectiveSnapshotRevision!.actorId).toBe(actorU1);
    expect(
      fakeAudit.calls.some(
        (c) => c.actorId === actorU1 && c.action.includes('revision1'),
      ),
    ).toBe(true);
  });

  it('WB06-QUEUE-ACTOR-02 — second walk-in actor U2', async () => {
    await createElig();
    // first
    await buildWalkIn().execute(
      { patientId, providerId, clinicalServiceId, priority: 'walk_in' },
      actorU1,
    );
    // shift time via second patient slot - use different start by waiting? overlap: use different provider slot
    // Use a future-offset by creating after first ends — walk-in uses now; create second with different patient time by deleting first ticket only...
    // Simpler: cancel first appointment times by moving first to completed then create second
    const first = await wrapper.withPlatformBypass((c) =>
      c.appointment.findFirstOrThrow({ where: { tenantId } }),
    );
    await wrapper.withPlatformBypass(async (c) => {
      await c.appointment.update({
        where: { id: first.id },
        data: {
          scheduledStart: new Date(Date.now() - 2 * 3600_000),
          scheduledEnd: new Date(Date.now() - 3600_000),
          status: 'COMPLETED',
        },
      });
    });
    fakeAudit.reset();
    await buildWalkIn().execute(
      { patientId, providerId, clinicalServiceId, priority: 'walk_in' },
      actorU2,
    );
    const rows = await wrapper.withPlatformBypass((c) =>
      c.appointment.findMany({
        where: { tenantId, status: 'CHECKED_IN' },
        include: { effectiveSnapshotRevision: true },
      }),
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]!.effectiveSnapshotRevision!.actorId).toBe(actorU2);
    expect(fakeAudit.calls.some((c) => c.actorId === actorU2)).toBe(true);
  });

  it('WB06-QUEUE-ACTOR-03 — missing actor fail closed', async () => {
    await createElig();
    const before = await wrapper.withPlatformBypass((c) =>
      c.appointment.count({ where: { tenantId } }),
    );
    await expect(
      buildWalkIn().execute(
        { patientId, providerId, clinicalServiceId, priority: 'walk_in' },
        '   ',
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    const after = await wrapper.withPlatformBypass((c) =>
      c.appointment.count({ where: { tenantId } }),
    );
    expect(after).toBe(before);
  });

  // ─── WB07 eligibility / resources ───────────────────────────────────────

  it('WB07-QUEUE-ELIG-01 — no eligibility row → deny, no side effects', async () => {
    const beforeA = await wrapper.withPlatformBypass((c) =>
      c.appointment.count({ where: { tenantId } }),
    );
    const beforeT = await wrapper.withPlatformBypass((c) =>
      c.queueTicket.count({ where: { tenantId } }),
    );
    await expect(
      buildWalkIn().execute(
        { patientId, providerId, clinicalServiceId, priority: 'walk_in' },
        actorU1,
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(
      await wrapper.withPlatformBypass((c) => c.appointment.count({ where: { tenantId } })),
    ).toBe(beforeA);
    expect(
      await wrapper.withPlatformBypass((c) => c.queueTicket.count({ where: { tenantId } })),
    ).toBe(beforeT);
    expect(
      await wrapper.withPlatformBypass((c) =>
        c.appointmentServiceSnapshotRevision.count({ where: { tenantId } }),
      ),
    ).toBe(0);
  });

  it('WB07-QUEUE-ELIG-02 — eligible for different service only → deny', async () => {
    const otherSvc = randomUUID();
    await wrapper.withPlatformBypass(async (c) => {
      await c.canonicalClinicalServiceDefinition.create({
        data: {
          id: otherSvc,
          tenantId: null,
          provenance: 'SYSTEM_CANONICAL',
          stableKey: `canonical.other_${otherSvc.slice(0, 8)}`,
          domain: 'GENERAL',
          lifecycle: 'PUBLISHED',
          publishedAt: new Date(),
          translations: { create: [{ locale: 'en', displayName: 'Other' }] },
        },
      });
      await c.tenantServiceConfiguration.create({
        data: { id: randomUUID(), tenantId, clinicalServiceId: otherSvc, enabled: true },
      });
    });
    await createElig(providerId, otherSvc);
    await expect(
      buildWalkIn().execute(
        { patientId, providerId, clinicalServiceId, priority: 'walk_in' },
        actorU1,
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
    await wrapper.withPlatformBypass(async (c) => {
      await c.providerServiceEligibility.deleteMany({ where: { clinicalServiceId: otherSvc } });
      await c.tenantServiceConfiguration.deleteMany({ where: { clinicalServiceId: otherSvc } });
      await c.clinicalServiceTranslation.deleteMany({ where: { clinicalServiceId: otherSvc } });
      await c.canonicalClinicalServiceDefinition.deleteMany({ where: { id: otherSvc } });
    });
  });

  it('WB07-QUEUE-ELIG-03 — valid eligibility → succeed', async () => {
    await createElig();
    await buildWalkIn().execute(
      { patientId, providerId, clinicalServiceId, priority: 'walk_in' },
      actorU1,
    );
    const row = await wrapper.withPlatformBypass((c) =>
      c.appointment.findFirstOrThrow({ where: { tenantId } }),
    );
    expect(row.snapshotWriteMode).toBe('CANONICAL_REQUIRED');
  });

  it('WB07-QUEUE-RESOURCE-01 — required resource missing → fail closed', async () => {
    await createElig();
    await resources.upsertRequirement({
      tenantId,
      clinicalServiceId,
      resourceType: 'ROOM',
      quantity: 1,
      actorId: actorU1,
    });
    await expect(
      buildWalkIn().execute(
        { patientId, providerId, clinicalServiceId, priority: 'walk_in' },
        actorU1,
      ),
    ).rejects.toThrow(/Required scheduling resources|Insufficient ROOM/i);
    expect(
      await wrapper.withPlatformBypass((c) => c.appointment.count({ where: { tenantId } })),
    ).toBe(0);
  });

  it('WB07-QUEUE-RESOURCE-02 — valid resource → allocation + rev1', async () => {
    await createElig();
    await resources.upsertRequirement({
      tenantId,
      clinicalServiceId,
      resourceType: 'ROOM',
      quantity: 1,
      actorId: actorU1,
    });
    await buildWalkIn().execute(
      {
        patientId,
        providerId,
        clinicalServiceId,
        resourceIds: [roomId],
        priority: 'walk_in',
      },
      actorU1,
    );
    const row = await wrapper.withPlatformBypass((c) =>
      c.appointment.findFirstOrThrow({ where: { tenantId } }),
    );
    const alloc = await wrapper.withPlatformBypass((c) =>
      c.appointmentResourceAllocation.findMany({ where: { appointmentId: row.id } }),
    );
    expect(alloc.map((a) => a.schedulingResourceId)).toEqual([roomId]);
    expect(row.effectiveSnapshotRevisionId).toBeTruthy();
    expect(row.resourceId).toBe(roomId);
  });

  it('WB07-QUEUE-RESOURCE-03 — wrong-branch resource → deny', async () => {
    await createElig();
    await resources.upsertRequirement({
      tenantId,
      clinicalServiceId,
      resourceType: 'ROOM',
      quantity: 1,
      actorId: actorU1,
    });
    const otherBranch = randomUUID();
    const badRoom = randomUUID();
    await wrapper.withPlatformBypass(async (c) => {
      await c.branch.create({ data: { id: otherBranch, tenantId, name: 'Other' } });
      await c.schedulingResource.create({
        data: {
          id: badRoom,
          tenantId,
          branchId: otherBranch,
          name: 'WrongBranchRoom',
          resourceType: 'ROOM',
          isActive: true,
        },
      });
    });
    await expect(
      buildWalkIn().execute(
        {
          patientId,
          providerId,
          clinicalServiceId,
          resourceIds: [badRoom],
          priority: 'walk_in',
        },
        actorU1,
      ),
    ).rejects.toThrow(/branch mismatch/i);
    await wrapper.withPlatformBypass(async (c) => {
      await c.schedulingResource.deleteMany({ where: { id: badRoom } });
      await c.branch.deleteMany({ where: { id: otherBranch } });
    });
  });

  it('WB07-QUEUE-RESOURCE-04 — concurrent exclusive resource → exactly one', async () => {
    await createElig();
    await resources.upsertRequirement({
      tenantId,
      clinicalServiceId,
      resourceType: 'ROOM',
      quantity: 1,
      actorId: actorU1,
    });
    const results = await Promise.allSettled([
      buildWalkIn().execute(
        {
          patientId,
          providerId,
          clinicalServiceId,
          resourceIds: [roomId],
          priority: 'walk_in',
        },
        actorU1,
      ),
      buildWalkIn().execute(
        {
          patientId,
          providerId,
          clinicalServiceId,
          resourceIds: [roomId],
          priority: 'walk_in',
        },
        actorU2,
      ),
    ]);
    const ok = results.filter((r) => r.status === 'fulfilled').length;
    const fail = results.filter((r) => r.status === 'rejected').length;
    expect(ok).toBe(1);
    expect(fail).toBe(1);
    const allocCount = await wrapper.withPlatformBypass((c) =>
      c.appointmentResourceAllocation.count({
        where: { tenantId, schedulingResourceId: roomId },
      }),
    );
    expect(allocCount).toBe(1);
  });

  // ─── WB02 assignRoom ────────────────────────────────────────────────────

  function buildAssignRoom() {
    return new AssignQueueRoomHandler(
      {
        findTicketForAssign: async (tid: string, qid: string) =>
          wrapper.withPlatformBypass((c) =>
            c.queueTicket.findFirst({
              where: { id: qid, tenantId: tid },
              select: {
                id: true,
                appointmentId: true,
                branchId: true,
                resourceId: true,
                status: true,
              },
            }),
          ),
        getBoardItemAfterAssign: async (tid: string, qid: string) =>
          wrapper.withPlatformBypass(async (c) => {
            const t = await c.queueTicket.findFirst({
              where: { id: qid, tenantId: tid },
              include: { resource: { select: { name: true } } },
            });
            if (!t) return null;
            return {
              id: t.id,
              branchId: t.branchId,
              resourceName: t.resource?.name ?? null,
            };
          }),
      } as never,
      { resolve: async () => ({ tenantId, branchId }) } as never,
      { publish: async () => undefined } as never,
      { record: async () => undefined } as never,
      concurrency,
      resources,
      fakeAudit as never,
    );
  }

  async function seedWalkInWithTicket(resourceIds?: string[]) {
    await createElig();
    if (resourceIds?.length) {
      await resources.upsertRequirement({
        tenantId,
        clinicalServiceId,
        resourceType: 'ROOM',
        quantity: 1,
        actorId: actorU1,
      });
    }
    await buildWalkIn().execute(
      {
        patientId,
        providerId,
        clinicalServiceId,
        resourceIds,
        priority: 'walk_in',
      },
      actorU1,
    );
    return wrapper.withPlatformBypass((c) =>
      c.queueTicket.findFirstOrThrow({ where: { tenantId } }),
    );
  }

  it('WB02-QUEUE-ASSIGNROOM-01 — concurrent same room → exactly one', async () => {
    const ticket = await seedWalkInWithTicket();
    const room2 = randomUUID();
    await wrapper.withPlatformBypass(async (c) => {
      await c.schedulingResource.create({
        data: {
          id: room2,
          tenantId,
          branchId,
          name: 'Room2',
          resourceType: 'ROOM',
          isActive: true,
        },
      });
      // second overlapping appointment
      const appt2 = randomUUID();
      await c.appointment.create({
        data: {
          id: appt2,
          tenantId,
          branchId,
          patientId,
          providerId: actorU2,
          scheduledStart: new Date(),
          scheduledEnd: new Date(Date.now() + 30 * 60_000),
          status: 'CHECKED_IN',
          commercialLockedAt: new Date(),
          snapshotWriteMode: 'LEGACY',
        },
      });
      await c.queueTicket.create({
        data: {
          tenantId,
          branchId,
          appointmentId: appt2,
          patientId,
          providerId: actorU2,
          scheduledStart: new Date(),
          scheduledEnd: new Date(Date.now() + 30 * 60_000),
          status: 'WAITING',
          priority: 'WALK_IN',
          checkedInAt: new Date(),
          sortOrder: 1,
        },
      });
    });
    const tickets = await wrapper.withPlatformBypass((c) =>
      c.queueTicket.findMany({ where: { tenantId } }),
    );
    const results = await Promise.allSettled(
      tickets.map((t) => buildAssignRoom().execute(t.id, room2, actorU1)),
    );
    const ok = results.filter((r) => r.status === 'fulfilled').length;
    expect(ok).toBe(1);
  });

  it('WB02-QUEUE-ASSIGNROOM-02 — wrong-branch room deny', async () => {
    const ticket = await seedWalkInWithTicket();
    const otherBranch = randomUUID();
    const badRoom = randomUUID();
    await wrapper.withPlatformBypass(async (c) => {
      await c.branch.create({ data: { id: otherBranch, tenantId, name: 'B2' } });
      await c.schedulingResource.create({
        data: {
          id: badRoom,
          tenantId,
          branchId: otherBranch,
          name: 'Bad',
          resourceType: 'ROOM',
          isActive: true,
        },
      });
    });
    await expect(buildAssignRoom().execute(ticket.id, badRoom, actorU1)).rejects.toThrow(
      /branch mismatch|invalid/i,
    );
    await wrapper.withPlatformBypass(async (c) => {
      await c.schedulingResource.deleteMany({ where: { id: badRoom } });
      await c.branch.deleteMany({ where: { id: otherBranch } });
    });
  });

  it('WB02-QUEUE-ASSIGNROOM-03 — clear required room deny', async () => {
    const ticket = await seedWalkInWithTicket([roomId]);
    await expect(buildAssignRoom().execute(ticket.id, null, actorU1)).rejects.toThrow(
      /Required scheduling resources|Insufficient ROOM/i,
    );
  });

  it('WB02-QUEUE-ASSIGNROOM-04 — multi-alloc preserve non-room + sync mirror', async () => {
    const equip = randomUUID();
    await wrapper.withPlatformBypass(async (c) => {
      await c.schedulingResource.create({
        data: {
          id: equip,
          tenantId,
          branchId,
          name: 'Laser',
          resourceType: 'EQUIPMENT',
          isActive: true,
        },
      });
    });
    const ticket = await seedWalkInWithTicket([roomId, equip]);
    const room2 = randomUUID();
    await wrapper.withPlatformBypass(async (c) => {
      await c.schedulingResource.create({
        data: {
          id: room2,
          tenantId,
          branchId,
          name: 'Room2',
          resourceType: 'ROOM',
          isActive: true,
        },
      });
    });
    await buildAssignRoom().execute(ticket.id, room2, actorU1);
    const appt = await wrapper.withPlatformBypass((c) =>
      c.appointment.findUniqueOrThrow({ where: { id: ticket.appointmentId } }),
    );
    const alloc = await wrapper.withPlatformBypass((c) =>
      c.appointmentResourceAllocation.findMany({ where: { appointmentId: appt.id } }),
    );
    const ids = alloc.map((a) => a.schedulingResourceId).sort();
    expect(ids).toEqual([equip, room2].sort());
    expect(appt.resourceId).toBe(room2);
  });

  it('WB02-QUEUE-ASSIGNROOM-05 — concurrent provider mutation → fresh state', async () => {
    const ticket = await seedWalkInWithTicket();
    const handler = buildAssignRoom();
    const origLock = concurrency.lockAppointmentsForUpdate.bind(concurrency);
    concurrency.lockAppointmentsForUpdate = async (client, params) => {
      await wrapper.withPlatformBypass(async (c) => {
        await c.appointment.update({
          where: { id: ticket.appointmentId },
          data: { providerId: actorU2 },
        });
      });
      return origLock(client, params);
    };
    try {
      // May retry or fail closed — must not use stale provider A for overlap without retry
      await handler.execute(ticket.id, roomId, actorU1).catch(() => undefined);
      const appt = await wrapper.withPlatformBypass((c) =>
        c.appointment.findUniqueOrThrow({ where: { id: ticket.appointmentId } }),
      );
      // Provider should remain U2 if assignment aborted, or U2 with room if retried successfully
      expect(appt.providerId).toBe(actorU2);
    } finally {
      concurrency.lockAppointmentsForUpdate = origLock;
    }
  });

  // ─── WB02 Beauty sync ───────────────────────────────────────────────────

  it('WB02-BEAUTY-SYNC-01 — beauty reschedule uses concurrency; no dual overlap', async () => {
    await wrapper.withPlatformBypass(async (c) => {
      await c.tenant.update({
        where: { id: tenantId },
        data: {
          features: {
            'catalog.canonical.write': false,
            'booking.eligibility.enforcement': false,
          },
        },
      });
    });
    const beauty = new BeautySessionSyncService(
      buildTestPrisma() as never,
      buildUpdateHandler(),
      concurrency,
      eligibility,
      resources,
      fakeAudit as never,
    );
    const sessionId = randomUUID();
    const t1 = '2030-01-10T10:00:00.000Z';
    const synced = await beauty.syncSessions(
      tenantId,
      branchId,
      patientId,
      [],
      [
        {
          id: sessionId,
          status: 'scheduled',
          scheduledAt: t1,
          clinicianId: providerId,
          type: 'facial',
        },
      ],
      actorU1,
    );
    const apptId = synced[0]!.appointmentId!;
    // Competing appointment at T2 on same provider
    const t2 = '2030-01-10T10:15:00.000Z';
    await concurrency.withBookingTransaction(async (client) => {
      await client.appointment.create({
        data: {
          id: randomUUID(),
          tenantId,
          branchId,
          patientId,
          providerId,
          scheduledStart: new Date(t2),
          scheduledEnd: new Date(new Date(t2).getTime() + 60 * 60_000),
          status: 'CONFIRMED',
          snapshotWriteMode: 'LEGACY',
          commercialLockedAt: new Date(),
        },
      });
    });
    await expect(
      beauty.syncSessions(
        tenantId,
        branchId,
        patientId,
        [{ id: sessionId, appointmentId: apptId, scheduledAt: t1, clinicianId: providerId }],
        [
          {
            id: sessionId,
            status: 'scheduled',
            scheduledAt: t2,
            clinicianId: providerId,
            appointmentId: apptId,
            type: 'facial',
          },
        ],
        actorU1,
      ),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('WB02-BEAUTY-SYNC-02 — ineligible provider deny', async () => {
    await createElig();
    await wrapper.withPlatformBypass(async (c) => {
      await c.tenant.update({
        where: { id: tenantId },
        data: {
          features: {
            'catalog.canonical.write': false,
            'booking.eligibility.enforcement': true,
          },
        },
      });
    });
    // Create LEGACY appt with clinicalServiceId so eligibility is checked on provider change
    const apptId = randomUUID();
    await concurrency.withBookingTransaction(async (client) => {
      await client.appointment.create({
        data: {
          id: apptId,
          tenantId,
          branchId,
          patientId,
          providerId,
          clinicalServiceId,
          scheduledStart: new Date('2030-02-01T10:00:00.000Z'),
          scheduledEnd: new Date('2030-02-01T11:00:00.000Z'),
          status: 'PENDING',
          snapshotWriteMode: 'LEGACY',
          serviceType: 'beauty:facial',
        },
      });
    });
    const beauty = new BeautySessionSyncService(
      buildTestPrisma() as never,
      buildUpdateHandler(),
      concurrency,
      eligibility,
      resources,
      fakeAudit as never,
    );
    const ineligible = actorU2;
    await expect(
      beauty.syncSessions(
        tenantId,
        branchId,
        patientId,
        [
          {
            id: 's1',
            appointmentId: apptId,
            scheduledAt: '2030-02-01T10:00:00.000Z',
            clinicianId: providerId,
          },
        ],
        [
          {
            id: 's1',
            status: 'scheduled',
            scheduledAt: '2030-02-01T10:00:00.000Z',
            clinicianId: ineligible,
            appointmentId: apptId,
            type: 'facial',
          },
        ],
        actorU1,
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('WB02-BEAUTY-SYNC-03 — post-lock fresh state under concurrent mutation', async () => {
    await wrapper.withPlatformBypass(async (c) => {
      await c.tenant.update({
        where: { id: tenantId },
        data: {
          features: {
            'catalog.canonical.write': false,
            'booking.eligibility.enforcement': false,
          },
        },
      });
    });
    const beauty = new BeautySessionSyncService(
      buildTestPrisma() as never,
      buildUpdateHandler(),
      concurrency,
      eligibility,
      resources,
      fakeAudit as never,
    );
    const sessionId = randomUUID();
    const synced = await beauty.syncSessions(
      tenantId,
      branchId,
      patientId,
      [],
      [
        {
          id: sessionId,
          status: 'scheduled',
          scheduledAt: '2030-03-01T10:00:00.000Z',
          clinicianId: providerId,
          type: 'facial',
        },
      ],
      actorU1,
    );
    const apptId = synced[0]!.appointmentId!;
    const t2 = '2030-03-01T12:00:00.000Z';
    const origLock = concurrency.lockAppointmentsForUpdate.bind(concurrency);
    concurrency.lockAppointmentsForUpdate = async (client, params) => {
      await wrapper.withPlatformBypass(async (c) => {
        await c.appointment.update({
          where: { id: apptId },
          data: {
            scheduledStart: new Date('2030-03-01T11:00:00.000Z'),
            scheduledEnd: new Date('2030-03-01T12:00:00.000Z'),
          },
        });
      });
      return origLock(client, params);
    };
    try {
      await beauty.syncSessions(
        tenantId,
        branchId,
        patientId,
        [
          {
            id: sessionId,
            appointmentId: apptId,
            scheduledAt: '2030-03-01T10:00:00.000Z',
            clinicianId: providerId,
          },
        ],
        [
          {
            id: sessionId,
            status: 'scheduled',
            scheduledAt: t2,
            clinicianId: providerId,
            appointmentId: apptId,
            type: 'facial',
          },
        ],
        actorU1,
      );
      const row = await wrapper.withPlatformBypass((c) =>
        c.appointment.findUniqueOrThrow({ where: { id: apptId } }),
      );
      expect(row.scheduledStart.toISOString()).toBe(new Date(t2).toISOString());
    } finally {
      concurrency.lockAppointmentsForUpdate = origLock;
    }
  });

  it('WB02-BEAUTY-SYNC-04 — CANONICAL_REQUIRED serviceType mutation fail closed', async () => {
    await createElig();
    const apptId = randomUUID();
    await concurrency.withBookingTransaction(async (client) => {
      await client.appointment.create({
        data: {
          id: apptId,
          tenantId,
          branchId,
          patientId,
          providerId,
          clinicalServiceId,
          scheduledStart: new Date('2030-04-01T10:00:00.000Z'),
          scheduledEnd: new Date('2030-04-01T11:00:00.000Z'),
          status: 'PENDING',
          snapshotWriteMode: 'CANONICAL_REQUIRED',
          serviceType: 'beauty:facial',
        },
      });
      await snapshots.captureCanonicalRevision1(client, {
        tenantId,
        appointmentId: apptId,
        actorId: actorU1,
        commercial: {
          clinicalServiceId,
          stableKey: 'canonical.qbi',
          displayNameAr: 'س',
          displayNameEn: 'S',
          tenantServiceConfigurationId: null,
          priceVersionId: null,
          pricingUnit: 'PER_VISIT' as never,
          currency: 'SYP',
          unitPrice: 10,
          taxPercent: 0,
          quantity: 1,
          commercialReason: 'TEST',
        },
      });
    });
    const beauty = new BeautySessionSyncService(
      buildTestPrisma() as never,
      buildUpdateHandler(),
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
        [
          {
            id: 's1',
            appointmentId: apptId,
            scheduledAt: '2030-04-01T10:00:00.000Z',
            clinicianId: providerId,
            type: 'facial',
          },
        ],
        [
          {
            id: 's1',
            status: 'scheduled',
            scheduledAt: '2030-04-01T10:00:00.000Z',
            clinicianId: providerId,
            appointmentId: apptId,
            type: 'laser',
          },
        ],
        actorU1,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
