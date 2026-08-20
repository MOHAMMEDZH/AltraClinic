/**
 * Wave E — TreatmentCourse / DeviceTreatment / Dermatology / PrePost production-path PostgreSQL tests.
 */
import { randomUUID } from 'crypto';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import type { PrismaClient } from '@prisma/client';
import {
  createClinicalPrismaWrapper,
  createPlatformDbSecurityClient,
  platformDbSecurityEnabled,
} from '../../clinical-catalog/tests/clinical-catalog-db.harness';
import { TreatmentCourseService } from '../services/treatment-course.service';
import { DeviceTreatmentRecordService } from '../services/device-treatment-record.service';
import { DermatologyEncounterService } from '../services/dermatology-encounter.service';
import { PrePostCareService } from '../services/pre-post-care.service';

jest.setTimeout(180_000);
const describeDb = platformDbSecurityEnabled() ? describe : describe.skip;

describeDb('Wave E aesthetic/dermatology integration (PostgreSQL)', () => {
  let raw: PrismaClient;
  let wrapper: ReturnType<typeof createClinicalPrismaWrapper>;
  let tenantId: string;
  let otherTenantId: string;
  let actorId: string;
  let providerId: string;
  let patientId: string;
  let foreignPatientId: string;
  let branchId: string;
  let appointmentId: string;
  let clinicalServiceId: string;
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

  function courses() {
    return new TreatmentCourseService(wrapper as never, tenantContext as never, audit as never);
  }
  function devices() {
    return new DeviceTreatmentRecordService(
      wrapper as never,
      tenantContext as never,
      audit as never,
    );
  }
  function derm() {
    return new DermatologyEncounterService(
      wrapper as never,
      tenantContext as never,
      audit as never,
    );
  }
  function prePost() {
    return new PrePostCareService(wrapper as never, tenantContext as never, audit as never);
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
    foreignPatientId = randomUUID();
    branchId = randomUUID();
    appointmentId = randomUUID();
    clinicalServiceId = randomUUID();
    failAuditAction = null;

    await wrapper.withPlatformBypass(async (c) => {
      await c.tenant.create({
        data: { id: tenantId, name: 'WE', slug: `we-${tenantId.slice(0, 8)}` },
      });
      await c.tenant.create({
        data: { id: otherTenantId, name: 'WE O', slug: `weo-${otherTenantId.slice(0, 8)}` },
      });
      await c.user.create({
        data: {
          id: actorId,
          tenantId,
          email: `we-${actorId.slice(0, 8)}@t.local`,
          passwordHash: 'x',
          firstName: 'A',
          lastName: 'Ctor',
        },
      });
      await c.user.create({
        data: {
          id: providerId,
          tenantId,
          email: `we-${providerId.slice(0, 8)}@t.local`,
          passwordHash: 'x',
          firstName: 'P',
          lastName: 'Rovider',
        },
      });
      await c.patient.create({
        data: { id: patientId, tenantId, firstName: 'Pat', lastName: 'Aes' },
      });
      await c.patient.create({
        data: {
          id: foreignPatientId,
          tenantId: otherTenantId,
          firstName: 'Foreign',
          lastName: 'Pat',
        },
      });
      await c.branch.create({
        data: {
          id: branchId,
          tenantId,
          name: `Wave E Branch ${branchId.slice(0, 6)}`,
        },
      });
      await c.canonicalClinicalServiceDefinition.create({
        data: {
          id: clinicalServiceId,
          tenantId,
          provenance: 'TENANT_CUSTOM',
          stableKey: `tenant.${tenantId}.custom.we-${clinicalServiceId.slice(0, 8)}`,
          domain: 'AESTHETIC',
          categoryKey: 'dermatology',
          lifecycle: 'PUBLISHED',
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
    });
  });

  it('creates treatment course with plannedSessions → CourseSessions', async () => {
    const created = await courses().create({
      patientId,
      clinicalServiceId,
      plannedSessions: 3,
      intervalMinDays: 7,
      intervalMaxDays: 14,
      actorId,
      actorRoles: ['doctor'],
    });
    expect(created.status).toBe('DRAFT');
    expect(created.sessions).toHaveLength(3);
    expect(created.sessions.map((s) => s.sequence)).toEqual([1, 2, 3]);
    expect(created.sessions.every((s) => s.status === 'PLANNED')).toBe(true);
    expect(auditCalls.some((c) => c.action === 'treatment_course.create')).toBe(true);
  });

  it('transitions DRAFT → ACTIVE', async () => {
    const created = await courses().create({
      patientId,
      clinicalServiceId,
      plannedSessions: 2,
      actorId,
      actorRoles: ['doctor'],
    });
    const updated = await courses().transition({
      id: created.id,
      toStatus: 'ACTIVE',
      actorId,
      actorRoles: ['doctor'],
    });
    expect(updated.status).toBe('ACTIVE');
    expect(auditCalls.some((c) => c.action === 'treatment_course.transition')).toBe(true);
  });

  it('links session to appointment explicitly (no auto-book)', async () => {
    const created = await courses().create({
      patientId,
      clinicalServiceId,
      plannedSessions: 2,
      actorId,
      actorRoles: ['doctor'],
    });
    await courses().transition({
      id: created.id,
      toStatus: 'ACTIVE',
      actorId,
      actorRoles: ['doctor'],
    });
    const session = created.sessions[0];
    expect(session.appointmentId).toBeNull();
    const linked = await courses().linkSessionAppointment({
      courseId: created.id,
      sessionId: session.id,
      appointmentId,
      actorId,
      actorRoles: ['doctor'],
    });
    expect(linked.appointmentId).toBe(appointmentId);
    expect(linked.status).toBe('BOOKED');
    expect(auditCalls.some((c) => c.action === 'course_session.link_appointment')).toBe(true);

    const untouched = await wrapper.withPlatformBypass((c) =>
      c.courseSession.findFirst({ where: { id: created.sessions[1].id } }),
    );
    expect(untouched?.appointmentId).toBeNull();
    expect(untouched?.status).toBe('PLANNED');
  });

  it('rejects cross-tenant patient on course create', async () => {
    await expect(
      courses().create({
        patientId: foreignPatientId,
        clinicalServiceId,
        plannedSessions: 1,
        actorId,
        actorRoles: ['doctor'],
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
    const count = await wrapper.withPlatformBypass((c) =>
      c.treatmentCourse.count({ where: { tenantId } }),
    );
    expect(count).toBe(0);
  });

  it('audit failure on create rolls back course and session rows', async () => {
    failAuditAction = 'treatment_course.create';
    await expect(
      courses().create({
        patientId,
        clinicalServiceId,
        plannedSessions: 2,
        actorId,
        actorRoles: ['doctor'],
      }),
    ).rejects.toThrow(/forced audit failure/);
    failAuditAction = null;
    const coursesCount = await wrapper.withPlatformBypass((c) =>
      c.treatmentCourse.count({ where: { tenantId } }),
    );
    const sessionsCount = await wrapper.withPlatformBypass((c) =>
      c.courseSession.count({ where: { tenantId } }),
    );
    expect(coursesCount).toBe(0);
    expect(sessionsCount).toBe(0);
    expect(auditCalls.some((c) => c.action === 'treatment_course.create')).toBe(false);
  });

  it('device treatment create keeps providerId ≠ actorId with recordedBy = actor', async () => {
    expect(providerId).not.toBe(actorId);
    const row = await devices().create({
      deviceType: 'laser',
      clinicalServiceId,
      parameterSchemaKey: 'laser.generic.v1',
      parameterPayload: { joules: 10 },
      patientId,
      providerId,
      branchId,
      actorId,
      actorRoles: ['doctor'],
    });
    expect(row.providerId).toBe(providerId);
    expect(row.recordedBy).toBe(actorId);
    expect(row.parameterSchemaKey).toBe('laser.generic.v1');
    expect(auditCalls.some((c) => c.action === 'device_treatment.create')).toBe(true);
  });

  it('rejects invalid parameterSchemaKey', async () => {
    await expect(
      devices().create({
        deviceType: 'laser',
        clinicalServiceId,
        parameterSchemaKey: 'laser.unsafe.v99',
        patientId,
        providerId,
        actorId,
        actorRoles: ['doctor'],
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    const count = await wrapper.withPlatformBypass((c) =>
      c.deviceTreatmentRecord.count({ where: { tenantId } }),
    );
    expect(count).toBe(0);
  });

  it('device correct with reason writes audit', async () => {
    const row = await devices().create({
      deviceType: 'ipl',
      clinicalServiceId,
      parameterSchemaKey: 'ipl.generic.v1',
      parameterPayload: { pulses: 1 },
      patientId,
      providerId,
      actorId,
      actorRoles: ['doctor'],
    });
    const corrected = await devices().correct({
      id: row.id,
      parameterPayload: { pulses: 3 },
      reason: 'clinician adjustment',
      actorId,
      actorRoles: ['doctor'],
    });
    expect(corrected.correctionReason).toBe('clinician adjustment');
    expect(corrected.correctedBy).toBe(actorId);
    expect(corrected.correctedAt).toBeTruthy();
    expect(auditCalls.some((c) => c.action === 'device_treatment.correct')).toBe(true);
  });

  it('openDermatologyEncounter uses Encounter SoR', async () => {
    const encounter = await derm().openDermatologyEncounter({
      patientId,
      clinicianId: providerId,
      clinicalServiceId,
      appointmentId,
      branchId,
      chiefComplaint: 'acne follow-up',
      actorId,
      actorRoles: ['doctor'],
    });
    expect(encounter.id).toBeTruthy();
    expect(encounter.patientId).toBe(patientId);
    expect(encounter.clinicianId).toBe(providerId);
    expect(encounter.appointmentId).toBe(appointmentId);
    const observations = encounter.observations as Array<{ kind?: string }>;
    expect(observations.some((o) => o.kind === 'dermatology')).toBe(true);

    const fromDb = await wrapper.withPlatformBypass((c) =>
      c.encounter.findFirst({ where: { id: encounter.id, tenantId } }),
    );
    expect(fromDb).toBeTruthy();
    expect(auditCalls.some((c) => c.action === 'dermatology.encounter.open')).toBe(true);
  });

  it('assertNoDermatologyRecordModel returns ok / no DermatologyRecord model', async () => {
    expect(derm().assertNoDermatologyRecordModel()).toEqual({ dermatologyRecordModel: false });
    expect((raw as unknown as Record<string, unknown>).dermatologyRecord).toBeUndefined();
    const tables = await wrapper.withPlatformBypass((c) =>
      c.$queryRaw<Array<{ exists: boolean }>>`
        SELECT EXISTS (
          SELECT 1 FROM information_schema.tables
          WHERE table_schema = 'public' AND table_name = 'dermatology_records'
        ) AS exists
      `,
    );
    expect(tables[0]?.exists).toBe(false);
  });

  it('PrePostCareService.listSupportedKinds includes PRE_CARE and POST_CARE', () => {
    expect(prePost().listSupportedKinds()).toEqual(['PRE_CARE', 'POST_CARE']);
  });

  it('mixed-tenant course_sessions insert is rejected by trigger (bypass)', async () => {
    const courseB = randomUUID();
    const patientB = randomUUID();
    const svcB = randomUUID();
    const actorB = randomUUID();
    await wrapper.withPlatformBypass(async (c) => {
      await c.user.create({
        data: {
          id: actorB,
          tenantId: otherTenantId,
          email: `we-b-${actorB.slice(0, 8)}@t.local`,
          passwordHash: 'x',
          firstName: 'B',
          lastName: 'Actor',
        },
      });
      await c.patient.create({
        data: { id: patientB, tenantId: otherTenantId, firstName: 'B', lastName: 'Pat' },
      });
      await c.canonicalClinicalServiceDefinition.create({
        data: {
          id: svcB,
          tenantId: otherTenantId,
          provenance: 'TENANT_CUSTOM',
          stableKey: `tenant.${otherTenantId}.custom.we-${svcB.slice(0, 8)}`,
          domain: 'AESTHETIC',
          lifecycle: 'PUBLISHED',
        },
      });
      await c.treatmentCourse.create({
        data: {
          id: courseB,
          tenantId: otherTenantId,
          patientId: patientB,
          clinicalServiceId: svcB,
          plannedSessions: 1,
          createdBy: actorB,
        },
      });
    });

    const attemptId = randomUUID();
    await expect(
      wrapper.withPlatformBypass((c) =>
        c.courseSession.create({
          data: {
            id: attemptId,
            tenantId,
            courseId: courseB,
            sequence: 1,
            status: 'PLANNED',
          },
        }),
      ),
    ).rejects.toThrow(/course_sessions: tenantId must match course\.tenantId|course .* not found/i);

    const leaked = await wrapper.withPlatformBypass((c) =>
      c.courseSession.count({ where: { id: attemptId } }),
    );
    expect(leaked).toBe(0);
  });

  it('reuses InventoryUsageLedger — no aesthetic_usage table / model', async () => {
    expect((raw as unknown as Record<string, unknown>).inventoryUsageLedger).toBeDefined();
    expect((raw as unknown as Record<string, unknown>).aestheticUsage).toBeUndefined();
    const tables = await wrapper.withPlatformBypass((c) =>
      c.$queryRaw<Array<{ aesthetic: boolean; ledger: boolean }>>`
        SELECT
          EXISTS (
            SELECT 1 FROM information_schema.tables
            WHERE table_schema = 'public' AND table_name = 'aesthetic_usage'
          ) AS aesthetic,
          EXISTS (
            SELECT 1 FROM information_schema.tables
            WHERE table_schema = 'public'
              AND table_name = 'inventory_consumption_logs'
          ) AS ledger
      `,
    );
    expect(tables[0]?.aesthetic).toBe(false);
    expect(tables[0]?.ledger).toBe(true);
  });
});
