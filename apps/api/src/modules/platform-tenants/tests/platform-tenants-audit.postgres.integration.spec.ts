import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'crypto';

import { PlatformTenantsDirectoryService } from '../application/platform-tenants-directory.service';
import { PlatformTenantsDetailService } from '../application/platform-tenants-detail.service';
import { AuditTrailPlatformTenantsAuditLog } from '../infrastructure/audit-trail-platform-tenants-audit-log';
import { loadPlatformTenantsConfig } from '../config/platform-tenants.config';
import { PLATFORM_TENANTS_DIRECTORY_AUDIT_TENANT_ID } from '../platform-tenants.tokens';
import {
  cleanupPlatformTenantsTables,
  createPlatformDbSecurityClient,
  createTenantsPrismaWrapper,
  platformDbSecurityEnabled,
} from './platform-tenants-db.harness';
import type { JwtClaimsVO } from '../../auth/domain/value-objects/jwt-claims.vo';

const run = platformDbSecurityEnabled();
const ACTOR_ID = '00000000-0000-4000-8000-000000000099';
const SECRET_SEARCH = 'SECRET_SEARCH_TOKEN_xyz';
const CONFIG = loadPlatformTenantsConfig();

function makeClaims(correlationId: string): JwtClaimsVO {
  return { sub: ACTOR_ID, sessionId: correlationId } as JwtClaimsVO;
}

function createAuditLog(prisma: PrismaClient): AuditTrailPlatformTenantsAuditLog {
  const prismaService = Object.assign(prisma, {
    withPlatformBypass: async <T>(fn: (client: PrismaClient) => Promise<T>): Promise<T> =>
      prisma.$transaction(
        async (tx) => {
          await tx.$executeRaw`SELECT set_config('app.platform_rls_bypass', 'true', true)`;
          await tx.$executeRaw`SELECT set_config('app.current_tenant_id', '', true)`;
          return fn(tx as unknown as PrismaClient);
        },
        { timeout: 30_000 },
      ),
  });
  return new AuditTrailPlatformTenantsAuditLog(prismaService as never);
}

async function findAuditEntries(prisma: PrismaClient, where: Record<string, unknown>) {
  return prisma.$transaction(
    async (tx) => {
      await tx.$executeRaw`SELECT set_config('app.platform_rls_bypass', 'true', true)`;
      await tx.$executeRaw`SELECT set_config('app.current_tenant_id', '', true)`;
      return tx.auditEntry.findMany({
        where,
        orderBy: { createdAt: 'desc' },
      });
    },
    { timeout: 30_000 },
  );
}

async function findAuditEntry(prisma: PrismaClient, where: Record<string, unknown>) {
  return prisma.$transaction(
    async (tx) => {
      await tx.$executeRaw`SELECT set_config('app.platform_rls_bypass', 'true', true)`;
      await tx.$executeRaw`SELECT set_config('app.current_tenant_id', '', true)`;
      return tx.auditEntry.findFirst({ where });
    },
    { timeout: 30_000 },
  );
}

async function seedSingleTenant(prisma: PrismaClient) {
  const slug = `pt-audit-pg-${randomUUID().slice(0, 8)}`;
  const tenant = await prisma.tenant.create({
    data: {
      name: 'Audit PG Clinic',
      slug,
      features: { clinicProfile: { clinicType: 'dental' } },
    },
  });
  const platformTenant = await prisma.platformTenant.create({
    data: {
      tenantId: tenant.id,
      displayName: 'Audit PG Clinic',
      region: 'ME_SOUTH',
      plan: 'PRO',
      status: 'ACTIVE',
      provisionedBy: randomUUID(),
    },
  });
  await prisma.platformSubscription.create({
    data: {
      platformTenantId: platformTenant.id,
      plan: 'PRO',
      status: 'ACTIVE',
      pricePerMonth: 49,
      startDate: new Date(),
      endDate: new Date(Date.now() + 365 * 86_400_000),
    },
  });
  return { tenantId: tenant.id, platformTenantId: platformTenant.id };
}

