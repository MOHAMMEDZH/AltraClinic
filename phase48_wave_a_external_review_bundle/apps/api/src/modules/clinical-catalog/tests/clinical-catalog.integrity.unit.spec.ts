/**
 * Wave A clinical catalog integrity — stableKey, bilingual publish, namespace, isolation.
 */
import {
  buildSystemCanonicalStableKey,
  buildTenantCustomStableKey,
  validateStableKeyNamespace,
  assertStableKeyImmutable,
} from '../domain/stable-key.helpers';
import { isTenantCanonicalWriteEnabled } from '../domain/feature-flag.helpers';
import { ClinicalCatalogValidationError, ClinicalCatalogForbiddenError } from '../domain/clinical-catalog.errors';
import { ClinicalCatalogService } from '../application/clinical-catalog.service';
import { FakeClinicalCatalogAuditLog } from './support/fake-clinical-catalog-audit-log';

const TENANT_A = '11111111-1111-4111-8111-111111111111';
const TENANT_B = '22222222-2222-4222-8222-222222222222';
const ACTOR = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

function buildCatalogService(opts: {
  prismaImpl?: Record<string, unknown>;
  tenantId?: string;
}) {
  const audit = new FakeClinicalCatalogAuditLog();
  const prisma = {
    withPlatformBypass: jest.fn(async (fn: (c: unknown) => Promise<unknown>) =>
      fn(opts.prismaImpl ?? {}),
    ),
  };
  const tenantContext = {
    resolve: jest.fn(async () => ({ tenantId: opts.tenantId ?? TENANT_A, branchId: null, locale: 'en' })),
  };
  const service = new ClinicalCatalogService(prisma as never, tenantContext as never, audit as never);
  return { service, audit, prisma };
}

describe('Clinical catalog stableKey helpers', () => {
  it('builds canonical and tenant custom namespaces', () => {
    expect(buildSystemCanonicalStableKey('general', 'consultation')).toBe(
      'canonical.general.consultation',
    );
    expect(buildTenantCustomStableKey(TENANT_A, 'whitening')).toBe(
      `tenant.${TENANT_A}.custom.whitening`,
    );
  });

  it('validates namespace by provenance', () => {
    expect(() =>
      validateStableKeyNamespace(
        'SYSTEM_CANONICAL',
        'canonical.general.consultation',
        null,
      ),
    ).not.toThrow();

    expect(() =>
      validateStableKeyNamespace('TENANT_CUSTOM', 'canonical.general.consultation', TENANT_A),
    ).toThrow(ClinicalCatalogValidationError);

    expect(() =>
      validateStableKeyNamespace(
        'TENANT_CUSTOM',
        buildTenantCustomStableKey(TENANT_A, 'custom_svc'),
        TENANT_A,
      ),
    ).not.toThrow();
  });

  it('blocks stableKey mutation after publish', () => {
    expect(() => assertStableKeyImmutable('PUBLISHED', 'canonical.general.new', 'canonical.general.old')).toThrow(
      ClinicalCatalogValidationError,
    );
    expect(() =>
      assertStableKeyImmutable('DRAFT', 'canonical.general.new', 'canonical.general.old'),
    ).not.toThrow();
  });
});

describe('Clinical catalog feature flag', () => {
  it('defaults missing catalog.canonical.write to enabled', () => {
    expect(isTenantCanonicalWriteEnabled(undefined)).toBe(true);
    expect(isTenantCanonicalWriteEnabled({})).toBe(true);
  });

  it('respects explicit false', () => {
    expect(isTenantCanonicalWriteEnabled({ 'catalog.canonical.write': false })).toBe(false);
  });
});

describe('ClinicalCatalogService integrity', () => {
  it('denies tenant mutation of SYSTEM_CANONICAL body', async () => {
    const canonical = {
      id: 'svc-1',
      tenantId: null,
      provenance: 'SYSTEM_CANONICAL',
      stableKey: 'canonical.general.consultation',
      lifecycle: 'PUBLISHED',
      translations: [
        { locale: 'en', displayName: 'Consultation' },
        { locale: 'ar', displayName: 'استشارة' },
      ],
    };

    const { service } = buildCatalogService({
      tenantId: TENANT_A,
      prismaImpl: {
        canonicalClinicalServiceDefinition: {
          findUnique: jest.fn(async () => canonical),
        },
      },
    });

    const actor = await service.resolveTenantActor(ACTOR, ['owner']);

    await expect(
      service.updateDraft(actor, 'svc-1', { defaultDurationMin: 45 }),
    ).rejects.toBeInstanceOf(ClinicalCatalogForbiddenError);
  });

  it('requires AR+EN displayName to publish', async () => {
    const draft = {
      id: 'svc-2',
      tenantId: TENANT_A,
      provenance: 'TENANT_CUSTOM',
      stableKey: buildTenantCustomStableKey(TENANT_A, 'svc'),
      lifecycle: 'DRAFT',
      translations: [{ locale: 'en', displayName: 'Only EN' }],
    };

    const { service } = buildCatalogService({
      tenantId: TENANT_A,
      prismaImpl: {
        canonicalClinicalServiceDefinition: {
          findUnique: jest.fn(async () => draft),
        },
      },
    });

    const actor = await service.resolveTenantActor(ACTOR, ['owner']);
    await expect(service.publish(actor, 'svc-2')).rejects.toBeInstanceOf(ClinicalCatalogValidationError);
  });

  it('enforces tenant isolation on TENANT_CUSTOM reads', async () => {
    const otherTenantService = {
      id: 'svc-3',
      tenantId: TENANT_B,
      provenance: 'TENANT_CUSTOM',
      stableKey: buildTenantCustomStableKey(TENANT_B, 'private'),
      lifecycle: 'PUBLISHED',
      translations: [],
    };

    const { service } = buildCatalogService({
      tenantId: TENANT_A,
      prismaImpl: {
        canonicalClinicalServiceDefinition: {
          findUnique: jest.fn(async () => otherTenantService),
        },
      },
    });

    const actor = await service.resolveTenantActor(ACTOR, ['owner']);
    await expect(service.getService(actor, 'svc-3')).rejects.toBeInstanceOf(ClinicalCatalogForbiddenError);
  });

  it('blocks tenant TENANT_CUSTOM create when catalog.canonical.write=false', async () => {
    const { service } = buildCatalogService({
      tenantId: TENANT_A,
      prismaImpl: {
        tenant: {
          findUnique: jest.fn(async () => ({
            features: { 'catalog.canonical.write': false },
          })),
        },
        canonicalClinicalServiceDefinition: {
          findUnique: jest.fn(async () => null),
        },
      },
    });

    const actor = await service.resolveTenantActor(ACTOR, ['owner']);
    await expect(
      service.createDraft(actor, {
        provenance: 'TENANT_CUSTOM',
        stableKey: buildTenantCustomStableKey(TENANT_A, 'blocked'),
        translations: [
          { locale: 'en', displayName: 'Blocked' },
          { locale: 'ar', displayName: 'محظور' },
        ],
      }),
    ).rejects.toBeInstanceOf(ClinicalCatalogForbiddenError);
  });
});
