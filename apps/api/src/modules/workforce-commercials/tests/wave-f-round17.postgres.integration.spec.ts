/**
 * Phase 48 Wave F Round 17 — two-validator final narrow remediation (PostgreSQL).
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

jest.setTimeout(300_000);
const describeDb = platformDbSecurityEnabled() ? describe : describe.skip;

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

describeDb('Wave F Round 17 remediation (PostgreSQL)', () => {
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
    patientId = randomUUID();
    branchId = randomUUID();
    clinicalServiceId = randomUUID();
    appointmentId = randomUUID();
    auditCalls.length = 0;
    await wrapper.withPlatformBypass(async (c) => {
      await c.tenant.create({
        data: { id: tenantId, name: 'WF R17', slug: `wfr17-${tenantId.slice(0, 8)}` },
      });
      for (const u of [
        { id: actorId, first: 'A', last: 'Ctor' },
        { id: performerId, first: 'Perf', last: 'Ormer' },
      ]) {
        await c.user.create({
          data: {
            id: u.id,
            tenantId,
            email: `wfr17-${u.id.slice(0, 8)}@t.local`,
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
        data: { id: branchId, tenantId, name: `R17 B ${branchId.slice(0, 6)}` },
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

  async function enableAndPublishPlan(userId: string, percentage: number) {
    await plans().setUserCommissionEligibility(userId, true, percentage, '2026-01-01', {
      actorId,
      actorRoles: ['owner'],
    });
    const draft = await plans().createDraftPlan({
      userId,
      percentage,
      effectiveFrom: '2026-01-01',
      calculationBasis: 'SERVICE_NET_AFTER_DISCOUNT',
      earningTrigger: 'INVOICE_OR_CHARGE_FINALIZED',
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

  async function createInvoiceViaProductionPath(servicePerformanceId: string, amount = '100.00') {
    const invoice = Invoice.create({
      invoiceId: randomUUID(),
      tenantId,
      branchId,
      patientId,
      invoiceNumber: `R17-${randomUUID().slice(0, 8)}`,
      invoiceDate: new Date('2026-09-01'),
      currency: 'SYP',
      notes: 'R17',
      lineItems: [
        {
          description: 'R17 clinical line',
          quantity: 1,
          unitPrice: Number(amount),
          discountPercent: 0,
          taxPercent: 0,
          servicePerformanceId,
          appointmentId,
          clinicalServiceId,
          courseSessionId: null,
        },
      ] as never,
    });
    invoice.issue();
    await raw.$executeRaw`SELECT set_config('app.platform_rls_bypass', 'true', false)`;
    await new PrismaInvoiceRepository(raw as never).save(invoice);
    return { invoiceId: invoice.invoiceId, lineId: invoice.lineItems[0]!.itemId };
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
          reason: 'R17 refund',
          refundMethod: 'cash',
          refundDate: new Date('2026-09-02'),
          approvedBy: actorId,
        },
      });
    });
    return refundId;
  }

  async function createSameInvoiceReplacementLine(invoiceId: string, amount = '100.00') {
    const id = randomUUID();
    await wrapper.withPlatformBypass(async (c) => {
      await c.invoiceLineItem.create({
        data: {
          id,
          invoiceId,
          tenantId,
          description: 'R17 corrected line',
          quantity: 1,
          unitPrice: amount,
          discountPercent: 0,
          taxPercent: 0,
          subtotal: amount,
          discountAmount: 0,
          taxAmount: 0,
          lineTotal: amount,
          appointmentId,
          clinicalServiceId,
          servicePerformanceId: null,
        },
      });
    });
    return id;
  }

  async function openRoots(performanceId: string) {
    return wrapper.withPlatformBypass((c) =>
      c.commissionAccrual.findMany({
        where: {
          tenantId,
          servicePerformanceId: performanceId,
          status: 'EARNED',
          reversalOfAccrualId: null,
        },
      }),
    ) as Promise<AccrualRootRow[]>;
  }

  async function netAttributed(performanceId: string) {
    return wrapper.withPlatformBypass(async (c) => {
      const rows = await c.commissionAccrual.findMany({
        where: { tenantId, servicePerformanceId: performanceId },
      });
      return rows.reduce(
        (a, r) => a.add(new Prisma.Decimal(r.attributedRevenueAmount)),
        new Prisma.Decimal(0),
      );
    });
  }

  async function netCommission(performanceId: string) {
    return wrapper.withPlatformBypass(async (c) => {
      const rows = await c.commissionAccrual.findMany({
        where: { tenantId, servicePerformanceId: performanceId },
      });
      return rows.reduce(
        (a, r) => a.add(new Prisma.Decimal(r.commissionAmount)),
        new Prisma.Decimal(0),
      );
    });
  }

  async function refundEffects(rootId: string) {
    return wrapper.withPlatformBypass((c) =>
      c.commissionAccrual.findMany({
        where: { tenantId, reversalOfAccrualId: rootId, refundId: { not: null } },
        orderBy: { id: 'asc' },
      }),
    );
  }

  async function plantRefundEffects(
    root: AccrualRootRow,
    effects: Array<{ refundId: string; attributed: string; commission: string }>,
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
            reason: 'R17 planted',
            createdBy: actorId,
          },
        });
      });
    }
  }

  async function setupServiceNet1Pct() {
    await enableAndPublishPlan(performerId, 1);
    const performanceId = await createCompletedPerformance();
    const { invoiceId, lineId } = await createInvoiceViaProductionPath(performanceId);
    await accruals().postFromServicePerformance({
      servicePerformanceId: performanceId,
      invoiceLineId: lineId,
      actor: actorId,
      actorRoles: ['owner'],
    });
    const root = (await openRoots(performanceId))[0]!;
    return { performanceId, invoiceId, lineId, root };
  }

  async function setupServiceNet10Pct() {
    await enableAndPublishPlan(performerId, 10);
    const performanceId = await createCompletedPerformance();
    const { invoiceId, lineId } = await createInvoiceViaProductionPath(performanceId);
    await accruals().postFromServicePerformance({
      servicePerformanceId: performanceId,
      invoiceLineId: lineId,
      actor: actorId,
      actorRoles: ['owner'],
    });
    const root = (await openRoots(performanceId))[0]!;
    return { performanceId, invoiceId, root };
  }

  /** Mandatory R17-A fixture: 100 × 0.50 exact + 25 × 0.50 one-zero specials. */
  async function apply100Exact25Special(invoiceId: string, rootId: string) {
    const refundIds: string[] = [];
    for (let i = 0; i < 125; i++) {
      const rid = await createRefund(invoiceId, '0.50');
      await accruals().reverseAccrual({
        accrualId: rootId,
        refundId: rid,
        actor: actorId,
        actorRoles: ['owner'],
      });
      refundIds.push(rid);
    }
    return refundIds;
  }

  async function applyExactFullSplit(invoiceId: string, rootId: string) {
    const rA = await createRefund(invoiceId, '33.34');
    const rB = await createRefund(invoiceId, '33.33');
    const rC = await createRefund(invoiceId, '33.33');
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
    const revC = await accruals().reverseAccrual({
      accrualId: rootId,
      refundId: rC,
      actor: actorId,
      actorRoles: ['owner'],
    });
    return { rA, rB, rC, revC };
  }

  // ── R17-A long special history ─────────────────────────────────────────────

  it('R17-A-T1 100 exact + 25 valid one-zero specials; sequential creation succeeds', async () => {
    const { performanceId, invoiceId, root } = await setupServiceNet1Pct();
    const t0 = Date.now();
    const refundIds = await apply100Exact25Special(invoiceId, root.id);
    expect(Date.now() - t0).toBeLessThan(240_000);
    expect(refundIds.length).toBe(125);
    const effects = await refundEffects(root.id);
    expect(effects.length).toBe(125);
    const sumRev = effects.reduce(
      (a, e) => a.add(new Prisma.Decimal(e.attributedRevenueAmount).abs()),
      new Prisma.Decimal(0),
    );
    const sumComm = effects.reduce(
      (a, e) => a.add(new Prisma.Decimal(e.commissionAmount).abs()),
      new Prisma.Decimal(0),
    );
    expect(sumRev.toFixed(2)).toBe('62.50');
    expect(sumComm.toFixed(2)).toBe('1.00');
    const oneZero = effects.filter(
      (e) =>
        new Prisma.Decimal(e.attributedRevenueAmount).abs().toFixed(2) === '0.50' &&
        new Prisma.Decimal(e.commissionAmount).abs().toFixed(2) === '0.00',
    );
    expect(oneZero.length).toBeGreaterThanOrEqual(25);
    expect((await netAttributed(performanceId)).toFixed(2)).toBe('37.50');
    expect((await netCommission(performanceId)).toFixed(2)).toBe('0.00');
  });

  it('R17-A-T2 replay existing refund in 125-effect history; exactly-once', async () => {
    const { invoiceId, root } = await setupServiceNet1Pct();
    const refundIds = await apply100Exact25Special(invoiceId, root.id);
    const first = refundIds[50]!;
    const before = await refundEffects(root.id);
    const firstRow = before.find((e) => e.refundId === first)!;
    const replay = await accruals().reverseAccrual({
      accrualId: root.id,
      refundId: first,
      actor: actorId,
      actorRoles: ['owner'],
    });
    expect((replay as { id: string }).id).toBe(firstRow.id);
    expect((await refundEffects(root.id)).length).toBe(125);
  });

  it('R17-A-T3 correction carries 125-effect history; nets preserved', async () => {
    const { performanceId, invoiceId, root } = await setupServiceNet1Pct();
    await apply100Exact25Special(invoiceId, root.id);
    const before = await refundEffects(root.id);
    const eventId = randomUUID();
    const repl = await createSameInvoiceReplacementLine(invoiceId);
    await accruals().correctAndRepost({
      accrualId: root.id,
      correctionEventId: eventId,
      replacementInvoiceLineId: repl,
      reason: 'R17-A-T3',
      actor: actorId,
      actorRoles: ['owner'],
    });
    const after = await refundEffects(root.id);
    expect(after.length).toBe(125);
    expect(new Set(after.map((e) => e.refundId)).size).toBe(125);
    expect(new Set(before.map((e) => e.refundId))).toEqual(new Set(after.map((e) => e.refundId)));
    expect((await netAttributed(performanceId)).toFixed(2)).toBe('37.50');
    expect((await netCommission(performanceId)).toFixed(2)).toBe('0.00');
  });

  it('R17-A-T4 correction replay idempotent after 125-effect carry', async () => {
    const { invoiceId, root } = await setupServiceNet1Pct();
    await apply100Exact25Special(invoiceId, root.id);
    const eventId = randomUUID();
    const repl = await createSameInvoiceReplacementLine(invoiceId);
    await accruals().correctAndRepost({
      accrualId: root.id,
      correctionEventId: eventId,
      replacementInvoiceLineId: repl,
      reason: 'R17-A-T4',
      actor: actorId,
      actorRoles: ['owner'],
    });
    const lineageBefore = await wrapper.withPlatformBypass((c) =>
      c.commissionCorrectionLineage.count({ where: { tenantId, correctionEventId: eventId } }),
    );
    await accruals().correctAndRepost({
      accrualId: root.id,
      correctionEventId: eventId,
      replacementInvoiceLineId: repl,
      reason: 'R17-A-T4 replay',
      actor: actorId,
      actorRoles: ['owner'],
    });
    const lineageAfter = await wrapper.withPlatformBypass((c) =>
      c.commissionCorrectionLineage.count({ where: { tenantId, correctionEventId: eventId } }),
    );
    expect(lineageAfter).toBe(lineageBefore);
    expect((await refundEffects(root.id)).length).toBe(125);
  });

  it('R17-A-T5 injected failure rolls back long-history reverseAccrual', async () => {
    const { invoiceId, root } = await setupServiceNet1Pct();
    for (let i = 0; i < 100; i++) {
      const rid = await createRefund(invoiceId, '0.50');
      await accruals().reverseAccrual({
        accrualId: root.id,
        refundId: rid,
        actor: actorId,
        actorRoles: ['owner'],
      });
    }
    const before = await refundEffects(root.id);
    const rid = await createRefund(invoiceId, '0.50');
    const failingAudit = {
      record: async () => {
        throw new Error('R17-A-T5 injected mid-tx failure');
      },
      recordInTransaction: async () => {
        throw new Error('R17-A-T5 injected mid-tx failure');
      },
    };
    const failing = new CommissionAccrualService(
      wrapper as never,
      tenantContext as never,
      plans(),
      failingAudit as never,
    );
    await expect(
      failing.reverseAccrual({
        accrualId: root.id,
        refundId: rid,
        actor: actorId,
        actorRoles: ['owner'],
      }),
    ).rejects.toThrow(/R17-A-T5 injected mid-tx failure/i);
    const after = await refundEffects(root.id);
    expect(after.map((e) => e.id).sort()).toEqual(before.map((e) => e.id).sort());
  });

  it('R17-A-T10 concurrent replay on long history; exactly-once', async () => {
    const { invoiceId, root } = await setupServiceNet1Pct();
    const refundIds = await apply100Exact25Special(invoiceId, root.id);
    const target = refundIds[120]!;
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
        refundId: target,
        actor: actorId,
        actorRoles: ['owner'],
      }),
      accrualsB.reverseAccrual({
        accrualId: root.id,
        refundId: target,
        actor: actorId,
        actorRoles: ['owner'],
      }),
    ]);
    await clientB.$disconnect();
    expect(a.status === 'fulfilled' || b.status === 'fulfilled').toBe(true);
    const count = await wrapper.withPlatformBypass((c) =>
      c.commissionAccrual.count({
        where: { tenantId, reversalOfAccrualId: root.id, refundId: target },
      }),
    );
    expect(count).toBe(1);
  });

  // ── R17-B exact-only saturation rejection ──────────────────────────────────

  it('R17-B-T1 plant invalid exact-only saturated commission set; replay fail-closed', async () => {
    const { invoiceId, root } = await setupServiceNet10Pct();
    const rA = await createRefund(invoiceId, '33.34');
    const rB = await createRefund(invoiceId, '33.33');
    const rC = await createRefund(invoiceId, '33.33');
    await plantRefundEffects(root, [
      { refundId: rA, attributed: '-33.34', commission: '-3.33' },
      { refundId: rB, attributed: '-33.33', commission: '-3.33' },
      { refundId: rC, attributed: '-33.33', commission: '-3.33' },
    ]);
    await expect(
      accruals().reverseAccrual({
        accrualId: root.id,
        refundId: rB,
        actor: actorId,
        actorRoles: ['owner'],
      }),
    ).rejects.toThrow(/SATURATED_COMMISSION|not realizable|complete-set/i);
    expect((await refundEffects(root.id)).length).toBe(3);
  });

  it('R17-B-T2 correction on invalid exact-only set rolls back fully', async () => {
    const { invoiceId, root } = await setupServiceNet10Pct();
    const rA = await createRefund(invoiceId, '33.34');
    const rB = await createRefund(invoiceId, '33.33');
    const rC = await createRefund(invoiceId, '33.33');
    await plantRefundEffects(root, [
      { refundId: rA, attributed: '-33.34', commission: '-3.33' },
      { refundId: rB, attributed: '-33.33', commission: '-3.33' },
      { refundId: rC, attributed: '-33.33', commission: '-3.33' },
    ]);
    const beforeLineage = await wrapper.withPlatformBypass((c) =>
      c.commissionCorrectionLineage.count({ where: { tenantId } }),
    );
    const repl = await createSameInvoiceReplacementLine(invoiceId);
    await expect(
      accruals().correctAndRepost({
        accrualId: root.id,
        correctionEventId: randomUUID(),
        replacementInvoiceLineId: repl,
        reason: 'R17-B-T2',
        actor: actorId,
        actorRoles: ['owner'],
      }),
    ).rejects.toThrow(/SATURATED_COMMISSION|not realizable|complete-set/i);
    const afterLineage = await wrapper.withPlatformBypass((c) =>
      c.commissionCorrectionLineage.count({ where: { tenantId } }),
    );
    expect(afterLineage).toBe(beforeLineage);
    expect((await refundEffects(root.id)).length).toBe(3);
  });

  it('R17-B-T3 valid Round 16 exact saturation creation/replay/correction nets 0/0', async () => {
    const { performanceId, invoiceId, root } = await setupServiceNet10Pct();
    const { rA, revC } = await applyExactFullSplit(invoiceId, root.id);
    expect(new Prisma.Decimal((revC as { commissionAmount: Prisma.Decimal }).commissionAmount).abs().toFixed(2)).toBe(
      '3.34',
    );
    const replay = await accruals().reverseAccrual({
      accrualId: root.id,
      refundId: rA,
      actor: actorId,
      actorRoles: ['owner'],
    });
    expect(replay).toBeTruthy();
    const eventId = randomUUID();
    const repl = await createSameInvoiceReplacementLine(invoiceId);
    await accruals().correctAndRepost({
      accrualId: root.id,
      correctionEventId: eventId,
      replacementInvoiceLineId: repl,
      reason: 'R17-B-T3',
      actor: actorId,
      actorRoles: ['owner'],
    });
    expect((await netAttributed(performanceId)).toFixed(2)).toBe('0.00');
    expect((await netCommission(performanceId)).toFixed(2)).toBe('0.00');
  });

  it('R17-B-T4 P2002 concurrent replay never accepts invalid exact-only saturated set', async () => {
    const { invoiceId, root } = await setupServiceNet10Pct();
    const rA = await createRefund(invoiceId, '33.34');
    const rB = await createRefund(invoiceId, '33.33');
    const rC = await createRefund(invoiceId, '33.33');
    await plantRefundEffects(root, [
      { refundId: rA, attributed: '-33.34', commission: '-3.33' },
      { refundId: rB, attributed: '-33.33', commission: '-3.33' },
      { refundId: rC, attributed: '-33.33', commission: '-3.33' },
    ]);
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
        refundId: rB,
        actor: actorId,
        actorRoles: ['owner'],
      }),
      accrualsB.reverseAccrual({
        accrualId: root.id,
        refundId: rB,
        actor: actorId,
        actorRoles: ['owner'],
      }),
    ]);
    await clientB.$disconnect();
    expect(a.status === 'rejected' || b.status === 'rejected').toBe(true);
    expect((await refundEffects(root.id)).length).toBe(3);
  });
});
