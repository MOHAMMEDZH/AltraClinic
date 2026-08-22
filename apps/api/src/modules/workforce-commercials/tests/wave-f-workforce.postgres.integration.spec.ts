/**
 * Wave F — workforce commercials production-path PostgreSQL tests (P1-14).
 */
import { randomUUID } from 'crypto';
import { ForbiddenException } from '@nestjs/common';
import type { PrismaClient } from '@prisma/client';
import { Prisma } from '@prisma/client';
import {
  createClinicalPrismaWrapper,
  createPlatformDbSecurityClient,
  platformDbSecurityEnabled,
} from '../../clinical-catalog/tests/clinical-catalog-db.harness';
import { CommissionAccrualService } from '../services/commission-accrual.service';
import { StaffCommissionPlanService } from '../services/staff-commission-plan.service';

jest.setTimeout(180_000);
const describeDb = platformDbSecurityEnabled() ? describe : describe.skip;

describeDb('Wave F workforce commercials integration (PostgreSQL)', () => {
  let raw: PrismaClient;
  let wrapper: ReturnType<typeof createClinicalPrismaWrapper>;
  let tenantId: string;
  let otherTenantId: string;
  let actorId: string;
  let performerId: string;
  let providerId: string;
  let performer2Id: string;
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

  async function seedBaseUsers() {
    await wrapper.withPlatformBypass(async (c) => {
      await c.tenant.create({
        data: { id: tenantId, name: 'WF', slug: `wf-${tenantId.slice(0, 8)}` },
      });
      await c.tenant.create({
        data: { id: otherTenantId, name: 'WF O', slug: `wfo-${otherTenantId.slice(0, 8)}` },
      });
      const users = [
        { id: actorId, first: 'A', last: 'Ctor' },
        { id: performerId, first: 'Perf', last: 'Ormer' },
        { id: providerId, first: 'Prov', last: 'Ider' },
        { id: performer2Id, first: 'Perf', last: 'Two' },
      ];
      for (const u of users) {
        await c.user.create({
          data: {
            id: u.id,
            tenantId,
            email: `wf-${u.id.slice(0, 8)}@t.local`,
            passwordHash: 'x',
            firstName: u.first,
            lastName: u.last,
          },
        });
      }
      await c.patient.create({
        data: { id: patientId, tenantId, firstName: 'Pat', lastName: 'Wf' },
      });
      await c.branch.create({
        data: { id: branchId, tenantId, name: `WF Branch ${branchId.slice(0, 6)}` },
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
          providerId,
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
      actor: { actorId, actorRoles: ['owner'] },
    });
    return plans().publishPlan(draft.id, { actorId, actorRoles: ['owner'] });
  }

  async function createCompletedPerformance(opts: {
    participants: Array<{ userId: string; role: 'PRIMARY' | 'ASSISTING'; share?: number | null }>;
    appointmentId?: string | null;
    performedAt?: Date;
  }) {
    const performanceId = randomUUID();
    const performedAt = opts.performedAt ?? new Date('2026-09-01T10:30:00.000Z');
    await wrapper.withPlatformBypass(async (c) => {
      // DRAFT first — nested participants cannot insert against COMPLETED (lock trigger).
      await c.servicePerformance.create({
        data: {
          id: performanceId,
          tenantId,
          branchId,
          appointmentId: opts.appointmentId === undefined ? appointmentId : opts.appointmentId,
          patientId,
          clinicalServiceId,
          performedAt,
          status: 'DRAFT',
          createdBy: actorId,
          participants: {
            create: opts.participants.map((p) => ({
              id: randomUUID(),
              tenantId,
              userId: p.userId,
              role: p.role,
              attributionShare: p.share == null ? null : new Prisma.Decimal(p.share),
              recordedBy: actorId,
            })),
          },
        },
      });
      await c.servicePerformance.update({
        where: { id: performanceId },
        data: {
          status: 'COMPLETED',
          completedAt: performedAt,
          completedBy: actorId,
        },
      });
    });
    return performanceId;
  }

  async function createInvoiceLine(opts?: {
    subtotal?: string;
    discountAmount?: string;
    taxAmount?: string;
    lineTotal?: string;
    serviceCode?: string | null;
    encounterId?: string | null;
    patientId?: string;
    branchId?: string | null;
    servicePerformanceId?: string | null;
  }) {
    const invoiceId = randomUUID();
    const lineId = randomUUID();
    const subtotal = opts?.subtotal ?? '1000.00';
    const discountAmount = opts?.discountAmount ?? '100.00';
    const taxAmount = opts?.taxAmount ?? '0.00';
    const lineTotal =
      opts?.lineTotal ??
      new Prisma.Decimal(subtotal).sub(discountAmount).add(taxAmount).toFixed(2);
    const serviceCode =
      opts?.serviceCode === null
        ? null
        : (opts?.serviceCode ?? `wf-${clinicalServiceId.slice(0, 8)}`);
    await wrapper.withPlatformBypass(async (c) => {
      await c.invoice.create({
        data: {
          id: invoiceId,
          tenantId,
          branchId: opts?.branchId === undefined ? branchId : opts.branchId,
          patientId: opts?.patientId ?? patientId,
          invoiceNumber: `WF-${invoiceId.slice(0, 8)}`,
          invoiceDate: new Date('2026-09-01'),
          currency: 'SYP',
          status: 'ISSUED',
          amountSubtotal: subtotal,
          amountDiscount: discountAmount,
          amountTax: taxAmount,
          amountTotal: lineTotal,
          lineItems: {
            create: {
              id: lineId,
              tenantId,
              description: 'Wave F service',
              quantity: 1,
              unitPrice: subtotal,
              subtotal,
              discountAmount,
              taxAmount,
              lineTotal,
              serviceCode,
              encounterId: opts?.encounterId ?? null,
              servicePerformanceId: opts?.servicePerformanceId ?? null,
            },
          },
        },
      });
    });
    return {
      invoiceId,
      lineId,
      netAfterDiscount: new Prisma.Decimal(subtotal).sub(discountAmount),
      amountTotal: lineTotal,
    };
  }

  async function createRefund(opts: {
    invoiceId: string;
    amount: string;
    paymentId?: string | null;
  }) {
    const refundId = randomUUID();
    await wrapper.withPlatformBypass(async (c) => {
      await c.invoiceRefund.create({
        data: {
          id: refundId,
          tenantId,
          invoiceId: opts.invoiceId,
          paymentId: opts.paymentId ?? null,
          amount: opts.amount,
          reason: 'Wave F test refund',
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
    otherTenantId = randomUUID();
    actorId = randomUUID();
    performerId = randomUUID();
    providerId = randomUUID();
    performer2Id = randomUUID();
    patientId = randomUUID();
    branchId = randomUUID();
    clinicalServiceId = randomUUID();
    appointmentId = randomUUID();
    await seedBaseUsers();
  });

  it('disabled commissionEnabled → no accrual on post', async () => {
    // performer remains commissionEnabled=false (default)
    const performanceId = await createCompletedPerformance({
      participants: [{ userId: performerId, role: 'PRIMARY', share: null }],
    });
    const { lineId } = await createInvoiceLine({ servicePerformanceId: performanceId });
    const result = await accruals().postFromServicePerformance({
      servicePerformanceId: performanceId,
      invoiceLineId: lineId,
      actor: actorId,
      actorRoles: ['owner'],
    });
    expect(result.accruals).toHaveLength(0);
    expect((result as { skipped?: string }).skipped).toBe('no_commission_enabled_participants');
  });

  it('30% correct accrual from NET_AFTER_DISCOUNT', async () => {
    const plan = await enableAndPublishPlan({
      userId: performerId,
      percentage: 30,
      effectiveFrom: '2026-01-01',
    });
    const performanceId = await createCompletedPerformance({
      participants: [{ userId: performerId, role: 'PRIMARY', share: null }],
    });
    const { lineId, netAfterDiscount } = await createInvoiceLine({ servicePerformanceId: performanceId,
      subtotal: '1000.00',
      discountAmount: '100.00',
    });
    const result = await accruals().postFromServicePerformance({
      servicePerformanceId: performanceId,
      invoiceLineId: lineId,
      actor: actorId,
      actorRoles: ['owner'],
    });
    expect(result.accruals).toHaveLength(1);
    const row = result.accruals[0] as {
      commissionAmount: Prisma.Decimal;
      attributedRevenueAmount: Prisma.Decimal;
      commissionPercent: Prisma.Decimal;
      commissionPlanVersionId: string;
      currency: string;
      userId: string;
    };
    expect(row.userId).toBe(performerId);
    expect(row.commissionPlanVersionId).toBe(plan.id);
    expect(row.currency).toBe('SYP');
    expect(row.attributedRevenueAmount.toFixed(2)).toBe(netAfterDiscount.toFixed(2));
    expect(row.commissionPercent.toFixed(2)).toBe('30.00');
    expect(row.commissionAmount.toFixed(2)).toBe(
      netAfterDiscount.mul(30).div(100).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP).toFixed(2),
    );
  });

  it('historical 25% plan survives after new 30% published', async () => {
    const plan25 = await enableAndPublishPlan({
      userId: performerId,
      percentage: 25,
      effectiveFrom: '2026-01-01',
    });
    const performanceId = await createCompletedPerformance({
      participants: [{ userId: performerId, role: 'PRIMARY', share: null }],
      performedAt: new Date('2026-06-01T10:00:00.000Z'),
    });
    const { lineId } = await createInvoiceLine({ servicePerformanceId: performanceId });
    const first = await accruals().postFromServicePerformance({
      servicePerformanceId: performanceId,
      invoiceLineId: lineId,
      actor: actorId,
      actorRoles: ['owner'],
    });
    expect((first.accruals[0] as { commissionPlanVersionId: string }).commissionPlanVersionId).toBe(
      plan25.id,
    );
    expect((first.accruals[0] as { commissionPercent: Prisma.Decimal }).commissionPercent.toFixed(2)).toBe(
      '25.00',
    );

    const plan30 = await enableAndPublishPlan({
      userId: performerId,
      percentage: 30,
      effectiveFrom: '2026-07-01',
    });
    expect(plan30.id).not.toBe(plan25.id);

    const stored = await wrapper.withPlatformBypass((c) =>
      c.commissionAccrual.findUnique({
        where: { id: (first.accruals[0] as { id: string }).id },
      }),
    );
    expect(stored?.commissionPlanVersionId).toBe(plan25.id);
    expect(stored?.commissionPercent.toFixed(2)).toBe('25.00');

    const superseded = await wrapper.withPlatformBypass((c) =>
      c.staffCommissionPlanVersion.findUnique({ where: { id: plan25.id } }),
    );
    expect(superseded?.status).toBe('SUPERSEDED');
  });

  it('performer ≠ appointment.providerId (accrual uses participant)', async () => {
    expect(performerId).not.toBe(providerId);
    await enableAndPublishPlan({
      userId: performerId,
      percentage: 30,
      effectiveFrom: '2026-01-01',
    });
    const performanceId = await createCompletedPerformance({
      participants: [{ userId: performerId, role: 'PRIMARY', share: null }],
      appointmentId,
    });
    const { lineId } = await createInvoiceLine({ servicePerformanceId: performanceId });
    const result = await accruals().postFromServicePerformance({
      servicePerformanceId: performanceId,
      invoiceLineId: lineId,
      actor: actorId,
      actorRoles: ['owner'],
    });
    expect(result.accruals).toHaveLength(1);
    expect((result.accruals[0] as { userId: string }).userId).toBe(performerId);
    expect((result.accruals[0] as { userId: string }).userId).not.toBe(providerId);
  });

  it('multi-share 60+40 no double-count', async () => {
    await enableAndPublishPlan({
      userId: performerId,
      percentage: 30,
      effectiveFrom: '2026-01-01',
    });
    await enableAndPublishPlan({
      userId: performer2Id,
      percentage: 30,
      effectiveFrom: '2026-01-01',
    });
    const performanceId = await createCompletedPerformance({
      participants: [
        { userId: performerId, role: 'PRIMARY', share: 60 },
        { userId: performer2Id, role: 'ASSISTING', share: 40 },
      ],
    });
    const { lineId, netAfterDiscount } = await createInvoiceLine({ servicePerformanceId: performanceId,
      subtotal: '1000.00',
      discountAmount: '0.00',
    });
    const result = await accruals().postFromServicePerformance({
      servicePerformanceId: performanceId,
      invoiceLineId: lineId,
      actor: actorId,
      actorRoles: ['owner'],
    });
    expect(result.accruals).toHaveLength(2);
    const byUser = new Map(
      (result.accruals as Array<{ userId: string; attributedRevenueAmount: Prisma.Decimal; commissionAmount: Prisma.Decimal }>).map(
        (a) => [a.userId, a],
      ),
    );
    const a = byUser.get(performerId)!;
    const b = byUser.get(performer2Id)!;
    expect(a.attributedRevenueAmount.add(b.attributedRevenueAmount).toFixed(2)).toBe(
      netAfterDiscount.toFixed(2),
    );
    expect(a.commissionAmount.add(b.commissionAmount).toFixed(2)).toBe(
      netAfterDiscount.mul(30).div(100).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP).toFixed(2),
    );
    // Not double-counted: neither share is 100% of basis
    expect(a.attributedRevenueAmount.toFixed(2)).toBe('600.00');
    expect(b.attributedRevenueAmount.toFixed(2)).toBe('400.00');
  });

  it('reverse full + partial proportional', async () => {
    await enableAndPublishPlan({
      userId: performerId,
      percentage: 30,
      effectiveFrom: '2026-01-01',
    });
    const performanceId = await createCompletedPerformance({
      participants: [{ userId: performerId, role: 'PRIMARY', share: null }],
    });
    const { invoiceId, lineId, amountTotal } = await createInvoiceLine({ servicePerformanceId: performanceId });
    const posted = await accruals().postFromServicePerformance({
      servicePerformanceId: performanceId,
      invoiceLineId: lineId,
      actor: actorId,
      actorRoles: ['owner'],
    });
    const accrualId = (posted.accruals[0] as { id: string; commissionAmount: Prisma.Decimal }).id;
    const originalAmt = (posted.accruals[0] as { commissionAmount: Prisma.Decimal }).commissionAmount;

    const fullRefundId = await createRefund({ invoiceId, amount: amountTotal });
    const full = await accruals().reverseAccrual({
      accrualId,
      refundId: fullRefundId,
      actor: actorId,
      actorRoles: ['owner'],
      reason: 'full refund',
    });
    expect(full.status).toBe('REVERSED');
    expect(full.commissionAmount.toFixed(2)).toBe(originalAmt.negated().toFixed(2));

    const performanceId2 = await createCompletedPerformance({
      participants: [{ userId: performerId, role: 'PRIMARY', share: null }],
    });
    const inv2 = await createInvoiceLine({ servicePerformanceId: performanceId2 });
    const posted2 = await accruals().postFromServicePerformance({
      servicePerformanceId: performanceId2,
      invoiceLineId: inv2.lineId,
      actor: actorId,
      actorRoles: ['owner'],
    });
    const accrual2 = posted2.accruals[0] as { id: string; commissionAmount: Prisma.Decimal };
    const halfAmount = new Prisma.Decimal(inv2.amountTotal).div(2).toFixed(2);
    const partialRefundId = await createRefund({ invoiceId: inv2.invoiceId, amount: halfAmount });
    const partial = await accruals().reverseAccrual({
      accrualId: accrual2.id,
      refundId: partialRefundId,
      actor: actorId,
      actorRoles: ['owner'],
      reason: 'partial refund',
    });
    expect(partial.commissionAmount.toFixed(2)).toBe(
      accrual2.commissionAmount.mul(0.5).negated().toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP).toFixed(2),
    );
  });

  it('reverse idempotent', async () => {
    await enableAndPublishPlan({
      userId: performerId,
      percentage: 20,
      effectiveFrom: '2026-01-01',
    });
    const performanceId = await createCompletedPerformance({
      participants: [{ userId: performerId, role: 'PRIMARY', share: null }],
    });
    const { invoiceId, lineId, amountTotal } = await createInvoiceLine({ servicePerformanceId: performanceId });
    const posted = await accruals().postFromServicePerformance({
      servicePerformanceId: performanceId,
      invoiceLineId: lineId,
      actor: actorId,
      actorRoles: ['owner'],
    });
    const accrualId = (posted.accruals[0] as { id: string }).id;
    const refundId = await createRefund({ invoiceId, amount: amountTotal });
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
    expect(b.id).toBe(a.id);
    const count = await wrapper.withPlatformBypass((c) =>
      c.commissionAccrual.count({ where: { reversalOfAccrualId: accrualId } }),
    );
    expect(count).toBe(1);
  });

  it('post idempotent (retry same key)', async () => {
    await enableAndPublishPlan({
      userId: performerId,
      percentage: 30,
      effectiveFrom: '2026-01-01',
    });
    const performanceId = await createCompletedPerformance({
      participants: [{ userId: performerId, role: 'PRIMARY', share: null }],
    });
    const { lineId } = await createInvoiceLine({ servicePerformanceId: performanceId });
    const first = await accruals().postFromServicePerformance({
      servicePerformanceId: performanceId,
      invoiceLineId: lineId,
      actor: actorId,
      actorRoles: ['owner'],
    });
    const second = await accruals().postFromServicePerformance({
      servicePerformanceId: performanceId,
      invoiceLineId: lineId,
      actor: actorId,
      actorRoles: ['owner'],
    });
    expect((second.accruals[0] as { id: string }).id).toBe((first.accruals[0] as { id: string }).id);
    const count = await wrapper.withPlatformBypass((c) =>
      c.commissionAccrual.count({
        where: { tenantId, servicePerformanceId: performanceId, reversalOfAccrualId: null },
      }),
    );
    expect(count).toBe(1);
  });

  it('settle EARNED→SETTLED', async () => {
    await enableAndPublishPlan({
      userId: performerId,
      percentage: 30,
      effectiveFrom: '2026-01-01',
    });
    const performanceId = await createCompletedPerformance({
      participants: [{ userId: performerId, role: 'PRIMARY', share: null }],
    });
    const { lineId } = await createInvoiceLine({ servicePerformanceId: performanceId });
    const posted = await accruals().postFromServicePerformance({
      servicePerformanceId: performanceId,
      invoiceLineId: lineId,
      actor: actorId,
      actorRoles: ['owner'],
    });
    const accrualId = (posted.accruals[0] as { id: string }).id;
    const settled = await accruals().settleAccrual({
      accrualId,
      settlementReference: 'PAY-WF-001',
      actor: actorId,
      actorRoles: ['owner'],
    });
    expect(settled.status).toBe('SETTLED');
    expect(settled.settlementReference).toBe('PAY-WF-001');
    expect(settled.settledAt).toBeTruthy();
  });

  it('self-edit denied for non-owner', async () => {
    await expect(
      plans().setUserCommissionEligibility(performerId, true, 30, '2026-01-01', {
        actorId: performerId,
        actorRoles: ['accountant'],
      }),
    ).rejects.toThrow(ForbiddenException);

    await enableAndPublishPlan({
      userId: performerId,
      percentage: 30,
      effectiveFrom: '2026-01-01',
    });
    const performanceId = await createCompletedPerformance({
      participants: [{ userId: performerId, role: 'PRIMARY', share: null }],
    });
    const { lineId } = await createInvoiceLine({ servicePerformanceId: performanceId });
    await expect(
      accruals().postFromServicePerformance({
        servicePerformanceId: performanceId,
        invoiceLineId: lineId,
        actor: performerId,
        actorRoles: ['accountant'],
      }),
    ).rejects.toThrow(ForbiddenException);
  });

  it('concurrent double-post same idempotency → one row', async () => {
    await enableAndPublishPlan({
      userId: performerId,
      percentage: 30,
      effectiveFrom: '2026-01-01',
    });
    const performanceId = await createCompletedPerformance({
      participants: [{ userId: performerId, role: 'PRIMARY', share: null }],
    });
    const { lineId } = await createInvoiceLine({ servicePerformanceId: performanceId });
    const [a, b] = await Promise.all([
      accruals().postFromServicePerformance({
        servicePerformanceId: performanceId,
        invoiceLineId: lineId,
        actor: actorId,
        actorRoles: ['owner'],
      }),
      accruals().postFromServicePerformance({
        servicePerformanceId: performanceId,
        invoiceLineId: lineId,
        actor: actorId,
        actorRoles: ['owner'],
      }),
    ]);
    expect((a.accruals[0] as { id: string }).id).toBe((b.accruals[0] as { id: string }).id);
    const count = await wrapper.withPlatformBypass((c) =>
      c.commissionAccrual.count({
        where: { tenantId, servicePerformanceId: performanceId, reversalOfAccrualId: null },
      }),
    );
    expect(count).toBe(1);
  });

  it('mixed-parent INSERT rejected (accrual tenant B + performance tenant A) via raw SQL under bypass', async () => {
    await enableAndPublishPlan({
      userId: performerId,
      percentage: 30,
      effectiveFrom: '2026-01-01',
    });
    const performanceId = await createCompletedPerformance({
      participants: [{ userId: performerId, role: 'PRIMARY', share: null }],
    });
    const { lineId } = await createInvoiceLine({ servicePerformanceId: performanceId });
    const posted = await accruals().postFromServicePerformance({
      servicePerformanceId: performanceId,
      invoiceLineId: lineId,
      actor: actorId,
      actorRoles: ['owner'],
    });
    const planId = (posted.accruals[0] as { commissionPlanVersionId: string }).commissionPlanVersionId;

    const otherUserId = randomUUID();
    const otherPlanId = randomUUID();
    const attemptId = randomUUID();
    await wrapper.withPlatformBypass(async (c) => {
      await c.user.create({
        data: {
          id: otherUserId,
          tenantId: otherTenantId,
          email: `wf-o-${otherUserId.slice(0, 8)}@t.local`,
          passwordHash: 'x',
          firstName: 'O',
          lastName: 'Ther',
        },
      });
      await c.staffCommissionPlanVersion.create({
        data: {
          id: otherPlanId,
          tenantId: otherTenantId,
          userId: otherUserId,
          percentage: 10,
          effectiveFrom: new Date('2026-01-01'),
          status: 'ACTIVE',
          createdBy: otherUserId,
          publishedAt: new Date(),
          publishedBy: otherUserId,
        },
      });
    });

    await expect(
      wrapper.withPlatformBypass(async (c) => {
        await c.$executeRawUnsafe(
          `INSERT INTO commission_accruals (
            id, "tenantId", "userId", "servicePerformanceId", "clinicalServiceId",
            "commissionPlanVersionId", "calculationBasis", "attributedRevenueAmount",
            "commissionPercent", "commissionAmount", currency, status, "idempotencyKey", "createdBy"
          ) VALUES (
            $1::uuid, $2::uuid, $3::uuid, $4::uuid, $5::uuid,
            $6::uuid, 'SERVICE_NET_AFTER_DISCOUNT'::commission_calculation_basis, 100, 10, 10, 'SYP',
            'EARNED'::commission_accrual_status, $7, $3::uuid
          )`,
          attemptId,
          otherTenantId,
          otherUserId,
          performanceId,
          clinicalServiceId,
          otherPlanId,
          `mix:${attemptId}`,
        );
      }),
    ).rejects.toThrow(/servicePerformanceId tenant mismatch|23514/i);

    const leaked = await wrapper.withPlatformBypass((c) =>
      c.commissionAccrual.count({ where: { id: attemptId } }),
    );
    expect(leaked).toBe(0);
    void planId;
  });

  it('parent-switch UPDATE rejected', async () => {
    await enableAndPublishPlan({
      userId: performerId,
      percentage: 30,
      effectiveFrom: '2026-01-01',
    });
    const performanceA = await createCompletedPerformance({
      participants: [{ userId: performerId, role: 'PRIMARY', share: null }],
    });
    const performanceB = await createCompletedPerformance({
      participants: [{ userId: performerId, role: 'PRIMARY', share: null }],
    });
    const { lineId } = await createInvoiceLine({ servicePerformanceId: performanceA });
    const posted = await accruals().postFromServicePerformance({
      servicePerformanceId: performanceA,
      invoiceLineId: lineId,
      actor: actorId,
      actorRoles: ['owner'],
    });
    const accrualId = (posted.accruals[0] as { id: string }).id;

    await expect(
      wrapper.withPlatformBypass(async (c) => {
        await c.$executeRawUnsafe(
          `UPDATE commission_accruals SET "servicePerformanceId" = $1::uuid WHERE id = $2::uuid`,
          performanceB,
          accrualId,
        );
      }),
    ).rejects.toThrow(/financial fields immutable|23514/i);

    const row = await wrapper.withPlatformBypass((c) =>
      c.commissionAccrual.findUnique({ where: { id: accrualId } }),
    );
    expect(row?.servicePerformanceId).toBe(performanceA);
  });
});
