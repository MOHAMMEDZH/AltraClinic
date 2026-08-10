/**

 * Flexible Step 17 — PostgreSQL test harness.

 */

import { randomUUID } from 'crypto';

import { PrismaClient } from '@prisma/client';

import {

  assertSafePlatformTestDatabaseUrl,

  createPlatformDbSecurityClient,

  createSubscriptionsPrismaWrapper,

  createSubscriptionsService,

  DEFAULT_PLATFORM_DB_SECURITY_URL,

  platformDbSecurityEnabled,

  FakeSubscriptionAuditLog,

} from '../../platform-subscriptions/tests/platform-subscriptions-db.harness';

import { CommercialCompositionService } from '../../platform-addons/application/commercial-composition.service';

import {
  evaluateCompatibilitySelection,
  type CatalogLifecycle,
} from '../../platform-healthcare-catalog/domain/compatibility.evaluator';

import type { JwtClaimsVO } from '../../auth/domain/value-objects/jwt-claims.vo';

import type { PrismaService } from '../../../infrastructure/prisma.service';

import { ProvisioningIdempotencyService } from '../application/provisioning-idempotency.service';

import { TenantProvisioningValidationService } from '../application/tenant-provisioning-validation.service';

import { TenantAdminInvitationAdapter } from '../application/tenant-admin-invitation.adapter';

import { TenantProvisioningRateLimitService } from '../application/tenant-provisioning-rate-limit.service';

import { TenantProvisioningAuditLog } from '../application/tenant-provisioning-audit.log';

import { TenantProvisioningService } from '../application/tenant-provisioning.service';

import { CreateTenantHandler } from '../../tenant/application/handlers/create-tenant.handler';

import { PrismaTenantRepository } from '../../tenant/infrastructure/prisma-tenant.repository';

import type { TenantRepository } from '../../tenant/domain/tenant.repository.interface';

import { EffectiveEntitlementRuntimeService } from '../../effective-entitlement-runtime/application/effective-entitlement-runtime.service';

import { PrismaPasswordResetTokenRepository } from '../../auth/infrastructure/repositories/prisma-password-reset-token.repository';

import { PROVISION_PERMISSIONS } from '../tenant-provisioning.constants';

import type { TenantProvisioningRequestInput } from '../domain/tenant-provisioning.types';

import { createPlansSeedService } from '../../platform-plans/tests/platform-plans-db.harness';



export {

  assertSafePlatformTestDatabaseUrl,

  createPlatformDbSecurityClient,

  DEFAULT_PLATFORM_DB_SECURITY_URL,

  platformDbSecurityEnabled,

  FakeSubscriptionAuditLog,

};



export const ALL_PROVISION_PERMS = [

  PROVISION_PERMISSIONS.view,

  PROVISION_PERMISSIONS.create,

  PROVISION_PERMISSIONS.execute,

  PROVISION_PERMISSIONS.retry,

  PROVISION_PERMISSIONS.compensate,

  PROVISION_PERMISSIONS.activate,

  'sales-trial.create',

  'subscription.view',

  'subscription.assign',

  'subscription.migrate',

  'subscription.activate',

  'plan.view',

  'addon.view',

  'override.view',

];



export const SUBSCRIPTION_COMMERCIAL_PERMS = [

  'subscription.view',

  'subscription.assign',

  'subscription.migrate',

  'subscription.activate',

  'plan.view',

  'addon.view',

  'override.view',

];



/** Hybrid PrismaService: direct model access + withPlatformBypass for RLS. */

export function createHybridPrisma(prisma: PrismaClient): PrismaService {

  return Object.assign(prisma, createSubscriptionsPrismaWrapper(prisma)) as unknown as PrismaService;

}



/** Tenant repo whose save/findByDomain run inside withPlatformBypass. */

export function createBypassTenantRepository(wrapped: PrismaService): TenantRepository {

  const base = new PrismaTenantRepository(wrapped);

  return {

    findByDomain: (domain) => wrapped.withPlatformBypass(() => base.findByDomain(domain)),

    findById: (id) => wrapped.withPlatformBypass(() => base.findById(id)),

    save: (tenant) => wrapped.withPlatformBypass(() => base.save(tenant)),

  };

}



export function platformClaims(sub = randomUUID()): JwtClaimsVO {

  return {

    sub,

    tenantId: null,

    branchId: null,

    roles: [],

    sessionId: randomUUID(),

    jti: randomUUID(),

    type: 'access',

    sessionClass: 'platform',

    principalType: 'platform',

    aud: 'platform',

    iss: 'test',

  } as unknown as JwtClaimsVO;

}



export function enableProvisioningFlag(): () => void {

  const prev = process.env.TENANT_PROVISIONING_ENABLED;

  process.env.TENANT_PROVISIONING_ENABLED = 'true';

  return () => {

    if (prev === undefined) delete process.env.TENANT_PROVISIONING_ENABLED;

    else process.env.TENANT_PROVISIONING_ENABLED = prev;

  };

}



