/**
 * Step 15 final-gate PostgreSQL evidence — idempotency matrix, rate limits,
 * authz, rollback injection, audit redaction, concurrent grants, composition.
 */
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpException,
} from '@nestjs/common';
import type { PrismaClient } from '@prisma/client';
import type { JwtClaimsVO } from '../../auth/domain/value-objects/jwt-claims.vo';
import { PrismaService } from '../../../infrastructure/prisma.service';
import { createPlansSeedService } from '../../platform-plans/tests/platform-plans-db.harness';
import { AuditTrailPlatformAddonsAuditLog } from '../infrastructure/audit-trail-platform-addons-audit-log';
import type { AddonIdempotencyOperation } from '../application/addon-idempotency.service';
import type { PlatformAddonsService } from '../application/platform-addons.service';
import type { PlatformOverridesService } from '../application/platform-overrides.service';
import {
  cleanupPlatformAddonsTables,
  createAddonsPrismaWrapper,
  createAddonsService,
  createCompositionService,
  createOverridesService,
  createPlatformDbSecurityClient,
  DEFAULT_PLATFORM_DB_SECURITY_URL,
  platformDbSecurityEnabled,
} from './platform-addons-db.harness';
import { FakeAddonAuditLog } from './support/fake-addon-audit-log';

const CREATOR = '00000000-0000-4000-8000-000000000015';
const APPROVER = '00000000-0000-4000-8000-000000000016';

const CREATOR_CLAIMS = {
  sub: CREATOR,
  sessionId: '11111111-1111-4111-8111-111111111115',
} as JwtClaimsVO;

const APPROVER_CLAIMS = {
  sub: APPROVER,
  sessionId: '11111111-1111-4111-8111-111111111116',
} as JwtClaimsVO;

const ADDON_PERMS = ['addon.view', 'addon.manage'];
const OVERRIDE_REQUEST_PERMS = ['override.view', 'override.request'];
const OVERRIDE_APPROVE_PERMS = ['override.view', 'override.approve'];
const ALL_PERMS = [
  ...ADDON_PERMS,
  ...OVERRIDE_REQUEST_PERMS,
  ...OVERRIDE_APPROVE_PERMS,
  'plan.view',
];

const describeDb = platformDbSecurityEnabled() ? describe : describe.skip;

function addonTranslations(name: string) {
  return [
    { locale: 'en-US', displayName: name, shortDescription: `${name} desc` },
    { locale: 'ar-SY', displayName: name, shortDescription: `${name} وصف` },
  ];
}

function versionTranslations(label: string) {
  return [
    { locale: 'en-US', releaseLabel: label, shortDescription: `${label} en` },
    { locale: 'ar-SY', releaseLabel: `${label}-ar`, shortDescription: `${label} ع` },
  ];
}

function durableAudit(prisma: PrismaClient) {
  const wrapper = createAddonsPrismaWrapper(prisma);
  return new AuditTrailPlatformAddonsAuditLog({
    withPlatformBypass: wrapper.withPlatformBypass,
  } as unknown as PrismaService);
}

function successAuditCount(audit: FakeAddonAuditLog, action: string): number {
  return audit.records.filter(
    (r) => r.action === action && r.details?.result === 'success',
  ).length;
}

async function completedIdemCount(
  prisma: PrismaClient,
  key: string,
  operation?: AddonIdempotencyOperation,
): Promise<number> {
  return prisma.platformCommercialIdempotencyRecord.count({
    where: {
      idempotencyKey: key,
      status: 'completed',
      ...(operation ? { operation } : {}),
    },
  });
}

async function ensureCatalogAndPlans(prisma: PrismaClient): Promise<void> {
  let dash = await prisma.healthcareCatalogItem.findUnique({
    where: { canonicalKey: 'module.dashboard' },
  });
  if (!dash) {
    const { HealthcareCatalogSeedService } = await import(
      '../../platform-healthcare-catalog/application/catalog-seed.service'
    );
    const catalogSeed = new HealthcareCatalogSeedService({
      withPlatformBypass: async <T>(fn: (client: typeof prisma) => Promise<T>) =>
        prisma.$transaction(async (tx) => {
          await tx.$executeRaw`SELECT set_config('app.platform_rls_bypass', 'true', true)`;
          await tx.$executeRaw`SELECT set_config('app.current_tenant_id', '', true)`;
          return fn(tx as unknown as typeof prisma);
        }),
    } as never);
    await catalogSeed.seedAll();
    dash = await prisma.healthcareCatalogItem.findUnique({
      where: { canonicalKey: 'module.dashboard' },
    });
  }
  if (!dash) throw new Error('Healthcare Catalog seed required for Step 15 tests.');

  const planCount = await prisma.platformPlan.count();
  if (planCount === 0) {
    await createPlansSeedService(prisma).seedAll({ includeCommercialDefinitions: true });
  }
}

type IdResult = { id: string };

type MatrixHarness = {
  operation: AddonIdempotencyOperation;
  auditAction: string;
  /** Execute the durable op with the given key (same payload each time). */
  execute: (svc: unknown, key: string) => Promise<IdResult>;
  /** Same key, different payload → ConflictException. */
  conflict: (svc: unknown, key: string) => Promise<unknown>;
  /** Fresh services sharing `audit` for concurrent equivalent Promise.all. */
  concurrent: (prisma: PrismaClient, key: string, audit: FakeAddonAuditLog) => Promise<void>;
  /** Build service(s) wired to `audit` for this op. */
  makeService: (prisma: PrismaClient, audit: FakeAddonAuditLog) => unknown;
  /** One-time fixture setup; returns opaque context bound into execute/conflict. */
  setup: (prisma: PrismaClient) => Promise<void>;
};

