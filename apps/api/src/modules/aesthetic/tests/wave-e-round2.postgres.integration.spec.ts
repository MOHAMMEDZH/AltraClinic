/**
 * Wave E Round 2 — R2-B2 intervals, R2-B4 PRE/POST authority, R2-DERM photo context.
 * Real services + PostgreSQL (no mocks).
 */
import { randomUUID } from 'crypto';
import { BadRequestException } from '@nestjs/common';
import type { PrismaClient } from '@prisma/client';
import {
  createClinicalPrismaWrapper,
  createPlatformDbSecurityClient,
  platformDbSecurityEnabled,
} from '../../clinical-catalog/tests/clinical-catalog-db.harness';
import { TreatmentCourseService } from '../services/treatment-course.service';
import { DermatologyEncounterService } from '../services/dermatology-encounter.service';
import { PrePostCareService } from '../services/pre-post-care.service';
import { assertCourseIntervalsForReschedule } from '../services/wave-e-reference.validation';

jest.setTimeout(180_000);
const describeDb = platformDbSecurityEnabled() ? describe : describe.skip;

describeDb('Wave E Round 2 remediation (PostgreSQL, real services)', () => {
  let raw: PrismaClient;
  let wrapper: ReturnType<typeof createClinicalPrismaWrapper>;
  let tenantId: string;
  let otherTenantId: string;
  let actorId: string;
  let providerId: string;
  let patientId: string;
  let branchId: string;
  let clinicalServiceId: string;
  let dermServiceId: string;
  let nonDermServiceId: string;
  const auditCalls: Array<Record<string, unknown>> = [];

  const tenantContext = {
    resolve: async () => ({ tenantId, branchId: null, locale: 'en' }),
  };
  const audit = {
    record: async (e: Record<string, unknown>) => {
      auditCalls.push({ ...e, via: 'record' });
    },
    recordInTransaction: async (_tx: unknown, e: Record<string, unknown>) => {
      auditCalls.push({ ...e, via: 'recordInTransaction' });
    },
  };

  function courses() {
    return new TreatmentCourseService(wrapper as never, tenantContext as never, audit as never);
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

  async function createAppointment(start: Date, end?: Date) {
    const id = randomUUID();
    await wrapper.withPlatformBypass((c) =>
      c.appointment.create({
        data: {
          id,
          tenantId,
          patientId,
          providerId,
          scheduledStart: start,
          scheduledEnd: end ?? new Date(start.getTime() + 3_600_000),
          status: 'CONFIRMED',
          clinicalServiceId,
          branchId,
        },
      }),
    );
    return id;
  }

  async function seedPublishedForm(kind: 'PRE_CARE' | 'POST_CARE', opts?: { status?: string }) {
    const templateId = randomUUID();
    const versionId = randomUUID();
    await wrapper.withPlatformBypass(async (c) => {
      await c.clinicalFormTemplate.create({
        data: {
          id: templateId,
          tenantId,
          kind,
          stableKey: `wave-e-${kind.toLowerCase()}-${templateId.slice(0, 8)}`,
          status: 'ACTIVE',
          nameEn: `${kind} form`,
          nameAr: kind,
          createdByUserId: actorId,
        },
      });
      await c.clinicalFormVersion.create({
        data: {
          id: versionId,
          templateId,
          version: 1,
          status: opts?.status ?? 'PUBLISHED',
          contentEn: '{}',
          contentAr: '{}',
          publishedAt: opts?.status === 'DRAFT' ? null : new Date(),
          publishedByUserId: opts?.status === 'DRAFT' ? null : actorId,
        },
      });
    });
    return { templateId, versionId };
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
    branchId = randomUUID();
    clinicalServiceId = randomUUID();
    dermServiceId = randomUUID();
    nonDermServiceId = randomUUID();

    await wrapper.withPlatformBypass(async (c) => {
      await c.tenant.create({
        data: { id: tenantId, name: 'WE R2', slug: `wer2-${tenantId.slice(0, 8)}` },
      });
      await c.tenant.create({
        data: {
          id: otherTenantId,
          name: 'WE R2 Other',
          slug: `wer2o-${otherTenantId.slice(0, 8)}`,
        },
      });
      await c.user.create({
        data: {
          id: actorId,
          tenantId,
          email: `wer2-${actorId.slice(0, 8)}@t.local`,
          passwordHash: 'x',
          firstName: 'A',
          lastName: 'R2',
          roles: { create: [{ role: 'DOCTOR' }] },
        },
      });
      await c.user.create({
        data: {
          id: providerId,
          tenantId,
          email: `wer2p-${providerId.slice(0, 8)}@t.local`,
          passwordHash: 'x',
          firstName: 'P',
          lastName: 'Rov',
          roles: { create: [{ role: 'DOCTOR' }] },
        },
      });
      await c.patient.create({
        data: { id: patientId, tenantId, firstName: 'Pat', lastName: 'R2' },
      });
      await c.branch.create({
        data: { id: branchId, tenantId, name: 'Branch R2' },
      });
      await c.canonicalClinicalServiceDefinition.create({
        data: {
          id: clinicalServiceId,
          tenantId,
          provenance: 'TENANT_CUSTOM',
          stableKey: `tenant.${tenantId}.custom.r2-${clinicalServiceId.slice(0, 8)}`,
          domain: 'AESTHETIC',
          lifecycle: 'PUBLISHED',
        },
      });
      await c.canonicalClinicalServiceDefinition.create({
        data: {
          id: dermServiceId,
          tenantId,
          provenance: 'TENANT_CUSTOM',
          stableKey: `tenant.${tenantId}.custom.derm-${dermServiceId.slice(0, 8)}`,
          domain: 'AESTHETIC',
          categoryKey: 'dermatology',
          lifecycle: 'PUBLISHED',
        },
      });
      await c.canonicalClinicalServiceDefinition.create({
        data: {
          id: nonDermServiceId,
          tenantId,
          provenance: 'TENANT_CUSTOM',
          stableKey: `tenant.${tenantId}.custom.nonderm-${nonDermServiceId.slice(0, 8)}`,
          domain: 'AESTHETIC',
          categoryKey: 'general',
          lifecycle: 'PUBLISHED',
        },
      });
    });
  });

  // --- R2-B2 intervals ---
  async function activeCourse(min: number, max: number, sessions = 3) {
    const course = await courses().create({
      patientId,
      clinicalServiceId,
      plannedSessions: sessions,
      intervalMinDays: min,
      intervalMaxDays: max,
      actorId,
      actorRoles: ['doctor'],
    });
    await courses().transition({
      id: course.id,
      toStatus: 'ACTIVE',
      actorId,
      actorRoles: ['doctor'],
    });
    return course;
  }

  it('R2-B2-T1: Session 2 dated before Session 1 → reject', async () => {
    const course = await activeCourse(7, 30, 2);
    const appt1 = await createAppointment(new Date('2026-09-10T10:00:00.000Z'));
    await courses().linkSessionAppointment({
      courseId: course.id,
      sessionId: course.sessions[0].id,
      appointmentId: appt1,
      actorId,
      actorRoles: ['doctor'],
    });
    const appt2 = await createAppointment(new Date('2026-09-05T10:00:00.000Z'));
    await expect(
      courses().linkSessionAppointment({
        courseId: course.id,
        sessionId: course.sessions[1].id,
        appointmentId: appt2,
        actorId,
        actorRoles: ['doctor'],
      }),
    ).rejects.toThrow(/chronologically after|strictly after/);
  });

  it('R2-B2-T2: Session 2 exact min boundary → success', async () => {
    const course = await activeCourse(14, 30, 2);
    const appt1 = await createAppointment(new Date('2026-09-01T10:00:00.000Z'));
    await courses().linkSessionAppointment({
      courseId: course.id,
      sessionId: course.sessions[0].id,
      appointmentId: appt1,
      actorId,
      actorRoles: ['doctor'],
    });
    const appt2 = await createAppointment(new Date('2026-09-15T10:00:00.000Z'));
    const linked = await courses().linkSessionAppointment({
      courseId: course.id,
      sessionId: course.sessions[1].id,
      appointmentId: appt2,
      actorId,
      actorRoles: ['doctor'],
    });
    expect(linked.status).toBe('BOOKED');
  });

  it('R2-B2-T3: Session 2 below min → reject', async () => {
    const course = await activeCourse(14, 30, 2);
    const appt1 = await createAppointment(new Date('2026-09-01T10:00:00.000Z'));
    await courses().linkSessionAppointment({
      courseId: course.id,
      sessionId: course.sessions[0].id,
      appointmentId: appt1,
      actorId,
      actorRoles: ['doctor'],
    });
    const appt2 = await createAppointment(new Date('2026-09-10T10:00:00.000Z'));
    await expect(
      courses().linkSessionAppointment({
        courseId: course.id,
        sessionId: course.sessions[1].id,
        appointmentId: appt2,
        actorId,
        actorRoles: ['doctor'],
      }),
    ).rejects.toThrow(/intervalMinDays/);
  });

  it('R2-B2-T4: Session 2 exact max → success', async () => {
    const course = await activeCourse(7, 14, 2);
    const appt1 = await createAppointment(new Date('2026-09-01T10:00:00.000Z'));
    await courses().linkSessionAppointment({
      courseId: course.id,
      sessionId: course.sessions[0].id,
      appointmentId: appt1,
      actorId,
      actorRoles: ['doctor'],
    });
    const appt2 = await createAppointment(new Date('2026-09-15T10:00:00.000Z'));
    const linked = await courses().linkSessionAppointment({
      courseId: course.id,
      sessionId: course.sessions[1].id,
      appointmentId: appt2,
      actorId,
      actorRoles: ['doctor'],
    });
    expect(linked.status).toBe('BOOKED');
  });

  it('R2-B2-T5: Session 2 above max → reject', async () => {
    const course = await activeCourse(7, 14, 2);
    const appt1 = await createAppointment(new Date('2026-09-01T10:00:00.000Z'));
    await courses().linkSessionAppointment({
      courseId: course.id,
      sessionId: course.sessions[0].id,
      appointmentId: appt1,
      actorId,
      actorRoles: ['doctor'],
    });
    const appt2 = await createAppointment(new Date('2026-09-20T10:00:00.000Z'));
    await expect(
      courses().linkSessionAppointment({
        courseId: course.id,
        sessionId: course.sessions[1].id,
        appointmentId: appt2,
        actorId,
        actorRoles: ['doctor'],
      }),
    ).rejects.toThrow(/intervalMaxDays/);
  });

  it('R2-B2-T6: Session 2 linked after Session 3 exists, violating next-neighbor → reject', async () => {
    const course = await activeCourse(7, 14, 3);
    const appt1 = await createAppointment(new Date('2026-09-01T10:00:00.000Z'));
    const appt3 = await createAppointment(new Date('2026-09-15T10:00:00.000Z'));
    await courses().linkSessionAppointment({
      courseId: course.id,
      sessionId: course.sessions[0].id,
      appointmentId: appt1,
      actorId,
      actorRoles: ['doctor'],
    });
    await courses().linkSessionAppointment({
      courseId: course.id,
      sessionId: course.sessions[2].id,
      appointmentId: appt3,
      actorId,
      actorRoles: ['doctor'],
    });
    // Session 2 only 2 days before session 3 (gap s2→s3 = 2 < min 7)
    const appt2 = await createAppointment(new Date('2026-09-13T10:00:00.000Z'));
    await expect(
      courses().linkSessionAppointment({
        courseId: course.id,
        sessionId: course.sessions[1].id,
        appointmentId: appt2,
        actorId,
        actorRoles: ['doctor'],
      }),
    ).rejects.toThrow(/intervalMinDays|next sequence/);
  });

  it('R2-B2-T7: Session 2 valid against both Session 1 and Session 3 → success', async () => {
    const course = await activeCourse(7, 14, 3);
    const appt1 = await createAppointment(new Date('2026-09-01T10:00:00.000Z'));
    const appt3 = await createAppointment(new Date('2026-09-15T10:00:00.000Z'));
    await courses().linkSessionAppointment({
      courseId: course.id,
      sessionId: course.sessions[0].id,
      appointmentId: appt1,
      actorId,
      actorRoles: ['doctor'],
    });
    await courses().linkSessionAppointment({
      courseId: course.id,
      sessionId: course.sessions[2].id,
      appointmentId: appt3,
      actorId,
      actorRoles: ['doctor'],
    });
    // 7d after S1 and 7d before S3 — exact min both neighbors
    const appt2 = await createAppointment(new Date('2026-09-08T10:00:00.000Z'));
    const linked = await courses().linkSessionAppointment({
      courseId: course.id,
      sessionId: course.sessions[1].id,
      appointmentId: appt2,
      actorId,
      actorRoles: ['doctor'],
    });
    expect(linked.status).toBe('BOOKED');
  });

  it('R2-B2-T8/T9/T10: reschedule neighbor violations reject; original time/link unchanged', async () => {
    const course = await activeCourse(7, 14, 3);
    const appt1 = await createAppointment(new Date('2026-09-01T10:00:00.000Z'));
    const appt2 = await createAppointment(new Date('2026-09-09T10:00:00.000Z'));
    const appt3 = await createAppointment(new Date('2026-09-18T10:00:00.000Z'));
    await courses().linkSessionAppointment({
      courseId: course.id,
      sessionId: course.sessions[0].id,
      appointmentId: appt1,
      actorId,
      actorRoles: ['doctor'],
    });
    await courses().linkSessionAppointment({
      courseId: course.id,
      sessionId: course.sessions[1].id,
      appointmentId: appt2,
      actorId,
      actorRoles: ['doctor'],
    });
    await courses().linkSessionAppointment({
      courseId: course.id,
      sessionId: course.sessions[2].id,
      appointmentId: appt3,
      actorId,
      actorRoles: ['doctor'],
    });

    const original = await wrapper.withPlatformBypass((c) =>
      c.appointment.findUniqueOrThrow({ where: { id: appt2 } }),
    );
    const sessionBefore = await wrapper.withPlatformBypass((c) =>
      c.courseSession.findFirstOrThrow({
        where: { id: course.sessions[1].id, tenantId },
      }),
    );

    // T8 — breaks previous-neighbor (too close to session 1)
    await expect(
      wrapper.withPlatformBypass((tx) =>
        assertCourseIntervalsForReschedule(
          tx,
          tenantId,
          appt2,
          new Date('2026-09-03T10:00:00.000Z'),
        ),
      ),
    ).rejects.toThrow(/intervalMinDays|chronologically/);

    // T9 — breaks next-neighbor (OK vs prior max, too close to session 3)
    await expect(
      wrapper.withPlatformBypass((tx) =>
        assertCourseIntervalsForReschedule(
          tx,
          tenantId,
          appt2,
          new Date('2026-09-15T10:00:00.000Z'),
        ),
      ),
    ).rejects.toThrow(/intervalMinDays|next sequence/);

    // T10 — originals unchanged
    const after = await wrapper.withPlatformBypass(async (c) => ({
      appt: await c.appointment.findUniqueOrThrow({ where: { id: appt2 } }),
      session: await c.courseSession.findFirstOrThrow({
        where: { id: course.sessions[1].id, tenantId },
      }),
    }));
    expect(after.appt.scheduledStart.toISOString()).toBe(original.scheduledStart.toISOString());
    expect(after.session.appointmentId).toBe(sessionBefore.appointmentId);
  });

  // --- R2-B4 PRE/POST ---
  it('R2-B4-T1/T7/T8/T9: PUBLISHED PRE_CARE → instance; versionId exact; zero new template/version', async () => {
    const { templateId, versionId } = await seedPublishedForm('PRE_CARE');
    const before = await wrapper.withPlatformBypass(async (c) => ({
      templates: await c.clinicalFormTemplate.count({ where: { tenantId } }),
      versions: await c.clinicalFormVersion.count({ where: { template: { tenantId } } }),
    }));
    const created = await prePost().createInstance({
      kind: 'PRE_CARE',
      patientId,
      clinicalServiceId,
      actorId,
      actorRoles: ['doctor'],
    });
    expect(created.versionId).toBe(versionId);
    expect(created.templateId).toBe(templateId);
    const after = await wrapper.withPlatformBypass(async (c) => ({
      templates: await c.clinicalFormTemplate.count({ where: { tenantId } }),
      versions: await c.clinicalFormVersion.count({ where: { template: { tenantId } } }),
      instance: await c.patientFormInstance.findUniqueOrThrow({ where: { id: created.id } }),
    }));
    expect(after.templates).toBe(before.templates);
    expect(after.versions).toBe(before.versions);
    expect(after.instance.versionId).toBe(versionId);
  });

  it('R2-B4-T2: PUBLISHED POST_CARE → success', async () => {
    const { versionId } = await seedPublishedForm('POST_CARE');
    const created = await prePost().createInstance({
      kind: 'POST_CARE',
      patientId,
      versionId,
      actorId,
      actorRoles: ['doctor'],
    });
    expect(created.kind).toBe('POST_CARE');
    expect(created.versionId).toBe(versionId);
  });

  it('R2-B4-T3: no published PRE_CARE → reject', async () => {
    // Neutralize any leftover platform packs so auto-resolve has nothing.
    await wrapper.withPlatformBypass((c) =>
      c.clinicalFormTemplate.updateMany({
        where: {
          tenantId: null,
          kind: 'PRE_CARE',
          status: 'ACTIVE',
        },
        data: { status: 'INACTIVE' },
      }),
    );
    await expect(
      prePost().createInstance({
        kind: 'PRE_CARE',
        patientId,
        actorId,
        actorRoles: ['doctor'],
      }),
    ).rejects.toThrow(/No PUBLISHED PRE_CARE/);
  });

  it('R2-B4-T4: DRAFT-only version → reject', async () => {
    const { versionId } = await seedPublishedForm('PRE_CARE', { status: 'DRAFT' });
    await expect(
      prePost().createInstance({
        kind: 'PRE_CARE',
        patientId,
        versionId,
        actorId,
        actorRoles: ['doctor'],
      }),
    ).rejects.toThrow(/must be PUBLISHED/);
  });

  it('R2-B4-T5: cross-tenant version → reject', async () => {
    const foreignTemplate = randomUUID();
    const foreignVersion = randomUUID();
    const foreignActor = randomUUID();
    await wrapper.withPlatformBypass(async (c) => {
      await c.user.create({
        data: {
          id: foreignActor,
          tenantId: otherTenantId,
          email: `fx-${foreignActor.slice(0, 8)}@t.local`,
          passwordHash: 'x',
          firstName: 'F',
          lastName: 'X',
        },
      });
      await c.clinicalFormTemplate.create({
        data: {
          id: foreignTemplate,
          tenantId: otherTenantId,
          kind: 'PRE_CARE',
          stableKey: `fx-pre-${foreignTemplate.slice(0, 8)}`,
          status: 'ACTIVE',
          nameEn: 'Foreign',
          createdByUserId: foreignActor,
        },
      });
      await c.clinicalFormVersion.create({
        data: {
          id: foreignVersion,
          templateId: foreignTemplate,
          version: 1,
          status: 'PUBLISHED',
          contentEn: '{}',
          contentAr: '{}',
          publishedAt: new Date(),
          publishedByUserId: foreignActor,
        },
      });
    });
    await expect(
      prePost().createInstance({
        kind: 'PRE_CARE',
        patientId,
        versionId: foreignVersion,
        actorId,
        actorRoles: ['doctor'],
      }),
    ).rejects.toThrow(/does not belong to the current tenant|not visible to the current tenant/);
  });

  it('R2-B4-T6: wrong form kind → reject', async () => {
    const { versionId } = await seedPublishedForm('POST_CARE');
    await expect(
      prePost().createInstance({
        kind: 'PRE_CARE',
        patientId,
        versionId,
        actorId,
        actorRoles: ['doctor'],
      }),
    ).rejects.toThrow(/expected PRE_CARE/);
  });

  it('R2-B4-T10: audit failure leaves no partial instance', async () => {
    await seedPublishedForm('PRE_CARE');
    const failingAudit = {
      record: async () => undefined,
      recordInTransaction: async () => {
        throw new Error('forced audit failure');
      },
    };
    const svc = new PrePostCareService(
      wrapper as never,
      tenantContext as never,
      failingAudit as never,
    );
    const before = await wrapper.withPlatformBypass((c) =>
      c.patientFormInstance.count({ where: { tenantId } }),
    );
    await expect(
      svc.createInstance({
        kind: 'PRE_CARE',
        patientId,
        actorId,
        actorRoles: ['doctor'],
      }),
    ).rejects.toThrow(/forced audit failure/);
    const after = await wrapper.withPlatformBypass((c) =>
      c.patientFormInstance.count({ where: { tenantId } }),
    );
    expect(after).toBe(before);
  });

  // --- R2-DERM photo context ---
  it('R2-DERM-T1: valid dermatology encounter + photo → success', async () => {
    const encounter = await derm().openDermatologyEncounter({
      patientId,
      clinicianId: providerId,
      clinicalServiceId: dermServiceId,
      branchId,
      actorId,
      actorRoles: ['doctor'],
    });
    const result = await derm().attachDermatologyPhoto({
      encounterId: encounter.id,
      originalFilename: 'lesion.jpg',
      mimeType: 'image/jpeg',
      sizeBytes: 2048,
      actorId,
      actorRoles: ['doctor'],
    });
    expect(result.media.ownerId).toBe(encounter.id);
  });

  it('R2-DERM-T2: non-dermatology encounter + photo → reject', async () => {
    const encounterId = randomUUID();
    await wrapper.withPlatformBypass((c) =>
      c.encounter.create({
        data: {
          id: encounterId,
          tenantId,
          patientId,
          clinicianId: providerId,
          branchId,
          diagnoses: [],
          medications: [],
          observations: [],
          soapNotes: {},
          structuredNotes: [],
        },
      }),
    );
    await expect(
      derm().attachDermatologyPhoto({
        encounterId,
        originalFilename: 'x.jpg',
        actorId,
        actorRoles: ['doctor'],
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('R2-DERM-T3: cross-tenant MediaAsset → reject', async () => {
    const encounter = await derm().openDermatologyEncounter({
      patientId,
      clinicianId: providerId,
      clinicalServiceId: dermServiceId,
      branchId,
      actorId,
      actorRoles: ['doctor'],
    });
    const foreignMedia = randomUUID();
    const foreignPatient = randomUUID();
    const foreignActor = randomUUID();
    await wrapper.withPlatformBypass(async (c) => {
      await c.user.create({
        data: {
          id: foreignActor,
          tenantId: otherTenantId,
          email: `fxm-${foreignActor.slice(0, 8)}@t.local`,
          passwordHash: 'x',
          firstName: 'F',
          lastName: 'M',
        },
      });
      await c.patient.create({
        data: {
          id: foreignPatient,
          tenantId: otherTenantId,
          firstName: 'F',
          lastName: 'M',
        },
      });
      await c.mediaAsset.create({
        data: {
          id: foreignMedia,
          tenantId: otherTenantId,
          category: 'MEDICAL_DOCUMENT',
          ownerType: 'patient',
          ownerId: foreignPatient,
          patientId: foreignPatient,
          originalFilename: 'fx.jpg',
          mimeType: 'image/jpeg',
          sizeBytes: BigInt(10),
          status: 'READY',
          virusScanStatus: 'SKIPPED',
          storageKey: `fx/${foreignMedia}`,
          uploadedBy: foreignActor,
        },
      });
    });
    await expect(
      derm().attachDermatologyPhoto({
        encounterId: encounter.id,
        mediaAssetId: foreignMedia,
        actorId,
        actorRoles: ['doctor'],
      }),
    ).rejects.toThrow();
  });

  it('R2-DERM-T4: appointment patient mismatch on derm open → reject', async () => {
    const otherPatient = randomUUID();
    const apptId = randomUUID();
    await wrapper.withPlatformBypass(async (c) => {
      await c.patient.create({
        data: { id: otherPatient, tenantId, firstName: 'O', lastName: 'P' },
      });
      await c.appointment.create({
        data: {
          id: apptId,
          tenantId,
          patientId: otherPatient,
          providerId,
          scheduledStart: new Date('2026-10-01T10:00:00.000Z'),
          scheduledEnd: new Date('2026-10-01T11:00:00.000Z'),
          status: 'CONFIRMED',
          clinicalServiceId: dermServiceId,
          branchId,
        },
      });
    });
    await expect(
      derm().openDermatologyEncounter({
        patientId,
        clinicianId: providerId,
        clinicalServiceId: dermServiceId,
        appointmentId: apptId,
        branchId,
        actorId,
        actorRoles: ['doctor'],
      }),
    ).rejects.toThrow(/patient/);
  });
});
