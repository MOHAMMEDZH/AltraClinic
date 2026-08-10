import { BadRequestException, ForbiddenException, HttpException } from '@nestjs/common';
import { PlatformTenantsDirectoryService } from '../application/platform-tenants-directory.service';
import type { PlatformTenantsConfig } from '../config/platform-tenants.config';
import { FakePlatformTenantsAuditLog } from './support/fake-platform-tenants-audit-log';
import { PLATFORM_TENANTS_DIRECTORY_AUDIT_TENANT_ID } from '../platform-tenants.tokens';
import type { JwtClaimsVO } from '../../auth/domain/value-objects/jwt-claims.vo';

const CONFIG: PlatformTenantsConfig = {
  defaultPageSize: 25,
  maxPageSize: 100,
  maxSearchLength: 64,
  maxSubscriptionHistory: 10,
  maxAccessSummaryItems: 200,
  directoryRateLimitPerMinute: 2,
};

const CLAIMS = { sub: 'pu-1', sessionId: 'sess-1' } as JwtClaimsVO;

function makeService(opts: {
  permissions?: string[];
  rows?: Array<Record<string, unknown>>;
  total?: number;
}) {
  const audit = new FakePlatformTenantsAuditLog();
  const client = {
    $queryRaw: jest.fn(async (query: { strings?: string[] }) => {
      const sql = query.strings?.join('') ?? '';
      if (sql.includes('COUNT(*)')) {
        return [{ count: BigInt(opts.total ?? opts.rows?.length ?? 0) }];
      }
      return opts.rows ?? [];
    }),
  };
  const prisma = {
    withPlatformBypass: jest.fn(async (fn: (c: unknown) => Promise<unknown>) => fn(client)),
  };
  const authz = {
    resolveEffectivePermissions: jest.fn(async () => opts.permissions ?? ['tenant.view']),
  };
  const service = new PlatformTenantsDirectoryService(
    prisma as never,
    authz as never,
    CONFIG,
    audit,
  );
  return { service, audit, prisma, authz, client };
}

