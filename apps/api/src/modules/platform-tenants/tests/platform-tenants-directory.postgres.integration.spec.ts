import { ForbiddenException } from '@nestjs/common';

import { PlatformTenantsDirectoryService } from '../application/platform-tenants-directory.service';

import { loadPlatformTenantsConfig } from '../config/platform-tenants.config';

import { FakePlatformTenantsAuditLog } from './support/fake-platform-tenants-audit-log';

import {

  cleanupPlatformTenantsTables,

  createPlatformDbSecurityClient,

  createTenantsPrismaWrapper,

  platformDbSecurityEnabled,

  seedTenantDirectoryFixtures,

  TIE_BREAK_DISPLAY_NAME,

  type TenantDirectoryFixture,

} from './platform-tenants-db.harness';

import type { JwtClaimsVO } from '../../auth/domain/value-objects/jwt-claims.vo';



const run = platformDbSecurityEnabled();

const CLAIMS = { sub: 'pu-directory', sessionId: 'sess-directory' } as JwtClaimsVO;

const FULL_PERMS = ['tenant.view', 'plan.view', 'subscription.view'];



function makeService(

  prisma: ReturnType<typeof createPlatformDbSecurityClient>,

  permissions: string[] = FULL_PERMS,

) {

  const audit = new FakePlatformTenantsAuditLog();

  const authz = {

    resolveEffectivePermissions: jest.fn(async () => permissions),

  };

  return new PlatformTenantsDirectoryService(

    createTenantsPrismaWrapper(prisma) as never,

    authz as never,

    loadPlatformTenantsConfig(),

    audit,

  );

}



describe('Platform tenants directory postgres integration', () => {

  let prisma: ReturnType<typeof createPlatformDbSecurityClient>;

  let fixtures: TenantDirectoryFixture[];



  beforeAll(async () => {

    if (!run) return;

    prisma = createPlatformDbSecurityClient();

  });



  afterAll(async () => {

    if (!run || !prisma) return;

    await prisma.$disconnect();

  });



  beforeEach(async () => {

    if (!run) return;

    await cleanupPlatformTenantsTables(prisma);

    fixtures = await seedTenantDirectoryFixtures(prisma);

    expect(fixtures.length).toBeGreaterThanOrEqual(80);

  });



  (run ? it : it.skip)('paginates all fixtures without duplicate ids', async () => {

    const service = makeService(prisma);

    const seen = new Set<string>();

    let page = 1;



    while (true) {

      const result = await service.listDirectory(CLAIMS, { page: String(page), pageSize: '25' });

      for (const item of result.items) {

        expect(seen.has(item.platformTenantId)).toBe(false);

        seen.add(item.platformTenantId);

      }

      if (!result.pagination.hasNextPage) break;

      page += 1;

    }



    expect(seen.size).toBe(fixtures.length);

    for (const fixture of fixtures) {

      expect(seen.has(fixture.platformTenantId)).toBe(true);

    }

  });



  (run ? it : it.skip)('sorts displayName asc with platformTenantId tie-break', async () => {

    const service = makeService(prisma);

    const result = await service.listDirectory(CLAIMS, {

      sort: 'displayName',

      direction: 'asc',

      pageSize: '100',

    });



    const tieBreakItems = result.items.filter((item) => item.displayName === TIE_BREAK_DISPLAY_NAME);

    expect(tieBreakItems.length).toBe(4);

    for (let i = 1; i < tieBreakItems.length; i++) {

      expect(tieBreakItems[i].platformTenantId > tieBreakItems[i - 1].platformTenantId).toBe(true);

    }



    for (let i = 1; i < result.items.length; i++) {

      const prev = result.items[i - 1];

      const curr = result.items[i];

      const nameCmp = prev.displayName.localeCompare(curr.displayName);

      expect(nameCmp <= 0).toBe(true);

      if (nameCmp === 0) {

        expect(prev.platformTenantId <= curr.platformTenantId).toBe(true);

      }

    }

  });



  (run ? it : it.skip)('reconciles status, facilityType, and legacyPlan filters', async () => {

    const service = makeService(prisma);

    const target = fixtures.find((f) => f.status === 'ACTIVE' && f.facilityType === 'medical' && f.legacyPlan === 'PRO');

    expect(target).toBeDefined();



    const page = await service.listDirectory(CLAIMS, {

      status: 'ACTIVE',

      facilityType: 'medical',

      legacyPlan: 'PRO',

      pageSize: '100',

    });



    expect(page.items.length).toBeGreaterThan(0);

    expect(page.items.every((item) => item.status === 'ACTIVE')).toBe(true);

    expect(page.items.every((item) => item.facilityType === 'medical')).toBe(true);

    expect(page.items.every((item) => item.legacyPlan === 'PRO')).toBe(true);

    expect(page.items.some((item) => item.platformTenantId === target!.platformTenantId)).toBe(true);

  });



  (run ? it : it.skip)('searches by displayName and slug', async () => {

    const service = makeService(prisma);

    const sample = fixtures[10];



    const byName = await service.listDirectory(CLAIMS, { search: sample.displayName });

    expect(byName.items.some((item) => item.platformTenantId === sample.platformTenantId)).toBe(true);



    const bySlug = await service.listDirectory(CLAIMS, { search: sample.slug });

    expect(bySlug.items.some((item) => item.platformTenantId === sample.platformTenantId)).toBe(true);

  });



  (run ? it : it.skip)('returns Prisma enum strings for plan and subscription status', async () => {

    const service = makeService(prisma);

    const proFixture = fixtures.find((f) => f.legacyPlan === 'PRO' && f.subscriptionStatus === 'ACTIVE');

    expect(proFixture).toBeDefined();



    const page = await service.listDirectory(CLAIMS, {

      search: proFixture!.slug,

    });

    expect(page.items[0].legacyPlan).toBe('PRO');

    expect(page.items[0].subscriptionSummary?.status).toBe('ACTIVE');

    expect(page.items[0].subscriptionSummary?.plan).toBe('PRO');

  });



  (run ? it : it.skip)('rejects subscriptionStatus filter without subscription.view', async () => {

    const service = makeService(prisma, ['tenant.view', 'plan.view']);

    await expect(

      service.listDirectory(CLAIMS, { subscriptionStatus: 'ACTIVE' }),

    ).rejects.toBeInstanceOf(ForbiddenException);

  });

});

