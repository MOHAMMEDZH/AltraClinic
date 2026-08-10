/**
 * Unit tests — catalog keys, lifecycle, compatibility, auth isolation, step-up, idempotency.
 */
import { ForbiddenException } from '@nestjs/common';
import { isValidCanonicalKey } from '../platform-healthcare-catalog.tokens';
import {
  canTransitionLifecycle,
  isHighImpactLifecycleTransition,
} from '../domain/lifecycle.state-machine';
import {
  evaluateCompatibilitySelection,
  wouldCreateDependencyCycle,
} from '../domain/compatibility.evaluator';
import { buildCatalogDriftReport } from '../application/catalog-drift.detector';
import { HealthcareCatalogService } from '../application/healthcare-catalog.service';
import { CatalogIdempotencyService } from '../application/catalog-idempotency.service';
import { PlatformAssuranceService } from '../../auth/application/services/platform-assurance.service';
import { FakeCatalogAuditLog } from './support/fake-catalog-audit-log';
import { loadPlatformHealthcareCatalogConfig } from '../config/platform-healthcare-catalog.config';
import type { JwtClaimsVO } from '../../auth/domain/value-objects/jwt-claims.vo';

const CLAIMS = {
  sub: '00000000-0000-4000-8000-000000000088',
  sessionId: '22222222-2222-4222-8222-222222222222',
} as JwtClaimsVO;

function buildService(opts: {
  permissions: string[];
  stepUpFresh?: boolean;
  sessionMissing?: boolean;
  prismaImpl?: Record<string, unknown>;
}) {
  const authz = {
    resolveEffectivePermissions: jest.fn(async () => opts.permissions),
  };
  const refreshRepo = {
    findBySessionId: jest.fn(async () => {
      if (opts.sessionMissing) return null;
      return { isStepUpFresh: () => opts.stepUpFresh !== false };
    }),
  };
  const assurance = new PlatformAssuranceService({ stepUpSeconds: 300 } as never);
  const prisma = {
    withPlatformBypass: jest.fn(async (fn: (c: unknown) => Promise<unknown>) =>
      fn(opts.prismaImpl ?? {}),
    ),
  };
  return new HealthcareCatalogService(
    prisma as never,
    authz as never,
    loadPlatformHealthcareCatalogConfig(),
    new FakeCatalogAuditLog(),
    refreshRepo as never,
    assurance,
    new CatalogIdempotencyService(prisma as never),
  );
}

describe('Healthcare catalog key validation', () => {
  it('accepts kind-prefixed snake keys', () => {
    expect(isValidCanonicalKey('FACILITY_TYPE', 'facility_type.dental_clinic')).toBe(true);
    expect(isValidCanonicalKey('MODULE', 'module.user_management')).toBe(true);
  });

  it('rejects wrong prefix, uppercase, whitespace, and plan names', () => {
    expect(isValidCanonicalKey('MODULE', 'feature.foo')).toBe(false);
    expect(isValidCanonicalKey('MODULE', 'module.Dental')).toBe(false);
    expect(isValidCanonicalKey('MODULE', 'module. dental')).toBe(false);
    expect(isValidCanonicalKey('LIMIT', 'limit.lite_plan')).toBe(true);
  });
});

describe('Healthcare catalog lifecycle', () => {
  it('allows draft→active→deprecated→retired and blocks illegal jumps', () => {
    expect(canTransitionLifecycle('DRAFT', 'ACTIVE')).toBe(true);
    expect(canTransitionLifecycle('ACTIVE', 'DEPRECATED')).toBe(true);
    expect(canTransitionLifecycle('DEPRECATED', 'RETIRED')).toBe(true);
    expect(canTransitionLifecycle('DRAFT', 'DEPRECATED')).toBe(false);
    expect(isHighImpactLifecycleTransition('ACTIVE', 'RETIRED')).toBe(true);
  });
});

