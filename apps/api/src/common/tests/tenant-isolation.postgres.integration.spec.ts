/**
 * Cross-tenant isolation proofs on real PostgreSQL with RLS enabled.
 * Run: INTEGRATION_DATABASE_URL=postgresql://... npm run test:integration
 */
import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'crypto';

const ADMIN_URL =
  process.env.INTEGRATION_ADMIN_DATABASE_URL ??
  'postgresql://booking:booking_test@localhost:5433/booking_test';

const APP_URL =
  process.env.INTEGRATION_DATABASE_URL ??
  'postgresql://booking_app:booking_app@localhost:5433/booking_test';

const runIntegration =
  process.env.RUN_INTEGRATION === 'true' || Boolean(process.env.INTEGRATION_DATABASE_URL);

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

describe('PostgreSQL tenant isolation (RLS)', () => {
  let admin: PrismaClient;
  let app: PrismaClient;
  let tenantA: string;
  let tenantB: string;
  let patientA: string;
  let patientB: string;

  beforeAll(async () => {
    if (!runIntegration) return;

    admin = new PrismaClient({ datasources: { db: { url: ADMIN_URL } } });
    app = new PrismaClient({ datasources: { db: { url: APP_URL } } });
    await admin.$connect();
    await app.$connect();

    tenantA = randomUUID();
    tenantB = randomUUID();
    patientA = randomUUID();
    patientB = randomUUID();

    await withBypass(admin, async (tx) => {
      await tx.tenant.createMany({
        data: [
          { id: tenantA, name: 'RLS Test Tenant A', slug: `rls-a-${tenantA.slice(0, 8)}`, status: 'ACTIVE' },
          { id: tenantB, name: 'RLS Test Tenant B', slug: `rls-b-${tenantB.slice(0, 8)}`, status: 'ACTIVE' },
        ],
      });

      await tx.patient.createMany({
        data: [
          {
            id: patientA,
            tenantId: tenantA,
            firstName: 'Alice',
            lastName: 'TenantA',
            dateOfBirth: new Date('1990-01-01'),
            gender: 'female',
          },
          {
            id: patientB,
            tenantId: tenantB,
            firstName: 'Bob',
            lastName: 'TenantB',
            dateOfBirth: new Date('1991-02-02'),
            gender: 'male',
          },
        ],
      });
    });
  });

  afterAll(async () => {
    if (!runIntegration || !admin || !app) return;

    await withBypass(admin, async (tx) => {
      await tx.invoice.deleteMany({ where: { tenantId: { in: [tenantA, tenantB] } } }).catch(() => undefined);
      await tx.patient.deleteMany({ where: { id: { in: [patientA, patientB] } } });
      await tx.tenant.deleteMany({ where: { id: { in: [tenantA, tenantB] } } });
    });

    await admin.$disconnect();
    await app.$disconnect();
  });

  (runIntegration ? it : it.skip)('tenant A cannot read tenant B patients under RLS', async () => {
    const visible = await withTenant(app, tenantA, (tx) =>
      tx.patient.findMany({ where: { deletedAt: null } }),
    );

    const ids = visible.map((p) => p.id);
    expect(ids).toContain(patientA);
    expect(ids).not.toContain(patientB);
  });

  (runIntegration ? it : it.skip)('tenant B cannot read tenant A patients under RLS', async () => {
    const visible = await withTenant(app, tenantB, (tx) =>
      tx.patient.findMany({ where: { deletedAt: null } }),
    );

    const ids = visible.map((p) => p.id);
    expect(ids).toContain(patientB);
    expect(ids).not.toContain(patientA);
  });

  (runIntegration ? it : it.skip)('platform bypass can read cross-tenant for maintenance', async () => {
    const all = await withBypass(app, (tx) =>
      tx.patient.findMany({ where: { id: { in: [patientA, patientB] } } }),
    );
    expect(all.length).toBe(2);
  });

  (runIntegration ? it : it.skip)('invoices are tenant-scoped under RLS', async () => {
    const invoiceA = randomUUID();
    const invoiceB = randomUUID();

    await withBypass(admin, async (tx) => {
      await tx.invoice.createMany({
        data: [
          {
            id: invoiceA,
            tenantId: tenantA,
            patientId: patientA,
            invoiceNumber: `INV-A-${invoiceA.slice(0, 8)}`,
            invoiceDate: new Date(),
            status: 'DRAFT',
            currency: 'SYP',
            amountSubtotal: 100,
            amountTax: 0,
            amountTotal: 100,
            amountPaid: 0,
          },
          {
            id: invoiceB,
            tenantId: tenantB,
            patientId: patientB,
            invoiceNumber: `INV-B-${invoiceB.slice(0, 8)}`,
            invoiceDate: new Date(),
            status: 'DRAFT',
            currency: 'SYP',
            amountSubtotal: 200,
            amountTax: 0,
            amountTotal: 200,
            amountPaid: 0,
          },
        ],
      });
    });

    const tenantInvoices = await withTenant(app, tenantA, (tx) =>
      tx.invoice.findMany({ where: { deletedAt: null } }),
    );
    expect(tenantInvoices.some((i) => i.id === invoiceA)).toBe(true);
    expect(tenantInvoices.some((i) => i.id === invoiceB)).toBe(false);

    await withBypass(admin, (tx) =>
      tx.invoice.deleteMany({ where: { id: { in: [invoiceA, invoiceB] } } }),
    );
  });
});
