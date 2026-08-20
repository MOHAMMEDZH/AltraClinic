/**
 * Wave E RLS — booking_app NOBYPASSRLS for treatment_courses / course_sessions / device_treatment_records.
 */
import {
  ClinicalPriceVersionStatus,
  ClinicalPricingUnit,
  PrismaClient,
} from '@prisma/client';
import { randomUUID } from 'crypto';
import {
  assertSafePlatformTestDatabaseUrl,
  platformDbSecurityEnabled,
  DEFAULT_PLATFORM_DB_SECURITY_URL,
} from '../../auth/tests/platform-db-security.harness';

jest.setTimeout(180_000);
const describeDb = platformDbSecurityEnabled() ? describe : describe.skip;

const ADMIN_URL = DEFAULT_PLATFORM_DB_SECURITY_URL;
const APP_URL =
  process.env.INTEGRATION_APP_DATABASE_URL ??
  'postgresql://booking_app:booking_app@localhost:5433/booking_test?schema=public';

async function withTenant<T>(
  client: PrismaClient,
  tenantId: string,
  fn: (tx: PrismaClient) => Promise<T>,
): Promise<T> {
  return client.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT set_config('app.current_tenant_id', ${tenantId}, true)`;
    await tx.$executeRaw`SELECT set_config('app.platform_rls_bypass', 'false', true)`;
    return fn(tx as unknown as PrismaClient);
  });
}

async function withBypass<T>(client: PrismaClient, fn: (tx: PrismaClient) => Promise<T>): Promise<T> {
  return client.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT set_config('app.platform_rls_bypass', 'true', true)`;
    await tx.$executeRaw`SELECT set_config('app.current_tenant_id', '', true)`;
    return fn(tx as unknown as PrismaClient);
  });
}

async function nobypassProof(client: PrismaClient, tenantId: string) {
  return withTenant(client, tenantId, async (tx) => {
    const current = await tx.$queryRaw<Array<{ current_user: string }>>`SELECT current_user`;
    const bypass = await tx.$queryRaw<Array<{ rolbypassrls: boolean }>>`
      SELECT rolbypassrls FROM pg_roles WHERE rolname = current_user
    `;
    const tenant = await tx.$queryRaw<Array<{ tenant: string | null }>>`
      SELECT current_setting('app.current_tenant_id', true) AS tenant
    `;
    return {
      currentUser: current[0]?.current_user,
      bypass: bypass[0]?.rolbypassrls,
      tenantId: tenant[0]?.tenant,
    };
  });
}

