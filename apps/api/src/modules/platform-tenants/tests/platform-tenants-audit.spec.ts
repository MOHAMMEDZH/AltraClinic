import { AuditTrailPlatformTenantsAuditLog } from '../infrastructure/audit-trail-platform-tenants-audit-log';
import { PLATFORM_TENANTS_DIRECTORY_AUDIT_TENANT_ID } from '../platform-tenants.tokens';

describe('Platform tenants audit adapter', () => {
  it('writes directory audits via platform bypass with sentinel tenant upsert', async () => {
    const created: unknown[] = [];
    const upserted: unknown[] = [];
    const client = {
      tenant: {
        upsert: jest.fn(async (args: unknown) => {
          upserted.push(args);
        }),
      },
      auditEntry: {
        create: jest.fn(async (args: { data: Record<string, unknown> }) => {
          created.push(args.data);
        }),
      },
    };
    const prisma = {
      withPlatformBypass: jest.fn(async (fn: (c: typeof client) => Promise<void>) => fn(client)),
    };
    const adapter = new AuditTrailPlatformTenantsAuditLog(prisma as never);

    await adapter.record({
      tenantId: PLATFORM_TENANTS_DIRECTORY_AUDIT_TENANT_ID,
      action: 'platform_tenants.directory.listed',
      resourceId: PLATFORM_TENANTS_DIRECTORY_AUDIT_TENANT_ID,
      actorId: '00000000-0000-4000-8000-000000000001',
      actorRoles: ['platform'],
      locale: null,
      descriptionEn: 'listed',
      descriptionAr: 'listed',
      details: { searchApplied: 'true', searchLength: '5' },
      correlationId: 'sess-not-a-uuid',
    });

    expect(prisma.withPlatformBypass).toHaveBeenCalled();
    expect(upserted).toHaveLength(1);
    expect(created).toHaveLength(1);
    const row = created[0] as {
      tenantId: string;
      actorRoles: string[];
      details: Record<string, string>;
      correlationId: string | null;
    };
    expect(row.tenantId).toBe(PLATFORM_TENANTS_DIRECTORY_AUDIT_TENANT_ID);
    expect(row.actorRoles).toEqual(['platform']);
    expect(row.details.searchApplied).toBe('true');
    expect(row.details.search).toBeUndefined();
    expect(row.correlationId).toBeNull();
  });

  it('persists UUID correlation ids only', async () => {
    const created: unknown[] = [];
    const client = {
      tenant: { upsert: jest.fn() },
      auditEntry: {
        create: jest.fn(async (args: { data: Record<string, unknown> }) => {
          created.push(args.data);
        }),
      },
    };
    const prisma = {
      withPlatformBypass: jest.fn(async (fn: (c: typeof client) => Promise<void>) => fn(client)),
    };
    const adapter = new AuditTrailPlatformTenantsAuditLog(prisma as never);
    const correlationId = '11111111-1111-4111-8111-111111111111';

    await adapter.record({
      tenantId: '22222222-2222-4222-8222-222222222222',
      action: 'platform_tenants.detail.viewed',
      resourceId: '33333333-3333-4333-8333-333333333333',
      actorId: '00000000-0000-4000-8000-000000000001',
      actorRoles: ['platform'],
      locale: null,
      descriptionEn: 'viewed',
      descriptionAr: 'viewed',
      details: null,
      correlationId,
    });

    expect((created[0] as { correlationId: string }).correlationId).toBe(correlationId);
    expect(client.tenant.upsert).not.toHaveBeenCalled();
  });
});