export function disableProvisioningFlag(): () => void {

  const prev = process.env.TENANT_PROVISIONING_ENABLED;

  process.env.TENANT_PROVISIONING_ENABLED = 'false';

  return () => {

    if (prev === undefined) delete process.env.TENANT_PROVISIONING_ENABLED;

    else process.env.TENANT_PROVISIONING_ENABLED = prev;

  };

}



export type FakeMail = { email: string; token: string };



export type ProvisioningStack = ReturnType<typeof createProvisioningStack>;



export function createProvisioningStack(opts: {

  prisma: PrismaClient;

  permissions?: string[];

  stepUpFresh?: boolean;

}) {

  const wrapped = createHybridPrisma(opts.prisma);

  const permissions = opts.permissions ?? ALL_PROVISION_PERMS;

  const authz = {

    resolveEffectivePermissions: jest.fn(async () => permissions),

  };

  const refreshRepo = {

    findBySessionId: jest.fn(async () =>

      opts.stepUpFresh === false

        ? null

        : { id: 's1', platformUserId: 'u1', isStepUpFresh: () => true },

    ),

  };

  const assurance = {

    requireStepUp: jest.fn(async () => {

      if (opts.stepUpFresh === false) {

        const { ForbiddenException } = await import('@nestjs/common');

        throw new ForbiddenException('Fresh step-up required.');

      }

    }),

  };



  const mails: FakeMail[] = [];

  const emailSender = {

    sendPasswordReset: jest.fn(async (email: string, token: string) => {

      mails.push({ email, token });

    }),

    sendEmailVerification: jest.fn(),

  };



  const tokenRepo = new PrismaPasswordResetTokenRepository(wrapped);

  const compositionAuthz = {

    resolveEffectivePermissions: jest.fn(async () => SUBSCRIPTION_COMMERCIAL_PERMS),

  };

  const composition = new CommercialCompositionService(wrapped, compositionAuthz as never);

  const eer = new EffectiveEntitlementRuntimeService(wrapped);



  const subscriptions = createSubscriptionsService({

    prisma: opts.prisma,

    permissions: SUBSCRIPTION_COMMERCIAL_PERMS,

    audit: new FakeSubscriptionAuditLog(),

    stepUpFresh: true,

    composition,

    effectiveEntitlements: eer,

  });



  const tenantRepo = createBypassTenantRepository(wrapped);

  const events = { publish: jest.fn(async () => undefined) };

  const createTenant = new CreateTenantHandler(tenantRepo as never, events as never);



  const validation = new TenantProvisioningValidationService(wrapped);

  const idempotency = new ProvisioningIdempotencyService(wrapped);

  const invitations = new TenantAdminInvitationAdapter(

    wrapped,

    tokenRepo as never,

    emailSender as never,

  );

  const rateLimit = new TenantProvisioningRateLimitService();

  const auditLog = new TenantProvisioningAuditLog(wrapped);

  const service = new TenantProvisioningService(

    wrapped,

    validation,

    idempotency,

    invitations,

    rateLimit,

    subscriptions,

    eer,

    createTenant,

    authz as never,

    assurance as never,

    auditLog,

    refreshRepo as never,

  );



  return {

    service,

    validation,

    idempotency,

    invitations,

    rateLimit,

    auditLog,

    subscriptions,

    eer,

    mails,

    emailSender,

    authz,

    wrapped,

    tokenRepo,

  };

}



export async function cleanupProvisioningTables(prisma: PrismaClient): Promise<void> {

  await prisma.$executeRawUnsafe(`

    TRUNCATE TABLE

      "platform_tenant_provisioning_idempotency",

      "platform_tenant_provisioning_owned_resources",

      "platform_tenant_provisioning_checkpoints",

      "platform_tenant_provisioning_requests"

    RESTART IDENTITY CASCADE

  `);

}



export async function ensureProvisioningCatalogFixtures(prisma: PrismaClient): Promise<void> {

  const dash = await prisma.healthcareCatalogItem.findUnique({

    where: { canonicalKey: 'module.dashboard' },

  });

  if (!dash) {

    const { HealthcareCatalogSeedService } = await import(

      '../../platform-healthcare-catalog/application/catalog-seed.service'

    );

    await new HealthcareCatalogSeedService({

      withPlatformBypass: async <T>(fn: (client: typeof prisma) => Promise<T>) =>

        prisma.$transaction(async (tx) => {

          await tx.$executeRaw`SELECT set_config('app.platform_rls_bypass', 'true', true)`;

          return fn(tx as unknown as typeof prisma);

        }),

    } as never).seedAll();

  }

  if ((await prisma.platformPlan.count()) === 0) {

    await createPlansSeedService(prisma).seedAll({ includeCommercialDefinitions: true });

  }

}



