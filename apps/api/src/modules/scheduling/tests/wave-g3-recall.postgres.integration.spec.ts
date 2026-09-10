/**
 * Wave G3 / P1-13 / AR-17 — Recall SoR (PostgreSQL).
 *
 * Run:
 *   ALLOW_TEST_DATABASE_RESET=true RUN_PLATFORM_DB_SECURITY=true \
 *   npx jest --runInBand --testPathIgnorePatterns=[] \
 *     --testPathPattern=wave-g3-recall.postgres
 */
import { randomUUID } from 'crypto';
import {
  AppointmentStatus,
  PatientRecallStatus,
  PrismaClient,
} from '@prisma/client';
import {
  createClinicalPrismaWrapper,
  createPlatformDbSecurityClient,
  platformDbSecurityEnabled,
} from '../../clinical-catalog/tests/clinical-catalog-db.harness';
import { computeDueAt } from '../domain/recall.lifecycle';

jest.setTimeout(120_000);
const describeDb = platformDbSecurityEnabled() ? describe : describe.skip;

const BOOKING_APP_URL =
  'postgresql://booking_app:booking_app@localhost:5433/booking_test?schema=public';

function createTenantAwarePrisma(raw: PrismaClient) {
  const base = createClinicalPrismaWrapper(raw);
  return {
    ...base,
    withTenantContext: async <T>(
      tenantId: string,
      fn: (client: PrismaClient) => Promise<T>,
    ): Promise<T> =>
      raw.$transaction(
        async (tx) => {
          await tx.$executeRaw`SELECT set_config('app.current_tenant_id', ${tenantId}, true)`;
          await tx.$executeRaw`SELECT set_config('app.platform_rls_bypass', 'false', true)`;
          return fn(tx as unknown as PrismaClient);
        },
        { maxWait: 20_000, timeout: 60_000 },
      ),
    withPlatformBypass: base.withPlatformBypass,
  };
}

