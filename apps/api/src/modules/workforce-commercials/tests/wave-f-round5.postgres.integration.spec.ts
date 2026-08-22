/**
 * Phase 48 Wave F Round 5 remediation — focused PostgreSQL integration tests.
 */
import { randomUUID } from 'crypto';
import { PrismaClient, Prisma } from '@prisma/client';
import {
  createClinicalPrismaWrapper,
  createPlatformDbSecurityClient,
  platformDbSecurityEnabled,
} from '../../clinical-catalog/tests/clinical-catalog-db.harness';
import {
  assertSafePlatformTestDatabaseUrl,
  DEFAULT_PLATFORM_DB_SECURITY_URL,
} from '../../auth/tests/platform-db-security.harness';
import { Invoice } from '../../billing/domain/entities/invoice.entity';
import { PrismaInvoiceRepository } from '../../billing/infrastructure/prisma-invoice.repository';
import { CommissionAccrualService } from '../services/commission-accrual.service';
import { StaffCommissionPlanService } from '../services/staff-commission-plan.service';
import { InvoiceLinePerformanceAttributionService } from '../services/invoice-line-performance-attribution.service';
import { CommissionPackageAllocationService } from '../services/commission-package-allocation.service';

jest.setTimeout(300_000);
const describeDb = platformDbSecurityEnabled() ? describe : describe.skip;

const ADMIN_URL = DEFAULT_PLATFORM_DB_SECURITY_URL;
const APP_URL =
  process.env.INTEGRATION_APP_DATABASE_URL ??
  'postgresql://booking_app:booking_app@localhost:5433/booking_test?schema=public';

