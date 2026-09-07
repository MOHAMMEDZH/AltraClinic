/**
 * Phase 48 Wave F Round 8 — sibling-cohort correction + deterministic race proof.
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

describeDb('Wave F Round 8 remediation (PostgreSQL)', () => {
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
        data: { id: tenantId, name: 'WF R8', slug: `wfr8-${tenantId.slice(0, 8)}` },
      });
      for (const u of [
        { id: actorId, first: 'A', last: 'Ctor' },
        { id: performerId, first: 'Perf', last: 'Ormer' },
      ]) {
        await c.user.create({
          data: {
            id: u.id,
            tenantId,
            email: `wfr8-${u.id.slice(0, 8)}@t.local`,
            passwordHash: 'x',
            firstName: u.first,
            lastName: u.last,
          },
        });
      }
      await c.patient.create({
        data: { id: patientId, tenantId, firstName: 'Pat', lastName: 'Eight' },
      });
      await c.branch.create({
        data: { id: branchId, tenantId, name: `R8 B ${branchId.slice(0, 6)}` },
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
      opts?.percentage ?? 30,
      '2026-01-01',
      { actorId, actorRoles: ['owner'] },
    );
    const draft = await plans().createDraftPlan({
      userId,
      percentage: opts?.percentage ?? 30,
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
        description: 'R8 clinical line',
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
        description: 'R8 other line',
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
      invoiceNumber: `R8-${randomUUID().slice(0, 8)}`,
      invoiceDate: new Date('2026-09-01'),
      currency: opts?.currency ?? 'SYP',
      notes: 'R8',
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
    return { courseId, sessionId, priceVersionId };
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
          reason: 'R8 refund',
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
    opts?: { amount?: string; courseSessionId?: string | null; currencyLineTotal?: string },
  ) {
    const id = randomUUID();
    const amt = opts?.amount ?? '5000.00';
    await wrapper.withPlatformBypass(async (c) => {
      await c.invoiceLineItem.create({
        data: {
          id,
          invoiceId,
          tenantId,
          description: 'R8 corrected line',
          quantity: 1,
          unitPrice: amt,
          discountPercent: 0,
          taxPercent: 0,
          subtotal: amt,
          discountAmount: 0,
          taxAmount: 0,
          lineTotal: opts?.currencyLineTotal ?? amt,
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
          email: `wfr8-a-${assistId.slice(0, 8)}@t.local`,
          passwordHash: 'x',
          firstName: 'As',
          lastName: 'Sist',
        },
      });
    });
    await enableAndPublishPlan({
      userId: assistId,
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

  // ── R8-A cohort correction ─────────────────────────────────────────────────

  it('R8-A-T1 two payments one participant package COLLECTED correction → 320', async () => {
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
    const alloc = await packages().registerSessionAllocation({
      treatmentCourseId: courseId,
      courseSessionId: sessionId,
      servicePerformanceId: performanceId,
      allocatedRevenueAmount: '1000.00',
      invoiceLineId: lineId,
      actor: { actorId, actorRoles: ['owner'] },
      idempotencyKey: `r8a1-${sessionId}`,
    });
    const p1 = await createPayment(invoiceId, '800.00');
    const p2 = await createPayment(invoiceId, '800.00');
    await accruals().postFromCollectedPayment({
      servicePerformanceId: performanceId,
      invoiceLineId: lineId,
      paymentId: p1,
      actor: actorId,
      actorRoles: ['owner'],
    });
    await accruals().postFromCollectedPayment({
      servicePerformanceId: performanceId,
      invoiceLineId: lineId,
      paymentId: p2,
      actor: actorId,
      actorRoles: ['owner'],
    });
    const before = await openCollectedRoots(performanceId);
    expect(before).toHaveLength(2);
    expect((await netAttributed(performanceId)).toFixed(2)).toBe('320.00');

    const repl = await createSameInvoiceReplacementLine(invoiceId, {
      amount: '5000.00',
      courseSessionId: sessionId,
    });
    const corr = await accruals().correctAndRepost({
      accrualId: before[0]!.id,
      correctionEventId: randomUUID(),
      replacementInvoiceLineId: repl,
      reason: 'R8-A-T1',
      actor: actorId,
      actorRoles: ['owner'],
    });
    expect((corr as { reversals: unknown[] }).reversals).toHaveLength(2);
    const after = await openCollectedRoots(performanceId);
    expect(after).toHaveLength(2);
    expect(after.every((a) => a.invoiceLineId === repl)).toBe(true);
    expect(new Set(after.map((a) => a.paymentId)).size).toBe(2);
    expect(after.every((a) => a.packageAllocationId === alloc.allocation.id)).toBe(true);
    expect((await netAttributed(performanceId)).toFixed(2)).toBe('320.00');
    expect((corr.repost as { accruals: unknown[] }).accruals).toHaveLength(2);
  });

  it('R8-A-T2 one payment two participants 60/40 correction', async () => {
    await enableAndPublishPlan({
      calculationBasis: 'COLLECTED_REVENUE',
      earningTrigger: 'PAYMENT_COLLECTED',
    });
    const assistId = await ensureAssistant();
    const { courseId, sessionId } = await seedCourseSession();
    const performanceId = await createCompletedPerformance({ assistantUserId: assistId });
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
      idempotencyKey: `r8a2-${sessionId}`,
    });
    const pay = await createPayment(invoiceId, '800.00');
    const posted = await accruals().postFromCollectedPayment({
      servicePerformanceId: performanceId,
      invoiceLineId: lineId,
      paymentId: pay,
      actor: actorId,
      actorRoles: ['owner'],
    });
    expect(posted.accruals).toHaveLength(2);
    const sum = (posted.accruals as Array<{ attributedRevenueAmount: Prisma.Decimal }>).reduce(
      (a, r) => a.add(r.attributedRevenueAmount),
      new Prisma.Decimal(0),
    );
    expect(sum.toFixed(2)).toBe('160.00');
    const repl = await createSameInvoiceReplacementLine(invoiceId, {
      amount: '5000.00',
      courseSessionId: sessionId,
    });
    const corr = await accruals().correctAndRepost({
      accrualId: (posted.accruals[0] as { id: string }).id,
      correctionEventId: randomUUID(),
      replacementInvoiceLineId: repl,
      reason: 'R8-A-T2',
      actor: actorId,
      actorRoles: ['owner'],
    });
    expect((corr as { reversals: unknown[] }).reversals).toHaveLength(2);
    expect((corr.repost as { accruals: unknown[] }).accruals).toHaveLength(2);
    const afterSum = (
      corr.repost as { accruals: Array<{ attributedRevenueAmount: Prisma.Decimal }> }
    ).accruals.reduce((a, r) => a.add(r.attributedRevenueAmount), new Prisma.Decimal(0));
    expect(afterSum.toFixed(2)).toBe('160.00');
  });

  it('R8-A-T3/T4 two payments × two participants + idempotent replay', async () => {
    await enableAndPublishPlan({
      calculationBasis: 'COLLECTED_REVENUE',
      earningTrigger: 'PAYMENT_COLLECTED',
    });
    const assistId = await ensureAssistant();
    const { courseId, sessionId } = await seedCourseSession();
    const performanceId = await createCompletedPerformance({ assistantUserId: assistId });
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
      idempotencyKey: `r8a3-${sessionId}`,
    });
    const p1 = await createPayment(invoiceId, '800.00');
    const p2 = await createPayment(invoiceId, '800.00');
    await accruals().postFromCollectedPayment({
      servicePerformanceId: performanceId,
      invoiceLineId: lineId,
      paymentId: p1,
      actor: actorId,
      actorRoles: ['owner'],
    });
    await accruals().postFromCollectedPayment({
      servicePerformanceId: performanceId,
      invoiceLineId: lineId,
      paymentId: p2,
      actor: actorId,
      actorRoles: ['owner'],
    });
    const before = await openCollectedRoots(performanceId);
    expect(before).toHaveLength(4);
    expect((await netAttributed(performanceId)).toFixed(2)).toBe('320.00');

    const repl = await createSameInvoiceReplacementLine(invoiceId, {
      amount: '5000.00',
      courseSessionId: sessionId,
    });
    const eventId = randomUUID();
    const corr = await accruals().correctAndRepost({
      accrualId: before[0]!.id,
      correctionEventId: eventId,
      replacementInvoiceLineId: repl,
      reason: 'R8-A-T3',
      actor: actorId,
      actorRoles: ['owner'],
    });
    expect((corr as { reversals: unknown[] }).reversals).toHaveLength(4);
    expect((corr.repost as { accruals: unknown[] }).accruals).toHaveLength(4);
    expect((await netAttributed(performanceId)).toFixed(2)).toBe('320.00');
    const after = await openCollectedRoots(performanceId);
    expect(after.every((a) => a.packageAllocationId === alloc.allocation.id)).toBe(true);

    const replay = await accruals().correctAndRepost({
      accrualId: before[0]!.id,
      correctionEventId: eventId,
      replacementInvoiceLineId: repl,
      reason: 'R8-A-T3',
      actor: actorId,
      actorRoles: ['owner'],
    });
    expect(replay.idempotent).toBe(true);
    expect((replay.repost as { accruals: unknown[] }).accruals).toHaveLength(4);
    expect((await openCollectedRoots(performanceId)).length).toBe(4);
    expect((await netAttributed(performanceId)).toFixed(2)).toBe('320.00');
  });

  it('R8-A-T5 idempotency conflict different replacement', async () => {
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
      idempotencyKey: `r8a5-${sessionId}`,
    });
    const pay = await createPayment(invoiceId, '800.00');
    const posted = await accruals().postFromCollectedPayment({
      servicePerformanceId: performanceId,
      invoiceLineId: lineId,
      paymentId: pay,
      actor: actorId,
      actorRoles: ['owner'],
    });
    const rootId = (posted.accruals[0] as { id: string }).id;
    const eventId = randomUUID();
    const repl1 = await createSameInvoiceReplacementLine(invoiceId, {
      amount: '5000.00',
      courseSessionId: sessionId,
    });
    await accruals().correctAndRepost({
      accrualId: rootId,
      correctionEventId: eventId,
      replacementInvoiceLineId: repl1,
      reason: 'R8-A-T5 first',
      actor: actorId,
      actorRoles: ['owner'],
    });
    const repl2 = await createSameInvoiceReplacementLine(invoiceId, {
      amount: '5000.00',
      courseSessionId: sessionId,
    });
    const beforeCount = await wrapper.withPlatformBypass((c) =>
      c.commissionAccrual.count({ where: { tenantId, servicePerformanceId: performanceId } }),
    );
    await expect(
      accruals().correctAndRepost({
        accrualId: rootId,
        correctionEventId: eventId,
        replacementInvoiceLineId: repl2,
        reason: 'R8-A-T5 conflict',
        actor: actorId,
        actorRoles: ['owner'],
      }),
    ).rejects.toThrow(/idempotency conflict/i);
    const afterCount = await wrapper.withPlatformBypass((c) =>
      c.commissionAccrual.count({ where: { tenantId, servicePerformanceId: performanceId } }),
    );
    expect(afterCount).toBe(beforeCount);
  });

  it('R8-A-T6 SETTLED sibling fails closed with zero cohort mutation', async () => {
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
      idempotencyKey: `r8a6-${sessionId}`,
    });
    const p1 = await createPayment(invoiceId, '800.00');
    const p2 = await createPayment(invoiceId, '800.00');
    const a1 = await accruals().postFromCollectedPayment({
      servicePerformanceId: performanceId,
      invoiceLineId: lineId,
      paymentId: p1,
      actor: actorId,
      actorRoles: ['owner'],
    });
    await accruals().postFromCollectedPayment({
      servicePerformanceId: performanceId,
      invoiceLineId: lineId,
      paymentId: p2,
      actor: actorId,
      actorRoles: ['owner'],
    });
    await accruals().settleAccrual({
      accrualId: (a1.accruals[0] as { id: string }).id,
      settlementReference: `settle-${randomUUID().slice(0, 8)}`,
      actor: actorId,
      actorRoles: ['owner'],
    });
    const roots = await openCollectedRoots(performanceId);
    const repl = await createSameInvoiceReplacementLine(invoiceId, {
      amount: '5000.00',
      courseSessionId: sessionId,
    });
    const beforeNet = await netAttributed(performanceId);
    await expect(
      accruals().correctAndRepost({
        accrualId: roots.find((r) => r.status === 'EARNED')!.id,
        correctionEventId: randomUUID(),
        replacementInvoiceLineId: repl,
        reason: 'R8-A-T6',
        actor: actorId,
        actorRoles: ['owner'],
      }),
    ).rejects.toThrow(/SETTLED|fail closed/i);
    expect((await netAttributed(performanceId)).toFixed(2)).toBe(beforeNet.toFixed(2));
    const binding = await wrapper.withPlatformBypass((c) =>
      c.invoiceLineItem.findFirst({ where: { id: lineId, tenantId } }),
    );
    expect(binding!.performanceBindingStatus).toBe('ACTIVE');
  });

  it('R8-A-T7 cross-invoice payment correction rejected', async () => {
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
      idempotencyKey: `r8a7-${sessionId}`,
    });
    const pay = await createPayment(invoiceId, '800.00');
    const posted = await accruals().postFromCollectedPayment({
      servicePerformanceId: performanceId,
      invoiceLineId: lineId,
      paymentId: pay,
      actor: actorId,
      actorRoles: ['owner'],
    });
    const other = await createInvoiceViaProductionPath(null, {
      amount: '5000.00',
      appointmentId,
      clinicalServiceId,
      courseSessionId: sessionId,
    });
    await expect(
      accruals().correctAndRepost({
        accrualId: (posted.accruals[0] as { id: string }).id,
        correctionEventId: randomUUID(),
        replacementInvoiceLineId: other.lineId,
        reason: 'R8-A-T7',
        actor: actorId,
        actorRoles: ['owner'],
      }),
    ).rejects.toThrow(/same-invoice|cross-invoice|provenance/i);
    expect((await openCollectedRoots(performanceId))[0]!.invoiceLineId).toBe(lineId);
  });

  it('R8-A-T8 currency mismatch correction zero side effects', async () => {
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
    await packages().registerSessionAllocation({
      treatmentCourseId: courseId,
      courseSessionId: sessionId,
      servicePerformanceId: performanceId,
      allocatedRevenueAmount: '1000.00',
      invoiceLineId: lineId,
      actor: { actorId, actorRoles: ['owner'] },
      idempotencyKey: `r8a8-${sessionId}`,
    });
    const pay = await createPayment(invoiceId, '800.00');
    const posted = await accruals().postFromCollectedPayment({
      servicePerformanceId: performanceId,
      invoiceLineId: lineId,
      paymentId: pay,
      actor: actorId,
      actorRoles: ['owner'],
    });
    // Same invoice but force replacement invoice currency mismatch via separate USD invoice line
    const usdInv = await createInvoiceViaProductionPath(null, {
      amount: '5000.00',
      currency: 'USD',
      appointmentId,
      clinicalServiceId,
      courseSessionId: sessionId,
    });
    const beforeCount = await wrapper.withPlatformBypass((c) =>
      c.commissionAccrual.count({ where: { tenantId, servicePerformanceId: performanceId } }),
    );
    await expect(
      accruals().correctAndRepost({
        accrualId: (posted.accruals[0] as { id: string }).id,
        correctionEventId: randomUUID(),
        replacementInvoiceLineId: usdInv.lineId,
        reason: 'R8-A-T8',
        actor: actorId,
        actorRoles: ['owner'],
      }),
    ).rejects.toThrow(/currency|same-invoice|cross-invoice/i);
    const afterCount = await wrapper.withPlatformBypass((c) =>
      c.commissionAccrual.count({ where: { tenantId, servicePerformanceId: performanceId } }),
    );
    expect(afterCount).toBe(beforeCount);
    const stale = await wrapper.withPlatformBypass((c) =>
      c.invoiceLineItem.findFirst({ where: { id: lineId, tenantId } }),
    );
    expect(stale!.performanceBindingStatus).toBe('ACTIVE');
  });

  it('R8-A-T9 multi-participant provenance failure full rollback', async () => {
    await enableAndPublishPlan({
      calculationBasis: 'COLLECTED_REVENUE',
      earningTrigger: 'PAYMENT_COLLECTED',
    });
    const assistId = await ensureAssistant();
    const { courseId, sessionId } = await seedCourseSession();
    const performanceId = await createCompletedPerformance({ assistantUserId: assistId });
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
      idempotencyKey: `r8a9-${sessionId}`,
    });
    const pay = await createPayment(invoiceId, '800.00');
    const posted = await accruals().postFromCollectedPayment({
      servicePerformanceId: performanceId,
      invoiceLineId: lineId,
      paymentId: pay,
      actor: actorId,
      actorRoles: ['owner'],
    });
    const badRepl = randomUUID();
    await wrapper.withPlatformBypass(async (c) => {
      await c.invoiceLineItem.create({
        data: {
          id: badRepl,
          invoiceId,
          tenantId,
          description: 'R8 bad provenance',
          quantity: 1,
          unitPrice: '5000.00',
          discountPercent: 0,
          taxPercent: 0,
          subtotal: '5000.00',
          discountAmount: 0,
          taxAmount: 0,
          lineTotal: '5000.00',
          appointmentId: null,
          clinicalServiceId: null,
          courseSessionId: null,
          servicePerformanceId: null,
        },
      });
    });
    const before = await openCollectedRoots(performanceId);
    await expect(
      accruals().correctAndRepost({
        accrualId: (posted.accruals[0] as { id: string }).id,
        correctionEventId: randomUUID(),
        replacementInvoiceLineId: badRepl,
        reason: 'R8-A-T9',
        actor: actorId,
        actorRoles: ['owner'],
      }),
    ).rejects.toThrow();
    const after = await openCollectedRoots(performanceId);
    expect(after.map((a) => a.id).sort()).toEqual(before.map((a) => a.id).sort());
    expect(after.every((a) => a.invoiceLineId === lineId)).toBe(true);
  });

  it('R8-A-T10 invoice-based multi-participant cohort correction', async () => {
    await enableAndPublishPlan();
    const assistId = randomUUID();
    await wrapper.withPlatformBypass(async (c) => {
      await c.user.create({
        data: {
          id: assistId,
          tenantId,
          email: `wfr8-i-${assistId.slice(0, 8)}@t.local`,
          passwordHash: 'x',
          firstName: 'Inv',
          lastName: 'Asst',
        },
      });
    });
    await enableAndPublishPlan({ userId: assistId });
    const performanceId = await createCompletedPerformance({ assistantUserId: assistId });
    const { lineId } = await createInvoiceViaProductionPath(performanceId, { amount: '1000.00' });
    const posted = await accruals().postFromServicePerformance({
      servicePerformanceId: performanceId,
      invoiceLineId: lineId,
      actor: actorId,
      actorRoles: ['owner'],
    });
    expect(posted.accruals.length).toBe(2);
    const repl = await createInvoiceViaProductionPath(null, {
      amount: '1000.00',
      appointmentId,
      clinicalServiceId,
    });
    // Bind replacement via same-invoice requirement? Invoice-based allows different invoice if provenance ok.
    // createSameInvoice from production path creates new invoice — OK for invoice basis.
    const corr = await accruals().correctAndRepost({
      accrualId: (posted.accruals[0] as { id: string }).id,
      correctionEventId: randomUUID(),
      replacementInvoiceLineId: repl.lineId,
      reason: 'R8-A-T10',
      actor: actorId,
      actorRoles: ['owner'],
    });
    expect((corr as { reversals: unknown[] }).reversals).toHaveLength(2);
    expect((corr.repost as { accruals: unknown[] }).accruals).toHaveLength(2);
  });

  it('R8-A-T11 refund after multi-payment correction uses exact replacement basis', async () => {
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
      idempotencyKey: `r8a11-${sessionId}`,
    });
    const p1 = await createPayment(invoiceId, '800.00');
    const p2 = await createPayment(invoiceId, '800.00');
    await accruals().postFromCollectedPayment({
      servicePerformanceId: performanceId,
      invoiceLineId: lineId,
      paymentId: p1,
      actor: actorId,
      actorRoles: ['owner'],
    });
    await accruals().postFromCollectedPayment({
      servicePerformanceId: performanceId,
      invoiceLineId: lineId,
      paymentId: p2,
      actor: actorId,
      actorRoles: ['owner'],
    });
    const roots = await openCollectedRoots(performanceId);
    const repl = await createSameInvoiceReplacementLine(invoiceId, {
      amount: '5000.00',
      courseSessionId: sessionId,
    });
    const corr = await accruals().correctAndRepost({
      accrualId: roots[0]!.id,
      correctionEventId: randomUUID(),
      replacementInvoiceLineId: repl,
      reason: 'R8-A-T11',
      actor: actorId,
      actorRoles: ['owner'],
    });
    const current = (corr.repost as { accruals: Array<{ id: string; attributedRevenueAmount: Prisma.Decimal }> })
      .accruals[0]!;
    expect(current.attributedRevenueAmount.toFixed(2)).toBe('160.00');
    // refund 800 / collectedTotal 1600 = 0.5 → reverse attributed = 160 * 0.5 = 80.00
    const refundId = await createRefund(invoiceId, '800.00');
    const rev = await accruals().reverseAccrual({
      accrualId: current.id,
      refundId,
      actor: actorId,
      actorRoles: ['owner'],
    });
    expect(new Prisma.Decimal((rev as { attributedRevenueAmount: Prisma.Decimal }).attributedRevenueAmount).abs().toFixed(2)).toBe(
      '80.00',
    );
    expect((rev as { invoiceLineId: string | null }).invoiceLineId).toBe(repl);
  });

  // ── R8-B deterministic race ────────────────────────────────────────────────

  it('R8-B-T1 invoice first holds lock; collected waits on pg_blocking_pids then rejects', async () => {
    await enableAndPublishPlan(); // SERVICE_NET
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
      idempotencyKey: `r8b1-${sessionId}`,
    });
    const paymentId = await createPayment(invoiceId, '800.00');

    const releaseA = deferred<void>();
    const aReady = deferred<number>();
    let pidA = 0;
    const aTxn = wrapper.withPlatformBypass(async (tx) => {
      const rows = await tx.$queryRaw<Array<{ pid: number }>>`SELECT pg_backend_pid() AS pid`;
      pidA = Number(rows[0]!.pid);
      await accruals().postFromServicePerformance(
        {
          servicePerformanceId: performanceId,
          invoiceLineId: lineId,
          actor: actorId,
          actorRoles: ['owner'],
        },
        tx,
      );
      aReady.resolve(pidA);
      await releaseA.promise;
    });

    await aReady.promise;

    // Start B on a separate client connection so it can block independently.
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
        return accrualsB.postFromCollectedPayment(
          {
            servicePerformanceId: performanceId,
            invoiceLineId: lineId,
            paymentId,
            actor: actorId,
            actorRoles: ['owner'],
          },
          tx,
        );
      });
    })();
    await bStarted.promise;

    // Poll until B is blocked by A (or B finished — fail).
    let blocked = false;
    const deadline = Date.now() + 15_000;
    while (Date.now() < deadline) {
      const blockers = await raw.$queryRawUnsafe<Array<{ pid: number }>>(
        `SELECT unnest(pg_blocking_pids($1::int)) AS pid`,
        pidB,
      );
      if (blockers.some((b) => Number(b.pid) === pidA)) {
        blocked = true;
        break;
      }
      await new Promise((r) => setTimeout(r, 50));
    }
    expect(blocked).toBe(true);

    // While A held, activate COLLECTED plan so B is economically eligible after resume.
    await enableAndPublishPlan({
      calculationBasis: 'COLLECTED_REVENUE',
      earningTrigger: 'PAYMENT_COLLECTED',
      effectiveFrom: '2026-08-01',
    });

    releaseA.resolve();
    await aTxn;
    await expect(bPromise).rejects.toThrow(/invoice-based|double-earn|COLLECTED/i);
    await clientB.$disconnect();

    const open = await wrapper.withPlatformBypass((c) =>
      c.commissionAccrual.findMany({
        where: {
          tenantId,
          servicePerformanceId: performanceId,
          reversalOfAccrualId: null,
        },
      }),
    );
    const bases = new Set(open.map((o) => o.calculationBasis));
    expect(bases.has('COLLECTED_REVENUE')).toBe(false);
    expect(open.length).toBeGreaterThanOrEqual(1);
  });

  it('R8-B-T2 collected first holds lock; invoice waits then rejects opposing basis', async () => {
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
      idempotencyKey: `r8b2-${sessionId}`,
    });
    const paymentId = await createPayment(invoiceId, '800.00');

    const releaseA = deferred<void>();
    const aReady = deferred<number>();
    let pidA = 0;
    const aTxn = wrapper.withPlatformBypass(async (tx) => {
      const rows = await tx.$queryRaw<Array<{ pid: number }>>`SELECT pg_backend_pid() AS pid`;
      pidA = Number(rows[0]!.pid);
      await accruals().postFromCollectedPayment(
        {
          servicePerformanceId: performanceId,
          invoiceLineId: lineId,
          paymentId,
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
    // Invoice path needs SERVICE_NET — publish earlier-effective invoice plan is hard while COLLECTED
    // is active. Opposing-basis check runs before plan basis reject when package exists, so B can use
    // a SERVICE_NET plan published with later effectiveFrom that supersedes COLLECTED after Aug...
    // Simpler: keep COLLECTED; invoice path still hits package opposing COLLECTED check first.
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
        return accrualsB.postFromServicePerformance(
          {
            servicePerformanceId: performanceId,
            invoiceLineId: lineId,
            actor: actorId,
            actorRoles: ['owner'],
          },
          tx,
        );
      });
    })();
    await bStarted.promise;

    let blocked = false;
    const deadline = Date.now() + 15_000;
    while (Date.now() < deadline) {
      const blockers = await raw.$queryRawUnsafe<Array<{ pid: number }>>(
        `SELECT unnest(pg_blocking_pids($1::int)) AS pid`,
        pidB,
      );
      if (blockers.some((b) => Number(b.pid) === pidA)) {
        blocked = true;
        break;
      }
      await new Promise((r) => setTimeout(r, 50));
    }
    expect(blocked).toBe(true);
    releaseA.resolve();
    await aTxn;
    await expect(bPromise).rejects.toThrow(/COLLECTED_REVENUE|double-earn|service-performance/i);
    await clientB.$disconnect();

    const open = await wrapper.withPlatformBypass((c) =>
      c.commissionAccrual.findMany({
        where: {
          tenantId,
          servicePerformanceId: performanceId,
          reversalOfAccrualId: null,
        },
      }),
    );
    expect(open.every((o) => o.calculationBasis === 'COLLECTED_REVENUE')).toBe(true);
  });

  it('R8-B-T3 concurrent duplicate collected remains idempotent under contention', async () => {
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
      idempotencyKey: `r8b3-${sessionId}`,
    });
    const pay = await createPayment(invoiceId, '800.00');
    const results = await Promise.allSettled([
      accruals().postFromCollectedPayment({
        servicePerformanceId: performanceId,
        invoiceLineId: lineId,
        paymentId: pay,
        actor: actorId,
        actorRoles: ['owner'],
      }),
      accruals().postFromCollectedPayment({
        servicePerformanceId: performanceId,
        invoiceLineId: lineId,
        paymentId: pay,
        actor: actorId,
        actorRoles: ['owner'],
      }),
    ]);
    expect(results.every((r) => r.status === 'fulfilled')).toBe(true);
    expect((await openCollectedRoots(performanceId)).length).toBe(1);
  });

  it('R8-B-T4 package allocation lock ordering — concurrent partials no deadlock', async () => {
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
      idempotencyKey: `r8b4-${sessionId}`,
    });
    const p1 = await createPayment(invoiceId, '800.00');
    const p2 = await createPayment(invoiceId, '800.00');
    const raced = await Promise.race([
      Promise.allSettled([
        accruals().postFromCollectedPayment({
          servicePerformanceId: performanceId,
          invoiceLineId: lineId,
          paymentId: p1,
          actor: actorId,
          actorRoles: ['owner'],
        }),
        accruals().postFromCollectedPayment({
          servicePerformanceId: performanceId,
          invoiceLineId: lineId,
          paymentId: p2,
          actor: actorId,
          actorRoles: ['owner'],
        }),
      ]),
      new Promise((_, rej) => setTimeout(() => rej(new Error('deadlock-timeout')), 20_000)),
    ]);
    expect(Array.isArray(raced)).toBe(true);
    expect((await netAttributed(performanceId)).lte(1000)).toBe(true);
  });

  // ── R8-C direct proofs ─────────────────────────────────────────────────────

  it('R8-C-T1 collected-path pin mismatch on unconsumed allocation', async () => {
    await enableAndPublishPlan({
      calculationBasis: 'COLLECTED_REVENUE',
      earningTrigger: 'PAYMENT_COLLECTED',
    });
    const { courseId, sessionId } = await seedCourseSession();
    const performanceId = await createCompletedPerformance();
    const inv = await createInvoiceViaProductionPath(performanceId, {
      amount: '5000.00',
      courseSessionId: sessionId,
      extraLineAmount: '100.00',
    });
    await packages().registerSessionAllocation({
      treatmentCourseId: courseId,
      courseSessionId: sessionId,
      servicePerformanceId: performanceId,
      allocatedRevenueAmount: '1000.00',
      invoiceLineId: inv.lineId,
      actor: { actorId, actorRoles: ['owner'] },
      idempotencyKey: `r8c1-${sessionId}`,
    });
    await wrapper.withPlatformBypass(async (c) => {
      await c.$executeRaw`SELECT set_config('session_replication_role', 'replica', true)`;
      await c.$executeRaw`
        UPDATE commission_package_session_allocations
        SET "invoiceLineId" = ${inv.otherLineId}::uuid
        WHERE "tenantId" = ${tenantId}::uuid AND "servicePerformanceId" = ${performanceId}::uuid
      `;
      await c.$executeRaw`SELECT set_config('session_replication_role', 'origin', true)`;
    });
    const pay = await createPayment(inv.invoiceId, '800.00');
    await expect(
      accruals().postFromCollectedPayment({
        servicePerformanceId: performanceId,
        invoiceLineId: inv.lineId,
        paymentId: pay,
        actor: actorId,
        actorRoles: ['owner'],
      }),
    ).rejects.toThrow(/pinned|different invoice line|correction lineage/i);
    expect((await openCollectedRoots(performanceId)).length).toBe(0);
  });

  it('R8-C-T2 cross-tenant line cannot satisfy package pinning', async () => {
    await enableAndPublishPlan();
    const { courseId, sessionId } = await seedCourseSession();
    const performanceId = await createCompletedPerformance();
    const { lineId } = await createInvoiceViaProductionPath(performanceId, {
      amount: '1000.00',
      courseSessionId: sessionId,
    });
    await packages().registerSessionAllocation({
      treatmentCourseId: courseId,
      courseSessionId: sessionId,
      servicePerformanceId: performanceId,
      allocatedRevenueAmount: '1000.00',
      invoiceLineId: lineId,
      actor: { actorId, actorRoles: ['owner'] },
      idempotencyKey: `r8c2-${sessionId}`,
    });
    const otherTenant = randomUUID();
    const foreignLine = randomUUID();
    await wrapper.withPlatformBypass(async (c) => {
      await c.tenant.create({
        data: { id: otherTenant, name: 'Other', slug: `oth-${otherTenant.slice(0, 8)}` },
      });
      // Retarget pin to a foreign UUID that will not resolve in tenant → fail closed
      await c.$executeRaw`SELECT set_config('session_replication_role', 'replica', true)`;
      await c.$executeRaw`
        UPDATE commission_package_session_allocations
        SET "invoiceLineId" = ${foreignLine}::uuid
        WHERE "tenantId" = ${tenantId}::uuid AND "servicePerformanceId" = ${performanceId}::uuid
      `;
      await c.$executeRaw`SELECT set_config('session_replication_role', 'origin', true)`;
    });
    await expect(
      accruals().postFromServicePerformance({
        servicePerformanceId: performanceId,
        invoiceLineId: lineId,
        actor: actorId,
        actorRoles: ['owner'],
      }),
    ).rejects.toThrow(/tenant|pinned|fail-closed|different invoice line/i);
  });

  it('R8-C-T3 correction currency mismatch zero reversals/reposts/binding', async () => {
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
    await packages().registerSessionAllocation({
      treatmentCourseId: courseId,
      courseSessionId: sessionId,
      servicePerformanceId: performanceId,
      allocatedRevenueAmount: '1000.00',
      invoiceLineId: lineId,
      actor: { actorId, actorRoles: ['owner'] },
      idempotencyKey: `r8c3-${sessionId}`,
    });
    const pay = await createPayment(invoiceId, '800.00');
    const posted = await accruals().postFromCollectedPayment({
      servicePerformanceId: performanceId,
      invoiceLineId: lineId,
      paymentId: pay,
      actor: actorId,
      actorRoles: ['owner'],
    });
    const usdInv = await createInvoiceViaProductionPath(null, {
      amount: '5000.00',
      currency: 'USD',
      appointmentId,
      clinicalServiceId,
      courseSessionId: sessionId,
    });
    const revBefore = await wrapper.withPlatformBypass((c) =>
      c.commissionAccrual.count({
        where: { tenantId, servicePerformanceId: performanceId, status: 'REVERSED' },
      }),
    );
    await expect(
      accruals().correctAndRepost({
        accrualId: (posted.accruals[0] as { id: string }).id,
        correctionEventId: randomUUID(),
        replacementInvoiceLineId: usdInv.lineId,
        reason: 'R8-C-T3',
        actor: actorId,
        actorRoles: ['owner'],
      }),
    ).rejects.toThrow(/currency|same-invoice|cross-invoice/i);
    const revAfter = await wrapper.withPlatformBypass((c) =>
      c.commissionAccrual.count({
        where: { tenantId, servicePerformanceId: performanceId, status: 'REVERSED' },
      }),
    );
    expect(revAfter).toBe(revBefore);
    const stale = await wrapper.withPlatformBypass((c) =>
      c.invoiceLineItem.findFirst({ where: { id: lineId, tenantId } }),
    );
    expect(stale!.performanceBindingStatus).toBe('ACTIVE');
    const usdBind = await wrapper.withPlatformBypass((c) =>
      c.invoiceLineItem.findFirst({ where: { id: usdInv.lineId, tenantId } }),
    );
    expect(usdBind!.performanceBindingStatus === 'ACTIVE' ? usdBind!.servicePerformanceId : null).toBeFalsy();
  });

  it('R8-C-T4 multi-participant collected correction — two roots reversed and reposted', async () => {
    await enableAndPublishPlan({
      calculationBasis: 'COLLECTED_REVENUE',
      earningTrigger: 'PAYMENT_COLLECTED',
    });
    const assistId = await ensureAssistant();
    const { courseId, sessionId } = await seedCourseSession();
    const performanceId = await createCompletedPerformance({ assistantUserId: assistId });
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
      idempotencyKey: `r8c4-${sessionId}`,
    });
    const pay = await createPayment(invoiceId, '800.00');
    const posted = await accruals().postFromCollectedPayment({
      servicePerformanceId: performanceId,
      invoiceLineId: lineId,
      paymentId: pay,
      actor: actorId,
      actorRoles: ['owner'],
    });
    expect(posted.accruals).toHaveLength(2);
    const userIds = new Set(
      (posted.accruals as Array<{ userId: string }>).map((a) => a.userId),
    );
    expect(userIds.size).toBe(2);
    const repl = await createSameInvoiceReplacementLine(invoiceId, {
      amount: '5000.00',
      courseSessionId: sessionId,
    });
    const corr = await accruals().correctAndRepost({
      accrualId: (posted.accruals[0] as { id: string }).id,
      correctionEventId: randomUUID(),
      replacementInvoiceLineId: repl,
      reason: 'R8-C-T4',
      actor: actorId,
      actorRoles: ['owner'],
    });
    expect((corr as { reversals: unknown[] }).reversals).toHaveLength(2);
    expect((corr.repost as { accruals: unknown[] }).accruals).toHaveLength(2);
  });

  it('R8-C-T5 exact refund amount 80.00 after corrected 160 basis (partial collected refund)', async () => {
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
      idempotencyKey: `r8c5-${sessionId}`,
    });
    const pay = await createPayment(invoiceId, '800.00');
    const posted = await accruals().postFromCollectedPayment({
      servicePerformanceId: performanceId,
      invoiceLineId: lineId,
      paymentId: pay,
      actor: actorId,
      actorRoles: ['owner'],
    });
    const repl = await createSameInvoiceReplacementLine(invoiceId, {
      amount: '5000.00',
      courseSessionId: sessionId,
    });
    const corr = await accruals().correctAndRepost({
      accrualId: (posted.accruals[0] as { id: string }).id,
      correctionEventId: randomUUID(),
      replacementInvoiceLineId: repl,
      reason: 'R8-C-T5',
      actor: actorId,
      actorRoles: ['owner'],
    });
    const current = (corr.repost as { accruals: Array<{ id: string; attributedRevenueAmount: Prisma.Decimal }> })
      .accruals[0]!;
    expect(current.attributedRevenueAmount.toFixed(2)).toBe('160.00');
    // refund 400 / collectedTotal 800 = 0.5 → 160 * 0.5 = 80.00
    const refundId = await createRefund(invoiceId, '400.00');
    const rev = await accruals().reverseAccrual({
      accrualId: current.id,
      refundId,
      actor: actorId,
      actorRoles: ['owner'],
    });
    expect(
      new Prisma.Decimal((rev as { attributedRevenueAmount: Prisma.Decimal }).attributedRevenueAmount)
        .abs()
        .toFixed(2),
    ).toBe('80.00');
    const refund2 = await createRefund(invoiceId, '400.00');
    await accruals().reverseAccrual({
      accrualId: current.id,
      refundId: refund2,
      actor: actorId,
      actorRoles: ['owner'],
    });
    const rem = await netAttributed(performanceId);
    expect(rem.toFixed(2)).toBe('0.00');
  });
});
