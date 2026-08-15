/**
 * Phase 48 Wave B — AssignQueueRoomHandler QueueTicketEvent TX + actor provenance.
 */
import { randomUUID } from 'crypto';
import { BadRequestException } from '@nestjs/common';
import type { PrismaClient } from '@prisma/client';
import { BookingConcurrencyService } from '../application/services/booking-concurrency.service';
import { ProviderEligibilityService } from '../application/services/provider-eligibility.service';
import { ServiceResourceRequirementService } from '../application/services/service-resource-requirement.service';
import { AssignQueueRoomHandler } from '../../queue/application/handlers/assign-queue-room.handler';
import { QueueEventService } from '../../queue/application/services/queue-event.service';
import {
  createClinicalPrismaWrapper,
  createPlatformDbSecurityClient,
  platformDbSecurityEnabled,
} from '../../clinical-catalog/tests/clinical-catalog-db.harness';

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

describeDb('Wave B AssignQueueRoom QueueTicketEvent TX / actor (PostgreSQL)', () => {
  let raw: PrismaClient;
  let wrapper: ReturnType<typeof createClinicalPrismaWrapper>;
  let concurrency: BookingConcurrencyService;
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
          name: 'AsmEvt',
          slug: `asm-${tenantId.slice(0, 8)}`,
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
            email: `asm-${uid.slice(0, 8)}@t.local`,
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
          stableKey: `canonical.asm_${clinicalServiceId.slice(0, 8)}`,
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
          name: 'AssignRoom1',
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
      await c.queueTicketEvent.deleteMany({ where: { tenantId } }).catch(() => undefined);
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
      },
      queueTicket: {
        findFirst: (args: never) =>
          wrapper.withPlatformBypass((c) => c.queueTicket.findFirst(args)),
      },
      queueTicketEvent: {
        create: (args: never) =>
          wrapper.withPlatformBypass((c) => c.queueTicketEvent.create(args)),
      },
      tenant: {
        findUnique: (args: never) =>
          wrapper.withPlatformBypass((c) => c.tenant.findUnique(args)),
      },
    };
  }

  function buildEvents(fail = false): QueueEventService {
    if (!fail) return new QueueEventService(buildTestPrisma() as never);
    return {
      record: async () => {
        throw new Error('forced queue event failure');
      },
    } as unknown as QueueEventService;
  }

  function buildAssignRoom(events = buildEvents()) {
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
      events,
      concurrency,
      resources,
      fakeAudit as never,
    );
  }

  async function seedTicketWithoutRoom() {
    await eligibility.createEligibilityRow({
      tenantId,
      providerUserId: providerId,
      clinicalServiceId,
      branchId: null,
      effectiveFrom: new Date('2020-01-01T00:00:00.000Z'),
      effectiveTo: null,
      actorId: actorU1,
    });
    const apptId = randomUUID();
    const ticketId = randomUUID();
    const now = new Date();
    await wrapper.withPlatformBypass(async (c) => {
      await c.appointment.create({
        data: {
          id: apptId,
          tenantId,
          branchId,
          patientId,
          providerId,
          scheduledStart: now,
          scheduledEnd: new Date(now.getTime() + 30 * 60_000),
          status: 'CHECKED_IN',
          commercialLockedAt: now,
          clinicalServiceId,
          snapshotWriteMode: 'LEGACY',
          resourceId: null,
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
          scheduledStart: now,
          scheduledEnd: new Date(now.getTime() + 30 * 60_000),
          status: 'WAITING',
          priority: 'WALK_IN',
          checkedInAt: now,
          sortOrder: 1,
          resourceId: null,
        },
      });
    });
    await resources.upsertRequirement({
      tenantId,
      clinicalServiceId,
      resourceType: 'ROOM',
      quantity: 1,
      actorId: actorU1,
    });
    return { apptId, ticketId };
  }

  it('WB06-ASSIGNROOM-EVENT-TX-01 — assignRoom commits allocation+ticket+audit+event together', async () => {
    const { apptId, ticketId } = await seedTicketWithoutRoom();
    await buildAssignRoom().execute(ticketId, roomId, actorU1);

    const appt = await wrapper.withPlatformBypass((c) =>
      c.appointment.findUniqueOrThrow({ where: { id: apptId } }),
    );
    const ticket = await wrapper.withPlatformBypass((c) =>
      c.queueTicket.findUniqueOrThrow({ where: { id: ticketId } }),
    );
    const alloc = await wrapper.withPlatformBypass((c) =>
      c.appointmentResourceAllocation.findMany({ where: { appointmentId: apptId } }),
    );
    const events = await wrapper.withPlatformBypass((c) =>
      c.queueTicketEvent.findMany({ where: { queueTicketId: ticketId } }),
    );

    expect(appt.resourceId).toBe(roomId);
    expect(ticket.resourceId).toBe(roomId);
    expect(alloc).toHaveLength(1);
    expect(alloc[0]!.schedulingResourceId).toBe(roomId);
    expect(events).toHaveLength(1);
    expect(events[0]!.action).toBe('room_assigned');
    expect(fakeAudit.calls.some((c) => c.action === 'queue.room_assigned')).toBe(true);
  });

  it('WB06-ASSIGNROOM-EVENT-TX-02 — event failure rolls back entire assignment', async () => {
    const { apptId, ticketId } = await seedTicketWithoutRoom();
    await expect(
      buildAssignRoom(buildEvents(true)).execute(ticketId, roomId, actorU1),
    ).rejects.toThrow(/forced queue event failure/);

    const appt = await wrapper.withPlatformBypass((c) =>
      c.appointment.findUniqueOrThrow({ where: { id: apptId } }),
    );
    const ticket = await wrapper.withPlatformBypass((c) =>
      c.queueTicket.findUniqueOrThrow({ where: { id: ticketId } }),
    );
    const alloc = await wrapper.withPlatformBypass((c) =>
      c.appointmentResourceAllocation.count({ where: { appointmentId: apptId } }),
    );
    const events = await wrapper.withPlatformBypass((c) =>
      c.queueTicketEvent.count({ where: { queueTicketId: ticketId } }),
    );

    expect(appt.resourceId).toBeNull();
    expect(ticket.resourceId).toBeNull();
    expect(alloc).toBe(0);
    expect(events).toBe(0);
  });

  it('WB06-ASSIGNROOM-ACTOR-01 — event + audit actor = U1', async () => {
    const { ticketId } = await seedTicketWithoutRoom();
    await buildAssignRoom().execute(ticketId, roomId, actorU1);
    const ev = await wrapper.withPlatformBypass((c) =>
      c.queueTicketEvent.findFirstOrThrow({ where: { queueTicketId: ticketId } }),
    );
    expect(ev.actorUserId).toBe(actorU1);
    expect(fakeAudit.calls.find((c) => c.action === 'queue.room_assigned')?.actorId).toBe(actorU1);
  });

  it('WB06-ASSIGNROOM-ACTOR-02 — U1 != provider; no actor substitution', async () => {
    const { ticketId } = await seedTicketWithoutRoom();
    expect(actorU1).not.toBe(providerId);
    await buildAssignRoom().execute(ticketId, roomId, actorU1);
    const ev = await wrapper.withPlatformBypass((c) =>
      c.queueTicketEvent.findFirstOrThrow({ where: { queueTicketId: ticketId } }),
    );
    expect(ev.actorUserId).toBe(actorU1);
    expect(ev.actorUserId).not.toBe(providerId);
  });

  it('WB06-ASSIGNROOM-ACTOR-03 — missing actor fail closed', async () => {
    const { apptId, ticketId } = await seedTicketWithoutRoom();
    await expect(buildAssignRoom().execute(ticketId, roomId, '')).rejects.toBeInstanceOf(
      BadRequestException,
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
    expect(appt.resourceId).toBeNull();
    expect(ticket.resourceId).toBeNull();
    expect(events).toBe(0);
  });
});