describeDb('Wave F Round 5 remediation (PostgreSQL)', () => {
  let raw: PrismaClient;
  let wrapper: ReturnType<typeof createClinicalPrismaWrapper>;
  let tenantId: string;
  let actorId: string;
  let performerId: string;
  let patientId: string;
  let branchId: string;
  let clinicalServiceId: string;
  let appointmentId: string;
  const auditCalls: Array<Record<string, unknown>> = [];

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

  function plans() {
    return new StaffCommissionPlanService(wrapper as never, tenantContext as never, audit as never);
  }
  function accruals() {
    return new CommissionAccrualService(
      wrapper as never,
      tenantContext as never,
      plans(),
      audit as never,
    );
  }
  function binder() {
    return new InvoiceLinePerformanceAttributionService(
      wrapper as never,
      tenantContext as never,
      audit as never,
    );
  }
  function packages() {
    return new CommissionPackageAllocationService(
      wrapper as never,
      tenantContext as never,
      audit as never,
    );
  }

  async function seed() {
    await wrapper.withPlatformBypass(async (c) => {
      await c.tenant.create({
        data: { id: tenantId, name: 'WF R5', slug: `wfr5-${tenantId.slice(0, 8)}` },
      });
      for (const u of [
        { id: actorId, first: 'A', last: 'Ctor' },
        { id: performerId, first: 'Perf', last: 'Ormer' },
      ]) {
        await c.user.create({
          data: {
            id: u.id,
            tenantId,
            email: `wfr5-${u.id.slice(0, 8)}@t.local`,
            passwordHash: 'x',
            firstName: u.first,
            lastName: u.last,
          },
        });
      }
      await c.patient.create({
        data: { id: patientId, tenantId, firstName: 'Pat', lastName: 'Five' },
      });
      await c.branch.create({
        data: { id: branchId, tenantId, name: `R5 B ${branchId.slice(0, 6)}` },
      });
      await c.canonicalClinicalServiceDefinition.create({
        data: {
          id: clinicalServiceId,
          tenantId,
          provenance: 'TENANT_CUSTOM',
          stableKey: `tenant.${tenantId}.custom.wf-${clinicalServiceId.slice(0, 8)}`,
          domain: 'GENERAL',
          lifecycle: 'PUBLISHED',
        },
      });
      await c.appointment.create({
        data: {
          id: appointmentId,
          tenantId,
          branchId,
          patientId,
          providerId: actorId,
          scheduledStart: new Date('2026-09-01T10:00:00.000Z'),
          scheduledEnd: new Date('2026-09-01T11:00:00.000Z'),
          status: 'CONFIRMED',
          clinicalServiceId,
        },
      });
    });
  }

  async function enableAndPublishPlan(opts?: { percentage?: number }) {
    await plans().setUserCommissionEligibility(
      performerId,
      true,
      opts?.percentage ?? 30,
      '2026-01-01',
      { actorId, actorRoles: ['owner'] },
    );
    const draft = await plans().createDraftPlan({
      userId: performerId,
      percentage: opts?.percentage ?? 30,
      effectiveFrom: '2026-01-01',
      calculationBasis: 'SERVICE_NET_AFTER_DISCOUNT',
      earningTrigger: 'INVOICE_OR_CHARGE_FINALIZED',
      actor: { actorId, actorRoles: ['owner'] },
    });
    return plans().publishPlan(draft.id, { actorId, actorRoles: ['owner'] });
  }

  async function createCompletedPerformance(opts?: {
    appointmentId?: string | null;
    patientId?: string | null;
    clinicalServiceId?: string | null;
    snapshotRevisionId?: string | null;
    performedAt?: Date;
  }) {
    const performanceId = randomUUID();
    const performedAt = opts?.performedAt ?? new Date('2026-09-01T10:30:00.000Z');
    await wrapper.withPlatformBypass(async (c) => {
      await c.servicePerformance.create({
        data: {
          id: performanceId,
          tenantId,
          branchId,
          patientId: opts?.patientId === undefined ? patientId : opts.patientId,
          appointmentId:
            opts?.appointmentId === undefined ? appointmentId : opts.appointmentId,
          clinicalServiceId:
            opts?.clinicalServiceId === undefined ? clinicalServiceId : opts.clinicalServiceId!,
          snapshotRevisionId: opts?.snapshotRevisionId ?? null,
          status: 'DRAFT',
          performedAt,
          createdBy: actorId,
          participants: {
            create: {
              id: randomUUID(),
              tenantId,
              userId: performerId,
              role: 'PRIMARY',
              attributionShare: null,
              recordedBy: actorId,
            },
          },
        },
      });
      await c.servicePerformance.update({
        where: { id: performanceId },
        data: { status: 'COMPLETED', completedAt: performedAt, completedBy: actorId },
      });
    });
    return performanceId;
  }

  async function createInvoiceViaProductionPath(
    servicePerformanceId: string | null,
    opts?: {
      amount?: string;
      appointmentId?: string | null;
      clinicalServiceId?: string | null;
      snapshotRevisionId?: string | null;
      courseSessionId?: string | null;
    },
  ) {
    const amount = opts?.amount ?? '1000.00';
    const invoice = Invoice.create({
      invoiceId: randomUUID(),
      tenantId,
      branchId,
      patientId,
      invoiceNumber: `R5-${randomUUID().slice(0, 8)}`,
      invoiceDate: new Date('2026-09-01'),
      currency: 'SYP',
      notes: 'R5 production path',
      lineItems: [
        {
          description: 'R5 clinical line',
          quantity: 1,
          unitPrice: Number(amount),
          discountPercent: 0,
          taxPercent: 0,
          servicePerformanceId,
          appointmentId: opts?.appointmentId === undefined ? appointmentId : opts.appointmentId,
          clinicalServiceId:
            opts?.clinicalServiceId === undefined ? clinicalServiceId : opts.clinicalServiceId,
          snapshotRevisionId: opts?.snapshotRevisionId ?? null,
          courseSessionId: opts?.courseSessionId ?? null,
        },
      ],
    });
    invoice.issue();
    const line = invoice.lineItems[0]!;
    await raw.$executeRaw`SELECT set_config('app.platform_rls_bypass', 'true', false)`;
    await new PrismaInvoiceRepository(raw as never).save(invoice);
    return { invoiceId: invoice.invoiceId, lineId: line.itemId };
  }

  async function seedCourseSession(opts?: {
    status?: 'PLANNED' | 'COMPLETED';
    appointmentId?: string;
    unitPrice?: string;
    pricingUnit?: 'PER_COURSE' | 'PER_PACKAGE' | 'PER_VISIT';
    currency?: string;
    packagePriceVersionId?: string | null;
  }) {
    const courseId = randomUUID();
    const sessionId = randomUUID();
    const priceVersionId = opts?.packagePriceVersionId === null ? null : opts?.packagePriceVersionId ?? randomUUID();
    const unitPrice = opts?.unitPrice ?? '5000.00';
    const pricingUnit = opts?.pricingUnit ?? 'PER_COURSE';
    const currency = opts?.currency ?? 'SYP';
    await wrapper.withPlatformBypass(async (c) => {
      if (priceVersionId) {
        await c.clinicalServicePriceVersion.create({
          data: {
            id: priceVersionId,
            tenantId,
            clinicalServiceId,
            pricingUnit,
            currency,
            unitPrice,
            effectiveFrom: new Date('2026-01-01T00:00:00.000Z'),
            status: 'ACTIVE',
            publishedAt: new Date('2026-01-01T00:00:00.000Z'),
            publishedBy: actorId,
          },
        });
      }
      await c.treatmentCourse.create({
        data: {
          id: courseId,
          tenantId,
          patientId,
          clinicalServiceId,
          plannedSessions: 5,
          packagePriceVersionId: priceVersionId,
          status: 'ACTIVE',
          createdBy: actorId,
        },
      });
      await c.courseSession.create({
        data: {
          id: sessionId,
          tenantId,
          courseId,
          sequence: 1,
          appointmentId: opts?.appointmentId ?? appointmentId,
          status: opts?.status ?? 'COMPLETED',
        },
      });
    });
    return { courseId, sessionId, priceVersionId, unitPrice, currency };
  }

  async function createPayment(invoiceId: string, amount: string) {
    const paymentId = randomUUID();
    await wrapper.withPlatformBypass(async (c) => {
      await c.invoicePayment.create({
        data: {
          id: paymentId,
          tenantId,
          invoiceId,
          amount,
          paymentMethod: 'cash',
          paymentDate: new Date('2026-09-01'),
          recordedBy: actorId,
        },
      });
    });
    return paymentId;
  }

  async function createRefund(invoiceId: string, amount: string) {
    const refundId = randomUUID();
    await wrapper.withPlatformBypass(async (c) => {
      await c.invoiceRefund.create({
        data: {
          id: refundId,
          tenantId,
          invoiceId,
          amount,
          reason: 'R5 refund',
          refundMethod: 'cash',
          refundDate: new Date('2026-09-02'),
          approvedBy: actorId,
        },
      });
    });
    return refundId;
  }

  beforeAll(async () => {
    raw = await createPlatformDbSecurityClient();
    wrapper = createClinicalPrismaWrapper(raw);
  });
  afterAll(async () => {
    await raw.$disconnect();
  });
  beforeEach(async () => {
    auditCalls.length = 0;
    tenantId = randomUUID();
    actorId = randomUUID();
    performerId = randomUUID();
    patientId = randomUUID();
    branchId = randomUUID();
    clinicalServiceId = randomUUID();
    appointmentId = randomUUID();
    await seed();
  });

  // ── R5-PKG-1 authoritative basis ───────────────────────────────────────────

  it('R5-PKG1-T1/T7/T8 basis from packagePriceVersionId; valid allocation persists', async () => {
    const { courseId, sessionId, priceVersionId } = await seedCourseSession({ unitPrice: '5000.00' });
    const performanceId = await createCompletedPerformance();
    const result = await packages().registerSessionAllocation({
      treatmentCourseId: courseId,
      courseSessionId: sessionId,
      servicePerformanceId: performanceId,
      allocatedRevenueAmount: '1000.00',
      actor: { actorId, actorRoles: ['owner'] },
      idempotencyKey: `r5-pkg1-${sessionId}`,
    });
    expect(result.allocation.packageCommercialBasisAmount.toFixed(2)).toBe('5000.00');
    expect(result.allocation.currency).toBe('SYP');
    expect(result.allocation.allocatedRevenueAmount.toFixed(2)).toBe('1000.00');
    const stored = await wrapper.withPlatformBypass((c) =>
      c.commissionPackageSessionAllocation.findUnique({ where: { id: result.allocation.id } }),
    );
    expect(stored?.packageCommercialBasisAmount.toFixed(2)).toBe('5000.00');
    expect(stored?.currency).toBe('SYP');
    expect(
      auditCalls.some(
        (a) =>
          a.action === 'staff_commission.package_allocation.registered' &&
          (a.details as { packagePriceVersionId?: string })?.packagePriceVersionId === priceVersionId,
      ),
    ).toBe(true);
  });

  it('R5-PKG1-T2 inflated packageCommercialBasisAmount rejected', async () => {
    const { courseId, sessionId } = await seedCourseSession({ unitPrice: '5000.00' });
    const performanceId = await createCompletedPerformance();
    await expect(
      packages().registerSessionAllocation({
        treatmentCourseId: courseId,
        courseSessionId: sessionId,
        servicePerformanceId: performanceId,
        allocatedRevenueAmount: '1000.00',
        packageCommercialBasisAmount: '99999.00',
        actor: { actorId, actorRoles: ['owner'] },
        idempotencyKey: `r5-pkg1-t2-${sessionId}`,
      }),
    ).rejects.toThrow(/does not match authoritative/i);
  });

  it('R5-PKG1-T3 wrong currency rejected', async () => {
    const { courseId, sessionId } = await seedCourseSession({ unitPrice: '5000.00', currency: 'SYP' });
    const performanceId = await createCompletedPerformance();
    await expect(
      packages().registerSessionAllocation({
        treatmentCourseId: courseId,
        courseSessionId: sessionId,
        servicePerformanceId: performanceId,
        allocatedRevenueAmount: '1000.00',
        currency: 'USD',
        actor: { actorId, actorRoles: ['owner'] },
        idempotencyKey: `r5-pkg1-t3-${sessionId}`,
      }),
    ).rejects.toThrow(/currency does not match/i);
  });

  it('R5-PKG1-T4/T5 wrong / missing package price version rejected', async () => {
    const { courseId, sessionId } = await seedCourseSession({ unitPrice: '5000.00' });
    const otherSvc = randomUUID();
    const wrongPv = randomUUID();
    await wrapper.withPlatformBypass(async (c) => {
      await c.canonicalClinicalServiceDefinition.create({
        data: {
          id: otherSvc,
          tenantId,
          provenance: 'TENANT_CUSTOM',
          stableKey: `tenant.${tenantId}.custom.wrong-${otherSvc.slice(0, 8)}`,
          domain: 'GENERAL',
          lifecycle: 'PUBLISHED',
        },
      });
      await c.clinicalServicePriceVersion.create({
        data: {
          id: wrongPv,
          tenantId,
          clinicalServiceId: otherSvc,
          pricingUnit: 'PER_COURSE',
          currency: 'SYP',
          unitPrice: '5000.00',
          effectiveFrom: new Date('2026-01-01'),
          status: 'ACTIVE',
        },
      });
      await c.treatmentCourse.update({
        where: { id: courseId },
        data: { packagePriceVersionId: wrongPv },
      });
    });
    const performanceId = await createCompletedPerformance();
    await expect(
      packages().registerSessionAllocation({
        treatmentCourseId: courseId,
        courseSessionId: sessionId,
        servicePerformanceId: performanceId,
        allocatedRevenueAmount: '1000.00',
        actor: { actorId, actorRoles: ['owner'] },
        idempotencyKey: `r5-pkg1-t4-${sessionId}`,
      }),
    ).rejects.toThrow(/clinicalServiceId must match/i);

    const orphanCourse = await seedCourseSession({ unitPrice: '4000.00' });
    await wrapper.withPlatformBypass(async (c) => {
      await c.clinicalServicePriceVersion.delete({
        where: { id: orphanCourse.priceVersionId! },
      });
    });
    const perf2 = await createCompletedPerformance();
    await expect(
      packages().registerSessionAllocation({
        treatmentCourseId: orphanCourse.courseId,
        courseSessionId: orphanCourse.sessionId,
        servicePerformanceId: perf2,
        allocatedRevenueAmount: '1000.00',
        actor: { actorId, actorRoles: ['owner'] },
        idempotencyKey: `r5-pkg1-t5-${orphanCourse.sessionId}`,
      }),
    ).rejects.toThrow(/does not resolve|tenant price version/i);
  });

  it('R5-PKG1-T6 non-PER_COURSE/PER_PACKAGE pricing unit rejected', async () => {
    const { courseId, sessionId } = await seedCourseSession({
      unitPrice: '5000.00',
      pricingUnit: 'PER_VISIT',
    });
    const performanceId = await createCompletedPerformance();
    await expect(
      packages().registerSessionAllocation({
        treatmentCourseId: courseId,
        courseSessionId: sessionId,
        servicePerformanceId: performanceId,
        allocatedRevenueAmount: '1000.00',
        actor: { actorId, actorRoles: ['owner'] },
        idempotencyKey: `r5-pkg1-t6-${sessionId}`,
      }),
    ).rejects.toThrow(/PER_COURSE or PER_PACKAGE/i);
  });

  // ── R5-PKG-2 concurrency ───────────────────────────────────────────────────

  it('R5-PKG2-T1/T2/T6 concurrent allocations cannot exceed basis', async () => {
    const { courseId } = await seedCourseSession({ unitPrice: '5000.00' });
    const sessionA = randomUUID();
    const sessionB = randomUUID();
    const apptA = appointmentId;
    const apptB = randomUUID();
    await wrapper.withPlatformBypass(async (c) => {
      await c.appointment.create({
        data: {
          id: apptB,
          tenantId,
          branchId,
          patientId,
          providerId: actorId,
          scheduledStart: new Date('2026-09-08T10:00:00.000Z'),
          scheduledEnd: new Date('2026-09-08T11:00:00.000Z'),
          status: 'CONFIRMED',
          clinicalServiceId,
        },
      });
      await c.courseSession.create({
        data: {
          id: sessionA,
          tenantId,
          courseId,
          sequence: 2,
          appointmentId: apptA,
          status: 'COMPLETED',
        },
      });
      await c.courseSession.create({
        data: {
          id: sessionB,
          tenantId,
          courseId,
          sequence: 3,
          appointmentId: apptB,
          status: 'COMPLETED',
        },
      });
    });
    // Seed existing 3000 on sequence 1 from seedCourseSession
    const existingSession = await wrapper.withPlatformBypass((c) =>
      c.courseSession.findFirst({ where: { courseId, sequence: 1 } }),
    );
    const perf0 = await createCompletedPerformance();
    await packages().registerSessionAllocation({
      treatmentCourseId: courseId,
      courseSessionId: existingSession!.id,
      servicePerformanceId: perf0,
      allocatedRevenueAmount: '3000.00',
      actor: { actorId, actorRoles: ['owner'] },
      idempotencyKey: `r5-pkg2-seed-${existingSession!.id}`,
    });

    const perfA = await createCompletedPerformance({ appointmentId: apptA });
    const perfB = await createCompletedPerformance({
      appointmentId: apptB,
      performedAt: new Date('2026-09-08T10:30:00.000Z'),
    });

    const race = await Promise.allSettled([
      packages().registerSessionAllocation({
        treatmentCourseId: courseId,
        courseSessionId: sessionA,
        servicePerformanceId: perfA,
        allocatedRevenueAmount: '1500.00',
        actor: { actorId, actorRoles: ['owner'] },
        idempotencyKey: `r5-pkg2-a-${sessionA}`,
      }),
      packages().registerSessionAllocation({
        treatmentCourseId: courseId,
        courseSessionId: sessionB,
        servicePerformanceId: perfB,
        allocatedRevenueAmount: '1500.00',
        actor: { actorId, actorRoles: ['owner'] },
        idempotencyKey: `r5-pkg2-b-${sessionB}`,
      }),
    ]);
    const ok = race.filter((r) => r.status === 'fulfilled').length;
    const fail = race.filter((r) => r.status === 'rejected').length;
    expect(ok).toBe(1);
    expect(fail).toBe(1);
    const sum = await wrapper.withPlatformBypass(async (c) => {
      const rows = await c.commissionPackageSessionAllocation.findMany({
        where: { tenantId, treatmentCourseId: courseId },
      });
      return rows.reduce((acc, r) => acc.add(r.allocatedRevenueAmount), new Prisma.Decimal(0));
    });
    expect(sum.lte(5000)).toBe(true);
    expect(sum.toFixed(2)).toBe('4500.00');
  });

  it('R5-PKG2-T3 concurrent small allocations that fit both succeed', async () => {
    const { courseId } = await seedCourseSession({ unitPrice: '5000.00' });
    const s1 = await wrapper.withPlatformBypass((c) =>
      c.courseSession.findFirst({ where: { courseId, sequence: 1 } }),
    );
    const s2 = randomUUID();
    const appt2 = randomUUID();
    await wrapper.withPlatformBypass(async (c) => {
      await c.appointment.create({
        data: {
          id: appt2,
          tenantId,
          branchId,
          patientId,
          providerId: actorId,
          scheduledStart: new Date('2026-09-09T10:00:00.000Z'),
          scheduledEnd: new Date('2026-09-09T11:00:00.000Z'),
          status: 'CONFIRMED',
          clinicalServiceId,
        },
      });
      await c.courseSession.create({
        data: {
          id: s2,
          tenantId,
          courseId,
          sequence: 2,
          appointmentId: appt2,
          status: 'COMPLETED',
        },
      });
    });
    const p1 = await createCompletedPerformance();
    const p2 = await createCompletedPerformance({
      appointmentId: appt2,
      performedAt: new Date('2026-09-09T10:30:00.000Z'),
    });
    const race = await Promise.allSettled([
      packages().registerSessionAllocation({
        treatmentCourseId: courseId,
        courseSessionId: s1!.id,
        servicePerformanceId: p1,
        allocatedRevenueAmount: '1000.00',
        actor: { actorId, actorRoles: ['owner'] },
        idempotencyKey: `r5-pkg2-t3-a-${s1!.id}`,
      }),
      packages().registerSessionAllocation({
        treatmentCourseId: courseId,
        courseSessionId: s2,
        servicePerformanceId: p2,
        allocatedRevenueAmount: '1000.00',
        actor: { actorId, actorRoles: ['owner'] },
        idempotencyKey: `r5-pkg2-t3-b-${s2}`,
      }),
    ]);
    expect(race.every((r) => r.status === 'fulfilled')).toBe(true);
  });

  it('R5-PKG2-T4 concurrent duplicate same-session → only one', async () => {
    const { courseId, sessionId } = await seedCourseSession();
    const performanceId = await createCompletedPerformance();
    const race = await Promise.allSettled([
      packages().registerSessionAllocation({
        treatmentCourseId: courseId,
        courseSessionId: sessionId,
        servicePerformanceId: performanceId,
        allocatedRevenueAmount: '1000.00',
        actor: { actorId, actorRoles: ['owner'] },
        idempotencyKey: `r5-pkg2-t4-a-${sessionId}`,
      }),
      packages().registerSessionAllocation({
        treatmentCourseId: courseId,
        courseSessionId: sessionId,
        servicePerformanceId: performanceId,
        allocatedRevenueAmount: '1000.00',
        actor: { actorId, actorRoles: ['owner'] },
        idempotencyKey: `r5-pkg2-t4-b-${sessionId}`,
      }),
    ]);
    const ok = race.filter((r) => r.status === 'fulfilled').length;
    expect(ok).toBe(1);
    const count = await wrapper.withPlatformBypass((c) =>
      c.commissionPackageSessionAllocation.count({ where: { tenantId, courseSessionId: sessionId } }),
    );
    expect(count).toBe(1);
  });

  it('R5-PKG2-T5 different packages do not conflict', async () => {
    const a = await seedCourseSession({ unitPrice: '5000.00' });
    const patient2 = randomUUID();
    const appt2 = randomUUID();
    await wrapper.withPlatformBypass(async (c) => {
      await c.patient.create({
        data: { id: patient2, tenantId, firstName: 'P2', lastName: 'Two' },
      });
      await c.appointment.create({
        data: {
          id: appt2,
          tenantId,
          branchId,
          patientId: patient2,
          providerId: actorId,
          scheduledStart: new Date('2026-09-10T10:00:00.000Z'),
          scheduledEnd: new Date('2026-09-10T11:00:00.000Z'),
          status: 'CONFIRMED',
          clinicalServiceId,
        },
      });
    });
    // Temporarily point tenantContext patient course B
    const bCourseId = randomUUID();
    const bSessionId = randomUUID();
    const bPv = randomUUID();
    await wrapper.withPlatformBypass(async (c) => {
      await c.clinicalServicePriceVersion.create({
        data: {
          id: bPv,
          tenantId,
          clinicalServiceId,
          pricingUnit: 'PER_PACKAGE',
          currency: 'SYP',
          unitPrice: '5000.00',
          effectiveFrom: new Date('2026-01-01'),
          status: 'ACTIVE',
        },
      });
      await c.treatmentCourse.create({
        data: {
          id: bCourseId,
          tenantId,
          patientId: patient2,
          clinicalServiceId,
          plannedSessions: 3,
          packagePriceVersionId: bPv,
          status: 'ACTIVE',
          createdBy: actorId,
        },
      });
      await c.courseSession.create({
        data: {
          id: bSessionId,
          tenantId,
          courseId: bCourseId,
          sequence: 1,
          appointmentId: appt2,
          status: 'COMPLETED',
        },
      });
    });
    const pA = await createCompletedPerformance();
    const pB = await createCompletedPerformance({
      appointmentId: appt2,
      patientId: patient2,
      performedAt: new Date('2026-09-10T10:30:00.000Z'),
    });
    const race = await Promise.allSettled([
      packages().registerSessionAllocation({
        treatmentCourseId: a.courseId,
        courseSessionId: a.sessionId,
        servicePerformanceId: pA,
        allocatedRevenueAmount: '2000.00',
        actor: { actorId, actorRoles: ['owner'] },
        idempotencyKey: `r5-pkg2-t5-a-${a.sessionId}`,
      }),
      packages().registerSessionAllocation({
        treatmentCourseId: bCourseId,
        courseSessionId: bSessionId,
        servicePerformanceId: pB,
        allocatedRevenueAmount: '2000.00',
        actor: { actorId, actorRoles: ['owner'] },
        idempotencyKey: `r5-pkg2-t5-b-${bSessionId}`,
      }),
    ]);
    expect(race.every((r) => r.status === 'fulfilled')).toBe(true);
  });

  // ── R5-PKG-3 RLS ───────────────────────────────────────────────────────────

  it('R5-PKG3-T1/T2/T8 pg_policies uses app.current_tenant_id; FORCE+ENABLE+NOBYPASSRLS', async () => {
    assertSafePlatformTestDatabaseUrl(ADMIN_URL);
    const admin = new PrismaClient({ datasources: { db: { url: ADMIN_URL } } });
    await admin.$connect();
    try {
      const policies = await admin.$queryRaw<
        Array<{ polname: string; using_expr: string | null; check_expr: string | null }>
      >`
        SELECT pol.polname,
               pg_get_expr(pol.polqual, pol.polrelid) AS using_expr,
               pg_get_expr(pol.polwithcheck, pol.polrelid) AS check_expr
        FROM pg_policy pol
        JOIN pg_class c ON c.oid = pol.polrelid
        WHERE c.relname = 'commission_package_session_allocations'
      `;
      expect(policies.length).toBeGreaterThan(0);
      const joined = policies.map((p) => `${p.using_expr || ''} ${p.check_expr || ''}`).join('\n');
      expect(joined).toMatch(/app\.current_tenant_id/);
      expect(joined).not.toMatch(/(?<!current_)app\.tenant_id/);
      const rls = await admin.$queryRaw<
        Array<{ relrowsecurity: boolean; relforcerowsecurity: boolean }>
      >`
        SELECT relrowsecurity, relforcerowsecurity FROM pg_class
        WHERE relname = 'commission_package_session_allocations'
      `;
      expect(rls[0]?.relrowsecurity).toBe(true);
      expect(rls[0]?.relforcerowsecurity).toBe(true);
      const role = await admin.$queryRaw<Array<{ rolbypassrls: boolean }>>`
        SELECT rolbypassrls FROM pg_roles WHERE rolname = 'booking_app'
      `;
      expect(role[0]?.rolbypassrls).toBe(false);
    } finally {
      await admin.$disconnect();
    }
  });

  it('R5-PKG3-T3..T7 same-tenant insert/select; cross-tenant blocked', async () => {
    assertSafePlatformTestDatabaseUrl(ADMIN_URL);
    const admin = new PrismaClient({ datasources: { db: { url: ADMIN_URL } } });
    const app = new PrismaClient({ datasources: { db: { url: APP_URL } } });
    await admin.$connect();
    await app.$connect();
    try {
      const { courseId, sessionId } = await seedCourseSession();
      const performanceId = await createCompletedPerformance();
      const allocId = randomUUID();

      await app.$transaction(async (tx) => {
        await tx.$executeRaw`SELECT set_config('app.current_tenant_id', ${tenantId}, true)`;
        await tx.$executeRaw`SELECT set_config('app.platform_rls_bypass', 'false', true)`;
        await tx.commissionPackageSessionAllocation.create({
          data: {
            id: allocId,
            tenantId,
            treatmentCourseId: courseId,
            courseSessionId: sessionId,
            servicePerformanceId: performanceId,
            allocatedRevenueAmount: '500.00',
            packageCommercialBasisAmount: '5000.00',
            currency: 'SYP',
            idempotencyKey: `r5-rls-${allocId}`,
            createdBy: actorId,
          },
        });
        const visible = await tx.commissionPackageSessionAllocation.findMany({
          where: { id: allocId },
        });
        expect(visible).toHaveLength(1);
      });

      const tenantB = randomUUID();
      await wrapper.withPlatformBypass(async (c) => {
        await c.tenant.create({
          data: { id: tenantB, name: 'TB', slug: `tb-${tenantB.slice(0, 8)}` },
        });
      });

      const hidden = await app.$transaction(async (tx) => {
        await tx.$executeRaw`SELECT set_config('app.current_tenant_id', ${tenantB}, true)`;
        await tx.$executeRaw`SELECT set_config('app.platform_rls_bypass', 'false', true)`;
        return tx.commissionPackageSessionAllocation.findMany({ where: { id: allocId } });
      });
      expect(hidden).toHaveLength(0);

      await expect(
        app.$transaction(async (tx) => {
          await tx.$executeRaw`SELECT set_config('app.current_tenant_id', ${tenantB}, true)`;
          await tx.$executeRaw`SELECT set_config('app.platform_rls_bypass', 'false', true)`;
          return tx.commissionPackageSessionAllocation.create({
            data: {
              id: randomUUID(),
              tenantId,
              treatmentCourseId: courseId,
              courseSessionId: sessionId,
              servicePerformanceId: performanceId,
              allocatedRevenueAmount: '100.00',
              packageCommercialBasisAmount: '5000.00',
              currency: 'SYP',
              idempotencyKey: `x-${randomUUID()}`,
              createdBy: actorId,
            },
          });
        }),
      ).rejects.toThrow();

      await expect(
        app.$transaction(async (tx) => {
          await tx.$executeRaw`SELECT set_config('app.current_tenant_id', ${tenantB}, true)`;
          await tx.$executeRaw`SELECT set_config('app.platform_rls_bypass', 'false', true)`;
          return tx.commissionPackageSessionAllocation.update({
            where: { id: allocId },
            data: { reason: 'hack' },
          });
        }),
      ).rejects.toThrow();

      await expect(
        app.$transaction(async (tx) => {
          await tx.$executeRaw`SELECT set_config('app.current_tenant_id', ${tenantB}, true)`;
          await tx.$executeRaw`SELECT set_config('app.platform_rls_bypass', 'false', true)`;
          return tx.commissionPackageSessionAllocation.delete({ where: { id: allocId } });
        }),
      ).rejects.toThrow();
    } finally {
      await app.$disconnect();
      await admin.$disconnect();
    }
  });

  // ── R5-BIND two-way provenance ─────────────────────────────────────────────

  it('R5-BIND-T1 line.appointmentId set, performance.appointmentId null → reject', async () => {
    const performanceId = await createCompletedPerformance({ appointmentId: null });
    const { lineId } = await createInvoiceViaProductionPath(null, { appointmentId });
    await expect(
      binder().bindInvoiceLine({
        invoiceLineId: lineId,
        servicePerformanceId: performanceId,
        actor: { actorId, actorRoles: ['owner'] },
      }),
    ).rejects.toThrow(/appointmentId/i);
  });

  it('R5-BIND-T2 line.snapshotRevisionId set, performance snapshot null → reject', async () => {
    const snapId = randomUUID();
    await wrapper.withPlatformBypass(async (c) => {
      await c.appointmentServiceSnapshotRevision.create({
        data: {
          id: snapId,
          tenantId,
          appointmentId,
          revisionNumber: 1,
          stableKey: `r5.snap.${snapId.slice(0, 8)}`,
          displayNameAr: 's',
          displayNameEn: 's',
          quantity: 1,
          unitPrice: 1000,
          lineBasisAmount: 1000,
          currency: 'SYP',
          clinicalServiceId,
          actorId,
        },
      });
    });
    const performanceId = await createCompletedPerformance({ snapshotRevisionId: null });
    const { lineId } = await createInvoiceViaProductionPath(null, {
      appointmentId,
      clinicalServiceId,
      snapshotRevisionId: snapId,
    });
    await expect(
      binder().bindInvoiceLine({
        invoiceLineId: lineId,
        servicePerformanceId: performanceId,
        actor: { actorId, actorRoles: ['owner'] },
      }),
    ).rejects.toThrow(/snapshotRevisionId/i);
  });

  it('R5-BIND-T3 line.clinicalServiceId set, performance service unprovable/mismatch → reject', async () => {
    const otherSvc = randomUUID();
    await wrapper.withPlatformBypass(async (c) => {
      await c.canonicalClinicalServiceDefinition.create({
        data: {
          id: otherSvc,
          tenantId,
          provenance: 'TENANT_CUSTOM',
          stableKey: `tenant.${tenantId}.custom.other-${otherSvc.slice(0, 8)}`,
          domain: 'GENERAL',
          lifecycle: 'PUBLISHED',
        },
      });
    });
    // SP.clinicalServiceId is non-null in schema — unprovable = mismatch vs line authority.
    const performanceId = await createCompletedPerformance({ clinicalServiceId: otherSvc });
    const { lineId } = await createInvoiceViaProductionPath(null);
    await expect(
      binder().bindInvoiceLine({
        invoiceLineId: lineId,
        servicePerformanceId: performanceId,
        actor: { actorId, actorRoles: ['owner'] },
      }),
    ).rejects.toThrow(/clinicalServiceId/i);
  });

  it('R5-BIND-T4 line.courseSessionId set, performance course session unprovable → reject', async () => {
    const { sessionId } = await seedCourseSession();
    const performanceId = await createCompletedPerformance({ appointmentId: null });
    const { lineId } = await createInvoiceViaProductionPath(null, {
      courseSessionId: sessionId,
      appointmentId: null,
      clinicalServiceId,
    });
    await expect(
      binder().bindInvoiceLine({
        invoiceLineId: lineId,
        servicePerformanceId: performanceId,
        actor: { actorId, actorRoles: ['owner'] },
      }),
    ).rejects.toThrow(/courseSession|appointmentId/i);
  });

  it('R5-BIND-T5 same patient+branch+service wrong appointment → reject', async () => {
    const apptB = randomUUID();
    await wrapper.withPlatformBypass(async (c) => {
      await c.appointment.create({
        data: {
          id: apptB,
          tenantId,
          branchId,
          patientId,
          providerId: actorId,
          scheduledStart: new Date('2026-09-11T10:00:00.000Z'),
          scheduledEnd: new Date('2026-09-11T11:00:00.000Z'),
          status: 'CONFIRMED',
          clinicalServiceId,
        },
      });
    });
    const wrong = await createCompletedPerformance({ appointmentId: apptB });
    const { lineId } = await createInvoiceViaProductionPath(null, { appointmentId });
    await expect(
      binder().bindInvoiceLine({
        invoiceLineId: lineId,
        servicePerformanceId: wrong,
        actor: { actorId, actorRoles: ['owner'] },
      }),
    ).rejects.toThrow(/appointmentId/i);
  });

  it('R5-BIND-T6/T7/T8 matching provenance succeeds; rebind blocked; reject zero side effects', async () => {
    const performanceId = await createCompletedPerformance();
    const { lineId } = await createInvoiceViaProductionPath(null);
    await binder().bindInvoiceLine({
      invoiceLineId: lineId,
      servicePerformanceId: performanceId,
      actor: { actorId, actorRoles: ['owner'] },
    });
    const other = await createCompletedPerformance();
    await expect(
      binder().bindInvoiceLine({
        invoiceLineId: lineId,
        servicePerformanceId: other,
        actor: { actorId, actorRoles: ['owner'] },
      }),
    ).rejects.toThrow(/reassignment|already bound/i);

    const unbound = await createInvoiceViaProductionPath(null, {
      appointmentId: null,
      clinicalServiceId: null,
    });
    const before = await wrapper.withPlatformBypass((c) =>
      c.invoiceLineItem.findUnique({ where: { id: unbound.lineId } }),
    );
    await expect(
      binder().bindInvoiceLine({
        invoiceLineId: unbound.lineId,
        servicePerformanceId: performanceId,
        actor: { actorId, actorRoles: ['owner'] },
      }),
    ).rejects.toThrow();
    const after = await wrapper.withPlatformBypass((c) =>
      c.invoiceLineItem.findUnique({ where: { id: unbound.lineId } }),
    );
    expect(after?.servicePerformanceId).toBeNull();
    expect(after?.servicePerformanceId).toBe(before?.servicePerformanceId);
  });

  // ── R5-CSVC clinical service tenant integrity ──────────────────────────────

  it('R5-CSVC-T1/T2/T3 SYSTEM_CANONICAL + same-tenant custom ok; cross-tenant reject', async () => {
    const globalSvc = randomUUID();
    const otherTenant = randomUUID();
    const otherSvc = randomUUID();
    await wrapper.withPlatformBypass(async (c) => {
      await c.canonicalClinicalServiceDefinition.create({
        data: {
          id: globalSvc,
          tenantId: null,
          provenance: 'SYSTEM_CANONICAL',
          stableKey: `canonical.general.r5-${globalSvc.slice(0, 8)}`,
          domain: 'GENERAL',
          lifecycle: 'PUBLISHED',
        },
      });
      await c.tenant.create({
        data: { id: otherTenant, name: 'OX', slug: `ox-${otherTenant.slice(0, 8)}` },
      });
      await c.canonicalClinicalServiceDefinition.create({
        data: {
          id: otherSvc,
          tenantId: otherTenant,
          provenance: 'TENANT_CUSTOM',
          stableKey: `tenant.${otherTenant}.custom.ox`,
          domain: 'GENERAL',
          lifecycle: 'PUBLISHED',
        },
      });
    });

    const okGlobal = await createInvoiceViaProductionPath(null, { clinicalServiceId: globalSvc });
    expect(okGlobal.lineId).toBeTruthy();
    const okSame = await createInvoiceViaProductionPath(null, {
      clinicalServiceId,
    });
    expect(okSame.lineId).toBeTruthy();

    await expect(
      createInvoiceViaProductionPath(null, { clinicalServiceId: otherSvc }),
    ).rejects.toThrow(/ownership mismatch|23514|clinicalServiceId/i);
  });

  it('R5-CSVC-T4/T5 parent-switch to cross-tenant custom rejected; original unchanged', async () => {
    const otherTenant = randomUUID();
    const otherSvc = randomUUID();
    await wrapper.withPlatformBypass(async (c) => {
      await c.tenant.create({
        data: { id: otherTenant, name: 'OY', slug: `oy-${otherTenant.slice(0, 8)}` },
      });
      await c.canonicalClinicalServiceDefinition.create({
        data: {
          id: otherSvc,
          tenantId: otherTenant,
          provenance: 'TENANT_CUSTOM',
          stableKey: `tenant.${otherTenant}.custom.oy`,
          domain: 'GENERAL',
          lifecycle: 'PUBLISHED',
        },
      });
    });
    const { lineId } = await createInvoiceViaProductionPath(null);
    await expect(
      wrapper.withPlatformBypass(async (c) =>
        c.invoiceLineItem.update({
          where: { id: lineId },
          data: { clinicalServiceId: otherSvc },
        }),
      ),
    ).rejects.toThrow(/ownership mismatch|23514/i);
    const line = await wrapper.withPlatformBypass((c) =>
      c.invoiceLineItem.findUnique({ where: { id: lineId } }),
    );
    expect(line?.clinicalServiceId).toBe(clinicalServiceId);
  });

  it('R5-CSVC-T6 app-role path remains valid for same-tenant custom', async () => {
    assertSafePlatformTestDatabaseUrl(ADMIN_URL);
    const app = new PrismaClient({ datasources: { db: { url: APP_URL } } });
    await app.$connect();
    try {
      const { invoiceId, lineId } = await createInvoiceViaProductionPath(null);
      const visible = await app.$transaction(async (tx) => {
        await tx.$executeRaw`SELECT set_config('app.current_tenant_id', ${tenantId}, true)`;
        await tx.$executeRaw`SELECT set_config('app.platform_rls_bypass', 'false', true)`;
        return tx.invoiceLineItem.findMany({ where: { id: lineId, invoiceId } });
      });
      expect(visible).toHaveLength(1);
      expect(visible[0]?.clinicalServiceId).toBe(clinicalServiceId);
    } finally {
      await app.$disconnect();
    }
  });

  // ── R5-PKG-CORR package + correction ───────────────────────────────────────

  it('R5-PKGC-T1..T10 package correction reuses allocation; cap unchanged; refund current source', async () => {
    await enableAndPublishPlan();
    const { courseId, sessionId } = await seedCourseSession({ unitPrice: '5000.00' });
    const performanceId = await createCompletedPerformance();
    const { invoiceId, lineId } = await createInvoiceViaProductionPath(performanceId, {
      amount: '5000.00',
      courseSessionId: sessionId,
    });
    const alloc = await packages().registerSessionAllocation({
      treatmentCourseId: courseId,
      courseSessionId: sessionId,
      servicePerformanceId: performanceId,
      allocatedRevenueAmount: '1000.00',
      invoiceLineId: lineId,
      actor: { actorId, actorRoles: ['owner'] },
      idempotencyKey: `r5-pkgc-${sessionId}`,
    });
    const posted = await accruals().postFromServicePerformance({
      servicePerformanceId: performanceId,
      invoiceLineId: lineId,
      actor: actorId,
      actorRoles: ['owner'],
    });
    const original = posted.accruals[0] as {
      id: string;
      packageAllocationId: string | null;
      commissionAmount: Prisma.Decimal;
    };
    expect(original.packageAllocationId).toBe(alloc.allocation.id);

    const replacement = await createInvoiceViaProductionPath(null, {
      amount: '800.00',
      courseSessionId: sessionId,
    });
    const correctionEventId = randomUUID();
    const corrected = await accruals().correctAndRepost({
      accrualId: original.id,
      correctionEventId,
      replacementInvoiceLineId: replacement.lineId,
      reason: 'R5 package correction',
      actor: actorId,
      actorRoles: ['owner'],
    });
    const repost = (corrected.repost as { accruals: Array<{
      id: string;
      packageAllocationId: string | null;
      invoiceLineId: string;
      attributedRevenueAmount: Prisma.Decimal;
    }> }).accruals[0];
    expect(repost.packageAllocationId).toBe(alloc.allocation.id);
    expect(repost.invoiceLineId).toBe(replacement.lineId);
    expect(repost.attributedRevenueAmount.toFixed(2)).toBe('1000.00');

    const stale = await wrapper.withPlatformBypass((c) =>
      c.invoiceLineItem.findUnique({ where: { id: lineId } }),
    );
    expect(stale?.performanceBindingStatus).toBe('SUPERSEDED');

    const allocCount = await wrapper.withPlatformBypass((c) =>
      c.commissionPackageSessionAllocation.count({ where: { tenantId, treatmentCourseId: courseId } }),
    );
    expect(allocCount).toBe(1);
    const sum = await wrapper.withPlatformBypass(async (c) => {
      const rows = await c.commissionPackageSessionAllocation.findMany({
        where: { tenantId, treatmentCourseId: courseId },
      });
      return rows.reduce((acc, r) => acc.add(r.allocatedRevenueAmount), new Prisma.Decimal(0));
    });
    expect(sum.toFixed(2)).toBe('1000.00');

    const replay = await accruals().correctAndRepost({
      accrualId: original.id,
      correctionEventId,
      replacementInvoiceLineId: replacement.lineId,
      reason: 'R5 package correction',
      actor: actorId,
      actorRoles: ['owner'],
    });
    expect(replay.idempotent).toBe(true);

    // Failed replacement rolls back: DRAFT invoice
    const appt2 = randomUUID();
    await wrapper.withPlatformBypass(async (c) => {
      await c.appointment.create({
        data: {
          id: appt2,
          tenantId,
          branchId,
          patientId,
          providerId: actorId,
          scheduledStart: new Date('2026-09-12T10:00:00.000Z'),
          scheduledEnd: new Date('2026-09-12T11:00:00.000Z'),
          status: 'CONFIRMED',
          clinicalServiceId,
        },
      });
    });
    const course2 = await seedCourseSession({
      appointmentId: appt2,
      unitPrice: '5000.00',
    });
    const perf2 = await createCompletedPerformance({
      appointmentId: appt2,
      performedAt: new Date('2026-09-12T10:30:00.000Z'),
    });
    const inv2 = await createInvoiceViaProductionPath(perf2, {
      courseSessionId: course2.sessionId,
      appointmentId: appt2,
    });
    await packages().registerSessionAllocation({
      treatmentCourseId: course2.courseId,
      courseSessionId: course2.sessionId,
      servicePerformanceId: perf2,
      allocatedRevenueAmount: '1000.00',
      invoiceLineId: inv2.lineId,
      actor: { actorId, actorRoles: ['owner'] },
      idempotencyKey: `r5-pkgc2-${course2.sessionId}`,
    });
    const posted2 = await accruals().postFromServicePerformance({
      servicePerformanceId: perf2,
      invoiceLineId: inv2.lineId,
      actor: actorId,
      actorRoles: ['owner'],
    });
    const badReplacement = await createInvoiceViaProductionPath(null, {
      courseSessionId: course2.sessionId,
      appointmentId: appt2,
    });
    await wrapper.withPlatformBypass(async (c) => {
      await c.invoice.update({
        where: { id: badReplacement.invoiceId },
        data: { status: 'DRAFT' },
      });
    });
    const beforeCount = await wrapper.withPlatformBypass((c) =>
      c.commissionAccrual.count({ where: { tenantId, servicePerformanceId: perf2 } }),
    );
    await expect(
      accruals().correctAndRepost({
        accrualId: (posted2.accruals[0] as { id: string }).id,
        correctionEventId: randomUUID(),
        replacementInvoiceLineId: badReplacement.lineId,
        reason: 'should roll back',
        actor: actorId,
        actorRoles: ['owner'],
      }),
    ).rejects.toThrow(/not finalized/i);
    const afterCount = await wrapper.withPlatformBypass((c) =>
      c.commissionAccrual.count({ where: { tenantId, servicePerformanceId: perf2 } }),
    );
    expect(afterCount).toBe(beforeCount);

    // Refund after correction against current economic source (replacement accrual)
    await createPayment(replacement.invoiceId, '1000.00');
    const refundId = await createRefund(replacement.invoiceId, '500.00');
    await accruals().reverseAccrual({
      accrualId: repost.id,
      refundId,
      actor: actorId,
      actorRoles: ['owner'],
    });
    const rem = await wrapper.withPlatformBypass(async (c) => {
      return c.commissionAccrual.findMany({
        where: { tenantId, reversalOfAccrualId: repost.id },
      });
    });
    expect(rem.length).toBeGreaterThanOrEqual(1);
    void invoiceId;
  });
});
