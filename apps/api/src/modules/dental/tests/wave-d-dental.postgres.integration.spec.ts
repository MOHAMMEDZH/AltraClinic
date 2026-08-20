/**
 * Wave D — Plan Link / Lab / ServicePerformance production-path PostgreSQL tests.
 */
import { randomUUID } from 'crypto';
import { BadRequestException } from '@nestjs/common';
import { AppointmentStatus, type PrismaClient } from '@prisma/client';
import {
  createClinicalPrismaWrapper,
  createPlatformDbSecurityClient,
  platformDbSecurityEnabled,
} from '../../clinical-catalog/tests/clinical-catalog-db.harness';
import { TreatmentPlanAppointmentLinkService } from '../services/treatment-plan-appointment-link.service';
import { DentalLabCaseService } from '../services/dental-lab-case.service';
import { ServicePerformanceService } from '../../service-performance/services/service-performance.service';

jest.setTimeout(180_000);
const describeDb = platformDbSecurityEnabled() ? describe : describe.skip;

describeDb('Wave D dental integration (PostgreSQL)', () => {
  let raw: PrismaClient;
  let wrapper: ReturnType<typeof createClinicalPrismaWrapper>;
  let tenantId: string;
  let otherTenantId: string;
  let actorId: string;
  let providerId: string;
  let patientId: string;
  let planId: string;
  let itemId: string;
  let depItemId: string;
  let branchId: string;
  let branchBInTenantId: string;
  let encounterBranchBId: string;
  let otherBranchId: string;
  let encounterId: string;
  let otherEncounterId: string;
  let otherPatientId: string;
  let appointmentId: string;
  let otherAppointmentId: string;
  let clinicalServiceId: string;
  let otherClinicalServiceId: string;
  let snapshotRevisionId: string;
  let mismatchedSnapshotRevisionId: string;
  let failAuditAction: string | null = null;
  const auditCalls: Array<Record<string, unknown>> = [];

  const tenantContext = {
    resolve: async () => ({ tenantId, branchId: null, locale: 'en' }),
  };
  const audit = {
    record: async (e: Record<string, unknown>) => {
      auditCalls.push({ ...e, via: 'record' });
    },
    recordInTransaction: async (_tx: unknown, e: Record<string, unknown>) => {
      if (failAuditAction && e.action === failAuditAction) {
        throw new Error(`forced audit failure: ${String(failAuditAction)}`);
      }
      auditCalls.push({ ...e, via: 'recordInTransaction' });
    },
  };

  function links() {
    return new TreatmentPlanAppointmentLinkService(
      wrapper as never,
      tenantContext as never,
      audit as never,
    );
  }
  function lab() {
    return new DentalLabCaseService(wrapper as never, tenantContext as never, audit as never);
  }
  function perf() {
    return new ServicePerformanceService(wrapper as never, tenantContext as never, audit as never);
  }

  beforeAll(async () => {
    raw = await createPlatformDbSecurityClient();
    wrapper = createClinicalPrismaWrapper(raw);
  });

  afterAll(async () => {
    await raw.$disconnect();
  });

  beforeEach(async () => {
    auditCalls.length = 0;
    tenantId = randomUUID();
    otherTenantId = randomUUID();
    actorId = randomUUID();
    providerId = randomUUID();
    patientId = randomUUID();
    planId = randomUUID();
    itemId = randomUUID();
    depItemId = randomUUID();
    branchId = randomUUID();
    branchBInTenantId = randomUUID();
    encounterBranchBId = randomUUID();
    otherBranchId = randomUUID();
    encounterId = randomUUID();
    otherEncounterId = randomUUID();
    otherPatientId = randomUUID();
    appointmentId = randomUUID();
    otherAppointmentId = randomUUID();
    clinicalServiceId = randomUUID();
    otherClinicalServiceId = randomUUID();
    snapshotRevisionId = randomUUID();
    mismatchedSnapshotRevisionId = randomUUID();
    failAuditAction = null;
    const phaseId = randomUUID();
    await wrapper.withPlatformBypass(async (c) => {
      await c.tenant.create({
        data: { id: tenantId, name: 'WD', slug: `wd-${tenantId.slice(0, 8)}` },
      });
      await c.tenant.create({
        data: { id: otherTenantId, name: 'WD O', slug: `wdo-${otherTenantId.slice(0, 8)}` },
      });
      await c.user.create({
        data: {
          id: actorId,
          tenantId,
          email: `wd-${actorId.slice(0, 8)}@t.local`,
          passwordHash: 'x',
          firstName: 'A',
          lastName: 'Ctor',
        },
      });
      await c.user.create({
        data: {
          id: providerId,
          tenantId,
          email: `wd-${providerId.slice(0, 8)}@t.local`,
          passwordHash: 'x',
          firstName: 'P',
          lastName: 'Rovider',
        },
      });
      await c.patient.create({
        data: { id: patientId, tenantId, firstName: 'Pat', lastName: 'Dent' },
      });
      await c.patient.create({
        data: { id: otherPatientId, tenantId, firstName: 'Alt', lastName: 'Pat' },
      });
      const foreignPatientId = randomUUID();
      await c.patient.create({
        data: { id: foreignPatientId, tenantId: otherTenantId, firstName: 'Foreign', lastName: 'Pat' },
      });
      await c.branch.create({
        data: {
          id: branchId,
          tenantId,
          name: `Wave D Branch ${branchId.slice(0, 6)}`,
        },
      });
      await c.branch.create({
        data: {
          id: branchBInTenantId,
          tenantId,
          name: `Wave D Branch B ${branchBInTenantId.slice(0, 6)}`,
        },
      });
      await c.branch.create({
        data: {
          id: otherBranchId,
          tenantId: otherTenantId,
          name: `Wave D Other ${otherBranchId.slice(0, 6)}`,
        },
      });
      await c.canonicalClinicalServiceDefinition.create({
        data: {
          id: clinicalServiceId,
          tenantId,
          provenance: 'TENANT_CUSTOM',
          stableKey: `tenant.${tenantId}.custom.wd-${clinicalServiceId.slice(0, 8)}`,
          domain: 'DENTAL',
          lifecycle: 'PUBLISHED',
        },
      });
      await c.canonicalClinicalServiceDefinition.create({
        data: {
          id: otherClinicalServiceId,
          tenantId,
          provenance: 'TENANT_CUSTOM',
          stableKey: `tenant.${tenantId}.custom.wd-${otherClinicalServiceId.slice(0, 8)}`,
          domain: 'DENTAL',
          lifecycle: 'PUBLISHED',
        },
      });
      await c.treatmentPlan.create({
        data: {
          id: planId,
          tenantId,
          patientId,
          title: 'Wave D plan',
          createdBy: actorId,
        },
      });
      await c.treatmentPhase.create({
        data: { id: phaseId, planId, tenantId, name: 'Phase 1', sortOrder: 0 },
      });
      await c.treatmentPlanItem.create({
        data: {
          id: depItemId,
          phaseId,
          tenantId,
          code: 'D1110',
          description: 'Prerequisite',
          sortOrder: 0,
          status: 'COMPLETED',
          completedAt: new Date(),
          completedBy: actorId,
          clinicalServiceId,
        },
      });
      await c.treatmentPlanItem.create({
        data: {
          id: itemId,
          phaseId,
          tenantId,
          code: 'D2740',
          description: 'Crown',
          sortOrder: 1,
          dependsOnItemId: depItemId,
          clinicalServiceId,
        },
      });
      await c.appointment.create({
        data: {
          id: appointmentId,
          tenantId,
          branchId,
          patientId,
          providerId,
          scheduledStart: new Date('2026-09-01T10:00:00.000Z'),
          scheduledEnd: new Date('2026-09-01T11:00:00.000Z'),
          status: 'CONFIRMED',
          clinicalServiceId,
        },
      });
      await c.appointment.create({
        data: {
          id: otherAppointmentId,
          tenantId,
          branchId,
          patientId,
          providerId,
          scheduledStart: new Date('2026-09-08T10:00:00.000Z'),
          scheduledEnd: new Date('2026-09-08T11:00:00.000Z'),
          status: 'PENDING',
          clinicalServiceId,
        },
      });
      await c.encounter.create({
        data: {
          id: encounterId,
          tenantId,
          branchId,
          patientId,
          appointmentId,
          clinicianId: providerId,
          status: 'IN_PROGRESS',
        },
      });
      await c.encounter.create({
        data: {
          id: encounterBranchBId,
          tenantId,
          branchId: branchBInTenantId,
          patientId,
          clinicianId: providerId,
          status: 'IN_PROGRESS',
        },
      });
      await c.encounter.create({
        data: {
          id: otherEncounterId,
          tenantId: otherTenantId,
          patientId: foreignPatientId,
          clinicianId: randomUUID(),
          status: 'IN_PROGRESS',
        },
      });
      await c.appointmentServiceSnapshotRevision.create({
        data: {
          id: snapshotRevisionId,
          tenantId,
          appointmentId,
          revisionNumber: 1,
          clinicalServiceId,
          stableKey: `snap.${snapshotRevisionId.slice(0, 8)}`,
          displayNameAr: 'Snap',
          displayNameEn: 'Snap',
          pricingUnit: 'PER_VISIT',
          quantity: 1,
          currency: 'SYP',
          unitPrice: 10,
          lineBasisAmount: 10,
          actorId,
        },
      });
      await c.appointmentServiceSnapshotRevision.create({
        data: {
          id: mismatchedSnapshotRevisionId,
          tenantId,
          appointmentId,
          revisionNumber: 2,
          clinicalServiceId: otherClinicalServiceId,
          stableKey: `snap.${mismatchedSnapshotRevisionId.slice(0, 8)}`,
          displayNameAr: 'Snap mismatch',
          displayNameEn: 'Snap mismatch',
          pricingUnit: 'PER_VISIT',
          quantity: 1,
          currency: 'SYP',
          unitPrice: 10,
          lineBasisAmount: 10,
          actorId,
        },
      });
    });
  });

  it('P0-05 M:N links two appointments to one item', async () => {
    const svc = links();
    await svc.link({
      planId,
      planItemId: itemId,
      appointmentId,
      actorId,
      actorRoles: ['dentist'],
    });
    await svc.link({
      planId,
      planItemId: itemId,
      appointmentId: otherAppointmentId,
      linkRole: 'SUPPORTING',
      actorId,
      actorRoles: ['dentist'],
    });
    const rows = await svc.listForItem(planId, itemId);
    expect(rows).toHaveLength(2);
    expect(auditCalls.some((c) => c.action === 'dental.plan_item_appointment.link')).toBe(true);
  });

  it('P0-05 reschedule of same appointment keeps links', async () => {
    const svc = links();
    await svc.link({
      planId,
      planItemId: itemId,
      appointmentId,
      actorId,
      actorRoles: ['dentist'],
    });
    await wrapper.withPlatformBypass(async (c) => {
      await c.appointment.update({
        where: { id: appointmentId },
        data: { scheduledStart: new Date('2026-09-01T12:00:00.000Z') },
      });
    });
    const rows = await svc.listForItem(planId, itemId);
    expect(rows).toHaveLength(1);
    expect(rows[0].appointmentId).toBe(appointmentId);
  });

  it('P0-05 cancel appointment does not cancel plan item', async () => {
    const svc = links();
    await svc.link({
      planId,
      planItemId: itemId,
      appointmentId,
      actorId,
      actorRoles: ['dentist'],
    });
    await wrapper.withPlatformBypass(async (c) => {
      await c.appointment.update({
        where: { id: appointmentId },
        data: { status: 'CANCELLED' },
      });
    });
    const item = await wrapper.withPlatformBypass((c) =>
      c.treatmentPlanItem.findFirst({ where: { id: itemId } }),
    );
    expect(item?.status).toBe('PLANNED');
  });

  it('P0-05 complete-from-appointment requires a link', async () => {
    const svc = links();
    const before = await wrapper.withPlatformBypass((c) =>
      c.treatmentPlanItem.findFirst({
        where: { id: itemId },
        select: { status: true, completedBy: true, completedAt: true },
      }),
    );
    await expect(
      svc.completeFromAppointment({
        planId,
        planItemId: itemId,
        appointmentId,
        actorId,
        actorRoles: ['dentist'],
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    const after = await wrapper.withPlatformBypass((c) =>
      c.treatmentPlanItem.findFirst({
        where: { id: itemId },
        select: { status: true, completedBy: true, completedAt: true },
      }),
    );
    expect(after).toEqual(before);
    expect(
      auditCalls.some((c) => c.action === 'dental.plan_item.complete_from_appointment'),
    ).toBe(false);
  });

  it('P0-05 explicit complete-from-appointment updates item', async () => {
    const svc = links();
    await svc.link({
      planId,
      planItemId: itemId,
      appointmentId,
      actorId,
      actorRoles: ['dentist'],
    });
    await wrapper.withPlatformBypass((c) =>
      c.appointment.update({ where: { id: appointmentId }, data: { status: 'COMPLETED' } }),
    );
    const updated = await svc.completeFromAppointment({
      planId,
      planItemId: itemId,
      appointmentId,
      actorId,
      actorRoles: ['dentist'],
    });
    expect(updated.status).toBe('COMPLETED');
    expect(
      auditCalls.some((c) => c.action === 'dental.plan_item.complete_from_appointment'),
    ).toBe(true);
  });

  it('P0-05 complete-from-appointment rejects non-completed appointment states', async () => {
    const svc = links();
    await svc.link({ planId, planItemId: itemId, appointmentId, actorId, actorRoles: ['dentist'] });
    for (const status of [
      AppointmentStatus.CONFIRMED,
      AppointmentStatus.CANCELLED,
      AppointmentStatus.PENDING,
    ]) {
      await wrapper.withPlatformBypass((c) =>
        c.appointment.update({ where: { id: appointmentId }, data: { status } }),
      );
      const before = await wrapper.withPlatformBypass((c) =>
        c.treatmentPlanItem.findFirst({
          where: { id: itemId },
          select: { status: true, completedBy: true, completedAt: true },
        }),
      );
      await expect(
        svc.completeFromAppointment({
          planId,
          planItemId: itemId,
          appointmentId,
          actorId,
          actorRoles: ['dentist'],
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
      const after = await wrapper.withPlatformBypass((c) =>
        c.treatmentPlanItem.findFirst({
          where: { id: itemId },
          select: { status: true, completedBy: true, completedAt: true },
        }),
      );
      expect(after).toEqual(before);
    }
    expect(
      auditCalls.some((c) => c.action === 'dental.plan_item.complete_from_appointment'),
    ).toBe(false);
  });

  it('P0-05 cross-tenant appointment fails closed', async () => {
    const foreignAppt = randomUUID();
    await wrapper.withPlatformBypass(async (c) => {
      const p = randomUUID();
      await c.patient.create({
        data: { id: p, tenantId: otherTenantId, firstName: 'X', lastName: 'Y' },
      });
      await c.appointment.create({
        data: {
          id: foreignAppt,
          tenantId: otherTenantId,
          patientId: p,
          providerId: randomUUID(),
          scheduledStart: new Date('2026-09-01T10:00:00.000Z'),
          scheduledEnd: new Date('2026-09-01T11:00:00.000Z'),
        },
      });
    });
    await expect(
      links().link({
        planId,
        planItemId: itemId,
        appointmentId: foreignAppt,
        actorId,
        actorRoles: ['dentist'],
      }),
    ).rejects.toThrow();
  });

  it('P1-07 lab status SENT sets sentAt; illegal transition does not', async () => {
    const created = await lab().create({
      patientId,
      providerId,
      labVendor: 'Acme Lab',
      caseType: 'CROWN',
      actorId,
      actorRoles: ['dentist'],
    });
    const sent = await lab().transition({
      id: created.id,
      status: 'SENT',
      actorId,
      actorRoles: ['dentist'],
    });
    expect(sent.status).toBe('SENT');
    expect(sent.sentAt).toBeTruthy();
    await expect(
      lab().transition({ id: created.id, status: 'SEATED', actorId, actorRoles: ['dentist'] }),
    ).rejects.toBeInstanceOf(BadRequestException);
    const still = await lab().get(created.id);
    expect(still.status).toBe('SENT');
  });

  it('AR-21 complete requires explicit PRIMARY participant (not appointment.providerId)', async () => {
    const created = await perf().create({
      clinicalServiceId,
      performedAt: new Date().toISOString(),
      appointmentId,
      participants: [{ userId: actorId, role: 'PRIMARY', attributionShare: 100 }],
      actorId,
      actorRoles: ['dentist'],
    });
    expect(created.status).toBe('DRAFT');
    const completed = await perf().complete({
      id: created.id,
      actorId,
      actorRoles: ['dentist'],
    });
    expect(completed.status).toBe('COMPLETED');
    expect(completed.participants[0].userId).toBe(actorId);
    expect(completed.participants[0].userId).not.toBe(providerId);
  });

  it('AR-21 create rejects appointment/patient mismatch', async () => {
    await expect(
      perf().create({
        clinicalServiceId,
        performedAt: new Date().toISOString(),
        appointmentId,
        patientId: otherPatientId,
        participants: [{ userId: actorId, role: 'PRIMARY', attributionShare: 100 }],
        actorId,
        actorRoles: ['dentist'],
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('AR-21 create rejects cross-tenant branch and encounter', async () => {
    await expect(
      perf().create({
        clinicalServiceId,
        performedAt: new Date().toISOString(),
        branchId: otherBranchId,
        participants: [{ userId: actorId, role: 'PRIMARY', attributionShare: 100 }],
        actorId,
        actorRoles: ['dentist'],
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      perf().create({
        clinicalServiceId,
        performedAt: new Date().toISOString(),
        encounterId: otherEncounterId,
        participants: [{ userId: actorId, role: 'PRIMARY', attributionShare: 100 }],
        actorId,
        actorRoles: ['dentist'],
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('AR-21 create rejects encounter mismatch with appointment/patient and snapshot/service mismatch', async () => {
    const mismatchEncounter = randomUUID();
    await wrapper.withPlatformBypass((c) =>
      c.encounter.create({
        data: {
          id: mismatchEncounter,
          tenantId,
          branchId,
          patientId: otherPatientId,
          appointmentId,
          clinicianId: providerId,
          status: 'IN_PROGRESS',
        },
      }),
    );
    await expect(
      perf().create({
        clinicalServiceId,
        performedAt: new Date().toISOString(),
        appointmentId,
        encounterId: mismatchEncounter,
        participants: [{ userId: actorId, role: 'PRIMARY', attributionShare: 100 }],
        actorId,
        actorRoles: ['dentist'],
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      perf().create({
        clinicalServiceId,
        performedAt: new Date().toISOString(),
        appointmentId,
        snapshotRevisionId: mismatchedSnapshotRevisionId,
        participants: [{ userId: actorId, role: 'PRIMARY', attributionShare: 100 }],
        actorId,
        actorRoles: ['dentist'],
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('AR-21 create rejects same-tenant branch/encounter mismatch without appointment', async () => {
    await expect(
      perf().create({
        clinicalServiceId,
        performedAt: new Date().toISOString(),
        branchId,
        encounterId: encounterBranchBId,
        participants: [{ userId: actorId, role: 'PRIMARY', attributionShare: 100 }],
        actorId,
        actorRoles: ['dentist'],
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    const rows = await wrapper.withPlatformBypass((c) =>
      c.servicePerformance.count({ where: { tenantId } }),
    );
    expect(rows).toBe(0);
    expect(auditCalls.some((c) => c.action === 'service_performance.create')).toBe(false);
  });

  it('AR-21 create derives branchId from encounter when branch omitted', async () => {
    const created = await perf().create({
      clinicalServiceId,
      performedAt: new Date().toISOString(),
      encounterId,
      patientId,
      participants: [{ userId: actorId, role: 'PRIMARY', attributionShare: 100 }],
      actorId,
      actorRoles: ['dentist'],
    });
    expect(created.branchId).toBe(branchId);
  });

  it('AR-21 create rejects snapshot patient/branch contextual mismatch', async () => {
    await expect(
      perf().create({
        clinicalServiceId,
        performedAt: new Date().toISOString(),
        snapshotRevisionId,
        patientId: otherPatientId,
        participants: [{ userId: actorId, role: 'PRIMARY', attributionShare: 100 }],
        actorId,
        actorRoles: ['dentist'],
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      perf().create({
        clinicalServiceId,
        performedAt: new Date().toISOString(),
        snapshotRevisionId,
        branchId: branchBInTenantId,
        participants: [{ userId: actorId, role: 'PRIMARY', attributionShare: 100 }],
        actorId,
        actorRoles: ['dentist'],
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('AR-21 create accepts fully consistent references', async () => {
    const created = await perf().create({
      clinicalServiceId,
      performedAt: new Date().toISOString(),
      appointmentId,
      encounterId,
      patientId,
      branchId,
      snapshotRevisionId,
      participants: [{ userId: actorId, role: 'PRIMARY', attributionShare: 100 }],
      actorId,
      actorRoles: ['dentist'],
    });
    expect(created.appointmentId).toBe(appointmentId);
    expect(created.encounterId).toBe(encounterId);
    expect(created.patientId).toBe(patientId);
    expect(created.branchId).toBe(branchId);
    expect(created.snapshotRevisionId).toBe(snapshotRevisionId);
  });

  it('AR-21 share sum > 100 is rejected', async () => {
    await expect(
      perf().create({
        clinicalServiceId,
        performedAt: new Date().toISOString(),
        participants: [
          { userId: actorId, role: 'PRIMARY', attributionShare: 80 },
          { userId: providerId, role: 'ASSISTING', attributionShare: 30 },
        ],
        actorId,
        actorRoles: ['dentist'],
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('AR-21 completed row is immutable without correction hatch', async () => {
    const created = await perf().create({
      clinicalServiceId,
      performedAt: new Date().toISOString(),
      participants: [{ userId: actorId, role: 'PRIMARY', attributionShare: 100 }],
      actorId,
      actorRoles: ['dentist'],
    });
    await perf().complete({ id: created.id, actorId, actorRoles: ['dentist'] });
    await expect(
      wrapper.withPlatformBypass((c) =>
        c.servicePerformance.update({
          where: { id: created.id },
          data: { status: 'DRAFT' },
        }),
      ),
    ).rejects.toThrow(/immutable/);
  });

  it('AR-21 audited correction rewrites participants', async () => {
    const created = await perf().create({
      clinicalServiceId,
      performedAt: new Date().toISOString(),
      participants: [{ userId: actorId, role: 'PRIMARY', attributionShare: 100 }],
      actorId,
      actorRoles: ['dentist'],
    });
    await perf().complete({ id: created.id, actorId, actorRoles: ['dentist'] });
    const corrected = await perf().correct({
      id: created.id,
      reason: 'reassign performer',
      participants: [{ userId: providerId, role: 'PRIMARY', attributionShare: 100 }],
      actorId,
      actorRoles: ['dentist'],
    });
    expect(corrected?.participants[0].userId).toBe(providerId);
    expect(corrected?.corrections?.length).toBe(1);
  });

  it('AR-21 concurrent corrections serialize and preserve history', async () => {
    const created = await perf().create({
      clinicalServiceId,
      performedAt: new Date().toISOString(),
      appointmentId,
      participants: [{ userId: actorId, role: 'PRIMARY', attributionShare: 100 }],
      actorId,
      actorRoles: ['dentist'],
    });
    await perf().complete({ id: created.id, actorId, actorRoles: ['dentist'] });

    const p1 = perf().correct({
      id: created.id,
      reason: 'corr-1',
      participants: [{ userId: providerId, role: 'PRIMARY', attributionShare: 100 }],
      actorId,
      actorRoles: ['dentist'],
    });
    const p2 = perf().correct({
      id: created.id,
      reason: 'corr-2',
      participants: [{ userId: actorId, role: 'PRIMARY', attributionShare: 100 }],
      actorId,
      actorRoles: ['dentist'],
    });
    await Promise.all([p1, p2]);
    const row = await perf().get(created.id);
    expect(row.corrections.length).toBe(2);
    expect([actorId, providerId]).toContain(row.participants[0].userId);
    const historySets = row.corrections.map((c) =>
      JSON.stringify(c.previousParticipants as unknown),
    );
    expect(historySets.some((s) => s.includes(actorId))).toBe(true);
    expect(historySets.some((s) => s.includes(providerId))).toBe(true);
  });

  it('AR-21 correction failure rolls back participants/history/audit together', async () => {
    const created = await perf().create({
      clinicalServiceId,
      performedAt: new Date().toISOString(),
      appointmentId,
      participants: [{ userId: actorId, role: 'PRIMARY', attributionShare: 100 }],
      actorId,
      actorRoles: ['dentist'],
    });
    await perf().complete({ id: created.id, actorId, actorRoles: ['dentist'] });
    failAuditAction = 'service_performance.correct';
    await expect(
      perf().correct({
        id: created.id,
        reason: 'force rollback',
        participants: [{ userId: providerId, role: 'PRIMARY', attributionShare: 100 }],
        actorId,
        actorRoles: ['dentist'],
      }),
    ).rejects.toThrow(/forced audit failure/);
    failAuditAction = null;
    const row = await perf().get(created.id);
    expect(row.participants).toHaveLength(1);
    expect(row.participants[0].userId).toBe(actorId);
    expect(row.corrections).toHaveLength(0);
    expect(auditCalls.some((c) => c.action === 'service_performance.correct')).toBe(false);
  });
});
