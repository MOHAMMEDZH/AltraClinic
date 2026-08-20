/**
 * Wave E Round 3 — R3-B2 zero-day intervals, R3-B3 PRE/POST platform pack.
 * Real services + PostgreSQL (no mocks). Same harness pattern as wave-e-round2.
 */
import { randomUUID } from 'crypto';
import type { PrismaClient } from '@prisma/client';
import {
  createClinicalPrismaWrapper,
  createPlatformDbSecurityClient,
  platformDbSecurityEnabled,
} from '../../clinical-catalog/tests/clinical-catalog-db.harness';
import { TreatmentCourseService } from '../services/treatment-course.service';
import { PrePostCareService } from '../services/pre-post-care.service';
import { assertCourseIntervalsForReschedule } from '../services/wave-e-reference.validation';

jest.setTimeout(180_000);
const describeDb = platformDbSecurityEnabled() ? describe : describe.skip;

describeDb('Wave E Round 3 remediation (PostgreSQL, real services)', () => {
  let raw: PrismaClient;
  let wrapper: ReturnType<typeof createClinicalPrismaWrapper>;
  let tenantId: string;
  let otherTenantId: string;
  let actorId: string;
  let providerId: string;
  let patientId: string;
  let branchId: string;
  let clinicalServiceId: string;
  const auditCalls: Array<Record<string, unknown>> = [];
  /** Platform pack template ids created in this suite — cleaned so Round 2 isolation holds. */
  const platformTemplateIds: string[] = [];

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

  async function seedTenantForm(kind: 'PRE_CARE' | 'POST_CARE', opts?: { status?: string }) {
    const templateId = randomUUID();
    const versionId = randomUUID();
    await wrapper.withPlatformBypass(async (c) => {
      await c.clinicalFormTemplate.create({
        data: {
          id: templateId,
          tenantId,
          kind,
          stableKey: `wave-e-r3-${kind.toLowerCase()}-${templateId.slice(0, 8)}`,
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

  async function seedPlatformForm(
    kind: 'PRE_CARE' | 'POST_CARE',
    opts?: { status?: string },
  ) {
    const templateId = randomUUID();
    const versionId = randomUUID();
    platformTemplateIds.push(templateId);
    await wrapper.withPlatformBypass(async (c) => {
      await c.clinicalFormTemplate.create({
        data: {
          id: templateId,
          tenantId: null,
          kind,
          stableKey: `platform-r3-${kind.toLowerCase()}-${templateId.slice(0, 8)}`,
          status: 'ACTIVE',
          nameEn: `Platform ${kind}`,
          nameAr: kind,
          createdByUserId: null,
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
          publishedByUserId: opts?.status === 'DRAFT' ? null : null,
        },
      });
    });
    return { templateId, versionId };
  }

  async function neutralizePlatformPacks(ids?: string[]) {
    await wrapper.withPlatformBypass(async (c) => {
      if (ids && ids.length > 0) {
        await c.clinicalFormTemplate.updateMany({
          where: { id: { in: ids }, tenantId: null },
          data: { status: 'INACTIVE' },
        });
        return;
      }
      await c.clinicalFormTemplate.updateMany({
        where: {
          tenantId: null,
          kind: { in: ['PRE_CARE', 'POST_CARE'] },
          status: 'ACTIVE',
        },
        data: { status: 'INACTIVE' },
      });
    });
  }

  async function cleanupPlatformPacks() {
    if (platformTemplateIds.length === 0) return;
    const ids = [...platformTemplateIds];
    platformTemplateIds.length = 0;
    // Published ClinicalFormVersion rows are append-only — inactivate templates instead of DELETE.
    await neutralizePlatformPacks(ids);
  }

  beforeAll(async () => {
    raw = await createPlatformDbSecurityClient();
    wrapper = createClinicalPrismaWrapper(raw);
  });

  afterAll(async () => {
    await cleanupPlatformPacks().catch(() => undefined);
    await raw.$disconnect();
  });

  beforeEach(async () => {
    auditCalls.length = 0;
    await cleanupPlatformPacks();
    // Ensure leftover platform packs from prior suites cannot leak into isolation cases.
    await neutralizePlatformPacks();
    tenantId = randomUUID();
    otherTenantId = randomUUID();
    actorId = randomUUID();
    providerId = randomUUID();
    patientId = randomUUID();
    branchId = randomUUID();
    clinicalServiceId = randomUUID();

    await wrapper.withPlatformBypass(async (c) => {
      await c.tenant.create({
        data: { id: tenantId, name: 'WE R3', slug: `wer3-${tenantId.slice(0, 8)}` },
      });
      await c.tenant.create({
        data: {
          id: otherTenantId,
          name: 'WE R3 Other',
          slug: `wer3o-${otherTenantId.slice(0, 8)}`,
        },
      });
      await c.user.create({
        data: {
          id: actorId,
          tenantId,
          email: `wer3-${actorId.slice(0, 8)}@t.local`,
          passwordHash: 'x',
          firstName: 'A',
          lastName: 'R3',
          roles: { create: [{ role: 'DOCTOR' }] },
        },
      });
      await c.user.create({
        data: {
          id: providerId,
          tenantId,
          email: `wer3p-${providerId.slice(0, 8)}@t.local`,
          passwordHash: 'x',
          firstName: 'P',
          lastName: 'Rov',
          roles: { create: [{ role: 'DOCTOR' }] },
        },
      });
      await c.patient.create({
        data: { id: patientId, tenantId, firstName: 'Pat', lastName: 'R3' },
      });
      await c.branch.create({
        data: { id: branchId, tenantId, name: 'Branch R3' },
      });
      await c.canonicalClinicalServiceDefinition.create({
        data: {
          id: clinicalServiceId,
          tenantId,
          provenance: 'TENANT_CUSTOM',
          stableKey: `tenant.${tenantId}.custom.r3-${clinicalServiceId.slice(0, 8)}`,
          domain: 'AESTHETIC',
          lifecycle: 'PUBLISHED',
        },
      });
    });
  });

  afterEach(async () => {
    await cleanupPlatformPacks();
  });

  // --- R3-B2 zero-day intervals ---

  it('R3-B2-T1: min=0 max=0 same UTC day later timestamp → success', async () => {
    const course = await activeCourse(0, 0, 2);
    const appt1 = await createAppointment(new Date('2026-08-20T10:00:00.000Z'));
    await courses().linkSessionAppointment({
      courseId: course.id,
      sessionId: course.sessions[0].id,
      appointmentId: appt1,
      actorId,
      actorRoles: ['doctor'],
    });
    const appt2 = await createAppointment(new Date('2026-08-20T16:00:00.000Z'));
    const linked = await courses().linkSessionAppointment({
      courseId: course.id,
      sessionId: course.sessions[1].id,
      appointmentId: appt2,
      actorId,
      actorRoles: ['doctor'],
    });
    expect(linked.status).toBe('BOOKED');
  });

  it('R3-B2-T2: min=0 same exact timestamp → reject', async () => {
    const course = await activeCourse(0, 1, 2);
    const ts = new Date('2026-08-20T10:00:00.000Z');
    const appt1 = await createAppointment(ts);
    await courses().linkSessionAppointment({
      courseId: course.id,
      sessionId: course.sessions[0].id,
      appointmentId: appt1,
      actorId,
      actorRoles: ['doctor'],
    });
    const appt2 = await createAppointment(new Date(ts.getTime()));
    await expect(
      courses().linkSessionAppointment({
        courseId: course.id,
        sessionId: course.sessions[1].id,
        appointmentId: appt2,
        actorId,
        actorRoles: ['doctor'],
      }),
    ).rejects.toThrow(/strictly after/);
  });

  it('R3-B2-T3: min=0 Session 2 earlier timestamp → reject', async () => {
    const course = await activeCourse(0, 1, 2);
    const appt1 = await createAppointment(new Date('2026-08-20T16:00:00.000Z'));
    await courses().linkSessionAppointment({
      courseId: course.id,
      sessionId: course.sessions[0].id,
      appointmentId: appt1,
      actorId,
      actorRoles: ['doctor'],
    });
    const appt2 = await createAppointment(new Date('2026-08-20T10:00:00.000Z'));
    await expect(
      courses().linkSessionAppointment({
        courseId: course.id,
        sessionId: course.sessions[1].id,
        appointmentId: appt2,
        actorId,
        actorRoles: ['doctor'],
      }),
    ).rejects.toThrow(/strictly after/);
  });

  it('R3-B2-T4: min=1 same UTC day later time → reject on intervalMinDays', async () => {
    const course = await activeCourse(1, 14, 2);
    const appt1 = await createAppointment(new Date('2026-08-20T10:00:00.000Z'));
    await courses().linkSessionAppointment({
      courseId: course.id,
      sessionId: course.sessions[0].id,
      appointmentId: appt1,
      actorId,
      actorRoles: ['doctor'],
    });
    const appt2 = await createAppointment(new Date('2026-08-20T16:00:00.000Z'));
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

  it('R3-B2-T5: min=0 max=1 same-day later timestamp → success', async () => {
    const course = await activeCourse(0, 1, 2);
    const appt1 = await createAppointment(new Date('2026-08-20T10:00:00.000Z'));
    await courses().linkSessionAppointment({
      courseId: course.id,
      sessionId: course.sessions[0].id,
      appointmentId: appt1,
      actorId,
      actorRoles: ['doctor'],
    });
    const appt2 = await createAppointment(new Date('2026-08-20T16:00:00.000Z'));
    const linked = await courses().linkSessionAppointment({
      courseId: course.id,
      sessionId: course.sessions[1].id,
      appointmentId: appt2,
      actorId,
      actorRoles: ['doctor'],
    });
    expect(linked.status).toBe('BOOKED');
  });

  it('R3-B2-T6: next-neighbor same-day chronology valid → success', async () => {
    const course = await activeCourse(0, 1, 3);
    const appt1 = await createAppointment(new Date('2026-08-20T08:00:00.000Z'));
    const appt3 = await createAppointment(new Date('2026-08-20T18:00:00.000Z'));
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
    const appt2 = await createAppointment(new Date('2026-08-20T12:00:00.000Z'));
    const linked = await courses().linkSessionAppointment({
      courseId: course.id,
      sessionId: course.sessions[1].id,
      appointmentId: appt2,
      actorId,
      actorRoles: ['doctor'],
    });
    expect(linked.status).toBe('BOOKED');
  });

  it('R3-B2-T7: out-of-order current timestamp violates next chronology → reject', async () => {
    const course = await activeCourse(0, 1, 3);
    const appt1 = await createAppointment(new Date('2026-08-20T08:00:00.000Z'));
    const appt3 = await createAppointment(new Date('2026-08-20T12:00:00.000Z'));
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
    // Same day but after next neighbor → fails next chronology
    const appt2 = await createAppointment(new Date('2026-08-20T14:00:00.000Z'));
    await expect(
      courses().linkSessionAppointment({
        courseId: course.id,
        sessionId: course.sessions[1].id,
        appointmentId: appt2,
        actorId,
        actorRoles: ['doctor'],
      }),
    ).rejects.toThrow(/strictly before next sequence/);
  });

  it('R3-B2-T8: reschedule to later same-day timestamp with min=0 → success', async () => {
    const course = await activeCourse(0, 1, 2);
    const appt1 = await createAppointment(new Date('2026-08-20T10:00:00.000Z'));
    const appt2 = await createAppointment(new Date('2026-08-20T12:00:00.000Z'));
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
    await expect(
      wrapper.withPlatformBypass((tx) =>
        assertCourseIntervalsForReschedule(
          tx,
          tenantId,
          appt2,
          new Date('2026-08-20T16:00:00.000Z'),
        ),
      ),
    ).resolves.toBeUndefined();
  });

  it('R3-B2-T9/T10: reschedule equal/earlier rejects; original state unchanged', async () => {
    const course = await activeCourse(0, 1, 2);
    const appt1 = await createAppointment(new Date('2026-08-20T10:00:00.000Z'));
    const appt2 = await createAppointment(new Date('2026-08-20T14:00:00.000Z'));
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

    const original = await wrapper.withPlatformBypass((c) =>
      c.appointment.findUniqueOrThrow({ where: { id: appt2 } }),
    );
    const sessionBefore = await wrapper.withPlatformBypass((c) =>
      c.courseSession.findFirstOrThrow({
        where: { id: course.sessions[1].id, tenantId },
      }),
    );

    await expect(
      wrapper.withPlatformBypass((tx) =>
        assertCourseIntervalsForReschedule(
          tx,
          tenantId,
          appt2,
          new Date('2026-08-20T10:00:00.000Z'),
        ),
      ),
    ).rejects.toThrow(/strictly after/);

    await expect(
      wrapper.withPlatformBypass((tx) =>
        assertCourseIntervalsForReschedule(
          tx,
          tenantId,
          appt2,
          new Date('2026-08-20T09:00:00.000Z'),
        ),
      ),
    ).rejects.toThrow(/strictly after/);

    const after = await wrapper.withPlatformBypass(async (c) => ({
      appt: await c.appointment.findUniqueOrThrow({ where: { id: appt2 } }),
      session: await c.courseSession.findFirstOrThrow({
        where: { id: course.sessions[1].id, tenantId },
      }),
    }));
    expect(after.appt.scheduledStart.toISOString()).toBe(original.scheduledStart.toISOString());
    expect(after.session.appointmentId).toBe(sessionBefore.appointmentId);
  });

  // --- R3-B3 PRE/POST platform pack ---

  it('R3-B3-T1: tenant-owned PUBLISHED PRE_CARE → success', async () => {
    const { versionId, templateId } = await seedTenantForm('PRE_CARE');
    const created = await prePost().createInstance({
      kind: 'PRE_CARE',
      patientId,
      actorId,
      actorRoles: ['doctor'],
    });
    expect(created.versionId).toBe(versionId);
    expect(created.templateId).toBe(templateId);
  });

  it('R3-B3-T2: tenant-owned PUBLISHED POST_CARE → success', async () => {
    const { versionId } = await seedTenantForm('POST_CARE');
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

  it('R3-B3-T3/T5/T9/T10/T11: platform-pack PRE_CARE → success; exact version; no mutations', async () => {
    const { templateId, versionId } = await seedPlatformForm('PRE_CARE');
    const before = await wrapper.withPlatformBypass(async (c) => ({
      templates: await c.clinicalFormTemplate.count({
        where: { OR: [{ tenantId }, { tenantId: null }] },
      }),
      versions: await c.clinicalFormVersion.count({
        where: { template: { OR: [{ tenantId }, { tenantId: null }] } },
      }),
      platformTemplates: await c.clinicalFormTemplate.findMany({
        where: { id: templateId },
      }),
      platformVersions: await c.clinicalFormVersion.findMany({
        where: { templateId },
      }),
    }));

    const created = await prePost().createInstance({
      kind: 'PRE_CARE',
      patientId,
      actorId,
      actorRoles: ['doctor'],
    });
    expect(created.versionId).toBe(versionId);
    expect(created.templateId).toBe(templateId);

    const after = await wrapper.withPlatformBypass(async (c) => ({
      templates: await c.clinicalFormTemplate.count({
        where: { OR: [{ tenantId }, { tenantId: null }] },
      }),
      versions: await c.clinicalFormVersion.count({
        where: { template: { OR: [{ tenantId }, { tenantId: null }] } },
      }),
      platformTemplates: await c.clinicalFormTemplate.findMany({
        where: { id: templateId },
      }),
      platformVersions: await c.clinicalFormVersion.findMany({
        where: { templateId },
      }),
      instance: await c.patientFormInstance.findUniqueOrThrow({ where: { id: created.id } }),
    }));
    expect(after.templates).toBe(before.templates);
    expect(after.versions).toBe(before.versions);
    expect(after.instance.versionId).toBe(versionId);
    expect(after.platformTemplates[0]?.status).toBe(before.platformTemplates[0]?.status);
    expect(after.platformVersions[0]?.status).toBe(before.platformVersions[0]?.status);
    expect(after.platformVersions[0]?.version).toBe(before.platformVersions[0]?.version);
  });

  it('R3-B3-T4: platform-pack PUBLISHED POST_CARE → success', async () => {
    const { versionId, templateId } = await seedPlatformForm('POST_CARE');
    const created = await prePost().createInstance({
      kind: 'POST_CARE',
      patientId,
      actorId,
      actorRoles: ['doctor'],
    });
    expect(created.versionId).toBe(versionId);
    expect(created.templateId).toBe(templateId);
  });

  it('R3-B3-T6: another tenant PRE/POST version → reject', async () => {
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
          stableKey: `fx-r3-pre-${foreignTemplate.slice(0, 8)}`,
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
    ).rejects.toThrow(/not visible to the current tenant/);
  });

  it('R3-B3-T7: platform-pack DRAFT → reject', async () => {
    const { versionId } = await seedPlatformForm('PRE_CARE', { status: 'DRAFT' });
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

  it('R3-B3-T8: wrong kind → reject', async () => {
    const { versionId } = await seedPlatformForm('POST_CARE');
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

  it('R3-B3-T12: tenant-owned + platform-pack → tenant precedence', async () => {
    const platform = await seedPlatformForm('PRE_CARE');
    const tenant = await seedTenantForm('PRE_CARE');
    const created = await prePost().createInstance({
      kind: 'PRE_CARE',
      patientId,
      actorId,
      actorRoles: ['doctor'],
    });
    expect(created.versionId).toBe(tenant.versionId);
    expect(created.templateId).toBe(tenant.templateId);
    expect(created.versionId).not.toBe(platform.versionId);
  });

  it('R3-B3: explicit platform versionId binds when tenant form also exists', async () => {
    await seedTenantForm('PRE_CARE');
    const platform = await seedPlatformForm('PRE_CARE');
    const created = await prePost().createInstance({
      kind: 'PRE_CARE',
      patientId,
      versionId: platform.versionId,
      actorId,
      actorRoles: ['doctor'],
    });
    expect(created.versionId).toBe(platform.versionId);
    expect(created.templateId).toBe(platform.templateId);
  });

  it('R3-B3: no published tenant or platform PRE_CARE → reject', async () => {
    await expect(
      prePost().createInstance({
        kind: 'PRE_CARE',
        patientId,
        actorId,
        actorRoles: ['doctor'],
      }),
    ).rejects.toThrow(/No PUBLISHED PRE_CARE/);
  });
});
