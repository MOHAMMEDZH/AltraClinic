/**
 * Wave F RLS — booking_app NOBYPASSRLS for staff_commission_plan_versions / commission_accruals.
 */
import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'crypto';
import {
  assertSafePlatformTestDatabaseUrl,
  platformDbSecurityEnabled,
  DEFAULT_PLATFORM_DB_SECURITY_URL,
} from '../../auth/tests/platform-db-security.harness';

jest.setTimeout(180_000);
const describeDb = platformDbSecurityEnabled() ? describe : describe.skip;

const ADMIN_URL = DEFAULT_PLATFORM_DB_SECURITY_URL;
const APP_URL =
  process.env.INTEGRATION_APP_DATABASE_URL ??
  'postgresql://booking_app:booking_app@localhost:5433/booking_test?schema=public';

async function withTenant<T>(
  client: PrismaClient,
  tenantId: string,
  fn: (tx: PrismaClient) => Promise<T>,
): Promise<T> {
  return client.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT set_config('app.current_tenant_id', ${tenantId}, true)`;
    await tx.$executeRaw`SELECT set_config('app.platform_rls_bypass', 'false', true)`;
    return fn(tx as unknown as PrismaClient);
  });
}

async function withBypass<T>(client: PrismaClient, fn: (tx: PrismaClient) => Promise<T>): Promise<T> {
  return client.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT set_config('app.platform_rls_bypass', 'true', true)`;
    await tx.$executeRaw`SELECT set_config('app.current_tenant_id', '', true)`;
    return fn(tx as unknown as PrismaClient);
  });
}

async function nobypassProof(client: PrismaClient, tenantId: string) {
  return withTenant(client, tenantId, async (tx) => {
    const current = await tx.$queryRaw<Array<{ current_user: string }>>`SELECT current_user`;
    const bypass = await tx.$queryRaw<Array<{ rolbypassrls: boolean }>>`
      SELECT rolbypassrls FROM pg_roles WHERE rolname = current_user
    `;
    const tenant = await tx.$queryRaw<Array<{ tenant: string | null }>>`
      SELECT current_setting('app.current_tenant_id', true) AS tenant
    `;
    return {
      currentUser: current[0]?.current_user,
      bypass: bypass[0]?.rolbypassrls,
      tenantId: tenant[0]?.tenant,
    };
  });
}

