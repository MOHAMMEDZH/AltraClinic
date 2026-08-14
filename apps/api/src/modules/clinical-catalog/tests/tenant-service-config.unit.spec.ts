/**
 * TenantServiceConfigService — PA-06 foreign branch fail-closed on effective lookup.
 */
import { TenantServiceConfigService } from '../application/tenant-service-config.service';
import {
  ClinicalCatalogNotFoundError,
  ClinicalCatalogValidationError,
} from '../domain/clinical-catalog.errors';
import { FakeClinicalCatalogAuditLog } from './support/fake-clinical-catalog-audit-log';

const TENANT = '11111111-1111-4111-8111-111111111111';
const SERVICE = '33333333-3333-4333-8333-333333333333';
const BRANCH = '44444444-4444-4444-8444-444444444444';
const FOREIGN = '55555555-5555-4555-8555-555555555555';
const ACTOR = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

const actor = {
  actorId: ACTOR,
  actorRoles: ['owner'],
  tenantId: TENANT,
  isPlatform: false,
};

function buildService(clientImpl: Record<string, unknown>) {
  const prisma = {
    withPlatformBypass: jest.fn(async (fn: (c: unknown) => Promise<unknown>) => fn(clientImpl)),
  };
  const tenantContext = {} as never;
  return new TenantServiceConfigService(
    prisma as never,
    tenantContext,
    new FakeClinicalCatalogAuditLog() as never,
  );
}

describe('TenantServiceConfigService getEffectiveConfig PA-06', () => {
  it('denies foreign branch before tenant-default fallback', async () => {
    const client = {
      canonicalClinicalServiceDefinition: {
        findUnique: jest.fn().mockResolvedValue({
          id: SERVICE,
          provenance: 'SYSTEM_CANONICAL',
          tenantId: null,
        }),
      },
      branch: { findFirst: jest.fn().mockResolvedValue(null) },
      tenantServiceConfiguration: { findFirst: jest.fn() },
    };
    const service = buildService(client);
    await expect(service.getEffectiveConfig(actor, SERVICE, FOREIGN)).rejects.toBeInstanceOf(
      ClinicalCatalogValidationError,
    );
    expect(client.tenantServiceConfiguration.findFirst).not.toHaveBeenCalled();
  });

  it('falls back to tenant default for own branch without override', async () => {
    const tenantCfg = {
      id: 'cfg-tenant',
      tenantId: TENANT,
      clinicalServiceId: SERVICE,
      branchId: null,
      enabled: true,
    };
    const client = {
      canonicalClinicalServiceDefinition: {
        findUnique: jest.fn().mockResolvedValue({
          id: SERVICE,
          provenance: 'SYSTEM_CANONICAL',
          tenantId: null,
        }),
      },
      branch: { findFirst: jest.fn().mockResolvedValue({ id: BRANCH }) },
      tenantServiceConfiguration: {
        findFirst: jest
          .fn()
          .mockResolvedValueOnce(null)
          .mockResolvedValueOnce(tenantCfg),
      },
    };
    const service = buildService(client);
    const result = await service.getEffectiveConfig(actor, SERVICE, BRANCH);
    expect(result.scope).toBe('tenant');
    expect(result.config.id).toBe('cfg-tenant');
  });

  it('not found when neither branch nor tenant config exists', async () => {
    const client = {
      canonicalClinicalServiceDefinition: {
        findUnique: jest.fn().mockResolvedValue({
          id: SERVICE,
          provenance: 'SYSTEM_CANONICAL',
          tenantId: null,
        }),
      },
      branch: { findFirst: jest.fn().mockResolvedValue({ id: BRANCH }) },
      tenantServiceConfiguration: {
        findFirst: jest.fn().mockResolvedValue(null),
      },
    };
    const service = buildService(client);
    await expect(service.getEffectiveConfig(actor, SERVICE, BRANCH)).rejects.toBeInstanceOf(
      ClinicalCatalogNotFoundError,
    );
  });
});
