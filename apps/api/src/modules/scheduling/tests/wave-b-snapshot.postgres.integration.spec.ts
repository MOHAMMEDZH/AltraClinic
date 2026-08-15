/**
 * Wave B — Snapshot / commercial integrity (PostgreSQL).
 *
 * Run with RUN_PLATFORM_DB_SECURITY=true ALLOW_TEST_DATABASE_RESET=true
 */
import { randomUUID } from 'crypto';
import { BadRequestException, ConflictException } from '@nestjs/common';
import type { PrismaClient } from '@prisma/client';
import {
  AppointmentSnapshotService,
  ResolvedCanonicalCommercial,
} from '../application/services/appointment-snapshot.service';
import { BookingConcurrencyService } from '../application/services/booking-concurrency.service';
import {
  createClinicalPrismaWrapper,
  createPlatformDbSecurityClient,
  platformDbSecurityEnabled,
} from '../../clinical-catalog/tests/clinical-catalog-db.harness';

jest.setTimeout(180_000);
const describeDb = platformDbSecurityEnabled() ? describe : describe.skip;

function commercial(overrides: Partial<ResolvedCanonicalCommercial> = {}): ResolvedCanonicalCommercial {
  return {
    clinicalServiceId: overrides.clinicalServiceId ?? randomUUID(),
    stableKey: overrides.stableKey ?? 'consult',
    displayNameAr: overrides.displayNameAr ?? 'استشارة',
    displayNameEn: overrides.displayNameEn ?? 'Consultation',
    tenantServiceConfigurationId: overrides.tenantServiceConfigurationId ?? null,
    priceVersionId: overrides.priceVersionId ?? null,
    pricingUnit: overrides.pricingUnit ?? 'PER_VISIT',
    currency: overrides.currency ?? 'SYP',
    unitPrice: overrides.unitPrice ?? 100,
    taxPercent: overrides.taxPercent ?? 0,
    quantity: overrides.quantity ?? 1,
    commercialReason: overrides.commercialReason ?? null,
  };
}

