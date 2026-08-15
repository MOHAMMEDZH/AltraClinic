/**
 * Wave B final re-review closure — WB01..WB07 (real PostgreSQL where enabled).
 *
 * Run:
 *   ALLOW_TEST_DATABASE_RESET=true RUN_PLATFORM_DB_SECURITY=true \
 *   npx jest --runInBand --testPathIgnorePatterns=[] \
 *     --testPathPattern=wave-b-rereview-closure.postgres.integration.spec
 */
import { randomUUID } from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { BadRequestException, ConflictException, ForbiddenException } from '@nestjs/common';
import type { PrismaClient } from '@prisma/client';
import { BookingConcurrencyService } from '../application/services/booking-concurrency.service';
import { AppointmentSnapshotService } from '../application/services/appointment-snapshot.service';
import { ProviderEligibilityService } from '../application/services/provider-eligibility.service';
import { ServiceResourceRequirementService } from '../application/services/service-resource-requirement.service';
import { CreateInvoiceFromAppointmentHandler } from '../application/handlers/create-invoice-from-appointment.handler';
import {
  createClinicalPrismaWrapper,
  createPlatformDbSecurityClient,
  platformDbSecurityEnabled,
} from '../../clinical-catalog/tests/clinical-catalog-db.harness';
import { PortalSchedulingIdempotencyService } from '../../patient-portal/application/services/portal-scheduling-idempotency.service';

jest.setTimeout(180_000);
const describeDb = platformDbSecurityEnabled() ? describe : describe.skip;

const fakeAudit = {
  entries: [] as Array<{ action: string; resourceId: string }>,
  async record(entry: { action: string; resourceId: string }) {
    this.entries.push(entry);
  },
  async recordInTransaction(_c: unknown, entry: { action: string; resourceId: string }) {
    this.entries.push(entry);
  },
};

const BOOKING_APP_URL =
  'postgresql://booking_app:booking_app@localhost:5433/booking_test?schema=public';

