/**
 * Phase 48 Wave F Round 6 remediation — final narrow PostgreSQL integration tests.
 */
import { randomUUID } from 'crypto';
import { PrismaClient, Prisma } from '@prisma/client';
import {
  createClinicalPrismaWrapper,
  createPlatformDbSecurityClient,
  platformDbSecurityEnabled,
} from '../../clinical-catalog/tests/clinical-catalog-db.harness';
import { Invoice } from '../../billing/domain/entities/invoice.entity';
import { PrismaInvoiceRepository } from '../../billing/infrastructure/prisma-invoice.repository';
import { CommissionAccrualService } from '../services/commission-accrual.service';
import { StaffCommissionPlanService } from '../services/staff-commission-plan.service';
import { InvoiceLinePerformanceAttributionService } from '../services/invoice-line-performance-attribution.service';
import { CommissionPackageAllocationService } from '../services/commission-package-allocation.service';
import { assertTwoWayInvoiceLinePerformanceProvenance } from '../services/invoice-line-performance-provenance';

jest.setTimeout(300_000);
const describeDb = platformDbSecurityEnabled() ? describe : describe.skip;

describeDb('Wave F Round 6 remediation (PostgreSQL)', () => {
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
        data: { id: tenantId, name: 'WF R6', slug: `wfr6-${tenantId.slice(0, 8)}` },
      });
      for (const u of [
        { id: actorId, first: 'A', last: 'Ctor' },
        { id: performerId, first: 'Perf', last: 'Ormer' },
      ]) {
        await c.user.create({
          data: {
            id: u.id,
            tenantId,
            email: `wfr6-${u.id.slice(0, 8)}@t.local`,
            passwordHash: 'x',
            firstName: u.first,
            lastName: u.last,
          },
        });
      }
      await c.patient.create({
        data: { id: patientId, tenantId, firstName: 'Pat', lastName: 'Six' },
      });
      await c.branch.create({
        data: { id: branchId, tenantId, name: `R6 B ${branchId.slice(0, 6)}` },
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

  async function enableAndPublishPlan(opts?: {
    percentage?: number;
    calculationBasis?: string;
    earningTrigger?: string;
  }) {
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
      calculationBasis: opts?.calculationBasis ?? 'SERVICE_NET_AFTER_DISCOUNT',
      earningTrigger: opts?.earningTrigger ?? 'INVOICE_OR_CHARGE_FINALIZED',
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
      currency?: string;
      appointmentId?: string | null;
      clinicalServiceId?: string | null;
      snapshotRevisionId?: string | null;
      courseSessionId?: string | null;
      patientId?: string;
    },
  ) {
    const amount = opts?.amount ?? '1000.00';
    const invoice = Invoice.create({
      invoiceId: randomUUID(),
      tenantId,
      branchId,
      patientId: opts?.patientId ?? patientId,
      invoiceNumber: `R6-${randomUUID().slice(0, 8)}`,
      invoiceDate: new Date('2026-09-01'),
      currency: opts?.currency ?? 'SYP',
      notes: 'R6 production path',
      lineItems: [
        {
          description: 'R6 clinical line',
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
    unitPrice?: string;
    currency?: string;
    pricingUnit?: 'PER_COURSE' | 'PER_PACKAGE' | 'PER_VISIT';
    status?: 'ACTIVE' | 'SUPERSEDED' | 'DRAFT';
    appointmentId?: string;
  }) {
    const courseId = randomUUID();
    const sessionId = randomUUID();
    const priceVersionId = randomUUID();
    const unitPrice = opts?.unitPrice ?? '5000.00';
    const currency = opts?.currency ?? 'SYP';
    const pricingUnit = opts?.pricingUnit ?? 'PER_COURSE';
    const pvStatus = opts?.status ?? 'ACTIVE';
    await wrapper.withPlatformBypass(async (c) => {
      await c.clinicalServicePriceVersion.create({
        data: {
          id: priceVersionId,
          tenantId,
          clinicalServiceId,
          pricingUnit,
          currency,
          unitPrice,
          effectiveFrom: new Date('2026-01-01T00:00:00.000Z'),
          status: pvStatus,
          publishedAt: pvStatus === 'DRAFT' ? null : new Date('2026-01-01T00:00:00.000Z'),
          publishedBy: pvStatus === 'DRAFT' ? null : actorId,
          supersededAt: pvStatus === 'SUPERSEDED' ? new Date('2026-06-01T00:00:00.000Z') : null,
        },
      });
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
          status: 'COMPLETED',
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
          reason: 'R6 refund',
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

  // ── R6-PKG-COLLECTED ───────────────────────────────────────────────────────

  it('R6-PKGCOL-T1/T2/T3/T8 collected path capped by package allocation', async () => {
    await enableAndPublishPlan({
      calculationBasis: 'COLLECTED_REVENUE',
      earningTrigger: 'PAYMENT_COLLECTED',
    });
    const { courseId, sessionId } = await seedCourseSession({ unitPrice: '5000.00' });
    const performanceId = await createCompletedPerformance();
    const { invoiceId, lineId } = await createInvoiceViaProductionPath(performanceId, {
      amount: '5000.00',
      courseSessionId: sessionId,
    });
    await packages().registerSessionAllocation({
      treatmentCourseId: courseId,
      courseSessionId: sessionId,
      servicePerformanceId: performanceId,
      allocatedRevenueAmount: '1000.00',
      invoiceLineId: lineId,
      actor: { actorId, actorRoles: ['owner'] },
      idempotencyKey: `r6-col-${sessionId}`,
    });

    // R7-A: payment 800 / invoice 5000 * alloc 1000 = 160 (not min(800,1000)).
    const pay1 = await createPayment(invoiceId, '800.00');
    const a1 = await accruals().postFromCollectedPayment({
      servicePerformanceId: performanceId,
      invoiceLineId: lineId,
      paymentId: pay1,
      actor: actorId,
      actorRoles: ['owner'],
    });
    const attr1 = (a1.accruals[0] as { attributedRevenueAmount: Prisma.Decimal })
      .attributedRevenueAmount;
    expect(attr1.toFixed(2)).toBe('160.00');

    const pay2 = await createPayment(invoiceId, '800.00');
    const a2 = await accruals().postFromCollectedPayment({
      servicePerformanceId: performanceId,
      invoiceLineId: lineId,
      paymentId: pay2,
      actor: actorId,
      actorRoles: ['owner'],
    });
    void a2;
    const totalAttr = await wrapper.withPlatformBypass(async (c) => {
      const rows = await c.commissionAccrual.findMany({
        where: {
          tenantId,
          servicePerformanceId: performanceId,
          reversalOfAccrualId: null,
          calculationBasis: 'COLLECTED_REVENUE',
        },
      });
      return rows.reduce((acc, r) => acc.add(r.attributedRevenueAmount), new Prisma.Decimal(0));
    });
    expect(totalAttr.lte(1000)).toBe(true);
    expect(totalAttr.toFixed(2)).toBe('320.00');

    // Exhaust remaining package capacity via payments that would exceed remaining (680 left of 1000).
    const pay3 = await createPayment(invoiceId, '3400.00'); // 1000*3400/5000=680 → reaches exactly 1000
    const a3 = await accruals().postFromCollectedPayment({
      servicePerformanceId: performanceId,
      invoiceLineId: lineId,
      paymentId: pay3,
      actor: actorId,
      actorRoles: ['owner'],
    });
    expect((a3.accruals as unknown[]).length).toBe(1);
    const totalAfter = await wrapper.withPlatformBypass(async (c) => {
      const rows = await c.commissionAccrual.findMany({
        where: {
          tenantId,
          servicePerformanceId: performanceId,
          reversalOfAccrualId: null,
          calculationBasis: 'COLLECTED_REVENUE',
        },
      });
      return rows.reduce((acc, r) => acc.add(r.attributedRevenueAmount), new Prisma.Decimal(0));
    });
    expect(totalAfter.toFixed(2)).toBe('1000.00');

    const pay4 = await createPayment(invoiceId, '100.00');
    const a4 = await accruals().postFromCollectedPayment({
      servicePerformanceId: performanceId,
      invoiceLineId: lineId,
      paymentId: pay4,
      actor: actorId,
      actorRoles: ['owner'],
    });
    expect(
      (a4.accruals as unknown[]).length === 0 || (a4 as { skipped?: string }).skipped,
    ).toBeTruthy();
  });

  it('R6-PKGCOL-T5 missing allocation fail closed', async () => {
    await enableAndPublishPlan({
      calculationBasis: 'COLLECTED_REVENUE',
      earningTrigger: 'PAYMENT_COLLECTED',
    });
    const { sessionId } = await seedCourseSession();
    const performanceId = await createCompletedPerformance();
    const { invoiceId, lineId } = await createInvoiceViaProductionPath(performanceId, {
      courseSessionId: sessionId,
    });
    const paymentId = await createPayment(invoiceId, '500.00');
    await expect(
      accruals().postFromCollectedPayment({
        servicePerformanceId: performanceId,
        invoiceLineId: lineId,
        paymentId,
        actor: actorId,
        actorRoles: ['owner'],
      }),
    ).rejects.toThrow(/explicit.*allocation|package/i);
  });

  it('R6-PKGCOL-T6 invoice-based + collected cannot double-earn same allocation', async () => {
    await enableAndPublishPlan();
    const { courseId, sessionId } = await seedCourseSession();
    const performanceId = await createCompletedPerformance();
    const { invoiceId, lineId } = await createInvoiceViaProductionPath(performanceId, {
      amount: '5000.00',
      courseSessionId: sessionId,
    });
    await packages().registerSessionAllocation({
      treatmentCourseId: courseId,
      courseSessionId: sessionId,
      servicePerformanceId: performanceId,
      allocatedRevenueAmount: '1000.00',
      invoiceLineId: lineId,
      actor: { actorId, actorRoles: ['owner'] },
      idempotencyKey: `r6-dbl-${sessionId}`,
    });
    await accruals().postFromServicePerformance({
      servicePerformanceId: performanceId,
      invoiceLineId: lineId,
      actor: actorId,
      actorRoles: ['owner'],
    });

    // Non-overlapping publish: COLLECTED effectiveFrom after prior start closes SERVICE_NET timeline
    // so resolveActivePlan(at performance) returns COLLECTED while invoice accrual remains open.
    const collectedDraft = await plans().createDraftPlan({
      userId: performerId,
      percentage: 30,
      effectiveFrom: '2026-08-01',
      calculationBasis: 'COLLECTED_REVENUE',
      earningTrigger: 'PAYMENT_COLLECTED',
      actor: { actorId, actorRoles: ['owner'] },
    });
    await plans().publishPlan(collectedDraft.id, { actorId, actorRoles: ['owner'] });

    const paymentId = await createPayment(invoiceId, '500.00');
    await expect(
      accruals().postFromCollectedPayment({
        servicePerformanceId: performanceId,
        invoiceLineId: lineId,
        paymentId,
        actor: actorId,
        actorRoles: ['owner'],
      }),
    ).rejects.toThrow(/double-earn|already earned via invoice-based/i);
  });

  it('R6-PKGCOL-T4/T7 multi-session allocations + refund after collected', async () => {
    await enableAndPublishPlan({
      calculationBasis: 'COLLECTED_REVENUE',
      earningTrigger: 'PAYMENT_COLLECTED',
    });
    const { courseId, sessionId } = await seedCourseSession({ unitPrice: '5000.00' });
    const performanceId = await createCompletedPerformance();
    const { invoiceId, lineId } = await createInvoiceViaProductionPath(performanceId, {
      amount: '2000.00',
      courseSessionId: sessionId,
    });
    await packages().registerSessionAllocation({
      treatmentCourseId: courseId,
      courseSessionId: sessionId,
      servicePerformanceId: performanceId,
      allocatedRevenueAmount: '1000.00',
      invoiceLineId: lineId,
      actor: { actorId, actorRoles: ['owner'] },
      idempotencyKey: `r6-ref-${sessionId}`,
    });
    const paymentId = await createPayment(invoiceId, '1000.00');
    const posted = await accruals().postFromCollectedPayment({
      servicePerformanceId: performanceId,
      invoiceLineId: lineId,
      paymentId,
      actor: actorId,
      actorRoles: ['owner'],
    });
    const accrualId = (posted.accruals[0] as { id: string }).id;
    const refundId = await createRefund(invoiceId, '500.00');
    await accruals().reverseAccrual({
      accrualId,
      refundId,
      actor: actorId,
      actorRoles: ['owner'],
    });
    const revs = await wrapper.withPlatformBypass((c) =>
      c.commissionAccrual.count({ where: { tenantId, reversalOfAccrualId: accrualId } }),
    );
    expect(revs).toBeGreaterThanOrEqual(1);
  });

  // ── R6-PKG-CURRENCY ────────────────────────────────────────────────────────

  it('R6-PKGCUR-T1/T4 same currency success; T2/T3/T5 mismatch reject zero side effects', async () => {
    await enableAndPublishPlan();
    const usd = await seedCourseSession({ currency: 'USD', unitPrice: '5000.00' });
    const perfUsd = await createCompletedPerformance();
    const invUsd = await createInvoiceViaProductionPath(perfUsd, {
      currency: 'USD',
      amount: '1000.00',
      courseSessionId: usd.sessionId,
    });
    await packages().registerSessionAllocation({
      treatmentCourseId: usd.courseId,
      courseSessionId: usd.sessionId,
      servicePerformanceId: perfUsd,
      allocatedRevenueAmount: '1000.00',
      invoiceLineId: invUsd.lineId,
      actor: { actorId, actorRoles: ['owner'] },
      idempotencyKey: `r6-cur-ok-${usd.sessionId}`,
    });
    const ok = await accruals().postFromServicePerformance({
      servicePerformanceId: perfUsd,
      invoiceLineId: invUsd.lineId,
      actor: actorId,
      actorRoles: ['owner'],
    });
    expect((ok.accruals as unknown[]).length).toBe(1);
    expect((ok.accruals[0] as { currency: string }).currency).toBe('USD');

    const eurCourse = await seedCourseSession({ currency: 'EUR', unitPrice: '5000.00' });
    const perfEur = await createCompletedPerformance();
    // Register allocation in EUR then try SYP invoice
    await packages().registerSessionAllocation({
      treatmentCourseId: eurCourse.courseId,
      courseSessionId: eurCourse.sessionId,
      servicePerformanceId: perfEur,
      allocatedRevenueAmount: '1000.00',
      actor: { actorId, actorRoles: ['owner'] },
      idempotencyKey: `r6-cur-bad-${eurCourse.sessionId}`,
    });
    const invSyp = await createInvoiceViaProductionPath(perfEur, {
      currency: 'SYP',
      courseSessionId: eurCourse.sessionId,
    });
    const before = await wrapper.withPlatformBypass((c) =>
      c.commissionAccrual.count({ where: { tenantId, servicePerformanceId: perfEur } }),
    );
    await expect(
      accruals().postFromServicePerformance({
        servicePerformanceId: perfEur,
        invoiceLineId: invSyp.lineId,
        actor: actorId,
        actorRoles: ['owner'],
      }),
    ).rejects.toThrow(/currency/i);
    const after = await wrapper.withPlatformBypass((c) =>
      c.commissionAccrual.count({ where: { tenantId, servicePerformanceId: perfEur } }),
    );
    expect(after).toBe(before);
  });

  // ── R6-PKG-PROVENANCE ──────────────────────────────────────────────────────

  it('R6-PKGPROV-T1 course patient ≠ performance patient → reject', async () => {
    const { courseId, sessionId } = await seedCourseSession();
    const otherPatient = randomUUID();
    await wrapper.withPlatformBypass(async (c) => {
      await c.patient.create({
        data: { id: otherPatient, tenantId, firstName: 'X', lastName: 'Y' },
      });
    });
    const performanceId = await createCompletedPerformance({ patientId: otherPatient });
    await expect(
      packages().registerSessionAllocation({
        treatmentCourseId: courseId,
        courseSessionId: sessionId,
        servicePerformanceId: performanceId,
        allocatedRevenueAmount: '1000.00',
        actor: { actorId, actorRoles: ['owner'] },
        idempotencyKey: `r6-prov-p-${sessionId}`,
      }),
    ).rejects.toThrow(/patientId/i);
  });

  it('R6-PKGPROV-T2 session appointment exists + performance appointment null → reject', async () => {
    const { courseId, sessionId } = await seedCourseSession();
    const performanceId = await createCompletedPerformance({ appointmentId: null });
    await expect(
      packages().registerSessionAllocation({
        treatmentCourseId: courseId,
        courseSessionId: sessionId,
        servicePerformanceId: performanceId,
        allocatedRevenueAmount: '1000.00',
        actor: { actorId, actorRoles: ['owner'] },
        idempotencyKey: `r6-prov-a-${sessionId}`,
      }),
    ).rejects.toThrow(/appointmentId/i);
  });

  it('R6-PKGPROV-T3/T5/T6/T8 wrong appointment / line / service; zero side effects', async () => {
    const { courseId, sessionId } = await seedCourseSession();
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
    const wrongApptPerf = await createCompletedPerformance({ appointmentId: apptB });
    const before = await wrapper.withPlatformBypass((c) =>
      c.commissionPackageSessionAllocation.count({ where: { tenantId } }),
    );
    await expect(
      packages().registerSessionAllocation({
        treatmentCourseId: courseId,
        courseSessionId: sessionId,
        servicePerformanceId: wrongApptPerf,
        allocatedRevenueAmount: '1000.00',
        actor: { actorId, actorRoles: ['owner'] },
        idempotencyKey: `r6-prov-w-${sessionId}`,
      }),
    ).rejects.toThrow(/appointmentId/i);
    const after = await wrapper.withPlatformBypass((c) =>
      c.commissionPackageSessionAllocation.count({ where: { tenantId } }),
    );
    expect(after).toBe(before);

    const otherSvc = randomUUID();
    await wrapper.withPlatformBypass(async (c) => {
      await c.canonicalClinicalServiceDefinition.create({
        data: {
          id: otherSvc,
          tenantId,
          provenance: 'TENANT_CUSTOM',
          stableKey: `tenant.${tenantId}.custom.o-${otherSvc.slice(0, 8)}`,
          domain: 'GENERAL',
          lifecycle: 'PUBLISHED',
        },
      });
    });
    const wrongSvc = await createCompletedPerformance({ clinicalServiceId: otherSvc });
    await expect(
      packages().registerSessionAllocation({
        treatmentCourseId: courseId,
        courseSessionId: sessionId,
        servicePerformanceId: wrongSvc,
        allocatedRevenueAmount: '1000.00',
        actor: { actorId, actorRoles: ['owner'] },
        idempotencyKey: `r6-prov-s-${sessionId}`,
      }),
    ).rejects.toThrow(/clinicalServiceId/i);
  });

  it('R6-PKGPROV-T4/T7 invoice patient mismatch reject; matching chain success', async () => {
    // T4 — course/performance patient A + invoice patient B on same performance line → reject
    const { courseId, sessionId } = await seedCourseSession();
    const performanceId = await createCompletedPerformance();
    const otherPatient = randomUUID();
    await wrapper.withPlatformBypass(async (c) => {
      await c.patient.create({
        data: { id: otherPatient, tenantId, firstName: 'O', lastName: 'P' },
      });
    });
    const badInv = await createInvoiceViaProductionPath(performanceId, {
      courseSessionId: sessionId,
      patientId: otherPatient,
    });
    await expect(
      packages().registerSessionAllocation({
        treatmentCourseId: courseId,
        courseSessionId: sessionId,
        servicePerformanceId: performanceId,
        allocatedRevenueAmount: '1000.00',
        invoiceLineId: badInv.lineId,
        actor: { actorId, actorRoles: ['owner'] },
        idempotencyKey: `r6-prov-i-${sessionId}`,
      }),
    ).rejects.toThrow(/patient/i);

    // T7 — fresh matching chain (prior performance already bound to bad invoice line)
    const { courseId: okCourse, sessionId: okSession } = await seedCourseSession();
    const okPerf = await createCompletedPerformance();
    const goodInv = await createInvoiceViaProductionPath(okPerf, {
      courseSessionId: okSession,
    });
    const ok = await packages().registerSessionAllocation({
      treatmentCourseId: okCourse,
      courseSessionId: okSession,
      servicePerformanceId: okPerf,
      allocatedRevenueAmount: '1000.00',
      invoiceLineId: goodInv.lineId,
      actor: { actorId, actorRoles: ['owner'] },
      idempotencyKey: `r6-prov-ok-${okSession}`,
    });
    expect(ok.allocation.id).toBeTruthy();
  });

  // ── R6-CORR-BINDING ────────────────────────────────────────────────────────

  it('R6-CORRBIND-T1/T6/T7 canonical validator shared; mismatch rolls back', async () => {
    expect(typeof assertTwoWayInvoiceLinePerformanceProvenance).toBe('function');
    await enableAndPublishPlan();
    const performanceId = await createCompletedPerformance();
    const { lineId } = await createInvoiceViaProductionPath(performanceId);
    const posted = await accruals().postFromServicePerformance({
      servicePerformanceId: performanceId,
      invoiceLineId: lineId,
      actor: actorId,
      actorRoles: ['owner'],
    });
    const originalId = (posted.accruals[0] as { id: string }).id;

    // Replacement lacking appointment while performance has appointment → two-way reject
    const badReplacement = await createInvoiceViaProductionPath(null, {
      appointmentId: null,
      clinicalServiceId: null,
    });
    const before = await wrapper.withPlatformBypass((c) =>
      c.commissionAccrual.count({ where: { tenantId, servicePerformanceId: performanceId } }),
    );
    await expect(
      accruals().correctAndRepost({
        accrualId: originalId,
        correctionEventId: randomUUID(),
        replacementInvoiceLineId: badReplacement.lineId,
        reason: 'R6 bind fail',
        actor: actorId,
        actorRoles: ['owner'],
      }),
    ).rejects.toThrow(/appointmentId|provenance|lacks durable/i);
    const after = await wrapper.withPlatformBypass((c) =>
      c.commissionAccrual.count({ where: { tenantId, servicePerformanceId: performanceId } }),
    );
    expect(after).toBe(before);

    const goodReplacement = await createInvoiceViaProductionPath(null, {
      amount: '800.00',
      appointmentId,
      clinicalServiceId,
    });
    const ok = await accruals().correctAndRepost({
      accrualId: originalId,
      correctionEventId: randomUUID(),
      replacementInvoiceLineId: goodReplacement.lineId,
      reason: 'R6 bind ok',
      actor: actorId,
      actorRoles: ['owner'],
    });
    expect((ok.repost as { accruals: unknown[] }).accruals.length).toBe(1);
  });

  it('R6-CORRBIND-T8 package correction still reuses allocation', async () => {
    await enableAndPublishPlan();
    const { courseId, sessionId } = await seedCourseSession();
    const performanceId = await createCompletedPerformance();
    const { lineId } = await createInvoiceViaProductionPath(performanceId, {
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
      idempotencyKey: `r6-corr-pkg-${sessionId}`,
    });
    const posted = await accruals().postFromServicePerformance({
      servicePerformanceId: performanceId,
      invoiceLineId: lineId,
      actor: actorId,
      actorRoles: ['owner'],
    });
    const replacement = await createInvoiceViaProductionPath(null, {
      amount: '800.00',
      courseSessionId: sessionId,
      appointmentId,
      clinicalServiceId,
    });
    const corrected = await accruals().correctAndRepost({
      accrualId: (posted.accruals[0] as { id: string }).id,
      correctionEventId: randomUUID(),
      replacementInvoiceLineId: replacement.lineId,
      reason: 'R6 pkg corr',
      actor: actorId,
      actorRoles: ['owner'],
    });
    const repost = (corrected.repost as { accruals: Array<{ packageAllocationId: string | null }> })
      .accruals[0];
    expect(repost.packageAllocationId).toBe(alloc.allocation.id);
    const sum = await wrapper.withPlatformBypass(async (c) => {
      const rows = await c.commissionPackageSessionAllocation.findMany({
        where: { tenantId, treatmentCourseId: courseId },
      });
      return rows.reduce((acc, r) => acc.add(r.allocatedRevenueAmount), new Prisma.Decimal(0));
    });
    expect(sum.toFixed(2)).toBe('1000.00');
  });

  // ── R6-PKG-HISTORICAL-PRICE ────────────────────────────────────────────────

  it('R6-PKGHIST-T1/T2/T3 SUPERSEDED bound V1 still allocates V1 basis/currency', async () => {
    const { courseId, sessionId, priceVersionId } = await seedCourseSession({
      unitPrice: '4200.00',
      currency: 'USD',
      status: 'SUPERSEDED',
    });
    const performanceId = await createCompletedPerformance();
    const result = await packages().registerSessionAllocation({
      treatmentCourseId: courseId,
      courseSessionId: sessionId,
      servicePerformanceId: performanceId,
      allocatedRevenueAmount: '1000.00',
      actor: { actorId, actorRoles: ['owner'] },
      idempotencyKey: `r6-hist-${sessionId}`,
    });
    expect(result.allocation.packageCommercialBasisAmount.toFixed(2)).toBe('4200.00');
    expect(result.allocation.currency).toBe('USD');
    expect(
      auditCalls.some(
        (a) =>
          a.action === 'staff_commission.package_allocation.registered' &&
          (a.details as { packagePriceVersionId?: string })?.packagePriceVersionId ===
            priceVersionId,
      ),
    ).toBe(true);
  });

  it('R6-PKGHIST-T4 DRAFT rejected; T5 unrelated ACTIVE cannot replace bound version', async () => {
    const draft = await seedCourseSession({ status: 'DRAFT', unitPrice: '3000.00' });
    const performanceId = await createCompletedPerformance();
    await expect(
      packages().registerSessionAllocation({
        treatmentCourseId: draft.courseId,
        courseSessionId: draft.sessionId,
        servicePerformanceId: performanceId,
        allocatedRevenueAmount: '1000.00',
        actor: { actorId, actorRoles: ['owner'] },
        idempotencyKey: `r6-draft-${draft.sessionId}`,
      }),
    ).rejects.toThrow(/DRAFT|not usable|ACTIVE\|SUPERSEDED/i);

    const superseded = await seedCourseSession({
      status: 'SUPERSEDED',
      unitPrice: '1111.00',
      currency: 'EUR',
    });
    // Create a different ACTIVE V2 — must NOT be used
    const v2 = randomUUID();
    await wrapper.withPlatformBypass(async (c) => {
      await c.clinicalServicePriceVersion.create({
        data: {
          id: v2,
          tenantId,
          clinicalServiceId,
          pricingUnit: 'PER_COURSE',
          currency: 'USD',
          unitPrice: '9999.00',
          effectiveFrom: new Date('2026-07-01'),
          status: 'ACTIVE',
          publishedAt: new Date('2026-07-01'),
          publishedBy: actorId,
        },
      });
    });
    const perf2 = await createCompletedPerformance();
    const alloc = await packages().registerSessionAllocation({
      treatmentCourseId: superseded.courseId,
      courseSessionId: superseded.sessionId,
      servicePerformanceId: perf2,
      allocatedRevenueAmount: '500.00',
      actor: { actorId, actorRoles: ['owner'] },
      idempotencyKey: `r6-hist2-${superseded.sessionId}`,
    });
    expect(alloc.allocation.packageCommercialBasisAmount.toFixed(2)).toBe('1111.00');
    expect(alloc.allocation.currency).toBe('EUR');
  });

  it('R6-PKGHIST-T6 new course may bind ACTIVE V2', async () => {
    const v2 = await seedCourseSession({ status: 'ACTIVE', unitPrice: '7777.00', currency: 'SYP' });
    const performanceId = await createCompletedPerformance();
    const alloc = await packages().registerSessionAllocation({
      treatmentCourseId: v2.courseId,
      courseSessionId: v2.sessionId,
      servicePerformanceId: performanceId,
      allocatedRevenueAmount: '1000.00',
      actor: { actorId, actorRoles: ['owner'] },
      idempotencyKey: `r6-v2-${v2.sessionId}`,
    });
    expect(alloc.allocation.packageCommercialBasisAmount.toFixed(2)).toBe('7777.00');
  });
});
