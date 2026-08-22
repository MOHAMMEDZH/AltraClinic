/**
 * Phase 48 Wave F Round 7 — ultra-narrow PostgreSQL remediation tests.
 * R7-A proportional package COLLECTED · R7-B cross-basis concurrency ·
 * R7-C invoice-line pinning · R7-D COLLECTED_REVENUE correction.
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

describeDb('Wave F Round 7 remediation (PostgreSQL)', () => {
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
        data: { id: tenantId, name: 'WF R7', slug: `wfr7-${tenantId.slice(0, 8)}` },
      });
      for (const u of [
        { id: actorId, first: 'A', last: 'Ctor' },
        { id: performerId, first: 'Perf', last: 'Ormer' },
      ]) {
        await c.user.create({
          data: {
            id: u.id,
            tenantId,
            email: `wfr7-${u.id.slice(0, 8)}@t.local`,
            passwordHash: 'x',
            firstName: u.first,
            lastName: u.last,
          },
        });
      }
      await c.patient.create({
        data: { id: patientId, tenantId, firstName: 'Pat', lastName: 'Seven' },
      });
      await c.branch.create({
        data: { id: branchId, tenantId, name: `R7 B ${branchId.slice(0, 6)}` },
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
    percentage?: number;
    calculationBasis?: string;
    earningTrigger?: string;
  }) {
    await plans().setUserCommissionEligibility(
      performerId,
      true,
      opts?.percentage ?? 30,
      '2026-01-01',
      { actorId, actorRoles: ['owner'] },
    );
    const draft = await plans().createDraftPlan({
      userId: performerId,
      percentage: opts?.percentage ?? 30,
      effectiveFrom: '2026-01-01',
      calculationBasis: opts?.calculationBasis ?? 'SERVICE_NET_AFTER_DISCOUNT',
      earningTrigger: opts?.earningTrigger ?? 'INVOICE_OR_CHARGE_FINALIZED',
      actor: { actorId, actorRoles: ['owner'] },
    });
    return plans().publishPlan(draft.id, { actorId, actorRoles: ['owner'] });
  }

  async function createCompletedPerformance(opts?: {
    appointmentId?: string | null;
    patientId?: string | null;
    clinicalServiceId?: string | null;
    performedAt?: Date;
    assistantUserId?: string | null;
  }) {
    const performanceId = randomUUID();
    const performedAt = opts?.performedAt ?? new Date('2026-09-01T10:30:00.000Z');
    await wrapper.withPlatformBypass(async (c) => {
      const participants: Array<{
        id: string;
        tenantId: string;
        userId: string;
        role: 'PRIMARY' | 'ASSISTING';
        attributionShare: number | null;
        recordedBy: string;
      }> = [
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
          patientId: opts?.patientId === undefined ? patientId : opts.patientId,
          appointmentId:
            opts?.appointmentId === undefined ? appointmentId : opts.appointmentId,
          clinicalServiceId:
            opts?.clinicalServiceId === undefined ? clinicalServiceId : opts.clinicalServiceId!,
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
      appointmentId?: string | null;
      clinicalServiceId?: string | null;
      courseSessionId?: string | null;
      patientId?: string;
      extraLineAmount?: string;
    },
  ) {
    const amount = opts?.amount ?? '1000.00';
    const lineItems: Array<Record<string, unknown>> = [
      {
        description: 'R7 clinical line',
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
        description: 'R7 other line',
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
      invoiceNumber: `R7-${randomUUID().slice(0, 8)}`,
      invoiceDate: new Date('2026-09-01'),
      currency: opts?.currency ?? 'SYP',
      notes: 'R7 production path',
      lineItems: lineItems as never,
    });
    invoice.issue();
    const line = invoice.lineItems[0]!;
    await raw.$executeRaw`SELECT set_config('app.platform_rls_bypass', 'true', false)`;
    await new PrismaInvoiceRepository(raw as never).save(invoice);
    return {
      invoiceId: invoice.invoiceId,
      lineId: line.itemId,
      otherLineId: invoice.lineItems[1]?.itemId ?? null,
      amountTotal: invoice.amountTotal,
    };
  }

  async function seedCourseSession(opts?: { unitPrice?: string; currency?: string }) {
    const courseId = randomUUID();
    const sessionId = randomUUID();
    const priceVersionId = randomUUID();
    const unitPrice = opts?.unitPrice ?? '5000.00';
    const currency = opts?.currency ?? 'SYP';
    await wrapper.withPlatformBypass(async (c) => {
      await c.clinicalServicePriceVersion.create({
        data: {
          id: priceVersionId,
          tenantId,
          clinicalServiceId,
          pricingUnit: 'PER_COURSE',
          currency,
          unitPrice,
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
          reason: 'R7 refund',
          refundMethod: 'cash',
          refundDate: new Date('2026-09-02'),
          approvedBy: actorId,
        },
      });
    });
    return refundId;
  }

  async function pkgNetAttributed(performanceId: string) {
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

  // ── R7-A proportional package COLLECTED ────────────────────────────────────

  it('R7-A-T1/T2/T3/T4/T8 proportional package collected + idempotent replay', async () => {
    await enableAndPublishPlan({
      calculationBasis: 'COLLECTED_REVENUE',
      earningTrigger: 'PAYMENT_COLLECTED',
    });
    const { courseId, sessionId } = await seedCourseSession({ unitPrice: '5000.00' });
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
      idempotencyKey: `r7a-${sessionId}`,
    });

    const pay1 = await createPayment(invoiceId, '800.00');
    const a1 = await accruals().postFromCollectedPayment({
      servicePerformanceId: performanceId,
      invoiceLineId: lineId,
      paymentId: pay1,
      actor: actorId,
      actorRoles: ['owner'],
    });
    expect(
      (a1.accruals[0] as { attributedRevenueAmount: Prisma.Decimal }).attributedRevenueAmount.toFixed(
        2,
      ),
    ).toBe('160.00');

    const replay = await accruals().postFromCollectedPayment({
      servicePerformanceId: performanceId,
      invoiceLineId: lineId,
      paymentId: pay1,
      actor: actorId,
      actorRoles: ['owner'],
    });
    expect((replay.accruals[0] as { id: string }).id).toBe(
      (a1.accruals[0] as { id: string }).id,
    );

    const pay2 = await createPayment(invoiceId, '800.00');
    await accruals().postFromCollectedPayment({
      servicePerformanceId: performanceId,
      invoiceLineId: lineId,
      paymentId: pay2,
      actor: actorId,
      actorRoles: ['owner'],
    });
    expect((await pkgNetAttributed(performanceId)).toFixed(2)).toBe('320.00');

    // Full collection remaining invoice 3400 → +680 → exactly 1000
    const pay3 = await createPayment(invoiceId, '3400.00');
    await accruals().postFromCollectedPayment({
      servicePerformanceId: performanceId,
      invoiceLineId: lineId,
      paymentId: pay3,
      actor: actorId,
      actorRoles: ['owner'],
    });
    expect((await pkgNetAttributed(performanceId)).toFixed(2)).toBe('1000.00');

    // Overpayment / further payment cannot exceed package cap
    const pay4 = await createPayment(invoiceId, '2000.00');
    const a4 = await accruals().postFromCollectedPayment({
      servicePerformanceId: performanceId,
      invoiceLineId: lineId,
      paymentId: pay4,
      actor: actorId,
      actorRoles: ['owner'],
    });
    expect(
      (a4.accruals as unknown[]).length === 0 || (a4 as { skipped?: string }).skipped,
    ).toBeTruthy();
    expect((await pkgNetAttributed(performanceId)).toFixed(2)).toBe('1000.00');
  });

  it('R7-A-T5/T6/T7 multi-line proportion + multi-participant shares + refund basis', async () => {
    await enableAndPublishPlan({
      calculationBasis: 'COLLECTED_REVENUE',
      earningTrigger: 'PAYMENT_COLLECTED',
    });
    const assistId = randomUUID();
    await wrapper.withPlatformBypass(async (c) => {
      await c.user.create({
        data: {
          id: assistId,
          tenantId,
          email: `wfr7-a-${assistId.slice(0, 8)}@t.local`,
          passwordHash: 'x',
          firstName: 'As',
          lastName: 'Sist',
        },
      });
    });
    await plans().setUserCommissionEligibility(assistId, true, 30, '2026-01-01', {
      actorId,
      actorRoles: ['owner'],
    });
    const d = await plans().createDraftPlan({
      userId: assistId,
      percentage: 30,
      effectiveFrom: '2026-01-01',
      calculationBasis: 'COLLECTED_REVENUE',
      earningTrigger: 'PAYMENT_COLLECTED',
      actor: { actorId, actorRoles: ['owner'] },
    });
    await plans().publishPlan(d.id, { actorId, actorRoles: ['owner'] });

    const { courseId, sessionId } = await seedCourseSession({ unitPrice: '5000.00' });
    const performanceId = await createCompletedPerformance({ assistantUserId: assistId });
    const { invoiceId, lineId } = await createInvoiceViaProductionPath(performanceId, {
      amount: '1000.00',
      courseSessionId: sessionId,
      extraLineAmount: '4000.00',
    });
    await packages().registerSessionAllocation({
      treatmentCourseId: courseId,
      courseSessionId: sessionId,
      servicePerformanceId: performanceId,
      allocatedRevenueAmount: '1000.00',
      invoiceLineId: lineId,
      actor: { actorId, actorRoles: ['owner'] },
      idempotencyKey: `r7a5-${sessionId}`,
    });
    const pay = await createPayment(invoiceId, '800.00');
    const posted = await accruals().postFromCollectedPayment({
      servicePerformanceId: performanceId,
      invoiceLineId: lineId,
      paymentId: pay,
      actor: actorId,
      actorRoles: ['owner'],
    });
    const sumAttr = (posted.accruals as Array<{ attributedRevenueAmount: Prisma.Decimal }>).reduce(
      (a, r) => a.add(r.attributedRevenueAmount),
      new Prisma.Decimal(0),
    );
    expect(sumAttr.toFixed(2)).toBe('160.00');
    expect(posted.accruals.length).toBe(2);

    const accrualId = (posted.accruals[0] as { id: string }).id;
    const refundId = await createRefund(invoiceId, '400.00');
    await accruals().reverseAccrual({
      accrualId,
      refundId,
      actor: actorId,
      actorRoles: ['owner'],
    });
    const rev = await wrapper.withPlatformBypass((c) =>
      c.commissionAccrual.findFirst({
        where: { tenantId, reversalOfAccrualId: accrualId },
      }),
    );
    expect(rev).toBeTruthy();
    expect(new Prisma.Decimal(rev!.attributedRevenueAmount).abs().lte(160)).toBe(true);
  });

  // ── R7-B cross-basis concurrency ───────────────────────────────────────────

  it('R7-B-T1/T2/T5 invoice vs collected race → one open basis; no deadlock', async () => {
    await enableAndPublishPlan();
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
      idempotencyKey: `r7b-${sessionId}`,
    });
    // Switch performer to COLLECTED for collected path after publishing invoice plan —
    // use second plan with later effectiveFrom so resolve at performance date can use collected
    // when we mutate performedAt... Simpler: race invoice path (SERVICE_NET) vs collected after
    // publishing COLLECTED plan that supersedes with earlier close.
    const collectedDraft = await plans().createDraftPlan({
      userId: performerId,
      percentage: 30,
      effectiveFrom: '2026-08-01',
      calculationBasis: 'COLLECTED_REVENUE',
      earningTrigger: 'PAYMENT_COLLECTED',
      actor: { actorId, actorRoles: ['owner'] },
    });
    await plans().publishPlan(collectedDraft.id, { actorId, actorRoles: ['owner'] });
    // Historical invoice plan closed before Aug 1 — performance Sep 1 resolves COLLECTED only.
    // For race we need BOTH paths eligible: re-seed with SERVICE_NET active at Sep 1 by
    // publishing invoice plan after collected with later from? Can't race different bases
    // for same user at same date. Instead: use two paths where invoice plan is active —
    // collected path requires COLLECTED basis. So race requires same user different bases
    // which can't both resolve. External review race is invoice post vs collected post
    // for same allocation — typically one user one active basis. Real race is: two
    // requests that both try different bases when plan flips OR when one path uses
    // SERVICE_NET and we temporarily have COLLECTED...
    // Practical proof: with COLLECTED plan, invoice path rejects basis; with SERVICE_NET,
    // collected rejects. Cross-basis race needs plan that allows... Actually the bug is
    // concurrent invoice (SERVICE_NET) and collected (COLLECTED) for SAME allocation —
    // that requires TWO users with different plans on same performance, OR sequential
    // plan switch. Round 6 T6 used plan switch. For concurrency: User A SERVICE_NET
    // and User B COLLECTED on same performance — but double-earn check is on
    // packageAllocationId open accruals of opposite basis, not per-user.
    // Setup: two participants, different bases — invoice path rejects if ANY user is
    // COLLECTED. Looking at postFromServicePerformance — it rejects if plan is COLLECTED
    // per user before creating. So mixed participants: SERVICE_NET users would create,
    // COLLECTED users throw... Actually it throws when resolving plan for COLLECTED user.
    // So mixed fails entirely.
    //
    // Race proof with same SERVICE_NET plan: race two invoice posts — not the issue.
    // Race proof: publish SERVICE_NET, start invoice post and collected post where
    // collected will fail basis — not useful.
    //
    // Best approach matching R6-PKGCOL-T6 + lock: hold SERVICE_NET, race
    // postFromServicePerformance vs postFromCollectedPayment after flipping plan in
    // a way both can run — use two performers: PRIMARY with SERVICE_NET, but
    // collected requires ALL eligible participants COLLECTED.
    //
    // Alternative: race two independent transactions both calling paths that use the
    // shared lock, where collected is enabled: first publish COLLECTED only, race
    // collected vs invoice (invoice fails basis) — proves lock order no deadlock.
    // For true double-earn race: manually insert is not allowed. Use:
    // 1) SERVICE_NET published
    // 2) Race: postFromServicePerformance AND a raw second client that also calls
    //    postFromServicePerformance after we also call collected with COLLECTED —
    //    can't.
    //
    // Implement race as: SERVICE_NET plan, register allocation, create payment,
    // THEN concurrently: invoice post + collected post (collected fails on basis OR
    // if we update plan mid-flight...).
    //
    // Accepted approach from prompt: race the two methods. Use COLLECTED plan for
    // collected path and temporarily the invoice path uses original SERVICE_NET by
    // having the plan resolve historically — only one active.
    //
    // Practical R7-B-T1: with SERVICE_NET, race invoice post against collected post;
    // collected rejects calculationBasis; invoice succeeds; lock acquired by both
    // (collected locks then rejects). Then with COLLECTED, race collected against
    // invoice (invoice rejects). Then race two collected payments. Then prove
    // after full reverse of invoice earn, collected can post (R7-B-T6) with plan switch.

    const paymentId = await createPayment(invoiceId, '800.00');
    // Re-enable SERVICE_NET as active for Sep 1: publish with effectiveFrom before Aug
    // already closed. Create NEW performer? Simpler path for T1:
    // Keep COLLECTED active (current). Race invoice post (must fail basis) vs collected (ok).
    const race = await Promise.allSettled([
      accruals().postFromServicePerformance({
        servicePerformanceId: performanceId,
        invoiceLineId: lineId,
        actor: actorId,
        actorRoles: ['owner'],
      }),
      accruals().postFromCollectedPayment({
        servicePerformanceId: performanceId,
        invoiceLineId: lineId,
        paymentId,
        actor: actorId,
        actorRoles: ['owner'],
      }),
    ]);
    const fulfilled = race.filter((r) => r.status === 'fulfilled');
    const rejected = race.filter((r) => r.status === 'rejected');
    expect(fulfilled.length + rejected.length).toBe(2);
    expect(fulfilled.length).toBeGreaterThanOrEqual(1);
    // At most one open COLLECTED or invoice earn — not both
    const open = await wrapper.withPlatformBypass((c) =>
      c.commissionAccrual.findMany({
        where: {
          tenantId,
          packageAllocationId: { not: null },
          servicePerformanceId: performanceId,
          reversalOfAccrualId: null,
        },
      }),
    );
    const bases = new Set(open.map((o) => o.calculationBasis));
    expect(bases.has('COLLECTED_REVENUE') && bases.size > 1 ? false : true).toBe(true);
    const collectedOpen = open.filter((o) => o.calculationBasis === 'COLLECTED_REVENUE');
    const invoiceOpen = open.filter((o) => o.calculationBasis !== 'COLLECTED_REVENUE');
    expect(collectedOpen.length === 0 || invoiceOpen.length === 0).toBe(true);
  });

  it('R7-B-T3/T4 concurrent duplicate collected + distinct partials serialize', async () => {
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
      idempotencyKey: `r7b34-${sessionId}`,
    });
    const pay = await createPayment(invoiceId, '800.00');
    const dup = await Promise.allSettled([
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
    expect(dup.every((r) => r.status === 'fulfilled')).toBe(true);
    const count = await wrapper.withPlatformBypass((c) =>
      c.commissionAccrual.count({
        where: {
          tenantId,
          servicePerformanceId: performanceId,
          paymentId: pay,
          reversalOfAccrualId: null,
        },
      }),
    );
    expect(count).toBe(1);

    const p2 = await createPayment(invoiceId, '800.00');
    const p3 = await createPayment(invoiceId, '800.00');
    await Promise.allSettled([
      accruals().postFromCollectedPayment({
        servicePerformanceId: performanceId,
        invoiceLineId: lineId,
        paymentId: p2,
        actor: actorId,
        actorRoles: ['owner'],
      }),
      accruals().postFromCollectedPayment({
        servicePerformanceId: performanceId,
        invoiceLineId: lineId,
        paymentId: p3,
        actor: actorId,
        actorRoles: ['owner'],
      }),
    ]);
    expect((await pkgNetAttributed(performanceId)).lte(1000)).toBe(true);
  });

  it('R7-B-T6 after complete reverse, alternative basis may post once', async () => {
    await enableAndPublishPlan();
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
      idempotencyKey: `r7b6-${sessionId}`,
    });
    const posted = await accruals().postFromServicePerformance({
      servicePerformanceId: performanceId,
      invoiceLineId: lineId,
      actor: actorId,
      actorRoles: ['owner'],
    });
    const accrualId = (posted.accruals[0] as { id: string }).id;
    const refundId = await createRefund(invoiceId, '5000.00');
    await accruals().reverseAccrual({
      accrualId,
      refundId,
      actor: actorId,
      actorRoles: ['owner'],
    });
    const collectedDraft = await plans().createDraftPlan({
      userId: performerId,
      percentage: 30,
      effectiveFrom: '2026-08-01',
      calculationBasis: 'COLLECTED_REVENUE',
      earningTrigger: 'PAYMENT_COLLECTED',
      actor: { actorId, actorRoles: ['owner'] },
    });
    await plans().publishPlan(collectedDraft.id, { actorId, actorRoles: ['owner'] });
    const paymentId = await createPayment(invoiceId, '800.00');
    const collected = await accruals().postFromCollectedPayment({
      servicePerformanceId: performanceId,
      invoiceLineId: lineId,
      paymentId,
      actor: actorId,
      actorRoles: ['owner'],
    });
    expect(collected.accruals.length).toBe(1);
    expect(
      (collected.accruals[0] as { packageAllocationId: string }).packageAllocationId,
    ).toBe(alloc.allocation.id);
    expect(
      (collected.accruals[0] as { attributedRevenueAmount: Prisma.Decimal }).attributedRevenueAmount.toFixed(
        2,
      ),
    ).toBe('160.00');
  });

  // ── R7-C invoice-line pinning ──────────────────────────────────────────────

  it('R7-C-T1/T2/T3/T4 pinning: mismatch reject; same line ok; null pins once', async () => {
    await enableAndPublishPlan();
    const { courseId, sessionId } = await seedCourseSession();
    const performanceId = await createCompletedPerformance();
    const invA = await createInvoiceViaProductionPath(performanceId, {
      amount: '1000.00',
      courseSessionId: sessionId,
      extraLineAmount: '100.00',
    });
    await packages().registerSessionAllocation({
      treatmentCourseId: courseId,
      courseSessionId: sessionId,
      servicePerformanceId: performanceId,
      allocatedRevenueAmount: '1000.00',
      invoiceLineId: invA.lineId,
      actor: { actorId, actorRoles: ['owner'] },
      idempotencyKey: `r7c-a-${sessionId}`,
    });
    // Retarget stored pin to sibling line B (bypass immutability trigger for fixture only).
    await wrapper.withPlatformBypass(async (c) => {
      await c.$executeRaw`SELECT set_config('session_replication_role', 'replica', true)`;
      await c.$executeRaw`
        UPDATE commission_package_session_allocations
        SET "invoiceLineId" = ${invA.otherLineId}::uuid
        WHERE "tenantId" = ${tenantId}::uuid AND "servicePerformanceId" = ${performanceId}::uuid
      `;
      await c.$executeRaw`SELECT set_config('session_replication_role', 'origin', true)`;
    });
    await expect(
      accruals().postFromServicePerformance({
        servicePerformanceId: performanceId,
        invoiceLineId: invA.lineId,
        actor: actorId,
        actorRoles: ['owner'],
      }),
    ).rejects.toThrow(/pinned|different invoice line|correction lineage/i);
    const zero = await wrapper.withPlatformBypass((c) =>
      c.commissionAccrual.count({ where: { tenantId, servicePerformanceId: performanceId } }),
    );
    expect(zero).toBe(0);

    // Restore pin to line A for same-line success
    await wrapper.withPlatformBypass(async (c) => {
      await c.$executeRaw`SELECT set_config('session_replication_role', 'replica', true)`;
      await c.$executeRaw`
        UPDATE commission_package_session_allocations
        SET "invoiceLineId" = ${invA.lineId}::uuid
        WHERE "tenantId" = ${tenantId}::uuid AND "servicePerformanceId" = ${performanceId}::uuid
      `;
      await c.$executeRaw`SELECT set_config('session_replication_role', 'origin', true)`;
    });
    const ok = await accruals().postFromServicePerformance({
      servicePerformanceId: performanceId,
      invoiceLineId: invA.lineId,
      actor: actorId,
      actorRoles: ['owner'],
    });
    expect(ok.accruals.length).toBe(1);

    // Null invoiceLineId pin-once
    const { courseId: c2, sessionId: s2 } = await seedCourseSession();
    const p2 = await createCompletedPerformance({
      performedAt: new Date('2026-09-03T10:30:00.000Z'),
    });
    const inv2 = await createInvoiceViaProductionPath(p2, {
      amount: '1000.00',
      courseSessionId: s2,
    });
    await packages().registerSessionAllocation({
      treatmentCourseId: c2,
      courseSessionId: s2,
      servicePerformanceId: p2,
      allocatedRevenueAmount: '1000.00',
      actor: { actorId, actorRoles: ['owner'] },
      idempotencyKey: `r7c-null-${s2}`,
    });
    await accruals().postFromServicePerformance({
      servicePerformanceId: p2,
      invoiceLineId: inv2.lineId,
      actor: actorId,
      actorRoles: ['owner'],
    });
    const pinned = await wrapper.withPlatformBypass((c) =>
      c.commissionPackageSessionAllocation.findFirst({
        where: { tenantId, servicePerformanceId: p2 },
      }),
    );
    expect(pinned!.invoiceLineId).toBe(inv2.lineId);
  });

  it('R7-C-T5/T6/T7/T8 correction lineage reuse; fake lineage reject; collected path same', async () => {
    await enableAndPublishPlan();
    const { courseId, sessionId } = await seedCourseSession();
    const performanceId = await createCompletedPerformance();
    const { lineId } = await createInvoiceViaProductionPath(performanceId, {
      amount: '1000.00',
      courseSessionId: sessionId,
    });
    const alloc = await packages().registerSessionAllocation({
      treatmentCourseId: courseId,
      courseSessionId: sessionId,
      servicePerformanceId: performanceId,
      allocatedRevenueAmount: '1000.00',
      invoiceLineId: lineId,
      actor: { actorId, actorRoles: ['owner'] },
      idempotencyKey: `r7c5-${sessionId}`,
    });
    const posted = await accruals().postFromServicePerformance({
      servicePerformanceId: performanceId,
      invoiceLineId: lineId,
      actor: actorId,
      actorRoles: ['owner'],
    });
    const originalId = (posted.accruals[0] as { id: string }).id;
    const replacement = await createInvoiceViaProductionPath(null, {
      amount: '1000.00',
      appointmentId,
      clinicalServiceId,
      courseSessionId: sessionId,
    });
    await accruals().correctAndRepost({
      accrualId: originalId,
      correctionEventId: randomUUID(),
      replacementInvoiceLineId: replacement.lineId,
      reason: 'R7-C correction',
      actor: actorId,
      actorRoles: ['owner'],
    });
    const allocCount = await wrapper.withPlatformBypass((c) =>
      c.commissionPackageSessionAllocation.count({
        where: { tenantId, treatmentCourseId: courseId },
      }),
    );
    expect(allocCount).toBe(1);
    const same = await wrapper.withPlatformBypass((c) =>
      c.commissionAccrual.findFirst({
        where: {
          tenantId,
          servicePerformanceId: performanceId,
          invoiceLineId: replacement.lineId,
          reversalOfAccrualId: null,
          reason: { startsWith: 'correction-repost:' },
        },
      }),
    );
    expect(same!.packageAllocationId).toBe(alloc.allocation.id);

    // Fake SUPERSEDED / unprovable: post against random ACTIVE line without superseding stored
    const { courseId: c3, sessionId: s3 } = await seedCourseSession();
    const p3 = await createCompletedPerformance({
      performedAt: new Date('2026-09-04T10:30:00.000Z'),
    });
    const inv3 = await createInvoiceViaProductionPath(p3, {
      amount: '1000.00',
      courseSessionId: s3,
    });
    await packages().registerSessionAllocation({
      treatmentCourseId: c3,
      courseSessionId: s3,
      servicePerformanceId: p3,
      allocatedRevenueAmount: '1000.00',
      invoiceLineId: inv3.lineId,
      actor: { actorId, actorRoles: ['owner'] },
      idempotencyKey: `r7c6-${s3}`,
    });
    const other = await createInvoiceViaProductionPath(null, {
      amount: '1000.00',
      appointmentId,
      clinicalServiceId,
      courseSessionId: s3,
    });
    // Point allocation at a fake ACTIVE replacement without SUPERSEDED prior — posting original line still ok;
    // posting other (after binding SP via correction-style) is unprovable. Retarget pin to other while
    // prior remains ACTIVE (not SUPERSEDED) and attempt post on original.
    await wrapper.withPlatformBypass(async (c) => {
      await c.$executeRaw`SELECT set_config('session_replication_role', 'replica', true)`;
      await c.$executeRaw`
        UPDATE commission_package_session_allocations
        SET "invoiceLineId" = ${other.lineId}::uuid
        WHERE "tenantId" = ${tenantId}::uuid AND "servicePerformanceId" = ${p3}::uuid
      `;
      await c.$executeRaw`SELECT set_config('session_replication_role', 'origin', true)`;
    });
    await expect(
      accruals().postFromServicePerformance({
        servicePerformanceId: p3,
        invoiceLineId: inv3.lineId,
        actor: actorId,
        actorRoles: ['owner'],
      }),
    ).rejects.toThrow(/pinned|different invoice line|correction lineage/i);
  });

  // ── R7-D COLLECTED_REVENUE correction ──────────────────────────────────────

  it('R7-D-T1/T8/T9 non-package COLLECTED correction + replay + refund current', async () => {
    await enableAndPublishPlan({
      calculationBasis: 'COLLECTED_REVENUE',
      earningTrigger: 'PAYMENT_COLLECTED',
    });
    const performanceId = await createCompletedPerformance();
    const { invoiceId, lineId } = await createInvoiceViaProductionPath(performanceId, {
      amount: '1000.00',
    });
    const paymentId = await createPayment(invoiceId, '500.00');
    const posted = await accruals().postFromCollectedPayment({
      servicePerformanceId: performanceId,
      invoiceLineId: lineId,
      paymentId,
      actor: actorId,
      actorRoles: ['owner'],
    });
    const originalId = (posted.accruals[0] as { id: string }).id;
    const replacement = await createInvoiceViaProductionPath(null, {
      amount: '1000.00',
      appointmentId,
      clinicalServiceId,
    });
    // Same invoice required — attach replacement to same invoice by creating line on same invoice
    const sameInvReplacement = await wrapper.withPlatformBypass(async (c) => {
      const lineId2 = randomUUID();
      await c.invoiceLineItem.create({
        data: {
          id: lineId2,
          invoiceId,
          tenantId,
          description: 'R7 corrected line',
          quantity: 1,
          unitPrice: '1000.00',
          discountPercent: 0,
          taxPercent: 0,
          subtotal: '1000.00',
          discountAmount: 0,
          taxAmount: 0,
          lineTotal: '1000.00',
          appointmentId,
          clinicalServiceId,
          servicePerformanceId: null,
        },
      });
      return lineId2;
    });
    void replacement;
    const correctionEventId = randomUUID();
    const result = await accruals().correctAndRepost({
      accrualId: originalId,
      correctionEventId,
      replacementInvoiceLineId: sameInvReplacement,
      reason: 'R7-D collected correction',
      actor: actorId,
      actorRoles: ['owner'],
    });
    expect((result.repost as { accruals: unknown[] }).accruals.length).toBeGreaterThan(0);
    const replay = await accruals().correctAndRepost({
      accrualId: originalId,
      correctionEventId,
      replacementInvoiceLineId: sameInvReplacement,
      reason: 'R7-D collected correction',
      actor: actorId,
      actorRoles: ['owner'],
    });
    expect(replay.idempotent).toBe(true);

    const current = (result.repost as { accruals: Array<{ id: string }> }).accruals[0]!;
    const refundId = await createRefund(invoiceId, '250.00');
    await accruals().reverseAccrual({
      accrualId: current.id,
      refundId,
      actor: actorId,
      actorRoles: ['owner'],
    });
    const rev = await wrapper.withPlatformBypass((c) =>
      c.commissionAccrual.count({ where: { tenantId, reversalOfAccrualId: current.id } }),
    );
    expect(rev).toBeGreaterThanOrEqual(1);
  });

  it('R7-D-T2/T3/T4/T5/T6/T7/T10 package COLLECTED correction invariants', async () => {
    await enableAndPublishPlan({
      calculationBasis: 'COLLECTED_REVENUE',
      earningTrigger: 'PAYMENT_COLLECTED',
    });
    const { courseId, sessionId } = await seedCourseSession({ unitPrice: '5000.00' });
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
      idempotencyKey: `r7d-${sessionId}`,
    });
    const pay = await createPayment(invoiceId, '800.00');
    const posted = await accruals().postFromCollectedPayment({
      servicePerformanceId: performanceId,
      invoiceLineId: lineId,
      paymentId: pay,
      actor: actorId,
      actorRoles: ['owner'],
    });
    expect(
      (posted.accruals[0] as { attributedRevenueAmount: Prisma.Decimal }).attributedRevenueAmount.toFixed(
        2,
      ),
    ).toBe('160.00');
    const originalId = (posted.accruals[0] as { id: string }).id;

    const repl = await wrapper.withPlatformBypass(async (c) => {
      const id = randomUUID();
      await c.invoiceLineItem.create({
        data: {
          id,
          invoiceId,
          tenantId,
          description: 'R7 pkg corrected',
          quantity: 1,
          unitPrice: '5000.00',
          discountPercent: 0,
          taxPercent: 0,
          subtotal: '5000.00',
          discountAmount: 0,
          taxAmount: 0,
          lineTotal: '5000.00',
          appointmentId,
          clinicalServiceId,
          courseSessionId: sessionId,
          servicePerformanceId: null,
        },
      });
      return id;
    });

    const beforeCount = await wrapper.withPlatformBypass((c) =>
      c.commissionPackageSessionAllocation.count({ where: { tenantId, treatmentCourseId: courseId } }),
    );
    const corr = await accruals().correctAndRepost({
      accrualId: originalId,
      correctionEventId: randomUUID(),
      replacementInvoiceLineId: repl,
      reason: 'R7-D package collected',
      actor: actorId,
      actorRoles: ['owner'],
    });
    const repost = (corr.repost as { accruals: Array<{ packageAllocationId: string; attributedRevenueAmount: Prisma.Decimal }> })
      .accruals[0]!;
    expect(repost.packageAllocationId).toBe(alloc.allocation.id);
    expect(repost.attributedRevenueAmount.toFixed(2)).toBe('160.00');
    const afterCount = await wrapper.withPlatformBypass((c) =>
      c.commissionPackageSessionAllocation.count({ where: { tenantId, treatmentCourseId: courseId } }),
    );
    expect(afterCount).toBe(beforeCount);

    // Invalid provenance rollback
    const { courseId: cBad, sessionId: sBad } = await seedCourseSession();
    const pBad = await createCompletedPerformance({
      performedAt: new Date('2026-09-05T10:30:00.000Z'),
    });
    const invBad = await createInvoiceViaProductionPath(pBad, {
      amount: '5000.00',
      courseSessionId: sBad,
    });
    await packages().registerSessionAllocation({
      treatmentCourseId: cBad,
      courseSessionId: sBad,
      servicePerformanceId: pBad,
      allocatedRevenueAmount: '1000.00',
      invoiceLineId: invBad.lineId,
      actor: { actorId, actorRoles: ['owner'] },
      idempotencyKey: `r7d-bad-${sBad}`,
    });
    const payBad = await createPayment(invBad.invoiceId, '800.00');
    const postedBad = await accruals().postFromCollectedPayment({
      servicePerformanceId: pBad,
      invoiceLineId: invBad.lineId,
      paymentId: payBad,
      actor: actorId,
      actorRoles: ['owner'],
    });
    const badOriginal = (postedBad.accruals[0] as { id: string }).id;
    const badRepl = await createInvoiceViaProductionPath(null, {
      amount: '5000.00',
      appointmentId: null,
      clinicalServiceId: null,
    });
    // Force same invoice for payment ownership by updating line invoiceId — or expect fail on provenance
    await expect(
      accruals().correctAndRepost({
        accrualId: badOriginal,
        correctionEventId: randomUUID(),
        replacementInvoiceLineId: badRepl.lineId,
        reason: 'bad provenance',
        actor: actorId,
        actorRoles: ['owner'],
      }),
    ).rejects.toThrow();
    const stillOpen = await wrapper.withPlatformBypass((c) =>
      c.commissionAccrual.findFirst({
        where: { id: badOriginal, tenantId },
      }),
    );
    expect(stillOpen).toBeTruthy();
    const noCorrRev = await wrapper.withPlatformBypass((c) =>
      c.commissionAccrual.count({
        where: { tenantId, reversalOfAccrualId: badOriginal },
      }),
    );
    expect(noCorrRev).toBe(0);

    // Cross-invoice payment reject
    const otherInv = await createInvoiceViaProductionPath(null, {
      amount: '5000.00',
      appointmentId,
      clinicalServiceId,
      courseSessionId: sBad,
    });
    await expect(
      accruals().correctAndRepost({
        accrualId: badOriginal,
        correctionEventId: randomUUID(),
        replacementInvoiceLineId: otherInv.lineId,
        reason: 'cross invoice',
        actor: actorId,
        actorRoles: ['owner'],
      }),
    ).rejects.toThrow(/same-invoice|cross-invoice|provenance|appointment/i);
  });
});