describeDb('Wave F real RLS (bypass OFF, booking_app)', () => {
  let admin: PrismaClient;
  let app: PrismaClient;
  let tenantA: string;
  let tenantB: string;
  let actorA: string;
  let actorB: string;
  let patientA: string;
  let patientB: string;
  let svcA: string;
  let svcB: string;
  let branchA: string;
  let planA: string;
  let planB: string;
  let perfA: string;
  let perfB: string;
  let accrualA: string;
  let accrualB: string;

  beforeAll(async () => {
    assertSafePlatformTestDatabaseUrl(ADMIN_URL);
    admin = new PrismaClient({ datasources: { db: { url: ADMIN_URL } } });
    app = new PrismaClient({ datasources: { db: { url: APP_URL } } });
    await admin.$connect();
    await app.$connect();

    tenantA = randomUUID();
    tenantB = randomUUID();
    actorA = randomUUID();
    actorB = randomUUID();
    patientA = randomUUID();
    patientB = randomUUID();
    svcA = randomUUID();
    svcB = randomUUID();
    branchA = randomUUID();
    planA = randomUUID();
    planB = randomUUID();
    perfA = randomUUID();
    perfB = randomUUID();
    accrualA = randomUUID();
    accrualB = randomUUID();

    await withBypass(admin, async (tx) => {
      await tx.tenant.createMany({
        data: [
          { id: tenantA, name: 'WF RLS A', slug: `wf-rls-a-${tenantA.slice(0, 8)}` },
          { id: tenantB, name: 'WF RLS B', slug: `wf-rls-b-${tenantB.slice(0, 8)}` },
        ],
      });
      await tx.user.create({
        data: {
          id: actorA,
          tenantId: tenantA,
          email: `wf-rls-${actorA.slice(0, 8)}@t.local`,
          passwordHash: 'x',
          firstName: 'A',
          lastName: 'A',
          commissionEnabled: true,
        },
      });
      await tx.user.create({
        data: {
          id: actorB,
          tenantId: tenantB,
          email: `wf-rls-${actorB.slice(0, 8)}@t.local`,
          passwordHash: 'x',
          firstName: 'B',
          lastName: 'B',
          commissionEnabled: true,
        },
      });
      await tx.patient.create({
        data: { id: patientA, tenantId: tenantA, firstName: 'A', lastName: 'P' },
      });
      await tx.patient.create({
        data: { id: patientB, tenantId: tenantB, firstName: 'B', lastName: 'P' },
      });
      await tx.branch.create({
        data: { id: branchA, tenantId: tenantA, name: `WF RLS Branch ${branchA.slice(0, 6)}` },
      });
      await tx.canonicalClinicalServiceDefinition.create({
        data: {
          id: svcA,
          tenantId: tenantA,
          provenance: 'TENANT_CUSTOM',
          stableKey: `tenant.${tenantA}.custom.rls-${svcA.slice(0, 8)}`,
          domain: 'GENERAL',
          lifecycle: 'PUBLISHED',
        },
      });
      await tx.canonicalClinicalServiceDefinition.create({
        data: {
          id: svcB,
          tenantId: tenantB,
          provenance: 'TENANT_CUSTOM',
          stableKey: `tenant.${tenantB}.custom.rls-${svcB.slice(0, 8)}`,
          domain: 'GENERAL',
          lifecycle: 'PUBLISHED',
        },
      });
      await tx.servicePerformance.create({
        data: {
          id: perfA,
          tenantId: tenantA,
          clinicalServiceId: svcA,
          performedAt: new Date('2026-09-01T10:00:00.000Z'),
          status: 'COMPLETED',
          createdBy: actorA,
          completedAt: new Date('2026-09-01T10:00:00.000Z'),
          completedBy: actorA,
        },
      });
      await tx.servicePerformance.create({
        data: {
          id: perfB,
          tenantId: tenantB,
          clinicalServiceId: svcB,
          performedAt: new Date('2026-09-02T10:00:00.000Z'),
          status: 'COMPLETED',
          createdBy: actorB,
          completedAt: new Date('2026-09-02T10:00:00.000Z'),
          completedBy: actorB,
        },
      });
      await tx.staffCommissionPlanVersion.create({
        data: {
          id: planA,
          tenantId: tenantA,
          userId: actorA,
          percentage: 25,
          effectiveFrom: new Date('2026-01-01'),
          status: 'ACTIVE',
          createdBy: actorA,
          publishedAt: new Date(),
          publishedBy: actorA,
        },
      });
      await tx.staffCommissionPlanVersion.create({
        data: {
          id: planB,
          tenantId: tenantB,
          userId: actorB,
          percentage: 20,
          effectiveFrom: new Date('2026-01-01'),
          status: 'ACTIVE',
          createdBy: actorB,
          publishedAt: new Date(),
          publishedBy: actorB,
        },
      });
      await tx.commissionAccrual.create({
        data: {
          id: accrualA,
          tenantId: tenantA,
          userId: actorA,
          servicePerformanceId: perfA,
          clinicalServiceId: svcA,
          commissionPlanVersionId: planA,
          calculationBasis: 'SERVICE_NET_AFTER_DISCOUNT',
          attributedRevenueAmount: 100,
          commissionPercent: 25,
          commissionAmount: 25,
          currency: 'SYP',
          status: 'EARNED',
          earnedAt: new Date(),
          idempotencyKey: `rls-a-${accrualA}`,
          createdBy: actorA,
        },
      });
      await tx.commissionAccrual.create({
        data: {
          id: accrualB,
          tenantId: tenantB,
          userId: actorB,
          servicePerformanceId: perfB,
          clinicalServiceId: svcB,
          commissionPlanVersionId: planB,
          calculationBasis: 'SERVICE_NET_AFTER_DISCOUNT',
          attributedRevenueAmount: 200,
          commissionPercent: 20,
          commissionAmount: 40,
          currency: 'SYP',
          status: 'EARNED',
          earnedAt: new Date(),
          idempotencyKey: `rls-b-${accrualB}`,
          createdBy: actorB,
        },
      });
    });
  });

  afterAll(async () => {
    await app.$disconnect();
    await admin.$disconnect();
  });

  it('NOBYPASSRLS context is active (current_user, rolbypassrls=false, tenant)', async () => {
    const proof = await nobypassProof(app, tenantA);
    expect(proof.currentUser).toBeTruthy();
    expect(proof.bypass).toBe(false);
    expect(proof.tenantId).toBe(tenantA);
  });

  it('same-tenant SELECT sees plan versions and accruals', async () => {
    const plans = await withTenant(app, tenantA, (tx) =>
      tx.staffCommissionPlanVersion.findMany({ where: { id: planA } }),
    );
    const accruals = await withTenant(app, tenantA, (tx) =>
      tx.commissionAccrual.findMany({ where: { id: accrualA } }),
    );
    expect(plans).toHaveLength(1);
    expect(accruals).toHaveLength(1);
  });

  it('same-tenant CRUD (delete accrual denied)', async () => {
    const draftId = randomUUID();
    await withTenant(app, tenantA, async (tx) => {
      await tx.staffCommissionPlanVersion.create({
        data: {
          id: draftId,
          tenantId: tenantA,
          userId: actorA,
          percentage: 15,
          effectiveFrom: new Date('2026-02-01'),
          status: 'DRAFT',
          createdBy: actorA,
        },
      });
      await tx.staffCommissionPlanVersion.update({
        where: { id: draftId },
        data: { percentage: 16 },
      });
      await tx.staffCommissionPlanVersion.delete({ where: { id: draftId } });
    });

    await expect(
      withTenant(app, tenantA, (tx) => tx.commissionAccrual.delete({ where: { id: accrualA } })),
    ).rejects.toThrow();

    const stillThere = await withTenant(app, tenantA, (tx) =>
      tx.commissionAccrual.findUnique({ where: { id: accrualA } }),
    );
    expect(stillThere).toBeTruthy();

    // Settle path allowed under same tenant
    const settled = await withTenant(app, tenantA, (tx) =>
      tx.commissionAccrual.update({
        where: { id: accrualA },
        data: { status: 'SETTLED', settledAt: new Date(), settlementReference: 'RLS-SETTLE' },
      }),
    );
    expect(settled.status).toBe('SETTLED');
  });

  it('cross-tenant SELECT hidden / INSERT reject', async () => {
    const hiddenPlans = await withTenant(app, tenantB, (tx) =>
      tx.staffCommissionPlanVersion.findMany({ where: { id: planA } }),
    );
    const hiddenAccruals = await withTenant(app, tenantB, (tx) =>
      tx.commissionAccrual.findMany({ where: { id: accrualA } }),
    );
    expect(hiddenPlans).toHaveLength(0);
    expect(hiddenAccruals).toHaveLength(0);

    await expect(
      withTenant(app, tenantB, (tx) =>
        tx.staffCommissionPlanVersion.create({
          data: {
            id: randomUUID(),
            tenantId: tenantA,
            userId: actorA,
            percentage: 11,
            effectiveFrom: new Date('2026-03-01'),
            status: 'DRAFT',
            createdBy: actorA,
          },
        }),
      ),
    ).rejects.toThrow();

    await expect(
      withTenant(app, tenantB, (tx) =>
        tx.commissionAccrual.create({
          data: {
            id: randomUUID(),
            tenantId: tenantA,
            userId: actorA,
            servicePerformanceId: perfA,
            clinicalServiceId: svcA,
            commissionPlanVersionId: planA,
            calculationBasis: 'SERVICE_NET_AFTER_DISCOUNT',
            attributedRevenueAmount: 50,
            commissionPercent: 25,
            commissionAmount: 12.5,
            currency: 'SYP',
            status: 'EARNED',
            idempotencyKey: `x-tenant-${randomUUID()}`,
            createdBy: actorA,
          },
        }),
      ),
    ).rejects.toThrow();
  });

  it('rolbypassrls = false for booking_app', async () => {
    const proof = await nobypassProof(app, tenantA);
    expect(proof.bypass).toBe(false);
    expect(String(proof.currentUser)).toMatch(/booking_app/);
  });

  it('R3-F6B settlement_allocations ENABLE+FORCE RLS and NOBYPASSRLS', async () => {
    const flags = await admin.$queryRaw<
      Array<{ enable_rls: boolean; force_rls: boolean }>
    >`
      SELECT c.relrowsecurity AS enable_rls, c.relforcerowsecurity AS force_rls
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relname = 'commission_settlement_allocations'
    `;
    expect(flags[0]?.enable_rls).toBe(true);
    expect(flags[0]?.force_rls).toBe(true);
    const role = await admin.$queryRaw<Array<{ rolbypassrls: boolean }>>`
      SELECT rolbypassrls FROM pg_roles WHERE rolname = 'booking_app'
    `;
    expect(role[0]?.rolbypassrls).toBe(false);
  });

  it('R3-F6B same-tenant settlement allocation insert+select; cross-tenant hidden; update/delete denied', async () => {
    const allocA = randomUUID();
    await withTenant(app, tenantA, async (tx) => {
      await tx.commissionSettlementAllocation.create({
        data: {
          id: allocA,
          tenantId: tenantA,
          accrualId: accrualA,
          amount: 10,
          currency: 'SYP',
          settlementReference: `RLS-S-${allocA.slice(0, 8)}`,
          idempotencyKey: `settle-rls-${allocA}`,
          createdBy: actorA,
        },
      });
      const seen = await tx.commissionSettlementAllocation.findMany({ where: { id: allocA } });
      expect(seen).toHaveLength(1);
    });

    const hidden = await withTenant(app, tenantB, (tx) =>
      tx.commissionSettlementAllocation.findMany({ where: { id: allocA } }),
    );
    expect(hidden).toHaveLength(0);

    await expect(
      withTenant(app, tenantB, (tx) =>
        tx.commissionSettlementAllocation.create({
          data: {
            id: randomUUID(),
            tenantId: tenantA,
            accrualId: accrualA,
            amount: 1,
            currency: 'SYP',
            settlementReference: 'x',
            idempotencyKey: `x-${randomUUID()}`,
            createdBy: actorA,
          },
        }),
      ),
    ).rejects.toThrow();

    await expect(
      withTenant(app, tenantA, (tx) =>
        tx.commissionSettlementAllocation.update({
          where: { id: allocA },
          data: { reason: 'nope' },
        }),
      ),
    ).rejects.toThrow();

    await expect(
      withTenant(app, tenantA, (tx) =>
        tx.commissionSettlementAllocation.delete({ where: { id: allocA } }),
      ),
    ).rejects.toThrow();

    const still = await withTenant(app, tenantA, (tx) =>
      tx.commissionSettlementAllocation.findUnique({ where: { id: allocA } }),
    );
    expect(still).toBeTruthy();
  });
});

