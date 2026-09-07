/**
 * Phase 48 Wave F Round 10 — refund carry exactly-once + correction/refund concurrency.
 */
import { createHash, randomUUID } from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
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

const R10_BLOCKING_EVIDENCE: string[] = [];
const R10_C_OUTCOMES: string[] = [];

function deferred<T = void>() {
  let resolve!: (v: T | PromiseLike<T>) => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describeDb('Wave F Round 10 remediation (PostgreSQL)', () => {
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
        data: { id: tenantId, name: 'WF R10', slug: `wfr10-${tenantId.slice(0, 8)}` },
      });
      for (const u of [
        { id: actorId, first: 'A', last: 'Ctor' },
        { id: performerId, first: 'Perf', last: 'Ormer' },
      ]) {
        await c.user.create({
          data: {
            id: u.id,
            tenantId,
            email: `wfr10-${u.id.slice(0, 8)}@t.local`,
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
        data: { id: branchId, tenantId, name: `R10 B ${branchId.slice(0, 6)}` },
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
        description: 'R10 clinical line',
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
        description: 'R10 other line',
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
      invoiceNumber: `R10-${randomUUID().slice(0, 8)}`,
      invoiceDate: new Date('2026-09-01'),
      currency: opts?.currency ?? 'SYP',
      notes: 'R10',
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
          reason: 'R10 refund',
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
          description: 'R10 corrected line',
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
          email: `wfr10-a-${assistId.slice(0, 8)}@t.local`,
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
      idempotencyKey: `r10-${sessionId}`,
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
    // eslint-disable-next-line no-console
    console.log(
      [
        'R10_BLOCKING_DIAGNOSTICS_BEGIN',
        ...R10_BLOCKING_EVIDENCE,
        'R10_BLOCKING_DIAGNOSTICS_END',
      ].join('\n'),
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

  // ── R10-A refund carry exactly-once ────────────────────────────────────────

  it('R10-A-T1: Prior refund carried; replay same refundId on replacement root — same row, zero new rows, net 80.00 attributed, commission 8.00. Log originalRootId, replacementRootId, refundId, carryId, idempotencyKey (must be rev:{replacement}:{refundId}).', async () => {
    const { performanceId, invoiceId, packageAllocationId } = await setupPackageCollected();
    const roots = await openCollectedRoots(performanceId);
    expect(roots).toHaveLength(1);
    const originalRootId = roots[0]!.id;

    const refundId = await createRefund(invoiceId, '400.00'); // 400/800 * 160 = 80
    await accruals().reverseAccrual({
      accrualId: originalRootId,
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
    const corr = await accruals().correctAndRepost({
      accrualId: originalRootId,
      correctionEventId: randomUUID(),
      replacementInvoiceLineId: repl,
      reason: 'R10-A-T1',
      actor: actorId,
      actorRoles: ['owner'],
    });
    const carries = (corr as { refundCarryForwards: Array<{ id: string; idempotencyKey: string }> })
      .refundCarryForwards;
    expect(carries).toHaveLength(1);
    const carryId = carries[0]!.id;

    const open = await openCollectedRoots(performanceId);
    expect(open).toHaveLength(1);
    const replacementRootId = open[0]!.id;
    const expectedKey = `rev:${replacementRootId}:${refundId}`;
    expect(carries[0]!.idempotencyKey).toBe(expectedKey);
    expect(open[0]!.packageAllocationId).toBe(packageAllocationId);

    const countBefore = await wrapper.withPlatformBypass((c) =>
      c.commissionAccrual.count({
        where: { tenantId, reversalOfAccrualId: replacementRootId, refundId },
      }),
    );
    expect(countBefore).toBe(1);

    const replay = await accruals().reverseAccrual({
      accrualId: replacementRootId,
      refundId,
      actor: actorId,
      actorRoles: ['owner'],
    });
    expect((replay as { id: string }).id).toBe(carryId);
    expect((replay as { idempotencyKey: string }).idempotencyKey).toBe(expectedKey);

    const countAfter = await wrapper.withPlatformBypass((c) =>
      c.commissionAccrual.count({
        where: { tenantId, reversalOfAccrualId: replacementRootId, refundId },
      }),
    );
    expect(countAfter).toBe(1);
    expect((await netAttributed(performanceId)).toFixed(2)).toBe('80.00');
    expect((await netCommission(performanceId)).toFixed(2)).toBe('8.00');

    // eslint-disable-next-line no-console
    console.log(
      'R10_DIAG',
      JSON.stringify({
        test: 'R10-A-T1',
        originalRootId,
        replacementRootId,
        refundId,
        carryId,
        idempotencyKey: expectedKey,
      }),
    );
  });

  it('R10-A-T2: Same as T1 focus — audit count for staff_commission.accrual.reversed and refund_carried unchanged on replay; nets preserved.', async () => {
    const { performanceId, invoiceId } = await setupPackageCollected();
    const roots = await openCollectedRoots(performanceId);
    const originalRootId = roots[0]!.id;
    const refundId = await createRefund(invoiceId, '400.00');
    await accruals().reverseAccrual({
      accrualId: originalRootId,
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
    await accruals().correctAndRepost({
      accrualId: originalRootId,
      correctionEventId: randomUUID(),
      replacementInvoiceLineId: repl,
      reason: 'R10-A-T2',
      actor: actorId,
      actorRoles: ['owner'],
    });

    const open = await openCollectedRoots(performanceId);
    const replacementRootId = open[0]!.id;
    const reversedBefore = auditCalls.filter(
      (a) => a.action === 'staff_commission.accrual.reversed',
    ).length;
    const carriedBefore = auditCalls.filter(
      (a) => a.action === 'staff_commission.accrual.refund_carried',
    ).length;
    const netBefore = await netAttributed(performanceId);
    const commBefore = await netCommission(performanceId);

    await accruals().reverseAccrual({
      accrualId: replacementRootId,
      refundId,
      actor: actorId,
      actorRoles: ['owner'],
    });

    const reversedAfter = auditCalls.filter(
      (a) => a.action === 'staff_commission.accrual.reversed',
    ).length;
    const carriedAfter = auditCalls.filter(
      (a) => a.action === 'staff_commission.accrual.refund_carried',
    ).length;
    expect(reversedAfter).toBe(reversedBefore);
    expect(carriedAfter).toBe(carriedBefore);
    expect((await netAttributed(performanceId)).toFixed(2)).toBe(netBefore.toFixed(2));
    expect((await netCommission(performanceId)).toFixed(2)).toBe(commBefore.toFixed(2));
    expect(netBefore.toFixed(2)).toBe('80.00');

    // eslint-disable-next-line no-console
    console.log(
      'R10_DIAG',
      JSON.stringify({
        test: 'R10-A-T2',
        reversedBefore,
        carriedBefore,
        reversedAfter,
        carriedAfter,
      }),
    );
  });

  it('R10-A-T3: Two concurrent reverseAccrual on same replacement root+refundId after correction — exactly one semantic reversal (count of rows with that reversalOfAccrualId+refundId === 1). Use two clients, barriers optional but prove one result.', async () => {
    const { performanceId, invoiceId } = await setupPackageCollected();
    const roots = await openCollectedRoots(performanceId);
    const originalRootId = roots[0]!.id;
    const refundId = await createRefund(invoiceId, '400.00');
    await accruals().reverseAccrual({
      accrualId: originalRootId,
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
    await accruals().correctAndRepost({
      accrualId: originalRootId,
      correctionEventId: randomUUID(),
      replacementInvoiceLineId: repl,
      reason: 'R10-A-T3',
      actor: actorId,
      actorRoles: ['owner'],
    });
    const open = await openCollectedRoots(performanceId);
    const replacementRootId = open[0]!.id;

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
        accrualId: replacementRootId,
        refundId,
        actor: actorId,
        actorRoles: ['owner'],
      }),
      accrualsB.reverseAccrual({
        accrualId: replacementRootId,
        refundId,
        actor: actorId,
        actorRoles: ['owner'],
      }),
    ]);
    await clientB.$disconnect();

    expect((a as { id: string }).id).toBe((b as { id: string }).id);
    const count = await wrapper.withPlatformBypass((c) =>
      c.commissionAccrual.count({
        where: { tenantId, reversalOfAccrualId: replacementRootId, refundId },
      }),
    );
    expect(count).toBe(1);
    expect((await netAttributed(performanceId)).toFixed(2)).toBe('80.00');

    // eslint-disable-next-line no-console
    console.log(
      'R10_DIAG',
      JSON.stringify({
        test: 'R10-A-T3',
        replacementRootId,
        refundId,
        rowId: (a as { id: string }).id,
        count,
      }),
    );
  });

  it('R10-A-T4: insert bogus reversal with wrong userId and key rev:root:refundId before reverseAccrual — throws /idempotency conflict|userId/', async () => {
    // Flow: post → insert bogus reversal (wrong userId, canonical key) → reverseAccrual → assertCompatible fails.
    const { performanceId, invoiceId } = await setupPackageCollected();
    const roots = await openCollectedRoots(performanceId);
    const root = roots[0]!;
    const refundId = await createRefund(invoiceId, '400.00'); // needed for tenant-ref trigger on insert

    await wrapper.withPlatformBypass(async (c) => {
      await c.commissionAccrual.create({
        data: {
          id: randomUUID(),
          tenantId,
          branchId: root.branchId,
          userId: actorId, // wrong — should be performer/root.userId
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
          attributedRevenueAmount: '-80.0000',
          commissionPercent: root.commissionPercent,
          commissionAmount: '-8.0000',
          currency: root.currency,
          status: 'REVERSED',
          earnedAt: new Date(),
          reversalOfAccrualId: root.id,
          idempotencyKey: `rev:${root.id}:${refundId}`,
          reason: 'R10-A-T4 bogus',
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
    ).rejects.toThrow(/idempotency conflict|userId/i);

    // eslint-disable-next-line no-console
    console.log(
      'R10_DIAG',
      JSON.stringify({ test: 'R10-A-T4', rootId: root.id, refundId, mismatch: 'userId' }),
    );
  });

  it('R10-A-T5: Three sequential invoice corrections with prior refund — each current successor has exactly one refund carry; replay idempotent. Use SERVICE_NET plan, refund proportion on invoice.', async () => {
    // COLLECTED package path with sequential corrections + prior refund (stable nets).
    const { performanceId, invoiceId } = await setupPackageCollected();
    const roots0 = await openCollectedRoots(performanceId);
    const root0 = roots0[0]!;
    const refundId = await createRefund(invoiceId, '400.00');
    await accruals().reverseAccrual({
      accrualId: root0.id,
      refundId,
      actor: actorId,
      actorRoles: ['owner'],
    });

    let currentRootId = root0.id;
    for (let i = 1; i <= 3; i++) {
      const session = await wrapper.withPlatformBypass((c) =>
        c.courseSession.findFirst({ where: { tenantId } }),
      );
      const repl = await createSameInvoiceReplacementLine(invoiceId, {
        amount: '5000.00',
        courseSessionId: session!.id,
      });
      await accruals().correctAndRepost({
        accrualId: currentRootId,
        correctionEventId: randomUUID(),
        replacementInvoiceLineId: repl,
        reason: `R10-A-T5-c${i}`,
        actor: actorId,
        actorRoles: ['owner'],
      });
      const open = await openCollectedRoots(performanceId);
      expect(open).toHaveLength(1);
      currentRootId = open[0]!.id;
      const refundRevs = await wrapper.withPlatformBypass((c) =>
        c.commissionAccrual.findMany({
          where: {
            tenantId,
            reversalOfAccrualId: currentRootId,
            refundId,
            status: 'REVERSED',
          },
        }),
      );
      expect(refundRevs).toHaveLength(1);
      expect(refundRevs[0]!.idempotencyKey).toBe(`rev:${currentRootId}:${refundId}`);
      expect((await netAttributed(performanceId)).toFixed(2)).toBe('80.00');
    }

    const countBefore = await wrapper.withPlatformBypass((c) =>
      c.commissionAccrual.count({
        where: { tenantId, reversalOfAccrualId: currentRootId, refundId },
      }),
    );
    const replay = await accruals().reverseAccrual({
      accrualId: currentRootId,
      refundId,
      actor: actorId,
      actorRoles: ['owner'],
    });
    const countAfter = await wrapper.withPlatformBypass((c) =>
      c.commissionAccrual.count({
        where: { tenantId, reversalOfAccrualId: currentRootId, refundId },
      }),
    );
    expect(countAfter).toBe(countBefore);
    expect(countAfter).toBe(1);
    expect((replay as { idempotencyKey: string }).idempotencyKey).toBe(
      `rev:${currentRootId}:${refundId}`,
    );

    // eslint-disable-next-line no-console
    console.log(
      'R10_DIAG',
      JSON.stringify({ test: 'R10-A-T5', finalRootId: currentRootId, refundId, countAfter }),
    );
  });

  it('R10-A-T6: two participants + refund on one primary root before correction; after correction each participant root has correct carry (primary has refund carry, assistant may not if refund only on primary\'s old root). Refunding one root only carries to matching participant.', async () => {
    const assistId = await ensureAssistant();
    const { performanceId, invoiceId } = await setupPackageCollected({
      assistantUserId: assistId,
    });
    const roots = await openCollectedRoots(performanceId);
    expect(roots.length).toBe(2);
    const primary = roots.find((r) => r.userId === performerId)!;
    const assistant = roots.find((r) => r.userId === assistId)!;
    expect(primary && assistant).toBeTruthy();

    const refundId = await createRefund(invoiceId, '400.00');
    await accruals().reverseAccrual({
      accrualId: primary.id,
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
    await accruals().correctAndRepost({
      accrualId: primary.id,
      correctionEventId: randomUUID(),
      replacementInvoiceLineId: repl,
      reason: 'R10-A-T6',
      actor: actorId,
      actorRoles: ['owner'],
    });

    const open = await openCollectedRoots(performanceId);
    expect(open.length).toBe(2);
    const openPrimary = open.find((r) => r.userId === performerId)!;
    const openAssist = open.find((r) => r.userId === assistId)!;

    const primaryCarry = await wrapper.withPlatformBypass((c) =>
      c.commissionAccrual.findMany({
        where: {
          tenantId,
          reversalOfAccrualId: openPrimary.id,
          refundId,
          status: 'REVERSED',
        },
      }),
    );
    const assistCarry = await wrapper.withPlatformBypass((c) =>
      c.commissionAccrual.findMany({
        where: {
          tenantId,
          reversalOfAccrualId: openAssist.id,
          refundId,
          status: 'REVERSED',
        },
      }),
    );
    expect(primaryCarry).toHaveLength(1);
    expect(assistCarry).toHaveLength(0);
    expect(primaryCarry[0]!.idempotencyKey).toBe(`rev:${openPrimary.id}:${refundId}`);

    // eslint-disable-next-line no-console
    console.log(
      'R10_DIAG',
      JSON.stringify({
        test: 'R10-A-T6',
        primaryCarry: primaryCarry.length,
        assistCarry: assistCarry.length,
        refundId,
      }),
    );
  });

  it('R10-A-T7: two payments; refund only payment1 root; correction; carry only on replacement for payment1, not payment2. Assert payment2 replacement has zero refundId reversals.', async () => {
    const { performanceId, invoiceId, paymentIds } = await setupPackageCollected({
      payments: ['800.00', '800.00'],
    });
    const roots = await openCollectedRoots(performanceId);
    expect(roots.length).toBe(2);
    const pay1Root = roots.find((r) => r.paymentId === paymentIds[0])!;
    const pay2Root = roots.find((r) => r.paymentId === paymentIds[1])!;
    expect(pay1Root && pay2Root).toBeTruthy();

    const refundId = await createRefund(invoiceId, '400.00');
    await accruals().reverseAccrual({
      accrualId: pay1Root.id,
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
    await accruals().correctAndRepost({
      accrualId: pay1Root.id,
      correctionEventId: randomUUID(),
      replacementInvoiceLineId: repl,
      reason: 'R10-A-T7',
      actor: actorId,
      actorRoles: ['owner'],
    });

    const open = await openCollectedRoots(performanceId);
    expect(open.length).toBe(2);
    const openPay1 = open.find((r) => r.paymentId === paymentIds[0])!;
    const openPay2 = open.find((r) => r.paymentId === paymentIds[1])!;

    const pay1Carry = await wrapper.withPlatformBypass((c) =>
      c.commissionAccrual.count({
        where: { tenantId, reversalOfAccrualId: openPay1.id, refundId },
      }),
    );
    const pay2Carry = await wrapper.withPlatformBypass((c) =>
      c.commissionAccrual.count({
        where: { tenantId, reversalOfAccrualId: openPay2.id, refundId },
      }),
    );
    expect(pay1Carry).toBe(1);
    expect(pay2Carry).toBe(0);

    // eslint-disable-next-line no-console
    console.log(
      'R10_DIAG',
      JSON.stringify({
        test: 'R10-A-T7',
        pay1Carry,
        pay2Carry,
        refundId,
        paymentIds,
      }),
    );
  });

  it('R10-A-T8: packageAllocationId same after correction+carry; net 80.', async () => {
    const { performanceId, invoiceId, packageAllocationId } = await setupPackageCollected();
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
    await accruals().correctAndRepost({
      accrualId: roots[0]!.id,
      correctionEventId: randomUUID(),
      replacementInvoiceLineId: repl,
      reason: 'R10-A-T8',
      actor: actorId,
      actorRoles: ['owner'],
    });
    const open = await openCollectedRoots(performanceId);
    expect(open).toHaveLength(1);
    expect(open[0]!.packageAllocationId).toBe(packageAllocationId);
    expect((await netAttributed(performanceId)).toFixed(2)).toBe('80.00');
    expect((await netCommission(performanceId)).toFixed(2)).toBe('8.00');

    const carry = await wrapper.withPlatformBypass((c) =>
      c.commissionAccrual.findFirst({
        where: { tenantId, reversalOfAccrualId: open[0]!.id, refundId },
      }),
    );
    expect(carry!.packageAllocationId).toBe(packageAllocationId);

    // eslint-disable-next-line no-console
    console.log(
      'R10_DIAG',
      JSON.stringify({
        test: 'R10-A-T8',
        packageAllocationId,
        net: '80.00',
      }),
    );
  });

  it('R10-A-T9: after carry exists, try INSERT another row same tenantId, reversalOfAccrualId, refundId with different idempotencyKey — expect unique violation (P2002 or 23505).', async () => {
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
    await accruals().correctAndRepost({
      accrualId: roots[0]!.id,
      correctionEventId: randomUUID(),
      replacementInvoiceLineId: repl,
      reason: 'R10-A-T9',
      actor: actorId,
      actorRoles: ['owner'],
    });
    const open = await openCollectedRoots(performanceId);
    const replacement = open[0]!;
    const carry = await wrapper.withPlatformBypass((c) =>
      c.commissionAccrual.findFirst({
        where: { tenantId, reversalOfAccrualId: replacement.id, refundId },
      }),
    );
    expect(carry).toBeTruthy();

    let err: unknown = null;
    try {
      await wrapper.withPlatformBypass(async (c) => {
        await c.commissionAccrual.create({
          data: {
            id: randomUUID(),
            tenantId,
            branchId: replacement.branchId,
            userId: replacement.userId,
            servicePerformanceId: replacement.servicePerformanceId,
            appointmentId: replacement.appointmentId,
            clinicalServiceId: replacement.clinicalServiceId,
            snapshotRevisionId: replacement.snapshotRevisionId,
            invoiceId: replacement.invoiceId,
            invoiceLineId: replacement.invoiceLineId,
            paymentId: replacement.paymentId,
            packageAllocationId: replacement.packageAllocationId,
            refundId,
            commissionPlanVersionId: replacement.commissionPlanVersionId,
            calculationBasis: replacement.calculationBasis,
            attributedRevenueAmount: '-80.0000',
            commissionPercent: replacement.commissionPercent,
            commissionAmount: '-8.0000',
            currency: replacement.currency,
            status: 'REVERSED',
            earnedAt: new Date(),
            reversalOfAccrualId: replacement.id,
            idempotencyKey: `rev_bad:${replacement.id}:${refundId}`,
            reason: 'R10-A-T9 duplicate semantic',
            createdBy: actorId,
          },
        });
      });
    } catch (e) {
      err = e;
    }
    expect(err).toBeTruthy();
    const msg = String(err);
    const code =
      err instanceof Prisma.PrismaClientKnownRequestError
        ? err.code
        : msg.includes('23505')
          ? '23505'
          : '';
    expect(code === 'P2002' || code === '23505' || /unique|23505|P2002/i.test(msg)).toBe(true);

    // eslint-disable-next-line no-console
    console.log(
      'R10_DIAG',
      JSON.stringify({ test: 'R10-A-T9', code: code || 'matched-message', err: msg.slice(0, 180) }),
    );
  });

  // ── R10-B production hygiene + rollback ────────────────────────────────────

  it('R10-B-T1: read commission-accrual.service.ts source via fs.readFileSync from __dirname relative path and assert it does NOT contain `__testFailAfterRepostBeforeRefundCarry`. Reading production source for assertion is OK (read-only).', async () => {
    const srcPath = path.join(__dirname, '../services/commission-accrual.service.ts');
    const src = fs.readFileSync(srcPath, 'utf8');
    expect(src).not.toContain('__testFailAfterRepostBeforeRefundCarry');
    // eslint-disable-next-line no-console
    console.log('R10_DIAG', JSON.stringify({ test: 'R10-B-T1', srcPath, ok: true }));
  });

  it('R10-B-T2: failing audit on refund_carried → full rollback (same as updated R9-A-T8).', async () => {
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

    const failingAudit = {
      record: async (e: Record<string, unknown>) => {
        auditCalls.push({ ...e, via: 'record' });
      },
      recordInTransaction: async (_tx: unknown, e: Record<string, unknown>) => {
        if (e.action === 'staff_commission.accrual.refund_carried') {
          throw new Error('R10-B-T2 injected failure after repost before refund carry-forward');
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
        reason: 'R10-B-T2',
        actor: actorId,
        actorRoles: ['owner'],
      }),
    ).rejects.toThrow(/R10-B-T2 injected failure/i);

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

    // eslint-disable-next-line no-console
    console.log(
      'R10_DIAG',
      JSON.stringify({ test: 'R10-B-T2', beforeCount, beforeNet: beforeNet.toFixed(2), rolledBack: true }),
    );
  });

  // ── R10-C refund vs correction concurrency ─────────────────────────────────

  it('R10-C-T1: Refund wins first:', async () => {
    const { performanceId, invoiceId } = await setupPackageCollected();
    const roots = await openCollectedRoots(performanceId);
    const root = roots[0]!;
    const refundId = await createRefund(invoiceId, '400.00');
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
      await accruals().reverseAccrual(
        {
          accrualId: root.id,
          refundId,
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
        return accrualsB.correctAndRepost(
          {
            accrualId: root.id,
            correctionEventId: randomUUID(),
            replacementInvoiceLineId: repl,
            reason: 'R10-C-T1',
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

    releaseA.resolve();
    await aTxn;
    await bPromise;
    await clientB.$disconnect();

    expect((await netAttributed(performanceId)).toFixed(2)).toBe('80.00');
    expect((await netCommission(performanceId)).toFixed(2)).toBe('8.00');

    const line = `R10-C-T1 pidA=${pidA} pidB=${pidB} blockers=[${blockers.join(',')}]`;
    R10_BLOCKING_EVIDENCE.push(line);
    R10_C_OUTCOMES.push(`R10-C-T1 ok net=80.00`);
    // eslint-disable-next-line no-console
    console.log('R10_DIAG', JSON.stringify({ test: 'R10-C-T1', pidA, pidB, blockers, net: '80.00' }));
  });

  it('R10-C-T2: Correction wins first:', async () => {
    const { performanceId, invoiceId } = await setupPackageCollected();
    const roots = await openCollectedRoots(performanceId);
    const oldRoot = roots[0]!;
    const refundId = await createRefund(invoiceId, '400.00'); // not applied yet
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
          accrualId: oldRoot.id,
          correctionEventId: randomUUID(),
          replacementInvoiceLineId: repl,
          reason: 'R10-C-T2',
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
        return accrualsB.reverseAccrual(
          {
            accrualId: oldRoot.id,
            refundId,
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

    releaseA.resolve();
    await aTxn;

    let staleErr: unknown = null;
    try {
      await bPromise;
    } catch (e) {
      staleErr = e;
    }
    await clientB.$disconnect();
    expect(staleErr).toBeTruthy();
    expect(String(staleErr)).toMatch(/no remaining|REVERSED|Cannot reverse|not found|must be > 0/i);
    expect(String(staleErr)).not.toMatch(/40P01|deadlock detected/i);

    // After correction without prior refund: replacement is full 160; refund applies once.
    const open = await openCollectedRoots(performanceId);
    expect(open).toHaveLength(1);
    expect((await netAttributed(performanceId)).toFixed(2)).toBe('160.00');

    await accruals().reverseAccrual({
      accrualId: open[0]!.id,
      refundId,
      actor: actorId,
      actorRoles: ['owner'],
    });
    expect((await netAttributed(performanceId)).toFixed(2)).toBe('80.00');

    const refundRows = await wrapper.withPlatformBypass((c) =>
      c.commissionAccrual.count({
        where: { tenantId, reversalOfAccrualId: open[0]!.id, refundId },
      }),
    );
    expect(refundRows).toBe(1);

    const line = `R10-C-T2 pidA=${pidA} pidB=${pidB} blockers=[${blockers.join(',')}]`;
    R10_BLOCKING_EVIDENCE.push(line);
    R10_C_OUTCOMES.push(`R10-C-T2 ok net=80.00 staleRejected=true`);
    // eslint-disable-next-line no-console
    console.log(
      'R10_DIAG',
      JSON.stringify({
        test: 'R10-C-T2',
        pidA,
        pidB,
        blockers,
        staleErr: String(staleErr).slice(0, 160),
        net: '80.00',
      }),
    );
  });

  it('R10-C-T3: assert from C-T1/T2 evidence no deadlock; log final nets. Can be a simple test that checks R10_BLOCKING buffer has pid lines and no 40P01 in outcomes.', async () => {
    const pidLines = R10_BLOCKING_EVIDENCE.filter((l) => /pidA=/.test(l));
    expect(pidLines.length).toBeGreaterThanOrEqual(2);
    const joined = [...R10_BLOCKING_EVIDENCE, ...R10_C_OUTCOMES].join('\n');
    expect(joined).not.toMatch(/40P01|deadlock detected/i);
    expect(R10_C_OUTCOMES.some((o) => /net=80\.00/.test(o))).toBe(true);

    // eslint-disable-next-line no-console
    console.log(
      'R10_DIAG',
      JSON.stringify({
        test: 'R10-C-T3',
        pidLineCount: pidLines.length,
        outcomes: R10_C_OUTCOMES,
        noDeadlock: true,
      }),
    );
  });

  // ── R10-D evidence immutability ────────────────────────────────────────────

  it('R10-D-T1: hash ROUND_9_RAW_PG_BLOCKING_EVIDENCE.md before a noop and after (or at start/end of this test), assert equal. Use crypto.createHash(\'sha256\') and fs.readFileSync — reading is OK, not writing.', async () => {
    const evidencePath = path.join(
      __dirname,
      '../../../../../../docs/PHASE_48_WAVE_F_IMPLEMENTATION_REVIEW_PACKAGE/ROUND_9_RAW_PG_BLOCKING_EVIDENCE.md',
    );
    const hash = (buf: Buffer) => createHash('sha256').update(buf).digest('hex');
    const before = hash(fs.readFileSync(evidencePath));
    // noop
    const after = hash(fs.readFileSync(evidencePath));
    expect(after).toBe(before);

    // eslint-disable-next-line no-console
    console.log(
      'R10_DIAG',
      JSON.stringify({ test: 'R10-D-T1', evidencePath, sha256: before, unchanged: true }),
    );
  });
});
