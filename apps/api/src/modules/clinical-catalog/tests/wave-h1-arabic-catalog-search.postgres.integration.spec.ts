/**
 * Wave H1 / P1-08 — Arabic catalog search against PostgreSQL (AR-02).
 *
 * Run:
 *   ALLOW_TEST_DATABASE_RESET=true RUN_PLATFORM_DB_SECURITY=true \
 *   npx jest --runInBand --testPathIgnorePatterns=[] \
 *   --testPathPattern=wave-h1-arabic-catalog-search.postgres
 */
import { randomUUID } from 'crypto';
import type { PrismaClient } from '@prisma/client';
import {
  cleanupWaveAFixtures,
  createClinicalCatalogService,
  createClinicalPrismaWrapper,
  createPlatformDbSecurityClient,
  platformDbSecurityEnabled,
} from './clinical-catalog-db.harness';

jest.setTimeout(120_000);

const describeDb = platformDbSecurityEnabled() ? describe : describe.skip;

describeDb('Wave H1 Arabic catalog search (PostgreSQL)', () => {
  let prisma: PrismaClient;
  let tenantA: string;
  let tenantB: string;
  let serviceId: string;
  let otherTenantServiceId: string;
  let actorA: string;

  beforeAll(async () => {
    prisma = createPlatformDbSecurityClient();
    await prisma.$connect();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    tenantA = randomUUID();
    tenantB = randomUUID();
    actorA = randomUUID();
    const wrapper = createClinicalPrismaWrapper(prisma);

    await wrapper.withPlatformBypass(async (c) => {
      await c.tenant.create({
        data: { id: tenantA, name: 'H1 Ten A', slug: `h1a-${tenantA.slice(0, 8)}`, features: {} },
      });
      await c.tenant.create({
        data: { id: tenantB, name: 'H1 Ten B', slug: `h1b-${tenantB.slice(0, 8)}`, features: {} },
      });

      serviceId = (
        await c.canonicalClinicalServiceDefinition.create({
          data: {
            tenantId: tenantA,
            provenance: 'TENANT_CUSTOM',
            stableKey: `tenant.${tenantA}.custom.h1_consult`,
            domain: 'GENERAL',
            lifecycle: 'PUBLISHED',
            publishedAt: new Date(),
            translations: {
              create: [
                { locale: 'en', displayName: 'H1 Consultation' },
                { locale: 'ar', displayName: 'استشارة H1' },
              ],
            },
            aliases: {
              create: [
                { locale: 'ar', aliasText: 'كشفية H1', isActive: true },
                { locale: 'ar', aliasText: 'لقب معطل', isActive: false },
                { locale: 'en', aliasText: 'H1 checkup', isActive: true },
              ],
            },
          },
        })
      ).id;

      otherTenantServiceId = (
        await c.canonicalClinicalServiceDefinition.create({
          data: {
            tenantId: tenantB,
            provenance: 'TENANT_CUSTOM',
            stableKey: `tenant.${tenantB}.custom.h1_secret`,
            domain: 'GENERAL',
            lifecycle: 'PUBLISHED',
            publishedAt: new Date(),
            translations: {
              create: [
                { locale: 'en', displayName: 'Secret B Consult' },
                { locale: 'ar', displayName: 'استشارة سرية B' },
              ],
            },
            aliases: {
              create: [{ locale: 'ar', aliasText: 'كشفية H1', isActive: true }],
            },
          },
        })
      ).id;
    });
  });

  afterEach(async () => {
    await cleanupWaveAFixtures(prisma, [tenantA, tenantB]);
  });

  it('H1-PG-01 — Arabic displayName finds the same canonical id as English displayName', async () => {
    const { service } = createClinicalCatalogService({ prisma, tenantId: tenantA });
    const actor = await service.resolveTenantActor(actorA, ['owner']);

    const byAr = await service.listServices(actor, { search: 'استشارة H1' });
    const byEn = await service.listServices(actor, { search: 'H1 Consultation' });

    expect(byAr.map((s) => s.id)).toEqual([serviceId]);
    expect(byEn.map((s) => s.id)).toEqual([serviceId]);
    expect(byAr[0].id).toBe(byEn[0].id);
  });

  it('H1-PG-02 — active Arabic alias matches; inactive alias does not', async () => {
    const { service } = createClinicalCatalogService({ prisma, tenantId: tenantA });
    const actor = await service.resolveTenantActor(actorA, ['owner']);

    const active = await service.listServices(actor, { search: 'كشفية H1' });
    expect(active.map((s) => s.id)).toEqual([serviceId]);

    const inactive = await service.listServices(actor, { search: 'لقب معطل' });
    expect(inactive.map((s) => s.id)).not.toContain(serviceId);
    expect(inactive).toHaveLength(0);
  });

  it('H1-PG-03 — stableKey search still works', async () => {
    const { service } = createClinicalCatalogService({ prisma, tenantId: tenantA });
    const actor = await service.resolveTenantActor(actorA, ['owner']);

    const rows = await service.listServices(actor, { search: 'h1_consult' });
    expect(rows.map((s) => s.id)).toEqual([serviceId]);
  });

  it('H1-PG-04 — cross-tenant: tenant A cannot see tenant B custom via shared Arabic alias text', async () => {
    const { service } = createClinicalCatalogService({ prisma, tenantId: tenantA });
    const actor = await service.resolveTenantActor(actorA, ['owner']);

    const rows = await service.listServices(actor, { search: 'كشفية H1' });
    expect(rows.map((s) => s.id)).toEqual([serviceId]);
    expect(rows.map((s) => s.id)).not.toContain(otherTenantServiceId);

    const secretAr = await service.listServices(actor, { search: 'استشارة سرية B' });
    expect(secretAr.map((s) => s.id)).not.toContain(otherTenantServiceId);
    expect(secretAr).toHaveLength(0);
  });
});
