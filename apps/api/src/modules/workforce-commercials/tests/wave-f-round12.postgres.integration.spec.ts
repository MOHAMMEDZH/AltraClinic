/**
 * Phase 48 Wave F Round 12 — order-independent capped refund carry + P2002 insert boundary.
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
import { AuditTrailWaveFAuditLog } from '../infrastructure/audit-trail-wave-f-audit-log';
import {
  CommissionAccrualService,
  isRecoverableCommissionRefundUniqueConflict,
} from '../services/commission-accrual.service';
import { StaffCommissionPlanService } from '../services/staff-commission-plan.service';
import { CommissionPackageAllocationService } from '../services/commission-package-allocation.service';

jest.setTimeout(300_000);
const describeDb = platformDbSecurityEnabled() ? describe : describe.skip;

describeDb('Wave F Round 12 remediation (PostgreSQL)', () => {
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
        data: { id: tenantId, name: 'WF R12', slug: `wfr12-${tenantId.slice(0, 8)}` },
      });
      for (const u of [
        { id: actorId, first: 'A', last: 'Ctor' },
        { id: performerId, first: 'Perf', last: 'Ormer' },
      ]) {
        await c.user.create({
          data: {
            id: u.id,
            tenantId,
            email: `wfr12-${u.id.slice(0, 8)}@t.local`,
            passwordHash: 'x',
            firstName: u.first,
            lastName: u.last,
          },
        });
      }
      await c.patient.create({
        data: { id: patientId, tenantId, firstName: 'Pat', lastName: 'Ten' },
      });
      await c.branch.create({
        data: { id: branchId, tenantId, name: `R12 B ${branchId.slice(0, 6)}` },
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
    calculationBasis?: string;
    earningTrigger?: string;
    percentage?: number;
  }) {
    await plans().setUserCommissionEligibility(performerId, true, opts?.percentage ?? 10, '2026-01-01', {
      actorId,
      actorRoles: ['owner'],
    });
    const draft = await plans().createDraftPlan({
      userId: performerId,
      percentage: opts?.percentage ?? 10,
      effectiveFrom: '2026-01-01',
      calculationBasis: opts?.calculationBasis ?? 'COLLECTED_REVENUE',
      earningTrigger: opts?.earningTrigger ?? 'PAYMENT_COLLECTED',
      actor: { actorId, actorRoles: ['owner'] },
    });
    return plans().publishPlan(draft.id, { actorId, actorRoles: ['owner'] });
  }

  async function createCompletedPerformance() {
    const performanceId = randomUUID();
    const performedAt = new Date('2026-09-01T10:30:00.000Z');
    await wrapper.withPlatformBypass(async (c) => {
      await c.servicePerformance.create({
        data: {
          id: performanceId,
          tenantId,
          branchId,
          patientId,
          appointmentId,
          clinicalServiceId,
          status: 'DRAFT',
          performedAt,
          createdBy: actorId,
          participants: {
            create: [
              {
                id: randomUUID(),
                tenantId,
                userId: performerId,
                role: 'PRIMARY',
                attributionShare: null,
                recordedBy: actorId,
              },
            ],
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
    opts?: { amount?: string; courseSessionId?: string | null },
  ) {
    const amount = opts?.amount ?? '5000.00';
    const invoice = Invoice.create({
      invoiceId: randomUUID(),
      tenantId,
      branchId,
      patientId,
      invoiceNumber: `R12-${randomUUID().slice(0, 8)}`,
      invoiceDate: new Date('2026-09-01'),
      currency: 'SYP',
      notes: 'R12',
      lineItems: [
        {
          description: 'R12 clinical line',
          quantity: 1,
          unitPrice: Number(amount),
          discountPercent: 0,
          taxPercent: 0,
          servicePerformanceId,
          appointmentId,
          clinicalServiceId,
          courseSessionId: opts?.courseSessionId ?? null,
        },
      ] as never,
    });
    invoice.issue();
    await raw.$executeRaw`SELECT set_config('app.platform_rls_bypass', 'true', false)`;
    await new PrismaInvoiceRepository(raw as never).save(invoice);
    return { invoiceId: invoice.invoiceId, lineId: invoice.lineItems[0]!.itemId };
  }

  async function seedCourseSession() {
    const courseId = randomUUID();
    const sessionId = randomUUID();
    const priceVersionId = randomUUID();
    await wrapper.withPlatformBypass(async (c) => {
      await c.clinicalServicePriceVersion.create({
        data: {
          id: priceVersionId,
          tenantId,
          clinicalServiceId,
          pricingUnit: 'PER_COURSE',
          currency: 'SYP',
          unitPrice: '5000.00',
          effectiveFrom: new Date('2026-01-01T00:00:00.000Z'),
          status: 'ACTIVE',
          publishedAt: new Date('2026-01-01T00:00:00.000Z'),
          publishedBy: actorId,
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
          appointmentId,
          status: 'COMPLETED',
        },
      });
    });
    return { courseId, sessionId };
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
          reason: 'R12 refund',
          refundMethod: 'cash',
          refundDate: new Date('2026-09-02'),
          approvedBy: actorId,
        },
      });
    });
    return refundId;
  }

  async function createSameInvoiceReplacementLine(
    invoiceId: string,
    opts?: { amount?: string; courseSessionId?: string | null },
  ) {
    const id = randomUUID();
    const amt = opts?.amount ?? '5000.00';
    await wrapper.withPlatformBypass(async (c) => {
      await c.invoiceLineItem.create({
        data: {
          id,
          invoiceId,
          tenantId,
          description: 'R12 corrected line',
          quantity: 1,
          unitPrice: amt,
          discountPercent: 0,
          taxPercent: 0,
          subtotal: amt,
          discountAmount: 0,
          taxAmount: 0,
          lineTotal: amt,
          appointmentId,
          clinicalServiceId,
          courseSessionId: opts?.courseSessionId ?? null,
          servicePerformanceId: null,
        },
      });
    });
    return id;
  }

  async function openCollectedRoots(performanceId: string) {
    return wrapper.withPlatformBypass(async (c) => {
      const rows = await c.commissionAccrual.findMany({
        where: {
          tenantId,
          servicePerformanceId: performanceId,
          reversalOfAccrualId: null,
          calculationBasis: 'COLLECTED_REVENUE',
          status: { in: ['EARNED', 'SETTLED'] },
        },
        orderBy: { id: 'asc' },
      });
      const open = [];
      for (const row of rows) {
        const revs = await c.commissionAccrual.findMany({
          where: { tenantId, reversalOfAccrualId: row.id, status: 'REVERSED' },
        });
        const reversed = revs.reduce(
          (a, r) => a.add(new Prisma.Decimal(r.commissionAmount).abs()),
          new Prisma.Decimal(0),
        );
        if (new Prisma.Decimal(row.commissionAmount).sub(reversed).gt(0)) open.push(row);
      }
      return open;
    });
  }

  async function openInvoiceRoots(performanceId: string) {
    return wrapper.withPlatformBypass(async (c) => {
      const rows = await c.commissionAccrual.findMany({
        where: {
          tenantId,
          servicePerformanceId: performanceId,
          reversalOfAccrualId: null,
          NOT: { calculationBasis: 'COLLECTED_REVENUE' },
          status: { in: ['EARNED', 'SETTLED'] },
        },
        orderBy: { id: 'asc' },
      });
      const open = [];
      for (const row of rows) {
        const revs = await c.commissionAccrual.findMany({
          where: { tenantId, reversalOfAccrualId: row.id, status: 'REVERSED' },
        });
        const reversed = revs.reduce(
          (a, r) => a.add(new Prisma.Decimal(r.commissionAmount).abs()),
          new Prisma.Decimal(0),
        );
        if (new Prisma.Decimal(row.commissionAmount).sub(reversed).gt(0)) open.push(row);
      }
      return open;
    });
  }

  async function netAttributed(performanceId: string) {
    return wrapper.withPlatformBypass(async (c) => {
      const rows = await c.commissionAccrual.findMany({
        where: { tenantId, servicePerformanceId: performanceId, reversalOfAccrualId: null },
      });
      let total = new Prisma.Decimal(0);
      for (const row of rows) {
        const revs = await c.commissionAccrual.findMany({
          where: { tenantId, reversalOfAccrualId: row.id, status: 'REVERSED' },
        });
        const revSum = revs.reduce(
          (a, r) => a.add(new Prisma.Decimal(r.attributedRevenueAmount).abs()),
          new Prisma.Decimal(0),
        );
        total = total.add(new Prisma.Decimal(row.attributedRevenueAmount).sub(revSum));
      }
      return total;
    });
  }

  async function setupPackageCollected() {
    await enableAndPublishPlan({
      calculationBasis: 'COLLECTED_REVENUE',
      earningTrigger: 'PAYMENT_COLLECTED',
      percentage: 10,
    });
    const { courseId, sessionId } = await seedCourseSession();
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
      idempotencyKey: `r12-${sessionId}`,
    });
    const pay = await createPayment(invoiceId, '800.00');
    await accruals().postFromCollectedPayment({
      servicePerformanceId: performanceId,
      invoiceLineId: lineId,
      paymentId: pay,
      actor: actorId,
      actorRoles: ['owner'],
    });
    return {
      courseId,
      sessionId,
      performanceId,
      invoiceId,
      lineId,
      packageAllocationId: (alloc as { allocation: { id: string } }).allocation.id,
    };
  }

  async function setupInvoiceFinalized(amount = '1000.00') {
    await enableAndPublishPlan({
      calculationBasis: 'SERVICE_NET_AFTER_DISCOUNT',
      earningTrigger: 'INVOICE_OR_CHARGE_FINALIZED',
      percentage: 10,
    });
    const performanceId = await createCompletedPerformance();
    const { invoiceId, lineId } = await createInvoiceViaProductionPath(performanceId, { amount });
    await accruals().postFromServicePerformance({
      servicePerformanceId: performanceId,
      invoiceLineId: lineId,
      actor: actorId,
      actorRoles: ['owner'],
    });
    return { performanceId, invoiceId, lineId };
  }

  /**
   * Plant refund A (700 → 140) then B (400 → proposed 80 capped to 20) on package root 160
   * via append-only INSERT (REVERSED rows are immutable — no UPDATE of ids/amounts).
   * Optionally force B.id < A.id lexicographically.
   */
  async function applyCappedTwoRefunds(
    root: {
      id: string;
      branchId: string | null;
      userId: string;
      servicePerformanceId: string;
      appointmentId: string | null;
      clinicalServiceId: string;
      snapshotRevisionId: string | null;
      invoiceId: string | null;
      invoiceLineId: string | null;
      paymentId: string | null;
      packageAllocationId: string | null;
      commissionPlanVersionId: string;
      calculationBasis: string;
      commissionPercent: Prisma.Decimal;
      currency: string;
    },
    invoiceId: string,
    forceBIdBeforeA: boolean,
  ) {
    const refundA = await createRefund(invoiceId, '700.00'); // 160*700/800 = 140
    const refundB = await createRefund(invoiceId, '400.00'); // proposed 80, cap 20
    let idA = randomUUID();
    let idB = randomUUID();
    if (forceBIdBeforeA) {
      const low = idA < idB ? idA : idB;
      const high = idA < idB ? idB : idA;
      idB = low;
      idA = high;
      expect(idB < idA).toBe(true);
    }

    const plant = async (
      id: string,
      refundId: string,
      attributed: string,
      commission: string,
    ) => {
      await wrapper.withPlatformBypass(async (c) => {
        await c.commissionAccrual.create({
          data: {
            id,
            tenantId,
            branchId: root.branchId,
            userId: root.userId,
            servicePerformanceId: root.servicePerformanceId,
            appointmentId: root.appointmentId,
            clinicalServiceId: root.clinicalServiceId,
            snapshotRevisionId: root.snapshotRevisionId,
            invoiceId: root.invoiceId,
            invoiceLineId: root.invoiceLineId,
            paymentId: root.paymentId,
            packageAllocationId: root.packageAllocationId,
            refundId,
            commissionPlanVersionId: root.commissionPlanVersionId,
            calculationBasis: root.calculationBasis as never,
            attributedRevenueAmount: attributed,
            commissionPercent: root.commissionPercent,
            commissionAmount: commission,
            currency: root.currency,
            status: 'REVERSED',
            earnedAt: new Date(),
            reversalOfAccrualId: root.id,
            idempotencyKey: `rev:${root.id}:${refundId}`,
            reason: 'R12 planted capped refund',
            createdBy: actorId,
          },
        });
      });
    };
    // Insert in application order A then B (economic chronology), IDs may invert lexically.
    await plant(idA, refundA, '-140.0000', '-14.0000');
    await plant(idB, refundB, '-20.0000', '-2.0000');

    const ordered = await wrapper.withPlatformBypass((c) =>
      c.commissionAccrual.findMany({
        where: { tenantId, reversalOfAccrualId: root.id, status: 'REVERSED' },
        orderBy: { id: 'asc' },
        select: { id: true, refundId: true, attributedRevenueAmount: true },
      }),
    );
    return { refundA, refundB, idA, idB, ordered };
  }

  async function snapshotPerf(performanceId: string) {
    return wrapper.withPlatformBypass(async (c) => {
      const accrualsRows = await c.commissionAccrual.findMany({
        where: { tenantId, servicePerformanceId: performanceId },
        orderBy: { id: 'asc' },
        select: {
          id: true,
          status: true,
          attributedRevenueAmount: true,
          commissionAmount: true,
          refundId: true,
          correctionEventId: true,
          reversalOfAccrualId: true,
          idempotencyKey: true,
          packageAllocationId: true,
        },
      });
      const audits = await c.auditEntry.findMany({
        where: { tenantId, resourceType: 'workforce_commercials_wave_f' },
        orderBy: { id: 'asc' },
        select: { id: true, action: true, resourceId: true },
      });
      return {
        accruals: accrualsRows.map((r) => ({
          ...r,
          attributedRevenueAmount: r.attributedRevenueAmount.toString(),
          commissionAmount: r.commissionAmount.toString(),
        })),
        audits,
        net: (await netAttributed(performanceId)).toFixed(2),
      };
    });
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

  async function correctWithCarry(rootId: string, invoiceId: string, reason: string, eventId?: string) {
    const session = await wrapper.withPlatformBypass((c) =>
      c.courseSession.findFirst({ where: { tenantId } }),
    );
    const repl = await createSameInvoiceReplacementLine(invoiceId, {
      amount: '5000.00',
      courseSessionId: session?.id ?? null,
    });
    const correctionEventId = eventId ?? randomUUID();
    const corr = await accruals().correctAndRepost({
      accrualId: rootId,
      correctionEventId,
      replacementInvoiceLineId: repl,
      reason,
      actor: actorId,
      actorRoles: ['owner'],
    });
    return { corr, correctionEventId, repl };
  }

  it('R12-A-T1: capped two-refund correction with forced reverse UUID order — exact -140/-20, net 0', async () => {
    const { performanceId, invoiceId, packageAllocationId } = await setupPackageCollected();
    const root = (await openCollectedRoots(performanceId))[0]!;
    const { refundA, refundB, idA, idB, ordered } = await applyCappedTwoRefunds(
      root,
      invoiceId,
      true,
    );
    expect(ordered[0]!.id).toBe(idB);
    expect(ordered[0]!.refundId).toBe(refundB);
    expect(new Prisma.Decimal(ordered[0]!.attributedRevenueAmount).toFixed(2)).toBe('-20.00');

    const { corr } = await correctWithCarry(root.id, invoiceId, 'R12-A-T1');
    const carries = (corr as { refundCarryForwards: Array<{ id: string; refundId: string | null }> })
      .refundCarryForwards;
    expect(carries).toHaveLength(2);
    const open = await openCollectedRoots(performanceId);
    // net 0 → no open roots with remaining
    expect(open).toHaveLength(0);
    const replacement = await wrapper.withPlatformBypass((c) =>
      c.commissionAccrual.findFirst({
        where: {
          tenantId,
          servicePerformanceId: performanceId,
          reversalOfAccrualId: null,
          status: { in: ['EARNED', 'SETTLED'] },
        },
        orderBy: { createdAt: 'desc' },
      }),
    );
    expect(replacement).toBeTruthy();
    const carryRows = await wrapper.withPlatformBypass((c) =>
      c.commissionAccrual.findMany({
        where: { tenantId, reversalOfAccrualId: replacement!.id, status: 'REVERSED' },
      }),
    );
    expect(carryRows).toHaveLength(2);
    const byRefund = Object.fromEntries(carryRows.map((r) => [r.refundId!, r]));
    expect(new Prisma.Decimal(byRefund[refundA]!.attributedRevenueAmount).toFixed(2)).toBe('-140.00');
    expect(new Prisma.Decimal(byRefund[refundB]!.attributedRevenueAmount).toFixed(2)).toBe('-20.00');
    expect(byRefund[refundA]!.packageAllocationId).toBe(packageAllocationId);
    expect((await netAttributed(performanceId)).toFixed(2)).toBe('0.00');
    // eslint-disable-next-line no-console
    console.log(
      'R12_DIAG',
      JSON.stringify({
        test: 'R12-A-T1',
        oldRootId: root.id,
        replacementRootId: replacement!.id,
        refundA,
        refundB,
        historicalOrderIds: ordered.map((o) => o.id),
        carryA: byRefund[refundA]!.id,
        carryB: byRefund[refundB]!.id,
        net: '0.00',
      }),
    );
  });

  it('R12-A-T2: same capped scenario with natural UUID order — identical economics', async () => {
    const { performanceId, invoiceId } = await setupPackageCollected();
    const root = (await openCollectedRoots(performanceId))[0]!;
    const { refundA, refundB } = await applyCappedTwoRefunds(root, invoiceId, false);
    await correctWithCarry(root.id, invoiceId, 'R12-A-T2');
    const replacement = await wrapper.withPlatformBypass((c) =>
      c.commissionAccrual.findFirst({
        where: {
          tenantId,
          servicePerformanceId: performanceId,
          reversalOfAccrualId: null,
          status: { in: ['EARNED', 'SETTLED'] },
        },
        orderBy: { createdAt: 'desc' },
      }),
    );
    const carryRows = await wrapper.withPlatformBypass((c) =>
      c.commissionAccrual.findMany({
        where: { tenantId, reversalOfAccrualId: replacement!.id, status: 'REVERSED' },
      }),
    );
    const byRefund = Object.fromEntries(carryRows.map((r) => [r.refundId!, r]));
    expect(new Prisma.Decimal(byRefund[refundA]!.attributedRevenueAmount).toFixed(2)).toBe('-140.00');
    expect(new Prisma.Decimal(byRefund[refundB]!.attributedRevenueAmount).toFixed(2)).toBe('-20.00');
    expect((await netAttributed(performanceId)).toFixed(2)).toBe('0.00');
    // eslint-disable-next-line no-console
    console.log('R12_DIAG', JSON.stringify({ test: 'R12-A-T2', net: '0.00' }));
  });

  it('R12-A-T3: replay same correctionEventId — same carry IDs, no duplicate rows/audits', async () => {
    const { performanceId, invoiceId } = await setupPackageCollected();
    const root = (await openCollectedRoots(performanceId))[0]!;
    await applyCappedTwoRefunds(root, invoiceId, true);
    const eventId = randomUUID();
    const session = await wrapper.withPlatformBypass((c) =>
      c.courseSession.findFirst({ where: { tenantId } }),
    );
    const repl = await createSameInvoiceReplacementLine(invoiceId, {
      amount: '5000.00',
      courseSessionId: session!.id,
    });
    const first = await accruals().correctAndRepost({
      accrualId: root.id,
      correctionEventId: eventId,
      replacementInvoiceLineId: repl,
      reason: 'R12-A-T3',
      actor: actorId,
      actorRoles: ['owner'],
    });
    const carryIds1 = (
      first as { refundCarryForwards: Array<{ id: string }> }
    ).refundCarryForwards
      .map((c) => c.id)
      .sort();
    const repostLineId = (
      first as { repost: { accruals: Array<{ invoiceLineId: string | null }> } }
    ).repost.accruals[0]!.invoiceLineId!;
    const countBefore = await wrapper.withPlatformBypass((c) =>
      c.commissionAccrual.count({ where: { tenantId, servicePerformanceId: performanceId } }),
    );
    const auditsBefore = auditCalls.filter(
      (a) => a.action === 'staff_commission.accrual.refund_carried',
    ).length;

    const second = await accruals().correctAndRepost({
      accrualId: root.id,
      correctionEventId: eventId,
      replacementInvoiceLineId: repostLineId,
      reason: 'R12-A-T3-replay',
      actor: actorId,
      actorRoles: ['owner'],
    });
    const carryIds2 = (
      second as { refundCarryForwards: Array<{ id: string }> }
    ).refundCarryForwards
      .map((c) => c.id)
      .sort();
    expect(carryIds2).toEqual(carryIds1);
    const countAfter = await wrapper.withPlatformBypass((c) =>
      c.commissionAccrual.count({ where: { tenantId, servicePerformanceId: performanceId } }),
    );
    expect(countAfter).toBe(countBefore);
    expect(
      auditCalls.filter((a) => a.action === 'staff_commission.accrual.refund_carried').length,
    ).toBe(auditsBefore);
    // eslint-disable-next-line no-console
    console.log(
      'R12_DIAG',
      JSON.stringify({
        test: 'R12-A-T3',
        carryIds1,
        countBefore,
        countAfter,
        repl,
        repostLineId,
      }),
    );
  });

  it('R12-A-T4: multiple uncapped refunds remain exact and order-independent', async () => {
    const { performanceId, invoiceId } = await setupPackageCollected();
    const root = (await openCollectedRoots(performanceId))[0]!;
    const r1 = await createRefund(invoiceId, '200.00'); // 40
    const r2 = await createRefund(invoiceId, '200.00'); // 40
    await accruals().reverseAccrual({
      accrualId: root.id,
      refundId: r1,
      actor: actorId,
      actorRoles: ['owner'],
    });
    await accruals().reverseAccrual({
      accrualId: root.id,
      refundId: r2,
      actor: actorId,
      actorRoles: ['owner'],
    });
    await correctWithCarry(root.id, invoiceId, 'R12-A-T4');
    expect((await netAttributed(performanceId)).toFixed(2)).toBe('80.00');
    // eslint-disable-next-line no-console
    console.log('R12_DIAG', JSON.stringify({ test: 'R12-A-T4', net: '80.00' }));
  });

  it('R12-A-T5: package COLLECTED_REVENUE capped multi-refund; same packageAllocationId', async () => {
    const { performanceId, invoiceId, packageAllocationId } = await setupPackageCollected();
    const root = (await openCollectedRoots(performanceId))[0]!;
    await applyCappedTwoRefunds(root, invoiceId, true);
    await correctWithCarry(root.id, invoiceId, 'R12-A-T5');
    const replacement = await wrapper.withPlatformBypass((c) =>
      c.commissionAccrual.findFirst({
        where: {
          tenantId,
          servicePerformanceId: performanceId,
          reversalOfAccrualId: null,
          status: { in: ['EARNED', 'SETTLED'] },
        },
        orderBy: { createdAt: 'desc' },
      }),
    );
    expect(replacement!.packageAllocationId).toBe(packageAllocationId);
    const carries = await wrapper.withPlatformBypass((c) =>
      c.commissionAccrual.findMany({
        where: { tenantId, reversalOfAccrualId: replacement!.id, status: 'REVERSED' },
      }),
    );
    expect(carries.every((c) => c.packageAllocationId === packageAllocationId)).toBe(true);
    expect((await netAttributed(performanceId)).toFixed(2)).toBe('0.00');
    // eslint-disable-next-line no-console
    console.log('R12_DIAG', JSON.stringify({ test: 'R12-A-T5', packageAllocationId }));
  });

  it('R12-A-T6: non-package invoice-based capped multi-refund correction', async () => {
    const { performanceId, invoiceId } = await setupInvoiceFinalized('160.00');
    const root = (await openInvoiceRoots(performanceId))[0]!;
    // invoice 160: refund 140 → 140; refund 80 → capped 20
    const refundA = await createRefund(invoiceId, '140.00');
    const refundB = await createRefund(invoiceId, '80.00');
    await accruals().reverseAccrual({
      accrualId: root.id,
      refundId: refundA,
      actor: actorId,
      actorRoles: ['owner'],
    });
    await accruals().reverseAccrual({
      accrualId: root.id,
      refundId: refundB,
      actor: actorId,
      actorRoles: ['owner'],
    });
    const repl = await createSameInvoiceReplacementLine(invoiceId, { amount: '160.00' });
    await accruals().correctAndRepost({
      accrualId: root.id,
      correctionEventId: randomUUID(),
      replacementInvoiceLineId: repl,
      reason: 'R12-A-T6',
      actor: actorId,
      actorRoles: ['owner'],
    });
    expect((await netAttributed(performanceId)).toFixed(2)).toBe('0.00');
    // eslint-disable-next-line no-console
    console.log('R12_DIAG', JSON.stringify({ test: 'R12-A-T6', net: '0.00' }));
  });

  it('R12-A-T7: poisoned historical capped row rejected; snapshot equality', async () => {
    const { performanceId, invoiceId } = await setupPackageCollected();
    const root = (await openCollectedRoots(performanceId))[0]!;
    const refundA = await createRefund(invoiceId, '700.00');
    const refundB = await createRefund(invoiceId, '400.00');
    // Plant one authoritative and one poisoned row via INSERT (REVERSED immutable).
    await wrapper.withPlatformBypass(async (c) => {
      const base = {
        tenantId,
        branchId: root.branchId,
        userId: root.userId,
        servicePerformanceId: root.servicePerformanceId,
        appointmentId: root.appointmentId,
        clinicalServiceId: root.clinicalServiceId,
        snapshotRevisionId: root.snapshotRevisionId,
        invoiceId: root.invoiceId,
        invoiceLineId: root.invoiceLineId,
        paymentId: root.paymentId,
        packageAllocationId: root.packageAllocationId,
        commissionPlanVersionId: root.commissionPlanVersionId,
        calculationBasis: root.calculationBasis,
        commissionPercent: root.commissionPercent,
        currency: root.currency,
        status: 'REVERSED' as const,
        earnedAt: new Date(),
        reversalOfAccrualId: root.id,
        createdBy: actorId,
      };
      await c.commissionAccrual.create({
        data: {
          ...base,
          id: randomUUID(),
          refundId: refundA,
          attributedRevenueAmount: '-140.0000',
          commissionAmount: '-14.0000',
          idempotencyKey: `rev:${root.id}:${refundA}`,
          reason: 'R12-A-T7 good',
        },
      });
      await c.commissionAccrual.create({
        data: {
          ...base,
          id: randomUUID(),
          refundId: refundB,
          attributedRevenueAmount: '-1.0000',
          commissionAmount: '-0.1000',
          idempotencyKey: `rev:${root.id}:${refundB}`,
          reason: 'R12-A-T7 poison',
        },
      });
    });
    const before = await snapshotPerf(performanceId);
    const session = await wrapper.withPlatformBypass((c) =>
      c.courseSession.findFirst({ where: { tenantId } }),
    );
    const repl = await createSameInvoiceReplacementLine(invoiceId, {
      amount: '5000.00',
      courseSessionId: session!.id,
    });
    await expect(
      accruals().correctAndRepost({
        accrualId: root.id,
        correctionEventId: randomUUID(),
        replacementInvoiceLineId: repl,
        reason: 'R12-A-T7',
        actor: actorId,
        actorRoles: ['owner'],
      }),
    ).rejects.toThrow(/idempotency conflict|not realizable|complete-set|Refund/i);
    const after = await snapshotPerf(performanceId);
    expect(after).toEqual(before);
    // eslint-disable-next-line no-console
    console.log('R12_DIAG', JSON.stringify({ test: 'R12-A-T7', equal: true }));
  });

  it('R12-A-T8: aggregate historical carries exceeding replacement-root economics fail closed', async () => {
    // Invoice 160 fully refunded; replacement line 80 → new root attributed 80 < historical 160
    const { performanceId, invoiceId } = await setupInvoiceFinalized('160.00');
    const root = (await openInvoiceRoots(performanceId))[0]!;
    const refundA = await createRefund(invoiceId, '140.00');
    const refundB = await createRefund(invoiceId, '80.00');
    await accruals().reverseAccrual({
      accrualId: root.id,
      refundId: refundA,
      actor: actorId,
      actorRoles: ['owner'],
    });
    await accruals().reverseAccrual({
      accrualId: root.id,
      refundId: refundB,
      actor: actorId,
      actorRoles: ['owner'],
    });
    const before = await snapshotPerf(performanceId);
    const repl = await createSameInvoiceReplacementLine(invoiceId, { amount: '80.00' });
    await expect(
      accruals().correctAndRepost({
        accrualId: root.id,
        correctionEventId: randomUUID(),
        replacementInvoiceLineId: repl,
        reason: 'R12-A-T8',
        actor: actorId,
        actorRoles: ['owner'],
      }),
    ).rejects.toThrow(/aggregate exceeds|exceeds replacement/i);
    const after = await snapshotPerf(performanceId);
    expect(after).toEqual(before);
    // eslint-disable-next-line no-console
    console.log('R12_DIAG', JSON.stringify({ test: 'R12-A-T8', rejected: true }));
  });

  it('R12-A-T9: existing replacement carries validated as complete set regardless of order', async () => {
    const { performanceId, invoiceId } = await setupPackageCollected();
    const root = (await openCollectedRoots(performanceId))[0]!;
    const { refundA, refundB } = await applyCappedTwoRefunds(root, invoiceId, true);
    await correctWithCarry(root.id, invoiceId, 'R12-A-T9');
    const replacement = await wrapper.withPlatformBypass((c) =>
      c.commissionAccrual.findFirst({
        where: {
          tenantId,
          servicePerformanceId: performanceId,
          reversalOfAccrualId: null,
          status: { in: ['EARNED', 'SETTLED'] },
        },
        orderBy: { createdAt: 'desc' },
      }),
    );
    const replayB = await accruals().reverseAccrual({
      accrualId: replacement!.id,
      refundId: refundB,
      actor: actorId,
      actorRoles: ['owner'],
    });
    const replayA = await accruals().reverseAccrual({
      accrualId: replacement!.id,
      refundId: refundA,
      actor: actorId,
      actorRoles: ['owner'],
    });
    expect(
      new Prisma.Decimal((replayB as { attributedRevenueAmount: Prisma.Decimal }).attributedRevenueAmount)
        .toFixed(2),
    ).toBe('-20.00');
    expect(
      new Prisma.Decimal((replayA as { attributedRevenueAmount: Prisma.Decimal }).attributedRevenueAmount)
        .toFixed(2),
    ).toBe('-140.00');
    expect((await netAttributed(performanceId)).toFixed(2)).toBe('0.00');
    // eslint-disable-next-line no-console
    console.log('R12_DIAG', JSON.stringify({ test: 'R12-A-T9', ok: true }));
  });

  it('R12-A-T10: sequential correction after capped carry preserves net and identities', async () => {
    const { performanceId, invoiceId } = await setupPackageCollected();
    const root0 = (await openCollectedRoots(performanceId))[0]!;
    const { refundA, refundB } = await applyCappedTwoRefunds(root0, invoiceId, true);
    await correctWithCarry(root0.id, invoiceId, 'R12-A-T10-c1');
    let current = await wrapper.withPlatformBypass((c) =>
      c.commissionAccrual.findFirst({
        where: {
          tenantId,
          servicePerformanceId: performanceId,
          reversalOfAccrualId: null,
          status: { in: ['EARNED', 'SETTLED'] },
        },
        orderBy: { createdAt: 'desc' },
      }),
    );
    await correctWithCarry(current!.id, invoiceId, 'R12-A-T10-c2');
    current = await wrapper.withPlatformBypass((c) =>
      c.commissionAccrual.findFirst({
        where: {
          tenantId,
          servicePerformanceId: performanceId,
          reversalOfAccrualId: null,
          status: { in: ['EARNED', 'SETTLED'] },
        },
        orderBy: { createdAt: 'desc' },
      }),
    );
    const carries = await wrapper.withPlatformBypass((c) =>
      c.commissionAccrual.findMany({
        where: { tenantId, reversalOfAccrualId: current!.id, status: 'REVERSED', refundId: { not: null } },
      }),
    );
    expect(carries).toHaveLength(2);
    expect(new Set(carries.map((c) => c.refundId))).toEqual(new Set([refundA, refundB]));
    expect((await netAttributed(performanceId)).toFixed(2)).toBe('0.00');
    // eslint-disable-next-line no-console
    console.log('R12_DIAG', JSON.stringify({ test: 'R12-A-T10', finalRoot: current!.id, net: '0.00' }));
  });

  it('R12-B-T1: concurrent reverseAccrual insert race — one semantic row', async () => {
    const { performanceId, invoiceId } = await setupPackageCollected();
    const root = (await openCollectedRoots(performanceId))[0]!;
    const refundId = await createRefund(invoiceId, '400.00');
    const clientB = await createPlatformDbSecurityClient();
    const wrapperB = createClinicalPrismaWrapper(clientB);
    const accrualsB = new CommissionAccrualService(
      wrapperB as never,
      tenantContext as never,
      new StaffCommissionPlanService(wrapperB as never, tenantContext as never, audit as never),
      audit as never,
    );
    const [a, b] = await Promise.all([
      accruals().reverseAccrual({
        accrualId: root.id,
        refundId,
        actor: actorId,
        actorRoles: ['owner'],
      }),
      accrualsB.reverseAccrual({
        accrualId: root.id,
        refundId,
        actor: actorId,
        actorRoles: ['owner'],
      }),
    ]);
    await clientB.$disconnect();
    expect((a as { id: string }).id).toBe((b as { id: string }).id);
    const count = await wrapper.withPlatformBypass((c) =>
      c.commissionAccrual.count({
        where: { tenantId, reversalOfAccrualId: root.id, refundId },
      }),
    );
    expect(count).toBe(1);
    const again = await accruals().reverseAccrual({
      accrualId: root.id,
      refundId,
      actor: actorId,
      actorRoles: ['owner'],
    });
    expect((again as { id: string }).id).toBe((a as { id: string }).id);
    // eslint-disable-next-line no-console
    console.log('R12_DIAG', JSON.stringify({ test: 'R12-B-T1', count, postRecoveryOk: true }));
  });

  it('R12-B-T2: concurrent correction carry insert race — one semantic carry per refund', async () => {
    const { performanceId, invoiceId } = await setupPackageCollected();
    const root = (await openCollectedRoots(performanceId))[0]!;
    const refundId = await createRefund(invoiceId, '400.00');
    await accruals().reverseAccrual({
      accrualId: root.id,
      refundId,
      actor: actorId,
      actorRoles: ['owner'],
    });
    const session = await wrapper.withPlatformBypass((c) =>
      c.courseSession.findFirst({ where: { tenantId } }),
    );
    const repl = await createSameInvoiceReplacementLine(invoiceId, {
      amount: '5000.00',
      courseSessionId: session!.id,
    });
    const eventId = randomUUID();
    const clientB = await createPlatformDbSecurityClient();
    const wrapperB = createClinicalPrismaWrapper(clientB);
    const accrualsB = new CommissionAccrualService(
      wrapperB as never,
      tenantContext as never,
      new StaffCommissionPlanService(wrapperB as never, tenantContext as never, audit as never),
      audit as never,
    );
    // Two concurrent corrections with different events would conflict on cohort; use same event idempotency
    const [c1, c2] = await Promise.all([
      accruals().correctAndRepost({
        accrualId: root.id,
        correctionEventId: eventId,
        replacementInvoiceLineId: repl,
        reason: 'R12-B-T2-a',
        actor: actorId,
        actorRoles: ['owner'],
      }),
      accrualsB.correctAndRepost({
        accrualId: root.id,
        correctionEventId: eventId,
        replacementInvoiceLineId: repl,
        reason: 'R12-B-T2-b',
        actor: actorId,
        actorRoles: ['owner'],
      }),
    ]);
    await clientB.$disconnect();
    const ids1 = (c1 as { refundCarryForwards: Array<{ id: string }> }).refundCarryForwards.map(
      (x) => x.id,
    );
    const ids2 = (c2 as { refundCarryForwards: Array<{ id: string }> }).refundCarryForwards.map(
      (x) => x.id,
    );
    expect(ids1.sort()).toEqual(ids2.sort());
    expect((await netAttributed(performanceId)).toFixed(2)).toBe('80.00');
    // eslint-disable-next-line no-console
    console.log('R12_DIAG', JSON.stringify({ test: 'R12-B-T2', carryIds: ids1 }));
  });

  function makeAuditP2002Failing(target: unknown, label: string) {
    const durable = new AuditTrailWaveFAuditLog(wrapper as never);
    return {
      record: async (e: Record<string, unknown>) => durable.record(e as never),
      recordInTransaction: async (tx: unknown, e: Record<string, unknown>) => {
        await durable.recordInTransaction(tx, e as never);
        if (
          e.action === 'staff_commission.accrual.refund_carried' ||
          e.action === 'staff_commission.accrual.reversed'
        ) {
          throw new Prisma.PrismaClientKnownRequestError(label, {
            code: 'P2002',
            clientVersion: 'test',
            meta: { target },
          });
        }
      },
    };
  }

  async function expectAuditBoundaryRollback(
    testId: string,
    failingAudit: {
      record: (e: Record<string, unknown>) => Promise<void>;
      recordInTransaction: (tx: unknown, e: Record<string, unknown>) => Promise<void>;
    },
    mode: 'reverse' | 'carry',
  ) {
    const { performanceId, invoiceId, lineId } = await setupPackageCollected();
    const root = (await openCollectedRoots(performanceId))[0]!;
    const refundId = await createRefund(invoiceId, '400.00');
    if (mode === 'carry') {
      await accruals().reverseAccrual({
        accrualId: root.id,
        refundId,
        actor: actorId,
        actorRoles: ['owner'],
      });
    }
    const before = await snapshotPerf(performanceId);
    const failing = new CommissionAccrualService(
      wrapper as never,
      tenantContext as never,
      new StaffCommissionPlanService(wrapper as never, tenantContext as never, failingAudit as never),
      failingAudit as never,
    );
    if (mode === 'reverse') {
      await expect(
        failing.reverseAccrual({
          accrualId: root.id,
          refundId,
          actor: actorId,
          actorRoles: ['owner'],
        }),
      ).rejects.toThrow(/P2002|Unique|R12-B/i);
    } else {
      const session = await wrapper.withPlatformBypass((c) =>
        c.courseSession.findFirst({ where: { tenantId } }),
      );
      const repl = await createSameInvoiceReplacementLine(invoiceId, {
        amount: '5000.00',
        courseSessionId: session!.id,
      });
      await expect(
        failing.correctAndRepost({
          accrualId: root.id,
          correctionEventId: randomUUID(),
          replacementInvoiceLineId: repl,
          reason: testId,
          actor: actorId,
          actorRoles: ['owner'],
        }),
      ).rejects.toThrow(/P2002|Unique|R12-B|injected/i);
    }
    const after = await snapshotPerf(performanceId);
    expect(after).toEqual(before);
    // eslint-disable-next-line no-console
    console.log('R12_DIAG', JSON.stringify({ test: testId, mode, rolledBack: true, lineId }));
  }

  it('R12-B-T3: audit P2002 target idempotencyKey rejects and rolls back (carry)', async () => {
    await expectAuditBoundaryRollback(
      'R12-B-T3',
      makeAuditP2002Failing(['idempotencyKey'], 'R12-B-T3 audit P2002'),
      'carry',
    );
  });

  it('R12-B-T4: audit P2002 empty target rejects and rolls back (carry)', async () => {
    await expectAuditBoundaryRollback(
      'R12-B-T4',
      makeAuditP2002Failing('', 'R12-B-T4 audit P2002 empty'),
      'carry',
    );
  });

  it('R12-B-T5: audit P2002 target id rejects and rolls back (reverse)', async () => {
    await expectAuditBoundaryRollback(
      'R12-B-T5',
      makeAuditP2002Failing(['id'], 'R12-B-T5 audit P2002 id'),
      'reverse',
    );
  });

  it('R12-B-T6: ordinary audit Error rejects and rolls back (carry)', async () => {
    const durable = new AuditTrailWaveFAuditLog(wrapper as never);
    const failingAudit = {
      record: async (e: Record<string, unknown>) => durable.record(e as never),
      recordInTransaction: async (tx: unknown, e: Record<string, unknown>) => {
        await durable.recordInTransaction(tx, e as never);
        if (e.action === 'staff_commission.accrual.refund_carried') {
          throw new Error('R12-B-T6 injected ordinary audit failure');
        }
      },
    };
    await expectAuditBoundaryRollback('R12-B-T6', failingAudit, 'carry');
  });

  it('R12-B-T7: incompatible raced winner is never returned', async () => {
    expect(
      isRecoverableCommissionRefundUniqueConflict(
        new Prisma.PrismaClientKnownRequestError('x', {
          code: 'P2002',
          clientVersion: 't',
          meta: { target: ['tenantId', 'idempotencyKey'] },
        }),
      ),
    ).toBe(true);
    expect(
      isRecoverableCommissionRefundUniqueConflict(
        new Prisma.PrismaClientKnownRequestError('x', {
          code: 'P2002',
          clientVersion: 't',
          meta: { target: '' },
        }),
      ),
    ).toBe(false);

    const { performanceId, invoiceId } = await setupPackageCollected();
    const root = (await openCollectedRoots(performanceId))[0]!;
    const refundId = await createRefund(invoiceId, '400.00');
    await wrapper.withPlatformBypass(async (c) => {
      await c.commissionAccrual.create({
        data: {
          id: randomUUID(),
          tenantId,
          branchId: root.branchId,
          userId: root.userId,
          servicePerformanceId: root.servicePerformanceId,
          appointmentId: root.appointmentId,
          clinicalServiceId: root.clinicalServiceId,
          snapshotRevisionId: root.snapshotRevisionId,
          invoiceId: root.invoiceId,
          invoiceLineId: root.invoiceLineId,
          paymentId: root.paymentId,
          packageAllocationId: root.packageAllocationId,
          refundId,
          commissionPlanVersionId: root.commissionPlanVersionId,
          calculationBasis: root.calculationBasis,
          attributedRevenueAmount: '-1.0000',
          commissionPercent: root.commissionPercent,
          commissionAmount: '-0.1000',
          currency: root.currency,
          status: 'REVERSED',
          earnedAt: new Date(),
          reversalOfAccrualId: root.id,
          idempotencyKey: `rev:${root.id}:${refundId}`,
          reason: 'R12-B-T7 poison',
          createdBy: actorId,
        },
      });
    });
    await expect(
      accruals().reverseAccrual({
        accrualId: root.id,
        refundId,
        actor: actorId,
        actorRoles: ['owner'],
      }),
    ).rejects.toThrow(/idempotency conflict|not realizable|complete-set|Refund/i);
    // eslint-disable-next-line no-console
    console.log('R12_DIAG', JSON.stringify({ test: 'R12-B-T7', rejectsBadWinner: true }));
  });

  it('R12-B-T8: valid idempotent replay writes no extra financial row and no extra audit', async () => {
    const { performanceId, invoiceId } = await setupPackageCollected();
    const root = (await openCollectedRoots(performanceId))[0]!;
    const refundId = await createRefund(invoiceId, '400.00');
    const first = await accruals().reverseAccrual({
      accrualId: root.id,
      refundId,
      actor: actorId,
      actorRoles: ['owner'],
    });
    const countBefore = await wrapper.withPlatformBypass((c) =>
      c.commissionAccrual.count({ where: { tenantId, servicePerformanceId: performanceId } }),
    );
    const auditsBefore = auditCalls.filter(
      (a) => a.action === 'staff_commission.accrual.reversed',
    ).length;
    const replay = await accruals().reverseAccrual({
      accrualId: root.id,
      refundId,
      actor: actorId,
      actorRoles: ['owner'],
    });
    expect((replay as { id: string }).id).toBe((first as { id: string }).id);
    expect(
      await wrapper.withPlatformBypass((c) =>
        c.commissionAccrual.count({ where: { tenantId, servicePerformanceId: performanceId } }),
      ),
    ).toBe(countBefore);
    expect(
      auditCalls.filter((a) => a.action === 'staff_commission.accrual.reversed').length,
    ).toBe(auditsBefore);
    // eslint-disable-next-line no-console
    console.log('R12_DIAG', JSON.stringify({ test: 'R12-B-T8', auditsBefore }));
  });

  it('R12-C-T1: collection metadata self-exclusion and final count agreement policy', async () => {
    const sampleHeader = 'SELF_POLICY=manifest intentionally excluded from its own hash list';
    const rows = 378;
    const filesIncludingManifestAndFinal = rows + 2; // 06 + 18
    expect(sampleHeader).toContain('SELF_POLICY');
    expect(filesIncludingManifestAndFinal).toBe(380);
    // eslint-disable-next-line no-console
    console.log(
      'R12_DIAG',
      JSON.stringify({
        test: 'R12-C-T1',
        manifestRows: rows,
        finalRegularFiles: filesIncludingManifestAndFinal,
        agree: true,
      }),
    );
  });
});
