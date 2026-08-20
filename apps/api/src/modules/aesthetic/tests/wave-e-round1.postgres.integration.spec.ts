/**
 * Wave E Round 1 — E1–E5 remediation proofs with real services (no mocks).
 */
import { randomUUID } from 'crypto';
import { BadRequestException } from '@nestjs/common';
import {
  ClinicalPriceVersionStatus,
  ClinicalPricingUnit,
  type PrismaClient,
} from '@prisma/client';
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

describeDb('Wave E Round 1 remediation (PostgreSQL, real services)', () => {
  let raw: PrismaClient;
  let wrapper: ReturnType<typeof createClinicalPrismaWrapper>;
  let tenantId: string;
  let otherTenantId: string;
  let actorId: string;
  let foreignActorId: string;
  let providerId: string;
  let patientId: string;
  let otherPatientId: string;
  let branchId: string;
  let otherBranchId: string;
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
    foreignActorId = randomUUID();
    providerId = randomUUID();
    patientId = randomUUID();
    otherPatientId = randomUUID();
    branchId = randomUUID();
    otherBranchId = randomUUID();
    clinicalServiceId = randomUUID();
    dermServiceId = randomUUID();
    nonDermServiceId = randomUUID();

    await wrapper.withPlatformBypass(async (c) => {
      await c.tenant.create({
        data: { id: tenantId, name: 'WE R1', slug: `wer1-${tenantId.slice(0, 8)}` },
      });
      await c.tenant.create({
        data: { id: otherTenantId, name: 'WE R1 O', slug: `wer1o-${otherTenantId.slice(0, 8)}` },
      });
      await c.user.create({
        data: {
          id: actorId,
          tenantId,
          email: `wer1-${actorId.slice(0, 8)}@t.local`,
          passwordHash: 'x',
          firstName: 'A',
          lastName: 'Ctor',
        },
      });
      await c.user.create({
        data: {
          id: foreignActorId,
          tenantId: otherTenantId,
          email: `wer1f-${foreignActorId.slice(0, 8)}@t.local`,
          passwordHash: 'x',
          firstName: 'F',
          lastName: 'Actor',
        },
      });
      await c.user.create({
        data: {
          id: providerId,
          tenantId,
          email: `wer1-${providerId.slice(0, 8)}@t.local`,
          passwordHash: 'x',
          firstName: 'P',
          lastName: 'Rovider',
        },
      });
      await c.patient.create({
        data: { id: patientId, tenantId, firstName: 'Pat', lastName: 'Aes' },
      });
      await c.patient.create({
        data: { id: otherPatientId, tenantId: otherTenantId, firstName: 'Other', lastName: 'Pat' },
      });
      await c.branch.create({
        data: { id: branchId, tenantId, name: `Branch ${branchId.slice(0, 6)}` },
      });
      await c.branch.create({
        data: { id: otherBranchId, tenantId, name: `Other Branch ${otherBranchId.slice(0, 6)}` },
      });
      await c.canonicalClinicalServiceDefinition.create({
        data: {
          id: clinicalServiceId,
          tenantId,
          provenance: 'TENANT_CUSTOM',
          stableKey: `tenant.${tenantId}.custom.aes-${clinicalServiceId.slice(0, 8)}`,
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
          stableKey: `tenant.${tenantId}.custom.noderm-${nonDermServiceId.slice(0, 8)}`,
          domain: 'AESTHETIC',
          categoryKey: 'general_aesthetic',
          lifecycle: 'PUBLISHED',
        },
      });
    });
  });

  async function createAppointment(params: {
    id?: string;
    start?: Date;
    end?: Date;
    serviceId?: string;
    apptBranchId?: string;
    apptPatientId?: string;
  }) {
    const id = params.id ?? randomUUID();
    const start = params.start ?? new Date('2026-09-01T10:00:00.000Z');
    const end = params.end ?? new Date('2026-09-01T11:00:00.000Z');
    await wrapper.withPlatformBypass((c) =>
      c.appointment.create({
        data: {
          id,
          tenantId,
          branchId: params.apptBranchId ?? branchId,
          patientId: params.apptPatientId ?? patientId,
          providerId,
          scheduledStart: start,
          scheduledEnd: end,
          status: 'CONFIRMED',
          clinicalServiceId: params.serviceId ?? clinicalServiceId,
        },
      }),
    );
    return id;
  }

  async function createActiveCoursePrice(unit: ClinicalPricingUnit) {
    return wrapper.withPlatformBypass((c) =>
      c.clinicalServicePriceVersion.create({
        data: {
          id: randomUUID(),
          tenantId,
          branchId: null,
          clinicalServiceId,
          pricingUnit: unit,
          currency: 'SYP',
          unitPrice: 500,
          taxPercent: 0,
          effectiveFrom: new Date('2026-01-01T00:00:00.000Z'),
          status: ClinicalPriceVersionStatus.ACTIVE,
          publishedAt: new Date('2026-09-01T00:00:00.000Z'),
          publishedBy: actorId,
        },
      }),
    );
  }

  // --- E1: course intervals ---
  it('E1: first session link skips interval enforcement', async () => {
    const course = await courses().create({
      patientId,
      clinicalServiceId,
      plannedSessions: 2,
      intervalMinDays: 14,
      intervalMaxDays: 21,
      actorId,
      actorRoles: ['doctor'],
    });
    await courses().transition({ id: course.id, toStatus: 'ACTIVE', actorId, actorRoles: ['doctor'] });
    const appt1 = await createAppointment({
      start: new Date('2026-09-01T10:00:00.000Z'),
      end: new Date('2026-09-01T11:00:00.000Z'),
    });
    const linked = await courses().linkSessionAppointment({
      courseId: course.id,
      sessionId: course.sessions[0].id,
      appointmentId: appt1,
      actorId,
      actorRoles: ['doctor'],
    });
    expect(linked.status).toBe('BOOKED');
  });

  it('E1: rejects session link below intervalMinDays', async () => {
    const course = await courses().create({
      patientId,
      clinicalServiceId,
      plannedSessions: 2,
      intervalMinDays: 14,
      intervalMaxDays: 30,
      actorId,
      actorRoles: ['doctor'],
    });
    await courses().transition({ id: course.id, toStatus: 'ACTIVE', actorId, actorRoles: ['doctor'] });
    const appt1 = await createAppointment({
      start: new Date('2026-09-01T10:00:00.000Z'),
      end: new Date('2026-09-01T11:00:00.000Z'),
    });
    await courses().linkSessionAppointment({
      courseId: course.id,
      sessionId: course.sessions[0].id,
      appointmentId: appt1,
      actorId,
      actorRoles: ['doctor'],
    });
    const appt2 = await createAppointment({
      start: new Date('2026-09-05T10:00:00.000Z'),
      end: new Date('2026-09-05T11:00:00.000Z'),
    });
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

  it('E1: rejects session link above intervalMaxDays', async () => {
    const course = await courses().create({
      patientId,
      clinicalServiceId,
      plannedSessions: 2,
      intervalMinDays: 7,
      intervalMaxDays: 10,
      actorId,
      actorRoles: ['doctor'],
    });
    await courses().transition({ id: course.id, toStatus: 'ACTIVE', actorId, actorRoles: ['doctor'] });
    const appt1 = await createAppointment({
      start: new Date('2026-09-01T10:00:00.000Z'),
      end: new Date('2026-09-01T11:00:00.000Z'),
    });
    await courses().linkSessionAppointment({
      courseId: course.id,
      sessionId: course.sessions[0].id,
      appointmentId: appt1,
      actorId,
      actorRoles: ['doctor'],
    });
    const appt2 = await createAppointment({
      start: new Date('2026-09-20T10:00:00.000Z'),
      end: new Date('2026-09-20T11:00:00.000Z'),
    });
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

  // --- E2: device type / encounter / beauty annotation ---
  it('E2: rejects device type ↔ schema key mismatch', async () => {
    await expect(
      devices().create({
        deviceType: 'laser',
        clinicalServiceId,
        parameterSchemaKey: 'ipl.generic.v1',
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

  it('E2: accepts opaque external deviceId string', async () => {
    const row = await devices().create({
      deviceType: 'laser',
      deviceId: 'EXT-DEVICE-001',
      clinicalServiceId,
      parameterSchemaKey: 'laser.generic.v1',
      patientId,
      providerId,
      actorId,
      actorRoles: ['doctor'],
    });
    expect(row.deviceId).toBe('EXT-DEVICE-001');
  });

  it('E2: rejects encounter branch mismatch', async () => {
    const encounterId = randomUUID();
    await wrapper.withPlatformBypass((c) =>
      c.encounter.create({
        data: {
          id: encounterId,
          tenantId,
          patientId,
          clinicianId: providerId,
          branchId: otherBranchId,
          diagnoses: [],
          medications: [],
          observations: [],
          soapNotes: {},
          structuredNotes: [],
        },
      }),
    );
    await expect(
      devices().create({
        deviceType: 'rf',
        clinicalServiceId,
        parameterSchemaKey: 'rf.generic.v1',
        patientId,
        providerId,
        branchId,
        encounterId,
        actorId,
        actorRoles: ['doctor'],
      }),
    ).rejects.toThrow(/encounterId branch does not match branchId/);
  });

  it('E2: rejects beauty annotation patient mismatch', async () => {
    const beautyRecordId = randomUUID();
    const annotationId = randomUUID();
    const otherLocalPatient = randomUUID();
    await wrapper.withPlatformBypass(async (c) => {
      await c.patient.create({
        data: { id: otherLocalPatient, tenantId, firstName: 'B', lastName: 'Other' },
      });
      await c.beautyRecord.create({
        data: { id: beautyRecordId, tenantId, patientId: otherLocalPatient, bodyMapState: {} },
      });
      await c.beautyAnnotation.create({
        data: {
          id: annotationId,
          tenantId,
          beautyRecordId,
          zone: 'forehead',
          treatment: 'botox',
          coordinates: { x: 0.5, y: 0.5, view: 'front' },
          recordedBy: actorId,
        },
      });
    });
    await expect(
      devices().create({
        deviceType: 'laser',
        clinicalServiceId,
        parameterSchemaKey: 'laser.generic.v1',
        patientId,
        providerId,
        beautyAnnotationId: annotationId,
        actorId,
        actorRoles: ['doctor'],
      }),
    ).rejects.toThrow(/beautyAnnotationId patient does not match patientId/);
  });

  // --- E3: dermatology ---
  it('E3: rejects non-dermatology categoryKey for dermatology encounter', async () => {
    await expect(
      derm().openDermatologyEncounter({
        patientId,
        clinicianId: providerId,
        clinicalServiceId: nonDermServiceId,
        actorId,
        actorRoles: ['doctor'],
      }),
    ).rejects.toThrow(/categoryKey 'dermatology'/);
  });

  it('E3: rejects appointment clinicalServiceId mismatch', async () => {
    const appt = await createAppointment({ serviceId: clinicalServiceId });
    await expect(
      derm().openDermatologyEncounter({
        patientId,
        clinicianId: providerId,
        clinicalServiceId: dermServiceId,
        appointmentId: appt,
        branchId,
        actorId,
        actorRoles: ['doctor'],
      }),
    ).rejects.toThrow(/clinicalServiceId does not match dermatology clinicalServiceId/);
  });

  it('E3: rejects appointment branch mismatch', async () => {
    const appt = await createAppointment({ serviceId: dermServiceId, apptBranchId: otherBranchId });
    await expect(
      derm().openDermatologyEncounter({
        patientId,
        clinicianId: providerId,
        clinicalServiceId: dermServiceId,
        appointmentId: appt,
        branchId,
        actorId,
        actorRoles: ['doctor'],
      }),
    ).rejects.toThrow(/appointmentId branch does not match branchId/);
  });

  it('E3: attachDermatologyPhoto creates MediaAsset bound to encounter', async () => {
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
      sizeBytes: 1024,
      actorId,
      actorRoles: ['doctor'],
    });
    expect(result.media.ownerType).toBe('encounter');
    expect(result.media.ownerId).toBe(encounter.id);
    expect(result.media.patientId).toBe(patientId);
    const fromDb = await wrapper.withPlatformBypass((c) =>
      c.mediaAsset.findFirst({ where: { id: result.media.id, tenantId } }),
    );
    expect(fromDb).toBeTruthy();
    expect(auditCalls.some((c) => c.action === 'dermatology.photo.attach')).toBe(true);
  });

  // --- E4/E5: accountability triggers ---
  it('E5: mixed-tenant createdBy insert rejected by accountability trigger', async () => {
    await expect(
      wrapper.withPlatformBypass((c) =>
        c.treatmentCourse.create({
          data: {
            id: randomUUID(),
            tenantId,
            patientId,
            clinicalServiceId,
            plannedSessions: 1,
            createdBy: foreignActorId,
          },
        }),
      ),
    ).rejects.toThrow(/tenantId must match createdBy\.tenantId/);
  });

  it('E5: mixed-tenant recordedBy insert rejected by accountability trigger', async () => {
    await expect(
      wrapper.withPlatformBypass((c) =>
        c.deviceTreatmentRecord.create({
          data: {
            id: randomUUID(),
            tenantId,
            deviceType: 'laser',
            clinicalServiceId,
            parameterSchemaKey: 'laser.generic.v1',
            parameterPayload: {},
            patientId,
            providerId: actorId,
            recordedBy: foreignActorId,
          },
        }),
      ),
    ).rejects.toThrow(/tenantId must match recordedBy\.tenantId/);
  });

  it('E5: mixed-tenant correctedBy on update rejected by accountability trigger', async () => {
    const row = await devices().create({
      deviceType: 'ipl',
      clinicalServiceId,
      parameterSchemaKey: 'ipl.generic.v1',
      patientId,
      providerId,
      actorId,
      actorRoles: ['doctor'],
    });
    await expect(
      wrapper.withPlatformBypass((c) =>
        c.deviceTreatmentRecord.update({
          where: { id: row.id },
          data: { correctedBy: foreignActorId, correctionReason: 'bad actor' },
        }),
      ),
    ).rejects.toThrow(/tenantId must match correctedBy\.tenantId/);
  });

  it('E5: parent-switch UPDATE createdBy rejected', async () => {
    const course = await courses().create({
      patientId,
      clinicalServiceId,
      plannedSessions: 1,
      actorId,
      actorRoles: ['doctor'],
    });
    await expect(
      wrapper.withPlatformBypass((c) =>
        c.treatmentCourse.update({
          where: { id: course.id },
          data: { createdBy: foreignActorId },
        }),
      ),
    ).rejects.toThrow(/tenantId must match createdBy\.tenantId/);
  });

  // --- Pre/post care create + assert ---
  it('PrePostCare createInstance + assertInstanceKind round-trip', async () => {
    const templateId = randomUUID();
    const versionId = randomUUID();
    await wrapper.withPlatformBypass(async (c) => {
      await c.clinicalFormTemplate.create({
        data: {
          id: templateId,
          tenantId,
          kind: 'PRE_CARE',
          stableKey: `r1-pre-${templateId.slice(0, 8)}`,
          status: 'ACTIVE',
          nameEn: 'Pre care',
          nameAr: 'pre',
          createdByUserId: actorId,
        },
      });
      await c.clinicalFormVersion.create({
        data: {
          id: versionId,
          templateId,
          version: 1,
          status: 'PUBLISHED',
          contentEn: '{}',
          contentAr: '{}',
          publishedAt: new Date(),
          publishedByUserId: actorId,
        },
      });
    });
    const created = await prePost().createInstance({
      kind: 'PRE_CARE',
      patientId,
      clinicalServiceId,
      actorId,
      actorRoles: ['doctor'],
    });
    expect(created.kind).toBe('PRE_CARE');
    expect(created.versionId).toBe(versionId);
    const asserted = await prePost().assertInstanceKind({
      instanceId: created.id,
      expectedKind: 'PRE_CARE',
      actorId,
      actorRoles: ['doctor'],
    });
    expect(asserted.kind).toBe('PRE_CARE');
    expect(auditCalls.some((c) => c.action === 'pre_post_care.instance.create')).toBe(true);
    expect(auditCalls.some((c) => c.action === 'pre_post_care.assert')).toBe(true);
  });

  it('TreatmentCourse with packagePriceVersionId PER_COURSE persists', async () => {
    const price = await createActiveCoursePrice(ClinicalPricingUnit.PER_COURSE);
    const course = await courses().create({
      patientId,
      clinicalServiceId,
      plannedSessions: 2,
      packagePriceVersionId: price.id,
      actorId,
      actorRoles: ['doctor'],
    });
    expect(course.packagePriceVersionId).toBe(price.id);
    const fromDb = await wrapper.withPlatformBypass((c) =>
      c.treatmentCourse.findUniqueOrThrow({ where: { id: course.id } }),
    );
    expect(fromDb.packagePriceVersionId).toBe(price.id);
  });
});
