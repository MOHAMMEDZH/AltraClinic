/**
 * Wave D RLS — booking_app NOBYPASSRLS.
 */
import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'crypto';
import {
  assertSafePlatformTestDatabaseUrl,
  platformDbSecurityEnabled,
  DEFAULT_PLATFORM_DB_SECURITY_URL,
} from '../../auth/tests/platform-db-security.harness';

jest.setTimeout(120_000);
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

async function adminCount(adminClient: PrismaClient, fn: (tx: PrismaClient) => Promise<number>): Promise<number> {
  return withBypass(adminClient, fn);
}

describeDb('Wave D real RLS (bypass OFF, booking_app)', () => {
  let admin: PrismaClient;
  let app: PrismaClient;
  let tenantA: string;
  let tenantB: string;
  let linkA: string;
  let caseA: string;
  let caseB: string;
  let perfA: string;
  let perfB: string;
  let attachmentA: string;
  let participantA: string;
  let correctionA: string;
  let itemA: string;
  let itemB: string;
  let apptA: string;
  let apptB: string;
  let actorA: string;
  let actorB: string;
  let svcA: string;
  let svcB: string;
  let patientA: string;
  let patientB: string;
  let mediaA: string;
  let mediaB: string;

  beforeAll(async () => {
    assertSafePlatformTestDatabaseUrl(ADMIN_URL);
    admin = new PrismaClient({ datasources: { db: { url: ADMIN_URL } } });
    app = new PrismaClient({ datasources: { db: { url: APP_URL } } });
    await admin.$connect();
    await app.$connect();
    tenantA = randomUUID();
    tenantB = randomUUID();
    linkA = randomUUID();
    caseA = randomUUID();
    caseB = randomUUID();
    perfA = randomUUID();
    perfB = randomUUID();
    attachmentA = randomUUID();
    participantA = randomUUID();
    correctionA = randomUUID();
    patientA = randomUUID();
    patientB = randomUUID();
    actorA = randomUUID();
    actorB = randomUUID();
    const planA = randomUUID();
    const phaseA = randomUUID();
    itemA = randomUUID();
    itemB = randomUUID();
    apptA = randomUUID();
    apptB = randomUUID();
    svcA = randomUUID();
    svcB = randomUUID();
    mediaA = randomUUID();
    mediaB = randomUUID();

    await withBypass(admin, async (tx) => {
      await tx.tenant.createMany({
        data: [
          { id: tenantA, name: 'WD RLS A', slug: `wd-rls-a-${tenantA.slice(0, 8)}` },
          { id: tenantB, name: 'WD RLS B', slug: `wd-rls-b-${tenantB.slice(0, 8)}` },
        ],
      });
      await tx.user.create({
        data: {
          id: actorA,
          tenantId: tenantA,
          email: `wd-rls-${actorA.slice(0, 8)}@t.local`,
          passwordHash: 'x',
          firstName: 'A',
          lastName: 'A',
        },
      });
      await tx.user.create({
        data: {
          id: actorB,
          tenantId: tenantB,
          email: `wd-rls-${actorB.slice(0, 8)}@t.local`,
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
          domain: 'DENTAL',
          lifecycle: 'PUBLISHED',
        },
      });
      await tx.canonicalClinicalServiceDefinition.create({
        data: {
          id: svcB,
          tenantId: tenantB,
          provenance: 'TENANT_CUSTOM',
          stableKey: `tenant.${tenantB}.custom.rls-${svcB.slice(0, 8)}`,
          domain: 'DENTAL',
          lifecycle: 'PUBLISHED',
        },
      });
      const planB = randomUUID();
      const phaseB = randomUUID();
      await tx.treatmentPlan.create({
        data: { id: planB, tenantId: tenantB, patientId: patientB, title: 'RLS B', createdBy: actorB },
      });
      await tx.treatmentPhase.create({
        data: { id: phaseB, planId: planB, tenantId: tenantB, name: 'P1', sortOrder: 0 },
      });
      await tx.treatmentPlanItem.create({
        data: {
          id: itemB,
          phaseId: phaseB,
          tenantId: tenantB,
          code: 'D2',
          description: 'Item B',
        },
      });
      await tx.appointment.create({
        data: {
          id: apptB,
          tenantId: tenantB,
          patientId: patientB,
          providerId: actorB,
          scheduledStart: new Date('2026-09-02T10:00:00.000Z'),
          scheduledEnd: new Date('2026-09-02T11:00:00.000Z'),
        },
      });
      await tx.dentalLabCase.create({
        data: {
          id: caseB,
          tenantId: tenantB,
          patientId: patientB,
          providerId: actorB,
          labVendor: 'Lab B',
          caseType: 'CROWN',
          createdBy: actorB,
        },
      });
      await tx.servicePerformance.create({
        data: {
          id: perfB,
          tenantId: tenantB,
          clinicalServiceId: svcB,
          performedAt: new Date(),
          createdBy: actorB,
        },
      });
      await tx.mediaAsset.create({
        data: {
          id: mediaB,
          tenantId: tenantB,
          category: 'DENTAL_IMAGE',
          ownerType: 'patient',
          ownerId: patientB,
          patientId: patientB,
          originalFilename: 'b.png',
          uploadedBy: actorB,
          storageKey: `seed/${tenantB}`,
          mimeType: 'image/png',
          sizeBytes: 1,
          status: 'READY',
          virusScanStatus: 'CLEAN',
        },
      });
      await tx.treatmentPlan.create({
        data: { id: planA, tenantId: tenantA, patientId: patientA, title: 'RLS', createdBy: actorA },
      });
      await tx.treatmentPhase.create({
        data: { id: phaseA, planId: planA, tenantId: tenantA, name: 'P1', sortOrder: 0 },
      });
      await tx.treatmentPlanItem.create({
        data: {
          id: itemA,
          phaseId: phaseA,
          tenantId: tenantA,
          code: 'D1',
          description: 'Item',
        },
      });
      await tx.appointment.create({
        data: {
          id: apptA,
          tenantId: tenantA,
          patientId: patientA,
          providerId: actorA,
          scheduledStart: new Date('2026-09-01T10:00:00.000Z'),
          scheduledEnd: new Date('2026-09-01T11:00:00.000Z'),
        },
      });
      await tx.treatmentPlanItemAppointment.create({
        data: {
          id: linkA,
          tenantId: tenantA,
          planItemId: itemA,
          appointmentId: apptA,
          createdBy: actorA,
        },
      });
      await tx.dentalLabCase.create({
        data: {
          id: caseA,
          tenantId: tenantA,
          patientId: patientA,
          providerId: actorA,
          labVendor: 'Lab',
          caseType: 'CROWN',
          createdBy: actorA,
        },
      });
      await tx.servicePerformance.create({
        data: {
          id: perfA,
          tenantId: tenantA,
          clinicalServiceId: svcA,
          performedAt: new Date(),
          createdBy: actorA,
        },
      });
      await tx.servicePerformanceParticipant.create({
        data: {
          id: participantA,
          tenantId: tenantA,
          performanceId: perfA,
          userId: actorA,
          role: 'PRIMARY',
          attributionShare: 100,
          recordedBy: actorA,
        },
      });
      await tx.servicePerformanceCorrection.create({
        data: {
          id: correctionA,
          tenantId: tenantA,
          performanceId: perfA,
          reason: 'seed',
          actorId: actorA,
          previousParticipants: [{ userId: actorA, role: 'PRIMARY', attributionShare: 100 }],
        },
      });
      await tx.mediaAsset.create({
        data: {
          id: mediaA,
          tenantId: tenantA,
          category: 'DENTAL_IMAGE',
          ownerType: 'patient',
          ownerId: patientA,
          patientId: patientA,
          originalFilename: 'seed.png',
          uploadedBy: actorA,
          storageKey: `seed/${tenantA}`,
          mimeType: 'image/png',
          sizeBytes: 1,
          status: 'READY',
          virusScanStatus: 'CLEAN',
        },
      });
      await tx.dentalLabCaseAttachment.create({
        data: {
          id: attachmentA,
          tenantId: tenantA,
          labCaseId: caseA,
          mediaAssetId: mediaA,
          attachedBy: actorA,
        },
      });
    });
  });

  afterAll(async () => {
    await app.$disconnect();
    await admin.$disconnect();
  });

  it('same-tenant SELECT sees Wave D rows', async () => {
    const links = await withTenant(app, tenantA, (tx) =>
      tx.treatmentPlanItemAppointment.findMany({ where: { id: linkA } }),
    );
    const cases = await withTenant(app, tenantA, (tx) =>
      tx.dentalLabCase.findMany({ where: { id: caseA } }),
    );
    const perfs = await withTenant(app, tenantA, (tx) =>
      tx.servicePerformance.findMany({ where: { id: perfA } }),
    );
    const attachments = await withTenant(app, tenantA, (tx) =>
      tx.dentalLabCaseAttachment.findMany({ where: { id: attachmentA } }),
    );
    const participants = await withTenant(app, tenantA, (tx) =>
      tx.servicePerformanceParticipant.findMany({ where: { id: participantA } }),
    );
    const corrections = await withTenant(app, tenantA, (tx) =>
      tx.servicePerformanceCorrection.findMany({ where: { id: correctionA } }),
    );
    expect(links).toHaveLength(1);
    expect(cases).toHaveLength(1);
    expect(perfs).toHaveLength(1);
    expect(attachments).toHaveLength(1);
    expect(participants).toHaveLength(1);
    expect(corrections).toHaveLength(1);
  });

  it('cross-tenant SELECT is empty', async () => {
    const links = await withTenant(app, tenantB, (tx) =>
      tx.treatmentPlanItemAppointment.findMany({ where: { id: linkA } }),
    );
    const cases = await withTenant(app, tenantB, (tx) =>
      tx.dentalLabCase.findMany({ where: { id: caseA } }),
    );
    const perfs = await withTenant(app, tenantB, (tx) =>
      tx.servicePerformance.findMany({ where: { id: perfA } }),
    );
    const attachments = await withTenant(app, tenantB, (tx) =>
      tx.dentalLabCaseAttachment.findMany({ where: { id: attachmentA } }),
    );
    const participants = await withTenant(app, tenantB, (tx) =>
      tx.servicePerformanceParticipant.findMany({ where: { id: participantA } }),
    );
    const corrections = await withTenant(app, tenantB, (tx) =>
      tx.servicePerformanceCorrection.findMany({ where: { id: correctionA } }),
    );
    expect(links).toHaveLength(0);
    expect(cases).toHaveLength(0);
    expect(perfs).toHaveLength(0);
    expect(attachments).toHaveLength(0);
    expect(participants).toHaveLength(0);
    expect(corrections).toHaveLength(0);
  });

  it('NOBYPASSRLS context is active', async () => {
    const proof = await nobypassProof(app, tenantA);
    expect(proof.currentUser).toBeTruthy();
    expect(proof.bypass).toBe(false);
    expect(proof.tenantId).toBe(tenantA);
  });

  it('cross-tenant INSERT/UPDATE/DELETE are denied for Wave D tables', async () => {
    await expect(
      withTenant(app, tenantB, (tx) =>
        tx.treatmentPlanItemAppointment.create({
          data: {
            id: randomUUID(),
            tenantId: tenantA,
            planItemId: randomUUID(),
            appointmentId: randomUUID(),
            createdBy: randomUUID(),
          },
        }),
      ),
    ).rejects.toThrow();

    await expect(
      withTenant(app, tenantB, (tx) =>
        tx.dentalLabCase.create({
          data: {
            id: randomUUID(),
            tenantId: tenantA,
            patientId: randomUUID(),
            providerId: randomUUID(),
            labVendor: 'x',
            caseType: 'CROWN',
            createdBy: randomUUID(),
          },
        }),
      ),
    ).rejects.toThrow();

    await expect(
      withTenant(app, tenantB, (tx) =>
        tx.dentalLabCaseAttachment.create({
          data: {
            id: randomUUID(),
            tenantId: tenantA,
            labCaseId: caseA,
            mediaAssetId: randomUUID(),
            attachedBy: randomUUID(),
          },
        }),
      ),
    ).rejects.toThrow();

    await expect(
      withTenant(app, tenantB, (tx) =>
        tx.servicePerformance.create({
          data: {
            id: randomUUID(),
            tenantId: tenantA,
            clinicalServiceId: randomUUID(),
            performedAt: new Date(),
            createdBy: randomUUID(),
          },
        }),
      ),
    ).rejects.toThrow();

    const updates = await withTenant(app, tenantB, async (tx) => ({
      links: await tx.treatmentPlanItemAppointment.updateMany({
        where: { id: linkA },
        data: { sortOrder: 77 },
      }),
      cases: await tx.dentalLabCase.updateMany({
        where: { id: caseA },
        data: { notes: 'x' },
      }),
      attachments: await tx.dentalLabCaseAttachment.updateMany({
        where: { id: attachmentA },
        data: { attachedBy: randomUUID() },
      }),
      perfs: await tx.servicePerformance.updateMany({
        where: { id: perfA },
        data: { cancelledBy: randomUUID() },
      }),
      participants: await tx.servicePerformanceParticipant.updateMany({
        where: { id: participantA },
        data: { attributionShare: 50 },
      }),
      corrections: await tx.servicePerformanceCorrection.updateMany({
        where: { id: correctionA },
        data: { reason: 'x' },
      }),
    }));
    expect(updates.links.count).toBe(0);
    expect(updates.cases.count).toBe(0);
    expect(updates.attachments.count).toBe(0);
    expect(updates.perfs.count).toBe(0);
    expect(updates.participants.count).toBe(0);
    expect(updates.corrections.count).toBe(0);

    const deletes = await withTenant(app, tenantB, async (tx) => ({
      links: await tx.treatmentPlanItemAppointment.deleteMany({ where: { id: linkA } }),
      cases: await tx.dentalLabCase.deleteMany({ where: { id: caseA } }),
      attachments: await tx.dentalLabCaseAttachment.deleteMany({ where: { id: attachmentA } }),
      perfs: await tx.servicePerformance.deleteMany({ where: { id: perfA } }),
      participants: await tx.servicePerformanceParticipant.deleteMany({ where: { id: participantA } }),
      corrections: await tx.servicePerformanceCorrection.deleteMany({ where: { id: correctionA } }),
    }));
    expect(deletes.links.count).toBe(0);
    expect(deletes.cases.count).toBe(0);
    expect(deletes.attachments.count).toBe(0);
    expect(deletes.perfs.count).toBe(0);
    expect(deletes.participants.count).toBe(0);
    expect(deletes.corrections.count).toBe(0);
  });

  it('same-tenant INSERT succeeds for all six Wave D tables under RLS', async () => {
    const apptA2 = randomUUID();
    await withBypass(admin, (tx) =>
      tx.appointment.create({
        data: {
          id: apptA2,
          tenantId: tenantA,
          patientId: patientA,
          providerId: actorA,
          scheduledStart: new Date('2026-09-03T10:00:00.000Z'),
          scheduledEnd: new Date('2026-09-03T11:00:00.000Z'),
        },
      }),
    );
    const ids = {
      link: randomUUID(),
      labCase: randomUUID(),
      attachment: randomUUID(),
      perf: randomUUID(),
      participant: randomUUID(),
      correction: randomUUID(),
    };
    await withTenant(app, tenantA, async (tx) => {
      await tx.treatmentPlanItemAppointment.create({
        data: {
          id: ids.link,
          tenantId: tenantA,
          planItemId: itemA,
          appointmentId: apptA2,
          createdBy: actorA,
        },
      });
      await tx.dentalLabCase.create({
        data: {
          id: ids.labCase,
          tenantId: tenantA,
          patientId: patientA,
          providerId: actorA,
          labVendor: 'Same tenant',
          caseType: 'CROWN',
          createdBy: actorA,
        },
      });
      await tx.dentalLabCaseAttachment.create({
        data: {
          id: ids.attachment,
          tenantId: tenantA,
          labCaseId: ids.labCase,
          mediaAssetId: mediaA,
          attachedBy: actorA,
        },
      });
      await tx.servicePerformance.create({
        data: {
          id: ids.perf,
          tenantId: tenantA,
          clinicalServiceId: svcA,
          performedAt: new Date(),
          createdBy: actorA,
        },
      });
      await tx.servicePerformanceParticipant.create({
        data: {
          id: ids.participant,
          tenantId: tenantA,
          performanceId: ids.perf,
          userId: actorA,
          role: 'PRIMARY',
          attributionShare: 100,
          recordedBy: actorA,
        },
      });
      await tx.servicePerformanceCorrection.create({
        data: {
          id: ids.correction,
          tenantId: tenantA,
          performanceId: ids.perf,
          reason: 'same tenant insert',
          actorId: actorA,
          previousParticipants: [{ userId: actorA, role: 'PRIMARY', attributionShare: 100 }],
        },
      });
    });
    const counts = await withTenant(app, tenantA, async (tx) => ({
      link: await tx.treatmentPlanItemAppointment.count({ where: { id: ids.link } }),
      labCase: await tx.dentalLabCase.count({ where: { id: ids.labCase } }),
      attachment: await tx.dentalLabCaseAttachment.count({ where: { id: ids.attachment } }),
      perf: await tx.servicePerformance.count({ where: { id: ids.perf } }),
      participant: await tx.servicePerformanceParticipant.count({ where: { id: ids.participant } }),
      correction: await tx.servicePerformanceCorrection.count({ where: { id: ids.correction } }),
    }));
    expect(counts.link).toBe(1);
    expect(counts.labCase).toBe(1);
    expect(counts.attachment).toBe(1);
    expect(counts.perf).toBe(1);
    expect(counts.participant).toBe(1);
    expect(counts.correction).toBe(1);
  });

  it('mixed-tenant parent INSERT is rejected when child.tenantId matches current tenant', async () => {
    await expect(
      withTenant(app, tenantB, (tx) =>
        tx.treatmentPlanItemAppointment.create({
          data: {
            id: randomUUID(),
            tenantId: tenantB,
            planItemId: itemA,
            appointmentId: apptB,
            createdBy: actorB,
          },
        }),
      ),
    ).rejects.toThrow(/planItem|tenantId must match|Foreign key/i);

    await expect(
      withTenant(app, tenantB, (tx) =>
        tx.treatmentPlanItemAppointment.create({
          data: {
            id: randomUUID(),
            tenantId: tenantB,
            planItemId: itemB,
            appointmentId: apptA,
            createdBy: actorB,
          },
        }),
      ),
    ).rejects.toThrow(/appointment|tenantId must match|Foreign key/i);

    await expect(
      withTenant(app, tenantB, (tx) =>
        tx.dentalLabCaseAttachment.create({
          data: {
            id: randomUUID(),
            tenantId: tenantB,
            labCaseId: caseB,
            mediaAssetId: mediaA,
            attachedBy: actorB,
          },
        }),
      ),
    ).rejects.toThrow(/mediaAsset|tenantId must match|Foreign key/i);

    await expect(
      withTenant(app, tenantB, (tx) =>
        tx.servicePerformanceParticipant.create({
          data: {
            id: randomUUID(),
            tenantId: tenantB,
            performanceId: perfB,
            userId: actorA,
            role: 'PRIMARY',
            attributionShare: 100,
            recordedBy: actorB,
          },
        }),
      ),
    ).rejects.toThrow(/user|tenantId must match|Foreign key/i);

    await expect(
      withTenant(app, tenantB, (tx) =>
        tx.servicePerformanceCorrection.create({
          data: {
            id: randomUUID(),
            tenantId: tenantB,
            performanceId: perfB,
            reason: 'mixed',
            actorId: actorA,
            previousParticipants: [],
          },
        }),
      ),
    ).rejects.toThrow(/actor|tenantId must match|Foreign key/i);
  });

  // Round 3 — explicit B4 QA closure (NOBYPASSRLS, booking_app)
  it('R3-T1 attachment mixed-tenant labCaseId INSERT rejected under tenant B', async () => {
    const proof = await nobypassProof(app, tenantB);
    expect(proof.bypass).toBe(false);
    expect(proof.tenantId).toBe(tenantB);

    const attemptId = randomUUID();
    await expect(
      withTenant(app, tenantB, (tx) =>
        tx.dentalLabCaseAttachment.create({
          data: {
            id: attemptId,
            tenantId: tenantB,
            labCaseId: caseA,
            mediaAssetId: mediaB,
            attachedBy: actorB,
          },
        }),
      ),
    ).rejects.toThrow(/labCase|tenantId must match|Foreign key/i);

    expect(await adminCount(admin, (tx) => tx.dentalLabCaseAttachment.count({ where: { id: attemptId } }))).toBe(0);

    const controlId = randomUUID();
    await withTenant(app, tenantB, (tx) =>
      tx.dentalLabCaseAttachment.create({
        data: {
          id: controlId,
          tenantId: tenantB,
          labCaseId: caseB,
          mediaAssetId: mediaB,
          attachedBy: actorB,
        },
      }),
    );
    expect(await adminCount(admin, (tx) => tx.dentalLabCaseAttachment.count({ where: { id: controlId } }))).toBe(1);
  });

  it('R3-T2 participant mixed-tenant performanceId INSERT rejected under tenant B', async () => {
    const attemptId = randomUUID();
    await expect(
      withTenant(app, tenantB, (tx) =>
        tx.servicePerformanceParticipant.create({
          data: {
            id: attemptId,
            tenantId: tenantB,
            performanceId: perfA,
            userId: actorB,
            role: 'PRIMARY',
            attributionShare: 100,
            recordedBy: actorB,
          },
        }),
      ),
    ).rejects.toThrow(/performance|tenantId must match|Foreign key/i);

    expect(await adminCount(admin, (tx) => tx.servicePerformanceParticipant.count({ where: { id: attemptId } }))).toBe(
      0,
    );
  });

  it('R3-T3 correction mixed-tenant performanceId INSERT rejected under tenant B', async () => {
    const attemptId = randomUUID();
    await expect(
      withTenant(app, tenantB, (tx) =>
        tx.servicePerformanceCorrection.create({
          data: {
            id: attemptId,
            tenantId: tenantB,
            performanceId: perfA,
            reason: 'foreign perf',
            actorId: actorB,
            previousParticipants: [],
          },
        }),
      ),
    ).rejects.toThrow(/performance|tenantId must match|Foreign key/i);

    expect(await adminCount(admin, (tx) => tx.servicePerformanceCorrection.count({ where: { id: attemptId } }))).toBe(0);
  });

  it('R3-T4 participant wrong child tenantId INSERT rejected by RLS under tenant B', async () => {
    const attemptId = randomUUID();
    await expect(
      withTenant(app, tenantB, (tx) =>
        tx.servicePerformanceParticipant.create({
          data: {
            id: attemptId,
            tenantId: tenantA,
            performanceId: perfA,
            userId: actorA,
            role: 'PRIMARY',
            attributionShare: 100,
            recordedBy: actorA,
          },
        }),
      ),
    ).rejects.toThrow();

    expect(await adminCount(admin, (tx) => tx.servicePerformanceParticipant.count({ where: { id: attemptId } }))).toBe(
      0,
    );
  });

  it('R3-T5 correction wrong child tenantId INSERT rejected by RLS under tenant B', async () => {
    const attemptId = randomUUID();
    await expect(
      withTenant(app, tenantB, (tx) =>
        tx.servicePerformanceCorrection.create({
          data: {
            id: attemptId,
            tenantId: tenantA,
            performanceId: perfA,
            reason: 'wrong tenant row',
            actorId: actorA,
            previousParticipants: [],
          },
        }),
      ),
    ).rejects.toThrow();

    expect(await adminCount(admin, (tx) => tx.servicePerformanceCorrection.count({ where: { id: attemptId } }))).toBe(
      0,
    );
  });

  it('R3 parent-switch UPDATE rejected for attachment labCaseId and participant performanceId', async () => {
    await expect(
      withTenant(app, tenantA, (tx) =>
        tx.dentalLabCaseAttachment.update({ where: { id: attachmentA }, data: { labCaseId: caseB } }),
      ),
    ).rejects.toThrow(/labCase|tenantId must match|Foreign key/i);
    expect(
      (await withTenant(app, tenantA, (tx) => tx.dentalLabCaseAttachment.findUnique({ where: { id: attachmentA } })))
        ?.labCaseId,
    ).toBe(caseA);

    await expect(
      withTenant(app, tenantA, (tx) =>
        tx.servicePerformanceParticipant.update({ where: { id: participantA }, data: { performanceId: perfB } }),
      ),
    ).rejects.toThrow(/performance|tenantId must match|Foreign key/i);
    expect(
      (await withTenant(app, tenantA, (tx) => tx.servicePerformanceParticipant.findUnique({ where: { id: participantA } })))
        ?.performanceId,
    ).toBe(perfA);

  });

  it('R3 parent-switch UPDATE rejected for link appointmentId', async () => {
    await expect(
      withTenant(app, tenantA, (tx) =>
        tx.treatmentPlanItemAppointment.update({ where: { id: linkA }, data: { appointmentId: apptB } }),
      ),
    ).rejects.toThrow(/appointment|tenantId must match|Foreign key/i);
    expect(
      (await withTenant(app, tenantA, (tx) => tx.treatmentPlanItemAppointment.findUnique({ where: { id: linkA } })))
        ?.appointmentId,
    ).toBe(apptA);
  });

  it('R3 service_performance_corrections UPDATE is intentionally immutable via RLS (append-only)', async () => {
    await expect(
      withTenant(app, tenantA, (tx) =>
        tx.servicePerformanceCorrection.update({ where: { id: correctionA }, data: { reason: 'mutated' } }),
      ),
    ).rejects.toThrow();
    expect(
      (await withTenant(app, tenantA, (tx) => tx.servicePerformanceCorrection.findUnique({ where: { id: correctionA } })))
        ?.reason,
    ).toBe('seed');
    expect(
      (
        await withTenant(app, tenantA, (tx) =>
          tx.servicePerformanceCorrection.updateMany({
            where: { id: correctionA },
            data: { performanceId: perfB },
          }),
        )
      ).count,
    ).toBe(0);
    expect(
      (
        await withTenant(app, tenantA, (tx) =>
          tx.servicePerformanceCorrection.updateMany({ where: { id: correctionA }, data: { actorId: actorB } }),
        )
      ).count,
    ).toBe(0);
  });

  it('R3 six-table RLS lifecycle matrix has explicit per-operation proof', async () => {
    expect(
      await withTenant(app, tenantA, (tx) => tx.treatmentPlanItemAppointment.findMany({ where: { id: linkA } })),
    ).toHaveLength(1);
    expect(
      await withTenant(app, tenantB, (tx) => tx.treatmentPlanItemAppointment.findMany({ where: { id: linkA } })),
    ).toHaveLength(0);
    await expect(
      withTenant(app, tenantB, (tx) =>
        tx.treatmentPlanItemAppointment.create({
          data: {
            id: randomUUID(),
            tenantId: tenantA,
            planItemId: itemA,
            appointmentId: apptA,
            createdBy: actorA,
          },
        }),
      ),
    ).rejects.toThrow();
    expect(
      (await withTenant(app, tenantB, (tx) =>
        tx.treatmentPlanItemAppointment.updateMany({ where: { id: linkA }, data: { sortOrder: 99 } }),
      )).count,
    ).toBe(0);
    expect(
      (await withTenant(app, tenantB, (tx) => tx.treatmentPlanItemAppointment.deleteMany({ where: { id: linkA } })))
        .count,
    ).toBe(0);

    expect(await withTenant(app, tenantA, (tx) => tx.dentalLabCase.findMany({ where: { id: caseA } }))).toHaveLength(1);
    expect(await withTenant(app, tenantB, (tx) => tx.dentalLabCase.findMany({ where: { id: caseA } }))).toHaveLength(0);
    await expect(
      withTenant(app, tenantB, (tx) =>
        tx.dentalLabCase.create({
          data: {
            id: randomUUID(),
            tenantId: tenantA,
            patientId: patientA,
            providerId: actorA,
            labVendor: 'x',
            caseType: 'CROWN',
            createdBy: actorA,
          },
        }),
      ),
    ).rejects.toThrow();
    expect(
      (await withTenant(app, tenantB, (tx) => tx.dentalLabCase.updateMany({ where: { id: caseA }, data: { notes: 'x' } })))
        .count,
    ).toBe(0);
    expect((await withTenant(app, tenantB, (tx) => tx.dentalLabCase.deleteMany({ where: { id: caseA } }))).count).toBe(
      0,
    );

    expect(
      await withTenant(app, tenantA, (tx) => tx.dentalLabCaseAttachment.findMany({ where: { id: attachmentA } })),
    ).toHaveLength(1);
    expect(
      await withTenant(app, tenantB, (tx) => tx.dentalLabCaseAttachment.findMany({ where: { id: attachmentA } })),
    ).toHaveLength(0);
    await expect(
      withTenant(app, tenantB, (tx) =>
        tx.dentalLabCaseAttachment.create({
          data: {
            id: randomUUID(),
            tenantId: tenantA,
            labCaseId: caseA,
            mediaAssetId: mediaA,
            attachedBy: actorA,
          },
        }),
      ),
    ).rejects.toThrow();
    expect(
      (
        await withTenant(app, tenantB, (tx) =>
          tx.dentalLabCaseAttachment.updateMany({ where: { id: attachmentA }, data: { attachedBy: actorB } }),
        )
      ).count,
    ).toBe(0);
    expect(
      (await withTenant(app, tenantB, (tx) => tx.dentalLabCaseAttachment.deleteMany({ where: { id: attachmentA } })))
        .count,
    ).toBe(0);

    expect(await withTenant(app, tenantA, (tx) => tx.servicePerformance.findMany({ where: { id: perfA } }))).toHaveLength(
      1,
    );
    expect(await withTenant(app, tenantB, (tx) => tx.servicePerformance.findMany({ where: { id: perfA } }))).toHaveLength(
      0,
    );
    await expect(
      withTenant(app, tenantB, (tx) =>
        tx.servicePerformance.create({
          data: {
            id: randomUUID(),
            tenantId: tenantA,
            clinicalServiceId: svcA,
            performedAt: new Date(),
            createdBy: actorA,
          },
        }),
      ),
    ).rejects.toThrow();
    expect(
      (
        await withTenant(app, tenantB, (tx) =>
          tx.servicePerformance.updateMany({ where: { id: perfA }, data: { cancelledBy: actorB } }),
        )
      ).count,
    ).toBe(0);
    expect((await withTenant(app, tenantB, (tx) => tx.servicePerformance.deleteMany({ where: { id: perfA } }))).count).toBe(
      0,
    );

    expect(
      await withTenant(app, tenantA, (tx) => tx.servicePerformanceParticipant.findMany({ where: { id: participantA } })),
    ).toHaveLength(1);
    expect(
      await withTenant(app, tenantB, (tx) => tx.servicePerformanceParticipant.findMany({ where: { id: participantA } })),
    ).toHaveLength(0);
    await expect(
      withTenant(app, tenantB, (tx) =>
        tx.servicePerformanceParticipant.create({
          data: {
            id: randomUUID(),
            tenantId: tenantA,
            performanceId: perfA,
            userId: actorA,
            role: 'PRIMARY',
            attributionShare: 100,
            recordedBy: actorA,
          },
        }),
      ),
    ).rejects.toThrow();
    expect(
      (
        await withTenant(app, tenantB, (tx) =>
          tx.servicePerformanceParticipant.updateMany({
            where: { id: participantA },
            data: { attributionShare: 50 },
          }),
        )
      ).count,
    ).toBe(0);
    expect(
      (await withTenant(app, tenantB, (tx) => tx.servicePerformanceParticipant.deleteMany({ where: { id: participantA } })))
        .count,
    ).toBe(0);

    expect(
      await withTenant(app, tenantA, (tx) => tx.servicePerformanceCorrection.findMany({ where: { id: correctionA } })),
    ).toHaveLength(1);
    expect(
      await withTenant(app, tenantB, (tx) => tx.servicePerformanceCorrection.findMany({ where: { id: correctionA } })),
    ).toHaveLength(0);
    await expect(
      withTenant(app, tenantB, (tx) =>
        tx.servicePerformanceCorrection.create({
          data: {
            id: randomUUID(),
            tenantId: tenantA,
            performanceId: perfA,
            reason: 'rls',
            actorId: actorA,
            previousParticipants: [],
          },
        }),
      ),
    ).rejects.toThrow();
    expect(
      (
        await withTenant(app, tenantB, (tx) =>
          tx.servicePerformanceCorrection.updateMany({ where: { id: correctionA }, data: { reason: 'x' } }),
        )
      ).count,
    ).toBe(0);
    expect(
      (await withTenant(app, tenantB, (tx) => tx.servicePerformanceCorrection.deleteMany({ where: { id: correctionA } })))
        .count,
    ).toBe(0);
  });

  it('parent-switch UPDATE is rejected for child Wave D relations', async () => {
    await expect(
      withTenant(app, tenantA, (tx) =>
        tx.treatmentPlanItemAppointment.update({
          where: { id: linkA },
          data: { planItemId: itemB },
        }),
      ),
    ).rejects.toThrow(/planItem|tenantId must match|Foreign key/i);

    await expect(
      withTenant(app, tenantA, (tx) =>
        tx.dentalLabCaseAttachment.update({
          where: { id: attachmentA },
          data: { mediaAssetId: mediaB },
        }),
      ),
    ).rejects.toThrow(/mediaAsset|tenantId must match|Foreign key/i);

    await expect(
      withTenant(app, tenantA, (tx) =>
        tx.servicePerformanceParticipant.update({
          where: { id: participantA },
          data: { userId: actorB },
        }),
      ),
    ).rejects.toThrow(/user|tenantId must match|Foreign key/i);
  });
});