describe('PlatformTenantsDirectoryService', () => {
  it('rejects limit=all', async () => {
    const { service } = makeService({});
    await expect(service.listDirectory(CLAIMS, { limit: 'all' })).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('requires tenant.view', async () => {
    const { service } = makeService({ permissions: [] });
    await expect(service.listDirectory(CLAIMS, {})).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('requires plan.view for legacyPlan filter', async () => {
    const { service } = makeService({ permissions: ['tenant.view'] });
    await expect(
      service.listDirectory(CLAIMS, { legacyPlan: 'starter' }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('audits directory list with sentinel tenant and no raw search', async () => {
    const { service, audit } = makeService({
      rows: [
        {
          platform_tenant_id: 'pt-1',
          tenant_id: 't-1',
          display_name: 'Alpha',
          slug: 'alpha',
          status: 'ACTIVE',
          region: 'ME_SOUTH',
          trial_ends_at: null,
          created_at: new Date('2026-01-01'),
          updated_at: new Date('2026-01-02'),
          plan: 'LITE',
          facility_type: 'medical',
          subscription_status: null,
          subscription_plan: null,
        },
      ],
      total: 1,
    });

    await service.listDirectory(CLAIMS, { search: 'secret-clinic-name', page: '1' });
    expect(audit.records).toHaveLength(1);
    expect(audit.records[0].tenantId).toBe(PLATFORM_TENANTS_DIRECTORY_AUDIT_TENANT_ID);
    expect(audit.records[0].actorRoles).toEqual(['platform']);
    expect(audit.records[0].details?.searchApplied).toBe('true');
    expect(audit.records[0].details?.searchLength).toBe(String('secret-clinic-name'.length));
    expect(JSON.stringify(audit.records[0].details)).not.toContain('secret-clinic-name');
  });

  it('enforces instance-local directory rate limit', async () => {
    const { service } = makeService({ rows: [], total: 0 });
    await service.listDirectory(CLAIMS, {});
    await service.listDirectory(CLAIMS, {});
    await expect(service.listDirectory(CLAIMS, {})).rejects.toBeInstanceOf(HttpException);
  });

  it('masks legacy plan and subscription without extra permissions', async () => {
    const { service } = makeService({
      permissions: ['tenant.view'],
      rows: [
        {
          platform_tenant_id: 'pt-1',
          tenant_id: 't-1',
          display_name: 'Alpha',
          slug: 'alpha',
          status: 'ACTIVE',
          region: 'ME_SOUTH',
          trial_ends_at: null,
          created_at: new Date(),
          updated_at: new Date(),
          plan: 'PRO',
          facility_type: 'dental',
          subscription_status: 'ACTIVE',
          subscription_plan: 'PRO',
        },
      ],
      total: 1,
    });

    const page = await service.listDirectory(CLAIMS, {});
    expect(page.items[0].legacyPlan).toBeNull();
    expect(page.items[0].legacyPlanAvailability).toBe('permission_limited');
    expect(page.items[0].subscriptionSummary).toBeNull();
    expect(page.items[0].subscriptionAvailability).toBe('permission_limited');
  });

  it('returns Prisma enum strings in directory items', async () => {
    const { service } = makeService({
      permissions: ['tenant.view', 'plan.view', 'subscription.view'],
      rows: [
        {
          platform_tenant_id: 'pt-1',
          tenant_id: 't-1',
          display_name: 'Alpha',
          slug: 'alpha',
          status: 'ACTIVE',
          region: 'ME_NORTH',
          trial_ends_at: null,
          created_at: new Date(),
          updated_at: new Date(),
          plan: 'PRO',
          facility_type: 'medical',
          subscription_status: 'ACTIVE',
          subscription_plan: 'PRO',
        },
      ],
      total: 1,
    });

    const page = await service.listDirectory(CLAIMS, {});
    expect(page.items[0].status).toBe('ACTIVE');
    expect(page.items[0].region).toBe('ME_NORTH');
    expect(page.items[0].legacyPlan).toBe('PRO');
    expect(page.items[0].subscriptionSummary).toEqual({ status: 'ACTIVE', plan: 'PRO' });
  });

  it('accepts lowercase filter aliases and stores canonical enums in appliedFilters', async () => {
    const { service } = makeService({
      permissions: ['tenant.view', 'plan.view'],
      rows: [],
      total: 0,
    });

    const page = await service.listDirectory(CLAIMS, {
      status: 'active',
      region: 'me-south',
      legacyPlan: 'growth',
    });
    expect(page.appliedFilters.status).toBe('ACTIVE');
    expect(page.appliedFilters.region).toBe('ME_SOUTH');
    expect(page.appliedFilters.legacyPlan).toBe('PRO');
  });

  it('rejects unknown filter and sort values', async () => {
    const { service } = makeService({ rows: [], total: 0 });
    await expect(service.listDirectory(CLAIMS, { status: 'bogus' })).rejects.toBeInstanceOf(
      BadRequestException,
    );
    await expect(service.listDirectory(CLAIMS, { sort: 'displayNameHack' })).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('continues directory list when audit.record throws', async () => {
    const audit = {
      record: jest.fn(async () => {
        throw new Error('audit down');
      }),
    };
    const client = {
      $queryRaw: jest.fn(async (query: { strings?: string[] }) => {
        const sql = query.strings?.join('') ?? '';
        if (sql.includes('COUNT(*)')) return [{ count: BigInt(0) }];
        return [];
      }),
    };
    const prisma = {
      withPlatformBypass: jest.fn(async (fn: (c: unknown) => Promise<unknown>) => fn(client)),
    };
    const authz = { resolveEffectivePermissions: jest.fn(async () => ['tenant.view']) };
    const service = new PlatformTenantsDirectoryService(
      prisma as never,
      authz as never,
      CONFIG,
      audit as never,
    );

    const page = await service.listDirectory(CLAIMS, {});
    expect(page.items).toEqual([]);
    expect(page.warnings).toContain('audit_degraded');
  });
});