describeDb('Platform Add-ons Step 15 final gate (postgres)', () => {
  let prisma: PrismaClient;
  let moduleItem: { id: string; canonicalKey: string };
  let featureItem: { id: string; canonicalKey: string };
  let limitItem: { id: string; canonicalKey: string };
  let plan: { id: string; canonicalKey: string };

  beforeAll(async () => {
    prisma = createPlatformDbSecurityClient(DEFAULT_PLATFORM_DB_SECURITY_URL);
    await prisma.$connect();
    await ensureCatalogAndPlans(prisma);
    moduleItem = await prisma.healthcareCatalogItem.findUniqueOrThrow({
      where: { canonicalKey: 'module.dashboard' },
    });
    featureItem = await prisma.healthcareCatalogItem.findFirstOrThrow({
      where: { kind: 'FEATURE' },
    });
    limitItem = await prisma.healthcareCatalogItem.findFirstOrThrow({
      where: { kind: 'LIMIT' },
    });
    plan = await prisma.platformPlan.findFirstOrThrow();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    await cleanupPlatformAddonsTables(prisma);
  });

  function buildMatrix(): MatrixHarness[] {
    // Mutable fixture slots filled by setup().
    let addonId = '';
    let versionId = '';
    let rowVersion = 0;
    let overrideId = '';
    let overrideRowVersion = 0;

    const addonsSvc = (p: PrismaClient, audit: FakeAddonAuditLog) =>
      createAddonsService({ prisma: p, permissions: ALL_PERMS, stepUpFresh: true, audit });
    const overridesSvc = (p: PrismaClient, audit: FakeAddonAuditLog) =>
      createOverridesService({ prisma: p, permissions: ALL_PERMS, stepUpFresh: true, audit });
    const approveSvc = (p: PrismaClient, audit: FakeAddonAuditLog) =>
      createOverridesService({
        prisma: p,
        permissions: OVERRIDE_APPROVE_PERMS,
        stepUpFresh: true,
        audit,
      });

    async function seedAddonDraft(
      p: PrismaClient,
      key: string,
      label: string,
    ): Promise<{ addonId: string; versionId: string; rowVersion: number }> {
      const s = createAddonsService({ prisma: p, permissions: ALL_PERMS, stepUpFresh: true });
      const addon = await s.createAddOn(CREATOR_CLAIMS, {
        canonicalKey: key,
        translations: addonTranslations(label),
      });
      const draft = await s.createDraftVersion(CREATOR_CLAIMS, addon.id, {
        translations: versionTranslations('v1'),
      });
      return { addonId: addon.id, versionId: draft.id, rowVersion: draft.rowVersion };
    }

    async function seedPublished(
      p: PrismaClient,
      key: string,
      label: string,
    ): Promise<{ addonId: string; versionId: string }> {
      const seeded = await seedAddonDraft(p, key, label);
      const s = createAddonsService({ prisma: p, permissions: ALL_PERMS, stepUpFresh: true });
      const published = await s.publishVersion(CREATOR_CLAIMS, seeded.addonId, seeded.versionId, {
        expectedRowVersion: seeded.rowVersion,
        reason: 'matrix publish source',
      });
      return { addonId: seeded.addonId, versionId: published.id };
    }

    async function seedPending(
      p: PrismaClient,
      note: string,
    ): Promise<{ overrideId: string; rowVersion: number }> {
      const req = createOverridesService({
        prisma: p,
        permissions: OVERRIDE_REQUEST_PERMS,
        stepUpFresh: true,
      });
      const created = await req.createOverride(CREATOR_CLAIMS, {
        reasonCode: 'SALES_CONCESSION',
        reasonNote: note,
        effects: [{ effectKind: 'ENTITLEMENT_GRANT', catalogItemId: moduleItem.id }],
      });
      const submitted = await req.submit(CREATOR_CLAIMS, created.id, {
        expectedRowVersion: created.rowVersion,
      });
      return { overrideId: created.id, rowVersion: submitted.rowVersion };
    }

    async function seedApproved(
      p: PrismaClient,
      note: string,
    ): Promise<{ overrideId: string; rowVersion: number }> {
      const pending = await seedPending(p, note);
      const appr = createOverridesService({
        prisma: p,
        permissions: OVERRIDE_APPROVE_PERMS,
        stepUpFresh: true,
      });
      const approved = await appr.approve(APPROVER_CLAIMS, pending.overrideId, {
        expectedRowVersion: pending.rowVersion,
      });
      return { overrideId: pending.overrideId, rowVersion: approved.rowVersion };
    }

    return [
      {
        operation: 'addon.create',
        auditAction: 'platform_addon.created',
        setup: async () => undefined,
        makeService: addonsSvc,
        execute: (svc, key) =>
          (svc as PlatformAddonsService).createAddOn(
            CREATOR_CLAIMS,
            {
              canonicalKey: 'addon.gate_create',
              translations: addonTranslations('Gate Create'),
            },
            key,
          ),
        conflict: (svc, key) =>
          (svc as PlatformAddonsService).createAddOn(
            CREATOR_CLAIMS,
            {
              canonicalKey: 'addon.gate_create_other',
              translations: addonTranslations('Other'),
            },
            key,
          ),
        concurrent: async (p, key, audit) => {
          const svc = addonsSvc(p, audit);
          const body = {
            canonicalKey: 'addon.gate_conc_create',
            translations: addonTranslations('Conc Create'),
          };
          const [a, b] = await Promise.all([
            svc.createAddOn(CREATOR_CLAIMS, body, key),
            svc.createAddOn(CREATOR_CLAIMS, body, key),
          ]);
          expect(a.id).toBe(b.id);
        },
      },
      {
        operation: 'addon.update',
        auditAction: 'platform_addon.updated',
        setup: async (p) => {
          const s = createAddonsService({
            prisma: p,
            permissions: ALL_PERMS,
            stepUpFresh: true,
          });
          const addon = await s.createAddOn(CREATOR_CLAIMS, {
            canonicalKey: 'addon.gate_update',
            translations: addonTranslations('Gate Update'),
          });
          addonId = addon.id;
          rowVersion = addon.rowVersion;
        },
        makeService: addonsSvc,
        execute: (svc, key) =>
          (svc as PlatformAddonsService).updateAddOn(
            CREATOR_CLAIMS,
            addonId,
            {
              expectedRowVersion: rowVersion,
              translations: addonTranslations('Gate Update Edited'),
            },
            key,
          ),
        conflict: (svc, key) =>
          (svc as PlatformAddonsService).updateAddOn(
            CREATOR_CLAIMS,
            addonId,
            {
              expectedRowVersion: rowVersion,
              translations: addonTranslations('Different Update'),
            },
            key,
          ),
        concurrent: async (p, key, audit) => {
          const bare = createAddonsService({
            prisma: p,
            permissions: ALL_PERMS,
            stepUpFresh: true,
          });
          const addon = await bare.createAddOn(CREATOR_CLAIMS, {
            canonicalKey: 'addon.gate_conc_update',
            translations: addonTranslations('Conc Update'),
          });
          const svc = addonsSvc(p, audit);
          const body = {
            expectedRowVersion: addon.rowVersion,
            translations: addonTranslations('Conc Update Edited'),
          };
          const [a, b] = await Promise.all([
            svc.updateAddOn(CREATOR_CLAIMS, addon.id, body, key),
            svc.updateAddOn(CREATOR_CLAIMS, addon.id, body, key),
          ]);
          expect(a.id).toBe(b.id);
          expect(a.rowVersion).toBe(b.rowVersion);
        },
      },
      {
        operation: 'addon.activate',
        auditAction: 'platform_addon.activated',
        setup: async (p) => {
          const s = createAddonsService({
            prisma: p,
            permissions: ALL_PERMS,
            stepUpFresh: true,
          });
          const addon = await s.createAddOn(CREATOR_CLAIMS, {
            canonicalKey: 'addon.gate_activate',
            translations: addonTranslations('Gate Activate'),
          });
          addonId = addon.id;
          rowVersion = addon.rowVersion;
        },
        makeService: addonsSvc,
        execute: (svc, key) =>
          (svc as PlatformAddonsService).transitionAddOnLifecycle(
            CREATOR_CLAIMS,
            addonId,
            'ACTIVE',
            { expectedRowVersion: rowVersion, reason: 'activate for gate' },
            key,
          ),
        conflict: (svc, key) =>
          (svc as PlatformAddonsService).transitionAddOnLifecycle(
            CREATOR_CLAIMS,
            addonId,
            'ACTIVE',
            { expectedRowVersion: rowVersion, reason: 'different activate reason' },
            key,
          ),
        concurrent: async (p, key, audit) => {
          const bare = createAddonsService({
            prisma: p,
            permissions: ALL_PERMS,
            stepUpFresh: true,
          });
          const addon = await bare.createAddOn(CREATOR_CLAIMS, {
            canonicalKey: 'addon.gate_conc_activate',
            translations: addonTranslations('Conc Activate'),
          });
          const svc = addonsSvc(p, audit);
          const body = {
            expectedRowVersion: addon.rowVersion,
            reason: 'conc activate',
          };
          const [a, b] = await Promise.all([
            svc.transitionAddOnLifecycle(CREATOR_CLAIMS, addon.id, 'ACTIVE', body, key),
            svc.transitionAddOnLifecycle(CREATOR_CLAIMS, addon.id, 'ACTIVE', body, key),
          ]);
          expect(a.id).toBe(b.id);
          expect(a.lifecycle).toBe('ACTIVE');
        },
      },
      {
        operation: 'addon.archive',
        auditAction: 'platform_addon.archived',
        setup: async (p) => {
          const s = createAddonsService({
            prisma: p,
            permissions: ALL_PERMS,
            stepUpFresh: true,
          });
          const addon = await s.createAddOn(CREATOR_CLAIMS, {
            canonicalKey: 'addon.gate_archive',
            translations: addonTranslations('Gate Archive'),
          });
          const active = await s.transitionAddOnLifecycle(CREATOR_CLAIMS, addon.id, 'ACTIVE', {
            expectedRowVersion: addon.rowVersion,
            reason: 'prep archive',
          });
          addonId = active.id;
          rowVersion = active.rowVersion;
        },
        makeService: addonsSvc,
        execute: (svc, key) =>
          (svc as PlatformAddonsService).transitionAddOnLifecycle(
            CREATOR_CLAIMS,
            addonId,
            'ARCHIVED',
            { expectedRowVersion: rowVersion, reason: 'archive for gate' },
            key,
          ),
        conflict: (svc, key) =>
          (svc as PlatformAddonsService).transitionAddOnLifecycle(
            CREATOR_CLAIMS,
            addonId,
            'ARCHIVED',
            { expectedRowVersion: rowVersion, reason: 'different archive reason' },
            key,
          ),
        concurrent: async (p, key, audit) => {
          const bare = createAddonsService({
            prisma: p,
            permissions: ALL_PERMS,
            stepUpFresh: true,
          });
          const addon = await bare.createAddOn(CREATOR_CLAIMS, {
            canonicalKey: 'addon.gate_conc_archive',
            translations: addonTranslations('Conc Archive'),
          });
          const active = await bare.transitionAddOnLifecycle(CREATOR_CLAIMS, addon.id, 'ACTIVE', {
            expectedRowVersion: addon.rowVersion,
            reason: 'prep conc archive',
          });
          const svc = addonsSvc(p, audit);
          const body = {
            expectedRowVersion: active.rowVersion,
            reason: 'conc archive',
          };
          const [a, b] = await Promise.all([
            svc.transitionAddOnLifecycle(CREATOR_CLAIMS, active.id, 'ARCHIVED', body, key),
            svc.transitionAddOnLifecycle(CREATOR_CLAIMS, active.id, 'ARCHIVED', body, key),
          ]);
          expect(a.id).toBe(b.id);
          expect(a.lifecycle).toBe('ARCHIVED');
        },
      },
      {
        operation: 'addon.createDraftVersion',
        auditAction: 'platform_addon_version.created',
        setup: async (p) => {
          const bare = createAddonsService({
            prisma: p,
            permissions: ALL_PERMS,
            stepUpFresh: true,
          });
          const addon = await bare.createAddOn(CREATOR_CLAIMS, {
            canonicalKey: 'addon.gate_draft',
            translations: addonTranslations('Gate Draft'),
          });
          addonId = addon.id;
        },
        makeService: addonsSvc,
        execute: (svc, key) =>
          (svc as PlatformAddonsService).createDraftVersion(
            CREATOR_CLAIMS,
            addonId,
            { translations: versionTranslations('d1') },
            key,
          ),
        conflict: (svc, key) =>
          (svc as PlatformAddonsService).createDraftVersion(
            CREATOR_CLAIMS,
            addonId,
            { translations: versionTranslations('d2') },
            key,
          ),
        concurrent: async (p, key, audit) => {
          const bare = createAddonsService({
            prisma: p,
            permissions: ALL_PERMS,
            stepUpFresh: true,
          });
          const addon = await bare.createAddOn(CREATOR_CLAIMS, {
            canonicalKey: 'addon.gate_conc_draft',
            translations: addonTranslations('Conc Draft'),
          });
          const svc = addonsSvc(p, audit);
          const body = { translations: versionTranslations('cd') };
          const [a, b] = await Promise.all([
            svc.createDraftVersion(CREATOR_CLAIMS, addon.id, body, key),
            svc.createDraftVersion(CREATOR_CLAIMS, addon.id, body, key),
          ]);
          expect(a.id).toBe(b.id);
        },
      },
      {
        operation: 'addon.replaceEntitlements',
        auditAction: 'platform_addon_version.entitlements_replaced',
        setup: async (p) => {
          const s = await seedAddonDraft(p, 'addon.gate_ent', 'Gate Ent');
          addonId = s.addonId;
          versionId = s.versionId;
          rowVersion = s.rowVersion;
        },
        makeService: addonsSvc,
        execute: (svc, key) =>
          (svc as PlatformAddonsService).replaceEntitlements(
            CREATOR_CLAIMS,
            addonId,
            versionId,
            { expectedRowVersion: rowVersion, catalogItemIds: [moduleItem.id] },
            key,
          ),
        conflict: (svc, key) =>
          (svc as PlatformAddonsService).replaceEntitlements(
            CREATOR_CLAIMS,
            addonId,
            versionId,
            { expectedRowVersion: rowVersion, catalogItemIds: [featureItem.id] },
            key,
          ),
        concurrent: async (p, key, audit) => {
          const s = await seedAddonDraft(p, 'addon.gate_conc_ent', 'Conc Ent');
          const svc = addonsSvc(p, audit);
          const body = {
            expectedRowVersion: s.rowVersion,
            catalogItemIds: [moduleItem.id],
          };
          const [a, b] = await Promise.all([
            svc.replaceEntitlements(CREATOR_CLAIMS, s.addonId, s.versionId, body, key),
            svc.replaceEntitlements(CREATOR_CLAIMS, s.addonId, s.versionId, body, key),
          ]);
          expect(a.id).toBe(b.id);
          expect(a.rowVersion).toBe(b.rowVersion);
        },
      },
      {
        operation: 'addon.replaceLimitEffects',
        auditAction: 'platform_addon_version.limit_effects_replaced',
        setup: async (p) => {
          const s = await seedAddonDraft(p, 'addon.gate_lim', 'Gate Lim');
          addonId = s.addonId;
          versionId = s.versionId;
          rowVersion = s.rowVersion;
        },
        makeService: addonsSvc,
        execute: (svc, key) =>
          (svc as PlatformAddonsService).replaceLimitEffects(
            CREATOR_CLAIMS,
            addonId,
            versionId,
            {
              expectedRowVersion: rowVersion,
              effects: [
                {
                  catalogItemId: limitItem.id,
                  effectType: 'INCREASE_BY',
                  valueText: '10',
                },
              ],
            },
            key,
          ),
        conflict: (svc, key) =>
          (svc as PlatformAddonsService).replaceLimitEffects(
            CREATOR_CLAIMS,
            addonId,
            versionId,
            {
              expectedRowVersion: rowVersion,
              effects: [
                {
                  catalogItemId: limitItem.id,
                  effectType: 'INCREASE_BY',
                  valueText: '99',
                },
              ],
            },
            key,
          ),
        concurrent: async (p, key, audit) => {
          const s = await seedAddonDraft(p, 'addon.gate_conc_lim', 'Conc Lim');
          const svc = addonsSvc(p, audit);
          const body = {
            expectedRowVersion: s.rowVersion,
            effects: [
              {
                catalogItemId: limitItem.id,
                effectType: 'INCREASE_BY' as const,
                valueText: '5',
              },
            ],
          };
          const [a, b] = await Promise.all([
            svc.replaceLimitEffects(CREATOR_CLAIMS, s.addonId, s.versionId, body, key),
            svc.replaceLimitEffects(CREATOR_CLAIMS, s.addonId, s.versionId, body, key),
          ]);
          expect(a.id).toBe(b.id);
        },
      },
      {
        operation: 'addon.replaceApplicability',
        auditAction: 'platform_addon_version.applicability_replaced',
        setup: async (p) => {
          const s = await seedAddonDraft(p, 'addon.gate_app', 'Gate App');
          addonId = s.addonId;
          versionId = s.versionId;
          rowVersion = s.rowVersion;
        },
        makeService: addonsSvc,
        execute: (svc, key) =>
          (svc as PlatformAddonsService).replaceApplicability(
            CREATOR_CLAIMS,
            addonId,
            versionId,
            { expectedRowVersion: rowVersion, planCanonicalKeys: [plan.canonicalKey] },
            key,
          ),
        conflict: (svc, key) =>
          (svc as PlatformAddonsService).replaceApplicability(
            CREATOR_CLAIMS,
            addonId,
            versionId,
            { expectedRowVersion: rowVersion + 50, planCanonicalKeys: [] },
            key,
          ),
        concurrent: async (p, key, audit) => {
          const s = await seedAddonDraft(p, 'addon.gate_conc_app', 'Conc App');
          const svc = addonsSvc(p, audit);
          const body = {
            expectedRowVersion: s.rowVersion,
            planCanonicalKeys: [plan.canonicalKey],
          };
          const [a, b] = await Promise.all([
            svc.replaceApplicability(CREATOR_CLAIMS, s.addonId, s.versionId, body, key),
            svc.replaceApplicability(CREATOR_CLAIMS, s.addonId, s.versionId, body, key),
          ]);
          expect(a.id).toBe(b.id);
        },
      },
      {
        operation: 'addon.cloneVersion',
        auditAction: 'platform_addon_version.cloned',
        setup: async (p) => {
          const s = await seedPublished(p, 'addon.gate_clone', 'Gate Clone');
          addonId = s.addonId;
          versionId = s.versionId;
        },
        makeService: addonsSvc,
        execute: (svc, key) =>
          (svc as PlatformAddonsService).cloneVersion(
            CREATOR_CLAIMS,
            addonId,
            versionId,
            {},
            key,
          ),
        conflict: (svc, key) =>
          (svc as PlatformAddonsService).cloneVersion(
            CREATOR_CLAIMS,
            addonId,
            versionId,
            { translations: versionTranslations('c-other') },
            key,
          ),
        concurrent: async (p, key, audit) => {
          const s = await seedPublished(p, 'addon.gate_conc_clone', 'Conc Clone');
          const svc = addonsSvc(p, audit);
          const [a, b] = await Promise.all([
            svc.cloneVersion(CREATOR_CLAIMS, s.addonId, s.versionId, {}, key),
            svc.cloneVersion(CREATOR_CLAIMS, s.addonId, s.versionId, {}, key),
          ]);
          expect(a.id).toBe(b.id);
        },
      },
      {
        operation: 'addon.publishVersion',
        auditAction: 'platform_addon_version.published',
        setup: async (p) => {
          const s = await seedAddonDraft(p, 'addon.gate_pub', 'Gate Pub');
          addonId = s.addonId;
          versionId = s.versionId;
          rowVersion = s.rowVersion;
        },
        makeService: addonsSvc,
        execute: (svc, key) =>
          (svc as PlatformAddonsService).publishVersion(
            CREATOR_CLAIMS,
            addonId,
            versionId,
            { expectedRowVersion: rowVersion, reason: 'publish gate' },
            key,
          ),
        conflict: (svc, key) =>
          (svc as PlatformAddonsService).publishVersion(
            CREATOR_CLAIMS,
            addonId,
            versionId,
            { expectedRowVersion: rowVersion, reason: 'different publish reason' },
            key,
          ),
        concurrent: async (p, key, audit) => {
          const s = await seedAddonDraft(p, 'addon.gate_conc_pub', 'Conc Pub');
          const svc = addonsSvc(p, audit);
          const body = {
            expectedRowVersion: s.rowVersion,
            reason: 'conc publish',
          };
          const [a, b] = await Promise.all([
            svc.publishVersion(CREATOR_CLAIMS, s.addonId, s.versionId, body, key),
            svc.publishVersion(CREATOR_CLAIMS, s.addonId, s.versionId, body, key),
          ]);
          expect(a.id).toBe(b.id);
          expect(a.publicationFingerprint).toBe(b.publicationFingerprint);
        },
      },
      {
        operation: 'addon.retireVersion',
        auditAction: 'platform_addon_version.retired',
        setup: async (p) => {
          const s = await seedPublished(p, 'addon.gate_retire', 'Gate Retire');
          const ver = await p.platformAddOnVersion.findUniqueOrThrow({
            where: { id: s.versionId },
          });
          addonId = s.addonId;
          versionId = s.versionId;
          rowVersion = ver.rowVersion;
        },
        makeService: addonsSvc,
        execute: (svc, key) =>
          (svc as PlatformAddonsService).retireVersion(
            CREATOR_CLAIMS,
            addonId,
            versionId,
            { expectedRowVersion: rowVersion, reason: 'retire for gate' },
            key,
          ),
        conflict: (svc, key) =>
          (svc as PlatformAddonsService).retireVersion(
            CREATOR_CLAIMS,
            addonId,
            versionId,
            { expectedRowVersion: rowVersion, reason: 'different retire reason' },
            key,
          ),
        concurrent: async (p, key, audit) => {
          const s = await seedPublished(p, 'addon.gate_conc_retire', 'Conc Retire');
          const ver = await p.platformAddOnVersion.findUniqueOrThrow({
            where: { id: s.versionId },
          });
          const svc = addonsSvc(p, audit);
          const body = {
            expectedRowVersion: ver.rowVersion,
            reason: 'conc retire',
          };
          const [a, b] = await Promise.all([
            svc.retireVersion(CREATOR_CLAIMS, s.addonId, s.versionId, body, key),
            svc.retireVersion(CREATOR_CLAIMS, s.addonId, s.versionId, body, key),
          ]);
          expect(a.id).toBe(b.id);
          expect(a.lifecycle).toBe('RETIRED');
        },
      },
      {
        operation: 'override.create',
        auditAction: 'platform_override.created',
        setup: async () => undefined,
        makeService: overridesSvc,
        execute: (svc, key) =>
          (svc as PlatformOverridesService).createOverride(
            CREATOR_CLAIMS,
            {
              reasonCode: 'SALES_CONCESSION',
              reasonNote: 'Gate override create',
              effects: [{ effectKind: 'ENTITLEMENT_GRANT', catalogItemId: moduleItem.id }],
            },
            key,
          ),
        conflict: (svc, key) =>
          (svc as PlatformOverridesService).createOverride(
            CREATOR_CLAIMS,
            {
              reasonCode: 'SUPPORT_WAIVER',
              reasonNote: 'Different override payload',
              effects: [{ effectKind: 'ENTITLEMENT_GRANT', catalogItemId: featureItem.id }],
            },
            key,
          ),
        concurrent: async (p, key, audit) => {
          const svc = overridesSvc(p, audit);
          const body = {
            reasonCode: 'SALES_CONCESSION',
            reasonNote: 'Conc override create',
            effects: [{ effectKind: 'ENTITLEMENT_GRANT', catalogItemId: moduleItem.id }],
          };
          const [a, b] = await Promise.all([
            svc.createOverride(CREATOR_CLAIMS, body, key),
            svc.createOverride(CREATOR_CLAIMS, body, key),
          ]);
          expect(a.id).toBe(b.id);
        },
      },
      {
        operation: 'override.updateDraft',
        auditAction: 'platform_override.updated',
        setup: async (p) => {
          const req = createOverridesService({
            prisma: p,
            permissions: OVERRIDE_REQUEST_PERMS,
            stepUpFresh: true,
          });
          const created = await req.createOverride(CREATOR_CLAIMS, {
            reasonCode: 'SALES_CONCESSION',
            reasonNote: 'Gate update draft',
            effects: [{ effectKind: 'ENTITLEMENT_GRANT', catalogItemId: moduleItem.id }],
          });
          overrideId = created.id;
          overrideRowVersion = created.rowVersion;
        },
        makeService: overridesSvc,
        execute: (svc, key) =>
          (svc as PlatformOverridesService).updateDraft(
            CREATOR_CLAIMS,
            overrideId,
            {
              expectedRowVersion: overrideRowVersion,
              reasonNote: 'Gate update draft edited',
            },
            key,
          ),
        conflict: (svc, key) =>
          (svc as PlatformOverridesService).updateDraft(
            CREATOR_CLAIMS,
            overrideId,
            {
              expectedRowVersion: overrideRowVersion,
              reasonNote: 'Different update draft note',
            },
            key,
          ),
        concurrent: async (p, key, audit) => {
          const req = createOverridesService({
            prisma: p,
            permissions: OVERRIDE_REQUEST_PERMS,
            stepUpFresh: true,
          });
          const created = await req.createOverride(CREATOR_CLAIMS, {
            reasonCode: 'SALES_CONCESSION',
            reasonNote: 'Conc update draft',
            effects: [{ effectKind: 'ENTITLEMENT_GRANT', catalogItemId: moduleItem.id }],
          });
          const svc = overridesSvc(p, audit);
          const body = {
            expectedRowVersion: created.rowVersion,
            reasonNote: 'Conc update draft edited',
          };
          const [a, b] = await Promise.all([
            svc.updateDraft(CREATOR_CLAIMS, created.id, body, key),
            svc.updateDraft(CREATOR_CLAIMS, created.id, body, key),
          ]);
          expect(a.id).toBe(b.id);
          expect(a.rowVersion).toBe(b.rowVersion);
        },
      },
      {
        operation: 'override.submit',
        auditAction: 'platform_override.submitted',
        setup: async (p) => {
          const req = createOverridesService({
            prisma: p,
            permissions: OVERRIDE_REQUEST_PERMS,
            stepUpFresh: true,
          });
          const created = await req.createOverride(CREATOR_CLAIMS, {
            reasonCode: 'SALES_CONCESSION',
            reasonNote: 'Gate submit',
            effects: [{ effectKind: 'ENTITLEMENT_GRANT', catalogItemId: moduleItem.id }],
          });
          overrideId = created.id;
          overrideRowVersion = created.rowVersion;
        },
        makeService: overridesSvc,
        execute: (svc, key) =>
          (svc as PlatformOverridesService).submit(
            CREATOR_CLAIMS,
            overrideId,
            { expectedRowVersion: overrideRowVersion },
            key,
          ),
        conflict: (svc, key) =>
          (svc as PlatformOverridesService).submit(
            CREATOR_CLAIMS,
            overrideId,
            { expectedRowVersion: overrideRowVersion + 99 },
            key,
          ),
        concurrent: async (p, key, audit) => {
          const req = createOverridesService({
            prisma: p,
            permissions: OVERRIDE_REQUEST_PERMS,
            stepUpFresh: true,
          });
          const created = await req.createOverride(CREATOR_CLAIMS, {
            reasonCode: 'SALES_CONCESSION',
            reasonNote: 'Conc submit',
            effects: [{ effectKind: 'ENTITLEMENT_GRANT', catalogItemId: moduleItem.id }],
          });
          const svc = overridesSvc(p, audit);
          const body = { expectedRowVersion: created.rowVersion };
          const [a, b] = await Promise.all([
            svc.submit(CREATOR_CLAIMS, created.id, body, key),
            svc.submit(CREATOR_CLAIMS, created.id, body, key),
          ]);
          expect(a.id).toBe(b.id);
          expect(a.lifecycle).toBe('PENDING_APPROVAL');
        },
      },
      {
        operation: 'override.approve',
        auditAction: 'platform_override.approved',
        setup: async (p) => {
          const pending = await seedPending(p, 'Gate approve');
          overrideId = pending.overrideId;
          overrideRowVersion = pending.rowVersion;
        },
        makeService: approveSvc,
        execute: (svc, key) =>
          (svc as PlatformOverridesService).approve(
            APPROVER_CLAIMS,
            overrideId,
            { expectedRowVersion: overrideRowVersion },
            key,
          ),
        conflict: (svc, key) =>
          (svc as PlatformOverridesService).approve(
            APPROVER_CLAIMS,
            overrideId,
            { expectedRowVersion: overrideRowVersion + 99 },
            key,
          ),
        concurrent: async (p, key, audit) => {
          const pending = await seedPending(p, 'Conc approve');
          const svc = approveSvc(p, audit);
          const body = { expectedRowVersion: pending.rowVersion };
          const [a, b] = await Promise.all([
            svc.approve(APPROVER_CLAIMS, pending.overrideId, body, key),
            svc.approve(APPROVER_CLAIMS, pending.overrideId, body, key),
          ]);
          expect(a.id).toBe(b.id);
          expect(a.lifecycle).toBe('APPROVED');
        },
      },
      {
        operation: 'override.reject',
        auditAction: 'platform_override.rejected',
        setup: async (p) => {
          const pending = await seedPending(p, 'Gate reject');
          overrideId = pending.overrideId;
          overrideRowVersion = pending.rowVersion;
        },
        makeService: approveSvc,
        execute: (svc, key) =>
          (svc as PlatformOverridesService).reject(
            APPROVER_CLAIMS,
            overrideId,
            { expectedRowVersion: overrideRowVersion, reason: 'reject for gate' },
            key,
          ),
        conflict: (svc, key) =>
          (svc as PlatformOverridesService).reject(
            APPROVER_CLAIMS,
            overrideId,
            { expectedRowVersion: overrideRowVersion, reason: 'different reject reason' },
            key,
          ),
        concurrent: async (p, key, audit) => {
          const pending = await seedPending(p, 'Conc reject');
          const svc = approveSvc(p, audit);
          const body = {
            expectedRowVersion: pending.rowVersion,
            reason: 'conc reject',
          };
          const [a, b] = await Promise.all([
            svc.reject(APPROVER_CLAIMS, pending.overrideId, body, key),
            svc.reject(APPROVER_CLAIMS, pending.overrideId, body, key),
          ]);
          expect(a.id).toBe(b.id);
          expect(a.lifecycle).toBe('REJECTED');
        },
      },
      {
        operation: 'override.revoke',
        auditAction: 'platform_override.revoked',
        setup: async (p) => {
          const approved = await seedApproved(p, 'Gate revoke');
          overrideId = approved.overrideId;
          overrideRowVersion = approved.rowVersion;
        },
        makeService: approveSvc,
        execute: (svc, key) =>
          (svc as PlatformOverridesService).revoke(
            APPROVER_CLAIMS,
            overrideId,
            { expectedRowVersion: overrideRowVersion, reason: 'revoke for gate' },
            key,
          ),
        conflict: (svc, key) =>
          (svc as PlatformOverridesService).revoke(
            APPROVER_CLAIMS,
            overrideId,
            { expectedRowVersion: overrideRowVersion, reason: 'different revoke reason' },
            key,
          ),
        concurrent: async (p, key, audit) => {
          const approved = await seedApproved(p, 'Conc revoke');
          const svc = approveSvc(p, audit);
          const body = {
            expectedRowVersion: approved.rowVersion,
            reason: 'conc revoke',
          };
          const [a, b] = await Promise.all([
            svc.revoke(APPROVER_CLAIMS, approved.overrideId, body, key),
            svc.revoke(APPROVER_CLAIMS, approved.overrideId, body, key),
          ]);
          expect(a.id).toBe(b.id);
          expect(a.lifecycle).toBe('REVOKED');
        },
      },
      {
        operation: 'override.supersede',
        auditAction: 'platform_override.superseded',
        setup: async (p) => {
          const approved = await seedApproved(p, 'Gate supersede pred');
          overrideId = approved.overrideId;
        },
        makeService: overridesSvc,
        execute: (svc, key) =>
          (svc as PlatformOverridesService).supersede(
            CREATOR_CLAIMS,
            overrideId,
            {
              reasonCode: 'CONTRACTUAL_EXCEPTION',
              reasonNote: 'Gate supersede successor',
              effects: [{ effectKind: 'ENTITLEMENT_GRANT', catalogItemId: featureItem.id }],
            },
            key,
          ),
        conflict: (svc, key) =>
          (svc as PlatformOverridesService).supersede(
            CREATOR_CLAIMS,
            overrideId,
            {
              reasonCode: 'SUPPORT_WAIVER',
              reasonNote: 'Different supersede payload',
              effects: [{ effectKind: 'ENTITLEMENT_GRANT', catalogItemId: moduleItem.id }],
            },
            key,
          ),
        concurrent: async (p, key, audit) => {
          const approved = await seedApproved(p, 'Conc supersede pred');
          const svc = overridesSvc(p, audit);
          const body = {
            reasonCode: 'CONTRACTUAL_EXCEPTION',
            reasonNote: 'Conc supersede successor',
            effects: [{ effectKind: 'ENTITLEMENT_GRANT', catalogItemId: featureItem.id }],
          };
          const [a, b] = await Promise.all([
            svc.supersede(CREATOR_CLAIMS, approved.overrideId, body, key),
            svc.supersede(CREATOR_CLAIMS, approved.overrideId, body, key),
          ]);
          expect(a.id).toBe(b.id);
        },
      },
    ];
  }

  // ── A. Idempotency matrix ───────────────────────────────────────────────

  it('idempotency matrix: replay, conflict, recreate, concurrent for every durable op', async () => {
    for (const op of buildMatrix()) {
      await cleanupPlatformAddonsTables(prisma);
      const key = `idem-${op.operation.replace(/\./g, '-')}`;

      await op.setup(prisma);
      const audit = new FakeAddonAuditLog();
      const svc = op.makeService(prisma, audit);

      const first = await op.execute(svc, key);
      expect(await completedIdemCount(prisma, key, op.operation)).toBe(1);

      // Replay same key/payload → same id
      const replay = await op.execute(svc, key);
      expect(replay.id).toBe(first.id);
      expect(await completedIdemCount(prisma, key, op.operation)).toBe(1);

      // Different payload same key → 409
      await expect(op.conflict(svc, key)).rejects.toBeInstanceOf(ConflictException);

      // Recreate service (new instance) → replay works
      const svc2 = op.makeService(prisma, new FakeAddonAuditLog());
      const replay2 = await op.execute(svc2, key);
      expect(replay2.id).toBe(first.id);
      expect(await completedIdemCount(prisma, key, op.operation)).toBe(1);

      // Concurrent equivalent — durable AuditEntry delta (Fake in-tx pushes survive rollback).
      // Completed-only idempotency allows both callers to begin; unique SoR + recover keeps
      // one business effect (idempotency completed=1). Audit delta is 1, or rarely 2 when both
      // Model A txs observe a win before conflict serialization — still bounded and non-orphaning.
      await cleanupPlatformAddonsTables(prisma);
      const auditBefore = await prisma.auditEntry.count({
        where: { action: op.auditAction },
      });
      const concAudit = durableAudit(prisma);
      await op.concurrent(prisma, key, concAudit as never);
      expect(await completedIdemCount(prisma, key, op.operation)).toBe(1);
      const auditAfter = await prisma.auditEntry.count({
        where: { action: op.auditAction },
      });
      const auditDelta = auditAfter - auditBefore;
      expect(auditDelta).toBeGreaterThanOrEqual(1);
      expect(auditDelta).toBeLessThanOrEqual(2);
    }
  });

  // ── B. Rate limits ──────────────────────────────────────────────────────

  it('mutation rate limit=1 → second createAddOn 429, no completed row', async () => {
    const addons = createAddonsService({
      prisma,
      permissions: ADDON_PERMS,
      config: { mutationRateLimitPerMinute: 1 },
    });
    await addons.createAddOn(CREATOR_CLAIMS, {
      canonicalKey: 'addon.rate_mut_a',
      translations: addonTranslations('Rate A'),
    });
    let blocked: unknown;
    try {
      await addons.createAddOn(
        CREATOR_CLAIMS,
        {
          canonicalKey: 'addon.rate_mut_b',
          translations: addonTranslations('Rate B'),
        },
        'idem-rate-mut-blocked',
      );
    } catch (err) {
      blocked = err;
    }
    expect(blocked).toBeInstanceOf(HttpException);
    expect(blocked).toMatchObject({ status: 429 });
    expect(
      await prisma.platformCommercialIdempotencyRecord.count({
        where: { idempotencyKey: 'idem-rate-mut-blocked' },
      }),
    ).toBe(0);
  });

  it('highImpact rate limit=1 → second publish on another draft 429', async () => {
    const addons = createAddonsService({
      prisma,
      permissions: ALL_PERMS,
      stepUpFresh: true,
      config: { highImpactRateLimitPerMinute: 1 },
    });
    const a1 = await addons.createAddOn(CREATOR_CLAIMS, {
      canonicalKey: 'addon.rate_hi_a',
      translations: addonTranslations('Hi A'),
    });
    const d1 = await addons.createDraftVersion(CREATOR_CLAIMS, a1.id, {
      translations: versionTranslations('h1'),
    });
    await addons.publishVersion(CREATOR_CLAIMS, a1.id, d1.id, {
      expectedRowVersion: d1.rowVersion,
      reason: 'first high-impact publish',
    });

    const helper = createAddonsService({
      prisma,
      permissions: ALL_PERMS,
      stepUpFresh: true,
    });
    const a2 = await helper.createAddOn(CREATOR_CLAIMS, {
      canonicalKey: 'addon.rate_hi_b',
      translations: addonTranslations('Hi B'),
    });
    const d2 = await helper.createDraftVersion(CREATOR_CLAIMS, a2.id, {
      translations: versionTranslations('h2'),
    });
    await expect(
      addons.publishVersion(
        CREATOR_CLAIMS,
        a2.id,
        d2.id,
        { expectedRowVersion: d2.rowVersion, reason: 'second publish blocked' },
        'idem-rate-hi-blocked',
      ),
    ).rejects.toMatchObject({ status: 429 });
    expect(
      await prisma.platformCommercialIdempotencyRecord.count({
        where: { idempotencyKey: 'idem-rate-hi-blocked' },
      }),
    ).toBe(0);
    const stillDraft = await prisma.platformAddOnVersion.findUniqueOrThrow({
      where: { id: d2.id },
    });
    expect(stillDraft.lifecycle).toBe('DRAFT');
  });

  it('readHeavy rate limit=1 → second getReadiness or composition.preview 429', async () => {
    const addons = createAddonsService({
      prisma,
      permissions: ALL_PERMS,
      stepUpFresh: true,
      config: { readHeavyRateLimitPerMinute: 1 },
    });
    const addon = await addons.createAddOn(CREATOR_CLAIMS, {
      canonicalKey: 'addon.rate_read',
      translations: addonTranslations('Read'),
    });
    const draft = await addons.createDraftVersion(CREATOR_CLAIMS, addon.id, {
      translations: versionTranslations('r1'),
    });
    await addons.getReadiness(CREATOR_CLAIMS, addon.id, draft.id);
    await expect(addons.getReadiness(CREATOR_CLAIMS, addon.id, draft.id)).rejects.toMatchObject({
      status: 429,
    });

    const composition = createCompositionService({
      prisma,
      permissions: ALL_PERMS,
      config: { readHeavyRateLimitPerMinute: 1 },
    });
    const planVersion = await prisma.platformPlanVersion.findFirstOrThrow();
    await composition.preview(CREATOR_CLAIMS, { planVersionId: planVersion.id });
    await expect(
      composition.preview(CREATOR_CLAIMS, { planVersionId: planVersion.id }),
    ).rejects.toMatchObject({ status: 429 });
  });

  // ── C. Authz ────────────────────────────────────────────────────────────

  it('addon.view only → replaceEntitlements Forbidden, no write', async () => {
    const manager = createAddonsService({
      prisma,
      permissions: ALL_PERMS,
      stepUpFresh: true,
    });
    const addon = await manager.createAddOn(CREATOR_CLAIMS, {
      canonicalKey: 'addon.authz_view',
      translations: addonTranslations('Authz View'),
    });
    const draft = await manager.createDraftVersion(CREATOR_CLAIMS, addon.id, {
      translations: versionTranslations('av'),
    });
    const before = await prisma.platformAddOnVersionEntitlement.count({
      where: { addOnVersionId: draft.id },
    });
    const viewer = createAddonsService({
      prisma,
      permissions: ['addon.view'],
      stepUpFresh: true,
    });
    await expect(
      viewer.replaceEntitlements(CREATOR_CLAIMS, addon.id, draft.id, {
        expectedRowVersion: draft.rowVersion,
        catalogItemIds: [moduleItem.id],
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(
      await prisma.platformAddOnVersionEntitlement.count({
        where: { addOnVersionId: draft.id },
      }),
    ).toBe(before);
    const version = await prisma.platformAddOnVersion.findUniqueOrThrow({
      where: { id: draft.id },
    });
    expect(version.rowVersion).toBe(draft.rowVersion);
  });

  it('override.request only → approve Forbidden', async () => {
    const requester = createOverridesService({
      prisma,
      permissions: OVERRIDE_REQUEST_PERMS,
      stepUpFresh: true,
    });
    const created = await requester.createOverride(CREATOR_CLAIMS, {
      reasonCode: 'SALES_CONCESSION',
      reasonNote: 'Authz approve deny',
      effects: [{ effectKind: 'ENTITLEMENT_GRANT', catalogItemId: moduleItem.id }],
    });
    const submitted = await requester.submit(CREATOR_CLAIMS, created.id, {
      expectedRowVersion: created.rowVersion,
    });
    await expect(
      requester.approve(APPROVER_CLAIMS, created.id, {
        expectedRowVersion: submitted.rowVersion,
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    const row = await prisma.platformCommercialOverride.findUniqueOrThrow({
      where: { id: created.id },
    });
    expect(row.lifecycle).toBe('PENDING_APPROVAL');
  });

  it('plan.view only → createAddOn Forbidden', async () => {
    const plansOnly = createAddonsService({
      prisma,
      permissions: ['plan.view'],
      stepUpFresh: true,
    });
    const before = await prisma.platformAddOn.count();
    await expect(
      plansOnly.createAddOn(CREATOR_CLAIMS, {
        canonicalKey: 'addon.authz_plan',
        translations: addonTranslations('Authz Plan'),
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(await prisma.platformAddOn.count()).toBe(before);
  });

  // ── D. Rollback injection ───────────────────────────────────────────────

  it('failureHook after_entitlement_partial_insert rolls back entitlements and idempotency', async () => {
    const addonsSetup = createAddonsService({
      prisma,
      permissions: ALL_PERMS,
      stepUpFresh: true,
    });
    const addon = await addonsSetup.createAddOn(CREATOR_CLAIMS, {
      canonicalKey: 'addon.rollback_ent',
      translations: addonTranslations('Rollback Ent'),
    });
    const draft = await addonsSetup.createDraftVersion(CREATOR_CLAIMS, addon.id, {
      translations: versionTranslations('rb'),
    });
    const seeded = await addonsSetup.replaceEntitlements(CREATOR_CLAIMS, addon.id, draft.id, {
      expectedRowVersion: draft.rowVersion,
      catalogItemIds: [moduleItem.id],
    });
    const beforeCount = await prisma.platformAddOnVersionEntitlement.count({
      where: { addOnVersionId: draft.id },
    });
    expect(beforeCount).toBe(1);

    const failing = createAddonsService({
      prisma,
      permissions: ALL_PERMS,
      stepUpFresh: true,
      failureHook: async (point) => {
        if (point === 'after_entitlement_partial_insert') {
          throw new Error('injected after_entitlement_partial_insert');
        }
      },
    });
    await expect(
      failing.replaceEntitlements(
        CREATOR_CLAIMS,
        addon.id,
        draft.id,
        {
          expectedRowVersion: seeded.rowVersion,
          catalogItemIds: [moduleItem.id, featureItem.id],
        },
        'idem-rollback-ent',
      ),
    ).rejects.toThrow(/after_entitlement_partial_insert/);

    const after = await prisma.platformAddOnVersion.findUniqueOrThrow({
      where: { id: draft.id },
    });
    expect(after.rowVersion).toBe(seeded.rowVersion);
    expect(
      await prisma.platformAddOnVersionEntitlement.count({
        where: { addOnVersionId: draft.id },
      }),
    ).toBe(beforeCount);
    const remaining = await prisma.platformAddOnVersionEntitlement.findMany({
      where: { addOnVersionId: draft.id },
    });
    expect(remaining.map((r) => r.catalogItemId)).toEqual([moduleItem.id]);
    expect(
      await prisma.platformCommercialIdempotencyRecord.count({
        where: { idempotencyKey: 'idem-rollback-ent' },
      }),
    ).toBe(0);
  });

  it('failureHook before_approve_commit keeps PENDING_APPROVAL and no completed row', async () => {
    const requester = createOverridesService({
      prisma,
      permissions: OVERRIDE_REQUEST_PERMS,
      stepUpFresh: true,
    });
    const created = await requester.createOverride(CREATOR_CLAIMS, {
      reasonCode: 'SALES_CONCESSION',
      reasonNote: 'Rollback approve',
      effects: [{ effectKind: 'ENTITLEMENT_GRANT', catalogItemId: moduleItem.id }],
    });
    const submitted = await requester.submit(CREATOR_CLAIMS, created.id, {
      expectedRowVersion: created.rowVersion,
    });

    const failingApprover = createOverridesService({
      prisma,
      permissions: OVERRIDE_APPROVE_PERMS,
      stepUpFresh: true,
      failureHook: async (point) => {
        if (point === 'before_approve_commit') {
          throw new Error('injected before_approve_commit');
        }
      },
    });
    await expect(
      failingApprover.approve(
        APPROVER_CLAIMS,
        created.id,
        { expectedRowVersion: submitted.rowVersion },
        'idem-rollback-approve',
      ),
    ).rejects.toThrow(/before_approve_commit/);

    const row = await prisma.platformCommercialOverride.findUniqueOrThrow({
      where: { id: created.id },
    });
    expect(row.lifecycle).toBe('PENDING_APPROVAL');
    expect(row.approvedByPlatformUserId).toBeNull();
    expect(
      await prisma.platformCommercialIdempotencyRecord.count({
        where: { idempotencyKey: 'idem-rollback-approve' },
      }),
    ).toBe(0);
  });

  // ── E. Audit redaction (real adapter) ───────────────────────────────────

  it('AuditTrailPlatformAddonsAuditLog redacts sensitive fields on platform_addon.created', async () => {
    const audit = durableAudit(prisma);
    const addons = createAddonsService({
      prisma,
      permissions: ALL_PERMS,
      stepUpFresh: true,
      audit,
    });
    const created = await addons.createAddOn(
      CREATOR_CLAIMS,
      {
        canonicalKey: 'addon.audit_redact',
        translations: [
          {
            locale: 'en-US',
            displayName: 'Audit',
            shortDescription: 'must-not-appear-shortDescription',
          },
          {
            locale: 'ar-SY',
            displayName: 'تدقيق',
            shortDescription: 'وصف سري',
          },
        ],
      },
      'idem-audit-redact',
    );

    const rows = await prisma.auditEntry.findMany({
      where: {
        action: 'platform_addon.created',
        resourceId: created.id,
      },
    });
    expect(rows).toHaveLength(1);
    const serialized = JSON.stringify(rows[0].details);
    expect(serialized).not.toContain('translations');
    expect(serialized).not.toContain('shortDescription');
    expect(serialized).not.toContain('must-not-appear-shortDescription');
    expect(serialized).not.toContain('Idempotency-Key');
    expect(serialized).not.toContain('Bearer');
    expect(serialized).not.toContain('password');
    expect(serialized).not.toContain('stack');
  });

  // ── F. Concurrent grant race ────────────────────────────────────────────

  it('concurrent replaceEntitlements with different catalogs: one Conflict, one success', async () => {
    const addons = createAddonsService({
      prisma,
      permissions: ALL_PERMS,
      stepUpFresh: true,
    });
    const addon = await addons.createAddOn(CREATOR_CLAIMS, {
      canonicalKey: 'addon.grant_race',
      translations: addonTranslations('Grant Race'),
    });
    const draft = await addons.createDraftVersion(CREATOR_CLAIMS, addon.id, {
      translations: versionTranslations('gr'),
    });
    const stale = draft.rowVersion;

    const results = await Promise.allSettled([
      addons.replaceEntitlements(CREATOR_CLAIMS, addon.id, draft.id, {
        expectedRowVersion: stale,
        catalogItemIds: [moduleItem.id],
      }),
      addons.replaceEntitlements(CREATOR_CLAIMS, addon.id, draft.id, {
        expectedRowVersion: stale,
        catalogItemIds: [featureItem.id],
      }),
    ]);

    const fulfilled = results.filter((r) => r.status === 'fulfilled');
    const rejected = results.filter((r) => r.status === 'rejected');
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect((rejected[0] as PromiseRejectedResult).reason).toBeInstanceOf(ConflictException);

    const winner = (
      fulfilled[0] as PromiseFulfilledResult<{
        entitlements: Array<{ catalogItemId: string }>;
        rowVersion: number;
      }>
    ).value;
    expect(winner.rowVersion).toBe(stale + 1);
    expect(winner.entitlements).toHaveLength(1);
    const winnerCatalogId = winner.entitlements[0].catalogItemId;
    expect([moduleItem.id, featureItem.id]).toContain(winnerCatalogId);

    const finalRows = await prisma.platformAddOnVersionEntitlement.findMany({
      where: { addOnVersionId: draft.id },
    });
    expect(finalRows).toHaveLength(1);
    expect(finalRows[0].catalogItemId).toBe(winnerCatalogId);

    const version = await prisma.platformAddOnVersion.findUniqueOrThrow({
      where: { id: draft.id },
    });
    expect(version.rowVersion).toBe(stale + 1);
  });

  // ── G. Composition ──────────────────────────────────────────────────────

  it('composition ignores Draft/Rejected/Revoked; applies APPROVED; contradictory absolutes conflict', async () => {
    const overrides = createOverridesService({
      prisma,
      permissions: ALL_PERMS,
      stepUpFresh: true,
    });
    const approver = createOverridesService({
      prisma,
      permissions: OVERRIDE_APPROVE_PERMS,
      stepUpFresh: true,
    });
    const composition = createCompositionService({ prisma, permissions: ALL_PERMS });
    const planVersion = await prisma.platformPlanVersion.findFirstOrThrow();

    const draftOv = await overrides.createOverride(CREATOR_CLAIMS, {
      reasonCode: 'SALES_CONCESSION',
      reasonNote: 'Draft ignored',
      effects: [{ effectKind: 'ENTITLEMENT_GRANT', catalogItemId: featureItem.id }],
    });

    const rejectedBase = await overrides.createOverride(CREATOR_CLAIMS, {
      reasonCode: 'SUPPORT_WAIVER',
      reasonNote: 'Reject ignored',
      effects: [{ effectKind: 'ENTITLEMENT_GRANT', catalogItemId: featureItem.id }],
    });
    const rejectedSubmitted = await overrides.submit(CREATOR_CLAIMS, rejectedBase.id, {
      expectedRowVersion: rejectedBase.rowVersion,
    });
    const rejectedOv = await approver.reject(APPROVER_CLAIMS, rejectedBase.id, {
      expectedRowVersion: rejectedSubmitted.rowVersion,
      reason: 'reject for composition',
    });

    const revokedBase = await overrides.createOverride(CREATOR_CLAIMS, {
      reasonCode: 'TRIAL_EXTENSION',
      reasonNote: 'Revoke ignored',
      effects: [{ effectKind: 'ENTITLEMENT_GRANT', catalogItemId: featureItem.id }],
    });
    const revokedSubmitted = await overrides.submit(CREATOR_CLAIMS, revokedBase.id, {
      expectedRowVersion: revokedBase.rowVersion,
    });
    const revokedApproved = await approver.approve(APPROVER_CLAIMS, revokedBase.id, {
      expectedRowVersion: revokedSubmitted.rowVersion,
    });
    const revokedOv = await approver.revoke(APPROVER_CLAIMS, revokedBase.id, {
      expectedRowVersion: revokedApproved.rowVersion,
      reason: 'revoke for composition',
    });

    const approvedBase = await overrides.createOverride(CREATOR_CLAIMS, {
      reasonCode: 'CONTRACTUAL_EXCEPTION',
      reasonNote: 'Approved applied',
      effects: [{ effectKind: 'ENTITLEMENT_GRANT', catalogItemId: moduleItem.id }],
    });
    const approvedSubmitted = await overrides.submit(CREATOR_CLAIMS, approvedBase.id, {
      expectedRowVersion: approvedBase.rowVersion,
    });
    const approvedOv = await approver.approve(APPROVER_CLAIMS, approvedBase.id, {
      expectedRowVersion: approvedSubmitted.rowVersion,
    });

    const preview = await composition.preview(CREATOR_CLAIMS, {
      planVersionId: planVersion.id,
      overrideIds: [draftOv.id, rejectedOv.id, revokedOv.id, approvedOv.id],
    });
    expect(preview.overrideIds).toEqual([approvedOv.id]);
    expect(preview.ignoredOverrideIds.sort()).toEqual(
      [draftOv.id, rejectedOv.id, revokedOv.id].sort(),
    );
    expect(preview.entitlements).toContain(moduleItem.canonicalKey);
    expect(preview.licensingEngineCalled).toBe(false);
    expect(preview.runtimeEffective).toBe(false);

    const absA = await overrides.createOverride(CREATOR_CLAIMS, {
      reasonCode: 'OTHER',
      reasonNote: 'Absolute A',
      effects: [
        {
          effectKind: 'LIMIT_SET_ABSOLUTE',
          catalogItemId: limitItem.id,
          valueText: '10',
        },
      ],
    });
    const absASub = await overrides.submit(CREATOR_CLAIMS, absA.id, {
      expectedRowVersion: absA.rowVersion,
    });
    const absAApproved = await approver.approve(APPROVER_CLAIMS, absA.id, {
      expectedRowVersion: absASub.rowVersion,
    });

    const absB = await overrides.createOverride(CREATOR_CLAIMS, {
      reasonCode: 'OTHER',
      reasonNote: 'Absolute B',
      effects: [
        {
          effectKind: 'LIMIT_SET_ABSOLUTE',
          catalogItemId: limitItem.id,
          valueText: '20',
        },
      ],
    });
    const absBSub = await overrides.submit(CREATOR_CLAIMS, absB.id, {
      expectedRowVersion: absB.rowVersion,
    });
    const absBApproved = await approver.approve(APPROVER_CLAIMS, absB.id, {
      expectedRowVersion: absBSub.rowVersion,
    });

    await expect(
      composition.preview(CREATOR_CLAIMS, {
        planVersionId: planVersion.id,
        overrideIds: [absAApproved.id, absBApproved.id],
      }),
    ).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'composition_conflict' }),
    });
    await expect(
      composition.preview(CREATOR_CLAIMS, {
        planVersionId: planVersion.id,
        overrideIds: [absAApproved.id, absBApproved.id],
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('composition ignores future-effective Approved Override; multiple Add-on absolutes fail closed', async () => {
    const overrides = createOverridesService({
      prisma,
      permissions: ALL_PERMS,
      stepUpFresh: true,
    });
    const approver = createOverridesService({
      prisma,
      permissions: OVERRIDE_APPROVE_PERMS,
      stepUpFresh: true,
    });
    const addons = createAddonsService({
      prisma,
      permissions: ALL_PERMS,
      stepUpFresh: true,
    });
    const composition = createCompositionService({ prisma, permissions: ALL_PERMS });
    const planVersion = await prisma.platformPlanVersion.findFirstOrThrow();

    const future = await overrides.createOverride(CREATOR_CLAIMS, {
      reasonCode: 'TRIAL_EXTENSION',
      reasonNote: 'Future effective ignored',
      effectiveFrom: new Date(Date.now() + 86_400_000).toISOString(),
      effects: [{ effectKind: 'ENTITLEMENT_GRANT', catalogItemId: featureItem.id }],
    });
    const futureSub = await overrides.submit(CREATOR_CLAIMS, future.id, {
      expectedRowVersion: future.rowVersion,
    });
    const futureApproved = await approver.approve(APPROVER_CLAIMS, future.id, {
      expectedRowVersion: futureSub.rowVersion,
    });

    const preview = await composition.preview(CREATOR_CLAIMS, {
      planVersionId: planVersion.id,
      overrideIds: [futureApproved.id],
    });
    expect(preview.overrideIds).toEqual([]);
    expect(preview.ignoredOverrideIds).toContain(futureApproved.id);
    expect(preview.layers.overrideGrantedCount).toBe(0);

    async function publishAddonAbsolute(key: string, valueText: string) {
      const addon = await addons.createAddOn(CREATOR_CLAIMS, {
        canonicalKey: key,
        translations: addonTranslations(key),
      });
      const draft = await addons.createDraftVersion(CREATOR_CLAIMS, addon.id, {
        translations: versionTranslations('abs'),
      });
      const withLim = await addons.replaceLimitEffects(CREATOR_CLAIMS, addon.id, draft.id, {
        expectedRowVersion: draft.rowVersion,
        effects: [
          {
            catalogItemId: limitItem.id,
            effectType: 'SET_ABSOLUTE',
            unlimited: false,
            valueText,
          },
        ],
      });
      return addons.publishVersion(CREATOR_CLAIMS, addon.id, draft.id, {
        expectedRowVersion: withLim.rowVersion,
        reason: 'addon absolute',
      });
    }

    const a = await publishAddonAbsolute('addon.comp_abs_a', '10');
    const b = await publishAddonAbsolute('addon.comp_abs_b', '20');
    await expect(
      composition.preview(CREATOR_CLAIMS, {
        planVersionId: planVersion.id,
        addonVersionIds: [a.id, b.id],
      }),
    ).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'composition_conflict' }),
    });
  });
});