describeDb('Wave B re-review closure WB01–WB07 (PostgreSQL)', () => {
  let raw: PrismaClient;
  let wrapper: ReturnType<typeof createClinicalPrismaWrapper>;
  let concurrency: BookingConcurrencyService;
  let snapshots: AppointmentSnapshotService;
  let eligibility: ProviderEligibilityService;
  let resources: ServiceResourceRequirementService;
  let tenantId: string;
  let otherTenantId: string;
  let patientId: string;
  let providerId: string;
  let clinicalServiceId: string;
  let clinicalServiceId2: string;
  let roomId: string;
  let room2Id: string;
  let branchId: string;
  let extraClinicalServiceIds: string[];

  beforeAll(async () => {
    raw = await createPlatformDbSecurityClient();
    wrapper = createClinicalPrismaWrapper(raw);
    concurrency = new BookingConcurrencyService(wrapper as never);
    snapshots = new AppointmentSnapshotService();
    eligibility = new ProviderEligibilityService(wrapper as never, fakeAudit as never);
    resources = new ServiceResourceRequirementService(wrapper as never, fakeAudit as never);
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
    clinicalServiceId2 = randomUUID();
    roomId = randomUUID();
    room2Id = randomUUID();
    branchId = randomUUID();
    extraClinicalServiceIds = [];
    fakeAudit.entries.length = 0;

    await wrapper.withPlatformBypass(async (c) => {
      await c.tenant.create({
        data: {
          id: tenantId,
          name: 'WB Rereview',
          slug: `wb-rr-${tenantId.slice(0, 8)}`,
          features: { 'booking.eligibility.enforcement': true },
        },
      });
      await c.tenant.create({
        data: {
          id: otherTenantId,
          name: 'WB Rereview Other',
          slug: `wb-rr-o-${otherTenantId.slice(0, 8)}`,
        },
      });
      await c.branch.create({ data: { id: branchId, tenantId, name: 'Main' } });
      await c.user.create({
        data: {
          id: providerId,
          tenantId,
          email: `rr-${providerId.slice(0, 8)}@test.local`,
          passwordHash: 'x',
          firstName: 'Doc',
          lastName: 'Tor',
          roles: { create: [{ role: 'DOCTOR' }] },
        },
      });
      await c.patient.create({
        data: { id: patientId, tenantId, firstName: 'P', lastName: 'A' },
      });
      for (const id of [clinicalServiceId, clinicalServiceId2]) {
        await c.canonicalClinicalServiceDefinition.create({
          data: {
            id,
            tenantId: null,
            provenance: 'SYSTEM_CANONICAL',
            stableKey: `canonical.rr_${id.slice(0, 8)}`,
            domain: 'GENERAL',
            lifecycle: 'PUBLISHED',
            publishedAt: new Date(),
            translations: { create: [{ locale: 'en', displayName: 'Svc' }] },
          },
        });
        await c.tenantServiceConfiguration.create({
          data: {
            id: randomUUID(),
            tenantId,
            clinicalServiceId: id,
            enabled: true,
          },
        });
      }
      await c.schedulingResource.create({
        data: { id: roomId, tenantId, name: 'R1', resourceType: 'ROOM', isActive: true },
      });
      await c.schedulingResource.create({
        data: { id: room2Id, tenantId, name: 'R2', resourceType: 'ROOM', isActive: true },
      });
    });
  });

  afterEach(async () => {
    const allServiceIds = [
      clinicalServiceId,
      clinicalServiceId2,
      ...extraClinicalServiceIds,
    ];
    await wrapper.withPlatformBypass(async (c) => {
      await c.$executeRaw`SELECT set_config('app.wave_b_snapshot_migration', 'true', true)`;
      await c.appointment.updateMany({
        where: { tenantId: { in: [tenantId, otherTenantId] } },
        data: { effectiveSnapshotRevisionId: null },
      });
      await c.appointmentServiceSnapshotRevision.deleteMany({
        where: { tenantId: { in: [tenantId, otherTenantId] } },
      });
      await c.appointmentResourceAllocation.deleteMany({
        where: { tenantId: { in: [tenantId, otherTenantId] } },
      });
      await c.portalSchedulingIdempotencyLedger.deleteMany({
        where: { tenantId: { in: [tenantId, otherTenantId] } },
      });
      await c.appointment.deleteMany({
        where: { tenantId: { in: [tenantId, otherTenantId] } },
      });
      await c.providerServiceEligibility.deleteMany({
        where: { tenantId: { in: [tenantId, otherTenantId] } },
      });
      await c.serviceResourceRequirement.deleteMany({
        where: { tenantId: { in: [tenantId, otherTenantId] } },
      });
      await c.schedulingResource.deleteMany({
        where: { tenantId: { in: [tenantId, otherTenantId] } },
      });
      await c.tenantServiceConfiguration.deleteMany({
        where: { tenantId: { in: [tenantId, otherTenantId] } },
      });
      await c.clinicalServiceTranslation.deleteMany({
        where: { clinicalServiceId: { in: allServiceIds } },
      });
      await c.canonicalClinicalServiceDefinition.deleteMany({
        where: { id: { in: allServiceIds } },
      });
      await c.userRoleAssignment.deleteMany({ where: { userId: providerId } });
      await c.user.deleteMany({
        where: { tenantId: { in: [tenantId, otherTenantId] } },
      });
      await c.patient.deleteMany({
        where: { tenantId: { in: [tenantId, otherTenantId] } },
      });
      await c.branch.deleteMany({ where: { tenantId: { in: [tenantId, otherTenantId] } } });
      await c.tenant.deleteMany({ where: { id: { in: [tenantId, otherTenantId] } } });
    });
  });

  function commercial(overrides: Record<string, unknown> = {}) {
    return {
      clinicalServiceId,
      stableKey: 'canonical.rr',
      displayNameAr: 'خدمة',
      displayNameEn: 'Service',
      tenantServiceConfigurationId: null,
      priceVersionId: null,
      pricingUnit: 'PER_VISIT' as const,
      currency: 'SYP',
      unitPrice: 25,
      taxPercent: 0,
      quantity: 1,
      commercialReason: null,
      ...overrides,
    };
  }

  async function createPendingAppointment(overrides: {
    status?: string;
    start?: Date;
    end?: Date;
    commercialLockedAt?: Date | null;
    clinicalServiceId?: string;
  } = {}) {
    const appointmentId = randomUUID();
    const start = overrides.start ?? new Date('2026-11-01T10:00:00.000Z');
    const end = overrides.end ?? new Date('2026-11-01T10:30:00.000Z');
    await concurrency.withBookingTransaction(async (client) => {
      await client.appointment.create({
        data: {
          id: appointmentId,
          tenantId,
          patientId,
          providerId,
          scheduledStart: start,
          scheduledEnd: end,
          status: (overrides.status as never) ?? 'PENDING',
          clinicalServiceId: overrides.clinicalServiceId ?? clinicalServiceId,
          commercialLockedAt: overrides.commercialLockedAt ?? null,
        },
      });
    });
    return appointmentId;
  }

  function invoiceHandlerFor(
    appointmentId: string,
    createInvoiceHandler: { execute: jest.Mock },
  ) {
    return new CreateInvoiceFromAppointmentHandler(
      {
        findDetailById: async () => ({
          id: appointmentId,
          patientId,
          branchId,
          serviceType: 'consultation',
        }),
      } as never,
      createInvoiceHandler as never,
      { resolve: async () => ({ tenantId, branchId }) } as never,
      wrapper as never,
    );
  }

  // ─── WB01 commercial lock ───────────────────────────────────────────────

  it('WB01-LOCK-01 — CANCELLED + commercialLockedAt remains locked', async () => {
    const appointmentId = await createPendingAppointment();
    const lockedAt = new Date('2026-10-01T12:00:00.000Z');
    await wrapper.withPlatformBypass(async (c) => {
      await c.appointment.update({
        where: { id: appointmentId },
        data: { commercialLockedAt: lockedAt, status: 'CANCELLED' },
      });
    });
    const row = await wrapper.withPlatformBypass((c) =>
      c.appointment.findUniqueOrThrow({ where: { id: appointmentId } }),
    );
    expect(
      snapshots.isCommercialLocked({
        status: row.status,
        commercialLockedAt: row.commercialLockedAt,
      }),
    ).toBe(true);
    expect(
      snapshots.isCommercialLocked({
        status: 'CANCELLED',
        commercialLockedAt: lockedAt,
      }),
    ).toBe(true);
  });

  it('WB01-LOCK-02 — NO_SHOW + commercialLockedAt remains locked', async () => {
    const appointmentId = await createPendingAppointment();
    const lockedAt = new Date('2026-10-01T12:00:00.000Z');
    await wrapper.withPlatformBypass(async (c) => {
      await c.appointment.update({
        where: { id: appointmentId },
        data: { commercialLockedAt: lockedAt, status: 'NO_SHOW' },
      });
    });
    const row = await wrapper.withPlatformBypass((c) =>
      c.appointment.findUniqueOrThrow({ where: { id: appointmentId } }),
    );
    expect(
      snapshots.isCommercialLocked({
        status: row.status,
        commercialLockedAt: row.commercialLockedAt,
      }),
    ).toBe(true);
    expect(
      snapshots.isCommercialLocked({
        status: 'NO_SHOW',
        commercialLockedAt: lockedAt,
      }),
    ).toBe(true);
  });

  it('WB01-LOCK-03 — COMPLETED + commercialLockedAt remains locked', async () => {
    const appointmentId = await createPendingAppointment();
    const lockedAt = new Date('2026-10-01T12:00:00.000Z');
    await wrapper.withPlatformBypass(async (c) => {
      await c.appointment.update({
        where: { id: appointmentId },
        data: { commercialLockedAt: lockedAt, status: 'COMPLETED' },
      });
    });
    const row = await wrapper.withPlatformBypass((c) =>
      c.appointment.findUniqueOrThrow({ where: { id: appointmentId } }),
    );
    expect(
      snapshots.isCommercialLocked({
        status: row.status,
        commercialLockedAt: row.commercialLockedAt,
      }),
    ).toBe(true);
  });

  it('WB01-LOCK-04 — PENDING without lock is not commercially locked', async () => {
    const appointmentId = await createPendingAppointment({ status: 'PENDING' });
    const row = await wrapper.withPlatformBypass((c) =>
      c.appointment.findUniqueOrThrow({ where: { id: appointmentId } }),
    );
    expect(row.commercialLockedAt).toBeNull();
    expect(
      snapshots.isCommercialLocked({
        status: 'PENDING',
        commercialLockedAt: row.commercialLockedAt,
      }),
    ).toBe(false);
  });

  it('WB01-LOCK-05 — allowPostConfirmCorrection succeeds on CANCELLED+locked', async () => {
    const appointmentId = await createPendingAppointment();
    await concurrency.withBookingTransaction(async (client) => {
      await snapshots.captureCanonicalRevision1(client, {
        tenantId,
        appointmentId,
        actorId: providerId,
        commercial: commercial({ unitPrice: 40 }),
      });
    });
    await wrapper.withPlatformBypass(async (c) => {
      await c.appointment.update({
        where: { id: appointmentId },
        data: {
          commercialLockedAt: new Date('2026-10-01T12:00:00.000Z'),
          status: 'CANCELLED',
        },
      });
    });
    await concurrency.withBookingTransaction(async (client) => {
      await snapshots.appendResolvedCommercialRevision(client, {
        tenantId,
        appointmentId,
        changeReason: 'post-cancel billing correction',
        actorId: providerId,
        commercial: commercial({ unitPrice: 55 }),
        allowPostConfirmCorrection: true,
        appointmentStatus: 'CANCELLED',
      });
    });
    const revs = await wrapper.withPlatformBypass((c) =>
      c.appointmentServiceSnapshotRevision.findMany({
        where: { appointmentId },
        orderBy: { revisionNumber: 'asc' },
      }),
    );
    expect(revs).toHaveLength(2);
    expect(Number(revs[1]?.unitPrice)).toBe(55);
    expect(revs[1]?.changeCommandContext).toBe('correction.post_confirm');
  });

  // ─── WB01 billing flag ──────────────────────────────────────────────────

  it('WB01-BILLFLAG-01 — flag OFF + snapshot present uses legacy unitPrice 0', async () => {
    const appointmentId = await createPendingAppointment({ status: 'CONFIRMED' });
    await concurrency.withBookingTransaction(async (client) => {
      await snapshots.captureCanonicalRevision1(client, {
        tenantId,
        appointmentId,
        actorId: providerId,
        commercial: commercial({ unitPrice: 99 }),
      });
    });
    await wrapper.withPlatformBypass(async (c) => {
      await c.tenant.update({
        where: { id: tenantId },
        data: { features: { 'billing.invoice.from.snapshot': false } },
      });
    });
    const captured: unknown[] = [];
    const createInvoice = {
      execute: jest.fn(async (cmd: { lineItems: unknown[] }) => {
        captured.push(...cmd.lineItems);
        return { invoiceId: randomUUID() };
      }),
    };
    await invoiceHandlerFor(appointmentId, createInvoice).execute(appointmentId);
    expect(captured[0]).toMatchObject({ unitPrice: 0 });
    expect(captured[0]).not.toMatchObject({ unitPrice: 99 });
  });

  it('WB01-BILLFLAG-02 — flag ON + snapshot uses snapshot unitPrice', async () => {
    const appointmentId = await createPendingAppointment({ status: 'CONFIRMED' });
    await concurrency.withBookingTransaction(async (client) => {
      await snapshots.captureCanonicalRevision1(client, {
        tenantId,
        appointmentId,
        actorId: providerId,
        commercial: commercial({ unitPrice: 88 }),
      });
    });
    await wrapper.withPlatformBypass(async (c) => {
      await c.tenant.update({
        where: { id: tenantId },
        data: { features: { 'billing.invoice.from.snapshot': true } },
      });
    });
    const captured: unknown[] = [];
    const createInvoice = {
      execute: jest.fn(async (cmd: { lineItems: unknown[] }) => {
        captured.push(...cmd.lineItems);
        return { invoiceId: randomUUID() };
      }),
    };
    await invoiceHandlerFor(appointmentId, createInvoice).execute(appointmentId);
    expect(captured[0]).toMatchObject({ unitPrice: 88, quantity: 1 });
  });

  it('WB01-BILLFLAG-03 — flag ON + no snapshot rejects; createInvoice not called', async () => {
    const appointmentId = await createPendingAppointment({ status: 'CONFIRMED' });
    await wrapper.withPlatformBypass(async (c) => {
      await c.tenant.update({
        where: { id: tenantId },
        data: { features: { 'billing.invoice.from.snapshot': true } },
      });
    });
    const createInvoice = { execute: jest.fn(async () => ({ invoiceId: randomUUID() })) };
    await expect(
      invoiceHandlerFor(appointmentId, createInvoice).execute(appointmentId),
    ).rejects.toThrow(/missing effective snapshot/i);
    expect(createInvoice.execute).not.toHaveBeenCalled();
  });

  // ─── WB02 eligibility time / readiness / lifecycle / TX contract ────────

  it('WB02-TIME-01 — effectiveTo before future appointment at rejects', async () => {
    const futureStart = new Date('2026-12-01T10:00:00.000Z');
    await eligibility.createEligibilityRow({
      tenantId,
      providerUserId: providerId,
      clinicalServiceId,
      branchId: null,
      effectiveFrom: new Date('2020-01-01T00:00:00.000Z'),
      effectiveTo: new Date('2026-11-01T00:00:00.000Z'),
      actorId: providerId,
    });
    await expect(
      eligibility.assertEligible({
        tenantId,
        providerUserId: providerId,
        clinicalServiceId,
        branchId: null,
        at: futureStart,
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('WB02-TIME-02 — future effectiveFrom allows when at equals that future time', async () => {
    const futureFrom = new Date('2027-06-01T10:00:00.000Z');
    await eligibility.createEligibilityRow({
      tenantId,
      providerUserId: providerId,
      clinicalServiceId,
      branchId: null,
      effectiveFrom: futureFrom,
      actorId: providerId,
    });
    await expect(
      eligibility.assertEligible({
        tenantId,
        providerUserId: providerId,
        clinicalServiceId,
        branchId: null,
        at: futureFrom,
      }),
    ).resolves.toBeUndefined();
  });

  it('WB02-READY-EMPTY-01 — empty tenant coverage [] and readiness throws', async () => {
    const emptyTenantId = randomUUID();
    await wrapper.withPlatformBypass(async (c) => {
      await c.tenant.create({
        data: {
          id: emptyTenantId,
          name: 'WB Empty',
          slug: `wb-empty-${emptyTenantId.slice(0, 8)}`,
        },
      });
    });
    try {
      const report = await eligibility.buildAuthoritativeCoverageReport(emptyTenantId);
      expect(report).toEqual([]);
      expect(() => eligibility.assertReadinessForEnforcementOn(report)).toThrow(
        ForbiddenException,
      );
    } finally {
      await wrapper.withPlatformBypass(async (c) => {
        await c.tenant.deleteMany({ where: { id: emptyTenantId } });
      });
    }
  });

  it('WB02-LIFE-01 — deactivateEligibilityRow fails assertEligible when enforcement ON', async () => {
    const row = await eligibility.createEligibilityRow({
      tenantId,
      providerUserId: providerId,
      clinicalServiceId,
      branchId: null,
      effectiveFrom: new Date('2020-01-01T00:00:00.000Z'),
      actorId: providerId,
    });
    await eligibility.deactivateEligibilityRow({
      tenantId,
      eligibilityId: row.id,
      actorId: providerId,
    });
    await expect(
      eligibility.assertEligible({
        tenantId,
        providerUserId: providerId,
        clinicalServiceId,
        branchId: null,
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('WB02-LIFE-02 — deactivate emits scheduling.eligibility.deactivate audit', async () => {
    fakeAudit.entries.length = 0;
    const row = await eligibility.createEligibilityRow({
      tenantId,
      providerUserId: providerId,
      clinicalServiceId,
      branchId: null,
      effectiveFrom: new Date('2020-01-01T00:00:00.000Z'),
      actorId: providerId,
    });
    await eligibility.deactivateEligibilityRow({
      tenantId,
      eligibilityId: row.id,
      actorId: providerId,
    });
    expect(
      fakeAudit.entries.some(
        (e) =>
          e.action === 'scheduling.eligibility.deactivate' && e.resourceId === row.id,
      ),
    ).toBe(true);
  });

  it('WB02-TX-ELIG-01 — create-appointment.handler asserts eligibility inside withBookingTransaction', () => {
    const src = fs.readFileSync(
      path.join(__dirname, '../application/handlers/create-appointment.handler.ts'),
      'utf8',
    );
    const txBlock = src.split('withBookingTransaction')[1] ?? '';
    expect(txBlock).toMatch(/assertEligible/);
    expect(txBlock).toMatch(/client/);
    expect(src).toMatch(/await this\.eligibility\.assertEligible\(\{[\s\S]*?client,/);
  });

  // ─── WB03 portal idempotency ────────────────────────────────────────────

  it('WB03-IDEMP-02 — concurrent same key → one proceed', async () => {
    const idem = new PortalSchedulingIdempotencyService(wrapper as never);
    const fingerprint = idem.fingerprint({ x: 1 });
    const key = `k-${randomUUID()}`;
    const run = async () => {
      const gate = await idem.beginOrReplay({
        tenantId,
        patientId,
        operation: 'book',
        idempotencyKey: key,
        fingerprint,
      });
      if (gate.kind === 'replay') return 'replay';
      await new Promise((r) => setTimeout(r, 30));
      await idem.complete(gate.rowId, fingerprint, { ok: true }, gate.ownerToken);
      return 'proceed';
    };
    const settled = await Promise.allSettled([run(), run()]);
    const values = settled
      .filter((s) => s.status === 'fulfilled')
      .map((s) => (s as PromiseFulfilledResult<'replay' | 'proceed'>).value);
    expect(values).toContain('proceed');
    expect(values.filter((v) => v === 'proceed').length).toBe(1);
  });

  it('WB03-IDEMP-03 — complete then replay returns same result', async () => {
    const idem = new PortalSchedulingIdempotencyService(wrapper as never);
    const fingerprint = idem.fingerprint({ book: true });
    const key = `k-${randomUUID()}`;
    const result = { appointmentId: randomUUID() };
    const gate = await idem.beginOrReplay({
      tenantId,
      patientId,
      operation: 'book',
      idempotencyKey: key,
      fingerprint,
    });
    expect(gate.kind).toBe('proceed');
    if (gate.kind !== 'proceed') return;
    await idem.complete(gate.rowId, fingerprint, result, gate.ownerToken);
    const replay = await idem.beginOrReplay({
      tenantId,
      patientId,
      operation: 'book',
      idempotencyKey: key,
      fingerprint,
    });
    expect(replay).toEqual({ kind: 'replay', result });
  });

  it('WB03-IDEMP-04 — same key different fingerprint → ConflictException', async () => {
    const idem = new PortalSchedulingIdempotencyService(wrapper as never);
    const key = `k-${randomUUID()}`;
    const gate = await idem.beginOrReplay({
      tenantId,
      patientId,
      operation: 'book',
      idempotencyKey: key,
      fingerprint: idem.fingerprint({ a: 1 }),
    });
    expect(gate.kind).toBe('proceed');
    await expect(
      idem.beginOrReplay({
        tenantId,
        patientId,
        operation: 'book',
        idempotencyKey: key,
        fingerprint: idem.fingerprint({ a: 2 }),
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('WB03-IDEMP-05 — fail() then beginOrReplay allows proceed again', async () => {
    const idem = new PortalSchedulingIdempotencyService(wrapper as never);
    const fingerprint = idem.fingerprint({ retry: 1 });
    const key = `k-${randomUUID()}`;
    const gate = await idem.beginOrReplay({
      tenantId,
      patientId,
      operation: 'book',
      idempotencyKey: key,
      fingerprint,
    });
    expect(gate.kind).toBe('proceed');
    if (gate.kind !== 'proceed') return;
    await idem.fail(gate.rowId, gate.ownerToken);
    const again = await idem.beginOrReplay({
      tenantId,
      patientId,
      operation: 'book',
      idempotencyKey: key,
      fingerprint,
    });
    expect(again.kind).toBe('proceed');
  });

  it('WB03-IDEMP-06 — stale IN_PROGRESS (expiresAt past) is reclaimable', async () => {
    const idem = new PortalSchedulingIdempotencyService(wrapper as never);
    const fingerprint = idem.fingerprint({ stale: true });
    const key = `k-${randomUUID()}`;
    const gate = await idem.beginOrReplay({
      tenantId,
      patientId,
      operation: 'book',
      idempotencyKey: key,
      fingerprint,
    });
    expect(gate.kind).toBe('proceed');
    if (gate.kind !== 'proceed') return;
    await wrapper.withPlatformBypass(async (c) => {
      await c.portalSchedulingIdempotencyLedger.update({
        where: { id: gate.rowId },
        data: { expiresAt: new Date(Date.now() - 60_000) },
      });
    });
    const reclaimed = await idem.beginOrReplay({
      tenantId,
      patientId,
      operation: 'book',
      idempotencyKey: key,
      fingerprint,
    });
    expect(reclaimed.kind).toBe('proceed');
    if (reclaimed.kind === 'proceed') {
      expect(reclaimed.rowId).toBe(gate.rowId);
    }
  });

  // ─── WB04 bulk / clear requirements ─────────────────────────────────────

  it('WB04-BULK-01 — secondary resource conflict after shifted overlap', async () => {
    const start = new Date('2026-11-10T10:00:00.000Z');
    const end = new Date('2026-11-10T10:30:00.000Z');
    const shiftedStart = new Date('2026-11-10T10:15:00.000Z');
    const shiftedEnd = new Date('2026-11-10T10:45:00.000Z');
    const apptId = randomUUID();
    await concurrency.withBookingTransaction(async (client) => {
      await client.appointment.create({
        data: {
          id: apptId,
          tenantId,
          patientId,
          providerId,
          scheduledStart: start,
          scheduledEnd: end,
          status: 'PENDING',
          resourceId: roomId,
        },
      });
      await concurrency.replaceResourceAllocations(client, {
        tenantId,
        appointmentId: apptId,
        resourceIds: [roomId, room2Id],
      });
    });
    await expect(
      concurrency.withBookingTransaction(async (client) => {
        await concurrency.assertSlotAvailableUnderLock(client, {
          tenantId,
          providerId: randomUUID(),
          resourceIds: [room2Id],
          start: shiftedStart,
          end: shiftedEnd,
        });
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('WB04-CLEAR — empty alloc rejects when requirements exist; OK when none; foreign DENY', async () => {
    await expect(
      resources.assertRequirementsSatisfied({
        tenantId,
        clinicalServiceId,
        branchId: null,
        allocatedResourceIds: [],
      }),
    ).resolves.toBeUndefined();

    await resources.upsertRequirement({
      tenantId,
      clinicalServiceId,
      resourceType: 'ROOM',
      quantity: 1,
      actorId: providerId,
    });
    await expect(
      resources.assertRequirementsSatisfied({
        tenantId,
        clinicalServiceId,
        branchId: null,
        allocatedResourceIds: [],
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    const foreignRoom = randomUUID();
    await wrapper.withPlatformBypass(async (c) => {
      await c.schedulingResource.create({
        data: {
          id: foreignRoom,
          tenantId: otherTenantId,
          name: 'Foreign',
          resourceType: 'ROOM',
          isActive: true,
        },
      });
      await c.serviceResourceRequirement.deleteMany({
        where: { tenantId, clinicalServiceId },
      });
    });
    await expect(
      resources.assertRequirementsSatisfied({
        tenantId,
        clinicalServiceId,
        branchId: null,
        allocatedResourceIds: [foreignRoom],
      }),
    ).rejects.toThrow(/invalid for this tenant/i);
  });

  // ─── WB05 resource / service ownership ──────────────────────────────────

  it('WB05-RESOWN-01 — no requirements + foreign tenant resource → DENY', async () => {
    const foreignRoom = randomUUID();
    await wrapper.withPlatformBypass(async (c) => {
      await c.schedulingResource.create({
        data: {
          id: foreignRoom,
          tenantId: otherTenantId,
          name: 'Foreign2',
          resourceType: 'ROOM',
          isActive: true,
        },
      });
    });
    await expect(
      resources.assertRequirementsSatisfied({
        tenantId,
        clinicalServiceId,
        branchId: null,
        allocatedResourceIds: [foreignRoom],
      }),
    ).rejects.toThrow(/invalid for this tenant/i);
  });

  it('WB05-RESOWN-03 — same-tenant optional resource ALLOW when no requirements', async () => {
    await expect(
      resources.assertRequirementsSatisfied({
        tenantId,
        clinicalServiceId,
        branchId: null,
        allocatedResourceIds: [roomId],
      }),
    ).resolves.toBeUndefined();
  });

  it('WB05-SVCOWN-01 — TENANT_CUSTOM of other tenant forbidden for eligibility create', async () => {
    const foreignServiceId = randomUUID();
    extraClinicalServiceIds.push(foreignServiceId);
    await wrapper.withPlatformBypass(async (c) => {
      await c.canonicalClinicalServiceDefinition.create({
        data: {
          id: foreignServiceId,
          tenantId: otherTenantId,
          provenance: 'TENANT_CUSTOM',
          stableKey: `tenant.custom_${foreignServiceId.slice(0, 8)}`,
          domain: 'GENERAL',
          lifecycle: 'PUBLISHED',
          publishedAt: new Date(),
          translations: { create: [{ locale: 'en', displayName: 'Other Custom' }] },
        },
      });
    });
    await expect(
      eligibility.createEligibilityRow({
        tenantId,
        providerUserId: providerId,
        clinicalServiceId: foreignServiceId,
        branchId: null,
        effectiveFrom: new Date('2020-01-01T00:00:00.000Z'),
        actorId: providerId,
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  // ─── WB07 RLS ───────────────────────────────────────────────────────────

  it('WB07-RLS-SNAP-01 — booking_app cross-tenant cannot read snapshot revisions', async () => {
    const appointmentId = await createPendingAppointment();
    await concurrency.withBookingTransaction(async (client) => {
      await snapshots.captureCanonicalRevision1(client, {
        tenantId,
        appointmentId,
        actorId: providerId,
        commercial: commercial({ unitPrice: 12 }),
      });
    });
    const app = new (await import('@prisma/client')).PrismaClient({
      datasources: { db: { url: BOOKING_APP_URL } },
    });
    try {
      const rows = await app.$transaction(async (tx) => {
        await tx.$executeRaw`SELECT set_config('app.platform_rls_bypass', 'false', true)`;
        await tx.$executeRaw`SELECT set_config('app.current_tenant_id', ${otherTenantId}, true)`;
        return tx.appointmentServiceSnapshotRevision.findMany({
          where: { tenantId },
        });
      });
      expect(rows).toHaveLength(0);
    } finally {
      await app.$disconnect();
    }
  });

  it('WB07-RLS-ALLOC — booking_app cross-tenant cannot read resource allocations', async () => {
    const start = new Date('2026-11-12T10:00:00.000Z');
    const end = new Date('2026-11-12T10:30:00.000Z');
    const apptId = randomUUID();
    await concurrency.withBookingTransaction(async (client) => {
      await client.appointment.create({
        data: {
          id: apptId,
          tenantId,
          patientId,
          providerId,
          scheduledStart: start,
          scheduledEnd: end,
          status: 'PENDING',
          resourceId: roomId,
        },
      });
      await concurrency.replaceResourceAllocations(client, {
        tenantId,
        appointmentId: apptId,
        resourceIds: [roomId, room2Id],
      });
    });
    const app = new (await import('@prisma/client')).PrismaClient({
      datasources: { db: { url: BOOKING_APP_URL } },
    });
    try {
      const rows = await app.$transaction(async (tx) => {
        await tx.$executeRaw`SELECT set_config('app.platform_rls_bypass', 'false', true)`;
        await tx.$executeRaw`SELECT set_config('app.current_tenant_id', ${otherTenantId}, true)`;
        return tx.appointmentResourceAllocation.findMany({
          where: { tenantId },
        });
      });
      expect(rows).toHaveLength(0);
    } finally {
      await app.$disconnect();
    }
  });

  it('WB07-RLS-ELIG — booking_app cross-tenant cannot read eligibility', async () => {
    await eligibility.createEligibilityRow({
      tenantId,
      providerUserId: providerId,
      clinicalServiceId,
      branchId: null,
      effectiveFrom: new Date('2020-01-01T00:00:00.000Z'),
      actorId: providerId,
    });
    const app = new (await import('@prisma/client')).PrismaClient({
      datasources: { db: { url: BOOKING_APP_URL } },
    });
    try {
      const rows = await app.$transaction(async (tx) => {
        await tx.$executeRaw`SELECT set_config('app.platform_rls_bypass', 'false', true)`;
        await tx.$executeRaw`SELECT set_config('app.current_tenant_id', ${otherTenantId}, true)`;
        return tx.providerServiceEligibility.findMany({
          where: { tenantId },
        });
      });
      expect(rows).toHaveLength(0);
    } finally {
      await app.$disconnect();
    }
  });
});
