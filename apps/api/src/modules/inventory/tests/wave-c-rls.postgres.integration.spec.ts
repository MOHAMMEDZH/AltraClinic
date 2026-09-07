/**
 * Wave C Blocker 6 — real PostgreSQL RLS with platform_rls_bypass = false
 * and booking_app (non-superuser, NOBYPASSRLS).
 */
import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'crypto';
import {
  assertSafePlatformTestDatabaseUrl,
  platformDbSecurityEnabled,
  DEFAULT_PLATFORM_DB_SECURITY_URL,
} from '../../auth/tests/platform-db-security.harness';

jest.setTimeout(120_000);

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

describeDb('Wave C real RLS (bypass OFF, booking_app)', () => {
  let admin: PrismaClient;
  let app: PrismaClient;
  let tenantA: string;
  let tenantB: string;
  let platformTemplateId: string;
  let tenantTemplateId: string;
  let platformVersionId: string;
  let tenantVersionId: string;
  let usageA: string;
  let usageB: string;
  let itemA: string;
  let actorA: string;

  beforeAll(async () => {
    assertSafePlatformTestDatabaseUrl(ADMIN_URL);
    admin = new PrismaClient({ datasources: { db: { url: ADMIN_URL } } });
    app = new PrismaClient({ datasources: { db: { url: APP_URL } } });
    await admin.$connect();
    await app.$connect();

    tenantA = randomUUID();
    tenantB = randomUUID();
    platformTemplateId = randomUUID();
    tenantTemplateId = randomUUID();
    platformVersionId = '';
    tenantVersionId = '';
    usageA = randomUUID();
    usageB = randomUUID();
    itemA = randomUUID();
    actorA = randomUUID();

    await withBypass(admin, async (tx) => {
      await tx.tenant.createMany({
        data: [
          { id: tenantA, name: 'WC RLS A', slug: `wc-rls-a-${tenantA.slice(0, 8)}`, status: 'ACTIVE' },
          { id: tenantB, name: 'WC RLS B', slug: `wc-rls-b-${tenantB.slice(0, 8)}`, status: 'ACTIVE' },
        ],
      });
      await tx.user.create({
        data: {
          id: actorA,
          tenantId: tenantA,
          email: `wc-rls-${actorA.slice(0, 8)}@test.local`,
          passwordHash: 'x',
          firstName: 'A',
          lastName: 'Actor',
        },
      });
      await tx.inventoryItem.create({
        data: {
          id: itemA,
          tenantId: tenantA,
          sku: `WC-RLS-${itemA.slice(0, 6)}`,
          nameEn: 'RLS Item',
          unit: 'unit',
          quantityOnHand: 10,
        },
      });

      await tx.clinicalFormTemplate.create({
        data: {
          id: platformTemplateId,
          tenantId: null,
          kind: 'PHOTO_CONSENT',
          stableKey: `plt-${platformTemplateId.slice(0, 8)}`,
          nameEn: 'Platform Photo Consent',
          status: 'ACTIVE',
        },
      });
      await tx.clinicalFormTemplate.create({
        data: {
          id: tenantTemplateId,
          tenantId: tenantA,
          kind: 'PHOTO_CONSENT',
          stableKey: `tnt-${tenantTemplateId.slice(0, 8)}`,
          nameEn: 'Tenant Photo Consent',
          status: 'ACTIVE',
        },
      });

      platformVersionId = randomUUID();
      tenantVersionId = randomUUID();
      await tx.clinicalFormVersion.create({
        data: {
          id: platformVersionId,
          templateId: platformTemplateId,
          version: 1,
          status: 'PUBLISHED',
          contentEn: 'platform v1',
          contentAr: 'منصة',
          publishedAt: new Date(),
          publishedByUserId: actorA,
        },
      });
      await tx.clinicalFormVersion.create({
        data: {
          id: tenantVersionId,
          templateId: tenantTemplateId,
          version: 1,
          status: 'DRAFT',
          contentEn: 'tenant v1',
          contentAr: 'مستأجر',
        },
      });

      const itemB = randomUUID();
      await tx.inventoryItem.create({
        data: {
          id: itemB,
          tenantId: tenantB,
          sku: `WC-RLS-B-${itemB.slice(0, 6)}`,
          nameEn: 'RLS Item B',
          unit: 'unit',
          quantityOnHand: 10,
        },
      });

      await tx.inventoryUsageLedger.createMany({
        data: [
          {
            id: usageA,
            tenantId: tenantA,
            inventoryItemId: itemA,
            quantityUsed: 1,
            unit: 'unit',
            usageType: 'CLINICAL_CONSUMPTION',
            consumedBy: actorA,
            recordedByUserId: actorA,
            usedByUserId: actorA,
            status: 'POSTED',
            attributionStatus: 'ATTRIBUTED',
            consumedAt: new Date(),
            occurredAt: new Date(),
            recordedAt: new Date(),
          },
          {
            id: usageB,
            tenantId: tenantB,
            inventoryItemId: itemB,
            quantityUsed: 1,
            unit: 'unit',
            usageType: 'CLINICAL_CONSUMPTION',
            consumedBy: actorA,
            recordedByUserId: actorA,
            usedByUserId: actorA,
            status: 'POSTED',
            attributionStatus: 'ATTRIBUTED',
            consumedAt: new Date(),
            occurredAt: new Date(),
            recordedAt: new Date(),
          },
        ],
      });
    });
  });

  afterAll(async () => {
    await withBypass(admin, async (tx) => {
      await tx.inventoryUsageLedger.deleteMany({ where: { id: { in: [usageA, usageB] } } }).catch(() => undefined);
      await tx.clinicalFormVersion.deleteMany({
        where: { id: { in: [platformVersionId, tenantVersionId] } },
      }).catch(() => undefined);
      await tx.clinicalFormTemplate.deleteMany({
        where: { id: { in: [platformTemplateId, tenantTemplateId] } },
      }).catch(() => undefined);
      await tx.inventoryItem.deleteMany({ where: { id: itemA } }).catch(() => undefined);
      await tx.user.deleteMany({ where: { id: actorA } }).catch(() => undefined);
      await tx.tenant.deleteMany({ where: { id: { in: [tenantA, tenantB] } } }).catch(() => undefined);
    });
    await admin.$disconnect();
    await app.$disconnect();
  });

  it('bypass is OFF and tenant context is set for assertions', async () => {
    const rows = await withTenant(app, tenantA, async (tx) => {
      return tx.$queryRaw<Array<{ tenant: string | null; bypass: string | null }>>`
        SELECT current_setting('app.current_tenant_id', true) AS tenant,
               current_setting('app.platform_rls_bypass', true) AS bypass
      `;
    });
    expect(rows[0].tenant).toBe(tenantA);
    expect(rows[0].bypass).toBe('false');
  });

  it('platform clinical form SELECT allowed; INSERT/UPDATE/DELETE denied for tenant', async () => {
    await withTenant(app, tenantA, async (tx) => {
      const readable = await tx.clinicalFormTemplate.findMany({
        where: { id: platformTemplateId },
      });
      expect(readable.length).toBe(1);
      expect(readable[0].tenantId).toBeNull();

      await expect(
        tx.clinicalFormTemplate.create({
          data: {
            id: randomUUID(),
            tenantId: null,
            kind: 'PHOTO_CONSENT',
            stableKey: `bad-${randomUUID().slice(0, 6)}`,
            nameEn: 'Hijack',
            status: 'ACTIVE',
          },
        }),
      ).rejects.toThrow();

      await expect(
        tx.clinicalFormTemplate.update({
          where: { id: platformTemplateId },
          data: { nameEn: 'Mutated' },
        }),
      ).rejects.toThrow();

      await expect(
        tx.clinicalFormTemplate.delete({ where: { id: platformTemplateId } }),
      ).rejects.toThrow();
    });
  });

  it('tenant A can read own template; tenant B cannot', async () => {
    const aRows = await withTenant(app, tenantA, (tx) =>
      tx.clinicalFormTemplate.findMany({ where: { id: tenantTemplateId } }),
    );
    expect(aRows.length).toBe(1);

    const bRows = await withTenant(app, tenantB, (tx) =>
      tx.clinicalFormTemplate.findMany({ where: { id: tenantTemplateId } }),
    );
    expect(bRows.length).toBe(0);
  });

  it('platform clinical form version SELECT allowed; INSERT/UPDATE/DELETE/publish/supersede denied', async () => {
    await withTenant(app, tenantA, async (tx) => {
      const readable = await tx.clinicalFormVersion.findMany({ where: { id: platformVersionId } });
      expect(readable.length).toBe(1);
      expect(readable[0].status).toBe('PUBLISHED');

      await expect(
        tx.clinicalFormVersion.create({
          data: {
            id: randomUUID(),
            templateId: platformTemplateId,
            version: 2,
            status: 'DRAFT',
            contentEn: 'hijack',
            contentAr: 'hijack',
          },
        }),
      ).rejects.toThrow();

      await expect(
        tx.clinicalFormVersion.update({
          where: { id: platformVersionId },
          data: { contentEn: 'mutated' },
        }),
      ).rejects.toThrow();

      await expect(
        tx.clinicalFormVersion.update({
          where: { id: platformVersionId },
          data: { status: 'SUPERSEDED' },
        }),
      ).rejects.toThrow();

      await expect(
        tx.clinicalFormVersion.delete({ where: { id: platformVersionId } }),
      ).rejects.toThrow();
    });
  });

  it('tenant-owned form version lifecycle allowed for Tenant A; isolated from Tenant B', async () => {
    await withTenant(app, tenantA, async (tx) => {
      const own = await tx.clinicalFormVersion.findMany({ where: { id: tenantVersionId } });
      expect(own.length).toBe(1);
      const created = await tx.clinicalFormVersion.create({
        data: {
          id: randomUUID(),
          templateId: tenantTemplateId,
          version: 2,
          status: 'DRAFT',
          contentEn: 'tenant v2',
          contentAr: 'v2',
        },
      });
      expect(created.templateId).toBe(tenantTemplateId);
    });

    const bRows = await withTenant(app, tenantB, (tx) =>
      tx.clinicalFormVersion.findMany({ where: { id: tenantVersionId } }),
    );
    expect(bRows.length).toBe(0);
  });

  it('inventory usage cross-tenant SELECT denied under RLS (no WHERE tenant filter cheat)', async () => {
    const aVisible = await withTenant(app, tenantA, (tx) =>
      tx.inventoryUsageLedger.findMany({ where: { id: { in: [usageA, usageB] } } }),
    );
    expect(aVisible.map((r) => r.id)).toEqual([usageA]);

    const bVisible = await withTenant(app, tenantB, (tx) =>
      tx.inventoryUsageLedger.findMany({ where: { id: { in: [usageA, usageB] } } }),
    );
    expect(bVisible.map((r) => r.id)).toEqual([usageB]);
  });

  it('append-only update/delete of usage ledger fails under tenant session', async () => {
    await withTenant(app, tenantA, async (tx) => {
      await expect(
        tx.inventoryUsageLedger.update({
          where: { id: usageA },
          data: { notes: 'tamper' },
        }),
      ).rejects.toThrow();
      await expect(tx.inventoryUsageLedger.delete({ where: { id: usageA } })).rejects.toThrow();
    });
  });
});
