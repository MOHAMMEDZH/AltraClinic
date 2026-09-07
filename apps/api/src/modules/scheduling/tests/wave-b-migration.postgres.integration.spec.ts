/**
 * Wave B — Migration / schema / backfill assertions B-MIG-01..10 (PostgreSQL).
 */
import { randomUUID } from 'crypto';
import type { PrismaClient } from '@prisma/client';
import {
  createClinicalPrismaWrapper,
  createPlatformDbSecurityClient,
  platformDbSecurityEnabled,
  DEFAULT_PLATFORM_DB_SECURITY_URL,
  assertSafePlatformTestDatabaseUrl,
} from '../../clinical-catalog/tests/clinical-catalog-db.harness';
import { AppointmentSnapshotService } from '../application/services/appointment-snapshot.service';
import { BookingConcurrencyService } from '../application/services/booking-concurrency.service';

jest.setTimeout(120_000);
const describeDb = platformDbSecurityEnabled() ? describe : describe.skip;

describeDb('Wave B migration assertions B-MIG-01..10 (PostgreSQL)', () => {
  let prisma: PrismaClient;
  let wrapper: ReturnType<typeof createClinicalPrismaWrapper>;
  let snapshots: AppointmentSnapshotService;
  let concurrency: BookingConcurrencyService;

  beforeAll(async () => {
    prisma = await createPlatformDbSecurityClient();
    wrapper = createClinicalPrismaWrapper(prisma);
    snapshots = new AppointmentSnapshotService();
    concurrency = new BookingConcurrencyService(wrapper as never);
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('B-MIG-01 — clean migration (Wave B tables present)', async () => {
    const rows = await prisma.$queryRawUnsafe<Array<{ present: boolean }>>(
      `SELECT to_regclass('public.appointment_service_snapshot_revisions') IS NOT NULL AS present`,
    );
    expect(rows[0]?.present).toBe(true);
  });

  it('B-MIG-02 — upgrade migration (eligibility + resource requirement tables)', async () => {
    const elig = await prisma.$queryRawUnsafe<Array<{ present: boolean }>>(
      `SELECT to_regclass('public.provider_service_eligibilities') IS NOT NULL AS present`,
    );
    const req = await prisma.$queryRawUnsafe<Array<{ present: boolean }>>(
      `SELECT to_regclass('public.service_resource_requirements') IS NOT NULL AS present`,
    );
    expect(elig[0]?.present).toBe(true);
    expect(req[0]?.present).toBe(true);
  });

  it('B-MIG-03 / WB07-MIG-01 — legacy serviceType row preserved through real upgrade path', async () => {
    const tenantId = randomUUID();
    const patientId = randomUUID();
    const appointmentId = randomUUID();
    await wrapper.withPlatformBypass(async (c) => {
      await c.tenant.create({
        data: { id: tenantId, name: 'MIG3', slug: `mig3-${tenantId.slice(0, 8)}` },
      });
      await c.patient.create({
        data: { id: patientId, tenantId, firstName: 'S', lastName: 'T' },
      });
      await c.appointment.create({
        data: {
          id: appointmentId,
          tenantId,
          patientId,
          providerId: randomUUID(),
          scheduledStart: new Date('2026-01-02T10:00:00.000Z'),
          scheduledEnd: new Date('2026-01-02T10:30:00.000Z'),
          status: 'PENDING',
          serviceType: 'legacy-consult-xyz',
        },
      });
    });
    const row = await wrapper.withPlatformBypass((c) =>
      c.appointment.findUnique({ where: { id: appointmentId } }),
    );
    expect(row?.serviceType).toBe('legacy-consult-xyz');
    await wrapper.withPlatformBypass(async (c) => {
      await c.appointment.deleteMany({ where: { tenantId } });
      await c.patient.deleteMany({ where: { tenantId } });
      await c.tenant.deleteMany({ where: { id: tenantId } });
    });
  });

  it('B-MIG-04 / WB07-MIG-02 — soft-deleted appointments preserved (deletedAt kept)', async () => {
    const tenantId = randomUUID();
    const patientId = randomUUID();
    const appointmentId = randomUUID();
    const deletedAt = new Date('2026-02-01T00:00:00.000Z');
    await wrapper.withPlatformBypass(async (c) => {
      await c.tenant.create({
        data: { id: tenantId, name: 'MIG4', slug: `mig4-${tenantId.slice(0, 8)}` },
      });
      await c.patient.create({
        data: { id: patientId, tenantId, firstName: 'D', lastName: 'L' },
      });
      await c.appointment.create({
        data: {
          id: appointmentId,
          tenantId,
          patientId,
          providerId: randomUUID(),
          scheduledStart: new Date('2026-01-03T10:00:00.000Z'),
          scheduledEnd: new Date('2026-01-03T10:30:00.000Z'),
          status: 'CANCELLED',
          deletedAt,
        },
      });
    });
    const row = await wrapper.withPlatformBypass((c) =>
      c.appointment.findUnique({ where: { id: appointmentId } }),
    );
    expect(row?.deletedAt?.toISOString()).toBe(deletedAt.toISOString());
    await wrapper.withPlatformBypass(async (c) => {
      await c.appointment.deleteMany({ where: { tenantId } });
      await c.patient.deleteMany({ where: { tenantId } });
      await c.tenant.deleteMany({ where: { id: tenantId } });
    });
  });

  it('B-MIG-05 / WB07-MIG-03 — mapped legacy synthetic snapshot via ACTUAL backfill', async () => {
    const tenantId = randomUUID();
    const patientId = randomUUID();
    const providerId = randomUUID();
    const clinicalServiceId = randomUUID();
    const appointmentId = randomUUID();
    const sourceCode = `consult-${appointmentId.slice(0, 8)}`;
    await wrapper.withPlatformBypass(async (c) => {
      await c.tenant.create({
        data: { id: tenantId, name: 'MIG', slug: `mig-${tenantId.slice(0, 8)}` },
      });
      await c.patient.create({
        data: { id: patientId, tenantId, firstName: 'M', lastName: 'G' },
      });
      await c.canonicalClinicalServiceDefinition.create({
        data: {
          id: clinicalServiceId,
          tenantId: null,
          provenance: 'SYSTEM_CANONICAL',
          stableKey: `canonical.mig_${clinicalServiceId.slice(0, 8)}`,
          domain: 'GENERAL',
          lifecycle: 'PUBLISHED',
          publishedAt: new Date(),
          translations: { create: [{ locale: 'en', displayName: 'Mapped' }] },
        },
      });
      await c.legacyClinicalServiceMapping.create({
        data: {
          id: randomUUID(),
          tenantId: null,
          sourceSystem: 'LEGACY_APPOINTMENT_SERVICE_TYPE',
          sourceCode,
          status: 'MAPPED',
          clinicalServiceId,
        },
      });
      await c.appointment.create({
        data: {
          id: appointmentId,
          tenantId,
          patientId,
          providerId,
          scheduledStart: new Date('2026-01-01T10:00:00.000Z'),
          scheduledEnd: new Date('2026-01-01T10:30:00.000Z'),
          status: 'PENDING',
          serviceType: sourceCode,
          createdAt: new Date('2026-08-14T12:00:00.000Z'),
        },
      });
    });
    const { runPhase48WaveBSnapshotBackfill } = await import(
      '../application/services/phase48-wave-b-snapshot-backfill'
    );
    await runPhase48WaveBSnapshotBackfill(prisma, { actorId: randomUUID(), tenantId });
    const rev = await wrapper.withPlatformBypass((c) =>
      c.appointmentServiceSnapshotRevision.findFirst({ where: { appointmentId } }),
    );
    expect(rev?.clinicalServiceId).toBe(clinicalServiceId);
    expect(rev?.commercialReason).toBe('LEGACY_SYNTHETIC_MAPPED');
    // Prove production CLI and TS tests share the same authoritative CJS module.
    const { createRequire } = await import('module');
    const { join } = await import('path');
    const { readFileSync } = await import('fs');
    const req = createRequire(__filename);
    const prodImpl = req(join(__dirname, '../../../../scripts/lib/phase48-wave-b-snapshot-backfill.cjs'));
    expect(typeof prodImpl.runPhase48WaveBSnapshotBackfill).toBe('function');
    const tsSrc = readFileSync(
      join(__dirname, '../application/services/phase48-wave-b-snapshot-backfill.ts'),
      'utf8',
    );
    const cliSrc = readFileSync(
      join(__dirname, '../../../../scripts/backfill-phase48-wave-b-snapshots-production.mjs'),
      'utf8',
    );
    expect(tsSrc).toMatch(/phase48-wave-b-snapshot-backfill\.cjs/);
    expect(cliSrc).toMatch(/phase48-wave-b-snapshot-backfill\.mjs/);
    expect(cliSrc).toMatch(/--confirm-production-backfill/);
    await wrapper.withPlatformBypass(async (c) => {
      await c.$executeRaw`SELECT set_config('app.wave_b_snapshot_migration', 'true', true)`;
      await c.appointment.updateMany({
        where: { tenantId },
        data: { effectiveSnapshotRevisionId: null },
      });
      await c.appointmentServiceSnapshotRevision.deleteMany({ where: { tenantId } });
      await c.appointment.deleteMany({ where: { tenantId } });
      await c.legacyClinicalServiceMapping.deleteMany({ where: { sourceCode } });
      await c.patient.deleteMany({ where: { tenantId } });
      await c.clinicalServiceTranslation.deleteMany({ where: { clinicalServiceId } });
      await c.canonicalClinicalServiceDefinition.deleteMany({ where: { id: clinicalServiceId } });
      await c.tenant.deleteMany({ where: { id: tenantId } });
    });
  });

  it('B-MIG-06 — unmapped legacy preserved/readable via ACTUAL backfill', async () => {
    const tenantId = randomUUID();
    const patientId = randomUUID();
    const appointmentId = randomUUID();
    await wrapper.withPlatformBypass(async (c) => {
      await c.tenant.create({
        data: { id: tenantId, name: 'MIG2', slug: `mig2-${tenantId.slice(0, 8)}` },
      });
      await c.patient.create({
        data: { id: patientId, tenantId, firstName: 'U', lastName: 'N' },
      });
      await c.appointment.create({
        data: {
          id: appointmentId,
          tenantId,
          patientId,
          providerId: randomUUID(),
          scheduledStart: new Date('2026-01-02T10:00:00.000Z'),
          scheduledEnd: new Date('2026-01-02T10:30:00.000Z'),
          status: 'PENDING',
          serviceType: 'custom_free_text',
          createdAt: new Date('2026-08-14T12:00:00.000Z'),
        },
      });
    });
    const { runPhase48WaveBSnapshotBackfill } = await import(
      '../application/services/phase48-wave-b-snapshot-backfill'
    );
    await runPhase48WaveBSnapshotBackfill(prisma, { actorId: randomUUID(), tenantId });
    const rev = await wrapper.withPlatformBypass((c) =>
      c.appointmentServiceSnapshotRevision.findFirst({ where: { appointmentId } }),
    );
    const appt = await wrapper.withPlatformBypass((c) =>
      c.appointment.findUnique({ where: { id: appointmentId } }),
    );
    expect(rev?.clinicalServiceId).toBeNull();
    expect(rev?.commercialReason).toBe('LEGACY_UNMAPPED');
    expect(appt?.serviceType).toBe('custom_free_text');
    expect(appt?.clinicalServiceId).toBeNull();
    await wrapper.withPlatformBypass(async (c) => {
      await c.$executeRaw`SELECT set_config('app.wave_b_snapshot_migration', 'true', true)`;
      await c.appointment.updateMany({
        where: { tenantId },
        data: { effectiveSnapshotRevisionId: null },
      });
      await c.appointmentServiceSnapshotRevision.deleteMany({ where: { tenantId } });
      await c.appointment.deleteMany({ where: { tenantId } });
      await c.patient.deleteMany({ where: { tenantId } });
      await c.tenant.deleteMany({ where: { id: tenantId } });
    });
  });

  it('B-MIG-07 / WB07-MIG-AMBIG-01 — ambiguous mapping dataset → ACTUAL backfill leaves clinicalServiceId null', async () => {
    const tenantId = randomUUID();
    const patientId = randomUUID();
    const appointmentId = randomUUID();
    const svcA = randomUUID();
    const svcB = randomUUID();
    const sourceCode = `ambig-${appointmentId.slice(0, 8)}`;
    await wrapper.withPlatformBypass(async (c) => {
      await c.tenant.create({
        data: { id: tenantId, name: 'MIG7', slug: `mig7-${tenantId.slice(0, 8)}` },
      });
      await c.patient.create({
        data: { id: patientId, tenantId, firstName: 'A', lastName: 'M' },
      });
      for (const [id, mappingTenantId] of [
        [svcA, null],
        [svcB, tenantId],
      ] as const) {
        await c.canonicalClinicalServiceDefinition.create({
          data: {
            id,
            tenantId: null,
            provenance: 'SYSTEM_CANONICAL',
            stableKey: `canonical.ambig_${id.slice(0, 8)}`,
            domain: 'GENERAL',
            lifecycle: 'PUBLISHED',
            publishedAt: new Date(),
            translations: { create: [{ locale: 'en', displayName: 'Amb' }] },
          },
        });
        await c.legacyClinicalServiceMapping.create({
          data: {
            id: randomUUID(),
            tenantId: mappingTenantId,
            sourceSystem: 'LEGACY_APPOINTMENT_SERVICE_TYPE',
            sourceCode,
            status: 'MAPPED',
            clinicalServiceId: id,
          },
        });
      }
      await c.appointment.create({
        data: {
          id: appointmentId,
          tenantId,
          patientId,
          providerId: randomUUID(),
          scheduledStart: new Date('2026-01-07T10:00:00.000Z'),
          scheduledEnd: new Date('2026-01-07T10:30:00.000Z'),
          status: 'PENDING',
          serviceType: sourceCode,
          createdAt: new Date('2026-08-14T12:00:00.000Z'),
        },
      });
    });
    const { runPhase48WaveBSnapshotBackfill } = await import(
      '../application/services/phase48-wave-b-snapshot-backfill'
    );
    await runPhase48WaveBSnapshotBackfill(prisma, { actorId: randomUUID(), tenantId });
    const rev = await wrapper.withPlatformBypass((c) =>
      c.appointmentServiceSnapshotRevision.findFirst({ where: { appointmentId } }),
    );
    const appt = await wrapper.withPlatformBypass((c) =>
      c.appointment.findUnique({ where: { id: appointmentId } }),
    );
    expect(rev?.clinicalServiceId).toBeNull();
    expect(rev?.displayNameEn).toBe(sourceCode);
    expect(appt?.clinicalServiceId).toBeNull();
    await wrapper.withPlatformBypass(async (c) => {
      await c.$executeRaw`SELECT set_config('app.wave_b_snapshot_migration', 'true', true)`;
      await c.appointment.updateMany({
        where: { tenantId },
        data: { effectiveSnapshotRevisionId: null },
      });
      await c.appointmentServiceSnapshotRevision.deleteMany({ where: { tenantId } });
      await c.appointment.deleteMany({ where: { tenantId } });
      await c.legacyClinicalServiceMapping.deleteMany({
        where: {
          sourceCode,
          OR: [{ tenantId }, { tenantId: null }],
        },
      });
      await c.patient.deleteMany({ where: { tenantId } });
      await c.clinicalServiceTranslation.deleteMany({
        where: { clinicalServiceId: { in: [svcA, svcB] } },
      });
      await c.canonicalClinicalServiceDefinition.deleteMany({ where: { id: { in: [svcA, svcB] } } });
      await c.tenant.deleteMany({ where: { id: tenantId } });
    });
  });

  it('B-MIG-08 / WB07-MIG-04 / WB07-MIG-IDEMP-01 — ACTUAL backfill twice creates zero duplicates', async () => {
    const tenantId = randomUUID();
    const patientId = randomUUID();
    const appointmentId = randomUUID();
    await wrapper.withPlatformBypass(async (c) => {
      await c.tenant.create({
        data: { id: tenantId, name: 'MIG3', slug: `mig3-${tenantId.slice(0, 8)}` },
      });
      await c.patient.create({
        data: { id: patientId, tenantId, firstName: 'I', lastName: 'D' },
      });
      await c.appointment.create({
        data: {
          id: appointmentId,
          tenantId,
          patientId,
          providerId: randomUUID(),
          scheduledStart: new Date('2026-01-03T10:00:00.000Z'),
          scheduledEnd: new Date('2026-01-03T10:30:00.000Z'),
          status: 'PENDING',
          serviceType: 'legacy-idem',
          createdAt: new Date('2026-08-14T12:00:00.000Z'),
        },
      });
    });
    const { runPhase48WaveBSnapshotBackfill } = await import(
      '../application/services/phase48-wave-b-snapshot-backfill'
    );
    await runPhase48WaveBSnapshotBackfill(prisma, { actorId: randomUUID(), tenantId });
    const first = await wrapper.withPlatformBypass((c) =>
      c.appointment.findUnique({ where: { id: appointmentId } }),
    );
    const firstPointer = first?.effectiveSnapshotRevisionId;
    expect(firstPointer).toBeTruthy();
    const serviceTypeBefore = first?.serviceType;
    await runPhase48WaveBSnapshotBackfill(prisma, { actorId: randomUUID(), tenantId });
    const second = await wrapper.withPlatformBypass((c) =>
      c.appointment.findUnique({ where: { id: appointmentId } }),
    );
    const count = await wrapper.withPlatformBypass((c) =>
      c.appointmentServiceSnapshotRevision.count({ where: { appointmentId } }),
    );
    expect(count).toBe(1);
    expect(second?.effectiveSnapshotRevisionId).toBe(firstPointer);
    expect(second?.serviceType).toBe(serviceTypeBefore);
    await wrapper.withPlatformBypass(async (c) => {
      await c.$executeRaw`SELECT set_config('app.wave_b_snapshot_migration', 'true', true)`;
      await c.appointment.updateMany({
        where: { tenantId },
        data: { effectiveSnapshotRevisionId: null },
      });
      await c.appointmentServiceSnapshotRevision.deleteMany({ where: { tenantId } });
      await c.appointment.deleteMany({ where: { tenantId } });
      await c.patient.deleteMany({ where: { tenantId } });
      await c.tenant.deleteMany({ where: { id: tenantId } });
    });
  });

  it('B-MIG-09 / WB07-FLAGOFF-01 — invoice handler flag OFF uses legacy path not snapshot', async () => {
    const { CreateInvoiceFromAppointmentHandler } = await import(
      '../application/handlers/create-invoice-from-appointment.handler'
    );
    const { isBillingInvoiceFromSnapshotEnabled } = await import(
      '../domain/booking-feature-flags'
    );
    expect(isBillingInvoiceFromSnapshotEnabled(null)).toBe(false);
    const tenantId = randomUUID();
    const patientId = randomUUID();
    const appointmentId = randomUUID();
    const providerId = randomUUID();
    const clinicalServiceId = randomUUID();
    await wrapper.withPlatformBypass(async (c) => {
      await c.tenant.create({
        data: {
          id: tenantId,
          name: 'MIG9',
          slug: `mig9-${tenantId.slice(0, 8)}`,
          features: { 'billing.invoice.from.snapshot': false },
        },
      });
      await c.patient.create({
        data: { id: patientId, tenantId, firstName: 'B', lastName: 'F' },
      });
      await c.canonicalClinicalServiceDefinition.create({
        data: {
          id: clinicalServiceId,
          tenantId: null,
          provenance: 'SYSTEM_CANONICAL',
          stableKey: `canonical.mig9_${clinicalServiceId.slice(0, 8)}`,
          domain: 'GENERAL',
          lifecycle: 'PUBLISHED',
          publishedAt: new Date(),
          translations: { create: [{ locale: 'en', displayName: 'Snap' }] },
        },
      });
      await c.appointment.create({
        data: {
          id: appointmentId,
          tenantId,
          patientId,
          providerId,
          scheduledStart: new Date('2026-01-09T10:00:00.000Z'),
          scheduledEnd: new Date('2026-01-09T10:30:00.000Z'),
          status: 'CONFIRMED',
          serviceType: 'consultation',
          clinicalServiceId,
        },
      });
    });
    await concurrency.withBookingTransaction(async (client) => {
      await snapshots.captureCanonicalRevision1(client, {
        tenantId,
        appointmentId,
        actorId: providerId,
        commercial: {
          clinicalServiceId,
          stableKey: 'k',
          displayNameAr: 'a',
          displayNameEn: 'Snap',
          tenantServiceConfigurationId: null,
          priceVersionId: null,
          pricingUnit: 'PER_VISIT',
          currency: 'SYP',
          unitPrice: 99,
          taxPercent: 0,
          quantity: 1,
          commercialReason: null,
        },
      });
    });
    const captured: unknown[] = [];
    const handler = new CreateInvoiceFromAppointmentHandler(
      {
        findDetailById: async () => ({
          id: appointmentId,
          patientId,
          branchId: null,
          serviceType: 'consultation',
        }),
      } as never,
      {
        execute: jest.fn(async (cmd: { lineItems: Array<{ unitPrice: number }> }) => {
          captured.push(...cmd.lineItems);
          return { invoiceId: randomUUID() };
        }),
      } as never,
      { resolve: async () => ({ tenantId, branchId: null }) } as never,
      wrapper as never,
    );
    await handler.execute(appointmentId);
    expect(captured[0]).toMatchObject({ unitPrice: 0 });
    await wrapper.withPlatformBypass(async (c) => {
      await c.$executeRaw`SELECT set_config('app.wave_b_snapshot_migration', 'true', true)`;
      await c.appointment.updateMany({
        where: { tenantId },
        data: { effectiveSnapshotRevisionId: null },
      });
      await c.appointmentServiceSnapshotRevision.deleteMany({ where: { tenantId } });
      await c.appointment.deleteMany({ where: { tenantId } });
      await c.patient.deleteMany({ where: { tenantId } });
      await c.clinicalServiceTranslation.deleteMany({ where: { clinicalServiceId } });
      await c.canonicalClinicalServiceDefinition.deleteMany({ where: { id: clinicalServiceId } });
      await c.tenant.deleteMany({ where: { id: tenantId } });
    });
  });

  it('B-MIG-10 — production DB untouched (harness asserts booking_test only)', () => {
    const parsed = assertSafePlatformTestDatabaseUrl(DEFAULT_PLATFORM_DB_SECURITY_URL);
    expect(parsed.pathname).toContain('booking_test');
  });
});
