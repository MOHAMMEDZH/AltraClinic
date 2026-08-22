/**
 * Phase 48 Wave F Round 19 — counterexample PG + path parity (PostgreSQL).
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
import { buildMandatoryInvalidObservationPermutations } from './refund-complete-set-exhaustive-oracle';
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

describeDb('Wave F Round 19 remediation (PostgreSQL)', () => {
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
        data: { id: tenantId, name: 'WF R19', slug: `wfr19-${tenantId.slice(0, 8)}` },
      });
      for (const u of [
        { id: actorId, first: 'A', last: 'Ctor' },
        { id: performerId, first: 'Perf', last: 'Ormer' },
      ]) {
        await c.user.create({
          data: {
            id: u.id,
            tenantId,
            email: `wfr19-${u.id.slice(0, 8)}@t.local`,
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
        data: { id: branchId, tenantId, name: `R19 B ${branchId.slice(0, 6)}` },
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

  /** Production fixture: invoice total 0.07, attributed 0.05, commission 0.02 (40%). */
  async function createCounterexampleInvoice(servicePerformanceId: string) {
    const invoice = Invoice.create({
      invoiceId: randomUUID(),
      tenantId,
      branchId,
      patientId,
      invoiceNumber: `R19-${randomUUID().slice(0, 8)}`,
      invoiceDate: new Date('2026-09-01'),
      currency: 'SYP',
      notes: 'R19 counterexample',
      lineItems: [
        {
          description: 'R19 clinical line',
          quantity: 1,
          unitPrice: 0.05,
          discountPercent: 0,
          taxPercent: 0,
          servicePerformanceId,
          appointmentId,
          clinicalServiceId,
          courseSessionId: null,
        },
        {
          description: 'R19 non-commission fee',
          quantity: 1,
          unitPrice: 0.02,
          discountPercent: 0,
          taxPercent: 0,
          servicePerformanceId: null,
          appointmentId: null,
          clinicalServiceId: null,
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
          reason: 'R19 refund',
          refundMethod: 'cash',
          refundDate: new Date('2026-09-02'),
          approvedBy: actorId,
        },
      });
    });
    return refundId;
  }

  async function createSameInvoiceReplacementLine(invoiceId: string, amount = '0.05') {
    const id = randomUUID();
    await wrapper.withPlatformBypass(async (c) => {
      await c.invoiceLineItem.create({
        data: {
          id,
          invoiceId,
          tenantId,
          description: 'R19 corrected line',
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
            reason: 'R19 planted',
            createdBy: actorId,
          },
        });
      });
    }
  }

  async function setupCounterexampleRoot() {
    await enableAndPublishPlan(performerId, 40);
    const performanceId = await createCompletedPerformance();
    const { invoiceId, lineId } = await createCounterexampleInvoice(performanceId);
    await accruals().postFromServicePerformance({
      servicePerformanceId: performanceId,
      invoiceLineId: lineId,
      actor: actorId,
      actorRoles: ['owner'],
    });
    const root = (await openRoots(performanceId))[0]!;
    expect(new Prisma.Decimal(root.attributedRevenueAmount).toFixed(2)).toBe('0.05');
    expect(new Prisma.Decimal(root.commissionAmount).toFixed(2)).toBe('0.02');
    const invoice = await wrapper.withPlatformBypass((c) =>
      c.invoice.findUnique({ where: { id: invoiceId }, select: { amountTotal: true } }),
    );
    expect(new Prisma.Decimal(invoice!.amountTotal).toFixed(2)).toBe('0.07');
    return { performanceId, invoiceId, root };
  }

  it('R19-PG-T1 production reverseAccrual proves mandatory counterexample end to end', async () => {
    const { performanceId, invoiceId, root } = await setupCounterexampleRoot();
    const bases = ['0.01', '0.01', '0.02', '0.02', '0.02'];
    const refundIds: string[] = [];
    for (const amount of bases) {
      const rid = await createRefund(invoiceId, amount);
      await accruals().reverseAccrual({
        accrualId: root.id,
        refundId: rid,
        actor: actorId,
        actorRoles: ['owner'],
      });
      refundIds.push(rid);
    }
    const effects = await refundEffects(root.id);
    expect(effects.length).toBe(5);
    const sumRev = effects.reduce(
      (a, e) => a.add(new Prisma.Decimal(e.attributedRevenueAmount).abs()),
      new Prisma.Decimal(0),
    );
    const sumComm = effects.reduce(
      (a, e) => a.add(new Prisma.Decimal(e.commissionAmount).abs()),
      new Prisma.Decimal(0),
    );
    expect(sumRev.toFixed(2)).toBe('0.05');
    expect(sumComm.toFixed(2)).toBe('0.02');
    expect((await netAttributed(performanceId)).toFixed(2)).toBe('0.00');
    expect((await netCommission(performanceId)).toFixed(2)).toBe('0.00');
    expect(new Set(refundIds).size).toBe(5);
  });

  it('R19-PG-T2 replay every refund — same row IDs, unchanged count, no duplicate economics or audit', async () => {
    const { invoiceId, root } = await setupCounterexampleRoot();
    const bases = ['0.01', '0.01', '0.02', '0.02', '0.02'];
    const refundIds: string[] = [];
    const reversalIds: string[] = [];
    for (const amount of bases) {
      const rid = await createRefund(invoiceId, amount);
      const row = await accruals().reverseAccrual({
        accrualId: root.id,
        refundId: rid,
        actor: actorId,
        actorRoles: ['owner'],
      });
      refundIds.push(rid);
      reversalIds.push((row as { id: string }).id);
      const auditBeforeReplay = auditCalls.length;
      const replay = await accruals().reverseAccrual({
        accrualId: root.id,
        refundId: rid,
        actor: actorId,
        actorRoles: ['owner'],
      });
      expect((replay as { id: string }).id).toBe((row as { id: string }).id);
      expect(auditCalls.length).toBe(auditBeforeReplay);
    }
    const effects = await refundEffects(root.id);
    expect(effects.length).toBe(5);
    expect(effects.map((e) => e.id).sort()).toEqual([...reversalIds].sort());
    const economicKeys = effects.map(
      (e) =>
        `${e.refundId}:${new Prisma.Decimal(e.attributedRevenueAmount).toFixed(2)}:${new Prisma.Decimal(e.commissionAmount).toFixed(2)}`,
    );
    expect(new Set(economicKeys).size).toBe(5);
    expect(auditCalls.filter((a) => String(a.action ?? '').includes('reverse')).length).toBe(5);
  });

  it('R19-PG-T3 correction carry on replacement root preserves refundId set and nets', async () => {
    const { performanceId, invoiceId, root } = await setupCounterexampleRoot();
    const refundIds: string[] = [];
    for (const amount of ['0.01', '0.01', '0.02', '0.02', '0.02']) {
      const rid = await createRefund(invoiceId, amount);
      refundIds.push(rid);
      await accruals().reverseAccrual({
        accrualId: root.id,
        refundId: rid,
        actor: actorId,
        actorRoles: ['owner'],
      });
    }
    const beforeOldRoot = await refundEffects(root.id);
    expect(beforeOldRoot.length).toBe(5);
    const eventId = randomUUID();
    const replLineId = await createSameInvoiceReplacementLine(invoiceId);
    await accruals().correctAndRepost({
      accrualId: root.id,
      correctionEventId: eventId,
      replacementInvoiceLineId: replLineId,
      reason: 'R19-PG-T3',
      actor: actorId,
      actorRoles: ['owner'],
    });
    const replacementRoot = await wrapper.withPlatformBypass((c) =>
      c.commissionAccrual.findFirst({
        where: {
          tenantId,
          invoiceLineId: replLineId,
          status: 'EARNED',
          reversalOfAccrualId: null,
        },
      }),
    );
    expect(replacementRoot).toBeTruthy();
    const carryRows = await wrapper.withPlatformBypass((c) =>
      c.commissionAccrual.findMany({
        where: {
          tenantId,
          reversalOfAccrualId: replacementRoot!.id,
          refundId: { not: null },
        },
        orderBy: { id: 'asc' },
      }),
    );
    expect(carryRows.length).toBe(5);
    expect(new Set(carryRows.map((r) => r.refundId)).size).toBe(5);
    expect(new Set(carryRows.map((r) => r.refundId))).toEqual(new Set(refundIds));
    expect(new Set(carryRows.map((r) => r.id)).size).toBe(5);
    for (const row of carryRows) {
      expect(row.idempotencyKey).toBe(`rev:${replacementRoot!.id}:${row.refundId}`);
    }
    expect((await netAttributed(performanceId)).toFixed(2)).toBe('0.00');
    expect((await netCommission(performanceId)).toFixed(2)).toBe('0.00');
    const carryIdsBefore = carryRows.map((r) => r.id);
    await accruals().correctAndRepost({
      accrualId: root.id,
      correctionEventId: eventId,
      replacementInvoiceLineId: replLineId,
      reason: 'R19-PG-T3',
      actor: actorId,
      actorRoles: ['owner'],
    });
    const carryAfterReplay = await wrapper.withPlatformBypass((c) =>
      c.commissionAccrual.findMany({
        where: { tenantId, reversalOfAccrualId: replacementRoot!.id, refundId: { not: null } },
      }),
    );
    expect(carryAfterReplay.length).toBe(5);
    expect(carryAfterReplay.map((r) => r.id).sort()).toEqual([...carryIdsBefore].sort());
    const replacementRootCount = await wrapper.withPlatformBypass((c) =>
      c.commissionAccrual.count({
        where: {
          tenantId,
          invoiceLineId: replLineId,
          status: 'EARNED',
          reversalOfAccrualId: null,
        },
      }),
    );
    expect(replacementRootCount).toBe(1);
  });

  it('R19-PG-T4 concurrent replay remains exactly-once', async () => {
    const { invoiceId, root } = await setupCounterexampleRoot();
    const rid = await createRefund(invoiceId, '0.01');
    await accruals().reverseAccrual({
      accrualId: root.id,
      refundId: rid,
      actor: actorId,
      actorRoles: ['owner'],
    });
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
        refundId: rid,
        actor: actorId,
        actorRoles: ['owner'],
      }),
      accrualsB.reverseAccrual({
        accrualId: root.id,
        refundId: rid,
        actor: actorId,
        actorRoles: ['owner'],
      }),
    ]);
    await clientB.$disconnect();
    expect(a.status === 'fulfilled' || b.status === 'fulfilled').toBe(true);
    const count = await wrapper.withPlatformBypass((c) =>
      c.commissionAccrual.count({
        where: { tenantId, reversalOfAccrualId: root.id, refundId: rid },
      }),
    );
    expect(count).toBe(1);
  });

  it('R19-PG-T5 injected failure after economic create rolls back reversal and audit', async () => {
    const { invoiceId, root } = await setupCounterexampleRoot();
    for (const amount of ['0.01', '0.01', '0.02']) {
      const rid = await createRefund(invoiceId, amount);
      await accruals().reverseAccrual({
        accrualId: root.id,
        refundId: rid,
        actor: actorId,
        actorRoles: ['owner'],
      });
    }
    const before = await refundEffects(root.id);
    const beforeAudit = auditCalls.length;
    const rid = await createRefund(invoiceId, '0.02');
    const failingAudit = {
      record: async () => {
        throw new Error('R19-PG-T5 injected mid-tx failure');
      },
      recordInTransaction: async () => {
        throw new Error('R19-PG-T5 injected mid-tx failure');
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
    ).rejects.toThrow(/R19-PG-T5 injected mid-tx failure/i);
    expect((await refundEffects(root.id)).length).toBe(before.length);
    expect(auditCalls.length).toBe(beforeAudit);
  });

  it('R19-PG-T6 aggregate-fitting unrealizable fixture rejects NOT_SEQUENTIALLY_REALIZABLE with zero side effects', async () => {
    const { invoiceId, root } = await setupCounterexampleRoot();
    const forged = buildMandatoryInvalidObservationPermutations(1)[0]!;
    const bases = ['0.01', '0.01', '0.02', '0.02', '0.02'];
    const refundIds: string[] = [];
    for (const amount of bases) {
      refundIds.push(await createRefund(invoiceId, amount));
    }
    await plantRefundEffects(
      root,
      forged.map((e, idx) => ({
        refundId: refundIds[idx]!,
        attributed: `-${e.observedRevenue.toFixed(2)}`,
        commission:
          e.observedCommission.gt(0) ? `-${e.observedCommission.toFixed(2)}` : '0.00',
      })),
    );
    const beforeCount = (await refundEffects(root.id)).length;
    const beforeAccrualCount = await wrapper.withPlatformBypass((c) =>
      c.commissionAccrual.count({ where: { tenantId, servicePerformanceId: root.servicePerformanceId } }),
    );
    const beforeAudit = auditCalls.length;
    await expect(
      accruals().reverseAccrual({
        accrualId: root.id,
        refundId: refundIds[0]!,
        actor: actorId,
        actorRoles: ['owner'],
      }),
    ).rejects.toThrow(/NOT_SEQUENTIALLY_REALIZABLE|not realizable/i);
    expect((await refundEffects(root.id)).length).toBe(beforeCount);
    const afterAccrualCount = await wrapper.withPlatformBypass((c) =>
      c.commissionAccrual.count({ where: { tenantId, servicePerformanceId: root.servicePerformanceId } }),
    );
    expect(afterAccrualCount).toBe(beforeAccrualCount);
    expect(auditCalls.length).toBe(beforeAudit);
  });
});