export async function findPublishedPlanFixture(prisma: PrismaClient) {

  await ensureProvisioningCatalogFixtures(prisma);

  const planVersion = await prisma.platformPlanVersion.findFirst({

    where: { lifecycle: 'PUBLISHED', publicationFingerprint: { not: null } },

    include: {

      plan: true,

      entitlements: { include: { catalogItem: true } },

    },

  });

  const facilities = await prisma.healthcareCatalogItem.findMany({

    where: { kind: 'FACILITY_TYPE', lifecycle: 'ACTIVE' },

    orderBy: { canonicalKey: 'asc' },

  });

  const specialties = await prisma.healthcareCatalogItem.findMany({

    where: { kind: 'SPECIALTY', lifecycle: 'ACTIVE' },

    orderBy: { canonicalKey: 'asc' },

  });

  if (!planVersion || facilities.length === 0 || specialties.length === 0) {

    return {

      planVersion,

      facility: facilities[0] ?? null,

      specialty: specialties[0] ?? null,

    };

  }

  const moduleKeys = planVersion.entitlements

    .map((e) => e.catalogItem.canonicalKey)

    .filter((k) => k.startsWith('module.'));

  const items = await prisma.healthcareCatalogItem.findMany({

    select: { canonicalKey: true, kind: true, lifecycle: true },

  });

  const rules = await prisma.healthcareCatalogCompatibilityRule.findMany({

    include: { subject: true, target: true },

  });

  const evalItems = items.map((i) => ({

    canonicalKey: i.canonicalKey,

    kind: i.kind,

    lifecycle: i.lifecycle as CatalogLifecycle,

  }));

  const evalRules = rules.map((r) => ({

    id: r.id,

    ruleType: r.ruleType as never,

    subjectKey: r.subject.canonicalKey,

    targetKey: r.target.canonicalKey,

    anyOfGroupKey: r.anyOfGroupKey,

    lifecycle: r.lifecycle as CatalogLifecycle,

  }));

  // Prefer facility/specialty pairs that satisfy commercial plan module ALLOWED_FOR /
  // REQUIRES_ANY_OF rules (e.g. module.dental + module.beauty need multi-specialty/hospital).
  const preferredFacilityKeys = [

    'facility_type.multi_specialty_center',

    'facility_type.hospital',

    'facility_type.dental_clinic',

  ];

  const preferredSpecialtyKeys = [

    'specialty.dentistry',

    'specialty.general_medicine',

  ];

  const facilityOrder = [

    ...preferredFacilityKeys

      .map((k) => facilities.find((f) => f.canonicalKey === k))

      .filter((f): f is (typeof facilities)[number] => Boolean(f)),

    ...facilities.filter((f) => !preferredFacilityKeys.includes(f.canonicalKey)),

  ];

  const specialtyOrder = [

    ...preferredSpecialtyKeys

      .map((k) => specialties.find((s) => s.canonicalKey === k))

      .filter((s): s is (typeof specialties)[number] => Boolean(s)),

    ...specialties.filter((s) => !preferredSpecialtyKeys.includes(s.canonicalKey)),

  ];

  for (const facility of facilityOrder) {

    for (const specialty of specialtyOrder) {

      const compat = evaluateCompatibilitySelection(

        {

          facilityTypeKey: facility.canonicalKey,

          specialtyKeys: [specialty.canonicalKey],

          moduleKeys,

        },

        evalItems,

        evalRules,

      );

      if (compat.valid) {

        return { planVersion, facility, specialty };

      }

    }

  }

  return {

    planVersion,

    facility: facilityOrder[0] ?? null,

    specialty: specialtyOrder[0] ?? null,

  };

}



export function buildRequestBody(

  fixture: {

    planVersion: { id: string };

    facility: { canonicalKey: string };

    specialty: { canonicalKey: string };

  },

  overrides: Record<string, unknown> = {},

) {

  const slug = `s17-${randomUUID().slice(0, 8)}`;

  return {

    organization: {

      legalOrDisplayName: `Clinic ${slug}`,

      requestedSlug: slug,

      regionOrEnvironment: 'me-central',

      timezone: 'Asia/Damascus',

    },

    facilityTypeKey: fixture.facility.canonicalKey,

    specialtyKeys: [fixture.specialty.canonicalKey],

    publishedPlanVersionId: fixture.planVersion.id,

    addOnSelections: [],

    tenantAdmin: { email: `admin-${slug}@example.com` },

    onboardingType: 'STANDARD' as const,

    ...overrides,

  };

}



export async function runFullHappyPath(

  stack: ProvisioningStack,

  claims: JwtClaimsVO,

  body: TenantProvisioningRequestInput,

  idempotencyPrefix = randomUUID().slice(0, 8),

) {

  const created = await stack.service.createRequest(

    claims,

    body,

    `${idempotencyPrefix}-create`,

  );

  const started = await stack.service.start(

    claims,

    created.id,

    { expectedRowVersion: created.rowVersion },

    `${idempotencyPrefix}-start`,

  );

  const activated = await stack.service.activate(

    claims,

    started.id,

    { expectedRowVersion: started.rowVersion, reason: 'E2E activation proof' },

    `${idempotencyPrefix}-activate`,

  );

  return { created, started, activated };

}



export async function countProvisioningAuditActions(

  prisma: PrismaClient,

  action: string,

  resourceId?: string,

): Promise<number> {

  return prisma.auditEntry.count({

    where: {

      action,

      resourceType: 'tenant_provisioning',

      ...(resourceId ? { resourceId } : {}),

    },

  });

}