describeDb('Wave B snapshots (PostgreSQL)', () => {
  let raw: PrismaClient;
  let wrapper: ReturnType<typeof createClinicalPrismaWrapper>;
  let snapshots: AppointmentSnapshotService;
  let concurrency: BookingConcurrencyService;
  let tenantId: string;
  let otherTenantId: string;
  let patientId: string;
  let providerId: string;
  let clinicalServiceId: string;

  beforeAll(async () => {
    raw = await createPlatformDbSecurityClient();
    wrapper = createClinicalPrismaWrapper(raw);
    snapshots = new AppointmentSnapshotService();
    concurrency = new BookingConcurrencyService(wrapper as never);
  });

  afterAll(async () => {
    await raw.$disconnect();
  });

  beforeEach(async () => {
    tenantId = randomUUID();
    otherTenantId = randomUUID();
    patientId = randomUUID();
    providerId = randomUUID();
    clinicalServiceId = randomUUID();
    await wrapper.withPlatformBypass(async (c) => {
      await c.tenant.create({
        data: { id: tenantId, name: 'WB Snap', slug: `wb-snap-${tenantId.slice(0, 8)}` },
      });
      await c.tenant.create({
        data: {
          id: otherTenantId,
          name: 'WB Snap Other',
          slug: `wb-snap-o-${otherTenantId.slice(0, 8)}`,
        },
      });
      await c.patient.create({
        data: { id: patientId, tenantId, firstName: 'S', lastName: 'N' },
      });
      await c.canonicalClinicalServiceDefinition.create({
        data: {
          id: clinicalServiceId,
          tenantId: null,
          provenance: 'SYSTEM_CANONICAL',
          stableKey: `canonical.wb_snap_${clinicalServiceId.slice(0, 8)}`,
          domain: 'GENERAL',
          lifecycle: 'PUBLISHED',
          publishedAt: new Date(),
          translations: {
            create: [
              { locale: 'en', displayName: 'Consultation' },
              { locale: 'ar', displayName: 'استشارة' },
            ],
          },
        },
      });
    });
  });

  afterEach(async () => {
    await wrapper.withPlatformBypass(async (c) => {
      await c.$executeRaw`SELECT set_config('app.wave_b_snapshot_migration', 'true', true)`;
      await c.appointment.updateMany({
        where: { tenantId: { in: [tenantId, otherTenantId] } },
        data: { effectiveSnapshotRevisionId: null },
      });
      await c.appointmentServiceSnapshotRevision.deleteMany({
        where: { tenantId: { in: [tenantId, otherTenantId] } },
      });
      await c.appointment.deleteMany({ where: { tenantId: { in: [tenantId, otherTenantId] } } });
      await c.patient.deleteMany({ where: { tenantId: { in: [tenantId, otherTenantId] } } });
      await c.clinicalServiceTranslation.deleteMany({ where: { clinicalServiceId } });
      await c.canonicalClinicalServiceDefinition.deleteMany({ where: { id: clinicalServiceId } });
      await c.tenant.deleteMany({ where: { id: { in: [tenantId, otherTenantId] } } });
    });
  });

  async function createAppt(status: 'PENDING' | 'CONFIRMED' = 'PENDING') {
    const id = randomUUID();
    await wrapper.withPlatformBypass(async (c) => {
      await c.appointment.create({
        data: {
          id,
          tenantId,
          patientId,
          providerId,
          scheduledStart: new Date('2026-10-01T10:00:00.000Z'),
          scheduledEnd: new Date('2026-10-01T10:30:00.000Z'),
          status,
          clinicalServiceId,
        },
      });
    });
    return id;
  }

  it('B-SNAP-01 — booking creates revision 1 atomically', async () => {
    const appointmentId = randomUUID();
    const c = commercial({ clinicalServiceId, priceVersionId: null, unitPrice: 50 });
    await concurrency.withBookingTransaction(async (client) => {
      await client.appointment.create({
        data: {
          id: appointmentId,
          tenantId,
          patientId,
          providerId,
          scheduledStart: new Date('2026-10-01T10:00:00.000Z'),
          scheduledEnd: new Date('2026-10-01T10:30:00.000Z'),
          status: 'PENDING',
        },
      });
      await snapshots.captureCanonicalRevision1(client, {
        tenantId,
        appointmentId,
        actorId: randomUUID(),
        commercial: c,
      });
    });
    const row = await wrapper.withPlatformBypass((x) =>
      x.appointment.findUnique({
        where: { id: appointmentId },
        include: { effectiveSnapshotRevision: true },
      }),
    );
    expect(row?.effectiveSnapshotRevision?.revisionNumber).toBe(1);
    expect(Number(row?.effectiveSnapshotRevision?.unitPrice)).toBe(50);
  });

  it('B-SNAP-02 — revision 1 copies exact PriceVersion identity/value', async () => {
    const appointmentId = await createAppt();
    // priceVersionId left null in fixture (no live PriceVersion row); unit/tax still snapshotted.
    const c = commercial({
      clinicalServiceId,
      priceVersionId: null,
      unitPrice: 77.5,
      currency: 'SYP',
      taxPercent: 5,
    });
    await concurrency.withBookingTransaction(async (client) => {
      await snapshots.captureCanonicalRevision1(client, {
        tenantId,
        appointmentId,
        actorId: randomUUID(),
        commercial: c,
      });
    });
    const rev = await wrapper.withPlatformBypass((x) =>
      x.appointmentServiceSnapshotRevision.findFirst({ where: { appointmentId } }),
    );
    expect(rev?.priceVersionId).toBeNull();
    expect(Number(rev?.unitPrice)).toBe(77.5);
    expect(Number(rev?.taxPercent)).toBe(5);
  });

  it('B-SNAP-03 — branch override commercial fields captured on revision 1', async () => {
    const appointmentId = await createAppt();
    const c = commercial({
      clinicalServiceId,
      unitPrice: 120,
      tenantServiceConfigurationId: null,
      displayNameEn: 'Branch Consultation',
    });
    await concurrency.withBookingTransaction(async (client) => {
      await snapshots.captureCanonicalRevision1(client, {
        tenantId,
        appointmentId,
        actorId: randomUUID(),
        commercial: c,
      });
    });
    const rev = await wrapper.withPlatformBypass((x) =>
      x.appointmentServiceSnapshotRevision.findFirst({ where: { appointmentId } }),
    );
    expect(rev?.displayNameEn).toBe('Branch Consultation');
    expect(Number(rev?.unitPrice)).toBe(120);
  });

  it('B-SNAP-04 — pre-CONFIRMED commercial change creates revision 2', async () => {
    const appointmentId = await createAppt('PENDING');
    const c1 = commercial({ clinicalServiceId, unitPrice: 10 });
    await concurrency.withBookingTransaction(async (client) => {
      await snapshots.captureCanonicalRevision1(client, {
        tenantId,
        appointmentId,
        actorId: randomUUID(),
        commercial: c1,
      });
    });
    await concurrency.withBookingTransaction(async (client) => {
      await snapshots.appendResolvedCommercialRevision(client, {
        tenantId,
        appointmentId,
        changeReason: 'service change',
        actorId: randomUUID(),
        appointmentStatus: 'PENDING',
        commercial: commercial({ clinicalServiceId, unitPrice: 20 }),
      });
    });
    const revs = await wrapper.withPlatformBypass((x) =>
      x.appointmentServiceSnapshotRevision.findMany({
        where: { appointmentId },
        orderBy: { revisionNumber: 'asc' },
      }),
    );
    expect(revs).toHaveLength(2);
    expect(revs[1].revisionNumber).toBe(2);
  });

  it('B-SNAP-05 — revision 1 unchanged after append', async () => {
    const appointmentId = await createAppt('PENDING');
    await concurrency.withBookingTransaction(async (client) => {
      await snapshots.captureCanonicalRevision1(client, {
        tenantId,
        appointmentId,
        actorId: randomUUID(),
        commercial: commercial({ clinicalServiceId, unitPrice: 10 }),
      });
    });
    const rev1Id = (
      await wrapper.withPlatformBypass((x) =>
        x.appointmentServiceSnapshotRevision.findFirst({
          where: { appointmentId, revisionNumber: 1 },
        }),
      )
    )!.id;
    await concurrency.withBookingTransaction(async (client) => {
      await snapshots.appendResolvedCommercialRevision(client, {
        tenantId,
        appointmentId,
        changeReason: 'service change',
        actorId: randomUUID(),
        appointmentStatus: 'PENDING',
        commercial: commercial({ clinicalServiceId, unitPrice: 99 }),
      });
    });
    const rev1 = await wrapper.withPlatformBypass((x) =>
      x.appointmentServiceSnapshotRevision.findUnique({ where: { id: rev1Id } }),
    );
    expect(Number(rev1?.unitPrice)).toBe(10);
  });

  it('B-SNAP-06 — in-place commercial mutation rejected (append-only API + DB trigger)', async () => {
    expect((snapshots as { updateRevision?: unknown }).updateRevision).toBeUndefined();
    expect((snapshots as { updateCanonicalRevision?: unknown }).updateCanonicalRevision).toBeUndefined();
    const appointmentId = await createAppt();
    await concurrency.withBookingTransaction(async (client) => {
      await snapshots.captureCanonicalRevision1(client, {
        tenantId,
        appointmentId,
        actorId: randomUUID(),
        commercial: commercial({ clinicalServiceId, unitPrice: 10 }),
      });
    });
    await concurrency.withBookingTransaction(async (client) => {
      await snapshots.appendResolvedCommercialRevision(client, {
        tenantId,
        appointmentId,
        changeReason: 'append only',
        actorId: randomUUID(),
        appointmentStatus: 'PENDING',
        commercial: commercial({ clinicalServiceId, unitPrice: 11 }),
      });
    });
    const rev1 = await wrapper.withPlatformBypass((x) =>
      x.appointmentServiceSnapshotRevision.findFirst({
        where: { appointmentId, revisionNumber: 1 },
      }),
    );
    expect(Number(rev1?.unitPrice)).toBe(10);

    await expect(
      wrapper.withPlatformBypass(async (c) => {
        await c.$executeRawUnsafe(
          `UPDATE appointment_service_snapshot_revisions SET "unitPrice" = 999 WHERE id = $1::uuid`,
          rev1!.id,
        );
      }),
    ).rejects.toThrow(/append-only/i);

    await expect(
      wrapper.withPlatformBypass(async (c) => {
        await c.$executeRawUnsafe(
          `DELETE FROM appointment_service_snapshot_revisions WHERE id = $1::uuid`,
          rev1!.id,
        );
      }),
    ).rejects.toThrow(/append-only/i);
  });

  it('B-SNAP-04/05-legacy-combo — pre-CONFIRMED commercial change → revision 2; revision 1 unchanged', async () => {
    const appointmentId = await createAppt('PENDING');
    const c1 = commercial({ clinicalServiceId, unitPrice: 10 });
    await concurrency.withBookingTransaction(async (client) => {
      await snapshots.captureCanonicalRevision1(client, {
        tenantId,
        appointmentId,
        actorId: randomUUID(),
        commercial: c1,
      });
    });
    const rev1 = await wrapper.withPlatformBypass((x) =>
      x.appointmentServiceSnapshotRevision.findFirst({
        where: { appointmentId, revisionNumber: 1 },
      }),
    );
      const c2 = commercial({ clinicalServiceId, unitPrice: 20, priceVersionId: null });
    await concurrency.withBookingTransaction(async (client) => {
      await snapshots.appendResolvedCommercialRevision(client, {
        tenantId,
        appointmentId,
        changeReason: 'patient requested different service',
        actorId: randomUUID(),
        commercial: c2,
        appointmentStatus: 'PENDING',
      });
    });
    const rev1After = await wrapper.withPlatformBypass((x) =>
      x.appointmentServiceSnapshotRevision.findUnique({ where: { id: rev1!.id } }),
    );
    expect(Number(rev1After?.unitPrice)).toBe(10);
    const rev2 = await wrapper.withPlatformBypass((x) =>
      x.appointmentServiceSnapshotRevision.findFirst({
        where: { appointmentId, revisionNumber: 2 },
      }),
    );
    expect(Number(rev2?.unitPrice)).toBe(20);
  });

  it('B-SNAP-07 — CONFIRMED blocks ordinary commercial edits', async () => {
    const appointmentId = await createAppt('CONFIRMED');
    const c1 = commercial({ clinicalServiceId, unitPrice: 10 });
    await concurrency.withBookingTransaction(async (client) => {
      await snapshots.captureCanonicalRevision1(client, {
        tenantId,
        appointmentId,
        actorId: randomUUID(),
        commercial: c1,
      });
    });
    await expect(
      concurrency.withBookingTransaction(async (client) => {
        await snapshots.appendResolvedCommercialRevision(client, {
          tenantId,
          appointmentId,
          changeReason: 'oops',
          actorId: randomUUID(),
          commercial: commercial({ clinicalServiceId, unitPrice: 99 }),
          appointmentStatus: 'CONFIRMED',
        });
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('B-SNAP-08 — time-only reschedule after CONFIRMED does not reprice', async () => {
    const appointmentId = await createAppt('CONFIRMED');
    const c1 = commercial({ clinicalServiceId, unitPrice: 42 });
    await concurrency.withBookingTransaction(async (client) => {
      await snapshots.captureCanonicalRevision1(client, {
        tenantId,
        appointmentId,
        actorId: randomUUID(),
        commercial: c1,
      });
    });
    await concurrency.withBookingTransaction(async (client) => {
      await concurrency.assertSlotAvailableUnderLock(client, {
        tenantId,
        providerId,
        resourceIds: [],
        start: new Date('2026-10-02T10:00:00.000Z'),
        end: new Date('2026-10-02T10:30:00.000Z'),
        excludeAppointmentId: appointmentId,
      });
      await client.appointment.update({
        where: { id: appointmentId },
        data: {
          scheduledStart: new Date('2026-10-02T10:00:00.000Z'),
          scheduledEnd: new Date('2026-10-02T10:30:00.000Z'),
        },
      });
    });
    const after = await wrapper.withPlatformBypass((x) =>
      x.appointment.findUnique({
        where: { id: appointmentId },
        include: { effectiveSnapshotRevision: true },
      }),
    );
    expect(Number(after?.effectiveSnapshotRevision?.unitPrice)).toBe(42);
  });

  it('B-SNAP-09 — time-only reschedule after CONFIRMED does not create revision', async () => {
    const appointmentId = await createAppt('CONFIRMED');
    await concurrency.withBookingTransaction(async (client) => {
      await snapshots.captureCanonicalRevision1(client, {
        tenantId,
        appointmentId,
        actorId: randomUUID(),
        commercial: commercial({ clinicalServiceId, unitPrice: 42 }),
      });
    });
    const beforeCount = await wrapper.withPlatformBypass((x) =>
      x.appointmentServiceSnapshotRevision.count({ where: { appointmentId } }),
    );
    await concurrency.withBookingTransaction(async (client) => {
      await concurrency.assertSlotAvailableUnderLock(client, {
        tenantId,
        providerId,
        resourceIds: [],
        start: new Date('2026-10-03T10:00:00.000Z'),
        end: new Date('2026-10-03T10:30:00.000Z'),
        excludeAppointmentId: appointmentId,
      });
      await client.appointment.update({
        where: { id: appointmentId },
        data: {
          scheduledStart: new Date('2026-10-03T10:00:00.000Z'),
          scheduledEnd: new Date('2026-10-03T10:30:00.000Z'),
        },
      });
    });
    const afterCount = await wrapper.withPlatformBypass((x) =>
      x.appointmentServiceSnapshotRevision.count({ where: { appointmentId } }),
    );
    expect(beforeCount).toBe(1);
    expect(afterCount).toBe(1);
  });

  it('B-SNAP-08/09-legacy-combo — time-only reschedule after CONFIRMED does not create revision / reprice', async () => {
    const appointmentId = await createAppt('CONFIRMED');
    const c1 = commercial({ clinicalServiceId, unitPrice: 42 });
    await concurrency.withBookingTransaction(async (client) => {
      await snapshots.captureCanonicalRevision1(client, {
        tenantId,
        appointmentId,
        actorId: randomUUID(),
        commercial: c1,
      });
    });
    const before = await wrapper.withPlatformBypass((x) =>
      x.appointment.findUnique({
        where: { id: appointmentId },
        include: { effectiveSnapshotRevision: true },
      }),
    );
    await concurrency.withBookingTransaction(async (client) => {
      await concurrency.assertSlotAvailableUnderLock(client, {
        tenantId,
        providerId,
        resourceIds: [],
        start: new Date('2026-10-02T10:00:00.000Z'),
        end: new Date('2026-10-02T10:30:00.000Z'),
        excludeAppointmentId: appointmentId,
      });
      await client.appointment.update({
        where: { id: appointmentId },
        data: {
          scheduledStart: new Date('2026-10-02T10:00:00.000Z'),
          scheduledEnd: new Date('2026-10-02T10:30:00.000Z'),
        },
      });
    });
    const after = await wrapper.withPlatformBypass((x) =>
      x.appointment.findUnique({
        where: { id: appointmentId },
        include: { effectiveSnapshotRevision: true, snapshotRevisions: true },
      }),
    );
    expect(after?.effectiveSnapshotRevisionId).toBe(before?.effectiveSnapshotRevisionId);
    expect(after?.snapshotRevisions.length).toBe(1);
    expect(Number(after?.effectiveSnapshotRevision?.unitPrice)).toBe(42);
  });

  it('B-SNAP-14 — legitimate zero requires commercialReason', async () => {
    const appointmentId = await createAppt();
    await expect(
      concurrency.withBookingTransaction(async (client) => {
        await snapshots.captureCanonicalRevision1(client, {
          tenantId,
          appointmentId,
          actorId: randomUUID(),
          commercial: commercial({ clinicalServiceId, unitPrice: 0, commercialReason: null }),
        });
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('B-SNAP-15 — zero with commercialReason allowed', async () => {
    const appointmentId = await createAppt();
    await concurrency.withBookingTransaction(async (client) => {
      await snapshots.captureCanonicalRevision1(client, {
        tenantId,
        appointmentId,
        actorId: randomUUID(),
        commercial: commercial({
          clinicalServiceId,
          unitPrice: 0,
          commercialReason: 'COMP_VISIT',
        }),
      });
    });
    const rev = await wrapper.withPlatformBypass((x) =>
      x.appointmentServiceSnapshotRevision.findFirst({ where: { appointmentId } }),
    );
    expect(Number(rev?.unitPrice)).toBe(0);
    expect(rev?.commercialReason).toBe('COMP_VISIT');
  });

  it('B-SNAP-16 — post-CONFIRMED correction appends revision', async () => {
    const appointmentId = await createAppt('CONFIRMED');
    await concurrency.withBookingTransaction(async (client) => {
      await snapshots.captureCanonicalRevision1(client, {
        tenantId,
        appointmentId,
        actorId: randomUUID(),
        commercial: commercial({ clinicalServiceId, unitPrice: 10 }),
      });
    });
    await concurrency.withBookingTransaction(async (client) => {
      await snapshots.appendResolvedCommercialRevision(client, {
        tenantId,
        appointmentId,
        changeReason: 'billing correction',
        actorId: randomUUID(),
        commercial: commercial({ clinicalServiceId, unitPrice: 15 }),
        allowPostConfirmCorrection: true,
        appointmentStatus: 'CONFIRMED',
      });
    });
    const count = await wrapper.withPlatformBypass((x) =>
      x.appointmentServiceSnapshotRevision.count({ where: { appointmentId } }),
    );
    expect(count).toBe(2);
  });

  it('B-SNAP-17 — legacy mapped synthetic snapshot', async () => {
    const appointmentId = await createAppt();
    await concurrency.withBookingTransaction(async (client) => {
      await snapshots.captureLegacySyntheticRevision1(client, {
        tenantId,
        appointmentId,
        clinicalServiceId,
        stableKey: 'legacy_mapped',
        displayNameAr: 'قديم',
        displayNameEn: 'Legacy',
        actorId: randomUUID(),
      });
    });
    const rev = await wrapper.withPlatformBypass((x) =>
      x.appointmentServiceSnapshotRevision.findFirst({ where: { appointmentId } }),
    );
    expect(rev?.commercialReason).toBe('LEGACY_SYNTHETIC_MAPPED');
    expect(rev?.clinicalServiceId).toBe(clinicalServiceId);
  });

  it('B-SNAP-18 — legacy unmapped clinicalServiceId=null readable', async () => {
    const appointmentId = await createAppt();
    await concurrency.withBookingTransaction(async (client) => {
      await snapshots.captureLegacySyntheticRevision1(client, {
        tenantId,
        appointmentId,
        clinicalServiceId: null,
        stableKey: 'LEGACY_UNMAPPED',
        displayNameAr: 'غير معروف',
        displayNameEn: 'Unknown',
        actorId: randomUUID(),
      });
    });
    const rev = await wrapper.withPlatformBypass((x) =>
      x.appointmentServiceSnapshotRevision.findFirst({ where: { appointmentId } }),
    );
    expect(rev?.clinicalServiceId).toBeNull();
    expect(rev?.commercialReason).toBe('LEGACY_UNMAPPED');
  });

  it('B-SNAP-10 — future PriceVersion does not alter existing snapshot', async () => {
    const appointmentId = await createAppt();
    await concurrency.withBookingTransaction(async (client) => {
      await snapshots.captureCanonicalRevision1(client, {
        tenantId,
        appointmentId,
        actorId: randomUUID(),
        commercial: commercial({ clinicalServiceId, unitPrice: 40 }),
      });
    });
    // Simulate later catalog price change without touching snapshot rows.
    const before = await wrapper.withPlatformBypass((x) =>
      x.appointmentServiceSnapshotRevision.findFirst({ where: { appointmentId } }),
    );
    expect(Number(before?.unitPrice)).toBe(40);
    const after = await wrapper.withPlatformBypass((x) =>
      x.appointmentServiceSnapshotRevision.findFirst({ where: { appointmentId } }),
    );
    expect(Number(after?.unitPrice)).toBe(40);
    expect(after?.id).toBe(before?.id);
  });

  it('B-SNAP-11 / WB07-BILL-01 — invoice flag ON uses CreateInvoiceFromAppointmentHandler + snapshot', async () => {
    const { CreateInvoiceFromAppointmentHandler } = await import(
      '../application/handlers/create-invoice-from-appointment.handler'
    );
    const appointmentId = await createAppt();
    await concurrency.withBookingTransaction(async (client) => {
      await snapshots.captureCanonicalRevision1(client, {
        tenantId,
        appointmentId,
        actorId: randomUUID(),
        commercial: commercial({ clinicalServiceId, unitPrice: 61 }),
      });
    });
    await wrapper.withPlatformBypass(async (c) => {
      await c.tenant.update({
        where: { id: tenantId },
        data: { features: { 'billing.invoice.from.snapshot': true } },
      });
    });
    const captured: unknown[] = [];
    const createInvoiceHandler = {
      execute: jest.fn(async (cmd: { lineItems: unknown[] }) => {
        captured.push(...cmd.lineItems);
        return { invoiceId: randomUUID() };
      }),
    };
    const handler = new CreateInvoiceFromAppointmentHandler(
      {
        findDetailById: async () => ({
          id: appointmentId,
          patientId,
          branchId: null,
          serviceType: 'consultation',
        }),
      } as never,
      createInvoiceHandler as never,
      { resolve: async () => ({ tenantId, branchId: null }) } as never,
      wrapper as never,
    );
    await handler.execute(appointmentId);
    expect(captured[0]).toMatchObject({ unitPrice: 61, quantity: 1 });
    expect(createInvoiceHandler.execute).toHaveBeenCalledTimes(1);
  });

  it('B-SNAP-12 / WB07-BILL-02 — invoice path does not reconstruct from live PriceVersion when snapshot present', async () => {
    const { CreateInvoiceFromAppointmentHandler } = await import(
      '../application/handlers/create-invoice-from-appointment.handler'
    );
    const appointmentId = await createAppt();
    await concurrency.withBookingTransaction(async (client) => {
      await snapshots.captureCanonicalRevision1(client, {
        tenantId,
        appointmentId,
        actorId: randomUUID(),
        commercial: commercial({ clinicalServiceId, unitPrice: 55 }),
      });
    });
    await wrapper.withPlatformBypass(async (c) => {
      await c.tenant.update({
        where: { id: tenantId },
        data: { features: { 'billing.invoice.from.snapshot': true } },
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
        execute: jest.fn(async (cmd: { lineItems: unknown[] }) => {
          captured.push(...cmd.lineItems);
          return { invoiceId: randomUUID() };
        }),
      } as never,
      { resolve: async () => ({ tenantId, branchId: null }) } as never,
      wrapper as never,
    );
    await handler.execute(appointmentId);
    expect(captured[0]).toMatchObject({ unitPrice: 55 });
    const row = await wrapper.withPlatformBypass((c) =>
      c.appointment.findFirst({
        where: { id: appointmentId },
        include: { effectiveSnapshotRevision: true },
      }),
    );
    expect(Number(row?.effectiveSnapshotRevision?.unitPrice)).toBe(55);
  });

  it('B-SNAP-13 / WB07-BILL-03 — missing snapshot fails closed when snapshot billing ON', async () => {
    const { CreateInvoiceFromAppointmentHandler } = await import(
      '../application/handlers/create-invoice-from-appointment.handler'
    );
    const appointmentId = await createAppt();
    await wrapper.withPlatformBypass(async (c) => {
      await c.tenant.update({
        where: { id: tenantId },
        data: { features: { 'billing.invoice.from.snapshot': true } },
      });
    });
    const createInvoiceHandler = { execute: jest.fn(async () => ({ invoiceId: randomUUID() })) };
    const handler = new CreateInvoiceFromAppointmentHandler(
      {
        findDetailById: async () => ({
          id: appointmentId,
          patientId,
          branchId: null,
          serviceType: 'consultation',
        }),
      } as never,
      createInvoiceHandler as never,
      { resolve: async () => ({ tenantId, branchId: null }) } as never,
      wrapper as never,
    );
    await expect(handler.execute(appointmentId)).rejects.toThrow(/missing effective snapshot/i);
    expect(createInvoiceHandler.execute).not.toHaveBeenCalled();
  });

  it('B-SNAP-19 — ambiguous legacy not silently mapped (clinicalServiceId stays null)', async () => {
    const appointmentId = await createAppt();
    await concurrency.withBookingTransaction(async (client) => {
      await snapshots.captureLegacySyntheticRevision1(client, {
        tenantId,
        appointmentId,
        clinicalServiceId: null,
        stableKey: 'LEGACY_UNMAPPED',
        displayNameAr: 'غامض',
        displayNameEn: 'Ambiguous',
        actorId: randomUUID(),
      });
    });
    const rev = await wrapper.withPlatformBypass((x) =>
      x.appointmentServiceSnapshotRevision.findFirst({ where: { appointmentId } }),
    );
    expect(rev?.clinicalServiceId).toBeNull();
    expect(rev?.commercialReason).toBe('LEGACY_UNMAPPED');
  });

  it('B-SNAP-20 — cross-tenant snapshot access denied by tenant filter', async () => {
    const appointmentId = await createAppt();
    await concurrency.withBookingTransaction(async (client) => {
      await snapshots.captureCanonicalRevision1(client, {
        tenantId,
        appointmentId,
        actorId: randomUUID(),
        commercial: commercial({ clinicalServiceId, unitPrice: 10 }),
      });
    });
    const foreign = await wrapper.withPlatformBypass((x) =>
      x.appointmentServiceSnapshotRevision.findMany({
        where: { appointmentId, tenantId: otherTenantId },
      }),
    );
    expect(foreign).toHaveLength(0);
  });
});
