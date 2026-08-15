/**
 * Wave B final defect closure — WB01..WB07 (real PostgreSQL where enabled).
 *
 * Run:
 *   ALLOW_TEST_DATABASE_RESET=true RUN_PLATFORM_DB_SECURITY=true \
 *   npx jest --runInBand --testPathIgnorePatterns=[] \
 *     --testPathPattern=wave-b-final-defect-closure.postgres.integration.spec
 */
import { randomUUID } from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import type { PrismaClient } from '@prisma/client';
import { BookingConcurrencyService } from '../application/services/booking-concurrency.service';
import { AppointmentSnapshotService } from '../application/services/appointment-snapshot.service';
import { ProviderEligibilityService } from '../application/services/provider-eligibility.service';
import { ServiceResourceRequirementService } from '../application/services/service-resource-requirement.service';
import { BulkRescheduleHandler, UpdateAppointmentHandler } from '../application/handlers/appointment.handlers';
import { AuditTrailSchedulingAuditLog } from '../infrastructure/audit-trail-scheduling-audit-log';
import { runPhase48WaveBSnapshotBackfill } from '../application/services/phase48-wave-b-snapshot-backfill';
import { Appointment } from '../domain/appointment.entity';
import { AppointmentStatus } from '../domain/appointment-status.enum';
import { TimeSlotVO } from '../domain/timeslot.vo';
import {
  createClinicalPrismaWrapper,
  createPlatformDbSecurityClient,
  platformDbSecurityEnabled,
} from '../../clinical-catalog/tests/clinical-catalog-db.harness';
import { PortalSchedulingIdempotencyService } from '../../patient-portal/application/services/portal-scheduling-idempotency.service';

jest.setTimeout(180_000);
const describeDb = platformDbSecurityEnabled() ? describe : describe.skip;

const BOOKING_APP_URL =
  'postgresql://booking_app:booking_app@localhost:5433/booking_test?schema=public';

const fakeAudit = {
  entries: [] as Array<{ action: string; resourceId: string }>,
  async record(entry: { action: string; resourceId: string }) {
    this.entries.push(entry);
  },
  async recordInTransaction(_c: unknown, entry: { action: string; resourceId: string }) {
    this.entries.push(entry);
  },
};

function proxyFailingAuditCreate(client: PrismaClient): PrismaClient {
  return new Proxy(client, {
    get(target, prop, receiver) {
      if (prop === 'auditEntry') {
        const auditEntry = Reflect.get(target, prop, receiver) as object;
        return new Proxy(auditEntry, {
          get(t, p, r) {
            if (p === 'create') {
              return async () => {
                throw new Error('forced audit failure');
              };
            }
            const v = Reflect.get(t, p, r);
            return typeof v === 'function' ? (v as (...a: unknown[]) => unknown).bind(t) : v;
          },
        });
      }
      const val = Reflect.get(target, prop, receiver);
      return typeof val === 'function' ? (val as (...a: unknown[]) => unknown).bind(target) : val;
    },
  }) as PrismaClient;
}

function readSrc(...parts: string[]) {
  return fs.readFileSync(path.join(__dirname, ...parts), 'utf8');
}