describeDb('Wave G3 Recall SoR (PostgreSQL)', () => {
  let raw: PrismaClient;
  let wrapper: ReturnType<typeof createTenantAwarePrisma>;
  let tenantId: string;
  let otherTenantId: string;
  let patientId: string;
  let providerId: string;
  let ruleId: string;
  let appointmentId: string;
  let instanceId: string;
  let clinicalServiceId: string;

  beforeAll(async () => {
    raw = await createPlatformDbSecurityClient();
    wrapper = createTenantAwarePrisma(raw);
  });

  afterAll(async () => {
    await raw.$disconnect();
  });

  beforeEach(async () => {
    tenantId = randomUUID();
    otherTenantId = randomUUID();
    patientId = randomUUID();
    providerId = randomUUID();
    ruleId = randomUUID();
    appointmentId = randomUUID();
    instanceId = randomUUID();
    clinicalServiceId = randomUUID();

    await wrapper.withPlatformBypass(async (c) => {
      await c.tenant.create({
        data: { id: tenantId, name: 'G3 Ten', slug: `g3-${tenantId.slice(0, 8)}` },
      });
      await c.tenant.create({
        data: {
          id: otherTenantId,
          name: 'G3 Other',
          slug: `g3-o-${otherTenantId.slice(0, 8)}`,
        },
      });
      await c.user.create({
        data: {
          id: providerId,
          tenantId,
          email: `g3-${providerId.slice(0, 8)}@test.local`,
          passwordHash: 'x',
          firstName: 'Doc',
          lastName: 'Recall',
          roles: { create: [{ role: 'DOCTOR' }] },
        },
      });
      await c.patient.create({
        data: {
          id: patientId,
          tenantId,
          firstName: 'Pat',
          lastName: 'Recall',
          dateOfBirth: new Date('1990-01-01'),
        },
      });
      await c.canonicalClinicalServiceDefinition.create({
        data: {
          id: clinicalServiceId,
          tenantId: null,
          provenance: 'SYSTEM_CANONICAL',
          stableKey: `canonical.g3_${clinicalServiceId.slice(0, 8)}`,
          domain: 'GENERAL',
          lifecycle: 'PUBLISHED',
          publishedAt: new Date(),
          translations: { create: [{ locale: 'en', displayName: 'Recall Svc' }] },
        },
      });
      await c.recallRule.create({
        data: {
          id: ruleId,
          tenantId,
          clinicalServiceId,
          intervalDays: 30,
          eligibilityExpr: {},
          active: true,
        },
      });
      await c.appointment.create({
        data: {
          id: appointmentId,
          tenantId,
          patientId,
          providerId,
          clinicalServiceId,
          scheduledStart: new Date('2026-01-01T10:00:00.000Z'),
          scheduledEnd: new Date('2026-01-01T10:30:00.000Z'),
          status: AppointmentStatus.COMPLETED,
          snapshotWriteMode: 'LEGACY',
        },
      });
    });
  });

  afterEach(async () => {
    await wrapper.withPlatformBypass(async (c) => {
      await c.patientRecallInstance.deleteMany({
        where: { tenantId: { in: [tenantId, otherTenantId] } },
      });
      await c.recallRule.deleteMany({
        where: { tenantId: { in: [tenantId, otherTenantId] } },
      });
      await c.appointmentReminderLog.deleteMany({ where: { tenantId } });
      await c.appointment.deleteMany({ where: { tenantId } });
      await c.clinicalServiceTranslation.deleteMany({
        where: { clinicalServiceId },
      });
      await c.canonicalClinicalServiceDefinition.deleteMany({
        where: { id: clinicalServiceId },
      });
      await c.userRoleAssignment.deleteMany({ where: { userId: providerId } });
      await c.user.deleteMany({ where: { id: providerId } });
      await c.patient.deleteMany({ where: { id: patientId } });
      await c.tenant.deleteMany({ where: { id: { in: [tenantId, otherTenantId] } } });
    });
  });

  it('G3-PG-01 — due scan materializes DUE instance from last qualifying service', async () => {
    try {
      const { ScanRecallDueHandler } = await import(
        '../application/handlers/recall.handlers'
      );
      const handler = new ScanRecallDueHandler(
        wrapper as never,
        { resolve: async () => ({ tenantId, branchId: null, locale: 'en' }) } as never,
        { async produceInApp() {} } as never,
        { async record() {}, async recordInTransaction() {} } as never,
      );

      const asOf = new Date('2026-02-15T00:00:00.000Z');
      const result = await handler.execute({
        actorId: providerId,
        actorRoles: ['DOCTOR'],
        asOf,
        notify: false,
      });
      expect(result.created).toBeGreaterThanOrEqual(1);

      const rows = await wrapper.withTenantContext(tenantId, (c) =>
        c.patientRecallInstance.findMany({
          where: { tenantId, ruleId, status: PatientRecallStatus.DUE, deletedAt: null },
        }),
      );
      expect(rows.length).toBeGreaterThanOrEqual(1);
      expect(rows.some((r) => r.patientId === patientId)).toBe(true);
    } catch (err) {
      // Surface nested errors that Jest sometimes blanks on Windows.
      const msg = err instanceof Error ? `${err.name}: ${err.message}\n${err.stack}` : String(err);
      throw new Error(`G3-PG-01 failed: ${msg}`);
    }
  });

  it('G3-PG-02 — due→book→complete path on SoR instance', async () => {
    const dueAt = computeDueAt(new Date('2026-01-01T10:30:00.000Z'), 30);
    await wrapper.withPlatformBypass(async (c) => {
      await c.patientRecallInstance.create({
        data: {
          id: instanceId,
          tenantId,
          patientId,
          ruleId,
          dueAt,
          status: PatientRecallStatus.DUE,
          lastQualifyingServiceAt: new Date('2026-01-01T10:30:00.000Z'),
        },
      });
    });

    const bookApptId = randomUUID();
    await wrapper.withTenantContext(tenantId, async (c) => {
      await c.appointment.create({
        data: {
          id: bookApptId,
          tenantId,
          patientId,
          providerId,
          scheduledStart: new Date('2026-02-20T10:00:00.000Z'),
          scheduledEnd: new Date('2026-02-20T10:30:00.000Z'),
          status: AppointmentStatus.PENDING,
          snapshotWriteMode: 'LEGACY',
        },
      });
      await c.patientRecallInstance.update({
        where: { id: instanceId },
        data: {
          status: PatientRecallStatus.BOOKED,
          appointmentId: bookApptId,
        },
      });
      await c.patientRecallInstance.update({
        where: { id: instanceId },
        data: {
          status: PatientRecallStatus.COMPLETED,
          completedAt: new Date('2026-02-20T11:00:00.000Z'),
        },
      });
    });

    const row = await wrapper.withPlatformBypass((c) =>
      c.patientRecallInstance.findUnique({ where: { id: instanceId } }),
    );
    expect(row?.status).toBe('COMPLETED');
    expect(row?.appointmentId).toBe(bookApptId);
    expect(row?.completedAt).toBeTruthy();
  });

  it('G3-PG-03 — cross-tenant RLS deny on recall_rules + instances', async () => {
    await wrapper.withPlatformBypass(async (c) => {
      await c.patientRecallInstance.create({
        data: {
          id: instanceId,
          tenantId,
          patientId,
          ruleId,
          dueAt: new Date('2026-02-01T00:00:00.000Z'),
          status: PatientRecallStatus.DUE,
        },
      });
    });

    const app = new PrismaClient({
      datasources: { db: { url: BOOKING_APP_URL } },
    });
    try {
      const foreignRules = await app.$transaction(async (tx) => {
        await tx.$executeRaw`SELECT set_config('app.platform_rls_bypass', 'false', true)`;
        await tx.$executeRaw`SELECT set_config('app.current_tenant_id', ${otherTenantId}, true)`;
        return tx.recallRule.findMany({ where: { id: ruleId } });
      });
      expect(foreignRules).toEqual([]);

      const foreignInst = await app.$transaction(async (tx) => {
        await tx.$executeRaw`SELECT set_config('app.platform_rls_bypass', 'false', true)`;
        await tx.$executeRaw`SELECT set_config('app.current_tenant_id', ${otherTenantId}, true)`;
        return tx.patientRecallInstance.findMany({ where: { id: instanceId } });
      });
      expect(foreignInst).toEqual([]);

      const own = await app.$transaction(async (tx) => {
        await tx.$executeRaw`SELECT set_config('app.platform_rls_bypass', 'false', true)`;
        await tx.$executeRaw`SELECT set_config('app.current_tenant_id', ${tenantId}, true)`;
        return tx.recallRule.findMany({ where: { id: ruleId } });
      });
      expect(own).toHaveLength(1);
    } finally {
      await app.$disconnect();
    }
  });

  it('G3-PG-04 — soft-delete excludes rule from active SoR reads', async () => {
    await wrapper.withTenantContext(tenantId, async (c) => {
      await c.recallRule.update({
        where: { id: ruleId },
        data: { deletedAt: new Date(), active: false },
      });
    });
    const active = await wrapper.withTenantContext(tenantId, (c) =>
      c.recallRule.findMany({
        where: { tenantId, active: true, deletedAt: null },
      }),
    );
    expect(active).toEqual([]);
  });

  it('G3-PG-05 — AppointmentReminderLog alone is not Recall SoR', async () => {
    await wrapper.withPlatformBypass(async (c) => {
      await c.appointmentReminderLog.create({
        data: {
          id: randomUUID(),
          tenantId,
          appointmentId,
          reminderType: '24h',
        },
      });
    });

    const reminders = await wrapper.withPlatformBypass((c) =>
      c.appointmentReminderLog.findMany({ where: { tenantId } }),
    );
    expect(reminders.length).toBeGreaterThan(0);

    const instances = await wrapper.withPlatformBypass((c) =>
      c.patientRecallInstance.findMany({ where: { tenantId } }),
    );
    expect(instances).toEqual([]);

    const rules = await wrapper.withPlatformBypass((c) =>
      c.recallRule.findMany({ where: { tenantId, deletedAt: null } }),
    );
    // Rule exists as SoR; reminder log did not create instances — reminders ≠ SoR.
    expect(rules).toHaveLength(1);
    expect(instances).toHaveLength(0);
  });
});
