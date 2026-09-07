/**
 * Phase 48 Wave F Round 14 — asymmetric saturation + mixed-cohort lineage + concurrency.
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

function deferred<T = void>() {
  let resolve!: (v: T | PromiseLike<T>) => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

type AccrualRootRow = {
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
  attributedRevenueAmount: Prisma.Decimal;
  commissionAmount: Prisma.Decimal;
};

describeDb('Wave F Round 14 remediation (PostgreSQL)', () => {
  let raw: PrismaClient;
  let wrapper: ReturnType<typeof createClinicalPrismaWrapper>;
  let tenantId: string;
  let actorId: string;
  let performerId: string;
  let assistantId: string;
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

  beforeAll(async () => {
    raw = await createPlatformDbSecurityClient();
    wrapper = createClinicalPrismaWrapper(raw);
  });
  afterAll(async () => {
    await raw?.$disconnect();
  });
  beforeEach(async () => {
    tenantId = randomUUID();
    actorId = randomUUID();
    performerId = randomUUID();
    assistantId = randomUUID();
    patientId = randomUUID();
    branchId = randomUUID();
    clinicalServiceId = randomUUID();
    appointmentId = randomUUID();
    auditCalls.length = 0;
    await wrapper.withPlatformBypass(async (c) => {
      await c.tenant.create({
        data: { id: tenantId, name: 'WF R14', slug: `wfr14-${tenantId.slice(0, 8)}` },
      });
      for (const u of [
        { id: actorId, first: 'A', last: 'Ctor' },
        { id: performerId, first: 'Perf', last: 'Ormer' },
        { id: assistantId, first: 'As', last: 'Sist' },
      ]) {
        await c.user.create({
          data: {
            id: u.id,
            tenantId,
            email: `wfr14-${u.id.slice(0, 8)}@t.local`,
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
        data: { id: branchId, tenantId, name: `R14 B ${branchId.slice(0, 6)}` },
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
  });

  async function enableAndPublishPlan(
    userId: string,
    opts?: { calculationBasis?: string; earningTrigger?: string; percentage?: number },
  ) {
    await plans().setUserCommissionEligibility(userId, true, opts?.percentage ?? 10, '2026-01-01', {
      actorId,
      actorRoles: ['owner'],
    });
    const draft = await plans().createDraftPlan({
      userId,
      percentage: opts?.percentage ?? 10,
      effectiveFrom: '2026-01-01',
      calculationBasis: opts?.calculationBasis ?? 'COLLECTED_REVENUE',
      earningTrigger: opts?.earningTrigger ?? 'PAYMENT_COLLECTED',
      actor: { actorId, actorRoles: ['owner'] },
    });
    return plans().publishPlan(draft.id, { actorId, actorRoles: ['owner'] });
  }

  async function createCompletedPerformance(opts?: { assistantUserId?: string | null }) {
    const performanceId = randomUUID();
    const performedAt = new Date('2026-09-01T10:30:00.000Z');
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
    opts?: { amount?: string; courseSessionId?: string | null },
  ) {
    const amount = opts?.amount ?? '100.00';
    const invoice = Invoice.create({
      invoiceId: randomUUID(),
      tenantId,
      branchId,
      patientId,
      invoiceNumber: `R14-${randomUUID().slice(0, 8)}`,
      invoiceDate: new Date('2026-09-01'),
      currency: 'SYP',
      notes: 'R14',
      lineItems: [
        {
          description: 'R14 clinical line',
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
          reason: 'R14 refund',
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
    const amt = opts?.amount ?? '100.00';
    await wrapper.withPlatformBypass(async (c) => {
      await c.invoiceLineItem.create({
        data: {
          id,
          invoiceId,
          tenantId,
          description: 'R14 corrected line',
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

  async function remainingAbs(rootId: string, amount: Prisma.Decimal) {
    return wrapper.withPlatformBypass(async (c) => {
      const revs = await c.commissionAccrual.findMany({
        where: { tenantId, reversalOfAccrualId: rootId, status: 'REVERSED' },
      });
      const reversed = revs.reduce(
        (a, r) => a.add(new Prisma.Decimal(r.commissionAmount).abs()),
        new Prisma.Decimal(0),
      );
      return new Prisma.Decimal(amount).sub(reversed);
    });
  }

  async function openRoots(performanceId: string, basis?: 'invoice' | 'collected') {
    return wrapper.withPlatformBypass(async (c) => {
      const rows = await c.commissionAccrual.findMany({
        where: {
          tenantId,
          servicePerformanceId: performanceId,
          reversalOfAccrualId: null,
          status: { in: ['EARNED', 'SETTLED'] },
          ...(basis === 'collected'
            ? { calculationBasis: 'COLLECTED_REVENUE' }
            : basis === 'invoice'
              ? { NOT: { calculationBasis: 'COLLECTED_REVENUE' } }
              : {}),
        },
        orderBy: { id: 'asc' },
      });
      const open = [];
      for (const row of rows) {
        if ((await remainingAbs(row.id, row.commissionAmount)).gt(0)) open.push(row);
      }
      return open as AccrualRootRow[];
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

  async function netCommission(performanceId: string) {
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
          (a, r) => a.add(new Prisma.Decimal(r.commissionAmount).abs()),
          new Prisma.Decimal(0),
        );
        total = total.add(new Prisma.Decimal(row.commissionAmount).sub(revSum));
      }
      return total;
    });
  }

  async function plantRefundEffects(
    root: AccrualRootRow,
    effects: Array<{ refundId: string; attributed: string; commission: string; reason?: string }>,
  ) {
    for (const effect of effects) {
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
            refundId: effect.refundId,
            commissionPlanVersionId: root.commissionPlanVersionId,
            calculationBasis: root.calculationBasis as never,
            attributedRevenueAmount: effect.attributed,
            commissionPercent: root.commissionPercent,
            commissionAmount: effect.commission,
            currency: root.currency,
            status: 'REVERSED',
            earnedAt: new Date(),
            reversalOfAccrualId: root.id,
            idempotencyKey: `rev:${root.id}:${effect.refundId}`,
            reason: effect.reason ?? 'R14 planted refund',
            createdBy: actorId,
          },
        });
      });
    }
  }

  async function lineageCount(correctionEventId: string) {
    return wrapper.withPlatformBypass((c) =>
      c.commissionCorrectionLineage.count({ where: { tenantId, correctionEventId } }),
    );
  }

  it('R14-A-PG1 asymmetric 100/1 sequential refunds + replay + correct carry', async () => {
    await enableAndPublishPlan(performerId, {
      calculationBasis: 'SERVICE_NET_AFTER_DISCOUNT',
      earningTrigger: 'INVOICE_OR_CHARGE_FINALIZED',
      percentage: 1,
    });
    const performanceId = await createCompletedPerformance();
    const { invoiceId, lineId } = await createInvoiceViaProductionPath(performanceId, {
      amount: '100.00',
    });
    await accruals().postFromServicePerformance({
      servicePerformanceId: performanceId,
      invoiceLineId: lineId,
      actor: actorId,
      actorRoles: ['owner'],
    });
    const root = (await openRoots(performanceId, 'invoice'))[0]!;
    expect(new Prisma.Decimal(root.attributedRevenueAmount).toFixed(2)).toBe('100.00');
    expect(new Prisma.Decimal(root.commissionAmount).toFixed(2)).toBe('1.00');

    const rA = await createRefund(invoiceId, '33.50');
    const rB = await createRefund(invoiceId, '33.50');
    const rC = await createRefund(invoiceId, '32.90');
    await accruals().reverseAccrual({
      accrualId: root.id,
      refundId: rA,
      actor: actorId,
      actorRoles: ['owner'],
    });
    await accruals().reverseAccrual({
      accrualId: root.id,
      refundId: rB,
      actor: actorId,
      actorRoles: ['owner'],
    });
    const third = await accruals().reverseAccrual({
      accrualId: root.id,
      refundId: rC,
      actor: actorId,
      actorRoles: ['owner'],
    });

    const effects = await wrapper.withPlatformBypass((c) =>
      c.commissionAccrual.findMany({
        where: { tenantId, reversalOfAccrualId: root.id, refundId: { not: null } },
        orderBy: { id: 'asc' },
      }),
    );
    const byRefund = new Map(effects.map((e) => [e.refundId!, e]));
    expect(new Prisma.Decimal(byRefund.get(rA)!.attributedRevenueAmount).abs().toFixed(2)).toBe(
      '33.50',
    );
    expect(new Prisma.Decimal(byRefund.get(rA)!.commissionAmount).abs().toFixed(2)).toBe('0.34');
    expect(new Prisma.Decimal(byRefund.get(rB)!.attributedRevenueAmount).abs().toFixed(2)).toBe(
      '33.50',
    );
    expect(new Prisma.Decimal(byRefund.get(rB)!.commissionAmount).abs().toFixed(2)).toBe('0.34');
    expect(new Prisma.Decimal(byRefund.get(rC)!.attributedRevenueAmount).abs().toFixed(2)).toBe(
      '32.90',
    );
    expect(new Prisma.Decimal(byRefund.get(rC)!.commissionAmount).abs().toFixed(2)).toBe('0.32');

    const countBefore = effects.length;
    const replay = await accruals().reverseAccrual({
      accrualId: root.id,
      refundId: rC,
      actor: actorId,
      actorRoles: ['owner'],
    });
    expect((replay as { id: string }).id).toBe((third as { id: string }).id);
    const countAfterReplay = await wrapper.withPlatformBypass((c) =>
      c.commissionAccrual.count({
        where: { tenantId, reversalOfAccrualId: root.id, refundId: { not: null } },
      }),
    );
    expect(countAfterReplay).toBe(countBefore);

    const eventId = randomUUID();
    const repl = await createSameInvoiceReplacementLine(invoiceId, { amount: '100.00' });
    await accruals().correctAndRepost({
      accrualId: root.id,
      correctionEventId: eventId,
      replacementInvoiceLineId: repl,
      reason: 'R14-A-PG1',
      actor: actorId,
      actorRoles: ['owner'],
    });
    expect((await netAttributed(performanceId)).toFixed(2)).toBe('0.10');
    expect((await netCommission(performanceId)).toFixed(2)).toBe('0.00');
    expect(await lineageCount(eventId)).toBe(1);

    const carries = await wrapper.withPlatformBypass((c) =>
      c.commissionAccrual.findMany({
        where: {
          tenantId,
          servicePerformanceId: performanceId,
          reason: { startsWith: 'correction-refund-carry:' },
          refundId: { in: [rA, rB, rC] },
        },
      }),
    );
    expect(carries).toHaveLength(3);
    // eslint-disable-next-line no-console
    console.log(
      'R14_DIAG',
      JSON.stringify({
        test: 'R14-A-PG1',
        netRev: '0.10',
        netComm: '0.00',
        carries: carries.length,
      }),
    );
  });

  it('R14-B-T1 mixed cohort rem=0 selected root same-event replay', async () => {
    await enableAndPublishPlan(performerId, {
      calculationBasis: 'SERVICE_NET_AFTER_DISCOUNT',
      earningTrigger: 'INVOICE_OR_CHARGE_FINALIZED',
      percentage: 10,
    });
    await enableAndPublishPlan(assistantId, {
      calculationBasis: 'SERVICE_NET_AFTER_DISCOUNT',
      earningTrigger: 'INVOICE_OR_CHARGE_FINALIZED',
      percentage: 10,
    });
    const performanceId = await createCompletedPerformance({ assistantUserId: assistantId });
    const { invoiceId, lineId } = await createInvoiceViaProductionPath(performanceId, {
      amount: '100.00',
    });
    await accruals().postFromServicePerformance({
      servicePerformanceId: performanceId,
      invoiceLineId: lineId,
      actor: actorId,
      actorRoles: ['owner'],
    });
    const roots = await openRoots(performanceId, 'invoice');
    expect(roots.length).toBe(2);
    const rootA = roots.find((r) => r.userId === performerId)!;
    const rootB = roots.find((r) => r.userId === assistantId)!;
    expect(rootA).toBeTruthy();
    expect(rootB).toBeTruthy();

    const refundId = await createRefund(invoiceId, '100.00');
    await accruals().reverseAccrual({
      accrualId: rootA.id,
      refundId,
      actor: actorId,
      actorRoles: ['owner'],
    });
    expect((await remainingAbs(rootA.id, rootA.commissionAmount)).toFixed(2)).toBe('0.00');
    expect((await remainingAbs(rootB.id, rootB.commissionAmount)).gt(0)).toBe(true);

    const eventId = randomUUID();
    const repl = await createSameInvoiceReplacementLine(invoiceId, { amount: '100.00' });
    const first = await accruals().correctAndRepost({
      accrualId: rootA.id,
      correctionEventId: eventId,
      replacementInvoiceLineId: repl,
      reason: 'R14-B-T1',
      actor: actorId,
      actorRoles: ['owner'],
    });
    expect((first as { idempotent: boolean }).idempotent).toBe(false);
    expect(await lineageCount(eventId)).toBe(1);

    const countBefore = await wrapper.withPlatformBypass((c) =>
      c.commissionAccrual.count({ where: { tenantId, servicePerformanceId: performanceId } }),
    );
    const auditsBefore = auditCalls.filter(
      (a) =>
        a.action === 'staff_commission.accrual.corrected' ||
        a.action === 'staff_commission.correction.lineage_recorded',
    ).length;
    const repostIds1 = (first as { repost: { accruals: Array<{ id: string }> } }).repost.accruals
      .map((a) => a.id)
      .sort();

    const second = await accruals().correctAndRepost({
      accrualId: rootA.id,
      correctionEventId: eventId,
      replacementInvoiceLineId: repl,
      reason: 'R14-B-T1-replay',
      actor: actorId,
      actorRoles: ['owner'],
    });
    expect((second as { idempotent: boolean }).idempotent).toBe(true);
    const repostIds2 = (second as { repost: { accruals: Array<{ id: string }> } }).repost.accruals
      .map((a) => a.id)
      .sort();
    expect(repostIds2).toEqual(repostIds1);
    expect(
      await wrapper.withPlatformBypass((c) =>
        c.commissionAccrual.count({ where: { tenantId, servicePerformanceId: performanceId } }),
      ),
    ).toBe(countBefore);
    expect(
      auditCalls.filter(
        (a) =>
          a.action === 'staff_commission.accrual.corrected' ||
          a.action === 'staff_commission.correction.lineage_recorded',
      ).length,
    ).toBe(auditsBefore);
    expect(await lineageCount(eventId)).toBe(1);
  });

  it('R14-B-T2 COLLECTED two payment roots mixed rem=0 replay', async () => {
    await enableAndPublishPlan(performerId, {
      calculationBasis: 'COLLECTED_REVENUE',
      earningTrigger: 'PAYMENT_COLLECTED',
      percentage: 10,
    });
    const performanceId = await createCompletedPerformance();
    const { invoiceId, lineId } = await createInvoiceViaProductionPath(performanceId, {
      amount: '200.00',
    });
    const pay1 = await createPayment(invoiceId, '100.00');
    const pay2 = await createPayment(invoiceId, '100.00');
    await accruals().postFromCollectedPayment({
      servicePerformanceId: performanceId,
      invoiceLineId: lineId,
      paymentId: pay1,
      actor: actorId,
      actorRoles: ['owner'],
    });
    await accruals().postFromCollectedPayment({
      servicePerformanceId: performanceId,
      invoiceLineId: lineId,
      paymentId: pay2,
      actor: actorId,
      actorRoles: ['owner'],
    });
    const roots = await openRoots(performanceId, 'collected');
    expect(roots.length).toBe(2);
    const rootA = roots.find((r) => r.paymentId === pay1)!;
    const rootB = roots.find((r) => r.paymentId === pay2)!;
    const refundId = await createRefund(invoiceId, '200.00');
    await accruals().reverseAccrual({
      accrualId: rootA.id,
      refundId,
      actor: actorId,
      actorRoles: ['owner'],
    });
    expect((await remainingAbs(rootA.id, rootA.commissionAmount)).toFixed(2)).toBe('0.00');
    expect((await remainingAbs(rootB.id, rootB.commissionAmount)).gt(0)).toBe(true);
    const eventId = randomUUID();
    const repl = await createSameInvoiceReplacementLine(invoiceId, { amount: '200.00' });
    const first = await accruals().correctAndRepost({
      accrualId: rootA.id,
      correctionEventId: eventId,
      replacementInvoiceLineId: repl,
      reason: 'R14-B-T2',
      actor: actorId,
      actorRoles: ['owner'],
    });
    const second = await accruals().correctAndRepost({
      accrualId: rootA.id,
      correctionEventId: eventId,
      replacementInvoiceLineId: repl,
      reason: 'R14-B-T2-replay',
      actor: actorId,
      actorRoles: ['owner'],
    });
    expect((first as { idempotent: boolean }).idempotent).toBe(false);
    expect((second as { idempotent: boolean }).idempotent).toBe(true);
    expect(await lineageCount(eventId)).toBe(1);
    expect(rootB).toBeTruthy();
  });

  it('R14-B-T3 package COLLECTED mixed rem=0 preserves packageAllocationId on lineage', async () => {
    await enableAndPublishPlan(performerId, {
      calculationBasis: 'COLLECTED_REVENUE',
      earningTrigger: 'PAYMENT_COLLECTED',
      percentage: 10,
    });
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
      idempotencyKey: `r14-${sessionId}`,
    });
    const packageAllocationId = (alloc as { allocation: { id: string } }).allocation.id;
    const pay1 = await createPayment(invoiceId, '400.00');
    const pay2 = await createPayment(invoiceId, '400.00');
    await accruals().postFromCollectedPayment({
      servicePerformanceId: performanceId,
      invoiceLineId: lineId,
      paymentId: pay1,
      actor: actorId,
      actorRoles: ['owner'],
    });
    await accruals().postFromCollectedPayment({
      servicePerformanceId: performanceId,
      invoiceLineId: lineId,
      paymentId: pay2,
      actor: actorId,
      actorRoles: ['owner'],
    });
    const roots = await openRoots(performanceId, 'collected');
    const rootA = roots.find((r) => r.paymentId === pay1)!;
    expect(rootA.packageAllocationId).toBe(packageAllocationId);
    const refundId = await createRefund(invoiceId, '5000.00');
    await accruals().reverseAccrual({
      accrualId: rootA.id,
      refundId,
      actor: actorId,
      actorRoles: ['owner'],
    });
    expect((await remainingAbs(rootA.id, rootA.commissionAmount)).toFixed(2)).toBe('0.00');
    const eventId = randomUUID();
    const repl = await createSameInvoiceReplacementLine(invoiceId, {
      amount: '5000.00',
      courseSessionId: sessionId,
    });
    await accruals().correctAndRepost({
      accrualId: rootA.id,
      correctionEventId: eventId,
      replacementInvoiceLineId: repl,
      reason: 'R14-B-T3',
      actor: actorId,
      actorRoles: ['owner'],
    });
    const lineage = await wrapper.withPlatformBypass((c) =>
      c.commissionCorrectionLineage.findFirst({ where: { tenantId, correctionEventId: eventId } }),
    );
    expect(lineage!.packageAllocationId).toBe(packageAllocationId);
    const replay = await accruals().correctAndRepost({
      accrualId: rootA.id,
      correctionEventId: eventId,
      replacementInvoiceLineId: repl,
      reason: 'R14-B-T3-replay',
      actor: actorId,
      actorRoles: ['owner'],
    });
    expect((replay as { idempotent: boolean }).idempotent).toBe(true);
  });

  it('R14-B-T4 same event different selected accrualId rejects', async () => {
    await enableAndPublishPlan(performerId, {
      calculationBasis: 'SERVICE_NET_AFTER_DISCOUNT',
      earningTrigger: 'INVOICE_OR_CHARGE_FINALIZED',
      percentage: 10,
    });
    await enableAndPublishPlan(assistantId, {
      calculationBasis: 'SERVICE_NET_AFTER_DISCOUNT',
      earningTrigger: 'INVOICE_OR_CHARGE_FINALIZED',
      percentage: 10,
    });
    const performanceId = await createCompletedPerformance({ assistantUserId: assistantId });
    const { invoiceId, lineId } = await createInvoiceViaProductionPath(performanceId, {
      amount: '100.00',
    });
    await accruals().postFromServicePerformance({
      servicePerformanceId: performanceId,
      invoiceLineId: lineId,
      actor: actorId,
      actorRoles: ['owner'],
    });
    const roots = await openRoots(performanceId, 'invoice');
    const rootA = roots.find((r) => r.userId === performerId)!;
    const rootB = roots.find((r) => r.userId === assistantId)!;
    await accruals().reverseAccrual({
      accrualId: rootA.id,
      refundId: await createRefund(invoiceId, '100.00'),
      actor: actorId,
      actorRoles: ['owner'],
    });
    const eventId = randomUUID();
    const repl = await createSameInvoiceReplacementLine(invoiceId, { amount: '100.00' });
    await accruals().correctAndRepost({
      accrualId: rootA.id,
      correctionEventId: eventId,
      replacementInvoiceLineId: repl,
      reason: 'R14-B-T4',
      actor: actorId,
      actorRoles: ['owner'],
    });
    const before = await wrapper.withPlatformBypass((c) =>
      c.commissionAccrual.count({ where: { tenantId, servicePerformanceId: performanceId } }),
    );
    await expect(
      accruals().correctAndRepost({
        accrualId: rootB.id,
        correctionEventId: eventId,
        replacementInvoiceLineId: repl,
        reason: 'R14-B-T4-wrong-root',
        actor: actorId,
        actorRoles: ['owner'],
      }),
    ).rejects.toThrow(/selected accrualId|lineage|idempotency|source invoice/i);
    expect(
      await wrapper.withPlatformBypass((c) =>
        c.commissionAccrual.count({ where: { tenantId, servicePerformanceId: performanceId } }),
      ),
    ).toBe(before);
  });

  it('R14-B-T5 same event different replacement rejects', async () => {
    await enableAndPublishPlan(performerId, {
      calculationBasis: 'SERVICE_NET_AFTER_DISCOUNT',
      earningTrigger: 'INVOICE_OR_CHARGE_FINALIZED',
      percentage: 10,
    });
    const performanceId = await createCompletedPerformance();
    const { invoiceId, lineId } = await createInvoiceViaProductionPath(performanceId, {
      amount: '100.00',
    });
    await accruals().postFromServicePerformance({
      servicePerformanceId: performanceId,
      invoiceLineId: lineId,
      actor: actorId,
      actorRoles: ['owner'],
    });
    const root = (await openRoots(performanceId, 'invoice'))[0]!;
    const eventId = randomUUID();
    const repl1 = await createSameInvoiceReplacementLine(invoiceId, { amount: '100.00' });
    const repl2 = await createSameInvoiceReplacementLine(invoiceId, { amount: '100.00' });
    await accruals().correctAndRepost({
      accrualId: root.id,
      correctionEventId: eventId,
      replacementInvoiceLineId: repl1,
      reason: 'R14-B-T5',
      actor: actorId,
      actorRoles: ['owner'],
    });
    await expect(
      accruals().correctAndRepost({
        accrualId: root.id,
        correctionEventId: eventId,
        replacementInvoiceLineId: repl2,
        reason: 'R14-B-T5-diff-repl',
        actor: actorId,
        actorRoles: ['owner'],
      }),
    ).rejects.toThrow(/replacement|idempotency/i);
  });

  it('R14-B-T6 same event cross-performance rejects', async () => {
    await enableAndPublishPlan(performerId, {
      calculationBasis: 'SERVICE_NET_AFTER_DISCOUNT',
      earningTrigger: 'INVOICE_OR_CHARGE_FINALIZED',
      percentage: 10,
    });
    const p1 = await createCompletedPerformance();
    const inv1 = await createInvoiceViaProductionPath(p1, { amount: '100.00' });
    await accruals().postFromServicePerformance({
      servicePerformanceId: p1,
      invoiceLineId: inv1.lineId,
      actor: actorId,
      actorRoles: ['owner'],
    });
    const root1 = (await openRoots(p1, 'invoice'))[0]!;
    const eventId = randomUUID();
    const repl1 = await createSameInvoiceReplacementLine(inv1.invoiceId, { amount: '100.00' });
    await accruals().correctAndRepost({
      accrualId: root1.id,
      correctionEventId: eventId,
      replacementInvoiceLineId: repl1,
      reason: 'R14-B-T6-a',
      actor: actorId,
      actorRoles: ['owner'],
    });

    const p2 = await createCompletedPerformance();
    const inv2 = await createInvoiceViaProductionPath(p2, { amount: '100.00' });
    await accruals().postFromServicePerformance({
      servicePerformanceId: p2,
      invoiceLineId: inv2.lineId,
      actor: actorId,
      actorRoles: ['owner'],
    });
    const root2 = (await openRoots(p2, 'invoice'))[0]!;
    const repl2 = await createSameInvoiceReplacementLine(inv2.invoiceId, { amount: '100.00' });
    await expect(
      accruals().correctAndRepost({
        accrualId: root2.id,
        correctionEventId: eventId,
        replacementInvoiceLineId: repl2,
        reason: 'R14-B-T6-b',
        actor: actorId,
        actorRoles: ['owner'],
      }),
    ).rejects.toThrow(/selected accrualId|ServicePerformance|idempotency|lineage|scope/i);
  });

  it('R14-B-T7 lineage fault injection rolls back all side effects', async () => {
    await enableAndPublishPlan(performerId, {
      calculationBasis: 'SERVICE_NET_AFTER_DISCOUNT',
      earningTrigger: 'INVOICE_OR_CHARGE_FINALIZED',
      percentage: 10,
    });
    const performanceId = await createCompletedPerformance();
    const { invoiceId, lineId } = await createInvoiceViaProductionPath(performanceId, {
      amount: '100.00',
    });
    await accruals().postFromServicePerformance({
      servicePerformanceId: performanceId,
      invoiceLineId: lineId,
      actor: actorId,
      actorRoles: ['owner'],
    });
    const root = (await openRoots(performanceId, 'invoice'))[0]!;
    const beforeCount = await wrapper.withPlatformBypass((c) =>
      c.commissionAccrual.count({ where: { tenantId, servicePerformanceId: performanceId } }),
    );
    const beforeNet = await netAttributed(performanceId);
    const eventId = randomUUID();
    const repl = await createSameInvoiceReplacementLine(invoiceId, { amount: '100.00' });

    const failingAudit = {
      record: async (e: Record<string, unknown>) => {
        auditCalls.push({ ...e, via: 'record' });
      },
      recordInTransaction: async (_tx: unknown, e: Record<string, unknown>) => {
        if (e.action === 'staff_commission.correction.lineage_recorded') {
          throw new Error('R14-B-T7 injected failure after lineage before repost');
        }
        auditCalls.push({ ...e, via: 'recordInTransaction' });
      },
    };
    const failing = new CommissionAccrualService(
      wrapper as never,
      tenantContext as never,
      new StaffCommissionPlanService(wrapper as never, tenantContext as never, failingAudit as never),
      failingAudit as never,
    );
    await expect(
      failing.correctAndRepost({
        accrualId: root.id,
        correctionEventId: eventId,
        replacementInvoiceLineId: repl,
        reason: 'R14-B-T7',
        actor: actorId,
        actorRoles: ['owner'],
      }),
    ).rejects.toThrow(/R14-B-T7 injected failure/i);

    expect(await lineageCount(eventId)).toBe(0);
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

  it('R14-B-T8 concurrent exact same-event retries — one lineage, no duplicates', async () => {
    await enableAndPublishPlan(performerId, {
      calculationBasis: 'SERVICE_NET_AFTER_DISCOUNT',
      earningTrigger: 'INVOICE_OR_CHARGE_FINALIZED',
      percentage: 10,
    });
    const performanceId = await createCompletedPerformance();
    const { invoiceId, lineId } = await createInvoiceViaProductionPath(performanceId, {
      amount: '100.00',
    });
    await accruals().postFromServicePerformance({
      servicePerformanceId: performanceId,
      invoiceLineId: lineId,
      actor: actorId,
      actorRoles: ['owner'],
    });
    const root = (await openRoots(performanceId, 'invoice'))[0]!;
    const eventId = randomUUID();
    const repl = await createSameInvoiceReplacementLine(invoiceId, { amount: '100.00' });

    const clientB = await createPlatformDbSecurityClient();
    const wrapperB = createClinicalPrismaWrapper(clientB);
    const accrualsB = new CommissionAccrualService(
      wrapperB as never,
      tenantContext as never,
      new StaffCommissionPlanService(wrapperB as never, tenantContext as never, audit as never),
      audit as never,
    );

    const [a, b] = await Promise.allSettled([
      accruals().correctAndRepost({
        accrualId: root.id,
        correctionEventId: eventId,
        replacementInvoiceLineId: repl,
        reason: 'R14-B-T8-A',
        actor: actorId,
        actorRoles: ['owner'],
      }),
      accrualsB.correctAndRepost({
        accrualId: root.id,
        correctionEventId: eventId,
        replacementInvoiceLineId: repl,
        reason: 'R14-B-T8-B',
        actor: actorId,
        actorRoles: ['owner'],
      }),
    ]);
    await clientB.$disconnect();
    expect(a.status === 'fulfilled' || b.status === 'fulfilled').toBe(true);
    if (a.status === 'rejected' && b.status === 'rejected') {
      throw a.reason;
    }
    expect(await lineageCount(eventId)).toBe(1);
    const reposts = await wrapper.withPlatformBypass((c) =>
      c.commissionAccrual.count({
        where: {
          tenantId,
          servicePerformanceId: performanceId,
          correctionEventId: eventId,
          reason: { startsWith: 'correction-repost:' },
        },
      }),
    );
    expect(reposts).toBe(1);
  });

  it('R14-C-T1 concurrent different events — mandatory blocker + stale loser', async () => {
    await enableAndPublishPlan(performerId, {
      calculationBasis: 'SERVICE_NET_AFTER_DISCOUNT',
      earningTrigger: 'INVOICE_OR_CHARGE_FINALIZED',
      percentage: 10,
    });
    const performanceId = await createCompletedPerformance();
    const { invoiceId, lineId } = await createInvoiceViaProductionPath(performanceId, {
      amount: '160.00',
    });
    await accruals().postFromServicePerformance({
      servicePerformanceId: performanceId,
      invoiceLineId: lineId,
      actor: actorId,
      actorRoles: ['owner'],
    });
    const root0 = (await openRoots(performanceId, 'invoice'))[0]!;
    const replA = await createSameInvoiceReplacementLine(invoiceId, { amount: '160.00' });
    const replB = await createSameInvoiceReplacementLine(invoiceId, { amount: '160.00' });
    const eventA = randomUUID();
    const eventB = randomUUID();

    const releaseA = deferred<void>();
    const aReady = deferred<number>();
    let pidA = 0;
    const aTxn = wrapper.withPlatformBypass(async (tx) => {
      const rows = await tx.$queryRaw<Array<{ pid: number }>>`SELECT pg_backend_pid() AS pid`;
      pidA = Number(rows[0]!.pid);
      await accruals().correctAndRepost(
        {
          accrualId: root0.id,
          correctionEventId: eventA,
          replacementInvoiceLineId: replA,
          reason: 'R14-C-T1-A',
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
            accrualId: root0.id,
            correctionEventId: eventB,
            replacementInvoiceLineId: replB,
            reason: 'R14-C-T1-B',
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
    expect(blockers).toContain(pidA);

    releaseA.resolve();
    await aTxn;

    let bOutcome: 'ok' | 'err' = 'ok';
    let bErr: unknown = null;
    try {
      await bPromise;
    } catch (e) {
      bOutcome = 'err';
      bErr = e;
    }
    await clientB.$disconnect();

    expect(bOutcome).toBe('err');
    expect(String(bErr)).toMatch(/stale|ACTIVE|SUPERSEDED|successor|not the current|cannot branch/i);

    const activeLines = await wrapper.withPlatformBypass((c) =>
      c.invoiceLineItem.findMany({
        where: {
          tenantId,
          servicePerformanceId: performanceId,
          performanceBindingStatus: 'ACTIVE',
        },
      }),
    );
    expect(activeLines).toHaveLength(1);

    const successorReposts = await wrapper.withPlatformBypass((c) =>
      c.commissionAccrual.count({
        where: {
          tenantId,
          servicePerformanceId: performanceId,
          reversalOfAccrualId: null,
          reason: { startsWith: 'correction-repost:' },
        },
      }),
    );
    expect(successorReposts).toBe(1);
    expect((await netAttributed(performanceId)).toFixed(2)).toBe('160.00');
    expect((await netCommission(performanceId)).toFixed(2)).toBe('16.00');
    expect(await lineageCount(eventA)).toBe(1);
    expect(await lineageCount(eventB)).toBe(0);

    // eslint-disable-next-line no-console
    console.log(
      'R14_DIAG',
      JSON.stringify({
        test: 'R14-C-T1',
        pidA,
        pidB,
        pg_blocking_pids: blockers,
        blocked,
        bOutcome,
        activeLineCount: activeLines.length,
        successorReposts,
        netRev: '160.00',
        netComm: '16.00',
      }),
    );
  });
});
