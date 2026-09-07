/**
 * Wave E production-path HTTP — real Nest controller + real services + Prisma wrapper.
 * Proves durable DB effects for TreatmentCourse, CourseSession, DeviceTreatment,
 * Dermatology + photo, and PRE/POST care via HTTP (no mocked domain services).
 */
import 'reflect-metadata';
import {
  CanActivate,
  ExecutionContext,
  INestApplication,
  Injectable,
  UnauthorizedException,
  ValidationPipe,
} from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import { AddressInfo } from 'net';
import { randomUUID } from 'crypto';
import type { PrismaClient } from '@prisma/client';
import { PermissionGuard } from '../../auth/api/guards/permission.guard';
import { JwtClaimsVO } from '../../auth/domain/value-objects/jwt-claims.vo';
import { PrismaService } from '../../../infrastructure/prisma.service';
import { TenantContextService } from '../../../infrastructure/tenant-context.service';
import { LicensedModuleGuard } from '../../subscription/api/guards/licensed-module.guard';
import {
  createClinicalPrismaWrapper,
  createPlatformDbSecurityClient,
  platformDbSecurityEnabled,
} from '../../clinical-catalog/tests/clinical-catalog-db.harness';
import { AestheticWaveEController } from '../api/aesthetic-wave-e.controller';
import { TreatmentCourseService } from '../services/treatment-course.service';
import { DeviceTreatmentRecordService } from '../services/device-treatment-record.service';
import { DermatologyEncounterService } from '../services/dermatology-encounter.service';
import { PrePostCareService } from '../services/pre-post-care.service';
import { WAVE_E_AUDIT_LOG } from '../ports/wave-e-audit-log.port';

jest.setTimeout(180_000);
const describeDb = platformDbSecurityEnabled() ? describe : describe.skip;

@Injectable()
class TestClinicAuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<{
      headers: Record<string, string | undefined>;
      user?: JwtClaimsVO;
    }>();
    const raw = req.headers['x-test-principal'];
    if (!raw) throw new UnauthorizedException('Authentication required.');
    const parsed = JSON.parse(raw) as { sub: string; tenantId: string | null; roles: string[] };
    req.user = {
      sub: parsed.sub,
      userId: parsed.sub,
      tenantId: parsed.tenantId,
      roles: parsed.roles,
      isPlatformSession: () => false,
    } as unknown as JwtClaimsVO;
    return true;
  }
}