describeDb('Wave E real RLS (bypass OFF, booking_app)', () => {
  let admin: PrismaClient;
  let app: PrismaClient;
  let tenantA: string;
  let tenantB: string;
  let courseA: string;
  let courseB: string;
  let sessionA: string;
  let deviceA: string;
  let actorA: string;
  let actorB: string;
  let patientA: string;
  let patientB: string;
  let svcA: string;
  let svcB: string;
  let priceVersionA: string;
  let priceVersionB: string;
  let branchA: string;
  let branchB: string;
  let encounterA: string;
  let encounterB: string;
  let beautyRecordA: string;
  let beautyRecordB: string;
  let beautyAnnotationA: string;
  let beautyAnnotationB: string;
  let appointmentA: string;
  let appointmentB: string;

  beforeAll(async () => {
    assertSafePlatformTestDatabaseUrl(ADMIN_URL);
    admin = new PrismaClient({ datasources: { db: { url: ADMIN_URL } } });
    app = new PrismaClient({ datasources: { db: { url: APP_URL } } });
    await admin.$connect();
    await app.$connect();

    tenantA = randomUUID();
    tenantB = randomUUID();
    courseA = randomUUID();
    courseB = randomUUID();
    sessionA = randomUUID();
    deviceA = randomUUID();
    actorA = randomUUID();
    actorB = randomUUID();
    patientA = randomUUID();
    patientB = randomUUID();
    svcA = randomUUID();
    svcB = randomUUID();
    priceVersionA = randomUUID();
    priceVersionB = randomUUID();
    branchA = randomUUID();
    branchB = randomUUID();
    encounterA = randomUUID();
    encounterB = randomUUID();
    beautyRecordA = randomUUID();
    beautyRecordB = randomUUID();
    beautyAnnotationA = randomUUID();
    beautyAnnotationB = randomUUID();
    appointmentA = randomUUID();
    appointmentB = randomUUID();

    await withBypass(admin, async (tx) => {
      await tx.tenant.createMany({
        data: [
          { id: tenantA, name: 'WE RLS A', slug: `we-rls-a-${tenantA.slice(0, 8)}` },
          { id: tenantB, name: 'WE RLS B', slug: `we-rls-b-${tenantB.slice(0, 8)}` },
        ],
      });
      await tx.user.create({
        data: {
          id: actorA,
          tenantId: tenantA,
          email: `we-rls-${actorA.slice(0, 8)}@t.local`,
          passwordHash: 'x',
          firstName: 'A',
          lastName: 'A',
        },
      });
      await tx.user.create({
        data: {
          id: actorB,
          tenantId: tenantB,
          email: `we-rls-${actorB.slice(0, 8)}@t.local`,
          passwordHash: 'x',
          firstName: 'B',
          lastName: 'B',
        },
      });
      await tx.patient.create({
        data: { id: patientA, tenantId: tenantA, firstName: 'A', lastName: 'P' },
      });
      await tx.patient.create({
        data: { id: patientB, tenantId: tenantB, firstName: 'B', lastName: 'P' },
      });
      await tx.canonicalClinicalServiceDefinition.create({
        data: {
          id: svcA,
          tenantId: tenantA,
          provenance: 'TENANT_CUSTOM',
          stableKey: `tenant.${tenantA}.custom.rls-${svcA.slice(0, 8)}`,
          domain: 'AESTHETIC',
          lifecycle: 'PUBLISHED',
        },
      });
      await tx.canonicalClinicalServiceDefinition.create({
        data: {
          id: svcB,
          tenantId: tenantB,
          provenance: 'TENANT_CUSTOM',
          stableKey: `tenant.${tenantB}.custom.rls-${svcB.slice(0, 8)}`,
          domain: 'AESTHETIC',
          lifecycle: 'PUBLISHED',
        },
      });
      await tx.branch.create({
        data: { id: branchA, tenantId: tenantA, name: `WE RLS Branch A ${branchA.slice(0, 6)}` },
      });
      await tx.branch.create({
        data: { id: branchB, tenantId: tenantB, name: `WE RLS Branch B ${branchB.slice(0, 6)}` },
      });
      await tx.clinicalServicePriceVersion.create({
        data: {
          id: priceVersionA,
          tenantId: tenantA,
          branchId: null,
          clinicalServiceId: svcA,
          pricingUnit: ClinicalPricingUnit.PER_COURSE,
          currency: 'SYP',
          unitPrice: 500,
          taxPercent: 0,
          effectiveFrom: new Date('2026-01-01T00:00:00.000Z'),
          status: ClinicalPriceVersionStatus.ACTIVE,
          publishedAt: new Date('2026-01-01T00:00:00.000Z'),
          publishedBy: actorA,
        },
      });
      await tx.clinicalServicePriceVersion.create({
        data: {
          id: priceVersionB,
          tenantId: tenantB,
          branchId: null,
          clinicalServiceId: svcB,
          pricingUnit: ClinicalPricingUnit.PER_COURSE,
          currency: 'SYP',
          unitPrice: 600,
          taxPercent: 0,
          effectiveFrom: new Date('2026-01-01T00:00:00.000Z'),
          status: ClinicalPriceVersionStatus.ACTIVE,
          publishedAt: new Date('2026-01-01T00:00:00.000Z'),
          publishedBy: actorB,
        },
      });
      await tx.appointment.create({
        data: {
          id: appointmentA,
          tenantId: tenantA,
          patientId: patientA,
          providerId: actorA,
          scheduledStart: new Date('2026-09-01T10:00:00.000Z'),
          scheduledEnd: new Date('2026-09-01T11:00:00.000Z'),
          status: 'CONFIRMED',
          clinicalServiceId: svcA,
        },
      });
      await tx.appointment.create({
        data: {
          id: appointmentB,
          tenantId: tenantB,
          patientId: patientB,
          providerId: actorB,
          scheduledStart: new Date('2026-09-02T10:00:00.000Z'),
          scheduledEnd: new Date('2026-09-02T11:00:00.000Z'),
          status: 'CONFIRMED',
          clinicalServiceId: svcB,
        },
      });
      await tx.encounter.create({
        data: {
          id: encounterA,
          tenantId: tenantA,
          patientId: patientA,
          clinicianId: actorA,
          branchId: branchA,
          diagnoses: [],
          medications: [],
          observations: [],
          soapNotes: {},
          structuredNotes: [],
        },
      });
      await tx.encounter.create({
        data: {
          id: encounterB,
          tenantId: tenantB,
          patientId: patientB,
          clinicianId: actorB,
          branchId: branchB,
          diagnoses: [],
          medications: [],
          observations: [],
          soapNotes: {},
          structuredNotes: [],
        },
      });
      await tx.beautyRecord.create({
        data: { id: beautyRecordA, tenantId: tenantA, patientId: patientA, bodyMapState: {} },
      });
      await tx.beautyRecord.create({
        data: { id: beautyRecordB, tenantId: tenantB, patientId: patientB, bodyMapState: {} },
      });
      await tx.beautyAnnotation.create({
        data: {
          id: beautyAnnotationA,
          tenantId: tenantA,
          beautyRecordId: beautyRecordA,
          zone: 'forehead',
          treatment: 'laser',
          coordinates: { x: 0.4, y: 0.4, view: 'front' },
          recordedBy: actorA,
        },
      });
      await tx.beautyAnnotation.create({
        data: {
          id: beautyAnnotationB,
          tenantId: tenantB,
          beautyRecordId: beautyRecordB,
          zone: 'cheek',
          treatment: 'laser',
          coordinates: { x: 0.6, y: 0.6, view: 'front' },
          recordedBy: actorB,
        },
      });
      await tx.treatmentCourse.create({
        data: {
          id: courseA,
          tenantId: tenantA,
          patientId: patientA,
          clinicalServiceId: svcA,
          plannedSessions: 2,
          packagePriceVersionId: priceVersionA,
          createdBy: actorA,
        },
      });
      await tx.treatmentCourse.create({
        data: {
          id: courseB,
          tenantId: tenantB,
          patientId: patientB,
          clinicalServiceId: svcB,
          plannedSessions: 1,
          packagePriceVersionId: priceVersionB,
          createdBy: actorB,
        },
      });
      await tx.courseSession.create({
        data: {
          id: sessionA,
          tenantId: tenantA,
          courseId: courseA,
          sequence: 1,
          appointmentId: appointmentA,
          status: 'PLANNED',
        },
      });
      await tx.deviceTreatmentRecord.create({
        data: {
          id: deviceA,
          tenantId: tenantA,
          deviceType: 'laser',
          clinicalServiceId: svcA,
          parameterSchemaKey: 'laser.generic.v1',
          parameterPayload: {},
          patientId: patientA,
          providerId: actorA,
          branchId: branchA,
          recordedBy: actorA,
          beautyAnnotationId: beautyAnnotationA,
          encounterId: encounterA,
        },
      });
    });
  });

  afterAll(async () => {
    await app.$disconnect();
    await admin.$disconnect();
  });

  it('NOBYPASSRLS context is active (current_user, rolbypassrls=false, tenant)', async () => {
    const proof = await nobypassProof(app, tenantA);
    expect(proof.currentUser).toBeTruthy();
    expect(proof.bypass).toBe(false);
    expect(proof.tenantId).toBe(tenantA);
  });

  it('same-tenant SELECT sees Wave E rows', async () => {
    const courses = await withTenant(app, tenantA, (tx) =>
      tx.treatmentCourse.findMany({ where: { id: courseA } }),
    );
    const sessions = await withTenant(app, tenantA, (tx) =>
      tx.courseSession.findMany({ where: { id: sessionA } }),
    );
    const devices = await withTenant(app, tenantA, (tx) =>
      tx.deviceTreatmentRecord.findMany({ where: { id: deviceA } }),
    );
    expect(courses).toHaveLength(1);
    expect(sessions).toHaveLength(1);
    expect(devices).toHaveLength(1);
  });

  it('cross-tenant SELECT is empty', async () => {
    const courses = await withTenant(app, tenantB, (tx) =>
      tx.treatmentCourse.findMany({ where: { id: courseA } }),
    );
    const sessions = await withTenant(app, tenantB, (tx) =>
      tx.courseSession.findMany({ where: { id: sessionA } }),
    );
    const devices = await withTenant(app, tenantB, (tx) =>
      tx.deviceTreatmentRecord.findMany({ where: { id: deviceA } }),
    );
    expect(courses).toHaveLength(0);
    expect(sessions).toHaveLength(0);
    expect(devices).toHaveLength(0);
  });

  it('same-tenant INSERT succeeds for Wave E tables under RLS', async () => {
    const ids = {
      course: randomUUID(),
      session: randomUUID(),
      device: randomUUID(),
    };
    await withTenant(app, tenantA, async (tx) => {
      await tx.treatmentCourse.create({
        data: {
          id: ids.course,
          tenantId: tenantA,
          patientId: patientA,
          clinicalServiceId: svcA,
          plannedSessions: 1,
          createdBy: actorA,
        },
      });
      await tx.courseSession.create({
        data: {
          id: ids.session,
          tenantId: tenantA,
          courseId: ids.course,
          sequence: 1,
          status: 'PLANNED',
        },
      });
      await tx.deviceTreatmentRecord.create({
        data: {
          id: ids.device,
          tenantId: tenantA,
          deviceType: 'rf',
          clinicalServiceId: svcA,
          parameterSchemaKey: 'rf.generic.v1',
          parameterPayload: {},
          patientId: patientA,
          providerId: actorA,
          recordedBy: actorA,
        },
      });
    });
    const counts = await withTenant(app, tenantA, async (tx) => ({
      course: await tx.treatmentCourse.count({ where: { id: ids.course } }),
      session: await tx.courseSession.count({ where: { id: ids.session } }),
      device: await tx.deviceTreatmentRecord.count({ where: { id: ids.device } }),
    }));
    expect(counts.course).toBe(1);
    expect(counts.session).toBe(1);
    expect(counts.device).toBe(1);
  });

  it('cross-tenant INSERT is rejected', async () => {
    await expect(
      withTenant(app, tenantB, (tx) =>
        tx.treatmentCourse.create({
          data: {
            id: randomUUID(),
            tenantId: tenantA,
            patientId: patientA,
            clinicalServiceId: svcA,
            plannedSessions: 1,
            createdBy: actorA,
          },
        }),
      ),
    ).rejects.toThrow();

    await expect(
      withTenant(app, tenantB, (tx) =>
        tx.courseSession.create({
          data: {
            id: randomUUID(),
            tenantId: tenantA,
            courseId: courseA,
            sequence: 99,
            status: 'PLANNED',
          },
        }),
      ),
    ).rejects.toThrow();

    await expect(
      withTenant(app, tenantB, (tx) =>
        tx.deviceTreatmentRecord.create({
          data: {
            id: randomUUID(),
            tenantId: tenantA,
            deviceType: 'laser',
            clinicalServiceId: svcA,
            parameterSchemaKey: 'laser.generic.v1',
            parameterPayload: {},
            patientId: patientA,
            providerId: actorA,
            recordedBy: actorA,
          },
        }),
      ),
    ).rejects.toThrow();
  });

  it('cross-tenant UPDATE/DELETE are zero or rejected', async () => {
    const updates = await withTenant(app, tenantB, async (tx) => ({
      courses: await tx.treatmentCourse.updateMany({
        where: { id: courseA },
        data: { plannedSessions: 9 },
      }),
      sessions: await tx.courseSession.updateMany({
        where: { id: sessionA },
        data: { status: 'CANCELLED' },
      }),
      devices: await tx.deviceTreatmentRecord.updateMany({
        where: { id: deviceA },
        data: { bodyArea: 'x' },
      }),
    }));
    expect(updates.courses.count).toBe(0);
    expect(updates.sessions.count).toBe(0);
    expect(updates.devices.count).toBe(0);

    const deletes = await withTenant(app, tenantB, async (tx) => ({
      courses: await tx.treatmentCourse.deleteMany({ where: { id: courseA } }),
      sessions: await tx.courseSession.deleteMany({ where: { id: sessionA } }),
      devices: await tx.deviceTreatmentRecord.deleteMany({ where: { id: deviceA } }),
    }));
    expect(deletes.courses.count).toBe(0);
    expect(deletes.sessions.count).toBe(0);
    expect(deletes.devices.count).toBe(0);
  });

  it('dangerous shape: course_sessions.tenantId=A with courseId from tenant B is rejected', async () => {
    const proof = await nobypassProof(app, tenantA);
    expect(proof.bypass).toBe(false);
    expect(proof.tenantId).toBe(tenantA);

    const attemptId = randomUUID();
    await expect(
      withTenant(app, tenantA, (tx) =>
        tx.courseSession.create({
          data: {
            id: attemptId,
            tenantId: tenantA,
            courseId: courseB,
            sequence: 1,
            status: 'PLANNED',
          },
        }),
      ),
    ).rejects.toThrow(/course_sessions: tenantId must match course\.tenantId|course .* not found|Foreign key/i);

    const leaked = await withBypass(admin, (tx) =>
      tx.courseSession.count({ where: { id: attemptId } }),
    );
    expect(leaked).toBe(0);
  });

  it('dangerous shape: device_treatment_records with foreign-tenant patientId is rejected', async () => {
    const attemptId = randomUUID();
    await expect(
      withTenant(app, tenantA, (tx) =>
        tx.deviceTreatmentRecord.create({
          data: {
            id: attemptId,
            tenantId: tenantA,
            deviceType: 'laser',
            clinicalServiceId: svcA,
            parameterSchemaKey: 'laser.generic.v1',
            parameterPayload: {},
            patientId: patientB,
            providerId: actorA,
            recordedBy: actorA,
          },
        }),
      ),
    ).rejects.toThrow(
      /device_treatment_records: tenantId must match patient\.tenantId|patient .* not found|Foreign key/i,
    );

    const leaked = await withBypass(admin, (tx) =>
      tx.deviceTreatmentRecord.count({ where: { id: attemptId } }),
    );
    expect(leaked).toBe(0);
  });

  it('dermatology_records table does NOT exist', async () => {
    const rows = await withBypass(admin, (tx) =>
      tx.$queryRaw<Array<{ exists: boolean }>>`
        SELECT EXISTS (
          SELECT 1 FROM information_schema.tables
          WHERE table_schema = 'public' AND table_name = 'dermatology_records'
        ) AS exists
      `,
    );
    expect(rows[0]?.exists).toBe(false);
    expect((admin as unknown as Record<string, unknown>).dermatologyRecord).toBeUndefined();
  });

  it('parent-switch UPDATE courseId to foreign tenant course is rejected', async () => {
    await expect(
      withTenant(app, tenantA, (tx) =>
        tx.courseSession.update({
          where: { id: sessionA },
          data: { courseId: courseB },
        }),
      ),
    ).rejects.toThrow(/course_sessions: tenantId must match course\.tenantId|course .* not found|Foreign key constraint|P2003|23514|23503/i);

    const row = await withBypass(admin, (tx) =>
      tx.courseSession.findUniqueOrThrow({ where: { id: sessionA } }),
    );
    expect(row.courseId).toBe(courseA);
  });

  it('parent-switch UPDATE appointmentId to foreign tenant appointment is rejected', async () => {
    const foreignAppt = randomUUID();
    await withBypass(admin, async (tx) => {
      await tx.appointment.create({
        data: {
          id: foreignAppt,
          tenantId: tenantB,
          patientId: patientB,
          providerId: actorB,
          scheduledStart: new Date('2026-10-01T10:00:00.000Z'),
          scheduledEnd: new Date('2026-10-01T11:00:00.000Z'),
          status: 'CONFIRMED',
          clinicalServiceId: svcB,
        },
      });
    });
    await expect(
      withTenant(app, tenantA, (tx) =>
        tx.courseSession.update({
          where: { id: sessionA },
          data: { appointmentId: foreignAppt },
        }),
      ),
    ).rejects.toThrow(/course_sessions: tenantId must match appointment\.tenantId|appointment .* not found|Foreign key constraint|P2003|23514|23503/i);

    const row = await withBypass(admin, (tx) =>
      tx.courseSession.findUniqueOrThrow({ where: { id: sessionA } }),
    );
    expect(row.appointmentId).toBe(appointmentA);
  });

  it('parent-switch UPDATE patientId on treatment_courses is rejected', async () => {
    await expect(
      withTenant(app, tenantA, (tx) =>
        tx.treatmentCourse.update({
          where: { id: courseA },
          data: { patientId: patientB },
        }),
      ),
    ).rejects.toThrow(/treatment_courses: tenantId must match patient\.tenantId|patient .* not found|Foreign key constraint|P2003|23514|23503/i);

    const row = await withBypass(admin, (tx) =>
      tx.treatmentCourse.findUniqueOrThrow({ where: { id: courseA } }),
    );
    expect(row.patientId).toBe(patientA);
  });

  it('parent-switch UPDATE recordedBy on device_treatment_records is rejected', async () => {
    await expect(
      withTenant(app, tenantA, (tx) =>
        tx.deviceTreatmentRecord.update({
          where: { id: deviceA },
          data: { recordedBy: actorB },
        }),
      ),
    ).rejects.toThrow(/device_treatment_records: tenantId must match recordedBy\.tenantId|Foreign key constraint|P2003|23514|23503/i);

    const row = await withBypass(admin, (tx) =>
      tx.deviceTreatmentRecord.findUniqueOrThrow({ where: { id: deviceA } }),
    );
    expect(row.recordedBy).toBe(actorA);
  });

  it('parent-switch UPDATE createdBy on treatment_courses is rejected', async () => {
    await expect(
      withTenant(app, tenantA, (tx) =>
        tx.treatmentCourse.update({
          where: { id: courseA },
          data: { createdBy: actorB },
        }),
      ),
    ).rejects.toThrow(/treatment_courses: tenantId must match createdBy\.tenantId|Foreign key constraint|P2003|23514|23503/i);

    const row = await withBypass(admin, (tx) =>
      tx.treatmentCourse.findUniqueOrThrow({ where: { id: courseA } }),
    );
    expect(row.createdBy).toBe(actorA);
  });

  // --- TreatmentCourse mixed-parent INSERT / parent-switch (relation-by-relation) ---

  it('mixed-parent INSERT treatment_courses.patientId from tenant B is rejected', async () => {
    const attemptId = randomUUID();
    await expect(
      withTenant(app, tenantA, (tx) =>
        tx.treatmentCourse.create({
          data: {
            id: attemptId,
            tenantId: tenantA,
            patientId: patientB,
            clinicalServiceId: svcA,
            plannedSessions: 1,
            createdBy: actorA,
          },
        }),
      ),
    ).rejects.toThrow(
      /treatment_courses: tenantId must match patient\.tenantId|patient .* not found|Foreign key|P2003|23514|23503/i,
    );
    const leaked = await withBypass(admin, (tx) =>
      tx.treatmentCourse.count({ where: { id: attemptId } }),
    );
    expect(leaked).toBe(0);
  });

  it('mixed-parent INSERT treatment_courses.clinicalServiceId from tenant B is rejected', async () => {
    const attemptId = randomUUID();
    await expect(
      withTenant(app, tenantA, (tx) =>
        tx.treatmentCourse.create({
          data: {
            id: attemptId,
            tenantId: tenantA,
            patientId: patientA,
            clinicalServiceId: svcB,
            plannedSessions: 1,
            createdBy: actorA,
          },
        }),
      ),
    ).rejects.toThrow(
      /treatment_courses: tenantId must match clinicalService\.tenantId|clinicalService .* not found|Foreign key|P2003|23514|23503/i,
    );
    const leaked = await withBypass(admin, (tx) =>
      tx.treatmentCourse.count({ where: { id: attemptId } }),
    );
    expect(leaked).toBe(0);
  });

  it('mixed-parent INSERT treatment_courses.packagePriceVersionId from tenant B is rejected', async () => {
    const attemptId = randomUUID();
    await expect(
      withTenant(app, tenantA, (tx) =>
        tx.treatmentCourse.create({
          data: {
            id: attemptId,
            tenantId: tenantA,
            patientId: patientA,
            clinicalServiceId: svcA,
            plannedSessions: 1,
            packagePriceVersionId: priceVersionB,
            createdBy: actorA,
          },
        }),
      ),
    ).rejects.toThrow(
      /treatment_courses: tenantId must match packagePriceVersion\.tenantId|packagePriceVersion .* not found|Foreign key|P2003|23514|23503/i,
    );
    const leaked = await withBypass(admin, (tx) =>
      tx.treatmentCourse.count({ where: { id: attemptId } }),
    );
    expect(leaked).toBe(0);
  });

  it('mixed-parent INSERT treatment_courses.createdBy from tenant B is rejected', async () => {
    const attemptId = randomUUID();
    await expect(
      withTenant(app, tenantA, (tx) =>
        tx.treatmentCourse.create({
          data: {
            id: attemptId,
            tenantId: tenantA,
            patientId: patientA,
            clinicalServiceId: svcA,
            plannedSessions: 1,
            createdBy: actorB,
          },
        }),
      ),
    ).rejects.toThrow(
      /treatment_courses: tenantId must match createdBy\.tenantId|createdBy .* not found|Foreign key|P2003|23514|23503/i,
    );
    const leaked = await withBypass(admin, (tx) =>
      tx.treatmentCourse.count({ where: { id: attemptId } }),
    );
    expect(leaked).toBe(0);
  });

  it('parent-switch UPDATE clinicalServiceId on treatment_courses is rejected', async () => {
    await expect(
      withTenant(app, tenantA, (tx) =>
        tx.treatmentCourse.update({
          where: { id: courseA },
          data: { clinicalServiceId: svcB },
        }),
      ),
    ).rejects.toThrow(
      /treatment_courses: tenantId must match clinicalService\.tenantId|clinicalService .* not found|Foreign key constraint|P2003|23514|23503/i,
    );
    const row = await withBypass(admin, (tx) =>
      tx.treatmentCourse.findUniqueOrThrow({ where: { id: courseA } }),
    );
    expect(row.clinicalServiceId).toBe(svcA);
  });

  it('parent-switch UPDATE packagePriceVersionId on treatment_courses is rejected', async () => {
    await expect(
      withTenant(app, tenantA, (tx) =>
        tx.treatmentCourse.update({
          where: { id: courseA },
          data: { packagePriceVersionId: priceVersionB },
        }),
      ),
    ).rejects.toThrow(
      /treatment_courses: tenantId must match packagePriceVersion\.tenantId|packagePriceVersion .* not found|Foreign key constraint|P2003|23514|23503/i,
    );
    const row = await withBypass(admin, (tx) =>
      tx.treatmentCourse.findUniqueOrThrow({ where: { id: courseA } }),
    );
    expect(row.packagePriceVersionId).toBe(priceVersionA);
  });

  // --- CourseSession mixed-parent INSERT ---

  it('mixed-parent INSERT course_sessions.appointmentId from tenant B is rejected', async () => {
    const attemptId = randomUUID();
    await expect(
      withTenant(app, tenantA, (tx) =>
        tx.courseSession.create({
          data: {
            id: attemptId,
            tenantId: tenantA,
            courseId: courseA,
            sequence: 88,
            appointmentId: appointmentB,
            status: 'PLANNED',
          },
        }),
      ),
    ).rejects.toThrow(
      /course_sessions: tenantId must match appointment\.tenantId|appointment .* not found|Foreign key|P2003|23514|23503/i,
    );
    const leaked = await withBypass(admin, (tx) =>
      tx.courseSession.count({ where: { id: attemptId } }),
    );
    expect(leaked).toBe(0);
  });

  // --- DeviceTreatmentRecord mixed-parent INSERT ---

  it('mixed-parent INSERT device_treatment_records.providerId from tenant B is rejected', async () => {
    const attemptId = randomUUID();
    await expect(
      withTenant(app, tenantA, (tx) =>
        tx.deviceTreatmentRecord.create({
          data: {
            id: attemptId,
            tenantId: tenantA,
            deviceType: 'laser',
            clinicalServiceId: svcA,
            parameterSchemaKey: 'laser.generic.v1',
            parameterPayload: {},
            patientId: patientA,
            providerId: actorB,
            recordedBy: actorA,
          },
        }),
      ),
    ).rejects.toThrow(
      /device_treatment_records: tenantId must match provider\.tenantId|provider .* not found|Foreign key|P2003|23514|23503/i,
    );
    const leaked = await withBypass(admin, (tx) =>
      tx.deviceTreatmentRecord.count({ where: { id: attemptId } }),
    );
    expect(leaked).toBe(0);
  });

  it('mixed-parent INSERT device_treatment_records.clinicalServiceId from tenant B is rejected', async () => {
    const attemptId = randomUUID();
    await expect(
      withTenant(app, tenantA, (tx) =>
        tx.deviceTreatmentRecord.create({
          data: {
            id: attemptId,
            tenantId: tenantA,
            deviceType: 'laser',
            clinicalServiceId: svcB,
            parameterSchemaKey: 'laser.generic.v1',
            parameterPayload: {},
            patientId: patientA,
            providerId: actorA,
            recordedBy: actorA,
          },
        }),
      ),
    ).rejects.toThrow(
      /device_treatment_records: tenantId must match clinicalService\.tenantId|clinicalService .* not found|Foreign key|P2003|23514|23503/i,
    );
    const leaked = await withBypass(admin, (tx) =>
      tx.deviceTreatmentRecord.count({ where: { id: attemptId } }),
    );
    expect(leaked).toBe(0);
  });

  it('mixed-parent INSERT device_treatment_records.branchId from tenant B is rejected', async () => {
    const attemptId = randomUUID();
    await expect(
      withTenant(app, tenantA, (tx) =>
        tx.deviceTreatmentRecord.create({
          data: {
            id: attemptId,
            tenantId: tenantA,
            deviceType: 'laser',
            clinicalServiceId: svcA,
            parameterSchemaKey: 'laser.generic.v1',
            parameterPayload: {},
            patientId: patientA,
            providerId: actorA,
            branchId: branchB,
            recordedBy: actorA,
          },
        }),
      ),
    ).rejects.toThrow(
      /device_treatment_records: tenantId must match branch\.tenantId|branch .* not found|Foreign key|P2003|23514|23503/i,
    );
    const leaked = await withBypass(admin, (tx) =>
      tx.deviceTreatmentRecord.count({ where: { id: attemptId } }),
    );
    expect(leaked).toBe(0);
  });

  it('mixed-parent INSERT device_treatment_records.encounterId from tenant B is rejected', async () => {
    const attemptId = randomUUID();
    await expect(
      withTenant(app, tenantA, (tx) =>
        tx.deviceTreatmentRecord.create({
          data: {
            id: attemptId,
            tenantId: tenantA,
            deviceType: 'laser',
            clinicalServiceId: svcA,
            parameterSchemaKey: 'laser.generic.v1',
            parameterPayload: {},
            patientId: patientA,
            providerId: actorA,
            recordedBy: actorA,
            encounterId: encounterB,
          },
        }),
      ),
    ).rejects.toThrow(
      /device_treatment_records: tenantId must match encounter\.tenantId|encounter .* not found|Foreign key|P2003|23514|23503/i,
    );
    const leaked = await withBypass(admin, (tx) =>
      tx.deviceTreatmentRecord.count({ where: { id: attemptId } }),
    );
    expect(leaked).toBe(0);
  });

  it('mixed-parent INSERT device_treatment_records.beautyAnnotationId from tenant B is rejected', async () => {
    const attemptId = randomUUID();
    await expect(
      withTenant(app, tenantA, (tx) =>
        tx.deviceTreatmentRecord.create({
          data: {
            id: attemptId,
            tenantId: tenantA,
            deviceType: 'laser',
            clinicalServiceId: svcA,
            parameterSchemaKey: 'laser.generic.v1',
            parameterPayload: {},
            patientId: patientA,
            providerId: actorA,
            recordedBy: actorA,
            beautyAnnotationId: beautyAnnotationB,
          },
        }),
      ),
    ).rejects.toThrow(
      /device_treatment_records: tenantId must match beautyAnnotation\.tenantId|beautyAnnotation .* not found|Foreign key|P2003|23514|23503/i,
    );
    const leaked = await withBypass(admin, (tx) =>
      tx.deviceTreatmentRecord.count({ where: { id: attemptId } }),
    );
    expect(leaked).toBe(0);
  });

  it('mixed-parent INSERT device_treatment_records.recordedBy from tenant B is rejected', async () => {
    const attemptId = randomUUID();
    await expect(
      withTenant(app, tenantA, (tx) =>
        tx.deviceTreatmentRecord.create({
          data: {
            id: attemptId,
            tenantId: tenantA,
            deviceType: 'laser',
            clinicalServiceId: svcA,
            parameterSchemaKey: 'laser.generic.v1',
            parameterPayload: {},
            patientId: patientA,
            providerId: actorA,
            recordedBy: actorB,
          },
        }),
      ),
    ).rejects.toThrow(
      /device_treatment_records: tenantId must match recordedBy\.tenantId|recordedBy .* not found|Foreign key|P2003|23514|23503/i,
    );
    const leaked = await withBypass(admin, (tx) =>
      tx.deviceTreatmentRecord.count({ where: { id: attemptId } }),
    );
    expect(leaked).toBe(0);
  });

  // --- DeviceTreatmentRecord parent-switch UPDATE (mutable FKs) ---

  it('parent-switch UPDATE providerId on device_treatment_records is rejected', async () => {
    await expect(
      withTenant(app, tenantA, (tx) =>
        tx.deviceTreatmentRecord.update({
          where: { id: deviceA },
          data: { providerId: actorB },
        }),
      ),
    ).rejects.toThrow(
      /device_treatment_records: tenantId must match provider\.tenantId|provider .* not found|Foreign key constraint|P2003|23514|23503/i,
    );
    const row = await withBypass(admin, (tx) =>
      tx.deviceTreatmentRecord.findUniqueOrThrow({ where: { id: deviceA } }),
    );
    expect(row.providerId).toBe(actorA);
  });

  it('parent-switch UPDATE clinicalServiceId on device_treatment_records is rejected', async () => {
    await expect(
      withTenant(app, tenantA, (tx) =>
        tx.deviceTreatmentRecord.update({
          where: { id: deviceA },
          data: { clinicalServiceId: svcB },
        }),
      ),
    ).rejects.toThrow(
      /device_treatment_records: tenantId must match clinicalService\.tenantId|clinicalService .* not found|Foreign key constraint|P2003|23514|23503/i,
    );
    const row = await withBypass(admin, (tx) =>
      tx.deviceTreatmentRecord.findUniqueOrThrow({ where: { id: deviceA } }),
    );
    expect(row.clinicalServiceId).toBe(svcA);
  });

  it('parent-switch UPDATE branchId on device_treatment_records is rejected', async () => {
    await expect(
      withTenant(app, tenantA, (tx) =>
        tx.deviceTreatmentRecord.update({
          where: { id: deviceA },
          data: { branchId: branchB },
        }),
      ),
    ).rejects.toThrow(
      /device_treatment_records: tenantId must match branch\.tenantId|branch .* not found|Foreign key constraint|P2003|23514|23503/i,
    );
    const row = await withBypass(admin, (tx) =>
      tx.deviceTreatmentRecord.findUniqueOrThrow({ where: { id: deviceA } }),
    );
    expect(row.branchId).toBe(branchA);
  });

  it('parent-switch UPDATE encounterId on device_treatment_records is rejected', async () => {
    await expect(
      withTenant(app, tenantA, (tx) =>
        tx.deviceTreatmentRecord.update({
          where: { id: deviceA },
          data: { encounterId: encounterB },
        }),
      ),
    ).rejects.toThrow(
      /device_treatment_records: tenantId must match encounter\.tenantId|encounter .* not found|Foreign key constraint|P2003|23514|23503/i,
    );
    const row = await withBypass(admin, (tx) =>
      tx.deviceTreatmentRecord.findUniqueOrThrow({ where: { id: deviceA } }),
    );
    expect(row.encounterId).toBe(encounterA);
  });

  it('parent-switch UPDATE beautyAnnotationId on device_treatment_records is rejected', async () => {
    await expect(
      withTenant(app, tenantA, (tx) =>
        tx.deviceTreatmentRecord.update({
          where: { id: deviceA },
          data: { beautyAnnotationId: beautyAnnotationB },
        }),
      ),
    ).rejects.toThrow(
      /device_treatment_records: tenantId must match beautyAnnotation\.tenantId|beautyAnnotation .* not found|Foreign key constraint|P2003|23514|23503/i,
    );
    const row = await withBypass(admin, (tx) =>
      tx.deviceTreatmentRecord.findUniqueOrThrow({ where: { id: deviceA } }),
    );
    expect(row.beautyAnnotationId).toBe(beautyAnnotationA);
  });

  it('parent-switch UPDATE patientId on device_treatment_records is rejected', async () => {
    await expect(
      withTenant(app, tenantA, (tx) =>
        tx.deviceTreatmentRecord.update({
          where: { id: deviceA },
          data: { patientId: patientB },
        }),
      ),
    ).rejects.toThrow(
      /device_treatment_records: tenantId must match patient\.tenantId|patient .* not found|Foreign key constraint|P2003|23514|23503/i,
    );
    const row = await withBypass(admin, (tx) =>
      tx.deviceTreatmentRecord.findUniqueOrThrow({ where: { id: deviceA } }),
    );
    expect(row.patientId).toBe(patientA);
  });

  it('parent-switch UPDATE correctedBy on device_treatment_records is rejected', async () => {
    await expect(
      withTenant(app, tenantA, (tx) =>
        tx.deviceTreatmentRecord.update({
          where: { id: deviceA },
          data: { correctedBy: actorB, correctionReason: 'cross-tenant', correctedAt: new Date() },
        }),
      ),
    ).rejects.toThrow(
      /device_treatment_records: tenantId must match correctedBy\.tenantId|correctedBy .* not found|Foreign key constraint|P2003|23514|23503/i,
    );
    const row = await withBypass(admin, (tx) =>
      tx.deviceTreatmentRecord.findUniqueOrThrow({ where: { id: deviceA } }),
    );
    expect(row.correctedBy).toBeNull();
  });
});
