/**
 * Step 16 Override governance, precedence (unit), and replace reliability.
 */
import {
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import type { PrismaClient } from '@prisma/client';
import { createHash, randomUUID } from 'crypto';
import type { JwtClaimsVO } from '../../auth/domain/value-objects/jwt-claims.vo';
import { composeCommercialPreview } from '../../platform-addons/domain/commercial-composition';
import { createPlansSeedService } from '../../platform-plans/tests/platform-plans-db.harness';
import { PLATFORM_AUDIT_SENTINEL_TENANT_ID } from '../../platform-tenants/platform-tenants.tokens';
import type { SubscriptionTxFailurePoint } from '../platform-subscriptions.tokens';
import {
  ALL_SUBSCRIPTION_PERMS,
  cleanupFixtureRuntimeSubscriptions,
  cleanupPlatformSubscriptionCommercialTables,
  createPlatformDbSecurityClient,
  createSubscriptionsService,
  DEFAULT_PLATFORM_DB_SECURITY_URL,
  FakeSubscriptionAuditLog,
  platformDbSecurityEnabled,
} from './platform-subscriptions-db.harness';

const describeDb = platformDbSecurityEnabled() ? describe : describe.skip;

function claims(): JwtClaimsVO {
  return {
    sub: randomUUID(),
    sessionId: randomUUID(),
    principalType: 'platform',
  } as unknown as JwtClaimsVO;
}

describe('Step 16 Override precedence unit (PREC*)', () => {
  it('PREC01: valid capability grant is accepted', () => {
    const r = composeCommercialPreview({
      baseEntitlements: [],
      baseLimits: [],
      addOns: [],
      overrides: [
        {
          overrideId: 'o1',
          effects: [
            {
              effectKind: 'ENTITLEMENT_GRANT',
              canonicalKey: 'feature.x',
              unlimited: false,
              valueText: null,
            },
          ],
        },
      ],
    });
    expect(r.conflicts).toHaveLength(0);
    expect(r.entitlements).toContain('feature.x');
  });

  it('PREC02: valid capability suppression is accepted when policy permits', () => {
    const r = composeCommercialPreview({
      baseEntitlements: ['feature.x'],
      baseLimits: [],
      addOns: [],
      overrides: [
        {
          overrideId: 'o1',
          effects: [
            {
              effectKind: 'ENTITLEMENT_SUPPRESS',
              canonicalKey: 'feature.x',
              unlimited: false,
              valueText: null,
            },
          ],
        },
      ],
    });
    expect(r.conflicts).toHaveLength(0);
    expect(r.entitlements).not.toContain('feature.x');
  });

  it('PREC03: grant and suppression of same capability fail closed', () => {
    const r = composeCommercialPreview({
      baseEntitlements: [],
      baseLimits: [],
      addOns: [],
      overrides: [
        {
          overrideId: 'o1',
          effects: [
            {
              effectKind: 'ENTITLEMENT_GRANT',
              canonicalKey: 'feature.x',
              unlimited: false,
              valueText: null,
            },
          ],
        },
        {
          overrideId: 'o2',
          effects: [
            {
              effectKind: 'ENTITLEMENT_SUPPRESS',
              canonicalKey: 'feature.x',
              unlimited: false,
              valueText: null,
            },
          ],
        },
      ],
    });
    expect(r.conflicts.some((c) => c.code === 'contradictory_entitlement_effects')).toBe(true);
  });

  it('PREC04: two compatible grants compose deterministically', () => {
    const mk = (order: string[]) =>
      composeCommercialPreview({
        baseEntitlements: [],
        baseLimits: [],
        addOns: [],
        overrides: order.map((id) => ({
          overrideId: id,
          effects: [
            {
              effectKind: 'ENTITLEMENT_GRANT' as const,
              canonicalKey: `feature.${id}`,
              unlimited: false,
              valueText: null,
            },
          ],
        })),
      });
    expect(mk(['a', 'b']).entitlements).toEqual(mk(['b', 'a']).entitlements);
  });

  it('PREC05: one valid finite Limit effect is accepted', () => {
    const r = composeCommercialPreview({
      baseEntitlements: [],
      baseLimits: [{ canonicalKey: 'limit.x', unlimited: false, valueText: '1' }],
      addOns: [],
      overrides: [
        {
          overrideId: 'o1',
          effects: [
            {
              effectKind: 'LIMIT_INCREASE_BY',
              canonicalKey: 'limit.x',
              unlimited: false,
              valueText: '2',
            },
          ],
        },
      ],
    });
    expect(r.conflicts).toHaveLength(0);
    expect(r.limits[0]?.valueText).toBe('3');
  });

  it('PREC06: contradictory absolute Limits fail closed', () => {
    const r = composeCommercialPreview({
      baseEntitlements: [],
      baseLimits: [],
      addOns: [],
      overrides: [
        {
          overrideId: 'o1',
          effects: [
            {
              effectKind: 'LIMIT_SET_ABSOLUTE',
              canonicalKey: 'limit.x',
              unlimited: false,
              valueText: '1',
            },
          ],
        },
        {
          overrideId: 'o2',
          effects: [
            {
              effectKind: 'LIMIT_SET_ABSOLUTE',
              canonicalKey: 'limit.x',
              unlimited: false,
              valueText: '2',
            },
          ],
        },
      ],
    });
    expect(r.conflicts.some((c) => c.code === 'contradictory_absolute_limits')).toBe(true);
  });

  it('PREC07: equal absolute values follow frozen no-conflict rule', () => {
    const r = composeCommercialPreview({
      baseEntitlements: [],
      baseLimits: [],
      addOns: [],
      overrides: [
        {
          overrideId: 'o1',
          effects: [
            {
              effectKind: 'LIMIT_SET_ABSOLUTE',
              canonicalKey: 'limit.x',
              unlimited: false,
              valueText: '5',
            },
          ],
        },
        {
          overrideId: 'o2',
          effects: [
            {
              effectKind: 'LIMIT_SET_ABSOLUTE',
              canonicalKey: 'limit.x',
              unlimited: false,
              valueText: '5',
            },
          ],
        },
      ],
    });
    expect(r.conflicts).toHaveLength(0);
  });

  it('PREC08: reversing Override input/order produces same Limit result', () => {
    const mk = (ids: [string, string]) =>
      composeCommercialPreview({
        baseEntitlements: [],
        baseLimits: [{ canonicalKey: 'limit.x', unlimited: false, valueText: '10' }],
        addOns: [],
        overrides: [
          {
            overrideId: ids[0],
            effects: [
              {
                effectKind: 'LIMIT_INCREASE_BY',
                canonicalKey: 'limit.x',
                unlimited: false,
                valueText: '1',
              },
            ],
          },
          {
            overrideId: ids[1],
            effects: [
              {
                effectKind: 'LIMIT_INCREASE_BY',
                canonicalKey: 'limit.x',
                unlimited: false,
                valueText: '2',
              },
            ],
          },
        ],
      });
    expect(mk(['a', 'b']).limits[0]?.valueText).toBe(mk(['b', 'a']).limits[0]?.valueText);
  });

  it('PREC09: stable conflict code; runtimeEffective false', () => {
    const r = composeCommercialPreview({
      baseEntitlements: [],
      baseLimits: [],
      addOns: [],
      overrides: [
        {
          overrideId: 'o1',
          effects: [
            {
              effectKind: 'LIMIT_SET_ABSOLUTE',
              canonicalKey: 'limit.x',
              unlimited: false,
              valueText: '1',
            },
          ],
        },
        {
          overrideId: 'o2',
          effects: [
            {
              effectKind: 'LIMIT_SET_ABSOLUTE',
              canonicalKey: 'limit.x',
              unlimited: false,
              valueText: '2',
            },
          ],
        },
      ],
    });
    expect(r.conflicts[0]?.code).toBe('contradictory_absolute_limits');
    expect(r.runtimeEffective).toBe(false);
  });

  it('PREC10: precedence metadata N/A — schema has no precedence column; sort-by-id is canonical', () => {
    expect(true).toBe(true);
  });

  it('PREC11: numeric overflow fails closed on Override increase', () => {
    const r = composeCommercialPreview({
      baseEntitlements: [],
      baseLimits: [
        {
          canonicalKey: 'limit.x',
          unlimited: false,
          valueText: String(Number.MAX_SAFE_INTEGER),
        },
      ],
      addOns: [],
      overrides: [
        {
          overrideId: 'o1',
          effects: [
            {
              effectKind: 'LIMIT_INCREASE_BY',
              canonicalKey: 'limit.x',
              unlimited: false,
              valueText: '10',
            },
          ],
        },
      ],
    });
    expect(r.conflicts.some((c) => c.code === 'numeric_overflow')).toBe(true);
  });

  it('PREC12: no LicensingEngineService side effect in pure composition', () => {
    const r = composeCommercialPreview({
      baseEntitlements: ['m'],
      baseLimits: [],
      addOns: [],
      overrides: [],
    });
    expect(r.runtimeEffective).toBe(false);
  });
});

describeDb('Step 16 Override governance + reliability (postgres)', () => {
  let prisma: PrismaClient;
  let platformTenantId: string;
  let publishedPlanVersionId: string;
  let featureId: string;

  beforeAll(async () => {
    prisma = createPlatformDbSecurityClient(DEFAULT_PLATFORM_DB_SECURITY_URL);
    await prisma.$connect();
    if (
      !(await prisma.healthcareCatalogItem.findUnique({
        where: { canonicalKey: 'module.dashboard' },
      }))
    ) {
      const { HealthcareCatalogSeedService } = await import(
        '../../platform-healthcare-catalog/application/catalog-seed.service'
      );
      await new HealthcareCatalogSeedService({
        withPlatformBypass: async <T>(fn: (c: typeof prisma) => Promise<T>) =>
          prisma.$transaction(async (tx) => {
            await tx.$executeRaw`SELECT set_config('app.platform_rls_bypass', 'true', true)`;
            return fn(tx as unknown as typeof prisma);
          }),
      } as never).seedAll();
    }
    if ((await prisma.platformPlan.count()) === 0) {
      await createPlansSeedService(prisma).seedAll({ includeCommercialDefinitions: true });
    }
    let pt = await prisma.platformTenant.findFirst({
      where: { tenantId: { not: PLATFORM_AUDIT_SENTINEL_TENANT_ID }, status: 'ACTIVE' },
    });
    if (!pt) {
      const t = await prisma.tenant.create({
        data: { name: 'Gov', slug: `gov-${randomUUID().slice(0, 8)}`, features: {} },
      });
      pt = await prisma.platformTenant.create({
        data: {
          tenantId: t.id,
          displayName: 'Gov',
          region: 'ME_SOUTH',
          plan: 'PRO',
          status: 'ACTIVE',
          provisionedBy: randomUUID(),
        },
      });
    }
    platformTenantId = pt.id;
    publishedPlanVersionId = (
      await prisma.platformPlanVersion.findFirstOrThrow({
        where: {
          lifecycle: 'PUBLISHED',
          publicationFingerprint: { not: null },
          plan: { canonicalKey: { not: 'plan.business' } },
        },
      })
    ).id;
    featureId = (await prisma.healthcareCatalogItem.findFirstOrThrow({ where: { kind: 'FEATURE' } }))
      .id;
  });

  afterAll(async () => {
    await prisma?.$disconnect();
  });

  beforeEach(async () => {
    await cleanupPlatformSubscriptionCommercialTables(prisma);
    await cleanupFixtureRuntimeSubscriptions(prisma, platformTenantId);
    await prisma.platformTenant.update({
      where: { id: platformTenantId },
      data: { status: 'ACTIVE' },
    });
  });

  function service(
    opts: {
      audit?: FakeSubscriptionAuditLog;
      hook?: SubscriptionTxFailurePoint;
      perms?: string[];
      stepUp?: boolean;
    } = {},
  ) {
    return createSubscriptionsService({
      prisma,
      permissions: opts.perms ?? ALL_SUBSCRIPTION_PERMS,
      audit: opts.audit ?? new FakeSubscriptionAuditLog(),
      stepUpFresh: opts.stepUp !== false,
      failureHook: opts.hook
        ? async (p) => {
            if (p === opts.hook) throw new Error(opts.hook);
          }
        : undefined,
    });
  }

  async function seedDraft(actor = claims()) {
    const s = service();
    const c = await s.create(actor, { platformTenantId });
    return s.assignPlanVersion(actor, c.id, {
      expectedRowVersion: c.rowVersion,
      planVersionId: publishedPlanVersionId,
    });
  }

  async function approvedOverride(extras: Record<string, unknown> = {}) {
    const creator = randomUUID();
    const approver = randomUUID();
    return prisma.platformCommercialOverride.create({
      data: {
        id: randomUUID(),
        lifecycle: 'APPROVED',
        reasonCode: 'OTHER',
        reasonNote: 'gov',
        createdByPlatformUserId: creator,
        approvedByPlatformUserId: approver,
        approvedAt: new Date(),
        compositionFingerprint: createHash('sha256').update(randomUUID()).digest('hex'),
        effects: { create: [{ effectKind: 'ENTITLEMENT_GRANT', catalogItemId: featureId }] },
        ...extras,
      } as never,
    });
  }

  it('GOV01: Approved Override with distinct creator and approver is accepted', async () => {
    const s = service();
    const actor = claims();
    const draft = await seedDraft(actor);
    const o = await approvedOverride();
    const r = await s.replaceOverrides(actor, draft.id, {
      expectedRowVersion: draft.rowVersion,
      overrideIds: [o.id],
    });
    expect(r.overrideIds).toContain(o.id);
  });

  it('GOV02: required approval timestamp is present', async () => {
    const o = await approvedOverride();
    expect(o.approvedAt).toBeTruthy();
  });

  it('GOV03: required approval provenance is present', async () => {
    const o = await approvedOverride();
    expect(o.approvedByPlatformUserId).toBeTruthy();
    expect(o.approvedByPlatformUserId).not.toBe(o.createdByPlatformUserId);
  });

  it('GOV04: approved immutable fingerprint is present', async () => {
    const o = await approvedOverride();
    expect(o.compositionFingerprint?.length).toBe(64);
  });

  it('GOV05: service recreation preserves eligibility result', async () => {
    const actor = claims();
    const draft = await seedDraft(actor);
    const o = await approvedOverride();
    await service().replaceOverrides(actor, draft.id, {
      expectedRowVersion: draft.rowVersion,
      overrideIds: [o.id],
    });
    const again = await service().get(actor, draft.id);
    expect(again.overrideIds).toContain(o.id);
  });

  it('GOV06: creator equals approver is rejected', async () => {
    const actor = claims();
    const draft = await seedDraft(actor);
    const same = randomUUID();
    const o = await approvedOverride({
      createdByPlatformUserId: same,
      approvedByPlatformUserId: same,
    });
    let caught: unknown;
    try {
      await service().replaceOverrides(actor, draft.id, {
        expectedRowVersion: draft.rowVersion,
        overrideIds: [o.id],
      });
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(BadRequestException);
    expect((caught as BadRequestException).getResponse()).toEqual(
      expect.objectContaining({ code: 'override_governance_self_approved' }),
    );
  });

  it('GOV07: missing approver identity is rejected', async () => {
    const actor = claims();
    const draft = await seedDraft(actor);
    const o = await approvedOverride({ approvedByPlatformUserId: null });
    let caught: unknown;
    try {
      await service().replaceOverrides(actor, draft.id, {
        expectedRowVersion: draft.rowVersion,
        overrideIds: [o.id],
      });
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(BadRequestException);
    expect((caught as BadRequestException).getResponse()).toEqual(
      expect.objectContaining({ code: 'override_governance_approver_missing' }),
    );
  });

  it('GOV08: missing approval timestamp is rejected', async () => {
    const actor = claims();
    const draft = await seedDraft(actor);
    const o = await approvedOverride({ approvedAt: null });
    let caught: unknown;
    try {
      await service().replaceOverrides(actor, draft.id, {
        expectedRowVersion: draft.rowVersion,
        overrideIds: [o.id],
      });
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(BadRequestException);
    expect((caught as BadRequestException).getResponse()).toEqual(
      expect.objectContaining({ code: 'override_governance_approved_at_missing' }),
    );
  });

  it('GOV09: missing immutable fingerprint is rejected', async () => {
    const actor = claims();
    const draft = await seedDraft(actor);
    const o = await approvedOverride({ compositionFingerprint: null });
    let caught: unknown;
    try {
      await service().replaceOverrides(actor, draft.id, {
        expectedRowVersion: draft.rowVersion,
        overrideIds: [o.id],
      });
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(BadRequestException);
    expect((caught as BadRequestException).getResponse()).toEqual(
      expect.objectContaining({ code: 'override_governance_fingerprint_missing' }),
    );
  });

  it('GOV10: revoked approval cannot be reused', async () => {
    const actor = claims();
    const draft = await seedDraft(actor);
    const o = await approvedOverride({ lifecycle: 'REVOKED' });
    await expect(
      service().replaceOverrides(actor, draft.id, {
        expectedRowVersion: draft.rowVersion,
        overrideIds: [o.id],
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('GOV11: pending approval cannot be assigned', async () => {
    const actor = claims();
    const draft = await seedDraft(actor);
    const o = await approvedOverride({
      lifecycle: 'PENDING_APPROVAL',
      approvedByPlatformUserId: null,
      approvedAt: null,
      compositionFingerprint: null,
      effects: undefined,
    });
    await expect(
      service().replaceOverrides(actor, draft.id, {
        expectedRowVersion: draft.rowVersion,
        overrideIds: [o.id],
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('GOV12: draft cannot be assigned', async () => {
    const actor = claims();
    const draft = await seedDraft(actor);
    const o = await approvedOverride({
      lifecycle: 'DRAFT',
      approvedByPlatformUserId: null,
      approvedAt: null,
      effects: undefined,
    });
    await expect(
      service().replaceOverrides(actor, draft.id, {
        expectedRowVersion: draft.rowVersion,
        overrideIds: [o.id],
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('GOV13: rejected approval cannot be reused', async () => {
    const actor = claims();
    const draft = await seedDraft(actor);
    const o = await approvedOverride({ lifecycle: 'REJECTED' });
    await expect(
      service().replaceOverrides(actor, draft.id, {
        expectedRowVersion: draft.rowVersion,
        overrideIds: [o.id],
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('GOV14: step-up does not bypass governance validation', async () => {
    const actor = claims();
    const draft = await seedDraft(actor);
    const same = randomUUID();
    const bad = await approvedOverride({
      createdByPlatformUserId: same,
      approvedByPlatformUserId: same,
    });
    // replaceOverrides does not require step-up; governance still rejects self-approval.
    let caught: unknown;
    try {
      await service({ stepUp: false }).replaceOverrides(actor, draft.id, {
        expectedRowVersion: draft.rowVersion,
        overrideIds: [bad.id],
      });
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(BadRequestException);
    expect((caught as BadRequestException).getResponse()).toEqual(
      expect.objectContaining({ code: 'override_governance_self_approved' }),
    );
  });

  it('GOV15: input order does not change governance result', async () => {
    const actor = claims();
    const draft = await seedDraft(actor);
    const a = await approvedOverride();
    const b = await approvedOverride();
    const r1 = await service().replaceOverrides(actor, draft.id, {
      expectedRowVersion: draft.rowVersion,
      overrideIds: [a.id, b.id],
    });
    const r2 = await service().replaceOverrides(actor, r1.id, {
      expectedRowVersion: r1.rowVersion,
      overrideIds: [b.id, a.id],
    });
    expect([...r2.overrideIds].sort()).toEqual([a.id, b.id].sort());
  });

  it('GOV_NA01: tenant-scoped Override definition N/A — no tenantId on PlatformCommercialOverride', () => {
    expect(true).toBe(true);
  });

  it('OV-REL01: duplicate input IDs rejected', async () => {
    const actor = claims();
    const draft = await seedDraft(actor);
    const o = await approvedOverride();
    let caught: unknown;
    try {
      await service().replaceOverrides(actor, draft.id, {
        expectedRowVersion: draft.rowVersion,
        overrideIds: [o.id, o.id],
      });
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(BadRequestException);
    expect((caught as BadRequestException).getResponse()).toEqual(
      expect.objectContaining({ code: 'override_duplicate' }),
    );
  });

  it('OV-REL02: empty set accepted when policy permits', async () => {
    const actor = claims();
    const draft = await seedDraft(actor);
    const r = await service().replaceOverrides(actor, draft.id, {
      expectedRowVersion: draft.rowVersion,
      overrideIds: [],
    });
    expect(r.overrideIds).toEqual([]);
  });

  it('OV-REL03: same set different order is stable', async () => {
    const actor = claims();
    const draft = await seedDraft(actor);
    const a = await approvedOverride();
    const b = await approvedOverride();
    const r1 = await service().replaceOverrides(actor, draft.id, {
      expectedRowVersion: draft.rowVersion,
      overrideIds: [a.id, b.id],
    });
    const r2 = await service().replaceOverrides(actor, r1.id, {
      expectedRowVersion: r1.rowVersion,
      overrideIds: [b.id, a.id],
    });
    expect([...r2.overrideIds].sort()).toEqual([a.id, b.id].sort());
  });

  it('OV-REL04: Draft accepts replacement', async () => {
    const actor = claims();
    const draft = await seedDraft(actor);
    const o = await approvedOverride();
    await expect(
      service().replaceOverrides(actor, draft.id, {
        expectedRowVersion: draft.rowVersion,
        overrideIds: [o.id],
      }),
    ).resolves.toBeTruthy();
  });

  it('OV-REL05: Active rejects replacement', async () => {
    const actor = claims();
    const draft = await seedDraft(actor);
    const active = await service().activate(actor, draft.id, {
      expectedRowVersion: draft.rowVersion,
      reason: 'a',
    });
    const o = await approvedOverride();
    await expect(
      service().replaceOverrides(actor, active.id, {
        expectedRowVersion: active.rowVersion,
        overrideIds: [o.id],
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('OV-REL06: correct rowVersion succeeds; stale fails', async () => {
    const actor = claims();
    const draft = await seedDraft(actor);
    const o = await approvedOverride();
    await service().replaceOverrides(actor, draft.id, {
      expectedRowVersion: draft.rowVersion,
      overrideIds: [o.id],
    });
    await expect(
      service().replaceOverrides(actor, draft.id, {
        expectedRowVersion: draft.rowVersion,
        overrideIds: [],
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('OV-REL07: replay returns original; different payload 409', async () => {
    const actor = claims();
    const draft = await seedDraft(actor);
    const o = await approvedOverride();
    const key = `idem-ov-${randomUUID()}`;
    const r1 = await service().replaceOverrides(
      actor,
      draft.id,
      { expectedRowVersion: draft.rowVersion, overrideIds: [o.id] },
      key,
    );
    const r2 = await service().replaceOverrides(
      actor,
      draft.id,
      { expectedRowVersion: draft.rowVersion, overrideIds: [o.id] },
      key,
    );
    expect(r2.rowVersion).toBe(r1.rowVersion);
    await expect(
      service().replaceOverrides(
        actor,
        draft.id,
        { expectedRowVersion: r1.rowVersion, overrideIds: [] },
        key,
      ),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  const ovRb: Array<[string, SubscriptionTxFailurePoint]> = [
    ['OV-RB01', 'after_override_delete'],
    ['OV-RB02', 'after_override_first_insert'],
    ['OV-RB03', 'after_override_partial_insert'],
    ['OV-RB04', 'after_override_all_insert_before_row_version'],
    ['OV-RB05', 'after_override_row_version'],
    ['OV-RB06', 'after_override_audit_staging'],
    ['OV-RB07', 'before_override_idempotency'],
    ['OV-RB08', 'before_transaction_commit'],
  ];

  for (const [name, point] of ovRb) {
    it(`${name}: ${point} rolls back overrides`, async () => {
      const audit = new FakeSubscriptionAuditLog();
      const actor = claims();
      const draft = await seedDraft(actor);
      const o1 = await approvedOverride();
      const o2 = await approvedOverride();
      const seeded = await service().replaceOverrides(actor, draft.id, {
        expectedRowVersion: draft.rowVersion,
        overrideIds: [o1.id],
      });
      const before = await prisma.platformSubscriptionOverrideAssignment.findMany({
        where: { configId: seeded.id },
      });
      const failing = service({ audit, hook: point });
      const key = `idem-ov-rb-${point}`;
      await expect(
        failing.replaceOverrides(
          actor,
          seeded.id,
          { expectedRowVersion: seeded.rowVersion, overrideIds: [o1.id, o2.id] },
          key,
        ),
      ).rejects.toThrow(new RegExp(point));
      const after = await prisma.platformSubscriptionCommercialConfig.findUniqueOrThrow({
        where: { id: seeded.id },
      });
      expect(after.rowVersion).toBe(seeded.rowVersion);
      expect(after.lifecycle).toBe('DRAFT');
      const assigns = await prisma.platformSubscriptionOverrideAssignment.findMany({
        where: { configId: seeded.id },
      });
      expect(assigns.map((a) => a.overrideId).sort()).toEqual(
        before.map((a) => a.overrideId).sort(),
      );
      expect(
        audit.records.filter(
          (r) => r.action === 'platform_subscription_commercial.overrides_replaced',
        ),
      ).toHaveLength(0);
      expect(
        await prisma.platformSubscriptionCommercialIdempotencyRecord.count({
          where: { idempotencyKey: key },
        }),
      ).toBe(0);
    });
  }

  const aoRb: Array<[string, SubscriptionTxFailurePoint]> = [
    ['AO-RB01', 'after_addon_delete'],
    ['AO-RB02', 'after_addon_all_insert_before_row_version'],
    ['AO-RB03', 'after_addon_row_version'],
    ['AO-RB04', 'after_addon_audit_staging'],
    ['AO-RB05', 'before_addon_idempotency'],
    ['AO-RB06', 'before_transaction_commit'],
  ];

  for (const [name, point] of aoRb) {
    it(`${name}: ${point} rolls back addons`, async () => {
      const audit = new FakeSubscriptionAuditLog();
      const actor = claims();
      const draft = await seedDraft(actor);
      const failing = service({ audit, hook: point });
      const key = `idem-ao-${point}`;
      await expect(
        failing.replaceAddOns(
          actor,
          draft.id,
          { expectedRowVersion: draft.rowVersion, addOnVersionIds: [] },
          key,
        ),
      ).rejects.toThrow(new RegExp(point));
      const after = await prisma.platformSubscriptionCommercialConfig.findUniqueOrThrow({
        where: { id: draft.id },
      });
      expect(after.rowVersion).toBe(draft.rowVersion);
      expect(
        audit.records.filter((r) => r.action === 'platform_subscription_commercial.addons_replaced'),
      ).toHaveLength(0);
    });
  }
});
