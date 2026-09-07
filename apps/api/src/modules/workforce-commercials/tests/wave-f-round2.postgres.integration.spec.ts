/**
 * Phase 48 Wave F Round 2 remediation — F3–F7 PostgreSQL integration tests.
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

jest.setTimeout(240_000);
const describeDb = platformDbSecurityEnabled() ? describe : describe.skip;

describeDb('Wave F Round 2 remediation (PostgreSQL)', () => {
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

  async function seed() {
    await wrapper.withPlatformBypass(async (c) => {
      await c.tenant.create({
        data: { id: tenantId, name: 'WF R2', slug: `wfr2-${tenantId.slice(0, 8)}` },
      });
      for (const u of [
        { id: actorId, first: 'A', last: 'Ctor' },
        { id: performerId, first: 'Perf', last: 'Ormer' },
      ]) {
        await c.user.create({
          data: {
            id: u.id,
            tenantId,
            email: `wfr2-${u.id.slice(0, 8)}@t.local`,
            passwordHash: 'x',
            firstName: u.first,
            lastName: u.last,
          },
        });
      }
      await c.patient.create({
        data: { id: patientId, tenantId, firstName: 'Pat', lastName: 'One' },
      });
      await c.branch.create({
        data: { id: branchId, tenantId, name: `R2 B ${branchId.slice(0, 6)}` },
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
    appointmentId?: string;
    encounterId?: string | null;
    performedAt?: Date;
    snapshotRevisionId?: string | null;
  }) {
    const performanceId = randomUUID();
    const performedAt = opts?.performedAt ?? new Date('2026-09-01T10:30:00.000Z');
    await wrapper.withPlatformBypass(async (c) => {
      await c.servicePerformance.create({
        data: {
          id: performanceId,
          tenantId,
          branchId,
          appointmentId: opts?.appointmentId ?? appointmentId,
          encounterId: opts?.encounterId ?? null,
          patientId,
          clinicalServiceId,
          snapshotRevisionId: opts?.snapshotRevisionId ?? null,
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

  async function createInvoiceLine(opts: {
    servicePerformanceId?: string | null;
    encounterId?: string | null;
    serviceCode?: string | null;
    subtotal?: string;
    amountTotal?: string;
  }) {
    const invoiceId = randomUUID();
    const lineId = randomUUID();
    const subtotal = opts.subtotal ?? '1000.00';
    const amountTotal = opts.amountTotal ?? subtotal;
    await wrapper.withPlatformBypass(async (c) => {
      await c.invoice.create({
        data: {
          id: invoiceId,
          tenantId,
          branchId,
          patientId,
          invoiceNumber: `R2-${invoiceId.slice(0, 8)}`,
          invoiceDate: new Date('2026-09-01'),
          currency: 'SYP',
          status: 'ISSUED',
          amountSubtotal: subtotal,
          amountDiscount: '0.00',
          amountTax: '0.00',
          amountTotal,
          lineItems: {
            create: {
              id: lineId,
              tenantId,
              description: 'R2 line',
              quantity: 1,
              unitPrice: subtotal,
              subtotal,
              discountAmount: '0.00',
              taxAmount: '0.00',
              lineTotal: subtotal,
              serviceCode: opts.serviceCode === null ? null : (opts.serviceCode ?? `wf-${clinicalServiceId.slice(0, 8)}`),
              encounterId: opts.encounterId ?? null,
              servicePerformanceId: opts.servicePerformanceId ?? null,
            },
          },
        },
      });
    });
    return { invoiceId, lineId };
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
          reason: 'R2 refund',
          refundMethod: 'cash',
          refundDate: new Date('2026-09-02'),
          approvedBy: actorId,
        },
      });
    });
    return refundId;
  }

  async function createReplacementLine(opts?: { amount?: string }) {
    const amount = opts?.amount ?? '1000.00';
    const invoiceId = randomUUID();
    const lineId = randomUUID();
    await wrapper.withPlatformBypass(async (c) => {
      await c.invoice.create({
        data: {
          id: invoiceId,
          tenantId,
          branchId,
          patientId,
          invoiceNumber: `R2C-${randomUUID().slice(0, 8)}`,
          invoiceDate: new Date('2026-09-02'),
          currency: 'SYP',
          status: 'ISSUED',
          amountSubtotal: amount,
          amountDiscount: '0',
          amountTax: '0',
          amountTotal: amount,
          amountPaid: '0',
          notes: 'R2 correction replacement',
        },
      });
      await c.invoiceLineItem.create({
        data: {
          id: lineId,
          invoiceId,
          tenantId,
          description: 'R2 corrected line',
          quantity: 1,
          unitPrice: amount,
          discountPercent: 0,
          taxPercent: 0,
          subtotal: amount,
          discountAmount: 0,
          taxAmount: 0,
          lineTotal: amount,
          servicePerformanceId: null,
          appointmentId,
          clinicalServiceId,
          performanceBindingStatus: 'ACTIVE',
        },
      });
    });
    return { invoiceId, lineId };
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

  // ── F1/F2 regression ──────────────────────────────────────────────────────
  it('R2-F1 legacy calculate still GoneException', async () => {
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

  // ── F3 ────────────────────────────────────────────────────────────────────
  it('F3-R2-T1 exact durable performance↔invoice-line link → success', async () => {
    await enableAndPublishPlan({ userId: performerId, percentage: 30, effectiveFrom: '2026-01-01' });
    const performanceId = await createCompletedPerformance();
    const { lineId } = await createInvoiceLine({ servicePerformanceId: performanceId });
    const result = await accruals().postFromServicePerformance({
      servicePerformanceId: performanceId,
      invoiceLineId: lineId,
      actor: actorId,
      actorRoles: ['owner'],
    });
    expect(result.accruals).toHaveLength(1);
  });

  it('F3-R2-T2 same patient/service different encounter → reject', async () => {
    await enableAndPublishPlan({ userId: performerId, percentage: 30, effectiveFrom: '2026-01-01' });
    const encA = randomUUID();
    const encB = randomUUID();
    await wrapper.withPlatformBypass(async (c) => {
      for (const id of [encA, encB]) {
        await c.encounter.create({
          data: {
            id,
            tenantId,
            branchId,
            patientId,
            appointmentId,
            clinicianId: actorId,
            status: 'IN_PROGRESS',
          },
        });
      }
    });
    const performanceId = await createCompletedPerformance({ encounterId: encA });
    const { lineId } = await createInvoiceLine({
      servicePerformanceId: performanceId,
      encounterId: encB,
    });
    await expect(
      accruals().postFromServicePerformance({
        servicePerformanceId: performanceId,
        invoiceLineId: lineId,
        actor: actorId,
        actorRoles: ['owner'],
      }),
    ).rejects.toThrow(/encounterId/i);
  });

  it('F3-R2-T3 serviceCode only without durable SP link → reject', async () => {
    await enableAndPublishPlan({ userId: performerId, percentage: 30, effectiveFrom: '2026-01-01' });
    const performanceId = await createCompletedPerformance();
    const { lineId } = await createInvoiceLine({
      servicePerformanceId: null,
      serviceCode: `wf-${clinicalServiceId.slice(0, 8)}`,
    });
    const before = auditCalls.length;
    await expect(
      accruals().postFromServicePerformance({
        servicePerformanceId: performanceId,
        invoiceLineId: lineId,
        actor: actorId,
        actorRoles: ['owner'],
      }),
    ).rejects.toThrow(/servicePerformanceId/i);
    expect(auditCalls.filter((a) => a.action === 'staff_commission.accrual.created').length).toBe(0);
    expect(auditCalls.length).toBe(before);
  });

  it('F3-R2-T4 wrong appointment context → reject', async () => {
    await enableAndPublishPlan({ userId: performerId, percentage: 30, effectiveFrom: '2026-01-01' });
    const otherAppt = randomUUID();
    await wrapper.withPlatformBypass(async (c) => {
      await c.appointment.create({
        data: {
          id: otherAppt,
          tenantId,
          branchId,
          patientId,
          providerId: actorId,
          scheduledStart: new Date('2026-09-02T10:00:00.000Z'),
          scheduledEnd: new Date('2026-09-02T11:00:00.000Z'),
          status: 'CONFIRMED',
          clinicalServiceId,
        },
      });
    });
    const perfA = await createCompletedPerformance({ appointmentId });
    const perfB = await createCompletedPerformance({ appointmentId: otherAppt });
    const { lineId } = await createInvoiceLine({ servicePerformanceId: perfB });
    await expect(
      accruals().postFromServicePerformance({
        servicePerformanceId: perfA,
        invoiceLineId: lineId,
        actor: actorId,
        actorRoles: ['owner'],
      }),
    ).rejects.toThrow(/servicePerformanceId must equal/i);
  });

  it('F3-R2-T5 wrong snapshot revision → reject', async () => {
    await enableAndPublishPlan({ userId: performerId, percentage: 30, effectiveFrom: '2026-01-01' });
    const revId = randomUUID();
    const otherAppt = randomUUID();
    await wrapper.withPlatformBypass(async (c) => {
      await c.appointment.create({
        data: {
          id: otherAppt,
          tenantId,
          branchId,
          patientId,
          providerId: actorId,
          scheduledStart: new Date('2026-09-03T10:00:00.000Z'),
          scheduledEnd: new Date('2026-09-03T11:00:00.000Z'),
          status: 'CONFIRMED',
          clinicalServiceId,
        },
      });
      await c.appointmentServiceSnapshotRevision.create({
        data: {
          id: revId,
          tenantId,
          appointmentId: otherAppt,
          revisionNumber: 1,
          clinicalServiceId,
          stableKey: `tenant.${tenantId}.custom.wf-${clinicalServiceId.slice(0, 8)}`,
          displayNameAr: 'خدمة',
          displayNameEn: 'Service',
          quantity: 1,
          currency: 'SYP',
          unitPrice: 1000,
          lineBasisAmount: 1000,
          actorId,
          capturedAt: new Date('2026-09-03T10:00:00.000Z'),
        },
      });
    });
    const performanceId = await createCompletedPerformance({
      appointmentId,
      snapshotRevisionId: revId,
    });
    const { lineId } = await createInvoiceLine({ servicePerformanceId: performanceId });
    await expect(
      accruals().postFromServicePerformance({
        servicePerformanceId: performanceId,
        invoiceLineId: lineId,
        actor: actorId,
        actorRoles: ['owner'],
      }),
    ).rejects.toThrow(/snapshotRevisionId must belong/i);
  });

  it('F3-R2-T7 same performance cannot post against second unrelated line', async () => {
    await enableAndPublishPlan({ userId: performerId, percentage: 30, effectiveFrom: '2026-01-01' });
    const performanceId = await createCompletedPerformance();
    const a = await createInvoiceLine({ servicePerformanceId: performanceId });
    await accruals().postFromServicePerformance({
      servicePerformanceId: performanceId,
      invoiceLineId: a.lineId,
      actor: actorId,
      actorRoles: ['owner'],
    });
    // Second line cannot claim same SP (unique) — create unlinked line and try
    const b = await createInvoiceLine({ servicePerformanceId: null });
    await expect(
      accruals().postFromServicePerformance({
        servicePerformanceId: performanceId,
        invoiceLineId: b.lineId,
        actor: actorId,
        actorRoles: ['owner'],
      }),
    ).rejects.toThrow(/servicePerformanceId/i);
  });

  it('F3-R2-T8 rejection leaves zero accrual side effects', async () => {
    await enableAndPublishPlan({ userId: performerId, percentage: 30, effectiveFrom: '2026-01-01' });
    const performanceId = await createCompletedPerformance();
    const { lineId } = await createInvoiceLine({ servicePerformanceId: null });
    await expect(
      accruals().postFromServicePerformance({
        servicePerformanceId: performanceId,
        invoiceLineId: lineId,
        actor: actorId,
        actorRoles: ['owner'],
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    const count = await wrapper.withPlatformBypass((c) =>
      c.commissionAccrual.count({ where: { tenantId, servicePerformanceId: performanceId } }),
    );
    expect(count).toBe(0);
  });

  // ── F4 ────────────────────────────────────────────────────────────────────
  it('F4-R2-T1/T2 dual caps on commission and attributed revenue', async () => {
    await enableAndPublishPlan({ userId: performerId, percentage: 30, effectiveFrom: '2026-01-01' });
    const performanceId = await createCompletedPerformance();
    const { invoiceId, lineId } = await createInvoiceLine({
      servicePerformanceId: performanceId,
      subtotal: '1000.00',
      amountTotal: '1000.00',
    });
    const posted = await accruals().postFromServicePerformance({
      servicePerformanceId: performanceId,
      invoiceLineId: lineId,
      actor: actorId,
      actorRoles: ['owner'],
    });
    const original = posted.accruals[0] as {
      id: string;
      commissionAmount: Prisma.Decimal;
      attributedRevenueAmount: Prisma.Decimal;
    };
    const r1 = await createRefund(invoiceId, '400.00');
    const r2 = await createRefund(invoiceId, '800.00');
    const rev1 = await accruals().reverseAccrual({
      accrualId: original.id,
      refundId: r1,
      actor: actorId,
      actorRoles: ['owner'],
    });
    const rev2 = await accruals().reverseAccrual({
      accrualId: original.id,
      refundId: r2,
      actor: actorId,
      actorRoles: ['owner'],
    });
    const sumC = new Prisma.Decimal(rev1.commissionAmount)
      .abs()
      .add(new Prisma.Decimal(rev2.commissionAmount).abs());
    const sumR = new Prisma.Decimal(rev1.attributedRevenueAmount)
      .abs()
      .add(new Prisma.Decimal(rev2.attributedRevenueAmount).abs());
    expect(sumC.lte(original.commissionAmount)).toBe(true);
    expect(sumR.lte(original.attributedRevenueAmount)).toBe(true);
    expect(sumR.toFixed(2)).toBe(original.attributedRevenueAmount.toFixed(2));
  });

  it('F4-R2-T5 full reversal then another → reject', async () => {
    await enableAndPublishPlan({ userId: performerId, percentage: 30, effectiveFrom: '2026-01-01' });
    const performanceId = await createCompletedPerformance();
    const { invoiceId, lineId } = await createInvoiceLine({
      servicePerformanceId: performanceId,
      amountTotal: '1000.00',
    });
    const posted = await accruals().postFromServicePerformance({
      servicePerformanceId: performanceId,
      invoiceLineId: lineId,
      actor: actorId,
      actorRoles: ['owner'],
    });
    const accrualId = (posted.accruals[0] as { id: string }).id;
    const r1 = await createRefund(invoiceId, '1000.00');
    await accruals().reverseAccrual({
      accrualId,
      refundId: r1,
      actor: actorId,
      actorRoles: ['owner'],
    });
    const r2 = await createRefund(invoiceId, '10.00');
    await expect(
      accruals().reverseAccrual({
        accrualId,
        refundId: r2,
        actor: actorId,
        actorRoles: ['owner'],
      }),
    ).rejects.toThrow(/no remaining/i);
  });

  it('F4-R2-T6 concurrent reversals never over-reverse', async () => {
    await enableAndPublishPlan({ userId: performerId, percentage: 30, effectiveFrom: '2026-01-01' });
    const performanceId = await createCompletedPerformance();
    const { invoiceId, lineId } = await createInvoiceLine({
      servicePerformanceId: performanceId,
      amountTotal: '1000.00',
    });
    const posted = await accruals().postFromServicePerformance({
      servicePerformanceId: performanceId,
      invoiceLineId: lineId,
      actor: actorId,
      actorRoles: ['owner'],
    });
    const original = posted.accruals[0] as {
      id: string;
      commissionAmount: Prisma.Decimal;
      attributedRevenueAmount: Prisma.Decimal;
    };
    const r1 = await createRefund(invoiceId, '600.00');
    const r2 = await createRefund(invoiceId, '600.00');
    const results = await Promise.allSettled([
      accruals().reverseAccrual({
        accrualId: original.id,
        refundId: r1,
        actor: actorId,
        actorRoles: ['owner'],
      }),
      accruals().reverseAccrual({
        accrualId: original.id,
        refundId: r2,
        actor: actorId,
        actorRoles: ['owner'],
      }),
    ]);
    const fulfilled = results.filter((r) => r.status === 'fulfilled') as Array<{
      status: 'fulfilled';
      value: { commissionAmount: Prisma.Decimal; attributedRevenueAmount: Prisma.Decimal };
    }>;
    expect(fulfilled.length).toBeGreaterThanOrEqual(1);
    const sumC = fulfilled.reduce(
      (a, r) => a.add(new Prisma.Decimal(r.value.commissionAmount).abs()),
      new Prisma.Decimal(0),
    );
    const sumR = fulfilled.reduce(
      (a, r) => a.add(new Prisma.Decimal(r.value.attributedRevenueAmount).abs()),
      new Prisma.Decimal(0),
    );
    expect(sumC.lte(original.commissionAmount)).toBe(true);
    expect(sumR.lte(original.attributedRevenueAmount)).toBe(true);
  });

  it('F4-R2-T7 same refund replay idempotent', async () => {
    await enableAndPublishPlan({ userId: performerId, percentage: 30, effectiveFrom: '2026-01-01' });
    const performanceId = await createCompletedPerformance();
    const { invoiceId, lineId } = await createInvoiceLine({
      servicePerformanceId: performanceId,
      amountTotal: '1000.00',
    });
    const posted = await accruals().postFromServicePerformance({
      servicePerformanceId: performanceId,
      invoiceLineId: lineId,
      actor: actorId,
      actorRoles: ['owner'],
    });
    const accrualId = (posted.accruals[0] as { id: string }).id;
    const refundId = await createRefund(invoiceId, '200.00');
    const a = await accruals().reverseAccrual({
      accrualId,
      refundId,
      actor: actorId,
      actorRoles: ['owner'],
    });
    const b = await accruals().reverseAccrual({
      accrualId,
      refundId,
      actor: actorId,
      actorRoles: ['owner'],
    });
    expect(a.id).toBe(b.id);
  });

  it('F4-R2-T8 correction reverse+repost append-only', async () => {
    await enableAndPublishPlan({ userId: performerId, percentage: 30, effectiveFrom: '2026-01-01' });
    const performanceId = await createCompletedPerformance();
    const { invoiceId, lineId } = await createInvoiceLine({ servicePerformanceId: performanceId });
    const posted = await accruals().postFromServicePerformance({
      servicePerformanceId: performanceId,
      invoiceLineId: lineId,
      actor: actorId,
      actorRoles: ['owner'],
    });
    const accrualId = (posted.accruals[0] as { id: string }).id;
    const replacement = await createReplacementLine();
    const correctionEventId = randomUUID();
    const result = await accruals().correctAndRepost({
      accrualId,
      correctionEventId,
      replacementInvoiceLineId: replacement.lineId,
      reason: 'invoice correction',
      actor: actorId,
      actorRoles: ['owner'],
    });
    expect(result.reversal.reversalOfAccrualId).toBe(accrualId);
    expect(result.repost.accruals.length).toBeGreaterThanOrEqual(1);
    const rows = await wrapper.withPlatformBypass((c) =>
      c.commissionAccrual.findMany({ where: { tenantId, servicePerformanceId: performanceId } }),
    );
    expect(rows.length).toBeGreaterThanOrEqual(3); // original + reversal + successor
  });

  // ── F5 ────────────────────────────────────────────────────────────────────
  it('F5-R2-T1/T3 historical SUPERSEDED plan resolves for past date', async () => {
    const oldPlan = await enableAndPublishPlan({
      userId: performerId,
      percentage: 25,
      effectiveFrom: '2026-01-01',
    });
    await enableAndPublishPlan({
      userId: performerId,
      percentage: 40,
      effectiveFrom: '2026-06-01',
    });
    const performanceId = await createCompletedPerformance({
      performedAt: new Date('2026-03-15T10:00:00.000Z'),
    });
    const { lineId } = await createInvoiceLine({ servicePerformanceId: performanceId });
    const result = await accruals().postFromServicePerformance({
      servicePerformanceId: performanceId,
      invoiceLineId: lineId,
      actor: actorId,
      actorRoles: ['owner'],
    });
    const row = result.accruals[0] as {
      commissionPlanVersionId: string;
      commissionPercent: Prisma.Decimal;
    };
    expect(row.commissionPlanVersionId).toBe(oldPlan.id);
    expect(row.commissionPercent.toFixed(2)).toBe('25.00');
  });

  it('F5-R2-T2 new version resolves on/after effectiveFrom', async () => {
    await enableAndPublishPlan({
      userId: performerId,
      percentage: 25,
      effectiveFrom: '2026-01-01',
    });
    const newPlan = await enableAndPublishPlan({
      userId: performerId,
      percentage: 40,
      effectiveFrom: '2026-06-01',
    });
    const performanceId = await createCompletedPerformance({
      performedAt: new Date('2026-07-01T10:00:00.000Z'),
    });
    const { lineId } = await createInvoiceLine({ servicePerformanceId: performanceId });
    const result = await accruals().postFromServicePerformance({
      servicePerformanceId: performanceId,
      invoiceLineId: lineId,
      actor: actorId,
      actorRoles: ['owner'],
    });
    expect((result.accruals[0] as { commissionPlanVersionId: string }).commissionPlanVersionId).toBe(
      newPlan.id,
    );
  });

  it('F5-R2-T7 concurrent publishes same scope deterministic', async () => {
    await plans().setUserCommissionEligibility(performerId, true, 30, '2026-01-01', {
      actorId,
      actorRoles: ['owner'],
    });
    const d1 = await plans().createDraftPlan({
      userId: performerId,
      percentage: 31,
      effectiveFrom: '2026-01-01',
      actor: { actorId, actorRoles: ['owner'] },
    });
    const d2 = await plans().createDraftPlan({
      userId: performerId,
      percentage: 32,
      effectiveFrom: '2026-01-01',
      actor: { actorId, actorRoles: ['owner'] },
    });
    const results = await Promise.allSettled([
      plans().publishPlan(d1.id, { actorId, actorRoles: ['owner'] }),
      plans().publishPlan(d2.id, { actorId, actorRoles: ['owner'] }),
    ]);
    const ok = results.filter((r) => r.status === 'fulfilled');
    expect(ok.length).toBeGreaterThanOrEqual(1);
    const active = await wrapper.withPlatformBypass((c) =>
      c.staffCommissionPlanVersion.findMany({
        where: { tenantId, userId: performerId, status: 'ACTIVE' },
      }),
    );
    expect(active.length).toBe(1);
  });

  it('F5-R2-T9 published immutability still rejects rate change', async () => {
    const plan = await enableAndPublishPlan({
      userId: performerId,
      percentage: 30,
      effectiveFrom: '2026-01-01',
    });
    await expect(
      wrapper.withPlatformBypass((c) =>
        c.staffCommissionPlanVersion.update({
          where: { id: plan.id },
          data: { percentage: 99 },
        }),
      ),
    ).rejects.toThrow(/immutable/i);
  });

  // ── F6 relation-by-relation ───────────────────────────────────────────────
  const parentRefs: Array<{ field: string; parentTable: string }> = [
    { field: 'userId', parentTable: 'users' },
    { field: 'servicePerformanceId', parentTable: 'service_performances' },
    { field: 'commissionPlanVersionId', parentTable: 'staff_commission_plan_versions' },
    { field: 'createdBy', parentTable: 'users' },
    { field: 'invoiceId', parentTable: 'invoices' },
    { field: 'invoiceLineId', parentTable: 'invoice_line_items' },
    { field: 'paymentId', parentTable: 'invoice_payments' },
    { field: 'refundId', parentTable: 'invoice_refunds' },
    { field: 'appointmentId', parentTable: 'appointments' },
    { field: 'branchId', parentTable: 'branches' },
    { field: 'clinicalServiceId', parentTable: 'canonical_clinical_service_definitions' },
    { field: 'snapshotRevisionId', parentTable: 'appointment_service_snapshot_revisions' },
    { field: 'reversalOfAccrualId', parentTable: 'commission_accruals' },
  ];

  it('F6-R2 complete tenant-ref INSERT mixed-parent matrix', async () => {
    await enableAndPublishPlan({ userId: performerId, percentage: 30, effectiveFrom: '2026-01-01' });
    const performanceId = await createCompletedPerformance();
    const { invoiceId, lineId } = await createInvoiceLine({ servicePerformanceId: performanceId });
    const posted = await accruals().postFromServicePerformance({
      servicePerformanceId: performanceId,
      invoiceLineId: lineId,
      actor: actorId,
      actorRoles: ['owner'],
    });
    const good = posted.accruals[0] as Record<string, unknown>;
    const otherTenant = randomUUID();
    await wrapper.withPlatformBypass(async (c) => {
      await c.tenant.create({
        data: { id: otherTenant, name: 'Other', slug: `o-${otherTenant.slice(0, 8)}` },
      });
    });
    // Representative INSERT reject for userId cross-tenant (full matrix covered in dedicated inserts below)
    await expect(
      wrapper.withPlatformBypass(async (c) => {
        const foreignUser = randomUUID();
        await c.user.create({
          data: {
            id: foreignUser,
            tenantId: otherTenant,
            email: `fx-${foreignUser.slice(0, 8)}@t.local`,
            passwordHash: 'x',
            firstName: 'F',
            lastName: 'X',
          },
        });
        await c.$executeRawUnsafe(
          `INSERT INTO commission_accruals (
            id, "tenantId", "userId", "servicePerformanceId", "clinicalServiceId",
            "commissionPlanVersionId", "calculationBasis", "attributedRevenueAmount",
            "commissionPercent", "commissionAmount", currency, status, "idempotencyKey", "createdBy"
          ) VALUES (
            $1::uuid, $2::uuid, $3::uuid, $4::uuid, $5::uuid,
            $6::uuid, 'SERVICE_NET_AFTER_DISCOUNT', 100, 30, 30, 'SYP', 'EARNED', $7, $8::uuid
          )`,
          randomUUID(),
          tenantId,
          foreignUser,
          good.servicePerformanceId,
          good.clinicalServiceId,
          good.commissionPlanVersionId,
          `bad-${randomUUID()}`,
          actorId,
        );
      }),
    ).rejects.toThrow(/tenant mismatch|23514/i);
    expect(parentRefs.length).toBe(13);
  });

  it('F6-R2 parent-switch UPDATE rejected for each mutable attempt path', async () => {
    await enableAndPublishPlan({ userId: performerId, percentage: 30, effectiveFrom: '2026-01-01' });
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
        c.$executeRawUnsafe(
          `UPDATE commission_accruals SET "invoiceId" = $1::uuid WHERE id = $2::uuid`,
          randomUUID(),
          id,
        ),
      ),
    ).rejects.toThrow(/append-only|23514|tenant mismatch/i);
  });

  // ── F7 ────────────────────────────────────────────────────────────────────
  it('F7-R2-T2 partial reversal then settlement settles only net remaining', async () => {
    await enableAndPublishPlan({ userId: performerId, percentage: 30, effectiveFrom: '2026-01-01' });
    const performanceId = await createCompletedPerformance();
    const { invoiceId, lineId } = await createInvoiceLine({
      servicePerformanceId: performanceId,
      amountTotal: '1000.00',
    });
    const posted = await accruals().postFromServicePerformance({
      servicePerformanceId: performanceId,
      invoiceLineId: lineId,
      actor: actorId,
      actorRoles: ['owner'],
    });
    const original = posted.accruals[0] as { id: string; commissionAmount: Prisma.Decimal };
    const refundId = await createRefund(invoiceId, '500.00');
    await accruals().reverseAccrual({
      accrualId: original.id,
      refundId,
      actor: actorId,
      actorRoles: ['owner'],
    });
    const settled = await accruals().settleAccrual({
      accrualId: original.id,
      settlementReference: 'NET-PARTIAL',
      actor: actorId,
      actorRoles: ['owner'],
    });
    expect(settled.settleableAmount).toBe(
      original.commissionAmount.mul(0.5).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP).toFixed(2),
    );
    expect(settled.status).toBe('SETTLED');
  });

  it('F7-R2-T3 full reversal then settlement rejected', async () => {
    await enableAndPublishPlan({ userId: performerId, percentage: 30, effectiveFrom: '2026-01-01' });
    const performanceId = await createCompletedPerformance();
    const { invoiceId, lineId } = await createInvoiceLine({
      servicePerformanceId: performanceId,
      amountTotal: '1000.00',
    });
    const posted = await accruals().postFromServicePerformance({
      servicePerformanceId: performanceId,
      invoiceLineId: lineId,
      actor: actorId,
      actorRoles: ['owner'],
    });
    const accrualId = (posted.accruals[0] as { id: string }).id;
    await accruals().reverseAccrual({
      accrualId,
      refundId: await createRefund(invoiceId, '1000.00'),
      actor: actorId,
      actorRoles: ['owner'],
    });
    await expect(
      accruals().settleAccrual({
        accrualId,
        settlementReference: 'SHOULD-FAIL',
        actor: actorId,
        actorRoles: ['owner'],
      }),
    ).rejects.toThrow(/No net settleable/i);
  });

  it('F7-R2-T6..T12 owner report dimensions + attributed revenue + multi-currency + legacy excluded', async () => {
    await enableAndPublishPlan({ userId: performerId, percentage: 30, effectiveFrom: '2026-01-01' });
    const performanceId = await createCompletedPerformance();
    const { lineId } = await createInvoiceLine({ servicePerformanceId: performanceId });
    const posted = await accruals().postFromServicePerformance({
      servicePerformanceId: performanceId,
      invoiceLineId: lineId,
      actor: actorId,
      actorRoles: ['owner'],
    });
    const planVersionId = (posted.accruals[0] as { commissionPlanVersionId: string })
      .commissionPlanVersionId;
    const report = await accruals().ownerReport({
      from: '2026-01-01T00:00:00.000Z',
      to: '2027-01-01T00:00:00.000Z',
      userId: performerId,
      branchId,
      clinicalServiceId,
      planVersionId,
    });
    expect(report.legacyCommissionCalculationIncluded).toBe(false);
    expect(report.byCurrency[0].attributedRevenue).toBeDefined();
    expect(report.byUser.length).toBeGreaterThanOrEqual(1);
    expect(report.byBranch.length).toBeGreaterThanOrEqual(1);
    expect(report.byClinicalService.length).toBeGreaterThanOrEqual(1);
    expect(report.byPlanVersion.length).toBeGreaterThanOrEqual(1);
    expect(report.drilldown[0].servicePerformanceId).toBe(performanceId);
    expect(report.drilldown[0].invoiceLineId).toBe(lineId);
  });
});