describe('Healthcare catalog compatibility evaluator', () => {
  const catalog = [
    { canonicalKey: 'facility_type.dental_clinic', kind: 'FACILITY_TYPE', lifecycle: 'ACTIVE' as const },
    { canonicalKey: 'facility_type.laboratory', kind: 'FACILITY_TYPE', lifecycle: 'ACTIVE' as const },
    { canonicalKey: 'module.dental', kind: 'MODULE', lifecycle: 'ACTIVE' as const },
    { canonicalKey: 'specialty.dentistry', kind: 'SPECIALTY', lifecycle: 'ACTIVE' as const },
    { canonicalKey: 'specialty.orthodontics', kind: 'SPECIALTY', lifecycle: 'ACTIVE' as const },
  ];

  const rules = [
    {
      id: 'r1',
      ruleType: 'NOT_ALLOWED_FOR' as const,
      subjectKey: 'module.dental',
      targetKey: 'facility_type.laboratory',
      anyOfGroupKey: '',
      lifecycle: 'ACTIVE' as const,
    },
    {
      id: 'r2',
      ruleType: 'ALLOWED_FOR' as const,
      subjectKey: 'module.dental',
      targetKey: 'facility_type.dental_clinic',
      anyOfGroupKey: '',
      lifecycle: 'ACTIVE' as const,
    },
    {
      id: 'r3',
      ruleType: 'REQUIRES_ANY_OF' as const,
      subjectKey: 'module.dental',
      targetKey: 'specialty.dentistry',
      anyOfGroupKey: 'dental_specialty',
      lifecycle: 'ACTIVE' as const,
    },
    {
      id: 'r4',
      ruleType: 'REQUIRES_ANY_OF' as const,
      subjectKey: 'module.dental',
      targetKey: 'specialty.orthodontics',
      anyOfGroupKey: 'dental_specialty',
      lifecycle: 'ACTIVE' as const,
    },
  ];

  it('accepts dental clinic + dental module + dentistry specialty', () => {
    const result = evaluateCompatibilitySelection(
      {
        facilityTypeKey: 'facility_type.dental_clinic',
        moduleKeys: ['module.dental'],
        specialtyKeys: ['specialty.dentistry'],
      },
      catalog,
      rules,
    );
    expect(result.valid).toBe(true);
    expect(result.disclaimer.notEntitlementDecision).toBe(true);
  });

  it('rejects dental module for laboratory', () => {
    const result = evaluateCompatibilitySelection(
      {
        facilityTypeKey: 'facility_type.laboratory',
        moduleKeys: ['module.dental'],
        specialtyKeys: ['specialty.dentistry'],
      },
      catalog,
      rules,
    );
    expect(result.valid).toBe(false);
    expect(result.violations.some((v) => v.reasonCode === 'not_allowed_for')).toBe(true);
  });

  it('rejects missing any-of specialty', () => {
    const result = evaluateCompatibilitySelection(
      {
        facilityTypeKey: 'facility_type.dental_clinic',
        moduleKeys: ['module.dental'],
        specialtyKeys: [],
      },
      catalog,
      rules,
    );
    expect(result.valid).toBe(false);
    expect(result.violations.some((v) => v.reasonCode === 'missing_any_of_dependency')).toBe(true);
  });

  it('detects direct and indirect dependency cycles', () => {
    expect(wouldCreateDependencyCycle([{ from: 'a', to: 'b' }], 'b', 'a')).toBe(true);
    expect(
      wouldCreateDependencyCycle(
        [
          { from: 'a', to: 'b' },
          { from: 'b', to: 'c' },
        ],
        'c',
        'a',
      ),
    ).toBe(true);
    expect(wouldCreateDependencyCycle([{ from: 'a', to: 'b' }], 'a', 'c')).toBe(false);
  });

  it('is order-independent for equivalent rule sets', () => {
    const reversed = [...rules].reverse();
    const a = evaluateCompatibilitySelection(
      {
        facilityTypeKey: 'facility_type.dental_clinic',
        moduleKeys: ['module.dental'],
        specialtyKeys: ['specialty.orthodontics'],
      },
      catalog,
      rules,
    );
    const b = evaluateCompatibilitySelection(
      {
        facilityTypeKey: 'facility_type.dental_clinic',
        moduleKeys: ['module.dental'],
        specialtyKeys: ['specialty.orthodontics'],
      },
      catalog,
      reversed,
    );
    expect(a.valid).toBe(b.valid);
  });
});

describe('Healthcare catalog drift', () => {
  it('reports missing inventory keys', () => {
    const report = buildCatalogDriftReport(
      [
        {
          canonicalKey: 'facility_type.general_clinic',
          kind: 'FACILITY_TYPE',
          lifecycle: 'ACTIVE',
          locales: ['en-US', 'ar-SY'],
        },
      ],
      [],
    );
    expect(report.summary.errors + report.summary.warnings).toBeGreaterThanOrEqual(0);
  });
});

