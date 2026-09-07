/**
 * Phase 48 Wave F Round 1 remediation — F1–F7 PostgreSQL integration tests.
 */
import { randomUUID } from 'crypto';
import { BadRequestException, GoneException } from '@nestjs/common';
import type { PrismaClient } from '@prisma/client';
import { Prisma } from '@prisma/client';
import {
  createClinicalPrismaWrapper,
  createPlatformDbSecurityClient,
  platformDbSecurityEnabled,
} from '../../clinical-catalog/tests/clinical-catalog-db.harness';
import { CommissionController } from '../../commission/controllers/commission.controller';
import { CommissionAccrualService } from '../services/commission-accrual.service';
import { StaffCommissionPlanService } from '../services/staff-commission-plan.service';

jest.setTimeout(180_000);
const describeDb = platformDbSecurityEnabled() ? describe : describe.skip;

describeDb('Wave F Round 1 remediation (PostgreSQL)', () => {
  let raw: PrismaClient;
  let wrapper: ReturnType<typeof createClinicalPrismaWrapper>;
  let tenantId: string;
  let actorId: string;
  let performerId: string;
  let patientId: string;
  let otherPatientId: string;
  let branchId: string;
  let otherBranchId: string;
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

  function serviceCode() {
    return `wf-${clinicalServiceId.slice(0, 8)}`;
  }

  async function seed() {
    await wrapper.withPlatformBypass(async (c) => {
      await c.tenant.create({
        data: { id: tenantId, name: 'WF R1', slug: `wfr1-${tenantId.slice(0, 8)}` },
      });
      for (const u of [
        { id: actorId, first: 'A', last: 'Ctor' },
        { id: performerId, first: 'Perf', last: 'Ormer' },
      ]) {
        await c.user.create({
          data: {
            id: u.id,
            tenantId,
            email: `wfr1-${u.id.slice(0, 8)}@t.local`,
            passwordHash: 'x',
            firstName: u.first,
            lastName: u.last,
          },
        });
      }
      await c.patient.create({
        data: { id: patientId, tenantId, firstName: 'Pat', lastName: 'One' },
      });
      await c.patient.create({
        data: { id: otherPatientId, tenantId, firstName: 'Pat', lastName: 'Two' },
      });
      await c.branch.create({
        data: { id: branchId, tenantId, name: `R1 B ${branchId.slice(0, 6)}` },
      });
      await c.branch.create({
        data: { id: otherBranchId, tenantId, name: `R1 O ${otherBranchId.slice(0, 6)}` },
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

  async function enableAndPublishPlan(opts: {
    userId: string;
    percentage: number;
    effectiveFrom: string;
    calculationBasis?: string;
    earningTrigger?: string;
  }) {
    await plans().setUserCommissionEligibility(
      opts.userId,
      true,
      opts.percentage,
      opts.effectiveFrom,
      { actorId, actorRoles: ['owner'] },
    );
    const draft = await plans().createDraftPlan({
      userId: opts.userId,
      percentage: opts.percentage,
      effectiveFrom: opts.effectiveFrom,
      calculationBasis: opts.calculationBasis ?? 'SERVICE_NET_AFTER_DISCOUNT',
      earningTrigger: opts.earningTrigger ?? 'INVOICE_OR_CHARGE_FINALIZED',
      actor: { actorId, actorRoles: ['owner'] },
    });
    return plans().publishPlan(draft.id, { actorId, actorRoles: ['owner'] });
  }

  async function createCompletedPerformance(opts?: {
    patientId?: string;
    branchId?: string | null;
    encounterId?: string | null;
    performedAt?: Date;
  }) {
    const performanceId = randomUUID();
    const performedAt = opts?.performedAt ?? new Date('2026-09-01T10:30:00.000Z');
    await wrapper.withPlatformBypass(async (c) => {
      await c.servicePerformance.create({
        data: {
          id: performanceId,
          tenantId,
          branchId: opts?.branchId === undefined ? branchId : opts.branchId,
          appointmentId,
          encounterId: opts?.encounterId ?? null,
          patientId: opts?.patientId ?? patientId,
          clinicalServiceId,
          performedAt,
          status: 'DRAFT',
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

  async function createInvoiceLine(opts?: {
    subtotal?: string;
    discountAmount?: string;
    lineTotal?: string;
    amountTotal?: string;
    currency?: string;
    serviceCode?: string | null;
    encounterId?: string | null;
    patientId?: string;
    branchId?: string | null;
    servicePerformanceId?: string | null;
  }) {
    const invoiceId = randomUUID();
    const lineId = randomUUID();
    const subtotal = opts?.subtotal ?? '1000.00';
    const discountAmount = opts?.discountAmount ?? '0.00';
    const lineTotal = opts?.lineTotal ?? new Prisma.Decimal(subtotal).sub(discountAmount).toFixed(2);
    const amountTotal = opts?.amountTotal ?? lineTotal;
    await wrapper.withPlatformBypass(async (c) => {
      await c.invoice.create({
        data: {
          id: invoiceId,
          tenantId,
          branchId: opts?.branchId === undefined ? branchId : opts.branchId,
          patientId: opts?.patientId ?? patientId,
          invoiceNumber: `R1-${invoiceId.slice(0, 8)}`,
          invoiceDate: new Date('2026-09-01'),
          currency: opts?.currency ?? 'SYP',
          status: 'ISSUED',
          amountSubtotal: subtotal,
          amountDiscount: discountAmount,
          amountTax: '0.00',
          amountTotal,
          lineItems: {
            create: {
              id: lineId,
              tenantId,
              description: 'R1 line',
              quantity: 1,
              unitPrice: subtotal,
              subtotal,
              discountAmount,
              taxAmount: '0.00',
              lineTotal,
              serviceCode: opts?.serviceCode === null ? null : (opts?.serviceCode ?? serviceCode()),
              encounterId: opts?.encounterId ?? null,
              servicePerformanceId: opts?.servicePerformanceId ?? null,
            },
          },
        },
      });
    });
    return { invoiceId, lineId, amountTotal, lineTotal };
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
          reason: 'R1 refund',
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
    otherPatientId = randomUUID();
    branchId = randomUUID();
    otherBranchId = randomUUID();
    clinicalServiceId = randomUUID();
    appointmentId = randomUUID();
    await seed();
  });

  // ─── F1 ───────────────────────────────────────────────────────────────────

  it('F1-T1 legacy calculate throws GoneException', async () => {
    const ctrl = new CommissionController(
      { execute: async () => ({}) } as never,
      { execute: async () => ({}) } as never,
      { execute: async () => ({}) } as never,
      { execute: async () => ({}) } as never,
      { execute: async () => ({}) } as never,
      { execute: async () => ({}) } as never,
      { execute: async () => ({}) } as never,
      { execute: async () => ({}) } as never,
      { execute: async () => ({}) } as never,
    );
    await expect(
      ctrl.calculateCommission({
        providerId: performerId,
        periodStart: '2026-01-01',
        periodEnd: '2026-01-31',
      } as never),
    ).rejects.toBeInstanceOf(GoneException);
  });

  it('F1-T2 legacy calculate-from-invoices throws GoneException', async () => {
    const ctrl = new CommissionController(
      { execute: async () => ({}) } as never,
      { execute: async () => ({}) } as never,
      { execute: async () => ({}) } as never,
      { execute: async () => ({}) } as never,
      { execute: async () => ({}) } as never,
      { execute: async () => ({}) } as never,
      { execute: async () => ({}) } as never,
      { execute: async () => ({}) } as never,
      { execute: async () => ({}) } as never,
    );
    await expect(
      ctrl.calculateFromInvoices({
        providerId: performerId,
        periodStart: '2026-01-01',
        periodEnd: '2026-01-31',
      }),
    ).rejects.toBeInstanceOf(GoneException);
  });

  it('F1-T3 legacy rules create throws GoneException', async () => {
    const ctrl = new CommissionController(
      { execute: async () => ({}) } as never,
      { execute: async () => ({}) } as never,
      { execute: async () => ({}) } as never,
      { execute: async () => ({}) } as never,
      { execute: async () => ({}) } as never,
      { execute: async () => ({}) } as never,
      { execute: async () => ({}) } as never,
      { execute: async () => ({}) } as never,
      { execute: async () => ({}) } as never,
    );
    await expect(
      ctrl.createCommissionRule({
        commissionRateType: 'PERCENTAGE',
        commissionRateValue: 10,
        effectiveDate: '2026-01-01',
      } as never),
    ).rejects.toBeInstanceOf(GoneException);
  });

  // ─── F2 ───────────────────────────────────────────────────────────────────

  it('F2-T1 rejects invalid basis/trigger combo on create', async () => {
    await expect(
      plans().createDraftPlan({
        userId: performerId,
        percentage: 20,
        effectiveFrom: '2026-01-01',
        calculationBasis: 'COLLECTED_REVENUE',
        earningTrigger: 'INVOICE_OR_CHARGE_FINALIZED',
        actor: { actorId, actorRoles: ['owner'] },
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('F2-T2 rejects branchId override on create', async () => {
    await expect(
      plans().createDraftPlan({
        userId: performerId,
        percentage: 20,
        effectiveFrom: '2026-01-01',
        branchId,
        actor: { actorId, actorRoles: ['owner'] },
      }),
    ).rejects.toThrow(/user-default only/i);
  });

  it('F2-T3 future-dated publish closes prior ACTIVE into non-overlapping SUPERSEDED interval', async () => {
    const prior = await enableAndPublishPlan({
      userId: performerId,
      percentage: 25,
      effectiveFrom: '2026-01-01',
    });
    const draft = await plans().createDraftPlan({
      userId: performerId,
      percentage: 40,
      effectiveFrom: '2099-01-01',
      actor: { actorId, actorRoles: ['owner'] },
    });
    const future = await plans().publishPlan(draft.id, { actorId, actorRoles: ['owner'] });
    expect(future.status).toBe('ACTIVE');
    const priorRow = await wrapper.withPlatformBypass((c) =>
      c.staffCommissionPlanVersion.findUnique({ where: { id: prior.id } }),
    );
    // Round 3 R3-F5A: prior remains historically resolvable via SUPERSEDED + effectiveTo (no ACTIVE overlap).
    expect(priorRow?.status).toBe('SUPERSEDED');
    expect(priorRow?.effectiveTo?.toISOString().slice(0, 10)).toBe('2098-12-31');
    const hist = await wrapper.withPlatformBypass((tx) =>
      plans().resolvePlanAt(tx, tenantId, performerId, new Date('2026-06-15')),
    );
    expect(hist.id).toBe(prior.id);
  });

  it('F2-T4 current-dated publish supersedes prior ACTIVE', async () => {
    const prior = await enableAndPublishPlan({
      userId: performerId,
      percentage: 25,
      effectiveFrom: '2026-01-01',
    });
    const next = await enableAndPublishPlan({
      userId: performerId,
      percentage: 35,
      effectiveFrom: '2026-06-01',
    });
    expect(next.status).toBe('ACTIVE');
    const priorRow = await wrapper.withPlatformBypass((c) =>
      c.staffCommissionPlanVersion.findUnique({ where: { id: prior.id } }),
    );
    expect(priorRow?.status).toBe('SUPERSEDED');
  });

  it('F2-T5 COLLECTED_REVENUE + PAYMENT_COLLECTED posts from payment', async () => {
    await enableAndPublishPlan({
      userId: performerId,
      percentage: 30,
      effectiveFrom: '2026-01-01',
      calculationBasis: 'COLLECTED_REVENUE',
      earningTrigger: 'PAYMENT_COLLECTED',
    });
    const performanceId = await createCompletedPerformance();
    const { invoiceId, lineId } = await createInvoiceLine({
      servicePerformanceId: performanceId,
      subtotal: '1000.00',
      discountAmount: '0.00',
    });
    const paymentId = await createPayment(invoiceId, '500.00');
    const result = await accruals().postFromCollectedPayment({
      servicePerformanceId: performanceId,
      invoiceLineId: lineId,
      paymentId,
      actor: actorId,
      actorRoles: ['owner'],
    });
    expect(result.accruals).toHaveLength(1);
    const row = result.accruals[0] as { commissionAmount: Prisma.Decimal; paymentId: string };
    expect(row.paymentId).toBe(paymentId);
    expect(row.commissionAmount.toFixed(2)).toBe('150.00');
  });

  it('F2-T6 collected path caps cumulative at max net commission', async () => {
    await enableAndPublishPlan({
      userId: performerId,
      percentage: 30,
      effectiveFrom: '2026-01-01',
      calculationBasis: 'COLLECTED_REVENUE',
      earningTrigger: 'PAYMENT_COLLECTED',
    });
    const performanceId = await createCompletedPerformance();
    const { invoiceId, lineId } = await createInvoiceLine({
      servicePerformanceId: performanceId,
      subtotal: '1000.00',
      discountAmount: '0.00',
    });
    const p1 = await createPayment(invoiceId, '800.00');
    const p2 = await createPayment(invoiceId, '800.00');
    const first = await accruals().postFromCollectedPayment({
      servicePerformanceId: performanceId,
      invoiceLineId: lineId,
      paymentId: p1,
      actor: actorId,
      actorRoles: ['owner'],
    });
    expect((first.accruals[0] as { commissionAmount: Prisma.Decimal }).commissionAmount.toFixed(2)).toBe(
      '240.00',
    );
    const second = await accruals().postFromCollectedPayment({
      servicePerformanceId: performanceId,
      invoiceLineId: lineId,
      paymentId: p2,
      actor: actorId,
      actorRoles: ['owner'],
    });
    expect((second.accruals[0] as { commissionAmount: Prisma.Decimal }).commissionAmount.toFixed(2)).toBe(
      '60.00',
    );
  });

  it('F2-T7 invoice path rejects PAYMENT_COLLECTED plan', async () => {
    await enableAndPublishPlan({
      userId: performerId,
      percentage: 30,
      effectiveFrom: '2026-01-01',
      calculationBasis: 'COLLECTED_REVENUE',
      earningTrigger: 'PAYMENT_COLLECTED',
    });
    const performanceId = await createCompletedPerformance();
    const { lineId } = await createInvoiceLine({ servicePerformanceId: performanceId });
    await expect(
      accruals().postFromServicePerformance({
        servicePerformanceId: performanceId,
        invoiceLineId: lineId,
        actor: actorId,
        actorRoles: ['owner'],
      }),
    ).rejects.toThrow(/COLLECTED_REVENUE|INVOICE_OR_CHARGE_FINALIZED/i);
  });

  it('F2-T8 collected payment idempotent', async () => {
    await enableAndPublishPlan({
      userId: performerId,
      percentage: 20,
      effectiveFrom: '2026-01-01',
      calculationBasis: 'COLLECTED_REVENUE',
      earningTrigger: 'PAYMENT_COLLECTED',
    });
    const performanceId = await createCompletedPerformance();
    const { invoiceId, lineId } = await createInvoiceLine({ servicePerformanceId: performanceId });
    const paymentId = await createPayment(invoiceId, '1000.00');
    const a = await accruals().postFromCollectedPayment({
      servicePerformanceId: performanceId,
      invoiceLineId: lineId,
      paymentId,
      actor: actorId,
      actorRoles: ['owner'],
    });
    const b = await accruals().postFromCollectedPayment({
      servicePerformanceId: performanceId,
      invoiceLineId: lineId,
      paymentId,
      actor: actorId,
      actorRoles: ['owner'],
    });
    expect((b.accruals[0] as { id: string }).id).toBe((a.accruals[0] as { id: string }).id);
  });

  // ─── F3 ───────────────────────────────────────────────────────────────────

  it('F3-T1 rejects patient mismatch', async () => {
    await enableAndPublishPlan({
      userId: performerId,
      percentage: 30,
      effectiveFrom: '2026-01-01',
    });
    const performanceId = await createCompletedPerformance({ patientId });
    const { lineId } = await createInvoiceLine({ servicePerformanceId: performanceId, patientId: otherPatientId });
    await expect(
      accruals().postFromServicePerformance({
        servicePerformanceId: performanceId,
        invoiceLineId: lineId,
        actor: actorId,
        actorRoles: ['owner'],
      }),
    ).rejects.toThrow(/patientId/i);
  });

  it('F3-T2 rejects missing durable servicePerformanceId link', async () => {
    await enableAndPublishPlan({
      userId: performerId,
      percentage: 30,
      effectiveFrom: '2026-01-01',
    });
    const performanceId = await createCompletedPerformance();
    const { lineId } = await createInvoiceLine({ servicePerformanceId: null, serviceCode: null });
    await expect(
      accruals().postFromServicePerformance({
        servicePerformanceId: performanceId,
        invoiceLineId: lineId,
        actor: actorId,
        actorRoles: ['owner'],
      }),
    ).rejects.toThrow(/servicePerformanceId/i);
  });

  it('F3-T3 serviceCode alone is insufficient without durable SP link', async () => {
    await enableAndPublishPlan({
      userId: performerId,
      percentage: 30,
      effectiveFrom: '2026-01-01',
    });
    const performanceId = await createCompletedPerformance();
    const { lineId } = await createInvoiceLine({ serviceCode: serviceCode() });
    const before = auditCalls.length;
    await expect(
      accruals().postFromServicePerformance({
        servicePerformanceId: performanceId,
        invoiceLineId: lineId,
        actor: actorId,
        actorRoles: ['owner'],
      }),
    ).rejects.toThrow(/servicePerformanceId/i);
    expect(auditCalls.length).toBe(before);
  });

  it('F3-T4 rejects branch mismatch when both set', async () => {
    await enableAndPublishPlan({
      userId: performerId,
      percentage: 30,
      effectiveFrom: '2026-01-01',
    });
    const performanceId = await createCompletedPerformance({ branchId });
    const { lineId } = await createInvoiceLine({ servicePerformanceId: performanceId, branchId: otherBranchId });
    await expect(
      accruals().postFromServicePerformance({
        servicePerformanceId: performanceId,
        invoiceLineId: lineId,
        actor: actorId,
        actorRoles: ['owner'],
      }),
    ).rejects.toThrow(/branchId/i);
  });

  // ─── F4 ───────────────────────────────────────────────────────────────────

  it('F4-T1 reverse requires refundId', async () => {
    await enableAndPublishPlan({
      userId: performerId,
      percentage: 30,
      effectiveFrom: '2026-01-01',
    });
    const performanceId = await createCompletedPerformance();
    const { lineId } = await createInvoiceLine({ servicePerformanceId: performanceId });
    const posted = await accruals().postFromServicePerformance({
      servicePerformanceId: performanceId,
      invoiceLineId: lineId,
      actor: actorId,
      actorRoles: ['owner'],
    });
    await expect(
      accruals().reverseAccrual({
        accrualId: (posted.accruals[0] as { id: string }).id,
        refundId: '' as never,
        actor: actorId,
        actorRoles: ['owner'],
      }),
    ).rejects.toThrow(/refundId/i);
  });

  it('F4-T2 reverse rejects caller proportion', async () => {
    await enableAndPublishPlan({
      userId: performerId,
      percentage: 30,
      effectiveFrom: '2026-01-01',
    });
    const performanceId = await createCompletedPerformance();
    const { invoiceId, lineId, amountTotal } = await createInvoiceLine({ servicePerformanceId: performanceId });
    const posted = await accruals().postFromServicePerformance({
      servicePerformanceId: performanceId,
      invoiceLineId: lineId,
      actor: actorId,
      actorRoles: ['owner'],
    });
    const refundId = await createRefund(invoiceId, amountTotal);
    await expect(
      accruals().reverseAccrual({
        accrualId: (posted.accruals[0] as { id: string }).id,
        refundId,
        proportion: 0.5,
        actor: actorId,
        actorRoles: ['owner'],
      }),
    ).rejects.toThrow(/proportion/i);
  });

  it('F4-T3 multi reverse capped by remaining', async () => {
    await enableAndPublishPlan({
      userId: performerId,
      percentage: 30,
      effectiveFrom: '2026-01-01',
    });
    const performanceId = await createCompletedPerformance();
    const { invoiceId, lineId } = await createInvoiceLine({
      servicePerformanceId: performanceId,
      subtotal: '1000.00',
      amountTotal: '1000.00',
      lineTotal: '1000.00',
    });
    const posted = await accruals().postFromServicePerformance({
      servicePerformanceId: performanceId,
      invoiceLineId: lineId,
      actor: actorId,
      actorRoles: ['owner'],
    });
    const accrualId = (posted.accruals[0] as { id: string; commissionAmount: Prisma.Decimal }).id;
    const original = (posted.accruals[0] as { commissionAmount: Prisma.Decimal }).commissionAmount;

    const r1 = await createRefund(invoiceId, '400.00');
    const rev1 = await accruals().reverseAccrual({
      accrualId,
      refundId: r1,
      actor: actorId,
      actorRoles: ['owner'],
    });
    expect(rev1.commissionAmount.abs().toFixed(2)).toBe(
      original.mul(0.4).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP).toFixed(2),
    );

    const r2 = await createRefund(invoiceId, '800.00');
    const rev2 = await accruals().reverseAccrual({
      accrualId,
      refundId: r2,
      actor: actorId,
      actorRoles: ['owner'],
    });
    const remaining = original.sub(rev1.commissionAmount.abs());
    expect(rev2.commissionAmount.abs().toFixed(2)).toBe(remaining.toFixed(2));

    const r3 = await createRefund(invoiceId, '100.00');
    await expect(
      accruals().reverseAccrual({
        accrualId,
        refundId: r3,
        actor: actorId,
        actorRoles: ['owner'],
      }),
    ).rejects.toThrow(/remaining/i);
  });

  it('F4-T4 reverse refund wrong invoice rejected', async () => {
    await enableAndPublishPlan({
      userId: performerId,
      percentage: 30,
      effectiveFrom: '2026-01-01',
    });
    const performanceId = await createCompletedPerformance();
    const inv = await createInvoiceLine({ servicePerformanceId: performanceId });
    const other = await createInvoiceLine();
    const posted = await accruals().postFromServicePerformance({
      servicePerformanceId: performanceId,
      invoiceLineId: inv.lineId,
      actor: actorId,
      actorRoles: ['owner'],
    });
    const badRefund = await createRefund(other.invoiceId, other.amountTotal);
    await expect(
      accruals().reverseAccrual({
        accrualId: (posted.accruals[0] as { id: string }).id,
        refundId: badRefund,
        actor: actorId,
        actorRoles: ['owner'],
      }),
    ).rejects.toThrow(/invoiceId/i);
  });

  // ─── F5 / F6 ──────────────────────────────────────────────────────────────

  it('F5-T1 ACTIVE plan financial fields immutable', async () => {
    const plan = await enableAndPublishPlan({
      userId: performerId,
      percentage: 30,
      effectiveFrom: '2026-01-01',
    });
    await expect(
      wrapper.withPlatformBypass((c) =>
        c.staffCommissionPlanVersion.update({
          where: { id: plan.id },
          data: { percentage: new Prisma.Decimal(99) },
        }),
      ),
    ).rejects.toThrow();
  });

  it('F5-T2 ACTIVE effectiveTo immutable', async () => {
    const plan = await enableAndPublishPlan({
      userId: performerId,
      percentage: 30,
      effectiveFrom: '2026-01-01',
    });
    await expect(
      wrapper.withPlatformBypass((c) =>
        c.staffCommissionPlanVersion.update({
          where: { id: plan.id },
          data: { effectiveTo: new Date('2026-12-31') },
        }),
      ),
    ).rejects.toThrow();
  });

  it('F6-T1 accrual amount update rejected', async () => {
    await enableAndPublishPlan({
      userId: performerId,
      percentage: 30,
      effectiveFrom: '2026-01-01',
    });
    const performanceId = await createCompletedPerformance();
    const { lineId } = await createInvoiceLine({ servicePerformanceId: performanceId });
    const posted = await accruals().postFromServicePerformance({
      servicePerformanceId: performanceId,
      invoiceLineId: lineId,
      actor: actorId,
      actorRoles: ['owner'],
    });
    const id = (posted.accruals[0] as { id: string }).id;
    await expect(
      wrapper.withPlatformBypass((c) =>
        c.commissionAccrual.update({
          where: { id },
          data: { commissionAmount: new Prisma.Decimal(1) },
        }),
      ),
    ).rejects.toThrow();
  });

  it('F6-T2 reason change on EARNED rejected (append-only whitelist)', async () => {
    await enableAndPublishPlan({
      userId: performerId,
      percentage: 30,
      effectiveFrom: '2026-01-01',
    });
    const performanceId = await createCompletedPerformance();
    const { lineId } = await createInvoiceLine({ servicePerformanceId: performanceId });
    const posted = await accruals().postFromServicePerformance({
      servicePerformanceId: performanceId,
      invoiceLineId: lineId,
      actor: actorId,
      actorRoles: ['owner'],
    });
    const id = (posted.accruals[0] as { id: string }).id;
    await expect(
      wrapper.withPlatformBypass((c) =>
        c.commissionAccrual.update({
          where: { id },
          data: { reason: 'tamper' },
        }),
      ),
    ).rejects.toThrow();
  });

  it('F6-T3 settle EARNED→SETTLED still allowed', async () => {
    await enableAndPublishPlan({
      userId: performerId,
      percentage: 30,
      effectiveFrom: '2026-01-01',
    });
    const performanceId = await createCompletedPerformance();
    const { lineId } = await createInvoiceLine({ servicePerformanceId: performanceId });
    const posted = await accruals().postFromServicePerformance({
      servicePerformanceId: performanceId,
      invoiceLineId: lineId,
      actor: actorId,
      actorRoles: ['owner'],
    });
    const settled = await accruals().settleAccrual({
      accrualId: (posted.accruals[0] as { id: string }).id,
      settlementReference: 'R1-SETTLE',
      actor: actorId,
      actorRoles: ['owner'],
    });
    expect(settled.status).toBe('SETTLED');
  });

  // ─── F7 ───────────────────────────────────────────────────────────────────

  it('F7-T1 owner report groups by currency', async () => {
    await enableAndPublishPlan({
      userId: performerId,
      percentage: 30,
      effectiveFrom: '2026-01-01',
    });
    const p1 = await createCompletedPerformance();
    const invSyp = await createInvoiceLine({ servicePerformanceId: p1, currency: 'SYP', subtotal: '1000.00' });
    await accruals().postFromServicePerformance({
      servicePerformanceId: p1,
      invoiceLineId: invSyp.lineId,
      actor: actorId,
      actorRoles: ['owner'],
    });
    const p2 = await createCompletedPerformance({
      performedAt: new Date('2026-09-02T10:00:00.000Z'),
    });
    const invUsd = await createInvoiceLine({
      servicePerformanceId: p2,
      currency: 'USD',
      subtotal: '200.00',
      lineTotal: '200.00',
      amountTotal: '200.00',
    });
    await accruals().postFromServicePerformance({
      servicePerformanceId: p2,
      invoiceLineId: invUsd.lineId,
      actor: actorId,
      actorRoles: ['owner'],
    });

    const report = await accruals().ownerReport({
      userId: performerId,
      from: '2026-01-01T00:00:00.000Z',
      to: '2026-12-31T23:59:59.000Z',
    });
    expect(report.byCurrency.length).toBeGreaterThanOrEqual(2);
    const syp = report.byCurrency.find((c) => c.currency === 'SYP');
    const usd = report.byCurrency.find((c) => c.currency === 'USD');
    expect(syp?.earned).toBe('300.00');
    expect(usd?.earned).toBe('60.00');
    expect(syp?.outstanding).toBe('300.00');
  });

  it('F7-T2 owner report outstanding reduced by reversals; settled excluded', async () => {
    await enableAndPublishPlan({
      userId: performerId,
      percentage: 30,
      effectiveFrom: '2026-01-01',
    });
    const pEarn = await createCompletedPerformance();
    const invEarn = await createInvoiceLine({ servicePerformanceId: pEarn, subtotal: '1000.00' });
    const posted = await accruals().postFromServicePerformance({
      servicePerformanceId: pEarn,
      invoiceLineId: invEarn.lineId,
      actor: actorId,
      actorRoles: ['owner'],
    });
    const refundId = await createRefund(invEarn.invoiceId, '500.00');
    await accruals().reverseAccrual({
      accrualId: (posted.accruals[0] as { id: string }).id,
      refundId,
      actor: actorId,
      actorRoles: ['owner'],
    });

    const pSettle = await createCompletedPerformance({
      performedAt: new Date('2026-09-03T10:00:00.000Z'),
    });
    const invSettle = await createInvoiceLine({ servicePerformanceId: pSettle, subtotal: '200.00', lineTotal: '200.00', amountTotal: '200.00' });
    const settlePosted = await accruals().postFromServicePerformance({
      servicePerformanceId: pSettle,
      invoiceLineId: invSettle.lineId,
      actor: actorId,
      actorRoles: ['owner'],
    });
    await accruals().settleAccrual({
      accrualId: (settlePosted.accruals[0] as { id: string }).id,
      settlementReference: 'R1-F7',
      actor: actorId,
      actorRoles: ['owner'],
    });

    const report = await accruals().ownerReport({
      userId: performerId,
      from: '2026-01-01T00:00:00.000Z',
      to: '2026-12-31T23:59:59.000Z',
    });
    const syp = report.byCurrency.find((c) => c.currency === 'SYP')!;
    expect(syp.settled).toBe('60.00');
    expect(syp.reversed).toBe('150.00');
    expect(syp.outstanding).toBe('150.00');
    expect(syp.net).toBe('210.00');
  });
});