describe('Platform tenants audit postgres integration', () => {
  let prisma: ReturnType<typeof createPlatformDbSecurityClient>;
  let auditLog: AuditTrailPlatformTenantsAuditLog;

  beforeAll(async () => {
    if (!run) return;
    prisma = createPlatformDbSecurityClient();
    auditLog = createAuditLog(prisma);
  });

  afterAll(async () => {
    if (!run || !prisma) return;
    await prisma.$disconnect();
  });

  (run ? it : it.skip)('persists directory list audit with search metadata but not raw search string', async () => {
    const correlationId = randomUUID();
    const claims = makeClaims(correlationId);
    await cleanupPlatformTenantsTables(prisma);
    await seedSingleTenant(prisma);

    const authz = { resolveEffectivePermissions: jest.fn(async () => ['tenant.view']) };
    const directory = new PlatformTenantsDirectoryService(
      createTenantsPrismaWrapper(prisma) as never,
      authz as never,
      CONFIG,
      auditLog,
    );

    await directory.listDirectory(claims, { search: SECRET_SEARCH, page: '1' });

    const entries = await findAuditEntries(prisma, {
      action: 'platform_tenants.directory.listed',
      actorId: ACTOR_ID,
      correlationId,
    });
    expect(entries).toHaveLength(1);
    expect(entries[0].tenantId).toBe(PLATFORM_TENANTS_DIRECTORY_AUDIT_TENANT_ID);
    const details = entries[0].details as Record<string, string>;
    expect(details.searchApplied).toBe('true');
    expect(details.searchLength).toBe(String(SECRET_SEARCH.length));
    expect(JSON.stringify(details)).not.toContain(SECRET_SEARCH);
  });

  (run ? it : it.skip)('persists detail and access-summary view audits with tenant resource id', async () => {
    const correlationId = randomUUID();
    const claims = makeClaims(correlationId);
    await cleanupPlatformTenantsTables(prisma);
    const seeded = await seedSingleTenant(prisma);

    const authz = {
      resolveEffectivePermissions: jest.fn(async () => [
        'tenant.view',
        'plan.view',
        'subscription.view',
        'entitlement.view',
      ]),
    };
    const licensing = {
      resolveLicense: jest.fn(async () => ({
        licenseId: 'lic',
        tenantId: seeded.tenantId,
        platformTenantId: seeded.platformTenantId,
        displayName: 'Audit PG Clinic',
        uiPlan: 'starter',
        backendPlan: 'lite',
        platformPlan: 'starter',
        status: 'active',
        subscriptionStatus: 'active',
        platformStatus: 'active',
        billingCycle: 'monthly',
        startDate: null,
        endDate: null,
        renewalDate: null,
        trialEndsAt: null,
        contractEndDate: null,
        gracePeriodEndsAt: null,
        autoRenew: false,
        readOnly: false,
        limits: {},
        effectiveLimits: { maxUsers: 5 },
        grants: { usersBonus: 0, storageGbBonus: 0, aiCreditsBonus: 0 },
        features: {},
        modules: {},
        backendFeatures: {},
        grantHistory: [],
        version: 1,
      })),
    };
    const detail = new PlatformTenantsDetailService(
      createTenantsPrismaWrapper(prisma) as never,
      authz as never,
      licensing as never,
      CONFIG,
      auditLog,
    );

    await detail.getDetail(claims, seeded.platformTenantId);
    await detail.getAccessSummary(claims, seeded.platformTenantId);

    const detailAudit = await findAuditEntry(prisma, {
      action: 'platform_tenants.detail.viewed',
      actorId: ACTOR_ID,
      correlationId,
    });
    expect(detailAudit?.resourceId).toBe(seeded.platformTenantId);
    expect(detailAudit?.tenantId).toBe(seeded.tenantId);

    const summaryAudit = await findAuditEntry(prisma, {
      action: 'platform_tenants.access_summary.viewed',
      actorId: ACTOR_ID,
      correlationId,
    });
    expect(summaryAudit?.resourceId).toBe(seeded.platformTenantId);
    expect(summaryAudit?.tenantId).toBe(seeded.tenantId);
  });

  (run ? it : it.skip)('directory list succeeds when audit persistence throws', async () => {
    const claims = makeClaims(randomUUID());
    await cleanupPlatformTenantsTables(prisma);
    await seedSingleTenant(prisma);

    const failingAudit = {
      record: jest.fn(async () => {
        throw new Error('audit persistence failed');
      }),
    };
    const authz = { resolveEffectivePermissions: jest.fn(async () => ['tenant.view']) };
    const directory = new PlatformTenantsDirectoryService(
      createTenantsPrismaWrapper(prisma) as never,
      authz as never,
      CONFIG,
      failingAudit as never,
    );

    const page = await directory.listDirectory(claims, {});
    expect(page.warnings).toContain('audit_degraded');
    expect(page.items.length).toBeGreaterThan(0);
  });

  (run ? it : it.skip)('persists filter metadata and omits forbidden redaction sentinels from serialized row', async () => {
    const correlationId = randomUUID();
    const claims = makeClaims(correlationId);
    await cleanupPlatformTenantsTables(prisma);
    await seedSingleTenant(prisma);

    const FORBIDDEN = {
      rawSearch: 'RAW_SEARCH_QUERY_SENTINEL',
      email: 'contact-email-sentinel@example.test',
      phone: '+1555-SENTINEL-PHONE',
      token: 'ACCESS_TOKEN_SENTINEL_VALUE',
      session: 'SESSION_ID_SENTINEL_VALUE',
      featureSecret: 'FEATURE_SECRET_SENTINEL',
      licenseSecret: 'LICENSE_SECRET_SENTINEL',
      patient: 'PATIENT_NAME_SENTINEL',
      clinical: 'CLINICAL_NOTE_SENTINEL',
      apiResponse: 'RAW_API_RESPONSE_SENTINEL',
    };

    const authz = {
      resolveEffectivePermissions: jest.fn(async () => [
        'tenant.view',
        'plan.view',
        'subscription.view',
      ]),
    };
    const directory = new PlatformTenantsDirectoryService(
      createTenantsPrismaWrapper(prisma) as never,
      authz as never,
      CONFIG,
      auditLog,
    );

    await directory.listDirectory(claims, {
      search: FORBIDDEN.rawSearch,
      status: 'ACTIVE',
      facilityType: 'dental',
      legacyPlan: 'PRO',
      subscriptionStatus: 'ACTIVE',
      page: '1',
    });

    const entries = await findAuditEntries(prisma, {
      action: 'platform_tenants.directory.listed',
      actorId: ACTOR_ID,
      correlationId,
    });
    expect(entries).toHaveLength(1);
    const serialized = JSON.stringify(entries[0]);
    for (const value of Object.values(FORBIDDEN)) {
      expect(serialized).not.toContain(value);
    }
    const details = entries[0].details as Record<string, string>;
    expect(details.searchApplied).toBe('true');
    expect(details.status).toBe('ACTIVE');
    expect(details.facilityType).toBe('dental');
    expect(details.legacyPlan).toBe('PRO');
    expect(details.subscriptionStatus).toBe('ACTIVE');
    // Allowlisted marker only — raw search string must never appear.
    expect(details.search).toBe('applied');
    expect(serialized).not.toContain(FORBIDDEN.rawSearch);
  });

  (run ? it : it.skip)('omits malformed and oversized correlation ids from persisted audit rows', async () => {
    await cleanupPlatformTenantsTables(prisma);
    await seedSingleTenant(prisma);

    await auditLog.record({
      tenantId: PLATFORM_TENANTS_DIRECTORY_AUDIT_TENANT_ID,
      action: 'platform_tenants.directory.listed',
      resourceId: PLATFORM_TENANTS_DIRECTORY_AUDIT_TENANT_ID,
      actorId: ACTOR_ID,
      actorRoles: ['platform'],
      locale: null,
      descriptionEn: 'listed',
      descriptionAr: 'listed',
      details: { page: '1' },
      correlationId: 'not-a-uuid',
    });
    await auditLog.record({
      tenantId: PLATFORM_TENANTS_DIRECTORY_AUDIT_TENANT_ID,
      action: 'platform_tenants.directory.listed',
      resourceId: PLATFORM_TENANTS_DIRECTORY_AUDIT_TENANT_ID,
      actorId: ACTOR_ID,
      actorRoles: ['platform'],
      locale: null,
      descriptionEn: 'listed',
      descriptionAr: 'listed',
      details: { page: '2' },
      correlationId: `${randomUUID()}-oversized-suffix-that-is-not-a-uuid`,
    });

    const rows = await findAuditEntries(prisma, {
      action: 'platform_tenants.directory.listed',
      actorId: ACTOR_ID,
    });
    const recent = rows.slice(0, 2);
    expect(recent.every((row) => row.correlationId === null)).toBe(true);
  });

  (run ? it : it.skip)('persists capability and limit explanation audits without raw license payloads', async () => {
    const correlationId = randomUUID();
    const claims = makeClaims(correlationId);
    await cleanupPlatformTenantsTables(prisma);
    const seeded = await seedSingleTenant(prisma);

    const authz = {
      resolveEffectivePermissions: jest.fn(async () => ['tenant.view', 'entitlement.view']),
    };
    const licensing = {
      resolveLicense: jest.fn(async () => ({
        licenseId: 'lic',
        tenantId: seeded.tenantId,
        platformTenantId: seeded.platformTenantId,
        displayName: 'Audit PG Clinic',
        uiPlan: 'starter',
        backendPlan: 'lite',
        platformPlan: 'starter',
        status: 'active',
        subscriptionStatus: 'active',
        platformStatus: 'active',
        billingCycle: 'monthly',
        startDate: null,
        endDate: null,
        renewalDate: null,
        trialEndsAt: null,
        contractEndDate: null,
        gracePeriodEndsAt: null,
        autoRenew: false,
        readOnly: false,
        limits: { maxUsers: 5 },
        effectiveLimits: { maxUsers: 5 },
        grants: { usersBonus: 0, storageGbBonus: 0, aiCreditsBonus: 0 },
        features: { online_booking: 'enabled' },
        modules: { patients: 'full' },
        backendFeatures: {},
        grantHistory: [],
        version: 1,
      })),
    };
    const detail = new PlatformTenantsDetailService(
      createTenantsPrismaWrapper(prisma) as never,
      authz as never,
      licensing as never,
      CONFIG,
      auditLog,
    );

    await detail.getAccessSummaryItem(claims, seeded.platformTenantId, 'patients');
    await detail.getAccessSummaryItem(claims, seeded.platformTenantId, 'maxUsers');

    const capabilityAudit = await findAuditEntry(prisma, {
      action: 'platform_tenants.capability_explanation.viewed',
      actorId: ACTOR_ID,
      correlationId,
    });
    expect(capabilityAudit?.resourceId).toBe(seeded.platformTenantId);
    expect((capabilityAudit?.details as Record<string, string>).capabilityKey).toBe('patients');
    expect(JSON.stringify(capabilityAudit)).not.toContain('online_booking');
    expect(JSON.stringify(capabilityAudit)).not.toContain('LICENSE_SECRET');

    const limitAudit = await findAuditEntry(prisma, {
      action: 'platform_tenants.limit_explanation.viewed',
      actorId: ACTOR_ID,
      correlationId,
    });
    expect(limitAudit?.resourceId).toBe(seeded.platformTenantId);
    expect((limitAudit?.details as Record<string, string>).capabilityKey).toBe('maxUsers');
    expect((limitAudit?.details as Record<string, string>).section).toBe('limit');
  });

  /**
   * Denial audit policy (Step 11): ForbiddenException paths for missing
   * tenant.view / plan.view / subscription.view / entitlement.view do NOT
   * persist audit rows. Marked Not Applicable — no sensitive denial payload.
   */
  (run ? it : it.skip)('does not persist audit rows for permission denials (policy N/A)', async () => {
    const claims = makeClaims(randomUUID());
    await cleanupPlatformTenantsTables(prisma);
    await seedSingleTenant(prisma);

    const before = await findAuditEntries(prisma, { actorId: ACTOR_ID });
    const authz = { resolveEffectivePermissions: jest.fn(async () => [] as string[]) };
    const directory = new PlatformTenantsDirectoryService(
      createTenantsPrismaWrapper(prisma) as never,
      authz as never,
      CONFIG,
      auditLog,
    );

    await expect(directory.listDirectory(claims, {})).rejects.toThrow(/tenant\.view/);
    const after = await findAuditEntries(prisma, { actorId: ACTOR_ID });
    expect(after.length).toBe(before.length);
  });
});
