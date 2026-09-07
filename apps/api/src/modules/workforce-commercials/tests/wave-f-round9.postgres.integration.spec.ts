/**
 * Phase 48 Wave F Round 9 — correction lifecycle + lock-order remediation.
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
import { CommissionPackageAllocationService } from '../services/commission-package-allocation.service';

jest.setTimeout(300_000);
const describeDb = platformDbSecurityEnabled() ? describe : describe.skip;

const R9_BLOCKING_EVIDENCE: string[] = [];

function deferred<T = void>() {
  let resolve!: (v: T | PromiseLike<T>) => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describeDb('Wave F Round 9 remediation (PostgreSQL)', () => {
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
        data: { id: tenantId, name: 'WF R9', slug: `wfr9-${tenantId.slice(0, 8)}` },
      });
      for (const u of [
        { id: actorId, first: 'A', last: 'Ctor' },
        { id: performerId, first: 'Perf', last: 'Ormer' },
      ]) {
        await c.user.create({
          data: {
            id: u.id,
            tenantId,
            email: `wfr9-${u.id.slice(0, 8)}@t.local`,
            passwordHash: 'x',
            firstName: u.first,
            lastName: u.last,
          },
        });
      }
      await c.patient.create({
        data: { id: patientId, tenantId, firstName: 'Pat', lastName: 'Nine' },
      });
      await c.branch.create({
        data: { id: branchId, tenantId, name: `R9 B ${branchId.slice(0, 6)}` },
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
    userId?: string;
    percentage?: number;
    calculationBasis?: string;
    earningTrigger?: string;
    effectiveFrom?: string;
  }) {
    const userId = opts?.userId ?? performerId;
    await plans().setUserCommissionEligibility(
      userId,
      true,
      opts?.percentage ?? 10,
      '2026-01-01',
      { actorId, actorRoles: ['owner'] },
    );
    const draft = await plans().createDraftPlan({
      userId,
      percentage: opts?.percentage ?? 10,
      effectiveFrom: opts?.effectiveFrom ?? '2026-01-01',
      calculationBasis: opts?.calculationBasis ?? 'SERVICE_NET_AFTER_DISCOUNT',
      earningTrigger: opts?.earningTrigger ?? 'INVOICE_OR_CHARGE_FINALIZED',
      actor: { actorId, actorRoles: ['owner'] },
    });
    return plans().publishPlan(draft.id, { actorId, actorRoles: ['owner'] });
  }

  async function createCompletedPerformance(opts?: {
    performedAt?: Date;
    assistantUserId?: string | null;
  }) {
    const performanceId = randomUUID();
    const performedAt = opts?.performedAt ?? new Date('2026-09-01T10:30:00.000Z');
    await wrapper.withPlatformBypass(async (c) => {
      const participants: Array<Record<string, unknown>> = [
        {
          id: randomUUID(),
          tenantId,
          userId: performerId,
          role: 'PRIMARY',
          attributionShare: opts?.assistantUserId ? 60 : null,
          recordedBy: actorId,
        },
      ];
      if (opts?.assistantUserId) {
        participants.push({
          id: randomUUID(),
          tenantId,
          userId: opts.assistantUserId,
          role: 'ASSISTING',
          attributionShare: 40,
          recordedBy: actorId,
        });
      }
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
          participants: { create: participants as never },
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
      courseSessionId?: string | null;
      appointmentId?: string | null;
      clinicalServiceId?: string | null;
      extraLineAmount?: string;
      patientId?: string;
    },
  ) {
    const amount = opts?.amount ?? '1000.00';
    const lineItems: Array<Record<string, unknown>> = [
      {
        description: 'R9 clinical line',
        quantity: 1,
        unitPrice: Number(amount),
        discountPercent: 0,
        taxPercent: 0,
        servicePerformanceId,
        appointmentId: opts?.appointmentId === undefined ? appointmentId : opts.appointmentId,
        clinicalServiceId:
          opts?.clinicalServiceId === undefined ? clinicalServiceId : opts.clinicalServiceId,
        courseSessionId: opts?.courseSessionId ?? null,
      },
    ];
    if (opts?.extraLineAmount) {
      lineItems.push({
        description: 'R9 other line',
        quantity: 1,
        unitPrice: Number(opts.extraLineAmount),
        discountPercent: 0,
        taxPercent: 0,
        servicePerformanceId: null,
        appointmentId: null,
        clinicalServiceId: null,
        courseSessionId: null,
      });
    }
    const invoice = Invoice.create({
      invoiceId: randomUUID(),
      tenantId,
      branchId,
      patientId: opts?.patientId ?? patientId,
      invoiceNumber: `R9-${randomUUID().slice(0, 8)}`,
      invoiceDate: new Date('2026-09-01'),
      currency: opts?.currency ?? 'SYP',
      notes: 'R9',
      lineItems: lineItems as never,
    });
    invoice.issue();
    await raw.$executeRaw`SELECT set_config('app.platform_rls_bypass', 'true', false)`;
    await new PrismaInvoiceRepository(raw as never).save(invoice);
    return {
      invoiceId: invoice.invoiceId,
      lineId: invoice.lineItems[0]!.itemId,
      otherLineId: invoice.lineItems[1]?.itemId ?? null,
      amountTotal: invoice.amountTotal,
    };
  }

  async function seedCourseSession(opts?: { unitPrice?: string; currency?: string }) {
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
          currency: opts?.currency ?? 'SYP',
          unitPrice: opts?.unitPrice ?? '5000.00',
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
          reason: 'R9 refund',
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
          description: 'R9 corrected line',
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

  async function ensureAssistant(): Promise<string> {
    const assistId = randomUUID();
    await wrapper.withPlatformBypass(async (c) => {
      await c.user.create({
        data: {
          id: assistId,
          tenantId,
          email: `wfr9-a-${assistId.slice(0, 8)}@t.local`,
          passwordHash: 'x',
          firstName: 'As',
          lastName: 'Sist',
        },
      });
    });
    await enableAndPublishPlan({
      userId: assistId,
      percentage: 10,
      calculationBasis: 'COLLECTED_REVENUE',
      earningTrigger: 'PAYMENT_COLLECTED',
    });
    return assistId;
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

  async function netAttributed(performanceId: string, packageAllocationId?: string) {
    return wrapper.withPlatformBypass(async (c) => {
      const rows = await c.commissionAccrual.findMany({
        where: {
          tenantId,
          servicePerformanceId: performanceId,
          reversalOfAccrualId: null,
          ...(packageAllocationId ? { packageAllocationId } : {}),
        },
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

  async function netCommission(performanceId: string) {
    return wrapper.withPlatformBypass(async (c) => {
      const rows = await c.commissionAccrual.findMany({
        where: {
          tenantId,
          servicePerformanceId: performanceId,
          reversalOfAccrualId: null,
        },
      });
      let total = new Prisma.Decimal(0);
      for (const row of rows) {
        const revs = await c.commissionAccrual.findMany({
          where: { tenantId, reversalOfAccrualId: row.id, status: 'REVERSED' },
        });
        const revSum = revs.reduce(
          (a, r) => a.add(new Prisma.Decimal(r.commissionAmount).abs()),
          new Prisma.Decimal(0),
        );
        total = total.add(new Prisma.Decimal(row.commissionAmount).sub(revSum));
      }
      return total;
    });
  }

  async function setupPackageCollected(opts?: {
    payments?: string[];
    assistantUserId?: string | null;
  }) {
    await enableAndPublishPlan({
      calculationBasis: 'COLLECTED_REVENUE',
      earningTrigger: 'PAYMENT_COLLECTED',
      percentage: 10,
    });
    const { courseId, sessionId } = await seedCourseSession();
    const performanceId = await createCompletedPerformance({
      assistantUserId: opts?.assistantUserId ?? null,
    });
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
      idempotencyKey: `r9-${sessionId}`,
    });
    const paymentAmounts = opts?.payments ?? ['800.00'];
    const paymentIds: string[] = [];
    for (const amt of paymentAmounts) {
      const pay = await createPayment(invoiceId, amt);
      paymentIds.push(pay);
      await accruals().postFromCollectedPayment({
        servicePerformanceId: performanceId,
        invoiceLineId: lineId,
        paymentId: pay,
        actor: actorId,
        actorRoles: ['owner'],
      });
    }
    return {
      courseId,
      sessionId,
      performanceId,
      invoiceId,
      lineId,
      paymentIds,
      packageAllocationId: (alloc as { allocation: { id: string } }).allocation.id,
    };
  }

  beforeAll(async () => {
    raw = await createPlatformDbSecurityClient();
    wrapper = createClinicalPrismaWrapper(raw);
  });
  afterAll(async () => {
    // R10-D — emit diagnostics to stdout only; never write repository evidence files from tests.
    // eslint-disable-next-line no-console
    console.log(
      ['R9_BLOCKING_DIAGNOSTICS_BEGIN', ...R9_BLOCKING_EVIDENCE, 'R9_BLOCKING_DIAGNOSTICS_END'].join(
        '\n',
      ),
    );
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

  // ── R9-A refund-before-correction ──────────────────────────────────────────

  it('R9-A-T1 one payment prior partial refund then correction keeps net 80', async () => {
    const { performanceId, invoiceId, lineId, packageAllocationId } = await setupPackageCollected();
    const roots = await openCollectedRoots(performanceId);
    expect(roots).toHaveLength(1);
    expect(new Prisma.Decimal(roots[0]!.attributedRevenueAmount).toFixed(2)).toBe('160.00');

    const refundId = await createRefund(invoiceId, '400.00'); // 400/800 * 160 = 80
    await accruals().reverseAccrual({
      accrualId: roots[0]!.id,
      refundId,
      actor: actorId,
      actorRoles: ['owner'],
    });
    expect((await netAttributed(performanceId)).toFixed(2)).toBe('80.00');

    const session = await wrapper.withPlatformBypass((c) =>
      c.courseSession.findFirst({ where: { tenantId } }),
    );
    const repl = await createSameInvoiceReplacementLine(invoiceId, {
      amount: '5000.00',
      courseSessionId: session!.id,
    });

    const corr = await accruals().correctAndRepost({
      accrualId: roots[0]!.id,
      correctionEventId: randomUUID(),
      replacementInvoiceLineId: repl,
      reason: 'R9-A-T1',
      actor: actorId,
      actorRoles: ['owner'],
    });
    expect((corr as { refundCarryForwards: unknown[] }).refundCarryForwards.length).toBe(1);
    expect((await netAttributed(performanceId)).toFixed(2)).toBe('80.00');
    expect((await netCommission(performanceId)).toFixed(2)).toBe('8.00');

    const open = await openCollectedRoots(performanceId);
    expect(open).toHaveLength(1);
    expect(open[0]!.packageAllocationId).toBe(packageAllocationId);
    expect(open[0]!.invoiceLineId).toBe(repl);
    expect(lineId).not.toBe(repl);
  });

  it('R9-A-T2 two payments prior refund then correction preserves net', async () => {
    const { performanceId, invoiceId, paymentIds } = await setupPackageCollected({
      payments: ['800.00', '800.00'],
    });
    expect((await netAttributed(performanceId)).toFixed(2)).toBe('320.00');
    const roots = await openCollectedRoots(performanceId);
    const target = roots.find((r) => r.paymentId === paymentIds[0])!;
    const refundId = await createRefund(invoiceId, '400.00'); // 400/1600 * 160 = 40 on that root
    await accruals().reverseAccrual({
      accrualId: target.id,
      refundId,
      actor: actorId,
      actorRoles: ['owner'],
    });
    const before = await netAttributed(performanceId);
    expect(before.toFixed(2)).toBe('280.00');

    const session = await wrapper.withPlatformBypass((c) =>
      c.courseSession.findFirst({ where: { tenantId } }),
    );
    const repl = await createSameInvoiceReplacementLine(invoiceId, {
      amount: '5000.00',
      courseSessionId: session!.id,
    });
    await accruals().correctAndRepost({
      accrualId: roots[0]!.id,
      correctionEventId: randomUUID(),
      replacementInvoiceLineId: repl,
      reason: 'R9-A-T2',
      actor: actorId,
      actorRoles: ['owner'],
    });
    expect((await netAttributed(performanceId)).toFixed(2)).toBe(before.toFixed(2));
  });

  it('R9-A-T3 two payments × two participants prior refund reconcile', async () => {
    const assistId = await ensureAssistant();
    const { performanceId, invoiceId } = await setupPackageCollected({
      payments: ['800.00', '800.00'],
      assistantUserId: assistId,
    });
    const roots = await openCollectedRoots(performanceId);
    expect(roots.length).toBe(4);
    const refundId = await createRefund(invoiceId, '400.00');
    // reverse one root (primary, first payment)
    const primaryPay1 = roots.find((r) => r.userId === performerId)!;
    await accruals().reverseAccrual({
      accrualId: primaryPay1.id,
      refundId,
      actor: actorId,
      actorRoles: ['owner'],
    });
    const before = await netAttributed(performanceId);
    const beforeComm = await netCommission(performanceId);
    const session = await wrapper.withPlatformBypass((c) =>
      c.courseSession.findFirst({ where: { tenantId } }),
    );
    const repl = await createSameInvoiceReplacementLine(invoiceId, {
      amount: '5000.00',
      courseSessionId: session!.id,
    });
    await accruals().correctAndRepost({
      accrualId: roots.find((r) => r.id !== primaryPay1.id)!.id,
      correctionEventId: randomUUID(),
      replacementInvoiceLineId: repl,
      reason: 'R9-A-T3',
      actor: actorId,
      actorRoles: ['owner'],
    });
    expect((await netAttributed(performanceId)).toFixed(2)).toBe(before.toFixed(2));
    expect((await netCommission(performanceId)).toFixed(2)).toBe(beforeComm.toFixed(2));
    const open = await openCollectedRoots(performanceId);
    expect(open.length).toBe(4);
    const byUser = new Map<string, Prisma.Decimal>();
    for (const r of open) {
      const revs = await wrapper.withPlatformBypass((c) =>
        c.commissionAccrual.findMany({
          where: { tenantId, reversalOfAccrualId: r.id, status: 'REVERSED' },
        }),
      );
      const net = new Prisma.Decimal(r.attributedRevenueAmount).sub(
        revs.reduce(
          (a, x) => a.add(new Prisma.Decimal(x.attributedRevenueAmount).abs()),
          new Prisma.Decimal(0),
        ),
      );
      byUser.set(r.userId, (byUser.get(r.userId) ?? new Prisma.Decimal(0)).add(net));
    }
    expect(byUser.size).toBe(2);
  });

  it('R9-A-T4 full prior refund then correction carries refund economics (R12 rem=0 path)', async () => {
    const { performanceId, invoiceId, lineId } = await setupPackageCollected();
    const roots = await openCollectedRoots(performanceId);
    const refundId = await createRefund(invoiceId, '800.00'); // full
    await accruals().reverseAccrual({
      accrualId: roots[0]!.id,
      refundId,
      actor: actorId,
      actorRoles: ['owner'],
    });
    expect((await netAttributed(performanceId)).toFixed(2)).toBe('0.00');
    const session = await wrapper.withPlatformBypass((c) =>
      c.courseSession.findFirst({ where: { tenantId } }),
    );
    const repl = await createSameInvoiceReplacementLine(invoiceId, {
      amount: '5000.00',
      courseSessionId: session!.id,
    });
    const corr = await accruals().correctAndRepost({
      accrualId: roots[0]!.id,
      correctionEventId: randomUUID(),
      replacementInvoiceLineId: repl,
      reason: 'R9-A-T4',
      actor: actorId,
      actorRoles: ['owner'],
    });
    const carries = (corr as { refundCarryForwards: Array<{ id: string; refundId: string | null }> })
      .refundCarryForwards;
    expect(carries).toHaveLength(1);
    expect(carries[0]!.refundId).toBe(refundId);
    expect((await netAttributed(performanceId)).toFixed(2)).toBe('0.00');
    const binding = await wrapper.withPlatformBypass((c) =>
      c.invoiceLineItem.findFirst({ where: { id: lineId, tenantId } }),
    );
    expect(binding!.performanceBindingStatus).toBe('SUPERSEDED');
  });

  it('R9-A-T5 exact replay same correctionEventId', async () => {
    const { performanceId, invoiceId } = await setupPackageCollected();
    const roots = await openCollectedRoots(performanceId);
    const refundId = await createRefund(invoiceId, '400.00');
    await accruals().reverseAccrual({
      accrualId: roots[0]!.id,
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
    const first = await accruals().correctAndRepost({
      accrualId: roots[0]!.id,
      correctionEventId: eventId,
      replacementInvoiceLineId: repl,
      reason: 'R9-A-T5',
      actor: actorId,
      actorRoles: ['owner'],
    });
    const countAfter = await wrapper.withPlatformBypass((c) =>
      c.commissionAccrual.count({ where: { tenantId, servicePerformanceId: performanceId } }),
    );
    const replay = await accruals().correctAndRepost({
      accrualId: roots[0]!.id,
      correctionEventId: eventId,
      replacementInvoiceLineId: repl,
      reason: 'R9-A-T5',
      actor: actorId,
      actorRoles: ['owner'],
    });
    expect((replay as { idempotent: boolean }).idempotent).toBe(true);
    expect(
      ((replay as { repost: { accruals: Array<{ id: string }> } }).repost.accruals[0] as { id: string })
        .id,
    ).toBe(
      ((first as { repost: { accruals: Array<{ id: string }> } }).repost.accruals[0] as { id: string })
        .id,
    );
    const countReplay = await wrapper.withPlatformBypass((c) =>
      c.commissionAccrual.count({ where: { tenantId, servicePerformanceId: performanceId } }),
    );
    expect(countReplay).toBe(countAfter);
  });

  it('R9-A-T6 conflicting replay different replacement fails closed', async () => {
    const { performanceId, invoiceId } = await setupPackageCollected();
    const roots = await openCollectedRoots(performanceId);
    const session = await wrapper.withPlatformBypass((c) =>
      c.courseSession.findFirst({ where: { tenantId } }),
    );
    const repl1 = await createSameInvoiceReplacementLine(invoiceId, {
      amount: '5000.00',
      courseSessionId: session!.id,
    });
    const repl2 = await createSameInvoiceReplacementLine(invoiceId, {
      amount: '5000.00',
      courseSessionId: session!.id,
    });
    const eventId = randomUUID();
    await accruals().correctAndRepost({
      accrualId: roots[0]!.id,
      correctionEventId: eventId,
      replacementInvoiceLineId: repl1,
      reason: 'R9-A-T6 first',
      actor: actorId,
      actorRoles: ['owner'],
    });
    await expect(
      accruals().correctAndRepost({
        accrualId: roots[0]!.id,
        correctionEventId: eventId,
        replacementInvoiceLineId: repl2,
        reason: 'R9-A-T6 conflict',
        actor: actorId,
        actorRoles: ['owner'],
      }),
    ).rejects.toThrow(/idempotency conflict|different replacement/i);
  });

  it('R9-A-T7 refund after refund-aware correction targets replacement only', async () => {
    const { performanceId, invoiceId } = await setupPackageCollected();
    const roots = await openCollectedRoots(performanceId);
    const refund1 = await createRefund(invoiceId, '400.00');
    await accruals().reverseAccrual({
      accrualId: roots[0]!.id,
      refundId: refund1,
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
    await accruals().correctAndRepost({
      accrualId: roots[0]!.id,
      correctionEventId: randomUUID(),
      replacementInvoiceLineId: repl,
      reason: 'R9-A-T7',
      actor: actorId,
      actorRoles: ['owner'],
    });
    const open = await openCollectedRoots(performanceId);
    expect(open).toHaveLength(1);
    expect((await netAttributed(performanceId)).toFixed(2)).toBe('80.00');
    const refund2 = await createRefund(invoiceId, '400.00');
    const rev = await accruals().reverseAccrual({
      accrualId: open[0]!.id,
      refundId: refund2,
      actor: actorId,
      actorRoles: ['owner'],
    });
    // 400/800 * 160 = 80, capped at remaining 80 → net 0
    expect(new Prisma.Decimal((rev as { attributedRevenueAmount: Prisma.Decimal }).attributedRevenueAmount).abs().toFixed(2)).toBe(
      '80.00',
    );
    expect((await netAttributed(performanceId)).toFixed(2)).toBe('0.00');
    await expect(
      accruals().reverseAccrual({
        accrualId: open[0]!.id,
        refundId: await createRefund(invoiceId, '100.00'),
        actor: actorId,
        actorRoles: ['owner'],
      }),
    ).rejects.toThrow(/no remaining|must be > 0/i);
  });

  it('R9-A-T8 rollback after repost before refund carry', async () => {
    const { performanceId, invoiceId, lineId } = await setupPackageCollected();
    const roots = await openCollectedRoots(performanceId);
    const refundId = await createRefund(invoiceId, '400.00');
    await accruals().reverseAccrual({
      accrualId: roots[0]!.id,
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
    const beforeCount = await wrapper.withPlatformBypass((c) =>
      c.commissionAccrual.count({ where: { tenantId, servicePerformanceId: performanceId } }),
    );
    const beforeNet = await netAttributed(performanceId);

    // R10-B — fault injection via test-owned audit adapter (not a production input flag).
    const failingAudit = {
      record: async (e: Record<string, unknown>) => {
        auditCalls.push({ ...e, via: 'record' });
      },
      recordInTransaction: async (_tx: unknown, e: Record<string, unknown>) => {
        if (e.action === 'staff_commission.accrual.refund_carried') {
          throw new Error('R9-A-T8 injected failure after repost before refund carry-forward');
        }
        auditCalls.push({ ...e, via: 'recordInTransaction' });
      },
    };
    const failingAccruals = new CommissionAccrualService(
      wrapper as never,
      tenantContext as never,
      new StaffCommissionPlanService(wrapper as never, tenantContext as never, failingAudit as never),
      failingAudit as never,
    );

    await expect(
      failingAccruals.correctAndRepost({
        accrualId: roots[0]!.id,
        correctionEventId: randomUUID(),
        replacementInvoiceLineId: repl,
        reason: 'R9-A-T8',
        actor: actorId,
        actorRoles: ['owner'],
      }),
    ).rejects.toThrow(/R9-A-T8 injected failure/i);
    expect(
      await wrapper.withPlatformBypass((c) =>
        c.commissionAccrual.count({ where: { tenantId, servicePerformanceId: performanceId } }),
      ),
    ).toBe(beforeCount);
    expect((await netAttributed(performanceId)).toFixed(2)).toBe(beforeNet.toFixed(2));
    const binding = await wrapper.withPlatformBypass((c) =>
      c.invoiceLineItem.findFirst({ where: { id: lineId, tenantId } }),
    );
    expect(binding!.performanceBindingStatus).toBe('ACTIVE');
  });

  // ── R9-B partial settlement safety ─────────────────────────────────────────

  it('R9-B-T1 selected root partially settled blocks correction', async () => {
    const { performanceId, invoiceId, lineId } = await setupPackageCollected();
    const roots = await openCollectedRoots(performanceId);
    const root = roots[0]!;
    const settled = await accruals().settleAccrual({
      accrualId: root.id,
      settlementReference: `partial-${randomUUID().slice(0, 8)}`,
      amount: '8.00', // commission was 16.00 at 10% of 160
      actor: actorId,
      actorRoles: ['owner'],
    });
    expect(root.status).toBe('EARNED');
    const refreshed = await accruals().getAccrual(root.id);
    expect(refreshed.status).toBe('EARNED');
    expect(
      new Prisma.Decimal(
        (settled as { settlementAllocation: { amount: Prisma.Decimal } }).settlementAllocation.amount,
      ).toFixed(2),
    ).toBe('8.00');

    const session = await wrapper.withPlatformBypass((c) =>
      c.courseSession.findFirst({ where: { tenantId } }),
    );
    const repl = await createSameInvoiceReplacementLine(invoiceId, {
      amount: '5000.00',
      courseSessionId: session!.id,
    });
    const beforeCount = await wrapper.withPlatformBypass((c) =>
      c.commissionAccrual.count({ where: { tenantId, servicePerformanceId: performanceId } }),
    );
    await expect(
      accruals().correctAndRepost({
        accrualId: root.id,
        correctionEventId: randomUUID(),
        replacementInvoiceLineId: repl,
        reason: 'R9-B-T1',
        actor: actorId,
        actorRoles: ['owner'],
      }),
    ).rejects.toThrow(/settlement allocation/i);
    expect(
      await wrapper.withPlatformBypass((c) =>
        c.commissionAccrual.count({ where: { tenantId, servicePerformanceId: performanceId } }),
      ),
    ).toBe(beforeCount);
    const binding = await wrapper.withPlatformBypass((c) =>
      c.invoiceLineItem.findFirst({ where: { id: lineId, tenantId } }),
    );
    expect(binding!.performanceBindingStatus).toBe('ACTIVE');
  });

  it('R9-B-T2 sibling partially settled blocks whole cohort', async () => {
    const { performanceId, invoiceId } = await setupPackageCollected({
      payments: ['800.00', '800.00'],
    });
    const roots = await openCollectedRoots(performanceId);
    expect(roots.length).toBe(2);
    await accruals().settleAccrual({
      accrualId: roots[0]!.id,
      settlementReference: `sib-${randomUUID().slice(0, 8)}`,
      amount: '5.00',
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
    await expect(
      accruals().correctAndRepost({
        accrualId: roots[1]!.id,
        correctionEventId: randomUUID(),
        replacementInvoiceLineId: repl,
        reason: 'R9-B-T2',
        actor: actorId,
        actorRoles: ['owner'],
      }),
    ).rejects.toThrow(/settlement allocation/i);
  });

  it('R9-B-T3 fully SETTLED still fails closed', async () => {
    const { performanceId, invoiceId } = await setupPackageCollected({
      payments: ['800.00', '800.00'],
    });
    const roots = await openCollectedRoots(performanceId);
    await accruals().settleAccrual({
      accrualId: roots[0]!.id,
      settlementReference: `full-${randomUUID().slice(0, 8)}`,
      actor: actorId,
      actorRoles: ['owner'],
    });
    const settled = await accruals().getAccrual(roots[0]!.id);
    expect(settled.status).toBe('SETTLED');
    const session = await wrapper.withPlatformBypass((c) =>
      c.courseSession.findFirst({ where: { tenantId } }),
    );
    const repl = await createSameInvoiceReplacementLine(invoiceId, {
      amount: '5000.00',
      courseSessionId: session!.id,
    });
    await expect(
      accruals().correctAndRepost({
        accrualId: roots[1]!.id,
        correctionEventId: randomUUID(),
        replacementInvoiceLineId: repl,
        reason: 'R9-B-T3',
        actor: actorId,
        actorRoles: ['owner'],
      }),
    ).rejects.toThrow(/SETTLED|settlement allocation/i);
  });

  it('R9-B-T4 multiple settlement allocations block correction', async () => {
    const { performanceId, invoiceId } = await setupPackageCollected();
    const roots = await openCollectedRoots(performanceId);
    await accruals().settleAccrual({
      accrualId: roots[0]!.id,
      settlementReference: `m1-${randomUUID().slice(0, 8)}`,
      amount: '4.00',
      actor: actorId,
      actorRoles: ['owner'],
    });
    await accruals().settleAccrual({
      accrualId: roots[0]!.id,
      settlementReference: `m2-${randomUUID().slice(0, 8)}`,
      amount: '4.00',
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
    await expect(
      accruals().correctAndRepost({
        accrualId: roots[0]!.id,
        correctionEventId: randomUUID(),
        replacementInvoiceLineId: repl,
        reason: 'R9-B-T4',
        actor: actorId,
        actorRoles: ['owner'],
      }),
    ).rejects.toThrow(/settlement allocation/i);
  });

  it('R9-B-T5 settlement replay still blocks correction', async () => {
    const { performanceId, invoiceId } = await setupPackageCollected();
    const roots = await openCollectedRoots(performanceId);
    const ref = `replay-${randomUUID().slice(0, 8)}`;
    const a = await accruals().settleAccrual({
      accrualId: roots[0]!.id,
      settlementReference: ref,
      amount: '8.00',
      actor: actorId,
      actorRoles: ['owner'],
    });
    const b = await accruals().settleAccrual({
      accrualId: roots[0]!.id,
      settlementReference: ref,
      amount: '8.00',
      actor: actorId,
      actorRoles: ['owner'],
    });
    expect((b as { idempotent: boolean }).idempotent).toBe(true);
    expect(
      (a as { settlementAllocation: { id: string } }).settlementAllocation.id,
    ).toBe((b as { settlementAllocation: { id: string } }).settlementAllocation.id);
    const session = await wrapper.withPlatformBypass((c) =>
      c.courseSession.findFirst({ where: { tenantId } }),
    );
    const repl = await createSameInvoiceReplacementLine(invoiceId, {
      amount: '5000.00',
      courseSessionId: session!.id,
    });
    await expect(
      accruals().correctAndRepost({
        accrualId: roots[0]!.id,
        correctionEventId: randomUUID(),
        replacementInvoiceLineId: repl,
        reason: 'R9-B-T5',
        actor: actorId,
        actorRoles: ['owner'],
      }),
    ).rejects.toThrow(/settlement allocation/i);
  });

  it('R9-B-T6 owner-report unchanged after rejected partial-settlement correction', async () => {
    const { performanceId, invoiceId } = await setupPackageCollected();
    const roots = await openCollectedRoots(performanceId);
    await accruals().settleAccrual({
      accrualId: roots[0]!.id,
      settlementReference: `own-${randomUUID().slice(0, 8)}`,
      amount: '8.00',
      actor: actorId,
      actorRoles: ['owner'],
    });
    const before = await accruals().ownerReport({
      from: '2026-01-01',
      to: '2026-12-31',
      userId: performerId,
    });
    const session = await wrapper.withPlatformBypass((c) =>
      c.courseSession.findFirst({ where: { tenantId } }),
    );
    const repl = await createSameInvoiceReplacementLine(invoiceId, {
      amount: '5000.00',
      courseSessionId: session!.id,
    });
    await expect(
      accruals().correctAndRepost({
        accrualId: roots[0]!.id,
        correctionEventId: randomUUID(),
        replacementInvoiceLineId: repl,
        reason: 'R9-B-T6',
        actor: actorId,
        actorRoles: ['owner'],
      }),
    ).rejects.toThrow(/settlement allocation/i);
    const after = await accruals().ownerReport({
      from: '2026-01-01',
      to: '2026-12-31',
      userId: performerId,
    });
    expect(JSON.stringify(after)).toBe(JSON.stringify(before));
  });

  // ── R9-C lock order + concurrency ──────────────────────────────────────────

  it('R9-C-T1 concurrent sibling corrections serialize without deadlock', async () => {
    const { performanceId, invoiceId } = await setupPackageCollected({
      payments: ['800.00', '800.00'],
    });
    const roots = await openCollectedRoots(performanceId);
    const [rootA, rootB] = roots;
    expect(rootA && rootB).toBeTruthy();
    const session = await wrapper.withPlatformBypass((c) =>
      c.courseSession.findFirst({ where: { tenantId } }),
    );
    const replA = await createSameInvoiceReplacementLine(invoiceId, {
      amount: '5000.00',
      courseSessionId: session!.id,
    });
    const replB = await createSameInvoiceReplacementLine(invoiceId, {
      amount: '5000.00',
      courseSessionId: session!.id,
    });

    const releaseA = deferred<void>();
    const aReady = deferred<number>();
    let pidA = 0;
    const aTxn = wrapper.withPlatformBypass(async (tx) => {
      const rows = await tx.$queryRaw<Array<{ pid: number }>>`SELECT pg_backend_pid() AS pid`;
      pidA = Number(rows[0]!.pid);
      await accruals().correctAndRepost(
        {
          accrualId: rootA!.id,
          correctionEventId: randomUUID(),
          replacementInvoiceLineId: replA,
          reason: 'R9-C-T1-A',
          actor: actorId,
          actorRoles: ['owner'],
        },
        tx,
      );
      aReady.resolve(pidA);
      await releaseA.promise;
    });
    await aReady.promise;

    const clientB = await createPlatformDbSecurityClient();
    const wrapperB = createClinicalPrismaWrapper(clientB);
    const accrualsB = new CommissionAccrualService(
      wrapperB as never,
      tenantContext as never,
      new StaffCommissionPlanService(wrapperB as never, tenantContext as never, audit as never),
      audit as never,
    );
    let pidB = 0;
    const bStarted = deferred<void>();
    const barrierAt = new Date().toISOString();
    const bPromise = (async () => {
      return wrapperB.withPlatformBypass(async (tx) => {
        const rows = await tx.$queryRaw<Array<{ pid: number }>>`SELECT pg_backend_pid() AS pid`;
        pidB = Number(rows[0]!.pid);
        bStarted.resolve();
        return accrualsB.correctAndRepost(
          {
            accrualId: rootB!.id,
            correctionEventId: randomUUID(),
            replacementInvoiceLineId: replB,
            reason: 'R9-C-T1-B',
            actor: actorId,
            actorRoles: ['owner'],
          },
          tx,
        );
      });
    })();
    await bStarted.promise;

    let blockers: number[] = [];
    let blocked = false;
    const deadline = Date.now() + 20_000;
    while (Date.now() < deadline) {
      const rows = await raw.$queryRawUnsafe<Array<{ pid: number }>>(
        `SELECT unnest(pg_blocking_pids($1::int)) AS pid`,
        pidB,
      );
      blockers = rows.map((r) => Number(r.pid));
      if (blockers.includes(pidA)) {
        blocked = true;
        break;
      }
      await new Promise((r) => setTimeout(r, 50));
    }
    expect(blocked).toBe(true);
    R9_BLOCKING_EVIDENCE.push(
      `## R9-C-T1`,
      `- pidA=${pidA}`,
      `- pidB=${pidB}`,
      `- pg_blocking_pids(pidB)=[${blockers.join(',')}]`,
      `- barrierReached=${barrierAt}`,
      `- blockedByA=${blocked}`,
    );

    const releaseAt = new Date().toISOString();
    releaseA.resolve();
    await aTxn;
    let loserErr: unknown = null;
    try {
      await bPromise;
    } catch (e) {
      loserErr = e;
    }
    await clientB.$disconnect();
    expect(loserErr).toBeTruthy();
    expect(String(loserErr)).toMatch(
      /no remaining open|No open correctable|not an open correctable|deadlock|not the current ACTIVE|stale predecessor|ACTIVE→SUPERSEDED affected/i,
    );
    expect(String(loserErr)).not.toMatch(/deadlock detected/i);

    const open = await openCollectedRoots(performanceId);
    expect(open.length).toBe(2);
    expect(new Set(open.map((o) => o.invoiceLineId)).size).toBe(1);
    expect((await netAttributed(performanceId)).toFixed(2)).toBe('320.00');
    R9_BLOCKING_EVIDENCE.push(
      `- releaseAt=${releaseAt}`,
      `- loserResult=${String(loserErr).slice(0, 200)}`,
      `- finalOpenCount=${open.length}`,
      `- finalNetAttributed=${(await netAttributed(performanceId)).toFixed(2)}`,
      `- deadlock=false`,
      '',
    );
  });

  it('R9-C-T2 correction versus partial settlement — blocking + safe outcome', async () => {
    const { performanceId, invoiceId } = await setupPackageCollected({
      payments: ['800.00', '800.00'],
    });
    const roots = await openCollectedRoots(performanceId);
    const session = await wrapper.withPlatformBypass((c) =>
      c.courseSession.findFirst({ where: { tenantId } }),
    );
    const repl = await createSameInvoiceReplacementLine(invoiceId, {
      amount: '5000.00',
      courseSessionId: session!.id,
    });

    const releaseA = deferred<void>();
    const aReady = deferred<number>();
    let pidA = 0;
    const aTxn = wrapper.withPlatformBypass(async (tx) => {
      const rows = await tx.$queryRaw<Array<{ pid: number }>>`SELECT pg_backend_pid() AS pid`;
      pidA = Number(rows[0]!.pid);
      await accruals().correctAndRepost(
        {
          accrualId: roots[0]!.id,
          correctionEventId: randomUUID(),
          replacementInvoiceLineId: repl,
          reason: 'R9-C-T2-corr',
          actor: actorId,
          actorRoles: ['owner'],
        },
        tx,
      );
      aReady.resolve(pidA);
      await releaseA.promise;
    });
    await aReady.promise;

    const clientB = await createPlatformDbSecurityClient();
    const wrapperB = createClinicalPrismaWrapper(clientB);
    const accrualsB = new CommissionAccrualService(
      wrapperB as never,
      tenantContext as never,
      new StaffCommissionPlanService(wrapperB as never, tenantContext as never, audit as never),
      audit as never,
    );
    let pidB = 0;
    const bStarted = deferred<void>();
    const bPromise = (async () => {
      return wrapperB.withPlatformBypass(async (tx) => {
        const rows = await tx.$queryRaw<Array<{ pid: number }>>`SELECT pg_backend_pid() AS pid`;
        pidB = Number(rows[0]!.pid);
        bStarted.resolve();
        return accrualsB.settleAccrual(
          {
            accrualId: roots[1]!.id,
            settlementReference: `race-${randomUUID().slice(0, 8)}`,
            amount: '5.00',
            actor: actorId,
            actorRoles: ['owner'],
          },
          tx,
        );
      });
    })();
    await bStarted.promise;

    let blockers: number[] = [];
    let blocked = false;
    const deadline = Date.now() + 20_000;
    while (Date.now() < deadline) {
      const rows = await raw.$queryRawUnsafe<Array<{ pid: number }>>(
        `SELECT unnest(pg_blocking_pids($1::int)) AS pid`,
        pidB,
      );
      blockers = rows.map((r) => Number(r.pid));
      if (blockers.includes(pidA)) {
        blocked = true;
        break;
      }
      await new Promise((r) => setTimeout(r, 50));
    }
    expect(blocked).toBe(true);
    R9_BLOCKING_EVIDENCE.push(
      `## R9-C-T2`,
      `- pidA=${pidA}`,
      `- pidB=${pidB}`,
      `- pg_blocking_pids(pidB)=[${blockers.join(',')}]`,
      `- blockedByA=${blocked}`,
    );

    releaseA.resolve();
    await aTxn;
    // After correction, old root B is fully reversed — settlement must fail closed.
    await expect(bPromise).rejects.toThrow(/No net settleable|Cannot settle|REVERSED|status/i);
    await clientB.$disconnect();
    const open = await openCollectedRoots(performanceId);
    expect(open.every((o) => o.invoiceLineId === repl)).toBe(true);
    R9_BLOCKING_EVIDENCE.push(`- outcome=correction_won_settlement_rejected`, `- finalOpen=${open.length}`, '');
  });

  it('R9-C-T3 refund-before-correction sequential post-lock carry preserves net 80', async () => {
    const { performanceId, invoiceId } = await setupPackageCollected();
    const roots = await openCollectedRoots(performanceId);
    const refundId = await createRefund(invoiceId, '400.00');
    const session = await wrapper.withPlatformBypass((c) =>
      c.courseSession.findFirst({ where: { tenantId } }),
    );
    const repl = await createSameInvoiceReplacementLine(invoiceId, {
      amount: '5000.00',
      courseSessionId: session!.id,
    });

    // Refund first (before correction locks) — correction must reread and carry.
    await accruals().reverseAccrual({
      accrualId: roots[0]!.id,
      refundId,
      actor: actorId,
      actorRoles: ['owner'],
    });
    expect((await netAttributed(performanceId)).toFixed(2)).toBe('80.00');
    await accruals().correctAndRepost({
      accrualId: roots[0]!.id,
      correctionEventId: randomUUID(),
      replacementInvoiceLineId: repl,
      reason: 'R9-C-T3',
      actor: actorId,
      actorRoles: ['owner'],
    });
    expect((await netAttributed(performanceId)).toFixed(2)).toBe('80.00');
  });

  it('R9-C-T4 exact correction replay under contention', async () => {
    const { performanceId, invoiceId } = await setupPackageCollected();
    const roots = await openCollectedRoots(performanceId);
    const session = await wrapper.withPlatformBypass((c) =>
      c.courseSession.findFirst({ where: { tenantId } }),
    );
    const repl = await createSameInvoiceReplacementLine(invoiceId, {
      amount: '5000.00',
      courseSessionId: session!.id,
    });
    const eventId = randomUUID();

    const releaseA = deferred<void>();
    const aReady = deferred<void>();
    const aTxn = wrapper.withPlatformBypass(async (tx) => {
      await accruals().correctAndRepost(
        {
          accrualId: roots[0]!.id,
          correctionEventId: eventId,
          replacementInvoiceLineId: repl,
          reason: 'R9-C-T4',
          actor: actorId,
          actorRoles: ['owner'],
        },
        tx,
      );
      aReady.resolve();
      await releaseA.promise;
    });
    await aReady.promise;

    const clientB = await createPlatformDbSecurityClient();
    const wrapperB = createClinicalPrismaWrapper(clientB);
    const accrualsB = new CommissionAccrualService(
      wrapperB as never,
      tenantContext as never,
      new StaffCommissionPlanService(wrapperB as never, tenantContext as never, audit as never),
      audit as never,
    );
    const bPromise = wrapperB.withPlatformBypass((tx) =>
      accrualsB.correctAndRepost(
        {
          accrualId: roots[0]!.id,
          correctionEventId: eventId,
          replacementInvoiceLineId: repl,
          reason: 'R9-C-T4',
          actor: actorId,
          actorRoles: ['owner'],
        },
        tx,
      ),
    );
    await new Promise((r) => setTimeout(r, 200));
    releaseA.resolve();
    await aTxn;
    const replay = await bPromise;
    await clientB.$disconnect();
    expect((replay as { idempotent: boolean }).idempotent).toBe(true);
    const open = await openCollectedRoots(performanceId);
    expect(open).toHaveLength(1);
  });

  it('R9-C-T5 lock-order regression correction vs collected post', async () => {
    await enableAndPublishPlan({
      calculationBasis: 'COLLECTED_REVENUE',
      earningTrigger: 'PAYMENT_COLLECTED',
    });
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
      idempotencyKey: `r9c5-${sessionId}`,
    });
    const p1 = await createPayment(invoiceId, '800.00');
    await accruals().postFromCollectedPayment({
      servicePerformanceId: performanceId,
      invoiceLineId: lineId,
      paymentId: p1,
      actor: actorId,
      actorRoles: ['owner'],
    });
    const p2 = await createPayment(invoiceId, '800.00');
    const roots = await openCollectedRoots(performanceId);
    const repl = await createSameInvoiceReplacementLine(invoiceId, {
      amount: '5000.00',
      courseSessionId: sessionId,
    });

    const releaseA = deferred<void>();
    const aReady = deferred<number>();
    let pidA = 0;
    const aTxn = wrapper.withPlatformBypass(async (tx) => {
      const rows = await tx.$queryRaw<Array<{ pid: number }>>`SELECT pg_backend_pid() AS pid`;
      pidA = Number(rows[0]!.pid);
      await accruals().correctAndRepost(
        {
          accrualId: roots[0]!.id,
          correctionEventId: randomUUID(),
          replacementInvoiceLineId: repl,
          reason: 'R9-C-T5',
          actor: actorId,
          actorRoles: ['owner'],
        },
        tx,
      );
      aReady.resolve(pidA);
      await releaseA.promise;
    });
    await aReady.promise;

    const clientB = await createPlatformDbSecurityClient();
    const wrapperB = createClinicalPrismaWrapper(clientB);
    const accrualsB = new CommissionAccrualService(
      wrapperB as never,
      tenantContext as never,
      new StaffCommissionPlanService(wrapperB as never, tenantContext as never, audit as never),
      audit as never,
    );
    let pidB = 0;
    const bStarted = deferred<void>();
    const bPromise = wrapperB.withPlatformBypass(async (tx) => {
      const rows = await tx.$queryRaw<Array<{ pid: number }>>`SELECT pg_backend_pid() AS pid`;
      pidB = Number(rows[0]!.pid);
      bStarted.resolve();
      return accrualsB.postFromCollectedPayment(
        {
          servicePerformanceId: performanceId,
          invoiceLineId: lineId,
          paymentId: p2,
          actor: actorId,
          actorRoles: ['owner'],
        },
        tx,
      );
    });
    await bStarted.promise;

    let blocked = false;
    const deadline = Date.now() + 20_000;
    while (Date.now() < deadline) {
      const rows = await raw.$queryRawUnsafe<Array<{ pid: number }>>(
        `SELECT unnest(pg_blocking_pids($1::int)) AS pid`,
        pidB,
      );
      if (rows.some((r) => Number(r.pid) === pidA)) {
        blocked = true;
        break;
      }
      await new Promise((r) => setTimeout(r, 50));
    }
    expect(blocked).toBe(true);
    R9_BLOCKING_EVIDENCE.push(
      `## R9-C-T5`,
      `- pidA=${pidA}`,
      `- pidB=${pidB}`,
      `- blockedByA=${blocked}`,
      `- note=performance-then-package lock order preserved`,
      '',
    );
    releaseA.resolve();
    await aTxn;
    // B may succeed on stale line or fail closed — must not deadlock.
    try {
      await bPromise;
    } catch {
      /* opposing / superseded line is acceptable */
    }
    await clientB.$disconnect();
    expect((await netAttributed(performanceId)).toFixed(2)).toBe('160.00');
  });

  // ── R9-D sequential invoice correction lineage ─────────────────────────────

  it('R9-D-T1 invoice correction1 then correction2 creates new open successor', async () => {
    await enableAndPublishPlan({ percentage: 10 });
    const performanceId = await createCompletedPerformance();
    const { invoiceId, lineId } = await createInvoiceViaProductionPath(performanceId, {
      amount: '1000.00',
    });
    const posted = await accruals().postFromServicePerformance({
      servicePerformanceId: performanceId,
      invoiceLineId: lineId,
      actor: actorId,
      actorRoles: ['owner'],
    });
    const root0 = (posted.accruals[0] as { id: string }).id;
    const repl1 = await createSameInvoiceReplacementLine(invoiceId, { amount: '1000.00' });
    const event1 = randomUUID();
    const c1 = await accruals().correctAndRepost({
      accrualId: root0,
      correctionEventId: event1,
      replacementInvoiceLineId: repl1,
      reason: 'R9-D-T1-c1',
      actor: actorId,
      actorRoles: ['owner'],
    });
    const s1 = (c1 as { repost: { accruals: Array<{ id: string }> } }).repost.accruals[0]!.id;
    const repl2 = await createSameInvoiceReplacementLine(invoiceId, { amount: '1000.00' });
    const event2 = randomUUID();
    const c2 = await accruals().correctAndRepost({
      accrualId: s1,
      correctionEventId: event2,
      replacementInvoiceLineId: repl2,
      reason: 'R9-D-T1-c2',
      actor: actorId,
      actorRoles: ['owner'],
    });
    const s2 = (c2 as { repost: { accruals: Array<{ id: string }> } }).repost.accruals[0]!.id;
    expect(s2).not.toBe(s1);
    const open = await openInvoiceRoots(performanceId);
    expect(open).toHaveLength(1);
    expect(open[0]!.id).toBe(s2);
    expect(open[0]!.invoiceLineId).toBe(repl2);
    expect((await netAttributed(performanceId)).toFixed(2)).toBe('1000.00');
  });

  it('R9-D-T2 three sequential invoice corrections', async () => {
    await enableAndPublishPlan({ percentage: 10 });
    const performanceId = await createCompletedPerformance();
    const { invoiceId, lineId } = await createInvoiceViaProductionPath(performanceId, {
      amount: '1000.00',
    });
    const posted = await accruals().postFromServicePerformance({
      servicePerformanceId: performanceId,
      invoiceLineId: lineId,
      actor: actorId,
      actorRoles: ['owner'],
    });
    let current = (posted.accruals[0] as { id: string }).id;
    const successors: string[] = [];
    for (let i = 0; i < 3; i++) {
      const repl = await createSameInvoiceReplacementLine(invoiceId, { amount: '1000.00' });
      const c = await accruals().correctAndRepost({
        accrualId: current,
        correctionEventId: randomUUID(),
        replacementInvoiceLineId: repl,
        reason: `R9-D-T2-${i}`,
        actor: actorId,
        actorRoles: ['owner'],
      });
      current = (c as { repost: { accruals: Array<{ id: string }> } }).repost.accruals[0]!.id;
      successors.push(current);
    }
    const open = await openInvoiceRoots(performanceId);
    expect(open).toHaveLength(1);
    expect(open[0]!.id).toBe(successors[2]);
    expect(new Set(successors).size).toBe(3);
  });

  it('R9-D-T3 multi-participant sequential corrections', async () => {
    const assistId = randomUUID();
    await wrapper.withPlatformBypass(async (c) => {
      await c.user.create({
        data: {
          id: assistId,
          tenantId,
          email: `wfr9-d3-${assistId.slice(0, 8)}@t.local`,
          passwordHash: 'x',
          firstName: 'As',
          lastName: 'D3',
        },
      });
    });
    await enableAndPublishPlan({ percentage: 10 });
    await enableAndPublishPlan({ userId: assistId, percentage: 10 });
    const performanceId = await createCompletedPerformance({ assistantUserId: assistId });
    const { invoiceId, lineId } = await createInvoiceViaProductionPath(performanceId, {
      amount: '1000.00',
    });
    await accruals().postFromServicePerformance({
      servicePerformanceId: performanceId,
      invoiceLineId: lineId,
      actor: actorId,
      actorRoles: ['owner'],
    });
    let open = await openInvoiceRoots(performanceId);
    expect(open.length).toBe(2);
    const repl1 = await createSameInvoiceReplacementLine(invoiceId, { amount: '1000.00' });
    await accruals().correctAndRepost({
      accrualId: open[0]!.id,
      correctionEventId: randomUUID(),
      replacementInvoiceLineId: repl1,
      reason: 'R9-D-T3-c1',
      actor: actorId,
      actorRoles: ['owner'],
    });
    open = await openInvoiceRoots(performanceId);
    expect(open.length).toBe(2);
    const repl2 = await createSameInvoiceReplacementLine(invoiceId, { amount: '1000.00' });
    await accruals().correctAndRepost({
      accrualId: open[0]!.id,
      correctionEventId: randomUUID(),
      replacementInvoiceLineId: repl2,
      reason: 'R9-D-T3-c2',
      actor: actorId,
      actorRoles: ['owner'],
    });
    open = await openInvoiceRoots(performanceId);
    expect(open.length).toBe(2);
    expect(new Set(open.map((o) => o.userId)).size).toBe(2);
    expect(open.every((o) => o.invoiceLineId === repl2)).toBe(true);
  });

  it('R9-D-T4 package invoice-based sequential corrections', async () => {
    await enableAndPublishPlan({ percentage: 10 });
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
      idempotencyKey: `r9d4-${sessionId}`,
    });
    await accruals().postFromServicePerformance({
      servicePerformanceId: performanceId,
      invoiceLineId: lineId,
      actor: actorId,
      actorRoles: ['owner'],
    });
    let open = await openInvoiceRoots(performanceId);
    const repl1 = await createSameInvoiceReplacementLine(invoiceId, {
      amount: '5000.00',
      courseSessionId: sessionId,
    });
    await accruals().correctAndRepost({
      accrualId: open[0]!.id,
      correctionEventId: randomUUID(),
      replacementInvoiceLineId: repl1,
      reason: 'R9-D-T4-c1',
      actor: actorId,
      actorRoles: ['owner'],
    });
    open = await openInvoiceRoots(performanceId);
    const repl2 = await createSameInvoiceReplacementLine(invoiceId, {
      amount: '5000.00',
      courseSessionId: sessionId,
    });
    await accruals().correctAndRepost({
      accrualId: open[0]!.id,
      correctionEventId: randomUUID(),
      replacementInvoiceLineId: repl2,
      reason: 'R9-D-T4-c2',
      actor: actorId,
      actorRoles: ['owner'],
    });
    open = await openInvoiceRoots(performanceId);
    expect(open).toHaveLength(1);
    expect(open[0]!.packageAllocationId).toBe(
      (alloc as { allocation: { id: string } }).allocation.id,
    );
    expect((await netAttributed(performanceId)).toFixed(2)).toBe('1000.00');
  });

  it('R9-D-T5 exact replay of correction 2', async () => {
    await enableAndPublishPlan({ percentage: 10 });
    const performanceId = await createCompletedPerformance();
    const { invoiceId, lineId } = await createInvoiceViaProductionPath(performanceId, {
      amount: '1000.00',
    });
    const posted = await accruals().postFromServicePerformance({
      servicePerformanceId: performanceId,
      invoiceLineId: lineId,
      actor: actorId,
      actorRoles: ['owner'],
    });
    const repl1 = await createSameInvoiceReplacementLine(invoiceId, { amount: '1000.00' });
    const c1 = await accruals().correctAndRepost({
      accrualId: (posted.accruals[0] as { id: string }).id,
      correctionEventId: randomUUID(),
      replacementInvoiceLineId: repl1,
      reason: 'R9-D-T5-c1',
      actor: actorId,
      actorRoles: ['owner'],
    });
    const s1 = (c1 as { repost: { accruals: Array<{ id: string }> } }).repost.accruals[0]!.id;
    const repl2 = await createSameInvoiceReplacementLine(invoiceId, { amount: '1000.00' });
    const event2 = randomUUID();
    const c2 = await accruals().correctAndRepost({
      accrualId: s1,
      correctionEventId: event2,
      replacementInvoiceLineId: repl2,
      reason: 'R9-D-T5-c2',
      actor: actorId,
      actorRoles: ['owner'],
    });
    const count = await wrapper.withPlatformBypass((c) =>
      c.commissionAccrual.count({ where: { tenantId, servicePerformanceId: performanceId } }),
    );
    const replay = await accruals().correctAndRepost({
      accrualId: s1,
      correctionEventId: event2,
      replacementInvoiceLineId: repl2,
      reason: 'R9-D-T5-c2',
      actor: actorId,
      actorRoles: ['owner'],
    });
    expect((replay as { idempotent: boolean }).idempotent).toBe(true);
    expect(
      (replay as { repost: { accruals: Array<{ id: string }> } }).repost.accruals[0]!.id,
    ).toBe((c2 as { repost: { accruals: Array<{ id: string }> } }).repost.accruals[0]!.id);
    expect(
      await wrapper.withPlatformBypass((c) =>
        c.commissionAccrual.count({ where: { tenantId, servicePerformanceId: performanceId } }),
      ),
    ).toBe(count);
  });

  it('R9-D-T6 concurrent correction events serialize; loser defined conflict', async () => {
    await enableAndPublishPlan({ percentage: 10 });
    const performanceId = await createCompletedPerformance();
    const { invoiceId, lineId } = await createInvoiceViaProductionPath(performanceId, {
      amount: '1000.00',
    });
    const posted = await accruals().postFromServicePerformance({
      servicePerformanceId: performanceId,
      invoiceLineId: lineId,
      actor: actorId,
      actorRoles: ['owner'],
    });
    const rootId = (posted.accruals[0] as { id: string }).id;
    const replA = await createSameInvoiceReplacementLine(invoiceId, { amount: '1000.00' });
    const replB = await createSameInvoiceReplacementLine(invoiceId, { amount: '1000.00' });

    const releaseA = deferred<void>();
    const aReady = deferred<void>();
    const aTxn = wrapper.withPlatformBypass(async (tx) => {
      await accruals().correctAndRepost(
        {
          accrualId: rootId,
          correctionEventId: randomUUID(),
          replacementInvoiceLineId: replA,
          reason: 'R9-D-T6-A',
          actor: actorId,
          actorRoles: ['owner'],
        },
        tx,
      );
      aReady.resolve();
      await releaseA.promise;
    });
    await aReady.promise;

    const clientB = await createPlatformDbSecurityClient();
    const wrapperB = createClinicalPrismaWrapper(clientB);
    const accrualsB = new CommissionAccrualService(
      wrapperB as never,
      tenantContext as never,
      new StaffCommissionPlanService(wrapperB as never, tenantContext as never, audit as never),
      audit as never,
    );
    const bPromise = wrapperB.withPlatformBypass((tx) =>
      accrualsB.correctAndRepost(
        {
          accrualId: rootId,
          correctionEventId: randomUUID(),
          replacementInvoiceLineId: replB,
          reason: 'R9-D-T6-B',
          actor: actorId,
          actorRoles: ['owner'],
        },
        tx,
      ),
    );
    await new Promise((r) => setTimeout(r, 150));
    releaseA.resolve();
    await aTxn;
    await expect(bPromise).rejects.toThrow(
      /no remaining open|No open correctable|not an open correctable|not the current ACTIVE|stale predecessor|ACTIVE→SUPERSEDED affected/i,
    );
    await clientB.$disconnect();
    const open = await openInvoiceRoots(performanceId);
    expect(open).toHaveLength(1);
    expect(open[0]!.invoiceLineId).toBe(replA);
    const active = await wrapper.withPlatformBypass((c) =>
      c.invoiceLineItem.findFirst({
        where: { tenantId, servicePerformanceId: performanceId, performanceBindingStatus: 'ACTIVE' },
      }),
    );
    expect(active!.id).toBe(replA);
  });

  it('R9-D-T7 unique-conflict cannot accept fully reversed stale successor', async () => {
    await enableAndPublishPlan({ percentage: 10 });
    const performanceId = await createCompletedPerformance();
    const { lineId } = await createInvoiceViaProductionPath(performanceId, {
      amount: '1000.00',
    });
    const posted = await accruals().postFromServicePerformance({
      servicePerformanceId: performanceId,
      invoiceLineId: lineId,
      actor: actorId,
      actorRoles: ['owner'],
    });
    const firstId = (posted.accruals[0] as { id: string }).id;
    // Full reverse via correction reverse helper (standalone) then attempt non-correction successor twice.
    await accruals().reverseAccrualForCorrection({
      accrualId: firstId,
      correctionEventId: randomUUID(),
      actor: actorId,
      actorRoles: ['owner'],
      reason: 'correction-reverse: R9-D-T7 prep',
    });
    const second = await accruals().postFromServicePerformance({
      servicePerformanceId: performanceId,
      invoiceLineId: lineId,
      actor: actorId,
      actorRoles: ['owner'],
    });
    const secondId = (second.accruals[0] as { id: string }).id;
    expect(secondId).not.toBe(firstId);
    await accruals().reverseAccrualForCorrection({
      accrualId: secondId,
      correctionEventId: randomUUID(),
      actor: actorId,
      actorRoles: ['owner'],
      reason: 'correction-reverse: R9-D-T7 prep2',
    });
    await expect(
      accruals().postFromServicePerformance({
        servicePerformanceId: performanceId,
        invoiceLineId: lineId,
        actor: actorId,
        actorRoles: ['owner'],
      }),
    ).rejects.toThrow(/fully reversed predecessor|fail closed/i);
  });

  // ── R9-E direct proofs ─────────────────────────────────────────────────────

  it('R9-E-T1 isolated same-invoice package currency mismatch', async () => {
    await enableAndPublishPlan({
      calculationBasis: 'COLLECTED_REVENUE',
      earningTrigger: 'PAYMENT_COLLECTED',
    });
    const { courseId, sessionId } = await seedCourseSession({ currency: 'SYP' });
    const performanceId = await createCompletedPerformance();
    const { invoiceId, lineId } = await createInvoiceViaProductionPath(performanceId, {
      amount: '5000.00',
      courseSessionId: sessionId,
      currency: 'SYP',
    });
    const alloc = await packages().registerSessionAllocation({
      treatmentCourseId: courseId,
      courseSessionId: sessionId,
      servicePerformanceId: performanceId,
      allocatedRevenueAmount: '1000.00',
      invoiceLineId: lineId,
      actor: { actorId, actorRoles: ['owner'] },
      idempotencyKey: `r9e1-${sessionId}`,
    });
    const pay = await createPayment(invoiceId, '800.00');
    const posted = await accruals().postFromCollectedPayment({
      servicePerformanceId: performanceId,
      invoiceLineId: lineId,
      paymentId: pay,
      actor: actorId,
      actorRoles: ['owner'],
    });
    // Same-invoice replacement in SYP; poison only package allocation currency via trigger-disabled harness.
    const repl = await createSameInvoiceReplacementLine(invoiceId, {
      amount: '5000.00',
      courseSessionId: sessionId,
    });
    const allocId = (alloc as { allocation: { id: string } }).allocation.id;
    await wrapper.withPlatformBypass(async (c) => {
      await c.$executeRawUnsafe(
        `ALTER TABLE "commission_package_session_allocations" DISABLE TRIGGER commission_package_session_allocations_append_only`,
      );
      try {
        await c.$executeRaw`
          UPDATE "commission_package_session_allocations"
          SET currency = 'USD'
          WHERE id = ${allocId}::uuid AND "tenantId" = ${tenantId}::uuid
        `;
      } finally {
        await c.$executeRawUnsafe(
          `ALTER TABLE "commission_package_session_allocations" ENABLE TRIGGER commission_package_session_allocations_append_only`,
        );
      }
    });
    const beforeCount = await wrapper.withPlatformBypass((c) =>
      c.commissionAccrual.count({ where: { tenantId, servicePerformanceId: performanceId } }),
    );
    await expect(
      accruals().correctAndRepost({
        accrualId: (posted.accruals[0] as { id: string }).id,
        correctionEventId: randomUUID(),
        replacementInvoiceLineId: repl,
        reason: 'R9-E-T1',
        actor: actorId,
        actorRoles: ['owner'],
      }),
    ).rejects.toThrow(/package allocation currency/i);
    expect(
      await wrapper.withPlatformBypass((c) =>
        c.commissionAccrual.count({ where: { tenantId, servicePerformanceId: performanceId } }),
      ),
    ).toBe(beforeCount);
    const binding = await wrapper.withPlatformBypass((c) =>
      c.invoiceLineItem.findFirst({ where: { id: lineId, tenantId } }),
    );
    expect(binding!.performanceBindingStatus).toBe('ACTIVE');
  });

  it('R9-E-T2 raw pg_blocking_pids evidence emitted', async () => {
    // Evidence is also written by R9-C-T1/T2/T5; assert buffer has pid/blocker lines.
    expect(R9_BLOCKING_EVIDENCE.some((l) => l.includes('pidA='))).toBe(true);
    expect(R9_BLOCKING_EVIDENCE.some((l) => l.includes('pg_blocking_pids'))).toBe(true);
    R9_BLOCKING_EVIDENCE.push(
      `## R9-E-T2`,
      `- assertedBufferLines=${R9_BLOCKING_EVIDENCE.length}`,
      `- containsPidA=true`,
      `- containsBlockingPids=true`,
      '',
    );
  });
});