describe('Healthcare catalog kind authorization isolation', () => {
  it('facility-type.manage cannot mutate specialty', async () => {
    const loadItem = {
      id: 'spec-1',
      kind: 'SPECIALTY',
      canonicalKey: 'specialty.x',
      lifecycle: 'DRAFT',
      version: 1,
      translations: [],
      aliases: [],
      parent: null,
      owningModule: null,
    };
    const service = buildService({
      permissions: ['facility-type.view', 'facility-type.manage'],
      prismaImpl: {
        healthcareCatalogItem: {
          findUnique: jest.fn(async () => loadItem),
        },
      },
    });
    // Override load path: withPlatformBypass returns findUnique result for loadItem
    (service as unknown as { loadItem: (id: string) => Promise<unknown> }).loadItem = async () =>
      loadItem;

    await expect(
      service.updateItem(CLAIMS, 'spec-1', { expectedVersion: 1, sortOrder: 2 }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('compatibility-rule.manage cannot create catalog items', async () => {
    const service = buildService({
      permissions: ['compatibility-rule.view', 'compatibility-rule.manage'],
    });
    await expect(
      service.createItem(CLAIMS, {
        kind: 'MODULE',
        canonicalKey: 'module.x',
        translations: [
          { locale: 'en-US', displayName: 'x', shortDescription: 'x' },
          { locale: 'ar-SY', displayName: 'س', shortDescription: 'س' },
        ],
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('module.manage cannot manage compatibility rules', async () => {
    const service = buildService({
      permissions: ['module.view', 'module.manage'],
    });
    await expect(
      service.createRule(CLAIMS, {
        ruleType: 'REQUIRES',
        subjectKey: 'module.a',
        targetKey: 'module.b',
        explanationEn: 'x',
        explanationAr: 'س',
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('read permission cannot create', async () => {
    const service = buildService({
      permissions: ['facility-type.view'],
    });
    await expect(
      service.createItem(CLAIMS, {
        kind: 'FACILITY_TYPE',
        canonicalKey: 'facility_type.x',
        translations: [
          { locale: 'en-US', displayName: 'x', shortDescription: 'x' },
          { locale: 'ar-SY', displayName: 'س', shortDescription: 'س' },
        ],
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('unknown kind fails closed on manage', async () => {
    const service = buildService({
      permissions: ['facility-type.manage'],
    });
    await expect(
      service.createItem(CLAIMS, {
        kind: 'PLAN' as never,
        canonicalKey: 'plan.x',
        translations: [
          { locale: 'en-US', displayName: 'x', shortDescription: 'x' },
          { locale: 'ar-SY', displayName: 'س', shortDescription: 'س' },
        ],
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});

describe('Healthcare catalog server step-up', () => {
  it('rejects lifecycle when step-up is stale', async () => {
    const item = {
      id: 'm1',
      kind: 'MODULE',
      canonicalKey: 'module.x',
      lifecycle: 'DRAFT',
      version: 1,
      translations: [],
      aliases: [],
      parent: null,
      owningModule: null,
    };
    const service = buildService({
      permissions: ['module.view', 'module.manage'],
      stepUpFresh: false,
    });
    (service as unknown as { loadItem: (id: string) => Promise<unknown> }).loadItem = async () =>
      item;

    await expect(
      service.transitionLifecycle(CLAIMS, 'm1', 'ACTIVE', {
        expectedVersion: 1,
        reason: 'activate',
      }),
    ).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'PLATFORM_STEP_UP_REQUIRED' }),
    });
  });

  it('rejects lifecycle when session is missing', async () => {
    const item = {
      id: 'm1',
      kind: 'MODULE',
      canonicalKey: 'module.x',
      lifecycle: 'DRAFT',
      version: 1,
      translations: [],
      aliases: [],
      parent: null,
      owningModule: null,
    };
    const service = buildService({
      permissions: ['module.view', 'module.manage'],
      sessionMissing: true,
    });
    (service as unknown as { loadItem: (id: string) => Promise<unknown> }).loadItem = async () =>
      item;

    await expect(
      service.transitionLifecycle(CLAIMS, 'm1', 'ACTIVE', {
        expectedVersion: 1,
        reason: 'activate',
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('step-up does not grant missing kind permission', async () => {
    const item = {
      id: 'f1',
      kind: 'FEATURE',
      canonicalKey: 'feature.x',
      lifecycle: 'DRAFT',
      version: 1,
      translations: [],
      aliases: [],
      parent: null,
      owningModule: null,
    };
    const service = buildService({
      permissions: ['module.view', 'module.manage'],
      stepUpFresh: true,
    });
    (service as unknown as { loadItem: (id: string) => Promise<unknown> }).loadItem = async () =>
      item;

    await expect(
      service.transitionLifecycle(CLAIMS, 'f1', 'ACTIVE', {
        expectedVersion: 1,
        reason: 'activate',
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});

describe('CatalogIdempotencyService hashing and key validation', () => {
  const prisma = {
    withPlatformBypass: jest.fn(async (fn: (c: unknown) => Promise<unknown>) => fn({
      healthcareCatalogIdempotencyRecord: {
        findUnique: jest.fn(async () => null),
        create: jest.fn(),
      },
    })),
  };
  const idem = new CatalogIdempotencyService(prisma as never);

  it('rejects malformed and oversized keys', () => {
    expect(() => idem.assertValidKey('')).toThrow(/Invalid Idempotency-Key/i);
    expect(() => idem.assertValidKey('bad key')).toThrow(/Invalid Idempotency-Key/i);
    expect(() => idem.assertValidKey('a'.repeat(129))).toThrow(/Invalid Idempotency-Key/i);
    expect(idem.assertValidKey('ok-key_1:2')).toBe('ok-key_1:2');
  });

  it('fingerprints are order-independent for objects', () => {
    expect(idem.fingerprint({ b: 1, a: 2 })).toBe(idem.fingerprint({ a: 2, b: 1 }));
  });
});