describeDb('Wave E production-path HTTP (real services, PostgreSQL)', () => {
  let prisma: PrismaClient;
  let app: INestApplication;
  let baseUrl: string;
  let tenantId: string;
  let otherTenantId: string;
  let actorId: string;
  let providerId: string;
  let otherActorId: string;
  let otherPatientId: string;
  let patientId: string;
  let branchId: string;
  let clinicalServiceId: string;
  let dermServiceId: string;
  let preCareTemplateId: string;
  let preCareVersionId: string;
  let postCareTemplateId: string;
  let postCareVersionId: string;
  const auditCalls: Array<Record<string, unknown>> = [];

  beforeAll(async () => {
    prisma = await createPlatformDbSecurityClient();
    tenantId = randomUUID();
    otherTenantId = randomUUID();
    actorId = randomUUID();
    providerId = randomUUID();
    otherActorId = randomUUID();
    otherPatientId = randomUUID();
    patientId = randomUUID();
    branchId = randomUUID();
    clinicalServiceId = randomUUID();
    dermServiceId = randomUUID();
    preCareTemplateId = randomUUID();
    preCareVersionId = randomUUID();
    postCareTemplateId = randomUUID();
    postCareVersionId = randomUUID();

    const wrapper = createClinicalPrismaWrapper(prisma);
    await wrapper.withPlatformBypass(async (c) => {
      await c.tenant.create({
        data: { id: tenantId, name: 'WE HTTP PP', slug: `we-pp-${tenantId.slice(0, 8)}` },
      });
      await c.tenant.create({
        data: {
          id: otherTenantId,
          name: 'WE HTTP PP Other',
          slug: `we-ppo-${otherTenantId.slice(0, 8)}`,
        },
      });
      await c.user.create({
        data: {
          id: actorId,
          tenantId,
          email: `we-pp-${actorId.slice(0, 8)}@t.local`,
          passwordHash: 'x',
          firstName: 'Doc',
          lastName: 'Tor',
          roles: { create: [{ role: 'DOCTOR' }] },
        },
      });
      await c.user.create({
        data: {
          id: providerId,
          tenantId,
          email: `we-pp-prov-${providerId.slice(0, 8)}@t.local`,
          passwordHash: 'x',
          firstName: 'Prov',
          lastName: 'Ider',
          roles: { create: [{ role: 'DOCTOR' }] },
        },
      });
      await c.user.create({
        data: {
          id: otherActorId,
          tenantId: otherTenantId,
          email: `we-ppo-${otherActorId.slice(0, 8)}@t.local`,
          passwordHash: 'x',
          firstName: 'Other',
          lastName: 'Doc',
          roles: { create: [{ role: 'DOCTOR' }] },
        },
      });
      await c.patient.create({
        data: { id: patientId, tenantId, firstName: 'Pat', lastName: 'PP' },
      });
      await c.patient.create({
        data: {
          id: otherPatientId,
          tenantId: otherTenantId,
          firstName: 'Other',
          lastName: 'Pat',
        },
      });
      await c.branch.create({
        data: { id: branchId, tenantId, name: 'WE PP Branch' },
      });
      await c.canonicalClinicalServiceDefinition.create({
        data: {
          id: clinicalServiceId,
          tenantId,
          provenance: 'TENANT_CUSTOM',
          stableKey: `tenant.${tenantId}.custom.pp-${clinicalServiceId.slice(0, 8)}`,
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

      // PUBLISHED PRE_CARE / POST_CARE — createInstance must not auto-create templates
      await c.clinicalFormTemplate.create({
        data: {
          id: preCareTemplateId,
          tenantId,
          kind: 'PRE_CARE',
          stableKey: `we-pp-pre-${preCareTemplateId.slice(0, 8)}`,
          status: 'ACTIVE',
          nameEn: 'PRE_CARE form',
          nameAr: 'PRE_CARE',
          createdByUserId: actorId,
        },
      });
      await c.clinicalFormVersion.create({
        data: {
          id: preCareVersionId,
          templateId: preCareTemplateId,
          version: 1,
          status: 'PUBLISHED',
          contentEn: '{}',
          contentAr: '{}',
          publishedAt: new Date(),
          publishedByUserId: actorId,
        },
      });
      await c.clinicalFormTemplate.create({
        data: {
          id: postCareTemplateId,
          tenantId,
          kind: 'POST_CARE',
          stableKey: `we-pp-post-${postCareTemplateId.slice(0, 8)}`,
          status: 'ACTIVE',
          nameEn: 'POST_CARE form',
          nameAr: 'POST_CARE',
          createdByUserId: actorId,
        },
      });
      await c.clinicalFormVersion.create({
        data: {
          id: postCareVersionId,
          templateId: postCareTemplateId,
          version: 1,
          status: 'PUBLISHED',
          contentEn: '{}',
          contentAr: '{}',
          publishedAt: new Date(),
          publishedByUserId: actorId,
        },
      });
    });

    const fakeAudit = {
      record: async (e: Record<string, unknown>) => {
        auditCalls.push({ ...e, via: 'record' });
      },
      recordInTransaction: async (_tx: unknown, e: Record<string, unknown>) => {
        auditCalls.push({ ...e, via: 'recordInTransaction' });
      },
    };

    const prismaForNest = {
      ...wrapper,
      userCustomRole: { findMany: async () => [] },
    };

    const moduleRef = await Test.createTestingModule({
      controllers: [AestheticWaveEController],
      providers: [
        PermissionGuard,
        { provide: APP_GUARD, useClass: TestClinicAuthGuard },
        { provide: APP_GUARD, useClass: PermissionGuard },
        { provide: PrismaService, useValue: prismaForNest },
        {
          provide: TenantContextService,
          useFactory: () => ({
            resolve: async () => {
              const store = (globalThis as { __weTenant?: string }).__weTenant;
              if (!store) throw new UnauthorizedException('Tenant context missing.');
              return { tenantId: store, branchId: null, locale: 'en' };
            },
          }),
        },
        { provide: WAVE_E_AUDIT_LOG, useValue: fakeAudit },
        TreatmentCourseService,
        DeviceTreatmentRecordService,
        DermatologyEncounterService,
        PrePostCareService,
      ],
    })
      .overrideGuard(LicensedModuleGuard)
      .useValue({ canActivate: () => true })
      .compile();

    app = moduleRef.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
    );
    await app.init();
    await app.listen(0);
    const addr = app.getHttpServer().address() as AddressInfo;
    baseUrl = `http://127.0.0.1:${addr.port}`;
  });

  afterAll(async () => {
    await app?.close();
    await prisma?.$disconnect();
  });

  function headers(
    roles: string[] = ['doctor'],
    opts?: { sub?: string; tenant?: string },
  ) {
    const tid = opts?.tenant ?? tenantId;
    (globalThis as { __weTenant?: string }).__weTenant = tid;
    return {
      'content-type': 'application/json',
      'x-test-principal': JSON.stringify({
        sub: opts?.sub ?? actorId,
        tenantId: tid,
        roles,
      }),
    };
  }

  async function createAppointmentInDb(start: Date, end?: Date) {
    const id = randomUUID();
    const wrapper = createClinicalPrismaWrapper(prisma);
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

  async function createActiveCourseHttp(opts: {
    plannedSessions: number;
    intervalMinDays: number;
    intervalMaxDays: number;
  }) {
    const createRes = await fetch(`${baseUrl}/aesthetic/treatment-courses`, {
      method: 'POST',
      headers: headers(['doctor']),
      body: JSON.stringify({
        patientId,
        clinicalServiceId,
        plannedSessions: opts.plannedSessions,
        intervalMinDays: opts.intervalMinDays,
        intervalMaxDays: opts.intervalMaxDays,
      }),
    });
    expect([200, 201]).toContain(createRes.status);
    const course = (await createRes.json()) as {
      id: string;
      status: string;
      sessions: Array<{ id: string; sequence: number }>;
    };
    const transitionRes = await fetch(`${baseUrl}/aesthetic/treatment-courses/${course.id}/transition`, {
      method: 'POST',
      headers: headers(['doctor']),
      body: JSON.stringify({ toStatus: 'ACTIVE' }),
    });
    expect([200, 201]).toContain(transitionRes.status);
    return course;
  }

  // --- Existing TreatmentCourse create/get ---

  it('POST /aesthetic/treatment-courses creates durable course + sessions in DB', async () => {
    const res = await fetch(`${baseUrl}/aesthetic/treatment-courses`, {
      method: 'POST',
      headers: headers(['doctor']),
      body: JSON.stringify({
        patientId,
        clinicalServiceId,
        plannedSessions: 3,
        intervalMinDays: 7,
        intervalMaxDays: 14,
      }),
    });
    expect([200, 201]).toContain(res.status);
    const body = (await res.json()) as { id: string; status: string; sessions: Array<{ sequence: number }> };
    expect(body.id).toBeTruthy();
    expect(body.status).toBe('DRAFT');
    expect(body.sessions).toHaveLength(3);

    const wrapper = createClinicalPrismaWrapper(prisma);
    const fromDb = await wrapper.withPlatformBypass(async (c) => ({
      course: await c.treatmentCourse.findFirst({ where: { id: body.id, tenantId } }),
      sessions: await c.courseSession.count({ where: { courseId: body.id, tenantId } }),
    }));
    expect(fromDb.course).toBeTruthy();
    expect(fromDb.course?.plannedSessions).toBe(3);
    expect(fromDb.course?.createdBy).toBe(actorId);
    expect(fromDb.sessions).toBe(3);
  });

  it('GET /aesthetic/treatment-courses/:id returns persisted course', async () => {
    const createRes = await fetch(`${baseUrl}/aesthetic/treatment-courses`, {
      method: 'POST',
      headers: headers(['doctor']),
      body: JSON.stringify({
        patientId,
        clinicalServiceId,
        plannedSessions: 2,
      }),
    });
    const created = (await createRes.json()) as { id: string };
    const getRes = await fetch(`${baseUrl}/aesthetic/treatment-courses/${created.id}`, {
      method: 'GET',
      headers: headers(['doctor']),
    });
    expect(getRes.status).toBe(200);
    const got = (await getRes.json()) as { id: string; sessions: unknown[] };
    expect(got.id).toBe(created.id);
    expect(got.sessions).toHaveLength(2);
  });

  // --- R2-B6-B CourseSession ---

  it('R2-B6-B: HTTP link-appointment succeeds and persists appointmentId', async () => {
    const course = await createActiveCourseHttp({
      plannedSessions: 2,
      intervalMinDays: 7,
      intervalMaxDays: 30,
    });
    const appt1 = await createAppointmentInDb(new Date('2026-09-01T10:00:00.000Z'));
    const linkRes = await fetch(
      `${baseUrl}/aesthetic/treatment-courses/${course.id}/sessions/${course.sessions[0].id}/link-appointment`,
      {
        method: 'POST',
        headers: headers(['doctor']),
        body: JSON.stringify({ appointmentId: appt1 }),
      },
    );
    expect([200, 201]).toContain(linkRes.status);
    const linked = (await linkRes.json()) as { id: string; appointmentId: string; status: string };
    expect(linked.appointmentId).toBe(appt1);
    expect(linked.status).toBe('BOOKED');

    const wrapper = createClinicalPrismaWrapper(prisma);
    const fromDb = await wrapper.withPlatformBypass((c) =>
      c.courseSession.findFirst({ where: { id: course.sessions[0].id, tenantId } }),
    );
    expect(fromDb?.appointmentId).toBe(appt1);
    expect(fromDb?.status).toBe('BOOKED');
  });

  it('R2-B6-B: HTTP rejects session2 before session1; no link in DB', async () => {
    const course = await createActiveCourseHttp({
      plannedSessions: 2,
      intervalMinDays: 7,
      intervalMaxDays: 30,
    });
    const appt1 = await createAppointmentInDb(new Date('2026-09-10T10:00:00.000Z'));
    const link1 = await fetch(
      `${baseUrl}/aesthetic/treatment-courses/${course.id}/sessions/${course.sessions[0].id}/link-appointment`,
      {
        method: 'POST',
        headers: headers(['doctor']),
        body: JSON.stringify({ appointmentId: appt1 }),
      },
    );
    expect([200, 201]).toContain(link1.status);

    const appt2 = await createAppointmentInDb(new Date('2026-09-05T10:00:00.000Z'));
    const link2 = await fetch(
      `${baseUrl}/aesthetic/treatment-courses/${course.id}/sessions/${course.sessions[1].id}/link-appointment`,
      {
        method: 'POST',
        headers: headers(['doctor']),
        body: JSON.stringify({ appointmentId: appt2 }),
      },
    );
    expect(link2.status).toBe(400);

    const wrapper = createClinicalPrismaWrapper(prisma);
    const fromDb = await wrapper.withPlatformBypass((c) =>
      c.courseSession.findFirst({ where: { id: course.sessions[1].id, tenantId } }),
    );
    expect(fromDb?.appointmentId).toBeNull();
    expect(fromDb?.status).toBe('PLANNED');
  });

  it('R2-B6-B: HTTP rejects link below intervalMinDays', async () => {
    const course = await createActiveCourseHttp({
      plannedSessions: 2,
      intervalMinDays: 14,
      intervalMaxDays: 30,
    });
    const appt1 = await createAppointmentInDb(new Date('2026-09-01T10:00:00.000Z'));
    await fetch(
      `${baseUrl}/aesthetic/treatment-courses/${course.id}/sessions/${course.sessions[0].id}/link-appointment`,
      {
        method: 'POST',
        headers: headers(['doctor']),
        body: JSON.stringify({ appointmentId: appt1 }),
      },
    );
    const appt2 = await createAppointmentInDb(new Date('2026-09-10T10:00:00.000Z'));
    const link2 = await fetch(
      `${baseUrl}/aesthetic/treatment-courses/${course.id}/sessions/${course.sessions[1].id}/link-appointment`,
      {
        method: 'POST',
        headers: headers(['doctor']),
        body: JSON.stringify({ appointmentId: appt2 }),
      },
    );
    expect(link2.status).toBe(400);

    const wrapper = createClinicalPrismaWrapper(prisma);
    const fromDb = await wrapper.withPlatformBypass((c) =>
      c.courseSession.findFirst({ where: { id: course.sessions[1].id, tenantId } }),
    );
    expect(fromDb?.appointmentId).toBeNull();
  });

  // --- R2-B6-C DeviceTreatmentRecord ---

  it('R2-B6-C: HTTP create device treatment persists EXT-DEVICE-001', async () => {
    const res = await fetch(`${baseUrl}/aesthetic/device-treatments`, {
      method: 'POST',
      headers: headers(['doctor']),
      body: JSON.stringify({
        deviceType: 'laser',
        deviceId: 'EXT-DEVICE-001',
        clinicalServiceId,
        parameterSchemaKey: 'laser.generic.v1',
        patientId,
        providerId,
        parameterPayload: { joules: 10 },
      }),
    });
    expect([200, 201]).toContain(res.status);
    const body = (await res.json()) as { id: string; deviceId: string };
    expect(body.deviceId).toBe('EXT-DEVICE-001');

    const wrapper = createClinicalPrismaWrapper(prisma);
    const fromDb = await wrapper.withPlatformBypass((c) =>
      c.deviceTreatmentRecord.findFirst({ where: { id: body.id, tenantId } }),
    );
    expect(fromDb?.deviceId).toBe('EXT-DEVICE-001');
    expect(fromDb?.providerId).toBe(providerId);
    expect(fromDb?.recordedBy).toBe(actorId);
  });

  it('R2-B6-C: HTTP deviceId length >120 returns 400 with zero DB rows for attempt', async () => {
    const wrapper = createClinicalPrismaWrapper(prisma);
    const before = await wrapper.withPlatformBypass((c) =>
      c.deviceTreatmentRecord.count({ where: { tenantId, deviceId: { startsWith: 'LONG-' } } }),
    );
    const longId = `LONG-${'x'.repeat(120)}`;
    expect(longId.length).toBeGreaterThan(120);

    const res = await fetch(`${baseUrl}/aesthetic/device-treatments`, {
      method: 'POST',
      headers: headers(['doctor']),
      body: JSON.stringify({
        deviceType: 'laser',
        deviceId: longId,
        clinicalServiceId,
        parameterSchemaKey: 'laser.generic.v1',
        patientId,
        providerId,
      }),
    });
    expect(res.status).toBe(400);

    const after = await wrapper.withPlatformBypass((c) =>
      c.deviceTreatmentRecord.count({ where: { tenantId, deviceId: { startsWith: 'LONG-' } } }),
    );
    expect(after).toBe(before);
  });

  it('R2-B6-C: HTTP deviceId whitespace-only returns 400', async () => {
    const res = await fetch(`${baseUrl}/aesthetic/device-treatments`, {
      method: 'POST',
      headers: headers(['doctor']),
      body: JSON.stringify({
        deviceType: 'laser',
        deviceId: '   ',
        clinicalServiceId,
        parameterSchemaKey: 'laser.generic.v1',
        patientId,
        providerId,
      }),
    });
    expect(res.status).toBe(400);
  });

  it('R2-B6-C: HTTP deviceId empty string returns 400', async () => {
    const res = await fetch(`${baseUrl}/aesthetic/device-treatments`, {
      method: 'POST',
      headers: headers(['doctor']),
      body: JSON.stringify({
        deviceType: 'laser',
        deviceId: '',
        clinicalServiceId,
        parameterSchemaKey: 'laser.generic.v1',
        patientId,
        providerId,
      }),
    });
    expect(res.status).toBe(400);
  });

  it('R2-B6-C: HTTP correction persists correction fields (+ audit)', async () => {
    auditCalls.length = 0;
    const createRes = await fetch(`${baseUrl}/aesthetic/device-treatments`, {
      method: 'POST',
      headers: headers(['doctor']),
      body: JSON.stringify({
        deviceType: 'laser',
        deviceId: 'EXT-CORR-001',
        clinicalServiceId,
        parameterSchemaKey: 'laser.generic.v1',
        patientId,
        providerId,
        parameterPayload: { joules: 5 },
      }),
    });
    expect([200, 201]).toContain(createRes.status);
    const created = (await createRes.json()) as { id: string };

    const corrRes = await fetch(`${baseUrl}/aesthetic/device-treatments/${created.id}/corrections`, {
      method: 'POST',
      headers: headers(['doctor']),
      body: JSON.stringify({
        reason: 'Adjust fluence after calibration',
        parameterPayload: { joules: 8, pulses: 2 },
      }),
    });
    expect([200, 201]).toContain(corrRes.status);
    const corrected = (await corrRes.json()) as {
      id: string;
      correctionReason: string;
      correctedBy: string;
      correctedAt: string;
      parameterPayload: Record<string, unknown>;
    };
    expect(corrected.correctionReason).toBe('Adjust fluence after calibration');
    expect(corrected.correctedBy).toBe(actorId);
    expect(corrected.correctedAt).toBeTruthy();
    expect(corrected.parameterPayload).toEqual({ joules: 8, pulses: 2 });

    const wrapper = createClinicalPrismaWrapper(prisma);
    const fromDb = await wrapper.withPlatformBypass((c) =>
      c.deviceTreatmentRecord.findFirst({ where: { id: created.id, tenantId } }),
    );
    expect(fromDb?.correctionReason).toBe('Adjust fluence after calibration');
    expect(fromDb?.correctedBy).toBe(actorId);
    expect(fromDb?.correctedAt).toBeTruthy();
    expect(fromDb?.parameterPayload).toEqual({ joules: 8, pulses: 2 });

    expect(
      auditCalls.some((c) => c.action === 'device_treatment.correct' && c.resourceId === created.id),
    ).toBe(true);
  });

  // --- R2-B6-D Dermatology + photo ---

  it('R2-B6-D: HTTP open derm encounter + attach photo creates MediaAsset', async () => {
    const openRes = await fetch(`${baseUrl}/aesthetic/dermatology/encounters`, {
      method: 'POST',
      headers: headers(['doctor']),
      body: JSON.stringify({
        patientId,
        clinicianId: providerId,
        clinicalServiceId: dermServiceId,
        branchId,
        chiefComplaint: 'Lesion check',
      }),
    });
    expect([200, 201]).toContain(openRes.status);
    const encounter = (await openRes.json()) as { id: string };

    const photoRes = await fetch(`${baseUrl}/aesthetic/dermatology/encounters/${encounter.id}/photos`, {
      method: 'POST',
      headers: headers(['doctor']),
      body: JSON.stringify({
        originalFilename: 'lesion.jpg',
        mimeType: 'image/jpeg',
        sizeBytes: 2048,
      }),
    });
    expect([200, 201]).toContain(photoRes.status);
    const photo = (await photoRes.json()) as {
      media: { id: string; ownerId: string; ownerType: string };
    };
    expect(photo.media.ownerId).toBe(encounter.id);
    expect(photo.media.ownerType).toBe('encounter');

    const wrapper = createClinicalPrismaWrapper(prisma);
    const media = await wrapper.withPlatformBypass((c) =>
      c.mediaAsset.findFirst({ where: { id: photo.media.id, tenantId } }),
    );
    expect(media).toBeTruthy();
    expect(media?.ownerId).toBe(encounter.id);
    expect(media?.patientId).toBe(patientId);
  });

  it('R2-B6-D: HTTP attach photo to non-derm encounter rejects', async () => {
    const plainEncounterId = randomUUID();
    const wrapper = createClinicalPrismaWrapper(prisma);
    await wrapper.withPlatformBypass((c) =>
      c.encounter.create({
        data: {
          id: plainEncounterId,
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

    const photoRes = await fetch(
      `${baseUrl}/aesthetic/dermatology/encounters/${plainEncounterId}/photos`,
      {
        method: 'POST',
        headers: headers(['doctor']),
        body: JSON.stringify({ originalFilename: 'x.jpg' }),
      },
    );
    expect(photoRes.status).toBe(400);

    const mediaCount = await wrapper.withPlatformBypass((c) =>
      c.mediaAsset.count({ where: { tenantId, ownerId: plainEncounterId } }),
    );
    expect(mediaCount).toBe(0);
  });

  it('R2-B6-D: HTTP attach cross-tenant MediaAsset rejects', async () => {
    const openRes = await fetch(`${baseUrl}/aesthetic/dermatology/encounters`, {
      method: 'POST',
      headers: headers(['doctor']),
      body: JSON.stringify({
        patientId,
        clinicianId: providerId,
        clinicalServiceId: dermServiceId,
        branchId,
      }),
    });
    expect([200, 201]).toContain(openRes.status);
    const encounter = (await openRes.json()) as { id: string };

    const foreignMedia = randomUUID();
    const wrapper = createClinicalPrismaWrapper(prisma);
    await wrapper.withPlatformBypass((c) =>
      c.mediaAsset.create({
        data: {
          id: foreignMedia,
          tenantId: otherTenantId,
          category: 'MEDICAL_DOCUMENT',
          ownerType: 'patient',
          ownerId: otherPatientId,
          patientId: otherPatientId,
          originalFilename: 'fx.jpg',
          mimeType: 'image/jpeg',
          sizeBytes: BigInt(10),
          status: 'READY',
          virusScanStatus: 'SKIPPED',
          storageKey: `fx/${foreignMedia}`,
          uploadedBy: otherActorId,
        },
      }),
    );

    const photoRes = await fetch(
      `${baseUrl}/aesthetic/dermatology/encounters/${encounter.id}/photos`,
      {
        method: 'POST',
        headers: headers(['doctor']),
        body: JSON.stringify({ mediaAssetId: foreignMedia }),
      },
    );
    expect([400, 404]).toContain(photoRes.status);

    const media = await wrapper.withPlatformBypass((c) =>
      c.mediaAsset.findFirst({ where: { id: foreignMedia } }),
    );
    expect(media?.tenantId).toBe(otherTenantId);
    expect(media?.ownerId).toBe(otherPatientId);
  });

  // --- R2-B6-E PRE/POST ---

  it('R2-B6-E: HTTP PRE_CARE + POST_CARE instances bind seeded versions; counts unchanged', async () => {
    const wrapper = createClinicalPrismaWrapper(prisma);
    const before = await wrapper.withPlatformBypass(async (c) => ({
      templates: await c.clinicalFormTemplate.count({ where: { tenantId } }),
      versions: await c.clinicalFormVersion.count({ where: { template: { tenantId } } }),
    }));

    const preRes = await fetch(`${baseUrl}/aesthetic/pre-post-care/instances`, {
      method: 'POST',
      headers: headers(['doctor']),
      body: JSON.stringify({
        kind: 'PRE_CARE',
        patientId,
        clinicalServiceId,
      }),
    });
    expect([200, 201]).toContain(preRes.status);
    const pre = (await preRes.json()) as {
      id: string;
      versionId: string;
      templateId: string;
      kind: string;
    };
    expect(pre.kind).toBe('PRE_CARE');
    expect(pre.versionId).toBe(preCareVersionId);
    expect(pre.templateId).toBe(preCareTemplateId);

    const postRes = await fetch(`${baseUrl}/aesthetic/pre-post-care/instances`, {
      method: 'POST',
      headers: headers(['doctor']),
      body: JSON.stringify({
        kind: 'POST_CARE',
        patientId,
        versionId: postCareVersionId,
      }),
    });
    expect([200, 201]).toContain(postRes.status);
    const post = (await postRes.json()) as { id: string; versionId: string; kind: string };
    expect(post.kind).toBe('POST_CARE');
    expect(post.versionId).toBe(postCareVersionId);

    const after = await wrapper.withPlatformBypass(async (c) => ({
      templates: await c.clinicalFormTemplate.count({ where: { tenantId } }),
      versions: await c.clinicalFormVersion.count({ where: { template: { tenantId } } }),
      preInstance: await c.patientFormInstance.findUniqueOrThrow({ where: { id: pre.id } }),
      postInstance: await c.patientFormInstance.findUniqueOrThrow({ where: { id: post.id } }),
    }));
    expect(after.templates).toBe(before.templates);
    expect(after.versions).toBe(before.versions);
    expect(after.preInstance.versionId).toBe(preCareVersionId);
    expect(after.postInstance.versionId).toBe(postCareVersionId);
  });

  it('R2-B6-E: HTTP rejects when no published version (other tenant)', async () => {
    const wrapperIso = createClinicalPrismaWrapper(prisma);
    await wrapperIso.withPlatformBypass((c) =>
      c.clinicalFormTemplate.updateMany({
        where: {
          tenantId: null,
          kind: 'PRE_CARE',
          status: 'ACTIVE',
        },
        data: { status: 'INACTIVE' },
      }),
    );
    const res = await fetch(`${baseUrl}/aesthetic/pre-post-care/instances`, {
      method: 'POST',
      headers: headers(['doctor'], { sub: otherActorId, tenant: otherTenantId }),
      body: JSON.stringify({
        kind: 'PRE_CARE',
        patientId: otherPatientId,
      }),
    });
    expect(res.status).toBe(400);

    const wrapper = createClinicalPrismaWrapper(prisma);
    const count = await wrapper.withPlatformBypass((c) =>
      c.patientFormInstance.count({ where: { tenantId: otherTenantId } }),
    );
    expect(count).toBe(0);
  });
  // --- R3-B2 / R3-B3 HTTP closure ---

  it('R3-B2: HTTP same-day min=0 session link succeeds', async () => {
    const course = await createActiveCourseHttp({
      plannedSessions: 2,
      intervalMinDays: 0,
      intervalMaxDays: 0,
    });
    const appt1 = await createAppointmentInDb(new Date('2026-08-20T10:00:00.000Z'));
    const link1 = await fetch(
      `${baseUrl}/aesthetic/treatment-courses/${course.id}/sessions/${course.sessions[0].id}/link-appointment`,
      {
        method: 'POST',
        headers: headers(['doctor']),
        body: JSON.stringify({ appointmentId: appt1 }),
      },
    );
    expect([200, 201]).toContain(link1.status);

    const appt2 = await createAppointmentInDb(new Date('2026-08-20T16:00:00.000Z'));
    const link2 = await fetch(
      `${baseUrl}/aesthetic/treatment-courses/${course.id}/sessions/${course.sessions[1].id}/link-appointment`,
      {
        method: 'POST',
        headers: headers(['doctor']),
        body: JSON.stringify({ appointmentId: appt2 }),
      },
    );
    expect([200, 201]).toContain(link2.status);
    const linked = (await link2.json()) as { appointmentId: string; status: string };
    expect(linked.appointmentId).toBe(appt2);
    expect(linked.status).toBe('BOOKED');
  });

  it('R3-B3-T13: HTTP PRE_CARE with platform pack → durable PatientFormInstance', async () => {
    const wrapper = createClinicalPrismaWrapper(prisma);
    const platformTemplateId = randomUUID();
    const platformVersionId = randomUUID();
    await wrapper.withPlatformBypass(async (c) => {
      await c.clinicalFormTemplate.create({
        data: {
          id: platformTemplateId,
          tenantId: null,
          kind: 'PRE_CARE',
          stableKey: `platform-pp-pre-${platformTemplateId.slice(0, 8)}`,
          status: 'ACTIVE',
          nameEn: 'Platform PRE_CARE',
          nameAr: 'PRE_CARE',
        },
      });
      await c.clinicalFormVersion.create({
        data: {
          id: platformVersionId,
          templateId: platformTemplateId,
          version: 1,
          status: 'PUBLISHED',
          contentEn: '{}',
          contentAr: '{}',
          publishedAt: new Date(),
        },
      });
    });

    try {
      const res = await fetch(`${baseUrl}/aesthetic/pre-post-care/instances`, {
        method: 'POST',
        headers: headers(['doctor']),
        body: JSON.stringify({
          kind: 'PRE_CARE',
          patientId,
          versionId: platformVersionId,
        }),
      });
      expect([200, 201]).toContain(res.status);
      const body = (await res.json()) as {
        id: string;
        versionId: string;
        templateId: string;
        kind: string;
      };
      expect(body.kind).toBe('PRE_CARE');
      expect(body.versionId).toBe(platformVersionId);
      expect(body.templateId).toBe(platformTemplateId);

      const fromDb = await wrapper.withPlatformBypass((c) =>
        c.patientFormInstance.findUniqueOrThrow({ where: { id: body.id } }),
      );
      expect(fromDb.versionId).toBe(platformVersionId);
      expect(fromDb.tenantId).toBe(tenantId);

      const platformAfter = await wrapper.withPlatformBypass((c) =>
        c.clinicalFormVersion.findUniqueOrThrow({ where: { id: platformVersionId } }),
      );
      expect(platformAfter.status).toBe('PUBLISHED');
    } finally {
      await wrapper.withPlatformBypass(async (c) => {
        await c.patientFormInstance.deleteMany({ where: { versionId: platformVersionId } });
        await c.clinicalFormTemplate.updateMany({
          where: { id: platformTemplateId },
          data: { status: 'INACTIVE' },
        });
      });
    }
  });

  it('R3-B3-T14: HTTP POST_CARE with platform pack → durable PatientFormInstance', async () => {
    const wrapper = createClinicalPrismaWrapper(prisma);
    const platformTemplateId = randomUUID();
    const platformVersionId = randomUUID();
    await wrapper.withPlatformBypass(async (c) => {
      await c.clinicalFormTemplate.create({
        data: {
          id: platformTemplateId,
          tenantId: null,
          kind: 'POST_CARE',
          stableKey: `platform-pp-post-${platformTemplateId.slice(0, 8)}`,
          status: 'ACTIVE',
          nameEn: 'Platform POST_CARE',
          nameAr: 'POST_CARE',
        },
      });
      await c.clinicalFormVersion.create({
        data: {
          id: platformVersionId,
          templateId: platformTemplateId,
          version: 1,
          status: 'PUBLISHED',
          contentEn: '{}',
          contentAr: '{}',
          publishedAt: new Date(),
        },
      });
    });

    try {
      const res = await fetch(`${baseUrl}/aesthetic/pre-post-care/instances`, {
        method: 'POST',
        headers: headers(['doctor']),
        body: JSON.stringify({
          kind: 'POST_CARE',
          patientId,
          versionId: platformVersionId,
        }),
      });
      expect([200, 201]).toContain(res.status);
      const body = (await res.json()) as {
        id: string;
        versionId: string;
        templateId: string;
        kind: string;
      };
      expect(body.kind).toBe('POST_CARE');
      expect(body.versionId).toBe(platformVersionId);
      expect(body.templateId).toBe(platformTemplateId);

      const fromDb = await wrapper.withPlatformBypass((c) =>
        c.patientFormInstance.findUniqueOrThrow({ where: { id: body.id } }),
      );
      expect(fromDb.versionId).toBe(platformVersionId);
      expect(fromDb.tenantId).toBe(tenantId);
    } finally {
      await wrapper.withPlatformBypass(async (c) => {
        await c.patientFormInstance.deleteMany({ where: { versionId: platformVersionId } });
        await c.clinicalFormTemplate.updateMany({
          where: { id: platformTemplateId },
          data: { status: 'INACTIVE' },
        });
      });
    }
  });

});