describeDb('Wave F Round 15 commission_correction_lineages RLS (booking_app)', () => {
  let admin: PrismaClient;
  let app: PrismaClient;
  let tenantA: string;
  let tenantB: string;
  let actorA: string;
  let actorB: string;
  let patientA: string;
  let svcA: string;
  let svcB: string;
  let planA: string;
  let planB: string;
  let perfA: string;
  let perfB: string;
  let invA: string;
  let lineSourceA: string;
  let lineReplA: string;
  let lineSourceB: string;
  let lineReplB: string;
  let accrualA: string;
  let accrualB: string;

  beforeAll(async () => {
    assertSafePlatformTestDatabaseUrl(ADMIN_URL);
    admin = new PrismaClient({ datasources: { db: { url: ADMIN_URL } } });
    app = new PrismaClient({ datasources: { db: { url: APP_URL } } });
    await admin.$connect();
    await app.$connect();

    tenantA = randomUUID();
    tenantB = randomUUID();
    actorA = randomUUID();
    actorB = randomUUID();
    patientA = randomUUID();
    svcA = randomUUID();
    svcB = randomUUID();
    planA = randomUUID();
    planB = randomUUID();
    perfA = randomUUID();
    perfB = randomUUID();
    invA = randomUUID();
    lineSourceA = randomUUID();
    lineReplA = randomUUID();
    lineSourceB = randomUUID();
    lineReplB = randomUUID();
    accrualA = randomUUID();
    accrualB = randomUUID();
    const invB = randomUUID();

    await withBypass(admin, async (tx) => {
      await tx.tenant.createMany({
        data: [
          { id: tenantA, name: 'WF R15 RLS A', slug: `wf-r15-a-${tenantA.slice(0, 8)}` },
          { id: tenantB, name: 'WF R15 RLS B', slug: `wf-r15-b-${tenantB.slice(0, 8)}` },
        ],
      });
      await tx.user.create({
        data: {
          id: actorA,
          tenantId: tenantA,
          email: `wf-r15-${actorA.slice(0, 8)}@t.local`,
          passwordHash: 'x',
          firstName: 'A',
          lastName: 'A',
          commissionEnabled: true,
        },
      });
      await tx.user.create({
        data: {
          id: actorB,
          tenantId: tenantB,
          email: `wf-r15-${actorB.slice(0, 8)}@t.local`,
          passwordHash: 'x',
          firstName: 'B',
          lastName: 'B',
          commissionEnabled: true,
        },
      });
      await tx.patient.create({
        data: { id: patientA, tenantId: tenantA, firstName: 'A', lastName: 'P' },
      });
      const patientB = randomUUID();
      await tx.patient.create({
        data: { id: patientB, tenantId: tenantB, firstName: 'B', lastName: 'P' },
      });
      await tx.canonicalClinicalServiceDefinition.create({
        data: {
          id: svcA,
          tenantId: tenantA,
          provenance: 'TENANT_CUSTOM',
          stableKey: `tenant.${tenantA}.custom.r15-${svcA.slice(0, 8)}`,
          domain: 'GENERAL',
          lifecycle: 'PUBLISHED',
        },
      });
      await tx.canonicalClinicalServiceDefinition.create({
        data: {
          id: svcB,
          tenantId: tenantB,
          provenance: 'TENANT_CUSTOM',
          stableKey: `tenant.${tenantB}.custom.r15-${svcB.slice(0, 8)}`,
          domain: 'GENERAL',
          lifecycle: 'PUBLISHED',
        },
      });
      await tx.servicePerformance.create({
        data: {
          id: perfA,
          tenantId: tenantA,
          clinicalServiceId: svcA,
          performedAt: new Date('2026-09-01T10:00:00.000Z'),
          status: 'COMPLETED',
          createdBy: actorA,
          completedAt: new Date('2026-09-01T10:00:00.000Z'),
          completedBy: actorA,
        },
      });
      await tx.servicePerformance.create({
        data: {
          id: perfB,
          tenantId: tenantB,
          clinicalServiceId: svcB,
          performedAt: new Date('2026-09-02T10:00:00.000Z'),
          status: 'COMPLETED',
          createdBy: actorB,
          completedAt: new Date('2026-09-02T10:00:00.000Z'),
          completedBy: actorB,
        },
      });
      await tx.staffCommissionPlanVersion.create({
        data: {
          id: planA,
          tenantId: tenantA,
          userId: actorA,
          percentage: 25,
          effectiveFrom: new Date('2026-01-01'),
          status: 'ACTIVE',
          createdBy: actorA,
          publishedAt: new Date(),
          publishedBy: actorA,
        },
      });
      await tx.staffCommissionPlanVersion.create({
        data: {
          id: planB,
          tenantId: tenantB,
          userId: actorB,
          percentage: 20,
          effectiveFrom: new Date('2026-01-01'),
          status: 'ACTIVE',
          createdBy: actorB,
          publishedAt: new Date(),
          publishedBy: actorB,
        },
      });
      await tx.invoice.create({
        data: {
          id: invA,
          tenantId: tenantA,
          patientId: patientA,
          invoiceNumber: `R15A-${invA.slice(0, 8)}`,
          invoiceDate: new Date('2026-09-01'),
          currency: 'SYP',
          status: 'ISSUED',
          amountSubtotal: 100,
          amountTax: 0,
          amountTotal: 100,
        },
      });
      await tx.invoice.create({
        data: {
          id: invB,
          tenantId: tenantB,
          patientId: patientB,
          invoiceNumber: `R15B-${invB.slice(0, 8)}`,
          invoiceDate: new Date('2026-09-01'),
          currency: 'SYP',
          status: 'ISSUED',
          amountSubtotal: 200,
          amountTax: 0,
          amountTotal: 200,
        },
      });
      for (const row of [
        { id: lineSourceA, invoiceId: invA, tenantId: tenantA, total: 100 },
        { id: lineReplA, invoiceId: invA, tenantId: tenantA, total: 100 },
        { id: lineSourceB, invoiceId: invB, tenantId: tenantB, total: 200 },
        { id: lineReplB, invoiceId: invB, tenantId: tenantB, total: 200 },
      ]) {
        await tx.invoiceLineItem.create({
          data: {
            id: row.id,
            invoiceId: row.invoiceId,
            tenantId: row.tenantId,
            description: 'R15 RLS line',
            quantity: 1,
            unitPrice: row.total,
            discountPercent: 0,
            taxPercent: 0,
            subtotal: row.total,
            discountAmount: 0,
            taxAmount: 0,
            lineTotal: row.total,
            clinicalServiceId: row.tenantId === tenantA ? svcA : svcB,
          },
        });
      }
      await tx.commissionAccrual.create({
        data: {
          id: accrualA,
          tenantId: tenantA,
          userId: actorA,
          servicePerformanceId: perfA,
          clinicalServiceId: svcA,
          invoiceId: invA,
          invoiceLineId: lineSourceA,
          commissionPlanVersionId: planA,
          calculationBasis: 'SERVICE_NET_AFTER_DISCOUNT',
          attributedRevenueAmount: 100,
          commissionPercent: 25,
          commissionAmount: 25,
          currency: 'SYP',
          status: 'EARNED',
          earnedAt: new Date(),
          idempotencyKey: `r15-rls-a-${accrualA}`,
          createdBy: actorA,
        },
      });
      await tx.commissionAccrual.create({
        data: {
          id: accrualB,
          tenantId: tenantB,
          userId: actorB,
          servicePerformanceId: perfB,
          clinicalServiceId: svcB,
          invoiceId: invB,
          invoiceLineId: lineSourceB,
          commissionPlanVersionId: planB,
          calculationBasis: 'SERVICE_NET_AFTER_DISCOUNT',
          attributedRevenueAmount: 200,
          commissionPercent: 20,
          commissionAmount: 40,
          currency: 'SYP',
          status: 'EARNED',
          earnedAt: new Date(),
          idempotencyKey: `r15-rls-b-${accrualB}`,
          createdBy: actorB,
        },
      });
    });
  });

  afterAll(async () => {
    await app.$disconnect();
    await admin.$disconnect();
  });

  function validLineageA(overrides: Record<string, unknown> = {}) {
    return {
      id: randomUUID(),
      tenantId: tenantA,
      correctionEventId: randomUUID(),
      selectedAccrualId: accrualA,
      sourceInvoiceLineId: lineSourceA,
      replacementInvoiceLineId: lineReplA,
      servicePerformanceId: perfA,
      calculationBasis: 'SERVICE_NET_AFTER_DISCOUNT' as const,
      packageAllocationId: null,
      createdBy: actorA,
      ...overrides,
    };
  }

  it('R15-RLS booking_app NOBYPASSRLS; ENABLE+FORCE on commission_correction_lineages', async () => {
    const proof = await nobypassProof(app, tenantA);
    expect(String(proof.currentUser)).toMatch(/booking_app/);
    expect(proof.bypass).toBe(false);
    const flags = await admin.$queryRaw<Array<{ enable_rls: boolean; force_rls: boolean }>>`
      SELECT c.relrowsecurity AS enable_rls, c.relforcerowsecurity AS force_rls
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relname = 'commission_correction_lineages'
    `;
    expect(flags[0]?.enable_rls).toBe(true);
    expect(flags[0]?.force_rls).toBe(true);
  });

  it('R15-RLS same-tenant insert+select of valid lineage', async () => {
    const id = randomUUID();
    await withTenant(app, tenantA, async (tx) => {
      await tx.commissionCorrectionLineage.create({
        data: validLineageA({ id }),
      });
      const seen = await tx.commissionCorrectionLineage.findMany({ where: { id } });
      expect(seen).toHaveLength(1);
    });
  });

  it('R15-RLS cross-tenant select count 0; cross-tenant insert fail', async () => {
    const id = randomUUID();
    await withBypass(admin, async (tx) => {
      await tx.commissionCorrectionLineage.create({
        data: validLineageA({ id, correctionEventId: randomUUID() }),
      });
    });
    const hidden = await withTenant(app, tenantB, (tx) =>
      tx.commissionCorrectionLineage.findMany({ where: { id } }),
    );
    expect(hidden).toHaveLength(0);

    await expect(
      withTenant(app, tenantB, (tx) =>
        tx.commissionCorrectionLineage.create({
          data: validLineageA({ tenantId: tenantA, correctionEventId: randomUUID() }),
        }),
      ),
    ).rejects.toThrow();
  });

  it('R15-RLS cross-tenant selectedAccrual / source / replacement / SP / createdBy rejected', async () => {
    await expect(
      withTenant(app, tenantA, (tx) =>
        tx.commissionCorrectionLineage.create({
          data: validLineageA({
            selectedAccrualId: accrualB,
            correctionEventId: randomUUID(),
          }),
        }),
      ),
    ).rejects.toThrow(/selectedAccrualId tenant mismatch|commission_correction_lineages/i);

    await expect(
      withTenant(app, tenantA, (tx) =>
        tx.commissionCorrectionLineage.create({
          data: validLineageA({
            sourceInvoiceLineId: lineSourceB,
            correctionEventId: randomUUID(),
          }),
        }),
      ),
    ).rejects.toThrow(/mismatch|commission_correction_lineages/i);

    await expect(
      withTenant(app, tenantA, (tx) =>
        tx.commissionCorrectionLineage.create({
          data: validLineageA({
            replacementInvoiceLineId: lineReplB,
            correctionEventId: randomUUID(),
          }),
        }),
      ),
    ).rejects.toThrow(/replacementInvoiceLineId tenant mismatch|commission_correction_lineages/i);

    await expect(
      withTenant(app, tenantA, (tx) =>
        tx.commissionCorrectionLineage.create({
          data: validLineageA({
            servicePerformanceId: perfB,
            correctionEventId: randomUUID(),
          }),
        }),
      ),
    ).rejects.toThrow(/servicePerformanceId|mismatch|commission_correction_lineages/i);

    await expect(
      withTenant(app, tenantA, (tx) =>
        tx.commissionCorrectionLineage.create({
          data: validLineageA({
            createdBy: actorB,
            correctionEventId: randomUUID(),
          }),
        }),
      ),
    ).rejects.toThrow(/createdBy tenant mismatch|commission_correction_lineages/i);
  });

  it('R15-RLS semantic mismatch selectedAccrual fields rejected', async () => {
    await expect(
      withTenant(app, tenantA, (tx) =>
        tx.commissionCorrectionLineage.create({
          data: validLineageA({
            calculationBasis: 'COLLECTED_REVENUE',
            correctionEventId: randomUUID(),
          }),
        }),
      ),
    ).rejects.toThrow(/calculationBasis mismatch|commission_correction_lineages/i);

    await expect(
      withTenant(app, tenantA, (tx) =>
        tx.commissionCorrectionLineage.create({
          data: validLineageA({
            sourceInvoiceLineId: lineReplA,
            correctionEventId: randomUUID(),
          }),
        }),
      ),
    ).rejects.toThrow(/invoiceLineId|sourceInvoiceLineId mismatch|commission_correction_lineages/i);
  });

  it('R15-RLS update/delete denied', async () => {
    const id = randomUUID();
    await withTenant(app, tenantA, async (tx) => {
      await tx.commissionCorrectionLineage.create({
        data: validLineageA({ id, correctionEventId: randomUUID() }),
      });
    });
    await expect(
      withTenant(app, tenantA, (tx) =>
        tx.commissionCorrectionLineage.update({
          where: { id },
          data: { createdBy: actorA },
        }),
      ),
    ).rejects.toThrow();
    await expect(
      withTenant(app, tenantA, (tx) => tx.commissionCorrectionLineage.delete({ where: { id } })),
    ).rejects.toThrow();
    const still = await withTenant(app, tenantA, (tx) =>
      tx.commissionCorrectionLineage.findUnique({ where: { id } }),
    );
    expect(still).toBeTruthy();
  });

  it('R15-RLS platform bypass select works under admin', async () => {
    const id = randomUUID();
    await withBypass(admin, async (tx) => {
      await tx.commissionCorrectionLineage.create({
        data: validLineageA({ id, correctionEventId: randomUUID() }),
      });
      const seen = await tx.commissionCorrectionLineage.findMany({ where: { id } });
      expect(seen).toHaveLength(1);
    });
  });
});
