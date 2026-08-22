/**
 * Phase 48 Wave F Round 3 remediation — focused PostgreSQL integration tests.
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
import { Invoice } from '../../billing/domain/entities/invoice.entity';
import { PrismaInvoiceRepository } from '../../billing/infrastructure/prisma-invoice.repository';
import { CommissionAccrualService } from '../services/commission-accrual.service';
import { StaffCommissionPlanService } from '../services/staff-commission-plan.service';
import {
  InvoiceLinePerformanceAttributionService,
  resolveAuthoritativeServicePerformanceForAppointment,
} from '../services/invoice-line-performance-attribution.service';

jest.setTimeout(300_000);
const describeDb = platformDbSecurityEnabled() ? describe : describe.skip;

describeDb('Wave F Round 3 remediation (PostgreSQL)', () => {
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
  function binder() {
    return new InvoiceLinePerformanceAttributionService(
      wrapper as never,
      tenantContext as never,
      audit as never,
    );
  }

  async function seed() {
    await wrapper.withPlatformBypass(async (c) => {
      await c.tenant.create({
        data: { id: tenantId, name: 'WF R3', slug: `wfr3-${tenantId.slice(0, 8)}` },
      });
      for (const u of [
        { id: actorId, first: 'A', last: 'Ctor' },
        { id: performerId, first: 'Perf', last: 'Ormer' },
      ]) {
        await c.user.create({
          data: {
            id: u.id,
            tenantId,
            email: `wfr3-${u.id.slice(0, 8)}@t.local`,
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
        data: { id: branchId, tenantId, name: `R3 B ${branchId.slice(0, 6)}` },
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
    patientId?: string;
    branchId?: string;
    clinicalServiceId?: string;
    snapshotRevisionId?: string | null;
    performedAt?: Date;
  }) {
    const performanceId = randomUUID();
    const performedAt = opts?.performedAt ?? new Date('2026-09-01T10:30:00.000Z');
    await wrapper.withPlatformBypass(async (c) => {
      await c.servicePerformance.create({
        data: {
          id: performanceId,
          tenantId,
          branchId: opts?.branchId ?? branchId,
          appointmentId: opts?.appointmentId ?? appointmentId,
          patientId: opts?.patientId ?? patientId,
          clinicalServiceId: opts?.clinicalServiceId ?? clinicalServiceId,
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

  /** Production-like billing path: resolver + Invoice.create domain + durable persistence of servicePerformanceId */
  async function createInvoiceViaProductionPath(servicePerformanceId: string | null, opts?: {
    amount?: string;
  }) {
    const amount = opts?.amount ?? '1000.00';
    const invoice = Invoice.create({
      invoiceId: randomUUID(),
      tenantId,
      branchId,
      patientId,
      invoiceNumber: `R3-${randomUUID().slice(0, 8)}`,
      invoiceDate: new Date('2026-09-01'),
      currency: 'SYP',
      notes: 'R3 production path',
      lineItems: [
        {
          description: 'R3 clinical line',
          quantity: 1,
          unitPrice: Number(amount),
          discountPercent: 0,
          taxPercent: 0,
          servicePerformanceId,
          appointmentId,
          clinicalServiceId,
        },
      ],
    });
    invoice.issue();
    const line = invoice.lineItems[0]!;
    // Real production persistence writer: PrismaInvoiceRepository.save
    await raw.$executeRaw`SELECT set_config('app.platform_rls_bypass', 'true', false)`;
    const repo = new PrismaInvoiceRepository(raw as never);
    await repo.save(invoice);
    return { invoiceId: invoice.invoiceId, lineId: line.itemId };
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
          reason: 'R3 refund',
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
    const invoice = Invoice.create({
      invoiceId: randomUUID(),
      tenantId,
      branchId,
      patientId,
      invoiceNumber: `R3C-${randomUUID().slice(0, 8)}`,
      invoiceDate: new Date('2026-09-02'),
      currency: 'SYP',
      notes: 'R3 correction replacement',
      lineItems: [
        {
          description: 'R3 corrected line',
          quantity: 1,
          unitPrice: Number(amount),
          discountPercent: 0,
          taxPercent: 0,
          servicePerformanceId: null,
          appointmentId,
          clinicalServiceId,
        },
      ],
    });
    invoice.issue();
    const line = invoice.lineItems[0]!;
    await raw.$executeRaw`SELECT set_config('app.platform_rls_bypass', 'true', false)`;
    const repo = new PrismaInvoiceRepository(raw as never);
    await repo.save(invoice);
    return { invoiceId: invoice.invoiceId, lineId: line.itemId };
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

  it('R3-F1 legacy calculate still GoneException', async () => {
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

  it('R3-F2 COLLECTED_REVENUE path still works', async () => {
    await enableAndPublishPlan({
      userId: performerId,
      percentage: 30,
      effectiveFrom: '2026-01-01',
      calculationBasis: 'COLLECTED_REVENUE',
      earningTrigger: 'PAYMENT_COLLECTED',
    });
    const performanceId = await createCompletedPerformance();
    const resolved = await wrapper.withPlatformBypass((c) =>
      resolveAuthoritativeServicePerformanceForAppointment(c, {
        tenantId,
        appointmentId,
        clinicalServiceId,
      }),
    );
    expect(resolved).toBe(performanceId);
    const { invoiceId, lineId } = await createInvoiceViaProductionPath(performanceId);
    const paymentId = randomUUID();
    await wrapper.withPlatformBypass(async (c) => {
      await c.invoicePayment.create({
        data: {
          id: paymentId,
          tenantId,
          invoiceId,
          amount: '500.00',
          paymentMethod: 'cash',
          paymentDate: new Date('2026-09-01'),
          recordedBy: actorId,
        },
      });
    });
    const posted = await accruals().postFromCollectedPayment({
      servicePerformanceId: performanceId,
      invoiceLineId: lineId,
      paymentId,
      actor: actorId,
      actorRoles: ['owner'],
    });
    expect((posted.accruals as unknown[]).length).toBeGreaterThan(0);
  });

  it('R3-F3-T1 production billing path populates servicePerformanceId', async () => {
    const performanceId = await createCompletedPerformance();
    const resolved = await wrapper.withPlatformBypass((c) =>
      resolveAuthoritativeServicePerformanceForAppointment(c, {
        tenantId,
        appointmentId,
        clinicalServiceId,
      }),
    );
    expect(resolved).toBe(performanceId);
    const { lineId } = await createInvoiceViaProductionPath(resolved);
    const line = await wrapper.withPlatformBypass((c) =>
      c.invoiceLineItem.findUnique({ where: { id: lineId } }),
    );
    expect(line?.servicePerformanceId).toBe(performanceId);
  });

  it('R3-F3-T2 client cannot arbitrarily bind another ServicePerformance', async () => {
    const good = await createCompletedPerformance();
    const otherPatient = randomUUID();
    await wrapper.withPlatformBypass(async (c) => {
      await c.patient.create({
        data: { id: otherPatient, tenantId, firstName: 'Other', lastName: 'P' },
      });
    });
    const bad = await createCompletedPerformance({ patientId: otherPatient });
    const { lineId } = await createInvoiceViaProductionPath(null);
    await expect(
      binder().bindInvoiceLine({
        invoiceLineId: lineId,
        servicePerformanceId: bad,
        actor: { actorId, actorRoles: ['owner'] },
      }),
    ).rejects.toThrow(/patientId/i);
    await binder().bindInvoiceLine({
      invoiceLineId: lineId,
      servicePerformanceId: good,
      actor: { actorId, actorRoles: ['owner'] },
    });
  });

  it('R3-F3-T3 same patient+service wrong appointment SP rejected on accrual', async () => {
    await enableAndPublishPlan({
      userId: performerId,
      percentage: 30,
      effectiveFrom: '2026-01-01',
    });
    const apptB = randomUUID();
    await wrapper.withPlatformBypass(async (c) => {
      await c.appointment.create({
        data: {
          id: apptB,
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
    const perfB = await createCompletedPerformance({ appointmentId: apptB });
    const { lineId } = await createInvoiceViaProductionPath(perfB);
    await expect(
      accruals().postFromServicePerformance({
        servicePerformanceId: perfA,
        invoiceLineId: lineId,
        actor: actorId,
        actorRoles: ['owner'],
      }),
    ).rejects.toThrow(/servicePerformanceId/i);
  });

  it('R3-F3-T4/T5 wrong tenant/branch binding rejected', async () => {
    const { lineId } = await createInvoiceViaProductionPath(null);
    const otherTenant = randomUUID();
    const foreignPerf = randomUUID();
    await wrapper.withPlatformBypass(async (c) => {
      await c.tenant.create({
        data: { id: otherTenant, name: 'OT', slug: `ot-${otherTenant.slice(0, 8)}` },
      });
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
      const foreignBranch = randomUUID();
      await c.branch.create({
        data: { id: foreignBranch, tenantId: otherTenant, name: 'FB' },
      });
      const foreignSvc = randomUUID();
      await c.canonicalClinicalServiceDefinition.create({
        data: {
          id: foreignSvc,
          tenantId: otherTenant,
          provenance: 'TENANT_CUSTOM',
          stableKey: `tenant.${otherTenant}.custom.x-${foreignSvc.slice(0, 8)}`,
          domain: 'GENERAL',
          lifecycle: 'PUBLISHED',
        },
      });
      await c.servicePerformance.create({
        data: {
          id: foreignPerf,
          tenantId: otherTenant,
          branchId: foreignBranch,
          clinicalServiceId: foreignSvc,
          performedAt: new Date(),
          status: 'COMPLETED',
          completedAt: new Date(),
          completedBy: foreignUser,
          createdBy: foreignUser,
        },
      });
    });
    await expect(
      binder().bindInvoiceLine({
        invoiceLineId: lineId,
        servicePerformanceId: foreignPerf,
        actor: { actorId, actorRoles: ['owner'] },
      }),
    ).rejects.toThrow();
  });

  it('R3-F3-T6/T9 billing-created line then accrual succeeds without raw SP injection', async () => {
    await enableAndPublishPlan({
      userId: performerId,
      percentage: 30,
      effectiveFrom: '2026-01-01',
    });
    const performanceId = await createCompletedPerformance();
    const resolved = await wrapper.withPlatformBypass((c) =>
      resolveAuthoritativeServicePerformanceForAppointment(c, {
        tenantId,
        appointmentId,
        clinicalServiceId,
      }),
    );
    const { lineId } = await createInvoiceViaProductionPath(resolved);
    const posted = await accruals().postFromServicePerformance({
      servicePerformanceId: performanceId,
      invoiceLineId: lineId,
      actor: actorId,
      actorRoles: ['owner'],
    });
    expect((posted.accruals as unknown[]).length).toBe(1);
  });

  it('R3-F3-T7 second unrelated line cannot reuse same performance', async () => {
    await enableAndPublishPlan({
      userId: performerId,
      percentage: 30,
      effectiveFrom: '2026-01-01',
    });
    const performanceId = await createCompletedPerformance();
    const a = await createInvoiceViaProductionPath(performanceId);
    await accruals().postFromServicePerformance({
      servicePerformanceId: performanceId,
      invoiceLineId: a.lineId,
      actor: actorId,
      actorRoles: ['owner'],
    });
    await expect(createInvoiceViaProductionPath(performanceId)).rejects.toThrow();
  });

  it('R3-F4-T1 successful atomic correction', async () => {
    await enableAndPublishPlan({
      userId: performerId,
      percentage: 30,
      effectiveFrom: '2026-01-01',
    });
    const performanceId = await createCompletedPerformance();
    const { invoiceId, lineId } = await createInvoiceViaProductionPath(performanceId);
    const posted = await accruals().postFromServicePerformance({
      servicePerformanceId: performanceId,
      invoiceLineId: lineId,
      actor: actorId,
      actorRoles: ['owner'],
    });
    const originalId = (posted.accruals[0] as { id: string }).id;
    const replacement = await createReplacementLine();
    const correctionEventId = randomUUID();
    const result = await accruals().correctAndRepost({
      accrualId: originalId,
      correctionEventId,
      replacementInvoiceLineId: replacement.lineId,
      reason: 'R3 correction',
      actor: actorId,
      actorRoles: ['owner'],
    });
    expect((result.reversal as { id: string }).id).toBeTruthy();
    expect((result.repost as { accruals: unknown[] }).accruals.length).toBeGreaterThan(0);
    const original = await wrapper.withPlatformBypass((c) =>
      c.commissionAccrual.findUnique({ where: { id: originalId } }),
    );
    expect(original).toBeTruthy();
    expect(
      auditCalls.some((a) => a.action === 'staff_commission.accrual.corrected'),
    ).toBe(true);
  });

  it('R3-F4-T2/T3 repost failure rolls back reversal (atomic)', async () => {
    await enableAndPublishPlan({
      userId: performerId,
      percentage: 30,
      effectiveFrom: '2026-01-01',
    });
    const performanceId = await createCompletedPerformance();
    const { invoiceId, lineId } = await createInvoiceViaProductionPath(performanceId);
    const posted = await accruals().postFromServicePerformance({
      servicePerformanceId: performanceId,
      invoiceLineId: lineId,
      actor: actorId,
      actorRoles: ['owner'],
    });
    const originalId = (posted.accruals[0] as { id: string }).id;
    const replacement = await createReplacementLine();
    await wrapper.withPlatformBypass(async (c) => {
      await c.invoice.update({ where: { id: replacement.invoiceId }, data: { status: 'DRAFT' } });
    });
    const correctionEventId = randomUUID();
    await expect(
      accruals().correctAndRepost({
        accrualId: originalId,
        correctionEventId,
        replacementInvoiceLineId: replacement.lineId,
        reason: 'force fail',
        actor: actorId,
        actorRoles: ['owner'],
      }),
    ).rejects.toThrow();
    const reversals = await wrapper.withPlatformBypass((c) =>
      c.commissionAccrual.findMany({
        where: { tenantId, reversalOfAccrualId: originalId },
      }),
    );
    expect(reversals).toHaveLength(0);
  });

  it('R3-F4-T4/T5/T6 correction replay + concurrent + audit', async () => {
    await enableAndPublishPlan({
      userId: performerId,
      percentage: 30,
      effectiveFrom: '2026-01-01',
    });
    const performanceId = await createCompletedPerformance();
    const { invoiceId, lineId } = await createInvoiceViaProductionPath(performanceId);
    const posted = await accruals().postFromServicePerformance({
      servicePerformanceId: performanceId,
      invoiceLineId: lineId,
      actor: actorId,
      actorRoles: ['owner'],
    });
    const originalId = (posted.accruals[0] as { id: string }).id;
    const replacement = await createReplacementLine();
    const correctionEventId = randomUUID();
    const first = await accruals().correctAndRepost({
      accrualId: originalId,
      correctionEventId,
      replacementInvoiceLineId: replacement.lineId,
      reason: 'replay',
      actor: actorId,
      actorRoles: ['owner'],
    });
    const second = await accruals().correctAndRepost({
      accrualId: originalId,
      correctionEventId,
      replacementInvoiceLineId: replacement.lineId,
      reason: 'replay',
      actor: actorId,
      actorRoles: ['owner'],
    });
    expect((second as { idempotent?: boolean }).idempotent).toBe(true);
    expect((first.reversal as { id: string }).id).toBe((second.reversal as { id: string }).id);

    const performance2 = await createCompletedPerformance();
    const inv2 = await createInvoiceViaProductionPath(performance2);
    const posted2 = await accruals().postFromServicePerformance({
      servicePerformanceId: performance2,
      invoiceLineId: inv2.lineId,
      actor: actorId,
      actorRoles: ['owner'],
    });
    const id2 = (posted2.accruals[0] as { id: string }).id;
    const replacement2 = await createReplacementLine();
    const correctionEventId2 = randomUUID();
    const concurrent = await Promise.allSettled([
      accruals().correctAndRepost({
        accrualId: id2,
        correctionEventId: correctionEventId2,
        replacementInvoiceLineId: replacement2.lineId,
        reason: 'concurrent',
        actor: actorId,
        actorRoles: ['owner'],
      }),
      accruals().correctAndRepost({
        accrualId: id2,
        correctionEventId: correctionEventId2,
        replacementInvoiceLineId: replacement2.lineId,
        reason: 'concurrent',
        actor: actorId,
        actorRoles: ['owner'],
      }),
    ]);
    const ok = concurrent.filter((r) => r.status === 'fulfilled');
    expect(ok.length).toBeGreaterThanOrEqual(1);
    const revCount = await wrapper.withPlatformBypass((c) =>
      c.commissionAccrual.count({ where: { tenantId, reversalOfAccrualId: id2 } }),
    );
    expect(revCount).toBe(1);
  });

  it('R3-F5-T1 current A + future B → clean non-overlapping timeline', async () => {
    const a = await enableAndPublishPlan({
      userId: performerId,
      percentage: 25,
      effectiveFrom: '2026-01-01',
    });
    const draftB = await plans().createDraftPlan({
      userId: performerId,
      percentage: 30,
      effectiveFrom: '2026-10-01',
      actor: { actorId, actorRoles: ['owner'] },
    });
    const b = await plans().publishPlan(draftB.id, { actorId, actorRoles: ['owner'] });
    const prior = await wrapper.withPlatformBypass((c) =>
      c.staffCommissionPlanVersion.findUnique({ where: { id: a.id } }),
    );
    expect(prior?.status).toBe('SUPERSEDED');
    expect(prior?.effectiveTo?.toISOString().slice(0, 10)).toBe('2026-09-30');
    expect(b.status).toBe('ACTIVE');
  });

  it('R3-F5-T2/T3 same or overlapping future publish rejected', async () => {
    await enableAndPublishPlan({
      userId: performerId,
      percentage: 25,
      effectiveFrom: '2026-01-01',
    });
    const draftB = await plans().createDraftPlan({
      userId: performerId,
      percentage: 30,
      effectiveFrom: '2026-10-01',
      actor: { actorId, actorRoles: ['owner'] },
    });
    await plans().publishPlan(draftB.id, { actorId, actorRoles: ['owner'] });
    const draftC = await plans().createDraftPlan({
      userId: performerId,
      percentage: 35,
      effectiveFrom: '2026-10-01',
      actor: { actorId, actorRoles: ['owner'] },
    });
    await expect(
      plans().publishPlan(draftC.id, { actorId, actorRoles: ['owner'] }),
    ).rejects.toThrow(/overlap|fail-closed/i);
  });

  it('R3-F5-T4 concurrent future publishes → one valid timeline', async () => {
    await enableAndPublishPlan({
      userId: performerId,
      percentage: 20,
      effectiveFrom: '2026-01-01',
    });
    const d1 = await plans().createDraftPlan({
      userId: performerId,
      percentage: 30,
      effectiveFrom: '2026-11-01',
      actor: { actorId, actorRoles: ['owner'] },
    });
    const d2 = await plans().createDraftPlan({
      userId: performerId,
      percentage: 40,
      effectiveFrom: '2026-11-01',
      actor: { actorId, actorRoles: ['owner'] },
    });
    const results = await Promise.allSettled([
      plans().publishPlan(d1.id, { actorId, actorRoles: ['owner'] }),
      plans().publishPlan(d2.id, { actorId, actorRoles: ['owner'] }),
    ]);
    const fulfilled = results.filter((r) => r.status === 'fulfilled');
    expect(fulfilled.length).toBe(1);
    const active = await wrapper.withPlatformBypass((c) =>
      c.staffCommissionPlanVersion.findMany({
        where: { tenantId, userId: performerId, status: 'ACTIVE' },
      }),
    );
    expect(active).toHaveLength(1);
    expect(active[0]!.effectiveFrom.toISOString().slice(0, 10)).toBe('2026-11-01');
  });

  it('R3-F5-T6/T7/T8 historical resolve + boundary + no overlap', async () => {
    await enableAndPublishPlan({
      userId: performerId,
      percentage: 25,
      effectiveFrom: '2026-01-01',
    });
    const draftB = await plans().createDraftPlan({
      userId: performerId,
      percentage: 30,
      effectiveFrom: '2026-10-01',
      actor: { actorId, actorRoles: ['owner'] },
    });
    const b = await plans().publishPlan(draftB.id, { actorId, actorRoles: ['owner'] });
    const hist = await wrapper.withPlatformBypass((tx) =>
      plans().resolvePlanAt(tx, tenantId, performerId, new Date('2026-06-15')),
    );
    expect(hist.percentage.toString()).toBe('25');
    const onBoundary = await wrapper.withPlatformBypass((tx) =>
      plans().resolvePlanAt(tx, tenantId, performerId, new Date('2026-10-01')),
    );
    expect(onBoundary.id).toBe(b.id);
    const overlapCount = await wrapper.withPlatformBypass(async (c) => {
      const rows = await c.$queryRawUnsafe<Array<{ cnt: bigint }>>(
        `SELECT COUNT(*)::bigint AS cnt
         FROM staff_commission_plan_versions p1
         JOIN staff_commission_plan_versions p2
           ON p1.id < p2.id
          AND p1."tenantId" = p2."tenantId"
          AND p1."userId" = p2."userId"
          AND p1.status IN ('ACTIVE','SUPERSEDED')
          AND p2.status IN ('ACTIVE','SUPERSEDED')
          AND p1."effectiveFrom" <= COALESCE(p2."effectiveTo", '9999-12-31'::date)
          AND p2."effectiveFrom" <= COALESCE(p1."effectiveTo", '9999-12-31'::date)
         WHERE p1."tenantId" = $1::uuid AND p1."userId" = $2::uuid`,
        tenantId,
        performerId,
      );
      return Number(rows[0]?.cnt ?? 0);
    });
    expect(overlapCount).toBe(0);
  });

  it('R3-F5-T9 published immutability still rejects rate change', async () => {
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

  it.each(parentRefs)(
    'R3-F6A INSERT mixed-parent rejected for $field → $parentTable',
    async ({ field }) => {
      await enableAndPublishPlan({
        userId: performerId,
        percentage: 30,
        effectiveFrom: '2026-01-01',
      });
      const performanceId = await createCompletedPerformance();
      const { invoiceId, lineId } = await createInvoiceViaProductionPath(performanceId);
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

      await expect(
        wrapper.withPlatformBypass(async (c) => {
          const foreignId = randomUUID();
          if (field === 'userId' || field === 'createdBy') {
            await c.user.create({
              data: {
                id: foreignId,
                tenantId: otherTenant,
                email: `fx-${foreignId.slice(0, 8)}@t.local`,
                passwordHash: 'x',
                firstName: 'F',
                lastName: 'X',
              },
            });
          } else if (field === 'branchId') {
            await c.branch.create({
              data: { id: foreignId, tenantId: otherTenant, name: 'FX' },
            });
          } else if (field === 'clinicalServiceId') {
            await c.canonicalClinicalServiceDefinition.create({
              data: {
                id: foreignId,
                tenantId: otherTenant,
                provenance: 'TENANT_CUSTOM',
                stableKey: `tenant.${otherTenant}.custom.${foreignId.slice(0, 8)}`,
                domain: 'GENERAL',
                lifecycle: 'PUBLISHED',
              },
            });
          } else if (field === 'appointmentId') {
            const fb = randomUUID();
            const fp = randomUUID();
            const fu = randomUUID();
            await c.user.create({
              data: {
                id: fu,
                tenantId: otherTenant,
                email: `a-${fu.slice(0, 8)}@t.local`,
                passwordHash: 'x',
                firstName: 'A',
                lastName: 'P',
              },
            });
            await c.branch.create({ data: { id: fb, tenantId: otherTenant, name: 'AB' } });
            await c.patient.create({
              data: { id: fp, tenantId: otherTenant, firstName: 'P', lastName: 'X' },
            });
            await c.appointment.create({
              data: {
                id: foreignId,
                tenantId: otherTenant,
                branchId: fb,
                patientId: fp,
                providerId: fu,
                scheduledStart: new Date(),
                scheduledEnd: new Date(),
                status: 'CONFIRMED',
              },
            });
          } else if (field === 'servicePerformanceId') {
            const fu = randomUUID();
            const fb = randomUUID();
            const fs = randomUUID();
            await c.user.create({
              data: {
                id: fu,
                tenantId: otherTenant,
                email: `sp-${fu.slice(0, 8)}@t.local`,
                passwordHash: 'x',
                firstName: 'S',
                lastName: 'P',
              },
            });
            await c.branch.create({ data: { id: fb, tenantId: otherTenant, name: 'SPB' } });
            await c.canonicalClinicalServiceDefinition.create({
              data: {
                id: fs,
                tenantId: otherTenant,
                provenance: 'TENANT_CUSTOM',
                stableKey: `tenant.${otherTenant}.custom.sp-${fs.slice(0, 8)}`,
                domain: 'GENERAL',
                lifecycle: 'PUBLISHED',
              },
            });
            await c.servicePerformance.create({
              data: {
                id: foreignId,
                tenantId: otherTenant,
                branchId: fb,
                clinicalServiceId: fs,
                performedAt: new Date(),
                status: 'COMPLETED',
                completedAt: new Date(),
                completedBy: fu,
                createdBy: fu,
              },
            });
          } else if (field === 'commissionPlanVersionId') {
            const fu = randomUUID();
            await c.user.create({
              data: {
                id: fu,
                tenantId: otherTenant,
                email: `pl-${fu.slice(0, 8)}@t.local`,
                passwordHash: 'x',
                firstName: 'P',
                lastName: 'L',
              },
            });
            await c.staffCommissionPlanVersion.create({
              data: {
                id: foreignId,
                tenantId: otherTenant,
                userId: fu,
                percentage: 10,
                effectiveFrom: new Date('2026-01-01'),
                status: 'ACTIVE',
                createdBy: fu,
                publishedAt: new Date(),
                publishedBy: fu,
              },
            });
          } else if (field === 'invoiceId' || field === 'invoiceLineId') {
            const fp = randomUUID();
            const fb = randomUUID();
            await c.patient.create({
              data: { id: fp, tenantId: otherTenant, firstName: 'I', lastName: 'P' },
            });
            await c.branch.create({ data: { id: fb, tenantId: otherTenant, name: 'IB' } });
            const inv = field === 'invoiceId' ? foreignId : randomUUID();
            const line = field === 'invoiceLineId' ? foreignId : randomUUID();
            await c.invoice.create({
              data: {
                id: inv,
                tenantId: otherTenant,
                branchId: fb,
                patientId: fp,
                invoiceNumber: `FX-${inv.slice(0, 8)}`,
                invoiceDate: new Date(),
                currency: 'SYP',
                status: 'ISSUED',
                amountSubtotal: 1,
                amountDiscount: 0,
                amountTax: 0,
                amountTotal: 1,
                lineItems: {
                  create: {
                    id: line,
                    tenantId: otherTenant,
                    description: 'fx',
                    quantity: 1,
                    unitPrice: 1,
                    subtotal: 1,
                    discountAmount: 0,
                    taxAmount: 0,
                    lineTotal: 1,
                  },
                },
              },
            });
          } else if (field === 'paymentId') {
            const fp = randomUUID();
            const fb = randomUUID();
            const inv = randomUUID();
            const fu = randomUUID();
            await c.user.create({
              data: {
                id: fu,
                tenantId: otherTenant,
                email: `pay-${fu.slice(0, 8)}@t.local`,
                passwordHash: 'x',
                firstName: 'P',
                lastName: 'Y',
              },
            });
            await c.patient.create({
              data: { id: fp, tenantId: otherTenant, firstName: 'P', lastName: 'Y' },
            });
            await c.branch.create({ data: { id: fb, tenantId: otherTenant, name: 'PB' } });
            await c.invoice.create({
              data: {
                id: inv,
                tenantId: otherTenant,
                branchId: fb,
                patientId: fp,
                invoiceNumber: `PAY-${inv.slice(0, 8)}`,
                invoiceDate: new Date(),
                currency: 'SYP',
                status: 'ISSUED',
                amountSubtotal: 1,
                amountDiscount: 0,
                amountTax: 0,
                amountTotal: 1,
              },
            });
            await c.invoicePayment.create({
              data: {
                id: foreignId,
                tenantId: otherTenant,
                invoiceId: inv,
                amount: 1,
                paymentMethod: 'cash',
                paymentDate: new Date(),
                recordedBy: fu,
              },
            });
          } else if (field === 'refundId') {
            const fp = randomUUID();
            const fb = randomUUID();
            const inv = randomUUID();
            const fu = randomUUID();
            await c.user.create({
              data: {
                id: fu,
                tenantId: otherTenant,
                email: `rf-${fu.slice(0, 8)}@t.local`,
                passwordHash: 'x',
                firstName: 'R',
                lastName: 'F',
              },
            });
            await c.patient.create({
              data: { id: fp, tenantId: otherTenant, firstName: 'R', lastName: 'F' },
            });
            await c.branch.create({ data: { id: fb, tenantId: otherTenant, name: 'RB' } });
            await c.invoice.create({
              data: {
                id: inv,
                tenantId: otherTenant,
                branchId: fb,
                patientId: fp,
                invoiceNumber: `RF-${inv.slice(0, 8)}`,
                invoiceDate: new Date(),
                currency: 'SYP',
                status: 'ISSUED',
                amountSubtotal: 1,
                amountDiscount: 0,
                amountTax: 0,
                amountTotal: 1,
              },
            });
            await c.invoiceRefund.create({
              data: {
                id: foreignId,
                tenantId: otherTenant,
                invoiceId: inv,
                amount: 1,
                reason: 'x',
                refundMethod: 'cash',
                refundDate: new Date(),
                approvedBy: fu,
              },
            });
          } else if (field === 'snapshotRevisionId') {
            const snapAppt = randomUUID();
            const fb = randomUUID();
            const fp = randomUUID();
            const fu = randomUUID();
            await c.user.create({
              data: {
                id: fu,
                tenantId: otherTenant,
                email: `sn-${fu.slice(0, 8)}@t.local`,
                passwordHash: 'x',
                firstName: 'S',
                lastName: 'N',
              },
            });
            await c.branch.create({ data: { id: fb, tenantId: otherTenant, name: 'SB' } });
            await c.patient.create({
              data: { id: fp, tenantId: otherTenant, firstName: 'S', lastName: 'N' },
            });
            await c.appointment.create({
              data: {
                id: snapAppt,
                tenantId: otherTenant,
                branchId: fb,
                patientId: fp,
                providerId: fu,
                scheduledStart: new Date(),
                scheduledEnd: new Date(),
                status: 'CONFIRMED',
              },
            });
            await c.appointmentServiceSnapshotRevision.create({
              data: {
                id: foreignId,
                tenantId: otherTenant,
                appointmentId: snapAppt,
                revisionNumber: 1,
                stableKey: `fx.snap.${foreignId.slice(0, 8)}`,
                displayNameAr: 'fx',
                displayNameEn: 'fx',
                quantity: 1,
                unitPrice: 1,
                lineBasisAmount: 1,
                currency: 'SYP',
                actorId: fu,
              },
            });
          } else if (field === 'reversalOfAccrualId') {
            // Create foreign accrual chain minimally via raw — use a plan+perf in other tenant.
            const fu = randomUUID();
            const fb = randomUUID();
            const fs = randomUUID();
            const fperf = randomUUID();
            const fplan = randomUUID();
            await c.user.create({
              data: {
                id: fu,
                tenantId: otherTenant,
                email: `rv-${fu.slice(0, 8)}@t.local`,
                passwordHash: 'x',
                firstName: 'R',
                lastName: 'V',
              },
            });
            await c.branch.create({ data: { id: fb, tenantId: otherTenant, name: 'RVB' } });
            await c.canonicalClinicalServiceDefinition.create({
              data: {
                id: fs,
                tenantId: otherTenant,
                provenance: 'TENANT_CUSTOM',
                stableKey: `tenant.${otherTenant}.custom.rv-${fs.slice(0, 8)}`,
                domain: 'GENERAL',
                lifecycle: 'PUBLISHED',
              },
            });
            await c.servicePerformance.create({
              data: {
                id: fperf,
                tenantId: otherTenant,
                branchId: fb,
                clinicalServiceId: fs,
                performedAt: new Date(),
                status: 'COMPLETED',
                completedAt: new Date(),
                completedBy: fu,
                createdBy: fu,
              },
            });
            await c.staffCommissionPlanVersion.create({
              data: {
                id: fplan,
                tenantId: otherTenant,
                userId: fu,
                percentage: 10,
                effectiveFrom: new Date('2026-01-01'),
                status: 'ACTIVE',
                createdBy: fu,
                publishedAt: new Date(),
                publishedBy: fu,
              },
            });
            await c.commissionAccrual.create({
              data: {
                id: foreignId,
                tenantId: otherTenant,
                userId: fu,
                servicePerformanceId: fperf,
                clinicalServiceId: fs,
                commissionPlanVersionId: fplan,
                calculationBasis: 'SERVICE_NET_AFTER_DISCOUNT',
                attributedRevenueAmount: 10,
                commissionPercent: 10,
                commissionAmount: 1,
                currency: 'SYP',
                status: 'EARNED',
                idempotencyKey: `fx-${foreignId}`,
                createdBy: fu,
              },
            });
          }

          const cols: Record<string, unknown> = {
            id: randomUUID(),
            tenantId,
            userId: good.userId,
            servicePerformanceId: good.servicePerformanceId,
            clinicalServiceId: good.clinicalServiceId,
            commissionPlanVersionId: good.commissionPlanVersionId,
            calculationBasis: 'SERVICE_NET_AFTER_DISCOUNT',
            attributedRevenueAmount: 100,
            commissionPercent: 30,
            commissionAmount: 30,
            currency: 'SYP',
            status: 'EARNED',
            idempotencyKey: `bad-${field}-${randomUUID()}`,
            createdBy: actorId,
            invoiceId,
            invoiceLineId: lineId,
          };
          cols[field] = foreignId;

          await c.commissionAccrual.create({ data: cols as never });
        }),
      ).rejects.toThrow(/tenant mismatch|23514|Foreign key|P2003|P2002/i);
    },
  );

  it.each(parentRefs)(
    'R3-F6A UPDATE parent-switch rejected for $field (append-only/tenant)',
    async ({ field }) => {
      await enableAndPublishPlan({
        userId: performerId,
        percentage: 30,
        effectiveFrom: '2026-01-01',
      });
      const performanceId = await createCompletedPerformance();
      const { lineId } = await createInvoiceViaProductionPath(performanceId);
      const posted = await accruals().postFromServicePerformance({
        servicePerformanceId: performanceId,
        invoiceLineId: lineId,
        actor: actorId,
        actorRoles: ['owner'],
      });
      const id = (posted.accruals[0] as { id: string }).id;
      const before = await wrapper.withPlatformBypass((c) =>
        c.commissionAccrual.findUnique({ where: { id } }),
      );
      await expect(
        wrapper.withPlatformBypass((c) =>
          c.$executeRawUnsafe(
            `UPDATE commission_accruals SET "${field}" = $1::uuid WHERE id = $2::uuid`,
            randomUUID(),
            id,
          ),
        ),
      ).rejects.toThrow(/append-only|tenant mismatch|23514|immutable/i);
      const after = await wrapper.withPlatformBypass((c) =>
        c.commissionAccrual.findUnique({ where: { id } }),
      );
      expect((after as Record<string, unknown>)[field]).toEqual(
        (before as Record<string, unknown>)[field],
      );
    },
  );

  it('R3-F6B settlement allocation ENABLE/FORCE RLS + booking_app NOBYPASSRLS', async () => {
    const flags = await wrapper.withPlatformBypass((c) =>
      c.$queryRaw<Array<{ enable_rls: boolean; force_rls: boolean }>>`
        SELECT c.relrowsecurity AS enable_rls, c.relforcerowsecurity AS force_rls
        FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public' AND c.relname = 'commission_settlement_allocations'
      `,
    );
    expect(flags[0]?.enable_rls).toBe(true);
    expect(flags[0]?.force_rls).toBe(true);
    const role = await wrapper.withPlatformBypass((c) =>
      c.$queryRaw<Array<{ rolbypassrls: boolean }>>`
        SELECT rolbypassrls FROM pg_roles WHERE rolname = 'booking_app'
      `,
    );
    expect(role[0]?.rolbypassrls).toBe(false);
  });

  it('R3-F7-T1/T3 concurrent full-net settlement never exceeds net settleable', async () => {
    await enableAndPublishPlan({
      userId: performerId,
      percentage: 30,
      effectiveFrom: '2026-01-01',
    });
    const performanceId = await createCompletedPerformance();
    const { invoiceId, lineId } = await createInvoiceViaProductionPath(performanceId, {
      amount: '1000.00',
    });
    const posted = await accruals().postFromServicePerformance({
      servicePerformanceId: performanceId,
      invoiceLineId: lineId,
      actor: actorId,
      actorRoles: ['owner'],
    });
    const accrualId = (posted.accruals[0] as { id: string }).id;
    // commission 300; reverse 100 via 333.333... refund on 1000 invoice ≈ 100
    const refundId = await createRefund(invoiceId, '333.34');
    await accruals().reverseAccrual({
      accrualId,
      refundId,
      actor: actorId,
      actorRoles: ['owner'],
    });
    const results = await Promise.allSettled([
      accruals().settleAccrual({
        accrualId,
        settlementReference: 'CONC-A',
        actor: actorId,
        actorRoles: ['owner'],
      }),
      accruals().settleAccrual({
        accrualId,
        settlementReference: 'CONC-B',
        actor: actorId,
        actorRoles: ['owner'],
      }),
    ]);
    const ok = results.filter((r) => r.status === 'fulfilled');
    expect(ok.length).toBe(1);
    const sum = await wrapper.withPlatformBypass(async (c) => {
      const rows = await c.commissionSettlementAllocation.findMany({
        where: { tenantId, accrualId },
      });
      return rows.reduce((a, r) => a.add(r.amount), new Prisma.Decimal(0));
    });
    expect(sum.lte(new Prisma.Decimal('200.01'))).toBe(true);
    expect(sum.gt(0)).toBe(true);
  });

  it('R3-F7-T2 concurrent partial settlements cumulative <= net', async () => {
    await enableAndPublishPlan({
      userId: performerId,
      percentage: 30,
      effectiveFrom: '2026-01-01',
    });
    const performanceId = await createCompletedPerformance();
    const { invoiceId, lineId } = await createInvoiceViaProductionPath(performanceId);
    const posted = await accruals().postFromServicePerformance({
      servicePerformanceId: performanceId,
      invoiceLineId: lineId,
      actor: actorId,
      actorRoles: ['owner'],
    });
    const accrualId = (posted.accruals[0] as { id: string }).id;
    const refundId = await createRefund(invoiceId, '333.34');
    await accruals().reverseAccrual({
      accrualId,
      refundId,
      actor: actorId,
      actorRoles: ['owner'],
    });
    await Promise.allSettled([
      accruals().settleAccrual({
        accrualId,
        settlementReference: 'PART-A',
        amount: '120',
        actor: actorId,
        actorRoles: ['owner'],
      }),
      accruals().settleAccrual({
        accrualId,
        settlementReference: 'PART-B',
        amount: '120',
        actor: actorId,
        actorRoles: ['owner'],
      }),
    ]);
    const sum = await wrapper.withPlatformBypass(async (c) => {
      const rows = await c.commissionSettlementAllocation.findMany({
        where: { tenantId, accrualId },
      });
      return rows.reduce((a, r) => a.add(r.amount), new Prisma.Decimal(0));
    });
    expect(sum.lte(new Prisma.Decimal('200.01'))).toBe(true);
  });

  it('R3-F7-T4/T5 full reverse blocks settle; idempotent replay', async () => {
    await enableAndPublishPlan({
      userId: performerId,
      percentage: 30,
      effectiveFrom: '2026-01-01',
    });
    const performanceId = await createCompletedPerformance();
    const { invoiceId, lineId } = await createInvoiceViaProductionPath(performanceId);
    const posted = await accruals().postFromServicePerformance({
      servicePerformanceId: performanceId,
      invoiceLineId: lineId,
      actor: actorId,
      actorRoles: ['owner'],
    });
    const accrualId = (posted.accruals[0] as { id: string }).id;
    const refundId = await createRefund(invoiceId, '1000.00');
    await accruals().reverseAccrual({
      accrualId,
      refundId,
      actor: actorId,
      actorRoles: ['owner'],
    });
    const race = await Promise.allSettled([
      accruals().settleAccrual({
        accrualId,
        settlementReference: 'AFTER-FULL',
        actor: actorId,
        actorRoles: ['owner'],
      }),
      accruals().settleAccrual({
        accrualId,
        settlementReference: 'AFTER-FULL-2',
        actor: actorId,
        actorRoles: ['owner'],
      }),
    ]);
    expect(race.every((r) => r.status === 'rejected')).toBe(true);

    const performance2 = await createCompletedPerformance();
    const inv2 = await createInvoiceViaProductionPath(performance2);
    const posted2 = await accruals().postFromServicePerformance({
      servicePerformanceId: performance2,
      invoiceLineId: inv2.lineId,
      actor: actorId,
      actorRoles: ['owner'],
    });
    const id2 = (posted2.accruals[0] as { id: string }).id;
    const a = await accruals().settleAccrual({
      accrualId: id2,
      settlementReference: 'IDEM',
      actor: actorId,
      actorRoles: ['owner'],
    });
    const b = await accruals().settleAccrual({
      accrualId: id2,
      settlementReference: 'IDEM',
      actor: actorId,
      actorRoles: ['owner'],
    });
    expect((b as { idempotent?: boolean }).idempotent).toBe(true);
    expect((a as { settlementAllocation: { id: string } }).settlementAllocation.id).toBe(
      (b as { settlementAllocation: { id: string } }).settlementAllocation.id,
    );
  });

  it('R3-F7-RPT-T1..T7 owner report drilldown completeness', async () => {
    await enableAndPublishPlan({
      userId: performerId,
      percentage: 30,
      effectiveFrom: '2026-01-01',
    });
    const snapId = randomUUID();
    await wrapper.withPlatformBypass(async (c) => {
      await c.appointmentServiceSnapshotRevision.create({
        data: {
          id: snapId,
          tenantId,
          appointmentId,
          revisionNumber: 1,
          stableKey: `r3.snap.${snapId.slice(0, 8)}`,
          displayNameAr: 'R3 snap',
          displayNameEn: 'R3 snap',
          quantity: 1,
          unitPrice: 1000,
          lineBasisAmount: 1000,
          currency: 'SYP',
          clinicalServiceId,
          actorId,
        },
      });
    });
    const performanceId = await createCompletedPerformance({ snapshotRevisionId: snapId });
    const { invoiceId, lineId } = await createInvoiceViaProductionPath(performanceId);
    const posted = await accruals().postFromServicePerformance({
      servicePerformanceId: performanceId,
      invoiceLineId: lineId,
      actor: actorId,
      actorRoles: ['owner'],
    });
    const accrualId = (posted.accruals[0] as { id: string }).id;
    const refundId = await createRefund(invoiceId, '100.00');
    await accruals().reverseAccrual({
      accrualId,
      refundId,
      actor: actorId,
      actorRoles: ['owner'],
    });
    await accruals().settleAccrual({
      accrualId,
      settlementReference: 'RPT-SETTLE',
      amount: '50',
      actor: actorId,
      actorRoles: ['owner'],
    });
    const report = await accruals().ownerReport({
      from: '2026-01-01',
      to: '2026-12-31',
      userId: performerId,
    });
    const row = (report.drilldown as Array<Record<string, unknown>>).find(
      (d) => d.accrualId === accrualId,
    );
    expect(row).toBeTruthy();
    expect(row!.servicePerformanceId).toBe(performanceId);
    expect(row!.snapshotRevisionId).toBe(snapId);
    expect(row!.invoiceId).toBe(invoiceId);
    expect(row!.invoiceLineId).toBe(lineId);
    expect(row!.appointmentId).toBe(appointmentId);
    expect(Array.isArray(row!.inventoryUsages)).toBe(true);
    expect((row!.inventoryUsages as unknown[]).length).toBe(0);
    expect(Array.isArray(row!.reversalIds)).toBe(true);
    expect((row!.reversalIds as unknown[]).length).toBe(1);
    expect(Array.isArray(row!.settlementAllocations)).toBe(true);
    expect((row!.settlementAllocations as unknown[]).length).toBe(1);
  });
});
