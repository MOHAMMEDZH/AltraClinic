/**
 * Wave B PA blockers — WB01..WB07 (real PostgreSQL where enabled).
 *
 * Run:
 *   ALLOW_TEST_DATABASE_RESET=true RUN_PLATFORM_DB_SECURITY=true \
 *   npx jest --runInBand --testPathIgnorePatterns=[] \
 *     --testPathPattern=wave-b-pa-blockers.postgres.integration.spec
 */
import { randomUUID } from 'crypto';
import { ConflictException, ForbiddenException } from '@nestjs/common';
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

describeDb('Wave B PA blockers WB01–WB07 (PostgreSQL)', () => {
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
    fakeAudit.entries.length = 0;

    await wrapper.withPlatformBypass(async (c) => {
      await c.tenant.create({
        data: {
          id: tenantId,
          name: 'WB PA',
          slug: `wb-pa-${tenantId.slice(0, 8)}`,
          features: { 'booking.eligibility.enforcement': true },
        },
      });
      await c.tenant.create({
        data: {
          id: otherTenantId,
          name: 'WB PA Other',
          slug: `wb-pa-o-${otherTenantId.slice(0, 8)}`,
        },
      });
      await c.branch.create({ data: { id: branchId, tenantId, name: 'Main' } });
      await c.user.create({
        data: {
          id: providerId,
          tenantId,
          email: `pa-${providerId.slice(0, 8)}@test.local`,
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
            stableKey: `canonical.pa_${id.slice(0, 8)}`,
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
        where: { clinicalServiceId: { in: [clinicalServiceId, clinicalServiceId2] } },
      });
      await c.canonicalClinicalServiceDefinition.deleteMany({
        where: { id: { in: [clinicalServiceId, clinicalServiceId2] } },
      });
      await c.userRoleAssignment.deleteMany({ where: { userId: providerId } });
      await c.user.deleteMany({ where: { id: providerId } });
      await c.patient.deleteMany({ where: { tenantId: { in: [tenantId, otherTenantId] } } });
      await c.branch.deleteMany({ where: { id: branchId } });
      await c.tenant.deleteMany({ where: { id: { in: [tenantId, otherTenantId] } } });
    });
  });

  function commercial(overrides: Record<string, unknown> = {}) {
    return {
      clinicalServiceId,
      stableKey: 'canonical.pa',
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

  it('WB01-SNAP-01 — raw SQL UPDATE on snapshot revisions raises', async () => {
    const appointmentId = randomUUID();
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
        actorId: providerId,
        commercial: commercial(),
      });
    });
    const rev = await wrapper.withPlatformBypass((c) =>
      c.appointmentServiceSnapshotRevision.findFirst({ where: { appointmentId } }),
    );
    await expect(
      wrapper.withPlatformBypass(async (c) => {
        await c.$executeRawUnsafe(
          `UPDATE appointment_service_snapshot_revisions SET "unitPrice" = 1 WHERE id = $1::uuid`,
          rev!.id,
        );
      }),
    ).rejects.toThrow(/append-only/i);
  });

  it('WB01-SNAP-IMM-01 — direct DB snapshot UPDATE rejected', async () => {
    const appointmentId = randomUUID();
    await concurrency.withBookingTransaction(async (client) => {
      await client.appointment.create({
        data: {
          id: appointmentId,
          tenantId,
          patientId,
          providerId,
          scheduledStart: new Date('2026-10-01T11:00:00.000Z'),
          scheduledEnd: new Date('2026-10-01T11:30:00.000Z'),
          status: 'PENDING',
        },
      });
      await snapshots.captureCanonicalRevision1(client, {
        tenantId,
        appointmentId,
        actorId: providerId,
        commercial: commercial({ unitPrice: 9 }),
      });
    });
    const rev = await wrapper.withPlatformBypass((c) =>
      c.appointmentServiceSnapshotRevision.findFirst({ where: { appointmentId } }),
    );
    await expect(
      wrapper.withPlatformBypass(async (c) => {
        await c.$executeRawUnsafe(
          `UPDATE appointment_service_snapshot_revisions SET "currency" = 'USD' WHERE id = $1::uuid`,
          rev!.id,
        );
      }),
    ).rejects.toThrow(/append-only/i);
  });

  it('WB01-SNAP-IMM-02 — direct DB snapshot DELETE rejected', async () => {
    const appointmentId = randomUUID();
    await concurrency.withBookingTransaction(async (client) => {
      await client.appointment.create({
        data: {
          id: appointmentId,
          tenantId,
          patientId,
          providerId,
          scheduledStart: new Date('2026-10-01T12:00:00.000Z'),
          scheduledEnd: new Date('2026-10-01T12:30:00.000Z'),
          status: 'PENDING',
        },
      });
      await snapshots.captureCanonicalRevision1(client, {
        tenantId,
        appointmentId,
        actorId: providerId,
        commercial: commercial(),
      });
    });
    const rev = await wrapper.withPlatformBypass((c) =>
      c.appointmentServiceSnapshotRevision.findFirst({ where: { appointmentId } }),
    );
    await expect(
      wrapper.withPlatformBypass(async (c) => {
        await c.$executeRawUnsafe(
          `DELETE FROM appointment_service_snapshot_revisions WHERE id = $1::uuid`,
          rev!.id,
        );
      }),
    ).rejects.toThrow(/append-only/i);
  });

  it('WB02-READY-01 — two services, only one covered → activation blocked', async () => {
    await eligibility.createEligibilityRow({
      tenantId,
      providerUserId: providerId,
      clinicalServiceId,
      branchId: null,
      effectiveFrom: new Date('2020-01-01T00:00:00.000Z'),
      actorId: providerId,
    });
    const report = await eligibility.buildAuthoritativeCoverageReport(tenantId);
    expect(report.some((r) => r.status !== 'covered')).toBe(true);
    expect(() => eligibility.assertReadinessForEnforcementOn(report)).toThrow(ForbiddenException);
  });

  it('WB02-READY-02 — full authoritative coverage can activate', async () => {
    for (const svc of [clinicalServiceId, clinicalServiceId2]) {
      await eligibility.createEligibilityRow({
        tenantId,
        providerUserId: providerId,
        clinicalServiceId: svc,
        branchId: null,
        effectiveFrom: new Date('2020-01-01T00:00:00.000Z'),
        actorId: providerId,
      });
    }
    const report = await eligibility.buildAuthoritativeCoverageReport(tenantId);
    expect(() => eligibility.assertReadinessForEnforcementOn(report)).not.toThrow();
    const updated = await eligibility.activateEnforcement(
      tenantId,
      { 'booking.eligibility.enforcement': true },
      { actorId: providerId },
    );
    expect((updated.features as Record<string, unknown>)['booking.eligibility.enforcement']).toBe(
      true,
    );
  });

  it('WB02-AUDIT-01 — activation emits authenticated audit', async () => {
    fakeAudit.entries.length = 0;
    for (const svc of [clinicalServiceId, clinicalServiceId2]) {
      await eligibility.createEligibilityRow({
        tenantId,
        providerUserId: providerId,
        clinicalServiceId: svc,
        branchId: null,
        effectiveFrom: new Date('2020-01-01T00:00:00.000Z'),
        actorId: providerId,
      });
    }
    await eligibility.activateEnforcement(
      tenantId,
      { 'booking.eligibility.enforcement': true },
      { actorId: providerId },
    );
    expect(
      fakeAudit.entries.some(
        (e) =>
          e.action === 'scheduling.eligibility.enforcement.activate' &&
          e.resourceId === tenantId,
      ),
    ).toBe(true);
  });

  it('WB02-ELIG-02 — commercial correction service change rechecks eligibility', async () => {
    await eligibility.createEligibilityRow({
      tenantId,
      providerUserId: providerId,
      clinicalServiceId,
      branchId: null,
      effectiveFrom: new Date('2020-01-01T00:00:00.000Z'),
      actorId: providerId,
    });
    await expect(
      eligibility.assertEligible({
        tenantId,
        providerUserId: providerId,
        clinicalServiceId: clinicalServiceId2,
        branchId: null,
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    const fs = await import('fs');
    const path = await import('path');
    const src = fs.readFileSync(
      path.join(__dirname, '../controllers/booking-integrity.controller.ts'),
      'utf8',
    );
    expect(src).toMatch(/await this\.eligibility\.assertEligible/);
  });

  it('WB02-ELIG-03 — commercial correction rechecks resources', async () => {
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
    ).rejects.toThrow();
    const fs = await import('fs');
    const path = await import('path');
    const src = fs.readFileSync(
      path.join(__dirname, '../controllers/booking-integrity.controller.ts'),
      'utf8',
    );
    expect(src).toMatch(/await this\.resources\.assertRequirementsSatisfied/);
  });

  it('WB06-AUDIT-01 — correction actor = authenticated actor', async () => {
    const fs = await import('fs');
    const path = await import('path');
    const src = fs.readFileSync(
      path.join(__dirname, '../controllers/booking-integrity.controller.ts'),
      'utf8',
    );
    const correction = src.split('commercialCorrection')[1] ?? '';
    expect(correction).toMatch(/const actorId = user\.sub/);
    expect(correction).toMatch(/action: 'scheduling\.commercial_correction'/);
    expect(correction).not.toMatch(/body\.actorId/);
    expect(correction).not.toMatch(/randomUUID\(\)/);
  });

  it('WB03-IDEMP-01 — concurrent same portal idempotency key → single winner', async () => {
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

  it('WB05-TENANT-01 — foreign provider eligibility create rejected', async () => {
    await expect(
      eligibility.createEligibilityRow({
        tenantId,
        providerUserId: randomUUID(),
        clinicalServiceId,
        branchId: null,
        effectiveFrom: new Date('2020-01-01T00:00:00.000Z'),
        actorId: providerId,
      }),
    ).rejects.toThrow(/Provider user not found/i);
  });

  it('WB07-PERM-01 — Wave B permission-route validator synchronizes matrices', async () => {
    const { spawnSync } = await import('child_process');
    const path = await import('path');
    const apiRoot = path.resolve(__dirname, '../../../../');
    const result = spawnSync(process.execPath, ['scripts/validate-phase48-wave-b-permission-routes.mjs'], {
      cwd: apiRoot,
      encoding: 'utf8',
    });
    expect(result.status).toBe(0);
    expect((result.stdout ?? '') + (result.stderr ?? '')).toMatch(
      /PHASE48_WAVE_B_PERMISSION_ROUTES_VALIDATOR_PASSED/,
    );
  });

  it('WB03-ROLLBACK-01 — create-then-throw before snapshot leaves zero rows', async () => {
    const beforeA = await wrapper.withPlatformBypass((c) =>
      c.appointment.count({ where: { tenantId } }),
    );
    const beforeS = await wrapper.withPlatformBypass((c) =>
      c.appointmentServiceSnapshotRevision.count({ where: { tenantId } }),
    );
    await expect(
      concurrency.withBookingTransaction(async (client) => {
        const id = randomUUID();
        await client.appointment.create({
          data: {
            id,
            tenantId,
            patientId,
            providerId,
            scheduledStart: new Date('2026-10-02T10:00:00.000Z'),
            scheduledEnd: new Date('2026-10-02T10:30:00.000Z'),
            status: 'PENDING',
          },
        });
        throw new Error('force rollback before snapshot');
      }),
    ).rejects.toThrow(/force rollback/);
    const afterA = await wrapper.withPlatformBypass((c) =>
      c.appointment.count({ where: { tenantId } }),
    );
    const afterS = await wrapper.withPlatformBypass((c) =>
      c.appointmentServiceSnapshotRevision.count({ where: { tenantId } }),
    );
    expect(afterA).toBe(beforeA);
    expect(afterS).toBe(beforeS);
  });

  it('WB04-RES-01..04 — multi-resource allocations persist + overlap via allocation join', async () => {
    const start = new Date('2026-10-03T10:00:00.000Z');
    const end = new Date('2026-10-03T10:30:00.000Z');
    const apptId = randomUUID();
    await concurrency.withBookingTransaction(async (client) => {
      await concurrency.assertSlotAvailableUnderLock(client, {
        tenantId,
        providerId,
        resourceIds: [roomId, room2Id],
        start,
        end,
      });
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
    const allocs = await wrapper.withPlatformBypass((c) =>
      c.appointmentResourceAllocation.findMany({ where: { appointmentId: apptId } }),
    );
    expect(allocs).toHaveLength(2);

    await expect(
      concurrency.withBookingTransaction(async (client) => {
        await concurrency.assertSlotAvailableUnderLock(client, {
          tenantId,
          providerId: randomUUID(),
          resourceIds: [room2Id],
          start,
          end,
        });
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('WB05-RLS-01 — cross-tenant cannot read eligibility without bypass', async () => {
    await eligibility.createEligibilityRow({
      tenantId,
      providerUserId: providerId,
      clinicalServiceId,
      branchId: null,
      effectiveFrom: new Date('2020-01-01T00:00:00.000Z'),
      actorId: providerId,
    });
    // Superuser (booking) bypasses RLS; use non-super app role like tenant-isolation specs.
    const app = new (await import('@prisma/client')).PrismaClient({
      datasources: {
        db: {
          url: 'postgresql://booking_app:booking_app@localhost:5433/booking_test?schema=public',
        },
      },
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

  it('WB05-RLS-02 — same-tenant context can read own eligibility', async () => {
    await eligibility.createEligibilityRow({
      tenantId,
      providerUserId: providerId,
      clinicalServiceId,
      branchId: null,
      effectiveFrom: new Date('2020-01-01T00:00:00.000Z'),
      actorId: providerId,
    });
    const app = new (await import('@prisma/client')).PrismaClient({
      datasources: {
        db: {
          url: 'postgresql://booking_app:booking_app@localhost:5433/booking_test?schema=public',
        },
      },
    });
    try {
      const rows = await app.$transaction(async (tx) => {
        await tx.$executeRaw`SELECT set_config('app.platform_rls_bypass', 'false', true)`;
        await tx.$executeRaw`SELECT set_config('app.current_tenant_id', ${tenantId}, true)`;
        return tx.providerServiceEligibility.findMany({
          where: { tenantId },
        });
      });
      expect(rows.length).toBeGreaterThanOrEqual(1);
    } finally {
      await app.$disconnect();
    }
  });

  it('WB04-RES-01 — multi-resource booking persists all resources', async () => {
    const start = new Date('2026-10-05T10:00:00.000Z');
    const end = new Date('2026-10-05T10:30:00.000Z');
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
    const allocs = await wrapper.withPlatformBypass((c) =>
      c.appointmentResourceAllocation.findMany({ where: { appointmentId: apptId } }),
    );
    expect(allocs.map((a) => a.schedulingResourceId).sort()).toEqual([roomId, room2Id].sort());
    const appt = await wrapper.withPlatformBypass((c) =>
      c.appointment.findUnique({ where: { id: apptId } }),
    );
    expect(appt?.resourceId).toBe(roomId);
  });

  it('WB04-RES-02 — secondary resource blocks overlapping later booking', async () => {
    const start = new Date('2026-10-05T11:00:00.000Z');
    const end = new Date('2026-10-05T11:30:00.000Z');
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
          start,
          end,
        });
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('WB04-RES-03 — reschedule updates all allocations atomically', async () => {
    const start = new Date('2026-10-05T12:00:00.000Z');
    const end = new Date('2026-10-05T12:30:00.000Z');
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
      await concurrency.replaceResourceAllocations(client, {
        tenantId,
        appointmentId: apptId,
        resourceIds: [room2Id],
      });
    });
    const allocs = await wrapper.withPlatformBypass((c) =>
      c.appointmentResourceAllocation.findMany({ where: { appointmentId: apptId } }),
    );
    expect(allocs).toHaveLength(1);
    expect(allocs[0]?.schedulingResourceId).toBe(room2Id);
  });

  it('WB04-RES-04 — cancel frees all resource allocations per status rule', async () => {
    const start = new Date('2026-10-05T13:00:00.000Z');
    const end = new Date('2026-10-05T13:30:00.000Z');
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
      await client.appointment.update({
        where: { id: apptId },
        data: { status: 'CANCELLED' },
      });
    });
    await expect(
      concurrency.withBookingTransaction(async (client) => {
        await concurrency.assertSlotAvailableUnderLock(client, {
          tenantId,
          providerId: randomUUID(),
          resourceIds: [room2Id],
          start,
          end,
        });
      }),
    ).resolves.toBeUndefined();
  });

  it('WB05-TENANT-02 — foreign resource allocation rejected by ownership check', async () => {
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
    });
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
        allocatedResourceIds: [foreignRoom],
      }),
    ).rejects.toThrow(/invalid for this tenant/i);
  });

  it('WB06-AUDIT-02 — eligibility lifecycle audited', async () => {
    fakeAudit.entries.length = 0;
    await eligibility.createEligibilityRow({
      tenantId,
      providerUserId: providerId,
      clinicalServiceId,
      branchId: null,
      effectiveFrom: new Date('2020-01-01T00:00:00.000Z'),
      actorId: providerId,
    });
    expect(fakeAudit.entries.some((e) => e.action === 'scheduling.eligibility.create')).toBe(true);
  });

  it('WB06-AUDIT-03 — resource requirement mutation audited', async () => {
    fakeAudit.entries.length = 0;
    await resources.upsertRequirement({
      tenantId,
      clinicalServiceId,
      resourceType: 'ROOM',
      quantity: 1,
      actorId: providerId,
    });
    expect(
      fakeAudit.entries.some((e) => String(e.action).includes('resource')),
    ).toBe(true);
  });

  it('WB06-AUDIT-04 — rolled-back mutation emits no committed appointment/snapshot', async () => {
    const beforeA = await wrapper.withPlatformBypass((c) =>
      c.appointment.count({ where: { tenantId } }),
    );
    const beforeS = await wrapper.withPlatformBypass((c) =>
      c.appointmentServiceSnapshotRevision.count({ where: { tenantId } }),
    );
    await expect(
      concurrency.withBookingTransaction(async (client) => {
        const id = randomUUID();
        await client.appointment.create({
          data: {
            id,
            tenantId,
            patientId,
            providerId,
            scheduledStart: new Date('2026-10-06T10:00:00.000Z'),
            scheduledEnd: new Date('2026-10-06T10:30:00.000Z'),
            status: 'PENDING',
          },
        });
        await snapshots.captureCanonicalRevision1(client, {
          tenantId,
          appointmentId: id,
          actorId: providerId,
          commercial: commercial(),
        });
        throw new Error('force rollback after snapshot');
      }),
    ).rejects.toThrow(/force rollback/);
    const afterA = await wrapper.withPlatformBypass((c) =>
      c.appointment.count({ where: { tenantId } }),
    );
    const afterS = await wrapper.withPlatformBypass((c) =>
      c.appointmentServiceSnapshotRevision.count({ where: { tenantId } }),
    );
    expect(afterA).toBe(beforeA);
    expect(afterS).toBe(beforeS);
  });

  it('WB07-BILL-02 — live PriceVersion change does not alter invoice-from-snapshot', async () => {
    const appointmentId = randomUUID();
    await concurrency.withBookingTransaction(async (client) => {
      await client.appointment.create({
        data: {
          id: appointmentId,
          tenantId,
          patientId,
          providerId,
          scheduledStart: new Date('2026-10-07T10:00:00.000Z'),
          scheduledEnd: new Date('2026-10-07T10:30:00.000Z'),
          status: 'CONFIRMED',
          clinicalServiceId,
        },
      });
      await snapshots.captureCanonicalRevision1(client, {
        tenantId,
        appointmentId,
        actorId: providerId,
        commercial: commercial({ unitPrice: 88 }),
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
          branchId,
          serviceType: 'consultation',
        }),
      } as never,
      createInvoiceHandler as never,
      { resolve: async () => ({ tenantId, branchId }) } as never,
      wrapper as never,
    );
    await wrapper.withPlatformBypass(async (c) => {
      await c.tenant.update({
        where: { id: tenantId },
        data: { features: { 'billing.invoice.from.snapshot': true } },
      });
    });
    await handler.execute(appointmentId);
    expect(captured[0]).toMatchObject({ unitPrice: 88 });
    const snap = await wrapper.withPlatformBypass((c) =>
      c.appointmentServiceSnapshotRevision.findFirst({ where: { appointmentId } }),
    );
    expect(Number(snap?.unitPrice)).toBe(88);
  });

  it('WB07-BILL-03 — missing required snapshot fails closed with no partial invoice', async () => {
    const appointmentId = randomUUID();
    await wrapper.withPlatformBypass(async (c) => {
      await c.appointment.create({
        data: {
          id: appointmentId,
          tenantId,
          patientId,
          providerId,
          scheduledStart: new Date('2026-10-07T11:00:00.000Z'),
          scheduledEnd: new Date('2026-10-07T11:30:00.000Z'),
          status: 'CONFIRMED',
          clinicalServiceId,
        },
      });
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
          branchId,
          serviceType: 'consultation',
        }),
      } as never,
      createInvoiceHandler as never,
      { resolve: async () => ({ tenantId, branchId }) } as never,
      wrapper as never,
    );
    await expect(handler.execute(appointmentId)).rejects.toThrow(/missing effective snapshot/i);
    expect(createInvoiceHandler.execute).not.toHaveBeenCalled();
  });

  it('WB03-WAIT-01 — canonical-write ON cannot use legacy free-text waitlist bypass', async () => {
    const { isTenantCanonicalWriteEnabled } = await import(
      '../../clinical-catalog/domain/feature-flag.helpers'
    );
    expect(isTenantCanonicalWriteEnabled({ 'catalog.canonical.write': true })).toBe(true);
    const fs = await import('fs');
    const path = await import('path');
    const src = fs.readFileSync(
      path.join(__dirname, '../application/handlers/schedule-settings.handlers.ts'),
      'utf8',
    );
    expect(src).toMatch(/clinicalServiceId is required when catalog\.canonical\.write is ON/);
  });

  it('WB03-WAIT-02 — legacy waitlist path allowed only under bounded legacy mode', async () => {
    const { isTenantCanonicalWriteEnabled } = await import(
      '../../clinical-catalog/domain/feature-flag.helpers'
    );
    expect(isTenantCanonicalWriteEnabled({ 'catalog.canonical.write': false })).toBe(false);
    const fs = await import('fs');
    const path = await import('path');
    const src = fs.readFileSync(
      path.join(__dirname, '../application/handlers/schedule-settings.handlers.ts'),
      'utf8',
    );
    expect(src).toMatch(/canonicalWriteOn && !input\.clinicalServiceId/);
  });

  it('WB07-BILL-01 — invoice from snapshot uses frozen unitPrice', async () => {
    const appointmentId = randomUUID();
    await concurrency.withBookingTransaction(async (client) => {
      await client.appointment.create({
        data: {
          id: appointmentId,
          tenantId,
          patientId,
          providerId,
          scheduledStart: new Date('2026-10-04T10:00:00.000Z'),
          scheduledEnd: new Date('2026-10-04T10:30:00.000Z'),
          status: 'CONFIRMED',
          serviceType: 'consultation',
          clinicalServiceId,
        },
      });
      await snapshots.captureCanonicalRevision1(client, {
        tenantId,
        appointmentId,
        actorId: providerId,
        commercial: commercial({ unitPrice: 77 }),
      });
    });

    const captured: unknown[] = [];
    const createInvoiceHandler = {
      execute: jest.fn(async (cmd: { lineItems: unknown[] }) => {
        captured.push(...cmd.lineItems);
        return { invoiceId: randomUUID() };
      }),
    };
    const repo = {
      findDetailById: async () => ({
        id: appointmentId,
        patientId,
        branchId,
        serviceType: 'consultation',
      }),
    };
    const tenantContext = { resolve: async () => ({ tenantId, branchId }) };
    const handler = new CreateInvoiceFromAppointmentHandler(
      repo as never,
      createInvoiceHandler as never,
      tenantContext as never,
      wrapper as never,
    );

    await wrapper.withPlatformBypass(async (c) => {
      await c.tenant.update({
        where: { id: tenantId },
        data: { features: { 'billing.invoice.from.snapshot': true } },
      });
    });

    await handler.execute(appointmentId);
    expect(captured[0]).toMatchObject({ unitPrice: 77, quantity: 1 });
  });
});
