/**
 * Phase 48 Wave F Round 16 — exact full-refund saturation + scalable long refund history.
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

describeDb('Wave F Round 16 remediation (PostgreSQL)', () => {
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
        data: { id: tenantId, name: 'WF R16', slug: `wfr16-${tenantId.slice(0, 8)}` },
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
            email: `wfr16-${u.id.slice(0, 8)}@t.local`,
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
        data: { id: branchId, tenantId, name: `R16 B ${branchId.slice(0, 6)}` },
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
      invoiceNumber: `R16-${randomUUID().slice(0, 8)}`,
      invoiceDate: new Date('2026-09-01'),
      currency: 'SYP',
      notes: 'R16',
      lineItems: [
        {
          description: 'R16 clinical line',
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
          reason: 'R16 refund',
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
            reason: effect.reason ?? 'R16 planted refund',
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

  async function applyExactFullSplit(invoiceId: string, rootId: string) {
    const rA = await createRefund(invoiceId, '33.34');
    const rB = await createRefund(invoiceId, '33.33');
    const rC = await createRefund(invoiceId, '33.33');
    const revA = await accruals().reverseAccrual({
      accrualId: rootId,
      refundId: rA,
      actor: actorId,
      actorRoles: ['owner'],
    });
    const revB = await accruals().reverseAccrual({
      accrualId: rootId,
      refundId: rB,
      actor: actorId,
      actorRoles: ['owner'],
    });
    const revC = await accruals().reverseAccrual({
      accrualId: rootId,
      refundId: rC,
      actor: actorId,
      actorRoles: ['owner'],
    });
    return { rA, rB, rC, revA, revB, revC };
  }

  async function setupServiceNet10Pct() {
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
    return { performanceId, invoiceId, lineId, root };
  }

  async function refundEffects(rootId: string) {
    return wrapper.withPlatformBypass((c) =>
      c.commissionAccrual.findMany({
        where: { tenantId, reversalOfAccrualId: rootId, refundId: { not: null } },
        orderBy: { id: 'asc' },
      }),
    );
  }

  // ── R16-A exact full-refund saturation ─────────────────────────────────────

  it('R16-A-T1 invoice-based exact full refund 33.34+33.33+33.33 → nets 0.00/0.00', async () => {
    const { performanceId, invoiceId, root } = await setupServiceNet10Pct();
    expect(new Prisma.Decimal(root.attributedRevenueAmount).toFixed(2)).toBe('100.00');
    expect(new Prisma.Decimal(root.commissionAmount).toFixed(2)).toBe('10.00');
    const { rA, rB, rC, revA, revB, revC } = await applyExactFullSplit(invoiceId, root.id);
    const byRefund = new Map(
      [revA, revB, revC].map((r) => [
        (r as { refundId: string }).refundId,
        r as { attributedRevenueAmount: Prisma.Decimal; commissionAmount: Prisma.Decimal; id: string },
      ]),
    );
    // Record each effect (order-dependent which absorbs residual).
    for (const id of [rA, rB, rC]) {
      const row = byRefund.get(id)!;
      expect(new Prisma.Decimal(row.attributedRevenueAmount).lte(0)).toBe(true);
      expect(new Prisma.Decimal(row.commissionAmount).lte(0)).toBe(true);
    }
    const sumRev = [revA, revB, revC].reduce(
      (a, r) => a.add(new Prisma.Decimal((r as { attributedRevenueAmount: Prisma.Decimal }).attributedRevenueAmount).abs()),
      new Prisma.Decimal(0),
    );
    const sumComm = [revA, revB, revC].reduce(
      (a, r) => a.add(new Prisma.Decimal((r as { commissionAmount: Prisma.Decimal }).commissionAmount).abs()),
      new Prisma.Decimal(0),
    );
    expect(sumRev.toFixed(2)).toBe('100.00');
    expect(sumComm.toFixed(2)).toBe('10.00');
    expect((await netAttributed(performanceId)).toFixed(2)).toBe('0.00');
    expect((await netCommission(performanceId)).toFixed(2)).toBe('0.00');
  });

  it('R16-A-T2 final canonical reversal absorbs commission residual within remaining capacity', async () => {
    const { invoiceId, root } = await setupServiceNet10Pct();
    const { revA, revB, revC } = await applyExactFullSplit(invoiceId, root.id);
    const rows = [revA, revB, revC] as Array<{
      attributedRevenueAmount: Prisma.Decimal;
      commissionAmount: Prisma.Decimal;
    }>;
    const absComm = rows.map((r) => new Prisma.Decimal(r.commissionAmount).abs());
    const maxComm = absComm.reduce((a, b) => (a.gt(b) ? a : b));
    // One effect absorbs 3.34 residual; others are 3.33.
    expect(maxComm.toFixed(2)).toBe('3.34');
    expect(absComm.filter((c) => c.toFixed(2) === '3.33').length).toBe(2);
    expect(absComm.every((c) => c.lte(new Prisma.Decimal('3.34')))).toBe(true);
  });

  it('R16-A-T3 replay each of three refunds; same row IDs; nets remain 0/0', async () => {
    const { performanceId, invoiceId, root } = await setupServiceNet10Pct();
    const { rA, rB, rC, revA, revB, revC } = await applyExactFullSplit(invoiceId, root.id);
    const ids = new Set(
      [revA, revB, revC].map((r) => (r as { id: string }).id),
    );
    const auditBefore = auditCalls.length;
    for (const refundId of [rA, rB, rC]) {
      const again = await accruals().reverseAccrual({
        accrualId: root.id,
        refundId,
        actor: actorId,
        actorRoles: ['owner'],
      });
      expect(ids.has((again as { id: string }).id)).toBe(true);
    }
    expect((await refundEffects(root.id)).length).toBe(3);
    expect(auditCalls.length).toBe(auditBefore);
    expect((await netAttributed(performanceId)).toFixed(2)).toBe('0.00');
    expect((await netCommission(performanceId)).toFixed(2)).toBe('0.00');
  });

  it('R16-A-T4 additional refund after exhaustion fails closed with snapshot equality', async () => {
    const { performanceId, invoiceId, root } = await setupServiceNet10Pct();
    await applyExactFullSplit(invoiceId, root.id);
    const beforeEffects = await refundEffects(root.id);
    const beforeNetR = await netAttributed(performanceId);
    const beforeNetC = await netCommission(performanceId);
    const rD = await createRefund(invoiceId, '0.10');
    await expect(
      accruals().reverseAccrual({
        accrualId: root.id,
        refundId: rD,
        actor: actorId,
        actorRoles: ['owner'],
      }),
    ).rejects.toThrow(/no remaining|exhausted|zero in both/i);
    const afterEffects = await refundEffects(root.id);
    expect(afterEffects.map((e) => e.id).sort()).toEqual(beforeEffects.map((e) => e.id).sort());
    expect((await netAttributed(performanceId)).toFixed(2)).toBe(beforeNetR.toFixed(2));
    expect((await netCommission(performanceId)).toFixed(2)).toBe(beforeNetC.toFixed(2));
  });

  it('R16-A-T5 retain asymmetric 100/1 path; final legitimate -0.10/0.00', async () => {
    const { performanceId, invoiceId, root } = await setupServiceNet1Pct();
    const { rD, tail } = await applyAsymFullWithTail(invoiceId, root.id);
    expect(new Prisma.Decimal((tail as { attributedRevenueAmount: Prisma.Decimal }).attributedRevenueAmount).toFixed(2)).toBe(
      '-0.10',
    );
    expect(new Prisma.Decimal((tail as { commissionAmount: Prisma.Decimal }).commissionAmount).toFixed(2)).toBe(
      '0.00',
    );
    expect((await netAttributed(performanceId)).toFixed(2)).toBe('0.00');
    expect((await netCommission(performanceId)).toFixed(2)).toBe('0.00');
    const row = await wrapper.withPlatformBypass((c) =>
      c.commissionAccrual.findFirst({ where: { tenantId, refundId: rD } }),
    );
    expect(row!.id).toBe((tail as { id: string }).id);
  });

  it('R16-A-T6 revenue exhausts first on 100/10; exact full refund without over-refund', async () => {
    // Use proposals that exhaust revenue before commission via large early revenue shares,
    // then saturate with remaining refunds totaling 100.
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
    const amounts = ['40.00', '40.00', '20.00'];
    for (const amt of amounts) {
      const rid = await createRefund(invoiceId, amt);
      await accruals().reverseAccrual({
        accrualId: root.id,
        refundId: rid,
        actor: actorId,
        actorRoles: ['owner'],
      });
    }
    expect((await netAttributed(performanceId)).toFixed(2)).toBe('0.00');
    expect((await netCommission(performanceId)).toFixed(2)).toBe('0.00');
    expect((await refundEffects(root.id)).length).toBe(3);
  });

  it('R16-A-T7 package COLLECTED_REVENUE exact saturation; provenance preserved', async () => {
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
      idempotencyKey: `r16-pkg-${sessionId}`,
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
    expect(root.paymentId).toBe(pay);
    expect(root.currency).toBe('SYP');
    await applyExactFullSplit(invoiceId, root.id);
    const effects = await refundEffects(root.id);
    expect(effects.length).toBe(3);
    for (const e of effects) {
      expect(e.packageAllocationId).toBe(packageAllocationId);
      expect(e.paymentId).toBe(pay);
      expect(e.currency).toBe('SYP');
    }
    expect((await netAttributed(performanceId)).toFixed(2)).toBe('0.00');
    expect((await netCommission(performanceId)).toFixed(2)).toBe('0.00');
  });

  it('R16-A-T8 non-package invoice-based exact saturation', async () => {
    const { performanceId, invoiceId, root } = await setupServiceNet10Pct();
    expect(root.packageAllocationId).toBeNull();
    await applyExactFullSplit(invoiceId, root.id);
    const effects = await refundEffects(root.id);
    expect(effects.every((e) => e.packageAllocationId == null)).toBe(true);
    expect((await netAttributed(performanceId)).toFixed(2)).toBe('0.00');
    expect((await netCommission(performanceId)).toFixed(2)).toBe('0.00');
  });

  it('R16-A-T9 correction after exact saturation; carry refund effects once; nets 0/0', async () => {
    const { performanceId, invoiceId, root } = await setupServiceNet10Pct();
    const { rA, rB, rC } = await applyExactFullSplit(invoiceId, root.id);
    const beforeEffects = await refundEffects(root.id);
    const eventId = randomUUID();
    const repl = await createSameInvoiceReplacementLine(invoiceId, { amount: '100.00' });
    await accruals().correctAndRepost({
      accrualId: root.id,
      correctionEventId: eventId,
      replacementInvoiceLineId: repl,
      reason: 'R16-A-T9',
      actor: actorId,
      actorRoles: ['owner'],
    });
    const lineage = await wrapper.withPlatformBypass((c) =>
      c.commissionCorrectionLineage.findFirst({ where: { tenantId, correctionEventId: eventId } }),
    );
    expect(lineage).toBeTruthy();
    expect(lineage!.selectedAccrualId).toBe(root.id);
    // Original refund identities remain exactly once on the selected root history.
    const afterOnRoot = await refundEffects(root.id);
    expect(afterOnRoot.length).toBe(beforeEffects.length);
    expect(new Set(afterOnRoot.map((e) => e.refundId)).size).toBe(3);
    for (const id of [rA, rB, rC]) {
      expect(afterOnRoot.some((e) => e.refundId === id)).toBe(true);
    }
    expect((await netAttributed(performanceId)).toFixed(2)).toBe('0.00');
    expect((await netCommission(performanceId)).toFixed(2)).toBe('0.00');
  });

  it('R16-A-T10 concurrent last-refund/replay race; exactly-once; no deadlock', async () => {
    const { invoiceId, root } = await setupServiceNet10Pct();
    const rA = await createRefund(invoiceId, '33.34');
    const rB = await createRefund(invoiceId, '33.33');
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
    const rC = await createRefund(invoiceId, '33.33');
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
        refundId: rC,
        actor: actorId,
        actorRoles: ['owner'],
      }),
      accrualsB.reverseAccrual({
        accrualId: root.id,
        refundId: rC,
        actor: actorId,
        actorRoles: ['owner'],
      }),
    ]);
    await clientB.$disconnect();
    expect(a.status === 'fulfilled' || b.status === 'fulfilled').toBe(true);
    if (a.status === 'rejected' && b.status === 'rejected') throw a.reason;
    const count = await wrapper.withPlatformBypass((c) =>
      c.commissionAccrual.count({
        where: { tenantId, reversalOfAccrualId: root.id, refundId: rC },
      }),
    );
    expect(count).toBe(1);
  });

  it('R16-A-T11 injected failure after saturation calc rolls back', async () => {
    const { invoiceId, root } = await setupServiceNet10Pct();
    const rA = await createRefund(invoiceId, '33.34');
    const rB = await createRefund(invoiceId, '33.33');
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
    const rC = await createRefund(invoiceId, '33.33');
    const before = await refundEffects(root.id);
    const failingAudit = {
      record: async (e: Record<string, unknown>) => {
        auditCalls.push({ ...e, via: 'record' });
      },
      recordInTransaction: async (_tx: unknown, e: Record<string, unknown>) => {
        if (e.action === 'staff_commission.accrual.reversed') {
          throw new Error('R16-A-T11 injected mid-tx failure');
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
      failing.reverseAccrual({
        accrualId: root.id,
        refundId: rC,
        actor: actorId,
        actorRoles: ['owner'],
      }),
    ).rejects.toThrow(/R16-A-T11 injected mid-tx failure/i);
    const after = await refundEffects(root.id);
    expect(after.map((e) => e.id).sort()).toEqual(before.map((e) => e.id).sort());
  });

  it('R16-A-T12 ownerReport commission net/outstanding reconciles to 0.00', async () => {
    const { performanceId, invoiceId, root } = await setupServiceNet10Pct();
    await applyExactFullSplit(invoiceId, root.id);
    const report = await accruals().ownerReport({
      from: '2026-01-01',
      to: '2026-12-31',
      userId: performerId,
    });
    const sy = (report.byCurrency as Array<{ currency: string; outstanding: string; net: string }>).find(
      (c) => c.currency === 'SYP',
    );
    expect(sy).toBeTruthy();
    expect(sy!.outstanding).toBe('0.00');
    expect(sy!.net).toBe('0.00');
    expect((await netCommission(performanceId)).toFixed(2)).toBe('0.00');
    expect(root.id).toBeTruthy();
  });

  // ── R16-B scalable long refund history ─────────────────────────────────────

  it('R16-B-T1 thirteen valid partial refund effects; all creations succeed', async () => {
    const { performanceId, invoiceId, root } = await setupServiceNet10Pct();
    const n = 13;
    const piece = new Prisma.Decimal('7.69');
    const amounts: string[] = [];
    let sum = new Prisma.Decimal(0);
    for (let i = 0; i < n - 1; i++) {
      amounts.push(piece.toFixed(2));
      sum = sum.add(piece);
    }
    amounts.push(new Prisma.Decimal(100).sub(sum).toFixed(2));
    for (const amt of amounts) {
      const rid = await createRefund(invoiceId, amt);
      await accruals().reverseAccrual({
        accrualId: root.id,
        refundId: rid,
        actor: actorId,
        actorRoles: ['owner'],
      });
    }
    expect((await refundEffects(root.id)).length).toBe(13);
    expect((await netAttributed(performanceId)).toFixed(2)).toBe('0.00');
    expect((await netCommission(performanceId)).toFixed(2)).toBe('0.00');
  });

  it('R16-B-T2 replay canonical refund after 13 effects; no SET_TOO_LARGE', async () => {
    const { invoiceId, root } = await setupServiceNet10Pct();
    const refundIds: string[] = [];
    const piece = new Prisma.Decimal('7.69');
    let sum = new Prisma.Decimal(0);
    for (let i = 0; i < 12; i++) {
      refundIds.push(await createRefund(invoiceId, piece.toFixed(2)));
      sum = sum.add(piece);
    }
    refundIds.push(await createRefund(invoiceId, new Prisma.Decimal(100).sub(sum).toFixed(2)));
    let firstId = '';
    for (const rid of refundIds) {
      const row = await accruals().reverseAccrual({
        accrualId: root.id,
        refundId: rid,
        actor: actorId,
        actorRoles: ['owner'],
      });
      if (!firstId) firstId = (row as { id: string }).id;
    }
    const replay = await accruals().reverseAccrual({
      accrualId: root.id,
      refundId: refundIds[0]!,
      actor: actorId,
      actorRoles: ['owner'],
    });
    expect((replay as { id: string }).id).toBe(firstId);
    expect((await refundEffects(root.id)).length).toBe(13);
  });

  it('R16-B-T3 correct and carry valid 13-effect history', async () => {
    const { performanceId, invoiceId, root } = await setupServiceNet10Pct();
    const piece = new Prisma.Decimal('7.69');
    let sum = new Prisma.Decimal(0);
    const refundIds: string[] = [];
    for (let i = 0; i < 12; i++) {
      refundIds.push(await createRefund(invoiceId, piece.toFixed(2)));
      sum = sum.add(piece);
    }
    refundIds.push(await createRefund(invoiceId, new Prisma.Decimal(100).sub(sum).toFixed(2)));
    for (const rid of refundIds) {
      await accruals().reverseAccrual({
        accrualId: root.id,
        refundId: rid,
        actor: actorId,
        actorRoles: ['owner'],
      });
    }
    const before = await refundEffects(root.id);
    const eventId = randomUUID();
    const repl = await createSameInvoiceReplacementLine(invoiceId, { amount: '100.00' });
    await accruals().correctAndRepost({
      accrualId: root.id,
      correctionEventId: eventId,
      replacementInvoiceLineId: repl,
      reason: 'R16-B-T3',
      actor: actorId,
      actorRoles: ['owner'],
    });
    const after = await refundEffects(root.id);
    expect(after.length).toBe(13);
    expect(new Set(after.map((e) => e.refundId))).toEqual(new Set(before.map((e) => e.refundId)));
    expect((await netAttributed(performanceId)).toFixed(2)).toBe('0.00');
    expect((await netCommission(performanceId)).toFixed(2)).toBe('0.00');
  });

  it('R16-B-T4 twenty-five valid effects within practical timeout', async () => {
    const { performanceId, invoiceId, root } = await setupServiceNet10Pct();
    const n = 25;
    const piece = new Prisma.Decimal('4.00');
    let sum = new Prisma.Decimal(0);
    const t0 = Date.now();
    for (let i = 0; i < n - 1; i++) {
      const rid = await createRefund(invoiceId, piece.toFixed(2));
      sum = sum.add(piece);
      await accruals().reverseAccrual({
        accrualId: root.id,
        refundId: rid,
        actor: actorId,
        actorRoles: ['owner'],
      });
    }
    const last = await createRefund(invoiceId, new Prisma.Decimal(100).sub(sum).toFixed(2));
    await accruals().reverseAccrual({
      accrualId: root.id,
      refundId: last,
      actor: actorId,
      actorRoles: ['owner'],
    });
    expect(Date.now() - t0).toBeLessThan(120_000);
    expect((await refundEffects(root.id)).length).toBe(25);
    expect((await netAttributed(performanceId)).toFixed(2)).toBe('0.00');
    expect((await netCommission(performanceId)).toFixed(2)).toBe('0.00');
  });

  it('R16-B-T5 fifty-effect stress; stable runtime and exact nets', async () => {
    const { performanceId, invoiceId, root } = await setupServiceNet10Pct();
    const n = 50;
    const piece = new Prisma.Decimal('2.00');
    let sum = new Prisma.Decimal(0);
    const t0 = Date.now();
    for (let i = 0; i < n - 1; i++) {
      const rid = await createRefund(invoiceId, piece.toFixed(2));
      sum = sum.add(piece);
      await accruals().reverseAccrual({
        accrualId: root.id,
        refundId: rid,
        actor: actorId,
        actorRoles: ['owner'],
      });
    }
    const last = await createRefund(invoiceId, new Prisma.Decimal(100).sub(sum).toFixed(2));
    await accruals().reverseAccrual({
      accrualId: root.id,
      refundId: last,
      actor: actorId,
      actorRoles: ['owner'],
    });
    expect(Date.now() - t0).toBeLessThan(180_000);
    expect((await refundEffects(root.id)).length).toBe(50);
    expect((await netAttributed(performanceId)).toFixed(2)).toBe('0.00');
    expect((await netCommission(performanceId)).toFixed(2)).toBe('0.00');
  });

  it('R16-B-T6 forged long history rejected on replay/validation path', async () => {
    const { invoiceId, root } = await setupServiceNet10Pct();
    const piece = new Prisma.Decimal('7.69');
    let sum = new Prisma.Decimal(0);
    const refundIds: string[] = [];
    for (let i = 0; i < 12; i++) {
      refundIds.push(await createRefund(invoiceId, piece.toFixed(2)));
      sum = sum.add(piece);
    }
    refundIds.push(await createRefund(invoiceId, new Prisma.Decimal(100).sub(sum).toFixed(2)));

    // Plant a forged 13-effect history that preserves aggregate capacity but is
    // not sequentially realizable (first effect absorbs impossible commission bump).
    const effects = refundIds.map((refundId, i) => {
      const basis =
        i < 12 ? piece : new Prisma.Decimal(100).sub(piece.mul(12));
      let comm = new Prisma.Decimal(10).mul(basis).div(100);
      comm = new Prisma.Decimal(comm.toFixed(2));
      if (i === 0) comm = comm.add('0.50');
      if (i === 12) comm = comm.sub('0.50');
      return {
        refundId,
        attributed: basis.negated().toFixed(2),
        commission: comm.negated().toFixed(2),
        reason: 'R16-B-T6 forged',
      };
    });
    await plantRefundEffects(root, effects);

    await expect(
      accruals().reverseAccrual({
        accrualId: root.id,
        refundId: refundIds[1]!,
        actor: actorId,
        actorRoles: ['owner'],
      }),
    ).rejects.toThrow(/not realizable|complete-set/i);
  });

  it('R16-B-T7 long asymmetric history ending in exact cumulative full-refund saturation', async () => {
    const { performanceId, invoiceId, root } = await setupServiceNet1Pct();
    // 9 x 10.00 + final 10.00 = 100; commission 1% saturates with residual handling.
    for (let i = 0; i < 9; i++) {
      const rid = await createRefund(invoiceId, '10.00');
      await accruals().reverseAccrual({
        accrualId: root.id,
        refundId: rid,
        actor: actorId,
        actorRoles: ['owner'],
      });
    }
    const last = await createRefund(invoiceId, '10.00');
    await accruals().reverseAccrual({
      accrualId: root.id,
      refundId: last,
      actor: actorId,
      actorRoles: ['owner'],
    });
    expect((await refundEffects(root.id)).length).toBe(10);
    expect((await netAttributed(performanceId)).toFixed(2)).toBe('0.00');
    expect((await netCommission(performanceId)).toFixed(2)).toBe('0.00');
  });

  it('R16-B-T8 package COLLECTED_REVENUE long history preserves provenance', async () => {
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
      idempotencyKey: `r16-pkg-long-${sessionId}`,
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
    for (let i = 0; i < 12; i++) {
      const rid = await createRefund(invoiceId, '7.69');
      await accruals().reverseAccrual({
        accrualId: root.id,
        refundId: rid,
        actor: actorId,
        actorRoles: ['owner'],
      });
    }
    const last = await createRefund(invoiceId, '7.72');
    await accruals().reverseAccrual({
      accrualId: root.id,
      refundId: last,
      actor: actorId,
      actorRoles: ['owner'],
    });
    const effects = await refundEffects(root.id);
    expect(effects.length).toBe(13);
    expect(effects.every((e) => e.packageAllocationId === packageAllocationId)).toBe(true);
    expect(effects.every((e) => e.paymentId === pay)).toBe(true);
    expect(effects.every((e) => e.currency === 'SYP')).toBe(true);
    expect((await netAttributed(performanceId)).toFixed(2)).toBe('0.00');
    expect((await netCommission(performanceId)).toFixed(2)).toBe('0.00');
  });

  it('R16-B-T9 concurrent creation around 13th effect; exactly-once', async () => {
    const { invoiceId, root } = await setupServiceNet10Pct();
    const piece = new Prisma.Decimal('7.69');
    let sum = new Prisma.Decimal(0);
    for (let i = 0; i < 12; i++) {
      const rid = await createRefund(invoiceId, piece.toFixed(2));
      sum = sum.add(piece);
      await accruals().reverseAccrual({
        accrualId: root.id,
        refundId: rid,
        actor: actorId,
        actorRoles: ['owner'],
      });
    }
    const lastAmt = new Prisma.Decimal(100).sub(sum).toFixed(2);
    const r13 = await createRefund(invoiceId, lastAmt);
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
        refundId: r13,
        actor: actorId,
        actorRoles: ['owner'],
      }),
      accrualsB.reverseAccrual({
        accrualId: root.id,
        refundId: r13,
        actor: actorId,
        actorRoles: ['owner'],
      }),
    ]);
    await clientB.$disconnect();
    expect(a.status === 'fulfilled' || b.status === 'fulfilled').toBe(true);
    if (a.status === 'rejected' && b.status === 'rejected') throw a.reason;
    expect(
      await wrapper.withPlatformBypass((c) =>
        c.commissionAccrual.count({
          where: { tenantId, reversalOfAccrualId: root.id, refundId: r13 },
        }),
      ),
    ).toBe(1);
    expect((await refundEffects(root.id)).length).toBe(13);
  });

  it('R16-B-T10 correction/replay/injected-failure rollback across long history', async () => {
    const { performanceId, invoiceId, root, lineId } = await setupServiceNet10Pct();
    const piece = new Prisma.Decimal('7.69');
    let sum = new Prisma.Decimal(0);
    for (let i = 0; i < 12; i++) {
      const rid = await createRefund(invoiceId, piece.toFixed(2));
      sum = sum.add(piece);
      await accruals().reverseAccrual({
        accrualId: root.id,
        refundId: rid,
        actor: actorId,
        actorRoles: ['owner'],
      });
    }
    const last = await createRefund(invoiceId, new Prisma.Decimal(100).sub(sum).toFixed(2));
    await accruals().reverseAccrual({
      accrualId: root.id,
      refundId: last,
      actor: actorId,
      actorRoles: ['owner'],
    });
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
          throw new Error('R16-B-T10 injected failure after lineage before repost');
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
        reason: 'R16-B-T10',
        actor: actorId,
        actorRoles: ['owner'],
      }),
    ).rejects.toThrow(/R16-B-T10 injected failure/i);
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
    expect(binding!.servicePerformanceId).toBe(performanceId);
  });
});