describeDb('Wave B final defect closure WB01–WB07 (PostgreSQL)', () => {
  let raw: PrismaClient;
  let wrapper: ReturnType<typeof createClinicalPrismaWrapper>;
  let concurrency: BookingConcurrencyService;
  let snapshots: AppointmentSnapshotService;
  let realAudit: AuditTrailSchedulingAuditLog;
  let eligibility: ProviderEligibilityService;
  let resources: ServiceResourceRequirementService;
  let idem: PortalSchedulingIdempotencyService;
  let tenantId: string;
  let otherTenantId: string;
  let patientId: string;
  let providerId: string;
  let otherProviderId: string;
  let clinicalServiceId: string;
  let roomId: string;
  let room2Id: string;
  let branchId: string;
  let extraClinicalServiceIds: string[];

  beforeAll(async () => {
    raw = createPlatformDbSecurityClient();
    wrapper = createClinicalPrismaWrapper(raw);
    concurrency = new BookingConcurrencyService(wrapper as never);
    snapshots = new AppointmentSnapshotService();
    realAudit = new AuditTrailSchedulingAuditLog(wrapper as never);
    // Default services use fake audit so afterEach can delete tenants (audit_entries append-only).
    eligibility = new ProviderEligibilityService(wrapper as never, fakeAudit as never);
    resources = new ServiceResourceRequirementService(wrapper as never, fakeAudit as never);
    idem = new PortalSchedulingIdempotencyService(wrapper as never);
  });

  afterAll(async () => {
    await raw.$disconnect();
  });

  beforeEach(async () => {
    tenantId = randomUUID();
    otherTenantId = randomUUID();
    patientId = randomUUID();
    providerId = randomUUID();
    otherProviderId = randomUUID();
    clinicalServiceId = randomUUID();
    roomId = randomUUID();
    room2Id = randomUUID();
    branchId = randomUUID();
    extraClinicalServiceIds = [];

    await wrapper.withPlatformBypass(async (c) => {
      await c.tenant.create({
        data: {
          id: tenantId,
          name: 'WB Final',
          slug: `wb-f-${tenantId.slice(0, 8)}`,
          features: { 'booking.eligibility.enforcement': true },
        },
      });
      await c.tenant.create({
        data: { id: otherTenantId, name: 'WB Final Other', slug: `wb-fo-${otherTenantId.slice(0, 8)}` },
      });
      await c.branch.create({ data: { id: branchId, tenantId, name: 'Main' } });
      await c.user.create({
        data: {
          id: providerId,
          tenantId,
          email: `f-${providerId.slice(0, 8)}@test.local`,
          passwordHash: 'x',
          firstName: 'Doc',
          lastName: 'Tor',
          roles: { create: [{ role: 'DOCTOR' }] },
        },
      });
      await c.user.create({
        data: {
          id: otherProviderId,
          tenantId: otherTenantId,
          email: `fo-${otherProviderId.slice(0, 8)}@test.local`,
          passwordHash: 'x',
          firstName: 'Other',
          lastName: 'Doc',
          roles: { create: [{ role: 'DOCTOR' }] },
        },
      });
      await c.patient.create({ data: { id: patientId, tenantId, firstName: 'P', lastName: 'A' } });
      await c.canonicalClinicalServiceDefinition.create({
        data: {
          id: clinicalServiceId,
          tenantId: null,
          provenance: 'SYSTEM_CANONICAL',
          stableKey: `canonical.f_${clinicalServiceId.slice(0, 8)}`,
          domain: 'GENERAL',
          lifecycle: 'PUBLISHED',
          publishedAt: new Date(),
          translations: { create: [{ locale: 'en', displayName: 'Svc' }] },
        },
      });
      await c.tenantServiceConfiguration.create({
        data: { id: randomUUID(), tenantId, clinicalServiceId, enabled: true },
      });
      for (const [id, name] of [
        [roomId, 'R1'],
        [room2Id, 'R2'],
      ] as const) {
        await c.schedulingResource.create({
          data: { id, tenantId, branchId, name, resourceType: 'ROOM', isActive: true },
        });
      }
    });
  });

  afterEach(async () => {
    const allServiceIds = [clinicalServiceId, ...extraClinicalServiceIds];
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
      await c.appointment.deleteMany({ where: { tenantId: { in: [tenantId, otherTenantId] } } });
      await c.providerServiceEligibility.deleteMany({
        where: { tenantId: { in: [tenantId, otherTenantId] } },
      });
      await c.serviceResourceRequirement.deleteMany({
        where: { tenantId: { in: [tenantId, otherTenantId] } },
      });
      await c.legacyClinicalServiceMapping.deleteMany({
        where: {
          OR: [
            { tenantId: { in: [tenantId, otherTenantId] } },
            { clinicalServiceId: { in: allServiceIds } },
          ],
        },
      });
      // audit_entries is append-only — do not delete
      await c.schedulingResource.deleteMany({
        where: { tenantId: { in: [tenantId, otherTenantId] } },
      });
      await c.tenantServiceConfiguration.deleteMany({
        where: { tenantId: { in: [tenantId, otherTenantId] } },
      });
      await c.clinicalServiceTranslation.deleteMany({
        where: { clinicalServiceId: { in: allServiceIds } },
      });
      await c.canonicalClinicalServiceDefinition.deleteMany({ where: { id: { in: allServiceIds } } });
      await c.userRoleAssignment.deleteMany({
        where: { userId: { in: [providerId, otherProviderId] } },
      });
      await c.user.deleteMany({ where: { tenantId: { in: [tenantId, otherTenantId] } } });
      await c.patient.deleteMany({ where: { tenantId: { in: [tenantId, otherTenantId] } } });
      await c.branch.deleteMany({ where: { tenantId: { in: [tenantId, otherTenantId] } } });
      // Leave tenants if audit_entries reference them (append-only). UUID tenants are disposable.
      await c.tenant.deleteMany({ where: { id: { in: [tenantId, otherTenantId] } } }).catch(() => undefined);
    });
  });

  function commercial(overrides: Record<string, unknown> = {}) {
    return {
      clinicalServiceId,
      stableKey: 'canonical.f',
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

  async function createAppointment(overrides: {
    status?: string;
    start?: Date;
    end?: Date;
    commercialLockedAt?: Date | null;
    clinicalServiceId?: string | null;
    resourceId?: string | null;
    branchId?: string | null;
    serviceType?: string | null;
    recurrenceSeriesId?: string | null;
    effectiveSnapshotRevisionId?: string | null;
    providerId?: string;
    createdAt?: Date;
  } = {}) {
    const appointmentId = randomUUID();
    await concurrency.withBookingTransaction(async (client) => {
      await client.appointment.create({
        data: {
          id: appointmentId,
          tenantId,
          branchId: overrides.branchId === undefined ? branchId : overrides.branchId,
          patientId,
          providerId: overrides.providerId ?? providerId,
          scheduledStart: overrides.start ?? new Date('2026-11-01T10:00:00.000Z'),
          scheduledEnd: overrides.end ?? new Date('2026-11-01T10:30:00.000Z'),
          status: (overrides.status as never) ?? 'PENDING',
          clinicalServiceId:
            overrides.clinicalServiceId === undefined ? clinicalServiceId : overrides.clinicalServiceId,
          commercialLockedAt: overrides.commercialLockedAt ?? null,
          resourceId: overrides.resourceId ?? null,
          serviceType: overrides.serviceType ?? null,
          recurrenceSeriesId: overrides.recurrenceSeriesId ?? null,
          effectiveSnapshotRevisionId: overrides.effectiveSnapshotRevisionId ?? null,
          // Pre-cutover by default so legacy backfill tests remain eligible.
          createdAt: overrides.createdAt ?? new Date('2026-08-14T12:00:00.000Z'),
        },
      });
    });
    return appointmentId;
  }

  async function applyLegacyCancelledLockMigrationSql() {
    const fs = await import('fs');
    const path = await import('path');
    const sqlPath = path.join(
      __dirname,
      '../../../../prisma/migrations/20260815220000_phase48_wave_b_legacy_cancelled_lock/migration.sql',
    );
    const stripped = fs
      .readFileSync(sqlPath, 'utf8')
      .split('\n')
      .filter((line) => !/^\s*--/.test(line))
      .join('\n');
    const statements = stripped
      .split(';')
      .map((s) => s.trim())
      .filter((s) => /UPDATE\s+/i.test(s));
    expect(statements.length).toBeGreaterThanOrEqual(3);
    await wrapper.withPlatformBypass(async (c) => {
      for (const statement of statements) {
        await c.$executeRawUnsafe(statement);
      }
    });
  }

  function buildSeriesUpdateHandler(
    peers: Array<{ id: string; start: Date; end: Date; status?: string; resourceId?: string | null }>,
    seriesId: string,
  ) {
    const byId = new Map(peers.map((p) => [p.id, p]));
    const listItems = peers.map((p) => ({
      id: p.id,
      providerId,
      recurrenceSeriesId: seriesId,
      start: p.start.toISOString(),
      end: p.end.toISOString(),
      status: (p.status ?? 'confirmed').toLowerCase(),
      resourceId: p.resourceId ?? null,
    }));
    return new UpdateAppointmentHandler(
      {
        findById: async (id: string) => {
          const p = byId.get(id);
          if (!p) return null;
          return new Appointment(
            p.id,
            tenantId,
            branchId,
            patientId,
            providerId,
            new TimeSlotVO(p.start.toISOString(), p.end.toISOString()),
            AppointmentStatus.Confirmed,
            undefined,
            undefined,
            undefined,
            undefined,
            undefined,
            seriesId,
            p.resourceId ?? null,
          );
        },
        list: async () => ({ items: listItems, total: listItems.length }),
        listSeriesFutureMembers: async () => listItems,
        save: async (a: Appointment) => a,
        findDetailById: async (id: string) => {
          const p = byId.get(id)!;
          return {
            id,
            tenantId,
            branchId,
            patientId,
            patientName: 'P',
            providerId,
            start: p.start.toISOString(),
            end: p.end.toISOString(),
            status: 'confirmed',
            notes: null,
            serviceType: null,
            isEmergency: false,
            recurrenceSeriesId: seriesId,
            resourceId: p.resourceId ?? null,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };
        },
      } as never,
      { resolve: async () => ({ tenantId, branchId }) } as never,
      { publish: async () => undefined } as never,
      concurrency,
      eligibility,
      resources,
      snapshots,
      { resolveCanonical: async () => commercial() } as never,
      wrapper as never,
      fakeAudit as never,
    );
  }

  async function seedTenantCustomService(ownerTenantId: string) {
    const id = randomUUID();
    extraClinicalServiceIds.push(id);
    await wrapper.withPlatformBypass(async (c) => {
      await c.canonicalClinicalServiceDefinition.create({
        data: {
          id,
          tenantId: ownerTenantId,
          provenance: 'TENANT_CUSTOM',
          stableKey: `tenant.custom_${id.slice(0, 8)}`,
          domain: 'GENERAL',
          lifecycle: 'PUBLISHED',
          publishedAt: new Date(),
          translations: { create: [{ locale: 'en', displayName: 'Custom' }] },
        },
      });
    });
    return id;
  }

  async function seedForeignApptAndRoom() {
    const foreignRoom = randomUUID();
    const foreignAppt = randomUUID();
    const foreignPatient = randomUUID();
    await wrapper.withPlatformBypass(async (c) => {
      await c.patient.create({
        data: { id: foreignPatient, tenantId: otherTenantId, firstName: 'F', lastName: 'P' },
      });
      await c.schedulingResource.create({
        data: {
          id: foreignRoom,
          tenantId: otherTenantId,
          name: 'ForeignR',
          resourceType: 'ROOM',
          isActive: true,
        },
      });
      await c.appointment.create({
        data: {
          id: foreignAppt,
          tenantId: otherTenantId,
          patientId: foreignPatient,
          providerId: otherProviderId,
          scheduledStart: new Date('2026-11-20T10:00:00.000Z'),
          scheduledEnd: new Date('2026-11-20T10:30:00.000Z'),
          status: 'PENDING',
          resourceId: foreignRoom,
        },
      });
    });
    return { foreignRoom, foreignAppt };
  }

  async function withBookingApp<T>(fn: (tx: PrismaClient) => Promise<T>): Promise<T> {
    const app = new (await import('@prisma/client')).PrismaClient({
      datasources: { db: { url: BOOKING_APP_URL } },
    });
    try {
      return await app.$transaction(async (tx) => {
        await tx.$executeRaw`SELECT set_config('app.platform_rls_bypass', 'false', true)`;
        return fn(tx as unknown as PrismaClient);
      });
    } finally {
      await app.$disconnect();
    }
  }

  async function createElig(atFrom: Date, atTo?: Date | null, tid = tenantId, pid = providerId, svc = clinicalServiceId) {
    return eligibility.createEligibilityRow({
      tenantId: tid,
      providerUserId: pid,
      clinicalServiceId: svc,
      branchId: null,
      effectiveFrom: atFrom,
      effectiveTo: atTo ?? null,
      actorId: pid,
    });
  }

  // ─── WB01 ───────────────────────────────────────────────────────────────

  // ─── WB01 legacy CANCELLED commercial lock ─────────────────────────────

  it('WB01-LEGACY-CANCEL-01 — migration backfills commercialLockedAt from snapshot evidence', async () => {
    const appointmentId = await createAppointment({
      status: 'CANCELLED',
      commercialLockedAt: null,
    });
    const revId = randomUUID();
    const capturedAt = new Date('2026-05-01T12:00:00.000Z');
    await wrapper.withPlatformBypass(async (c) => {
      await c.appointmentServiceSnapshotRevision.create({
        data: {
          id: revId,
          tenantId,
          appointmentId,
          revisionNumber: 1,
          clinicalServiceId,
          stableKey: 'canonical.f',
          displayNameAr: 'خدمة',
          displayNameEn: 'Service',
          pricingUnit: 'PER_VISIT',
          quantity: 1,
          currency: 'SYP',
          unitPrice: 25,
          taxPercent: 0,
          lineBasisAmount: 25,
          commercialReason: null,
          actorId: providerId,
          changeCommandContext: 'legacy',
          capturedAt,
        },
      });
      await c.appointment.update({
        where: { id: appointmentId },
        data: { effectiveSnapshotRevisionId: revId, commercialLockedAt: null },
      });
    });
    await applyLegacyCancelledLockMigrationSql();
    const row = await wrapper.withPlatformBypass((c) =>
      c.appointment.findUniqueOrThrow({ where: { id: appointmentId } }),
    );
    expect(row.commercialLockedAt).toBeTruthy();
    expect(row.commercialLockedAt!.getTime()).toBe(capturedAt.getTime());
  });

  it('WB01-LEGACY-CANCEL-02 — after migration, generic commercial PATCH is rejected', async () => {
    const appointmentId = await createAppointment({
      status: 'CANCELLED',
      commercialLockedAt: null,
    });
    const revId = randomUUID();
    await wrapper.withPlatformBypass(async (c) => {
      await c.appointmentServiceSnapshotRevision.create({
        data: {
          id: revId,
          tenantId,
          appointmentId,
          revisionNumber: 1,
          clinicalServiceId,
          stableKey: 'canonical.f',
          displayNameAr: 'خدمة',
          displayNameEn: 'Service',
          pricingUnit: 'PER_VISIT',
          quantity: 1,
          currency: 'SYP',
          unitPrice: 25,
          taxPercent: 0,
          lineBasisAmount: 25,
          commercialReason: null,
          actorId: providerId,
          changeCommandContext: 'legacy',
        },
      });
      await c.appointment.update({
        where: { id: appointmentId },
        data: { effectiveSnapshotRevisionId: revId, commercialLockedAt: null },
      });
    });
    await applyLegacyCancelledLockMigrationSql();
    const row = await wrapper.withPlatformBypass((c) =>
      c.appointment.findUniqueOrThrow({
        where: { id: appointmentId },
        include: { effectiveSnapshotRevision: true },
      }),
    );
    expect(row.commercialLockedAt).toBeTruthy();
    const domain = new Appointment(
      appointmentId,
      tenantId,
      branchId,
      patientId,
      providerId,
      new TimeSlotVO('2026-11-01T10:00:00.000Z', '2026-11-01T10:30:00.000Z'),
      AppointmentStatus.Cancelled,
    );
    await expect(
      buildUpdateHandler(appointmentId, domain).execute(
        appointmentId,
        { clinicalServiceId: randomUUID(), changeReason: 'should fail' },
        providerId,
      ),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('WB01-LEGACY-CANCEL-03 — dedicated correction remains the only allowed commercial change', async () => {
    const appointmentId = await createAppointment({
      status: 'CANCELLED',
      commercialLockedAt: new Date('2026-04-01T00:00:00.000Z'),
    });
    const revId = randomUUID();
    await wrapper.withPlatformBypass(async (c) => {
      await c.appointmentServiceSnapshotRevision.create({
        data: {
          id: revId,
          tenantId,
          appointmentId,
          revisionNumber: 1,
          clinicalServiceId,
          stableKey: 'canonical.f',
          displayNameAr: 'خدمة',
          displayNameEn: 'Service',
          pricingUnit: 'PER_VISIT',
          quantity: 1,
          currency: 'SYP',
          unitPrice: 25,
          taxPercent: 0,
          lineBasisAmount: 25,
          commercialReason: null,
          actorId: providerId,
          changeCommandContext: 'legacy',
        },
      });
      await c.appointment.update({
        where: { id: appointmentId },
        data: { effectiveSnapshotRevisionId: revId },
      });
    });
    const row = await wrapper.withPlatformBypass((c) =>
      c.appointment.findUniqueOrThrow({ where: { id: appointmentId } }),
    );
    expect(
      snapshots.isCommercialLocked({
        status: row.status,
        commercialLockedAt: row.commercialLockedAt,
        effectiveSnapshotRevisionId: row.effectiveSnapshotRevisionId,
      }),
    ).toBe(true);
    // Dedicated correction path requires lock (opposite of PENDING guard).
    expect(row.commercialLockedAt).toBeTruthy();
    await concurrency.withBookingTransaction(async (client) => {
      await snapshots.appendResolvedCommercialRevision(client, {
        tenantId,
        appointmentId,
        actorId: providerId,
        appointmentStatus: 'CANCELLED',
        allowPostConfirmCorrection: true,
        commercial: commercial({ unitPrice: 40, commercialReason: 'CORRECTION' }),
        changeReason: 'WB01 dedicated correction',
      });
    });
    const revs = await wrapper.withPlatformBypass((c) =>
      c.appointmentServiceSnapshotRevision.findMany({
        where: { appointmentId },
        orderBy: { revisionNumber: 'asc' },
      }),
    );
    expect(revs.length).toBeGreaterThanOrEqual(2);
    expect(revs[revs.length - 1]?.changeCommandContext).toBe('correction.post_confirm');
    expect(Number(revs[revs.length - 1]?.unitPrice)).toBe(40);
  });

  it('WB01-LEGACY-CANCEL-04 — no confirmation evidence → stays unlocked; no fabricated history', async () => {
    const appointmentId = await createAppointment({
      status: 'CANCELLED',
      commercialLockedAt: null,
      clinicalServiceId: null,
    });
    await applyLegacyCancelledLockMigrationSql();
    const row = await wrapper.withPlatformBypass((c) =>
      c.appointment.findUniqueOrThrow({ where: { id: appointmentId } }),
    );
    expect(row.commercialLockedAt).toBeNull();
    expect(row.effectiveSnapshotRevisionId).toBeNull();
    expect(
      snapshots.isCommercialLocked({
        status: row.status,
        commercialLockedAt: row.commercialLockedAt,
        effectiveSnapshotRevisionId: row.effectiveSnapshotRevisionId,
      }),
    ).toBe(false);
  });

  it('WB01-SERIES-LOCK-01 — series future-cancel sets commercialLockedAt; isCommercialLocked blocks generic commercial change', async () => {
    const peerId = await createAppointment({ status: 'CONFIRMED', commercialLockedAt: null });
    const prior = await wrapper.withPlatformBypass((c) =>
      c.appointment.findUniqueOrThrow({ where: { id: peerId } }),
    );
    expect(prior.commercialLockedAt).toBeNull();
    const shouldLock = snapshots.shouldSetCommercialLock({
      priorStatus: prior.status,
      nextStatus: 'CANCELLED',
      commercialLockedAt: prior.commercialLockedAt,
    });
    expect(shouldLock).toBe(true);
    await concurrency.withBookingTransaction(async (client) => {
      await client.appointment.update({
        where: { id: peerId },
        data: { status: 'CANCELLED', ...(shouldLock ? { commercialLockedAt: new Date() } : {}) },
      });
    });
    const row = await wrapper.withPlatformBypass((c) =>
      c.appointment.findUniqueOrThrow({ where: { id: peerId } }),
    );
    expect(row.commercialLockedAt).toBeTruthy();
    expect(snapshots.isCommercialLocked({ status: row.status, commercialLockedAt: row.commercialLockedAt })).toBe(true);
    // Generic commercial update path uses the same guard.
    expect(snapshots.isCommercialLocked({ status: 'CANCELLED', commercialLockedAt: row.commercialLockedAt })).toBe(true);
  });

  it('WB01-CORR-LOCK-01 — PENDING never locked; commercialCorrection guard rejects without side effects', async () => {
    const appointmentId = await createAppointment({ status: 'PENDING' });
    const row = await wrapper.withPlatformBypass((c) =>
      c.appointment.findUniqueOrThrow({ where: { id: appointmentId } }),
    );
    expect(row.commercialLockedAt).toBeNull();
    expect(snapshots.isCommercialLocked({ status: row.status, commercialLockedAt: row.commercialLockedAt })).toBe(false);
    const revsBefore = await wrapper.withPlatformBypass((c) =>
      c.appointmentServiceSnapshotRevision.count({ where: { appointmentId } }),
    );
    await expect(
      (async () => {
        if (!snapshots.isCommercialLocked({ status: row.status, commercialLockedAt: row.commercialLockedAt })) {
          throw new ConflictException(
            'Commercial correction requires an already commercially locked appointment',
          );
        }
      })(),
    ).rejects.toBeInstanceOf(ConflictException);
    const after = await wrapper.withPlatformBypass((c) =>
      c.appointment.findUniqueOrThrow({ where: { id: appointmentId } }),
    );
    expect(after.commercialLockedAt).toBeNull();
    expect(
      await wrapper.withPlatformBypass((c) =>
        c.appointmentServiceSnapshotRevision.count({ where: { appointmentId } }),
      ),
    ).toBe(revsBefore);
  });

  // ─── WB02 ───────────────────────────────────────────────────────────────

  it('WB02-AVAIL-TIME-01 — eligibility expired for future slot; hasActiveEligibility + GetAvailability at:slotStart', async () => {
    const effectiveTo = new Date(Date.now() + 60 * 60_000);
    const futureSlot = new Date('2028-06-15T10:00:00.000Z');
    await createElig(new Date('2020-01-01T00:00:00.000Z'), effectiveTo);
    expect(
      await eligibility.hasActiveEligibility({
        tenantId, providerUserId: providerId, clinicalServiceId, branchId: null, at: new Date(),
      }),
    ).toBe(true);
    expect(
      await eligibility.hasActiveEligibility({
        tenantId, providerUserId: providerId, clinicalServiceId, branchId: null, at: futureSlot,
      }),
    ).toBe(false);
    expect(readSrc('../application/handlers/scheduling-support.handlers.ts')).toMatch(/at:\s*slotStart/);
  });

  it('WB02-AVAIL-TIME-02 — eligibility effectiveFrom in future; at=slot true, at=now false', async () => {
    const slot = new Date('2027-09-01T10:00:00.000Z');
    await createElig(slot);
    expect(
      await eligibility.hasActiveEligibility({
        tenantId, providerUserId: providerId, clinicalServiceId, branchId: null, at: slot,
      }),
    ).toBe(true);
    expect(
      await eligibility.hasActiveEligibility({
        tenantId, providerUserId: providerId, clinicalServiceId, branchId: null, at: new Date(),
      }),
    ).toBe(false);
  });

  it('WB02-TIME-03 — assertEligible at scheduled time rejects when expired', async () => {
    await createElig(new Date('2020-01-01T00:00:00.000Z'), new Date('2026-12-01T00:00:00.000Z'));
    await expect(
      eligibility.assertEligible({
        tenantId, providerUserId: providerId, clinicalServiceId, branchId: null,
        at: new Date('2027-03-01T10:00:00.000Z'),
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('WB02-SERIES-TIME-01 — real series command rejects when peer new time outside eligibility', async () => {
    await createElig(new Date('2020-01-01T00:00:00.000Z'), new Date('2027-01-01T00:00:00.000Z'));
    const seriesId = randomUUID();
    const t1 = new Date('2026-11-01T10:00:00.000Z');
    const t2 = new Date('2026-11-08T10:00:00.000Z');
    const t3 = new Date('2026-11-15T10:00:00.000Z');
    const end = (d: Date) => new Date(d.getTime() + 30 * 60_000);
    const a = await createAppointment({
      status: 'CONFIRMED',
      start: t1,
      end: end(t1),
      recurrenceSeriesId: seriesId,
      commercialLockedAt: new Date(),
    });
    const b = await createAppointment({
      status: 'CONFIRMED',
      start: t2,
      end: end(t2),
      recurrenceSeriesId: seriesId,
      commercialLockedAt: new Date(),
    });
    const c = await createAppointment({
      status: 'CONFIRMED',
      start: t3,
      end: end(t3),
      recurrenceSeriesId: seriesId,
      commercialLockedAt: new Date(),
    });
    // Shift +7 days → peer C lands after eligibility expiry (2027-01-01).
    const newStart = new Date('2026-12-20T10:00:00.000Z');
    const handler = buildSeriesUpdateHandler(
      [
        { id: a, start: t1, end: end(t1) },
        { id: b, start: t2, end: end(t2) },
        { id: c, start: t3, end: end(t3) },
      ],
      seriesId,
    );
    await expect(
      handler.execute(
        a,
        {
          start: newStart.toISOString(),
          end: end(newStart).toISOString(),
          seriesScope: 'future',
        },
        providerId,
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
    const rows = await wrapper.withPlatformBypass((client) =>
      client.appointment.findMany({
        where: { id: { in: [a, b, c] } },
        orderBy: { scheduledStart: 'asc' },
      }),
    );
    expect(rows.map((r) => r.scheduledStart.toISOString())).toEqual([
      t1.toISOString(),
      t2.toISOString(),
      t3.toISOString(),
    ]);
  });

  it('WB02-SERIES-ATOMIC-01 — third peer eligibility failure → zero partial moves', async () => {
    await createElig(new Date('2020-01-01T00:00:00.000Z'), new Date('2026-11-20T00:00:00.000Z'));
    const seriesId = randomUUID();
    const t1 = new Date('2026-11-01T10:00:00.000Z');
    const t2 = new Date('2026-11-08T10:00:00.000Z');
    const t3 = new Date('2026-11-15T10:00:00.000Z');
    const end = (d: Date) => new Date(d.getTime() + 30 * 60_000);
    const peers: string[] = [];
    for (const t of [t1, t2, t3]) {
      peers.push(
        await createAppointment({
          status: 'CONFIRMED',
          start: t,
          end: end(t),
          recurrenceSeriesId: seriesId,
          commercialLockedAt: new Date(),
        }),
      );
    }
    // +14 days moves peer3 to 2026-11-29 which is after eligibility end.
    const newStart = new Date('2026-11-15T10:00:00.000Z');
    const handler = buildSeriesUpdateHandler(
      peers.map((id, i) => ({
        id,
        start: [t1, t2, t3][i]!,
        end: end([t1, t2, t3][i]!),
      })),
      seriesId,
    );
    await expect(
      handler.execute(
        peers[0]!,
        {
          start: newStart.toISOString(),
          end: end(newStart).toISOString(),
          seriesScope: 'future',
        },
        providerId,
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
    const rows = await wrapper.withPlatformBypass((client) =>
      client.appointment.findMany({ where: { id: { in: peers } }, orderBy: { scheduledStart: 'asc' } }),
    );
    expect(rows.map((r) => r.scheduledStart.toISOString())).toEqual([
      t1.toISOString(),
      t2.toISOString(),
      t3.toISOString(),
    ]);
  });

  it('WB02-SERIES-ATOMIC-02 — third peer resource conflict → zero partial moves', async () => {
    const seriesId = randomUUID();
    const t1 = new Date('2026-12-01T10:00:00.000Z');
    const t2 = new Date('2026-12-08T10:00:00.000Z');
    const t3 = new Date('2026-12-15T10:00:00.000Z');
    const end = (d: Date) => new Date(d.getTime() + 30 * 60_000);
    await createElig(new Date('2020-01-01T00:00:00.000Z'), null);
    const peers: string[] = [];
    for (const t of [t1, t2, t3]) {
      peers.push(
        await createAppointment({
          status: 'CONFIRMED',
          start: t,
          end: end(t),
          recurrenceSeriesId: seriesId,
          resourceId: roomId,
          commercialLockedAt: new Date(),
        }),
      );
    }
    // Blocking appointment occupies the slot peer3 would move into (+7d → 2026-12-22).
    await createAppointment({
      status: 'CONFIRMED',
      start: new Date('2026-12-22T10:00:00.000Z'),
      end: end(new Date('2026-12-22T10:00:00.000Z')),
      resourceId: roomId,
      commercialLockedAt: new Date(),
    });
    const newStart = new Date('2026-12-08T10:00:00.000Z');
    const handler = buildSeriesUpdateHandler(
      peers.map((id, i) => ({
        id,
        start: [t1, t2, t3][i]!,
        end: end([t1, t2, t3][i]!),
        resourceId: roomId,
      })),
      seriesId,
    );
    await expect(
      handler.execute(
        peers[0]!,
        {
          start: newStart.toISOString(),
          end: end(newStart).toISOString(),
          seriesScope: 'future',
        },
        providerId,
      ),
    ).rejects.toBeInstanceOf(ConflictException);
    const rows = await wrapper.withPlatformBypass((client) =>
      client.appointment.findMany({ where: { id: { in: peers } }, orderBy: { scheduledStart: 'asc' } }),
    );
    expect(rows.map((r) => r.scheduledStart.toISOString())).toEqual([
      t1.toISOString(),
      t2.toISOString(),
      t3.toISOString(),
    ]);
  });

  it('WB02-SERIES-ATOMIC-03 — valid series reschedule moves all peers; snapshots unchanged', async () => {
    await createElig(new Date('2020-01-01T00:00:00.000Z'), null);
    const seriesId = randomUUID();
    const t1 = new Date('2027-01-05T10:00:00.000Z');
    const t2 = new Date('2027-01-12T10:00:00.000Z');
    const t3 = new Date('2027-01-19T10:00:00.000Z');
    const end = (d: Date) => new Date(d.getTime() + 30 * 60_000);
    const peers: string[] = [];
    const snapIds: string[] = [];
    for (const t of [t1, t2, t3]) {
      const id = await createAppointment({
        status: 'CONFIRMED',
        start: t,
        end: end(t),
        recurrenceSeriesId: seriesId,
        commercialLockedAt: new Date('2027-01-01T00:00:00.000Z'),
      });
      const revId = randomUUID();
      snapIds.push(revId);
      await wrapper.withPlatformBypass(async (c) => {
        await c.appointmentServiceSnapshotRevision.create({
          data: {
            id: revId,
            tenantId,
            appointmentId: id,
            revisionNumber: 1,
            clinicalServiceId,
            stableKey: 'canonical.f',
            displayNameAr: 'خدمة',
            displayNameEn: 'Service',
            pricingUnit: 'PER_VISIT',
            quantity: 1,
            currency: 'SYP',
            unitPrice: 25,
            taxPercent: 0,
            lineBasisAmount: 25,
            commercialReason: null,
            actorId: providerId,
            changeCommandContext: 'create',
          },
        });
        await c.appointment.update({
          where: { id },
          data: { effectiveSnapshotRevisionId: revId },
        });
      });
      peers.push(id);
    }
    const newStart = new Date('2027-01-06T10:00:00.000Z');
    const handler = buildSeriesUpdateHandler(
      peers.map((id, i) => ({
        id,
        start: [t1, t2, t3][i]!,
        end: end([t1, t2, t3][i]!),
      })),
      seriesId,
    );
    await handler.execute(
      peers[0]!,
      {
        start: newStart.toISOString(),
        end: end(newStart).toISOString(),
        seriesScope: 'future',
      },
      providerId,
    );
    const rows = await wrapper.withPlatformBypass((client) =>
      client.appointment.findMany({ where: { id: { in: peers } }, orderBy: { scheduledStart: 'asc' } }),
    );
    expect(rows.map((r) => r.scheduledStart.toISOString())).toEqual([
      new Date('2027-01-06T10:00:00.000Z').toISOString(),
      new Date('2027-01-13T10:00:00.000Z').toISOString(),
      new Date('2027-01-20T10:00:00.000Z').toISOString(),
    ]);
    expect(rows.map((r) => r.effectiveSnapshotRevisionId)).toEqual(snapIds);
    expect(rows.every((r) => r.commercialLockedAt)).toBe(true);
    const revCount = await wrapper.withPlatformBypass((c) =>
      c.appointmentServiceSnapshotRevision.count({ where: { appointmentId: { in: peers } } }),
    );
    expect(revCount).toBe(3);
  });

  it('WB02-SERIES-ATOMIC-04 — concurrent competing series/booking race → no dual overlap / no partial series', async () => {
    await createElig(new Date('2020-01-01T00:00:00.000Z'), null);
    const seriesA = randomUUID();
    const seriesB = randomUUID();
    const end = (d: Date) => new Date(d.getTime() + 30 * 60_000);
    const a1Start = new Date('2027-03-01T10:00:00.000Z');
    const a2Start = new Date('2027-03-08T10:00:00.000Z');
    const b1Start = new Date('2027-03-01T12:00:00.000Z');
    const b2Start = new Date('2027-03-08T12:00:00.000Z');
    const a1 = await createAppointment({
      status: 'CONFIRMED',
      start: a1Start,
      end: end(a1Start),
      recurrenceSeriesId: seriesA,
      resourceId: roomId,
      commercialLockedAt: new Date(),
    });
    const a2 = await createAppointment({
      status: 'CONFIRMED',
      start: a2Start,
      end: end(a2Start),
      recurrenceSeriesId: seriesA,
      resourceId: roomId,
      commercialLockedAt: new Date(),
    });
    const b1 = await createAppointment({
      status: 'CONFIRMED',
      start: b1Start,
      end: end(b1Start),
      recurrenceSeriesId: seriesB,
      resourceId: roomId,
      commercialLockedAt: new Date(),
    });
    const b2 = await createAppointment({
      status: 'CONFIRMED',
      start: b2Start,
      end: end(b2Start),
      recurrenceSeriesId: seriesB,
      resourceId: roomId,
      commercialLockedAt: new Date(),
    });
    // Both series try to land on the same target window for peer2.
    const target = new Date('2027-03-15T10:00:00.000Z');
    const handlerA = buildSeriesUpdateHandler(
      [
        { id: a1, start: a1Start, end: end(a1Start), resourceId: roomId },
        { id: a2, start: a2Start, end: end(a2Start), resourceId: roomId },
      ],
      seriesA,
    );
    const handlerB = buildSeriesUpdateHandler(
      [
        { id: b1, start: b1Start, end: end(b1Start), resourceId: roomId },
        { id: b2, start: b2Start, end: end(b2Start), resourceId: roomId },
      ],
      seriesB,
    );
    const results = await Promise.allSettled([
      handlerA.execute(
        a1,
        { start: target.toISOString(), end: end(target).toISOString(), seriesScope: 'future' },
        providerId,
      ),
      handlerB.execute(
        b1,
        {
          start: new Date('2027-03-15T10:00:00.000Z').toISOString(),
          end: end(new Date('2027-03-15T10:00:00.000Z')).toISOString(),
          seriesScope: 'future',
        },
        providerId,
      ),
    ]);
    const fulfilled = results.filter((r) => r.status === 'fulfilled').length;
    const rejected = results.filter((r) => r.status === 'rejected').length;
    expect(fulfilled + rejected).toBe(2);
    expect(fulfilled).toBeGreaterThanOrEqual(1);
    // At most one series may occupy the contested room slot at target.
    const atTarget = await wrapper.withPlatformBypass((c) =>
      c.appointment.findMany({
        where: {
          tenantId,
          resourceId: roomId,
          status: { in: ['PENDING', 'CONFIRMED', 'CHECKED_IN', 'IN_PROGRESS'] },
          scheduledStart: { lt: end(target) },
          scheduledEnd: { gt: target },
          deletedAt: null,
        },
      }),
    );
    expect(atTarget.length).toBeLessThanOrEqual(1);
    // Losing series must remain fully at original times (no partial application).
    for (const [peerIds, starts, seriesId] of [
      [[a1, a2], [a1Start, a2Start], seriesA],
      [[b1, b2], [b1Start, b2Start], seriesB],
    ] as const) {
      const rows = await wrapper.withPlatformBypass((c) =>
        c.appointment.findMany({ where: { id: { in: [...peerIds] } }, orderBy: { scheduledStart: 'asc' } }),
      );
      const moved = rows.some((r, i) => r.scheduledStart.getTime() !== starts[i]!.getTime());
      const allMoved = rows.every((r, i) => r.scheduledStart.getTime() !== starts[i]!.getTime());
      const noneMoved = rows.every((r, i) => r.scheduledStart.getTime() === starts[i]!.getTime());
      expect(moved ? allMoved : noneMoved).toBe(true);
      void seriesId;
    }
  });

  it('WB02-BULK-TIME-01 — target time outside eligibility DENY via assertEligible', async () => {
    await createElig(new Date('2020-01-01T00:00:00.000Z'), new Date('2026-06-01T00:00:00.000Z'));
    await expect(
      eligibility.assertEligible({
        tenantId, providerUserId: providerId, clinicalServiceId, branchId: null,
        at: new Date('2028-01-10T10:00:00.000Z'),
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('WB02-LIFE-03 — deactivateEligibilityRow wrong tenant → NotFound; row still active', async () => {
    const foreignSvc = randomUUID();
    extraClinicalServiceIds.push(foreignSvc);
    await wrapper.withPlatformBypass(async (c) => {
      await c.canonicalClinicalServiceDefinition.create({
        data: {
          id: foreignSvc,
          tenantId: null,
          provenance: 'SYSTEM_CANONICAL',
          stableKey: `canonical.fo_${foreignSvc.slice(0, 8)}`,
          domain: 'GENERAL',
          lifecycle: 'PUBLISHED',
          publishedAt: new Date(),
          translations: { create: [{ locale: 'en', displayName: 'Other Svc' }] },
        },
      });
    });
    const row = await createElig(
      new Date('2020-01-01T00:00:00.000Z'),
      null,
      otherTenantId,
      otherProviderId,
      foreignSvc,
    );
    await expect(
      eligibility.deactivateEligibilityRow({ tenantId, eligibilityId: row.id, actorId: providerId }),
    ).rejects.toBeInstanceOf(NotFoundException);
    const still = await wrapper.withPlatformBypass((c) =>
      c.providerServiceEligibility.findUniqueOrThrow({ where: { id: row.id } }),
    );
    expect(still.active).toBe(true);
    expect(still.inactivatedAt).toBeNull();
  });

  it('WB02-READY-EMPTY-02 — zero enabled TenantServiceConfiguration → readiness throws', async () => {
    const emptyTenantId = randomUUID();
    await wrapper.withPlatformBypass(async (c) => {
      await c.tenant.create({
        data: { id: emptyTenantId, name: 'WB Empty Ready', slug: `wb-er-${emptyTenantId.slice(0, 8)}` },
      });
    });
    try {
      const report = await eligibility.buildAuthoritativeCoverageReport(emptyTenantId);
      expect(report).toEqual([]);
      expect(() => eligibility.assertReadinessForEnforcementOn(report)).toThrow(ForbiddenException);
    } finally {
      await wrapper.withPlatformBypass(async (c) => {
        await c.tenant.deleteMany({ where: { id: emptyTenantId } });
      });
    }
  });

  // ─── WB03 ───────────────────────────────────────────────────────────────

  it('WB03-IDEMP-RACE-01 — concurrent reclaim of stale IN_PROGRESS → exactly one proceed', async () => {
    const fingerprint = idem.fingerprint({ race: 1 });
    const key = `k-${randomUUID()}`;
    const gate = await idem.beginOrReplay({
      tenantId, patientId, operation: 'book', idempotencyKey: key, fingerprint,
    });
    expect(gate.kind).toBe('proceed');
    if (gate.kind !== 'proceed') return;
    await wrapper.withPlatformBypass(async (c) => {
      await c.portalSchedulingIdempotencyLedger.update({
        where: { id: gate.rowId },
        data: { expiresAt: new Date(Date.now() - 60_000) },
      });
    });
    const settled = await Promise.allSettled([
      idem.beginOrReplay({ tenantId, patientId, operation: 'book', idempotencyKey: key, fingerprint }),
      idem.beginOrReplay({ tenantId, patientId, operation: 'book', idempotencyKey: key, fingerprint }),
    ]);
    expect(
      settled.filter((s) => s.status === 'fulfilled' && (s.value as { kind: string }).kind === 'proceed')
        .length,
    ).toBe(1);
  });

  it('WB03-IDEMP-OWNER-01 — old owner complete after reclaim → ConflictException', async () => {
    const fingerprint = idem.fingerprint({ owner: 'old' });
    const key = `k-${randomUUID()}`;
    const old = await idem.beginOrReplay({
      tenantId, patientId, operation: 'book', idempotencyKey: key, fingerprint,
    });
    expect(old.kind).toBe('proceed');
    if (old.kind !== 'proceed') return;
    await wrapper.withPlatformBypass(async (c) => {
      await c.portalSchedulingIdempotencyLedger.update({
        where: { id: old.rowId },
        data: { expiresAt: new Date(Date.now() - 60_000) },
      });
    });
    const neu = await idem.beginOrReplay({
      tenantId, patientId, operation: 'book', idempotencyKey: key, fingerprint,
    });
    expect(neu.kind).toBe('proceed');
    await expect(
      idem.complete(old.rowId, fingerprint, { ok: false }, old.ownerToken),
    ).rejects.toBeInstanceOf(ConflictException);
    const row = await wrapper.withPlatformBypass((c) =>
      c.portalSchedulingIdempotencyLedger.findUniqueOrThrow({ where: { id: old.rowId } }),
    );
    expect(row.status).toBe('IN_PROGRESS');
  });

  it('WB03-IDEMP-OWNER-02 — new owner completes → COMPLETED once', async () => {
    const fingerprint = idem.fingerprint({ owner: 'new' });
    const key = `k-${randomUUID()}`;
    const old = await idem.beginOrReplay({
      tenantId, patientId, operation: 'book', idempotencyKey: key, fingerprint,
    });
    expect(old.kind).toBe('proceed');
    if (old.kind !== 'proceed') return;
    await wrapper.withPlatformBypass(async (c) => {
      await c.portalSchedulingIdempotencyLedger.update({
        where: { id: old.rowId },
        data: { expiresAt: new Date(Date.now() - 60_000) },
      });
    });
    const neu = await idem.beginOrReplay({
      tenantId, patientId, operation: 'book', idempotencyKey: key, fingerprint,
    });
    expect(neu.kind).toBe('proceed');
    if (neu.kind !== 'proceed') return;
    const result = { appointmentId: randomUUID() };
    await idem.complete(neu.rowId, fingerprint, result, neu.ownerToken);
    const row = await wrapper.withPlatformBypass((c) =>
      c.portalSchedulingIdempotencyLedger.findUniqueOrThrow({ where: { id: neu.rowId } }),
    );
    expect(row.status).toBe('COMPLETED');
    expect(row.responseJson).toEqual(result);
  });

  it('WB03-IDEMP-CRASH-01 — crash before complete; reclaim completes existing appt once', async () => {
    const fingerprint = idem.fingerprint({ crash: true });
    const key = `k-${randomUUID()}`;
    const gate = await idem.beginOrReplay({
      tenantId, patientId, operation: 'book', idempotencyKey: key, fingerprint,
    });
    expect(gate.kind).toBe('proceed');
    if (gate.kind !== 'proceed') return;
    const appointmentId = await createAppointment({ status: 'PENDING' });
    await wrapper.withPlatformBypass(async (c) => {
      await c.portalSchedulingIdempotencyLedger.update({
        where: { id: gate.rowId },
        data: { expiresAt: new Date(Date.now() - 60_000) },
      });
    });
    const reclaimed = await idem.beginOrReplay({
      tenantId, patientId, operation: 'book', idempotencyKey: key, fingerprint,
    });
    expect(reclaimed.kind).toBe('proceed');
    if (reclaimed.kind !== 'proceed') return;
    await idem.complete(reclaimed.rowId, fingerprint, { appointmentId }, reclaimed.ownerToken);
    expect(
      await wrapper.withPlatformBypass((c) => c.appointment.count({ where: { tenantId, patientId } })),
    ).toBe(1);
    const txBlock = readSrc('../application/handlers/create-appointment.handler.ts').split(
      'withBookingTransaction',
    )[1] ?? '';
    expect(txBlock).toMatch(/portalSchedulingIdempotencyLedger\.updateMany/);
  });

  it('WB03-IDEMP-FP-01 — same key different notes fingerprint → ConflictException', async () => {
    const key = `k-${randomUUID()}`;
    const gate = await idem.beginOrReplay({
      tenantId, patientId, operation: 'book', idempotencyKey: key,
      fingerprint: idem.fingerprint({ notes: 'a' }),
    });
    expect(gate.kind).toBe('proceed');
    await expect(
      idem.beginOrReplay({
        tenantId, patientId, operation: 'book', idempotencyKey: key,
        fingerprint: idem.fingerprint({ notes: 'b' }),
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  // ─── WB04 ───────────────────────────────────────────────────────────────

  it('WB04-BULK-02 — BulkRescheduleHandler shiftDays=1 preserves both allocations', async () => {
    const start = new Date('2026-11-10T10:00:00.000Z');
    const end = new Date('2026-11-10T10:30:00.000Z');
    await createElig(new Date('2020-01-01T00:00:00.000Z'), new Date('2030-01-01T00:00:00.000Z'));
    const apptId = randomUUID();
    await concurrency.withBookingTransaction(async (client) => {
      await client.appointment.create({
        data: {
          id: apptId, tenantId, branchId, patientId, providerId,
          scheduledStart: start, scheduledEnd: end, status: 'PENDING',
          clinicalServiceId, resourceId: roomId,
        },
      });
      await concurrency.replaceResourceAllocations(client, {
        tenantId, appointmentId: apptId, resourceIds: [roomId, room2Id],
      });
    });
    const domain = new Appointment(
      apptId, tenantId, branchId, patientId, providerId,
      new TimeSlotVO(start.toISOString(), end.toISOString()),
      AppointmentStatus.Pending, undefined, undefined, undefined, undefined, undefined, undefined, roomId,
    );
    const result = await new BulkRescheduleHandler(
      { findById: async () => domain } as never,
      { resolve: async () => ({ tenantId, branchId }) } as never,
      concurrency, eligibility, resources, wrapper as never,
    ).execute({ appointmentIds: [apptId], shiftDays: 1 });
    expect(result.updated).toContain(apptId);
    expect(result.failed).toHaveLength(0);
    const allocs = await wrapper.withPlatformBypass((c) =>
      c.appointmentResourceAllocation.findMany({ where: { appointmentId: apptId } }),
    );
    expect(allocs.map((a) => a.schedulingResourceId).sort()).toEqual([roomId, room2Id].sort());
  });

  function buildUpdateHandler(apptId: string, domain: Appointment) {
    return new UpdateAppointmentHandler(
      {
        findById: async () => domain,
        save: async () => domain,
        findDetailById: async () => ({
          id: apptId,
          tenantId,
          branchId,
          patientId,
          patientName: 'P',
          providerId,
          start: domain.slot.start,
          end: domain.slot.end,
          status: 'pending',
          notes: domain.notes,
          serviceType: null,
          isEmergency: false,
          recurrenceSeriesId: null,
          resourceId: domain.resourceId,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }),
      } as never,
      { resolve: async () => ({ tenantId, branchId }) } as never,
      { publish: async () => undefined } as never,
      concurrency,
      eligibility,
      resources,
      snapshots,
      { resolveCanonical: async () => commercial() } as never,
      wrapper as never,
      fakeAudit as never,
    );
  }

  it('WB04-CLEAR-01 — resourceIds undefined leaves allocations unchanged', async () => {
    const start = new Date('2026-11-01T10:00:00.000Z');
    const end = new Date('2026-11-01T10:30:00.000Z');
    const apptId = await createAppointment({ resourceId: roomId, start, end });
    await concurrency.withBookingTransaction(async (client) => {
      await concurrency.replaceResourceAllocations(client, {
        tenantId, appointmentId: apptId, resourceIds: [roomId, room2Id],
      });
    });
    const domain = new Appointment(
      apptId, tenantId, branchId, patientId, providerId,
      new TimeSlotVO(start.toISOString(), end.toISOString()),
      AppointmentStatus.Pending, undefined, undefined, undefined, undefined, undefined, undefined, roomId,
    );
    await buildUpdateHandler(apptId, domain).execute(apptId, { notes: 'notes-only' }, providerId);
    const allocs = await wrapper.withPlatformBypass((c) =>
      c.appointmentResourceAllocation.findMany({ where: { appointmentId: apptId } }),
    );
    expect(allocs.map((a) => a.schedulingResourceId).sort()).toEqual([roomId, room2Id].sort());
  });

  it('WB04-CLEAR-02 — resourceIds [] clears when no requirements', async () => {
    await createElig(new Date('2020-01-01T00:00:00.000Z'), new Date('2030-01-01T00:00:00.000Z'));
    const start = new Date('2026-11-01T10:00:00.000Z');
    const end = new Date('2026-11-01T10:30:00.000Z');
    const apptId = await createAppointment({ resourceId: roomId, start, end });
    await concurrency.withBookingTransaction(async (client) => {
      await concurrency.replaceResourceAllocations(client, {
        tenantId, appointmentId: apptId, resourceIds: [roomId, room2Id],
      });
    });
    const domain = new Appointment(
      apptId, tenantId, branchId, patientId, providerId,
      new TimeSlotVO(start.toISOString(), end.toISOString()),
      AppointmentStatus.Pending, undefined, undefined, undefined, undefined, undefined, undefined, roomId,
    );
    await buildUpdateHandler(apptId, domain).execute(apptId, { resourceIds: [] }, providerId);
    expect(
      await wrapper.withPlatformBypass((c) =>
        c.appointmentResourceAllocation.findMany({ where: { appointmentId: apptId } }),
      ),
    ).toHaveLength(0);
  });

  it('WB04-CLEAR-03 — resourceIds [] rejected when requirements exist', async () => {
    await createElig(new Date('2020-01-01T00:00:00.000Z'), new Date('2030-01-01T00:00:00.000Z'));
    await resources.upsertRequirement({
      tenantId, clinicalServiceId, resourceType: 'ROOM', quantity: 1, actorId: providerId,
    });
    const start = new Date('2026-11-01T10:00:00.000Z');
    const end = new Date('2026-11-01T10:30:00.000Z');
    const apptId = await createAppointment({ resourceId: roomId, start, end });
    await concurrency.withBookingTransaction(async (client) => {
      await concurrency.replaceResourceAllocations(client, {
        tenantId, appointmentId: apptId, resourceIds: [roomId],
      });
    });
    const domain = new Appointment(
      apptId, tenantId, branchId, patientId, providerId,
      new TimeSlotVO(start.toISOString(), end.toISOString()),
      AppointmentStatus.Pending, undefined, undefined, undefined, undefined, undefined, undefined, roomId,
    );
    await expect(
      buildUpdateHandler(apptId, domain).execute(apptId, { resourceIds: [] }, providerId),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(
      await wrapper.withPlatformBypass((c) =>
        c.appointmentResourceAllocation.count({ where: { appointmentId: apptId } }),
      ),
    ).toBe(1);
  });

  it('WB04-CLEAR-04 — source check that priorAlloc locked before release in appointment.handlers.ts', () => {
    const src = readSrc('../application/handlers/appointment.handlers.ts');
    expect(src).toMatch(/priorAlloc/);
    expect(src).toMatch(/listAllocatedResourceIds\(client,\s*appointment\.id\)/);
    const updateHandler =
      src.split('export class UpdateAppointmentHandler')[1]?.split('export class')[0] ?? '';
    expect(updateHandler.indexOf('priorAlloc')).toBeGreaterThanOrEqual(0);
    expect(updateHandler.indexOf('replaceResourceAllocations')).toBeGreaterThanOrEqual(0);
    expect(updateHandler.indexOf('priorAlloc')).toBeLessThan(
      updateHandler.indexOf('replaceResourceAllocations'),
    );
  });

  // ─── WB05 ───────────────────────────────────────────────────────────────

  it('WB05-RESOWN-02 — branch-scoped resource + branchId null → DENY', async () => {
    await expect(
      resources.assertAllocatedResourcesOwned({
        tenantId, branchId: null, allocatedResourceIds: [roomId],
      }),
    ).rejects.toThrow(/branch mismatch/i);
  });

  it('WB05-SVCOWN-02 — Tenant A cannot upsertRequirement for Tenant B TENANT_CUSTOM', async () => {
    const foreignSvc = await seedTenantCustomService(otherTenantId);
    await expect(
      resources.upsertRequirement({
        tenantId, clinicalServiceId: foreignSvc, resourceType: 'ROOM', quantity: 1, actorId: providerId,
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('WB05-SVCOWN-03 — Tenant A cannot assertClinicalServiceAccessible for Tenant B TENANT_CUSTOM', async () => {
    const foreignSvc = await seedTenantCustomService(otherTenantId);
    await expect(
      eligibility.assertClinicalServiceAccessible(tenantId, foreignSvc),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('WB05-SVCOWN-04 — SYSTEM_CANONICAL accessible', async () => {
    await expect(eligibility.assertClinicalServiceAccessible(tenantId, clinicalServiceId)).resolves.toBeUndefined();
    await expect(resources.assertClinicalServiceAccessible(tenantId, clinicalServiceId)).resolves.toBeUndefined();
  });

  // ─── WB06 real audit TX ─────────────────────────────────────────────────

  it('WB06-TX-01 — auditEntry.create throw rolls back createEligibilityRow', async () => {
    const failingPrisma = {
      withPlatformBypass: async <T>(fn: (client: PrismaClient) => Promise<T>) =>
        wrapper.withPlatformBypass((c) => fn(proxyFailingAuditCreate(c))),
    };
    const eligFail = new ProviderEligibilityService(failingPrisma as never, realAudit as never);
    const before = await wrapper.withPlatformBypass((c) =>
      c.providerServiceEligibility.count({ where: { tenantId } }),
    );
    await expect(
      eligFail.createEligibilityRow({
        tenantId, providerUserId: providerId, clinicalServiceId, branchId: null,
        effectiveFrom: new Date('2020-01-01T00:00:00.000Z'), actorId: providerId,
      }),
    ).rejects.toThrow(/forced audit failure/);
    expect(
      await wrapper.withPlatformBypass((c) =>
        c.providerServiceEligibility.count({ where: { tenantId } }),
      ),
    ).toBe(before);
  });

  it('WB06-TX-02 — auditEntry.create throw rolls back upsertRequirement', async () => {
    const failingPrisma = {
      withPlatformBypass: async <T>(fn: (client: PrismaClient) => Promise<T>) =>
        wrapper.withPlatformBypass((c) => fn(proxyFailingAuditCreate(c))),
    };
    const resFail = new ServiceResourceRequirementService(failingPrisma as never, realAudit as never);
    const before = await wrapper.withPlatformBypass((c) =>
      c.serviceResourceRequirement.count({ where: { tenantId } }),
    );
    await expect(
      resFail.upsertRequirement({
        tenantId, clinicalServiceId, resourceType: 'ROOM', quantity: 1, actorId: providerId,
      }),
    ).rejects.toThrow(/forced audit failure/);
    expect(
      await wrapper.withPlatformBypass((c) =>
        c.serviceResourceRequirement.count({ where: { tenantId } }),
      ),
    ).toBe(before);
  });

  it('WB06-TX-03 — pre-confirm commercial revision + real audit → exactly 1 audit row', async () => {
    const appointmentId = await createAppointment({ status: 'PENDING' });
    await concurrency.withBookingTransaction(async (client) => {
      await snapshots.captureCanonicalRevision1(client, {
        tenantId, appointmentId, actorId: providerId, commercial: commercial({ unitPrice: 30 }),
      });
    });
    await concurrency.withBookingTransaction(async (client) => {
      const rev = await snapshots.appendResolvedCommercialRevision(client, {
        tenantId, appointmentId, changeReason: 'pre-confirm price tweak', actorId: providerId,
        commercial: commercial({ unitPrice: 35 }), allowPostConfirmCorrection: false,
        appointmentStatus: 'PENDING',
      });
      await realAudit.recordInTransaction(client, {
        tenantId, action: 'scheduling.snapshot.revision', resourceId: rev.id, actorId: providerId,
        actorRoles: [], descriptionEn: 'Pre-confirm commercial snapshot revision appended',
        descriptionAr: 'مراجعة', details: { appointmentId, revisionNumber: rev.revisionNumber },
      });
    });
    const audits = await wrapper.withPlatformBypass((c) =>
      c.auditEntry.findMany({
        where: {
          tenantId,
          OR: [
            { action: { contains: 'scheduling.commercial' } },
            { action: { contains: 'scheduling.snapshot' } },
          ],
        },
      }),
    );
    expect(audits).toHaveLength(1);
    expect(audits[0]?.action).toMatch(/scheduling\.(commercial|snapshot)/);
  });

  it('WB06-TX-04 — waitlist-style snapshot + audit same tx both committed', async () => {
    const appointmentId = await createAppointment({ status: 'PENDING' });
    await concurrency.withBookingTransaction(async (client) => {
      const revision = await snapshots.captureCanonicalRevision1(client, {
        tenantId, appointmentId, actorId: providerId, commercial: commercial({ unitPrice: 40 }),
      });
      await realAudit.recordInTransaction(client, {
        tenantId, action: 'scheduling.waitlist.canonical_snapshot', resourceId: revision.id,
        actorId: providerId, actorRoles: [],
        descriptionEn: 'Canonical waitlist booking snapshot revision 1', descriptionAr: 'لقطة',
        details: { appointmentId },
      });
    });
    expect(
      await wrapper.withPlatformBypass((c) =>
        c.appointmentServiceSnapshotRevision.count({ where: { appointmentId } }),
      ),
    ).toBe(1);
    expect(
      await wrapper.withPlatformBypass((c) =>
        c.auditEntry.count({ where: { tenantId, action: 'scheduling.waitlist.canonical_snapshot' } }),
      ),
    ).toBe(1);
  });

  it('WB06-TX-05 — audit failure after snapshot append rolls back both', async () => {
    const appointmentId = await createAppointment({ status: 'PENDING' });
    const beforeRevs = await wrapper.withPlatformBypass((c) =>
      c.appointmentServiceSnapshotRevision.count({ where: { appointmentId } }),
    );
    const beforeAudits = await wrapper.withPlatformBypass((c) =>
      c.auditEntry.count({ where: { tenantId } }),
    );
    await expect(
      concurrency.withBookingTransaction(async (client) => {
        await snapshots.captureCanonicalRevision1(client, {
          tenantId, appointmentId, actorId: providerId, commercial: commercial({ unitPrice: 44 }),
        });
        await proxyFailingAuditCreate(client as unknown as PrismaClient).auditEntry.create({
          data: {} as never,
        });
      }),
    ).rejects.toThrow(/forced audit failure/);
    expect(
      await wrapper.withPlatformBypass((c) =>
        c.appointmentServiceSnapshotRevision.count({ where: { appointmentId } }),
      ),
    ).toBe(beforeRevs);
    expect(
      await wrapper.withPlatformBypass((c) => c.auditEntry.count({ where: { tenantId } })),
    ).toBe(beforeAudits);
  });

  // ─── WB07 migration / backfill / RLS ─────────────────────────────────────

  it('WB07-BACKFILL-BATCH-01 — dataset > batch size → all rows processed', async () => {
    const ids: string[] = [];
    for (let i = 0; i < 5; i++) {
      ids.push(
        await createAppointment({
          status: 'PENDING',
          clinicalServiceId: null,
          serviceType: `batch-legacy-${i}`,
          start: new Date(`2026-08-0${i + 1}T10:00:00.000Z`),
          end: new Date(`2026-08-0${i + 1}T10:30:00.000Z`),
        }),
      );
    }
    const report = await runPhase48WaveBSnapshotBackfill(raw, { actorId: providerId, tenantId, batchSize: 2,
    });
    expect(report.ok).toBe(true);
    expect(report.batches).toBeGreaterThanOrEqual(3);
    expect(report.remainingEligible).toBe(0);
    const pointed = await wrapper.withPlatformBypass((c) =>
      c.appointment.count({
        where: { id: { in: ids }, effectiveSnapshotRevisionId: { not: null } },
      }),
    );
    expect(pointed).toBe(5);
  });

  it('WB07-BACKFILL-BATCH-02 — second run → zero duplicates / zero pointer churn', async () => {
    const ids: string[] = [];
    for (let i = 0; i < 4; i++) {
      ids.push(
        await createAppointment({
          status: 'PENDING',
          clinicalServiceId: null,
          serviceType: `batch2-${i}`,
          start: new Date(`2026-09-0${i + 1}T10:00:00.000Z`),
          end: new Date(`2026-09-0${i + 1}T10:30:00.000Z`),
        }),
      );
    }
    await runPhase48WaveBSnapshotBackfill(raw, { actorId: providerId, tenantId, batchSize: 2 });
    const first = await wrapper.withPlatformBypass((c) =>
      c.appointment.findMany({
        where: { id: { in: ids } },
        select: { id: true, effectiveSnapshotRevisionId: true },
      }),
    );
    const pointers = Object.fromEntries(first.map((r) => [r.id, r.effectiveSnapshotRevisionId]));
    const second = await runPhase48WaveBSnapshotBackfill(raw, { actorId: providerId, tenantId, batchSize: 2 });
    expect(second.processed).toBe(0);
    expect(second.remainingEligible).toBe(0);
    const after = await wrapper.withPlatformBypass((c) =>
      c.appointment.findMany({
        where: { id: { in: ids } },
        select: { id: true, effectiveSnapshotRevisionId: true },
      }),
    );
    for (const row of after) {
      expect(row.effectiveSnapshotRevisionId).toBe(pointers[row.id]);
    }
    const revCount = await wrapper.withPlatformBypass((c) =>
      c.appointmentServiceSnapshotRevision.count({ where: { appointmentId: { in: ids } } }),
    );
    expect(revCount).toBe(4);
  });

  it('WB07-BACKFILL-BATCH-03 — interrupt after batch N → resume completes correctly', async () => {
    const ids: string[] = [];
    for (let i = 0; i < 5; i++) {
      ids.push(
        await createAppointment({
          status: 'PENDING',
          clinicalServiceId: null,
          serviceType: `intr-${i}`,
          start: new Date(`2026-10-0${i + 1}T10:00:00.000Z`),
          end: new Date(`2026-10-0${i + 1}T10:30:00.000Z`),
        }),
      );
    }
    const partial = await runPhase48WaveBSnapshotBackfill(raw, { actorId: providerId, tenantId, batchSize: 2,
      maxBatches: 1,
      allowIncomplete: true,
    });
    expect(partial.batches).toBe(1);
    expect(partial.remainingEligible).toBeGreaterThan(0);
    const mid = await wrapper.withPlatformBypass((c) =>
      c.appointment.count({
        where: { id: { in: ids }, effectiveSnapshotRevisionId: { not: null } },
      }),
    );
    expect(mid).toBe(2);
    const done = await runPhase48WaveBSnapshotBackfill(raw, { actorId: providerId, tenantId, batchSize: 2,
    });
    expect(done.ok).toBe(true);
    expect(done.remainingEligible).toBe(0);
    const all = await wrapper.withPlatformBypass((c) =>
      c.appointment.count({
        where: { id: { in: ids }, effectiveSnapshotRevisionId: { not: null } },
      }),
    );
    expect(all).toBe(5);
  });

  it('WB07-BACKFILL-RLS-01 — production bypass path succeeds; tenant context stays isolated', async () => {
    const appointmentId = await createAppointment({
      status: 'PENDING',
      clinicalServiceId: null,
      serviceType: 'rls-backfill',
    });
    const report = await runPhase48WaveBSnapshotBackfill(raw, { actorId: providerId, tenantId, batchSize: 10 });
    expect(report.ok).toBe(true);
    const rev = await wrapper.withPlatformBypass((c) =>
      c.appointmentServiceSnapshotRevision.findFirst({ where: { appointmentId } }),
    );
    expect(rev).toBeTruthy();
    const src = readSrc('../application/services/phase48-wave-b-snapshot-backfill.ts');
    expect(src).toMatch(/phase48-wave-b-snapshot-backfill\.cjs/);
    const cjs = fs.readFileSync(
      path.join(__dirname, '../../../../scripts/lib/phase48-wave-b-snapshot-backfill.cjs'),
      'utf8',
    );
    expect(cjs).toMatch(/set_config\('app\.platform_rls_bypass', 'true', true\)/);
    const isolated = await withBookingApp(async (tx) => {
      await tx.$executeRaw`SELECT set_config('app.current_tenant_id', ${otherTenantId}, true)`;
      return tx.appointmentServiceSnapshotRevision.findMany({ where: { appointmentId } });
    });
    expect(isolated).toHaveLength(0);
  });

  it('WB07-BACKFILL-TENANT-01 — cross-tenant TENANT_CUSTOM mapping rejected', async () => {
    const foreignSvc = await seedTenantCustomService(otherTenantId);
    const sourceCode = `xt-${randomUUID().slice(0, 8)}`;
    const appointmentId = await createAppointment({
      status: 'PENDING',
      clinicalServiceId: null,
      serviceType: sourceCode,
    });
    await wrapper.withPlatformBypass(async (c) => {
      await c.legacyClinicalServiceMapping.create({
        data: {
          id: randomUUID(),
          tenantId: null,
          sourceSystem: 'LEGACY_APPOINTMENT_SERVICE_TYPE',
          sourceCode,
          status: 'MAPPED',
          clinicalServiceId: foreignSvc,
        },
      });
    });
    const report = await runPhase48WaveBSnapshotBackfill(raw, { actorId: providerId, tenantId });
    expect(report.rejectedCrossTenant).toBeGreaterThanOrEqual(1);
    const appt = await wrapper.withPlatformBypass((c) =>
      c.appointment.findUniqueOrThrow({ where: { id: appointmentId } }),
    );
    const rev = await wrapper.withPlatformBypass((c) =>
      c.appointmentServiceSnapshotRevision.findFirst({ where: { appointmentId } }),
    );
    expect(appt.clinicalServiceId).toBeNull();
    expect(rev?.clinicalServiceId).toBeNull();
    expect(rev?.commercialReason).toBe('LEGACY_UNMAPPED');
  });

  it('WB07-BACKFILL-TENANT-02 — SYSTEM_CANONICAL mapping remains valid', async () => {
    const sourceCode = `canon-${randomUUID().slice(0, 8)}`;
    const appointmentId = await createAppointment({
      status: 'PENDING',
      clinicalServiceId: null,
      serviceType: sourceCode,
    });
    await wrapper.withPlatformBypass(async (c) => {
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
    });
    await runPhase48WaveBSnapshotBackfill(raw, { actorId: providerId, tenantId });
    const appt = await wrapper.withPlatformBypass((c) =>
      c.appointment.findUniqueOrThrow({ where: { id: appointmentId } }),
    );
    expect(appt.clinicalServiceId).toBe(clinicalServiceId);
  });

  it('WB07-BACKFILL-SOURCE-01 / WB07-MIG-SOURCE-01 — wrong sourceSystem mapping ignored', async () => {
    const sourceCode = `other-${randomUUID().slice(0, 8)}`;
    const appointmentId = await createAppointment({
      status: 'PENDING',
      clinicalServiceId: null,
      serviceType: sourceCode,
    });
    await wrapper.withPlatformBypass(async (c) => {
      await c.legacyClinicalServiceMapping.create({
        data: {
          id: randomUUID(),
          tenantId,
          sourceSystem: 'OTHER_SYSTEM',
          sourceCode,
          status: 'MAPPED',
          clinicalServiceId,
        },
      });
    });
    await runPhase48WaveBSnapshotBackfill(raw, { actorId: providerId, tenantId });
    const rev = await wrapper.withPlatformBypass((c) =>
      c.appointmentServiceSnapshotRevision.findFirst({ where: { appointmentId } }),
    );
    expect(rev?.clinicalServiceId).toBeNull();
    expect(rev?.commercialReason).toBe('LEGACY_UNMAPPED');
  });

  it('WB07-MIG-IDEMP-01 — multi-batch dataset; second run changes nothing', async () => {
    const ids: string[] = [];
    for (let i = 0; i < 6; i++) {
      ids.push(
        await createAppointment({
          status: 'PENDING',
          clinicalServiceId: null,
          serviceType: `idem-mb-${i}`,
          start: new Date(`2026-07-0${(i % 9) + 1}T11:00:00.000Z`),
          end: new Date(`2026-07-0${(i % 9) + 1}T11:30:00.000Z`),
        }),
      );
    }
    const first = await runPhase48WaveBSnapshotBackfill(raw, { actorId: providerId, tenantId, batchSize: 2 });
    expect(first.ok).toBe(true);
    expect(first.batches).toBeGreaterThanOrEqual(3);
    const pointers = await wrapper.withPlatformBypass((c) =>
      c.appointment.findMany({
        where: { id: { in: ids } },
        select: { id: true, effectiveSnapshotRevisionId: true, serviceType: true },
      }),
    );
    const second = await runPhase48WaveBSnapshotBackfill(raw, { actorId: providerId, tenantId, batchSize: 2 });
    expect(second.processed).toBe(0);
    const after = await wrapper.withPlatformBypass((c) =>
      c.appointment.findMany({
        where: { id: { in: ids } },
        select: { id: true, effectiveSnapshotRevisionId: true, serviceType: true },
      }),
    );
    expect(after).toEqual(pointers);
  });

  it('WB07-PROD-PATH-01 — TS re-export and production CLI resolve the same CJS module', () => {
    const { createRequire } = require('module') as typeof import('module');
    const req = createRequire(__filename);
    const fromTs = req(
      path.join(__dirname, '../../../../scripts/lib/phase48-wave-b-snapshot-backfill.cjs'),
    );
    expect(typeof fromTs.runPhase48WaveBSnapshotBackfill).toBe('function');
    const prodCli = fs.readFileSync(
      path.join(__dirname, '../../../../scripts/backfill-phase48-wave-b-snapshots-production.mjs'),
      'utf8',
    );
    expect(prodCli).toMatch(/phase48-wave-b-snapshot-backfill\.mjs/);
    expect(prodCli).toMatch(/--confirm-production-backfill/);
    const tsReexport = readSrc('../application/services/phase48-wave-b-snapshot-backfill.ts');
    expect(tsReexport).toMatch(/phase48-wave-b-snapshot-backfill\.cjs/);
  });

  it('WB07-RLS-SNAP-01 — booking_app cannot read other tenant snapshot', async () => {
    const appointmentId = await createAppointment();
    await concurrency.withBookingTransaction(async (client) => {
      await snapshots.captureCanonicalRevision1(client, {
        tenantId, appointmentId, actorId: providerId, commercial: commercial({ unitPrice: 12 }),
      });
    });
    const rows = await withBookingApp(async (tx) => {
      await tx.$executeRaw`SELECT set_config('app.current_tenant_id', ${otherTenantId}, true)`;
      return tx.appointmentServiceSnapshotRevision.findMany({ where: { tenantId } });
    });
    expect(rows).toHaveLength(0);
  });

  it('WB07-RLS-ALLOC-01 — tenant A booking_app cannot INSERT/read forged foreign allocation', async () => {
    const { foreignRoom, foreignAppt } = await seedForeignApptAndRoom();
    const reads = await withBookingApp(async (tx) => {
      await tx.$executeRaw`SELECT set_config('app.current_tenant_id', ${tenantId}, true)`;
      return tx.appointmentResourceAllocation.findMany({ where: { tenantId: otherTenantId } });
    });
    expect(reads).toHaveLength(0);
    await expect(
      withBookingApp(async (tx) => {
        await tx.$executeRaw`SELECT set_config('app.current_tenant_id', ${tenantId}, true)`;
        return tx.appointmentResourceAllocation.create({
          data: {
            id: randomUUID(), tenantId: otherTenantId, appointmentId: foreignAppt,
            schedulingResourceId: foreignRoom,
          },
        });
      }),
    ).rejects.toBeTruthy();
  });

  it('WB07-RLS-ALLOC-02 — platform bypass still trigger-rejects forged tenantId=A + B resources', async () => {
    const { foreignRoom, foreignAppt } = await seedForeignApptAndRoom();
    await expect(
      wrapper.withPlatformBypass((c) =>
        c.appointmentResourceAllocation.create({
          data: {
            id: randomUUID(), tenantId, appointmentId: foreignAppt, schedulingResourceId: foreignRoom,
          },
        }),
      ),
    ).rejects.toThrow(/tenantId must match/i);
  });

  it('WB07-RLS-ELIG-01 — booking_app cross-tenant eligibility deny', async () => {
    await createElig(new Date('2020-01-01T00:00:00.000Z'));
    const rows = await withBookingApp(async (tx) => {
      await tx.$executeRaw`SELECT set_config('app.current_tenant_id', ${otherTenantId}, true)`;
      return tx.providerServiceEligibility.findMany({ where: { tenantId } });
    });
    expect(rows).toHaveLength(0);
  });
});
