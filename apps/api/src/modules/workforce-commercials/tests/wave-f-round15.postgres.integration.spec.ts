/**
 * Phase 48 Wave F Round 15 — one-zero tails, lineage provenance, zero-history fail-closed.
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

describeDb('Wave F Round 15 remediation (PostgreSQL)', () => {
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
        data: { id: tenantId, name: 'WF R15', slug: `wfr15-${tenantId.slice(0, 8)}` },
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
            email: `wfr15-${u.id.slice(0, 8)}@t.local`,
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
        data: { id: branchId, tenantId, name: `R15 B ${branchId.slice(0, 6)}` },
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
      invoiceNumber: `R15-${randomUUID().slice(0, 8)}`,
      invoiceDate: new Date('2026-09-01'),
      currency: 'SYP',
      notes: 'R15',
      lineItems: [
        {
          description: 'R15 clinical line',
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
          reason: 'R15 refund',
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
          description: 'R15 corrected line',
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
            reason: effect.reason ?? 'R15 planted refund',
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

  async function setupServiceNet1Pct() {
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
    return { performanceId, invoiceId, lineId, root };
  }

  async function applyAsymRefundsABC(invoiceId: string, rootId: string) {
    const rA = await createRefund(invoiceId, '33.50');
    const rB = await createRefund(invoiceId, '33.50');
    const rC = await createRefund(invoiceId, '32.90');
    await accruals().reverseAccrual({
      accrualId: rootId,
      refundId: rA,
      actor: actorId,
      actorRoles: ['owner'],
    });
    await accruals().reverseAccrual({
      accrualId: rootId,
      refundId: rB,
      actor: actorId,
      actorRoles: ['owner'],
    });
    await accruals().reverseAccrual({
      accrualId: rootId,
      refundId: rC,
      actor: actorId,
      actorRoles: ['owner'],
    });
    return { rA, rB, rC };
  }

  async function applyAsymFullWithTail(invoiceId: string, rootId: string) {
    const abc = await applyAsymRefundsABC(invoiceId, rootId);
    const rD = await createRefund(invoiceId, '0.10');
    const tail = await accruals().reverseAccrual({
      accrualId: rootId,
      refundId: rD,
      actor: actorId,
      actorRoles: ['owner'],
    });
    return { ...abc, rD, tail };
  }

  // ── R15-A ──────────────────────────────────────────────────────────────────

  it('R15-A-T1 SERVICE_NET 1% 100 invoice; refunds 33.50/33.50/32.90 then 0.10; nets 0/0', async () => {
    const { performanceId, invoiceId, root } = await setupServiceNet1Pct();
    expect(new Prisma.Decimal(root.attributedRevenueAmount).toFixed(2)).toBe('100.00');
    expect(new Prisma.Decimal(root.commissionAmount).toFixed(2)).toBe('1.00');
    const { rA, rB, rC, rD, tail } = await applyAsymFullWithTail(invoiceId, root.id);

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
    expect(new Prisma.Decimal(byRefund.get(rD)!.attributedRevenueAmount).toFixed(2)).toBe('-0.10');
    expect(new Prisma.Decimal(byRefund.get(rD)!.commissionAmount).toFixed(2)).toBe('0.00');
    expect((tail as { id: string }).id).toBe(byRefund.get(rD)!.id);
    expect((await netAttributed(performanceId)).toFixed(2)).toBe('0.00');
    expect((await netCommission(performanceId)).toFixed(2)).toBe('0.00');
  });

  it('R15-A-T2 replay final refund idempotent (same id, no duplicate)', async () => {
    const { invoiceId, root } = await setupServiceNet1Pct();
    const { rD, tail } = await applyAsymFullWithTail(invoiceId, root.id);
    const countBefore = await wrapper.withPlatformBypass((c) =>
      c.commissionAccrual.count({
        where: { tenantId, reversalOfAccrualId: root.id, refundId: rD },
      }),
    );
    const replay = await accruals().reverseAccrual({
      accrualId: root.id,
      refundId: rD,
      actor: actorId,
      actorRoles: ['owner'],
    });
    expect((replay as { id: string }).id).toBe((tail as { id: string }).id);
    const countAfter = await wrapper.withPlatformBypass((c) =>
      c.commissionAccrual.count({
        where: { tenantId, reversalOfAccrualId: root.id, refundId: rD },
      }),
    );
    expect(countAfter).toBe(countBefore);
    expect(countAfter).toBe(1);
  });

  it('R15-A-T3 forged zero/zero REVERSED insert rejected by DB check', async () => {
    const { invoiceId, root } = await setupServiceNet1Pct();
    const refundId = await createRefund(invoiceId, '0.10');
    await expect(
      wrapper.withPlatformBypass(async (c) => {
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
            calculationBasis: root.calculationBasis as never,
            attributedRevenueAmount: '0.00',
            commissionPercent: root.commissionPercent,
            commissionAmount: '0.00',
            currency: root.currency,
            status: 'REVERSED',
            earnedAt: new Date(),
            reversalOfAccrualId: root.id,
            idempotencyKey: `rev:${root.id}:${refundId}`,
            reason: 'R15-A-T3 forged zero/zero',
            createdBy: actorId,
          },
        });
      }),
    ).rejects.toThrow(/commission_accruals_reversed_economic_shape_chk|check constraint|23514/i);
  });

  it('R15-A-T4 exact cumulative full refund 33.34+33.33+33.33 clears both dims to 0.00/0.00 (R16 supersedes residual)', async () => {
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
    expect(new Prisma.Decimal(root.commissionAmount).toFixed(2)).toBe('10.00');
    expect(new Prisma.Decimal(root.attributedRevenueAmount).toFixed(2)).toBe('100.00');

    const rA = await createRefund(invoiceId, '33.34');
    const rB = await createRefund(invoiceId, '33.33');
    const rC = await createRefund(invoiceId, '33.33');
    const revA = await accruals().reverseAccrual({
      accrualId: root.id,
      refundId: rA,
      actor: actorId,
      actorRoles: ['owner'],
    });
    const revB = await accruals().reverseAccrual({
      accrualId: root.id,
      refundId: rB,
      actor: actorId,
      actorRoles: ['owner'],
    });
    const revC = await accruals().reverseAccrual({
      accrualId: root.id,
      refundId: rC,
      actor: actorId,
      actorRoles: ['owner'],
    });

    const rows = [revA, revB, revC] as Array<{
      attributedRevenueAmount: Prisma.Decimal;
      commissionAmount: Prisma.Decimal;
    }>;
    const sumRev = rows.reduce(
      (a, r) => a.add(new Prisma.Decimal(r.attributedRevenueAmount).abs()),
      new Prisma.Decimal(0),
    );
    const sumComm = rows.reduce(
      (a, r) => a.add(new Prisma.Decimal(r.commissionAmount).abs()),
      new Prisma.Decimal(0),
    );
    expect(sumRev.toFixed(2)).toBe('100.00');
    expect(sumComm.toFixed(2)).toBe('10.00');
    expect((await netAttributed(performanceId)).toFixed(2)).toBe('0.00');
    expect((await netCommission(performanceId)).toFixed(2)).toBe('0.00');

    // No fourth refund required or accepted after both dimensions exhausted.
    const rD = await createRefund(invoiceId, '0.10');
    await expect(
      accruals().reverseAccrual({
        accrualId: root.id,
        refundId: rD,
        actor: actorId,
        actorRoles: ['owner'],
      }),
    ).rejects.toThrow(/no remaining|exhausted|zero in both/i);
    expect((await netAttributed(performanceId)).toFixed(2)).toBe('0.00');
    expect((await netCommission(performanceId)).toFixed(2)).toBe('0.00');
  });

  it('R15-A-T5 plant invalid positive/wrong-sign existing refund row; reverseAccrual replay rejects', async () => {
    const { invoiceId, root } = await setupServiceNet1Pct();
    await applyAsymRefundsABC(invoiceId, root.id);
    const rD = await createRefund(invoiceId, '0.10');

    await expect(
      plantRefundEffects(root, [
        { refundId: rD, attributed: '0.10', commission: '0.00', reason: 'R15-A-T5 positive' },
      ]),
    ).rejects.toThrow(/commission_accruals_reversed_economic_shape_chk|check constraint/i);

    await plantRefundEffects(root, [
      { refundId: rD, attributed: '-0.05', commission: '0.00', reason: 'R15-A-T5 wrong amount' },
    ]);
    await expect(
      accruals().reverseAccrual({
        accrualId: root.id,
        refundId: rD,
        actor: actorId,
        actorRoles: ['owner'],
      }),
    ).rejects.toThrow(/mismatch|economic|shape|realizable|idempotency|compatible/i);
  });

  it('R15-A-T6 after one-dim tail, correction preserves nets (correctAndRepost) — 0/0', async () => {
    const { performanceId, invoiceId, root } = await setupServiceNet1Pct();
    await applyAsymFullWithTail(invoiceId, root.id);
    expect((await netAttributed(performanceId)).toFixed(2)).toBe('0.00');
    expect((await netCommission(performanceId)).toFixed(2)).toBe('0.00');
    const eventId = randomUUID();
    const repl = await createSameInvoiceReplacementLine(invoiceId, { amount: '100.00' });
    await accruals().correctAndRepost({
      accrualId: root.id,
      correctionEventId: eventId,
      replacementInvoiceLineId: repl,
      reason: 'R15-A-T6',
      actor: actorId,
      actorRoles: ['owner'],
    });
    expect((await netAttributed(performanceId)).toFixed(2)).toBe('0.00');
    expect((await netCommission(performanceId)).toFixed(2)).toBe('0.00');
    expect(await lineageCount(eventId)).toBe(1);
  });

  it('R15-A-T7 carry one-dim tail to replacement once with canonical rev identity', async () => {
    const { performanceId, invoiceId, root } = await setupServiceNet1Pct();
    const { rD } = await applyAsymFullWithTail(invoiceId, root.id);
    const eventId = randomUUID();
    const repl = await createSameInvoiceReplacementLine(invoiceId, { amount: '100.00' });
    await accruals().correctAndRepost({
      accrualId: root.id,
      correctionEventId: eventId,
      replacementInvoiceLineId: repl,
      reason: 'R15-A-T7',
      actor: actorId,
      actorRoles: ['owner'],
    });
    const carries = await wrapper.withPlatformBypass((c) =>
      c.commissionAccrual.findMany({
        where: {
          tenantId,
          servicePerformanceId: performanceId,
          refundId: rD,
          reason: { startsWith: 'correction-refund-carry:' },
        },
      }),
    );
    expect(carries).toHaveLength(1);
    const carry = carries[0]!;
    expect(new Prisma.Decimal(carry.attributedRevenueAmount).toFixed(2)).toBe('-0.10');
    expect(new Prisma.Decimal(carry.commissionAmount).toFixed(2)).toBe('0.00');
    expect(String(carry.idempotencyKey)).toMatch(/^rev:[0-9a-f-]+:[0-9a-f-]+$/i);
    expect(carry.idempotencyKey).toBe(`rev:${carry.reversalOfAccrualId}:${rD}`);
  });

  it('R15-A-T8 ownerReport after asymmetric final state matches nets', async () => {
    const { performanceId, invoiceId, root } = await setupServiceNet1Pct();
    await applyAsymRefundsABC(invoiceId, root.id);
    const netC = await netCommission(performanceId);
    const netR = await netAttributed(performanceId);
    expect(netC.toFixed(2)).toBe('0.00');
    expect(netR.toFixed(2)).toBe('0.10');

    const report = await accruals().ownerReport({
      from: '2026-01-01',
      to: '2026-12-31',
      userId: performerId,
    });
    const sy = (report.byCurrency as Array<{ currency: string; net: string; outstanding: string }>).find(
      (b) => b.currency === 'SYP',
    )!;
    expect(sy.net).toBe(netC.toFixed(2));
    expect(sy.outstanding).toBe(netC.toFixed(2));
    expect(sy.net).toBe('0.00');
    expect(netR.toFixed(2)).toBe('0.10');
  });

  it('R15-A-T9 COLLECTED_REVENUE package path with asymmetric residual', async () => {
    await enableAndPublishPlan(performerId, {
      calculationBasis: 'COLLECTED_REVENUE',
      earningTrigger: 'PAYMENT_COLLECTED',
      percentage: 1,
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
          unitPrice: '100.00',
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
          plannedSessions: 1,
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
      amount: '100.00',
      courseSessionId: sessionId,
    });
    const alloc = await packages().registerSessionAllocation({
      treatmentCourseId: courseId,
      courseSessionId: sessionId,
      servicePerformanceId: performanceId,
      allocatedRevenueAmount: '100.00',
      invoiceLineId: lineId,
      actor: { actorId, actorRoles: ['owner'] },
      idempotencyKey: `r15-pkg-${sessionId}`,
    });
    const packageAllocationId = (alloc as { allocation: { id: string } }).allocation.id;
    const pay = await createPayment(invoiceId, '100.00');
    await accruals().postFromCollectedPayment({
      servicePerformanceId: performanceId,
      invoiceLineId: lineId,
      paymentId: pay,
      actor: actorId,
      actorRoles: ['owner'],
    });
    const root = (await openRoots(performanceId, 'collected'))[0]!;
    expect(root.packageAllocationId).toBe(packageAllocationId);
    expect(new Prisma.Decimal(root.attributedRevenueAmount).toFixed(2)).toBe('100.00');
    expect(new Prisma.Decimal(root.commissionAmount).toFixed(2)).toBe('1.00');

    const { rD } = await applyAsymFullWithTail(invoiceId, root.id);
    const tail = await wrapper.withPlatformBypass((c) =>
      c.commissionAccrual.findFirst({
        where: { tenantId, reversalOfAccrualId: root.id, refundId: rD },
      }),
    );
    expect(new Prisma.Decimal(tail!.attributedRevenueAmount).toFixed(2)).toBe('-0.10');
    expect(new Prisma.Decimal(tail!.commissionAmount).toFixed(2)).toBe('0.00');
    expect(tail!.packageAllocationId).toBe(packageAllocationId);
    expect((await netAttributed(performanceId)).toFixed(2)).toBe('0.00');
    expect((await netCommission(performanceId)).toFixed(2)).toBe('0.00');
  });

  it('R15-A-T10 invoice non-package SERVICE_NET tail has packageAllocationId null', async () => {
    const { invoiceId, root } = await setupServiceNet1Pct();
    const { rD } = await applyAsymFullWithTail(invoiceId, root.id);
    const tail = await wrapper.withPlatformBypass((c) =>
      c.commissionAccrual.findFirst({
        where: { tenantId, reversalOfAccrualId: root.id, refundId: rD },
      }),
    );
    expect(tail!.packageAllocationId).toBeNull();
  });

  it('R15-A-T11 settlement allocate against REVERSED tail must fail', async () => {
    const { invoiceId, root } = await setupServiceNet1Pct();
    const { rD } = await applyAsymFullWithTail(invoiceId, root.id);
    const tail = await wrapper.withPlatformBypass((c) =>
      c.commissionAccrual.findFirst({
        where: { tenantId, reversalOfAccrualId: root.id, refundId: rD },
      }),
    );
    await expect(
      accruals().settleAccrual({
        accrualId: tail!.id,
        settlementReference: `R15-A-T11-${tail!.id.slice(0, 8)}`,
        actor: actorId,
        actorRoles: ['owner'],
      }),
    ).rejects.toThrow(/Cannot settle a reversal|reversal accrual/i);
  });

  it('R15-A-T12 concurrent reverseAccrual of final tail — exactly one row; mid-tx rollback', async () => {
    const { invoiceId, root } = await setupServiceNet1Pct();
    await applyAsymRefundsABC(invoiceId, root.id);
    const rD = await createRefund(invoiceId, '0.10');

    const clientB = await createPlatformDbSecurityClient();
    const wrapperB = createClinicalPrismaWrapper(clientB);
    const accrualsB = new CommissionAccrualService(
      wrapperB as never,
      tenantContext as never,
      new StaffCommissionPlanService(wrapperB as never, tenantContext as never, audit as never),
      audit as never,
    );
    const [a, b] = await Promise.allSettled([
      accruals().reverseAccrual({
        accrualId: root.id,
        refundId: rD,
        actor: actorId,
        actorRoles: ['owner'],
      }),
      accrualsB.reverseAccrual({
        accrualId: root.id,
        refundId: rD,
        actor: actorId,
        actorRoles: ['owner'],
      }),
    ]);
    await clientB.$disconnect();
    expect(a.status === 'fulfilled' || b.status === 'fulfilled').toBe(true);
    if (a.status === 'rejected' && b.status === 'rejected') throw a.reason;
    const count = await wrapper.withPlatformBypass((c) =>
      c.commissionAccrual.count({
        where: { tenantId, reversalOfAccrualId: root.id, refundId: rD },
      }),
    );
    expect(count).toBe(1);

    const failingAudit = {
      record: async (e: Record<string, unknown>) => {
        auditCalls.push({ ...e, via: 'record' });
      },
      recordInTransaction: async (_tx: unknown, e: Record<string, unknown>) => {
        if (e.action === 'staff_commission.accrual.reversed') {
          throw new Error('R15-A-T12 injected mid-tx failure');
        }
        auditCalls.push({ ...e, via: 'recordInTransaction' });
      },
    };
    const performanceId2 = await createCompletedPerformance();
    const { invoiceId: inv2, lineId: line2 } = await createInvoiceViaProductionPath(performanceId2, {
      amount: '100.00',
    });
    await accruals().postFromServicePerformance({
      servicePerformanceId: performanceId2,
      invoiceLineId: line2,
      actor: actorId,
      actorRoles: ['owner'],
    });
    const root2 = (await openRoots(performanceId2, 'invoice'))[0]!;
    await applyAsymRefundsABC(inv2, root2.id);
    const rD2 = await createRefund(inv2, '0.10');
    const failing = new CommissionAccrualService(
      wrapper as never,
      tenantContext as never,
      new StaffCommissionPlanService(wrapper as never, tenantContext as never, failingAudit as never),
      failingAudit as never,
    );
    const before = await wrapper.withPlatformBypass((c) =>
      c.commissionAccrual.count({ where: { tenantId, reversalOfAccrualId: root2.id } }),
    );
    await expect(
      failing.reverseAccrual({
        accrualId: root2.id,
        refundId: rD2,
        actor: actorId,
        actorRoles: ['owner'],
      }),
    ).rejects.toThrow(/R15-A-T12 injected mid-tx failure/i);
    expect(
      await wrapper.withPlatformBypass((c) =>
        c.commissionAccrual.count({ where: { tenantId, reversalOfAccrualId: root2.id } }),
      ),
    ).toBe(before);
  });

  // ── R15-B lineage provenance / tenant integrity ────────────────────────────

  it('R15-B-T1 valid same-tenant lineage insert via correction', async () => {
    const { performanceId, invoiceId, root } = await setupServiceNet1Pct();
    const eventId = randomUUID();
    const repl = await createSameInvoiceReplacementLine(invoiceId, { amount: '100.00' });
    await accruals().correctAndRepost({
      accrualId: root.id,
      correctionEventId: eventId,
      replacementInvoiceLineId: repl,
      reason: 'R15-B-T1',
      actor: actorId,
      actorRoles: ['owner'],
    });
    const lineage = await wrapper.withPlatformBypass((c) =>
      c.commissionCorrectionLineage.findFirst({ where: { tenantId, correctionEventId: eventId } }),
    );
    expect(lineage).toBeTruthy();
    expect(lineage!.selectedAccrualId).toBe(root.id);
    expect(lineage!.replacementInvoiceLineId).toBe(repl);
    expect(lineage!.servicePerformanceId).toBe(performanceId);
    expect(lineage!.packageAllocationId).toBeNull();
  });

  it('R15-B-T2 cross-tenant selectedAccrual rejected at DB', async () => {
    const { invoiceId, root, lineId } = await setupServiceNet1Pct();
    const foreignTenant = randomUUID();
    const foreignUser = randomUUID();
    const repl = await createSameInvoiceReplacementLine(invoiceId, { amount: '100.00' });
    await wrapper.withPlatformBypass(async (c) => {
      await c.tenant.create({
        data: { id: foreignTenant, name: 'R15 foreign', slug: `wfr15f-${foreignTenant.slice(0, 8)}` },
      });
      await c.user.create({
        data: {
          id: foreignUser,
          tenantId: foreignTenant,
          email: `wfr15f-${foreignUser.slice(0, 8)}@t.local`,
          passwordHash: 'x',
          firstName: 'F',
          lastName: 'Oreign',
        },
      });
    });
    await expect(
      wrapper.withPlatformBypass(async (c) => {
        await c.commissionCorrectionLineage.create({
          data: {
            id: randomUUID(),
            tenantId: foreignTenant,
            correctionEventId: randomUUID(),
            selectedAccrualId: root.id,
            sourceInvoiceLineId: lineId,
            replacementInvoiceLineId: repl,
            servicePerformanceId: root.servicePerformanceId,
            calculationBasis: root.calculationBasis as never,
            packageAllocationId: null,
            createdBy: foreignUser,
          },
        });
      }),
    ).rejects.toThrow(/selectedAccrualId tenant mismatch|commission_correction_lineages/i);
  });

  it('R15-B-T3 semantic mismatches rejected; correction txn rolls back', async () => {
    const { performanceId, invoiceId, root, lineId } = await setupServiceNet1Pct();
    const repl = await createSameInvoiceReplacementLine(invoiceId, { amount: '100.00' });
    const beforeAcc = await wrapper.withPlatformBypass((c) =>
      c.commissionAccrual.count({ where: { tenantId, servicePerformanceId: performanceId } }),
    );
    const beforeLin = await wrapper.withPlatformBypass((c) =>
      c.commissionCorrectionLineage.count({ where: { tenantId } }),
    );

    await expect(
      wrapper.withPlatformBypass(async (c) => {
        await c.commissionCorrectionLineage.create({
          data: {
            id: randomUUID(),
            tenantId,
            correctionEventId: randomUUID(),
            selectedAccrualId: root.id,
            sourceInvoiceLineId: lineId,
            replacementInvoiceLineId: repl,
            servicePerformanceId: root.servicePerformanceId,
            calculationBasis: 'COLLECTED_REVENUE',
            packageAllocationId: null,
            createdBy: actorId,
          },
        });
      }),
    ).rejects.toThrow(/calculationBasis mismatch|commission_correction_lineages/i);

    await expect(
      wrapper.withPlatformBypass(async (c) => {
        await c.commissionCorrectionLineage.create({
          data: {
            id: randomUUID(),
            tenantId,
            correctionEventId: randomUUID(),
            selectedAccrualId: root.id,
            sourceInvoiceLineId: repl,
            replacementInvoiceLineId: repl,
            servicePerformanceId: root.servicePerformanceId,
            calculationBasis: root.calculationBasis as never,
            packageAllocationId: null,
            createdBy: actorId,
          },
        });
      }),
    ).rejects.toThrow(/invoiceLineId|sourceInvoiceLineId mismatch|commission_correction_lineages/i);

    expect(
      await wrapper.withPlatformBypass((c) =>
        c.commissionAccrual.count({ where: { tenantId, servicePerformanceId: performanceId } }),
      ),
    ).toBe(beforeAcc);
    expect(
      await wrapper.withPlatformBypass((c) => c.commissionCorrectionLineage.count({ where: { tenantId } })),
    ).toBe(beforeLin);
  });

  it('R15-B-T4 update/delete denied on commission_correction_lineages', async () => {
    const { invoiceId, root } = await setupServiceNet1Pct();
    const eventId = randomUUID();
    const repl = await createSameInvoiceReplacementLine(invoiceId, { amount: '100.00' });
    await accruals().correctAndRepost({
      accrualId: root.id,
      correctionEventId: eventId,
      replacementInvoiceLineId: repl,
      reason: 'R15-B-T4',
      actor: actorId,
      actorRoles: ['owner'],
    });
    const lineage = await wrapper.withPlatformBypass((c) =>
      c.commissionCorrectionLineage.findFirst({ where: { tenantId, correctionEventId: eventId } }),
    );
    await expect(
      wrapper.withPlatformBypass(async (c) => {
        await c.$executeRaw`
          UPDATE "commission_correction_lineages"
          SET "createdBy" = ${actorId}::uuid
          WHERE id = ${lineage!.id}::uuid
        `;
      }),
    ).rejects.toThrow(/append-only|forbidden|update/i);
    await expect(
      wrapper.withPlatformBypass(async (c) => {
        await c.commissionCorrectionLineage.delete({ where: { id: lineage!.id } });
      }),
    ).rejects.toThrow(/append-only|hard delete|forbidden|update/i);
    expect(await lineageCount(eventId)).toBe(1);
  });

  // ── R15-C zero-history / lineage concurrency ───────────────────────────────

  it('R15-C-T5 plant accruals with correctionEventId and NO lineage; correctAndRepost fails closed', async () => {
    const { performanceId, invoiceId, root } = await setupServiceNet1Pct();
    const orphanEventId = randomUUID();
    // Append-only blocks UPDATE of correctionEventId — plant a sibling accrual row instead.
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
          commissionPlanVersionId: root.commissionPlanVersionId,
          calculationBasis: root.calculationBasis as never,
          attributedRevenueAmount: root.attributedRevenueAmount,
          commissionPercent: root.commissionPercent,
          commissionAmount: root.commissionAmount,
          currency: root.currency,
          status: 'EARNED',
          earnedAt: new Date(),
          correctionEventId: orphanEventId,
          idempotencyKey: `r15-orphan:${orphanEventId}`,
          reason: 'R15-C-T5 planted orphan event (no lineage)',
          createdBy: actorId,
        },
      });
    });
    const beforeAcc = await wrapper.withPlatformBypass((c) =>
      c.commissionAccrual.count({ where: { tenantId, servicePerformanceId: performanceId } }),
    );
    const beforeLin = await wrapper.withPlatformBypass((c) =>
      c.commissionCorrectionLineage.count({ where: { tenantId } }),
    );
    const repl = await createSameInvoiceReplacementLine(invoiceId, { amount: '100.00' });
    await expect(
      accruals().correctAndRepost({
        accrualId: root.id,
        correctionEventId: orphanEventId,
        replacementInvoiceLineId: repl,
        reason: 'R15-C-T5',
        actor: actorId,
        actorRoles: ['owner'],
      }),
    ).rejects.toThrow(/historical correction economics without durable lineage|fail closed/i);
    expect(
      await wrapper.withPlatformBypass((c) =>
        c.commissionAccrual.count({ where: { tenantId, servicePerformanceId: performanceId } }),
      ),
    ).toBe(beforeAcc);
    expect(
      await wrapper.withPlatformBypass((c) => c.commissionCorrectionLineage.count({ where: { tenantId } })),
    ).toBe(beforeLin);
    expect(await lineageCount(orphanEventId)).toBe(0);
  });

  it('R15-C-T6 post-lineage same-event replay returns same replacement ids', async () => {
    const { invoiceId, root } = await setupServiceNet1Pct();
    const eventId = randomUUID();
    const repl = await createSameInvoiceReplacementLine(invoiceId, { amount: '100.00' });
    const first = await accruals().correctAndRepost({
      accrualId: root.id,
      correctionEventId: eventId,
      replacementInvoiceLineId: repl,
      reason: 'R15-C-T6',
      actor: actorId,
      actorRoles: ['owner'],
    });
    const second = await accruals().correctAndRepost({
      accrualId: root.id,
      correctionEventId: eventId,
      replacementInvoiceLineId: repl,
      reason: 'R15-C-T6-replay',
      actor: actorId,
      actorRoles: ['owner'],
    });
    expect((second as { idempotent: boolean }).idempotent).toBe(true);
    const firstIds = ((first as { repost?: { accruals?: Array<{ id: string }> } }).repost?.accruals ?? []).map(
      (a) => a.id,
    );
    const secondIds = (
      (second as { repost?: { accruals?: Array<{ id: string }> } }).repost?.accruals ?? []
    ).map((a) => a.id);
    if (firstIds.length && secondIds.length) {
      expect(secondIds).toEqual(firstIds);
    }
    expect(await lineageCount(eventId)).toBe(1);
  });

  it('R15-C-T7 concurrent same-event first creation → one lineage', async () => {
    const { performanceId, invoiceId, root } = await setupServiceNet1Pct();
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
        reason: 'R15-C-T7-A',
        actor: actorId,
        actorRoles: ['owner'],
      }),
      accrualsB.correctAndRepost({
        accrualId: root.id,
        correctionEventId: eventId,
        replacementInvoiceLineId: repl,
        reason: 'R15-C-T7-B',
        actor: actorId,
        actorRoles: ['owner'],
      }),
    ]);
    await clientB.$disconnect();
    expect(a.status === 'fulfilled' || b.status === 'fulfilled').toBe(true);
    if (a.status === 'rejected' && b.status === 'rejected') throw a.reason;
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

  it('R15-C-T8 injected failure leaves snapshot unchanged', async () => {
    const { performanceId, invoiceId, lineId, root } = await setupServiceNet1Pct();
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
          throw new Error('R15-C-T8 injected failure after lineage before repost');
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
        reason: 'R15-C-T8',
        actor: actorId,
        actorRoles: ['owner'],
      }),
    ).rejects.toThrow(/R15-C-T8 injected failure/i);
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
});
