/**
 * Idempotent Platform Plans seed — three canonical Plans + proven aliases only.
 * Step 14: optionally seeds Draft Plan Versions with exact entitlement/Limit mappings
 * only when commercialDefinitionOwnership is UNINITIALIZED (never overwrites
 * SEED_INITIALIZED or ADMINISTRATOR_OWNED Drafts, including intentionally empty).
 */
import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../infrastructure/prisma.service';
import { SEED_PLANS, UNRESOLVED_PLAN_IDENTIFIERS } from '../domain/plan-seed.inventory';
import {
  DRAFT_VERSION_TRANSLATIONS,
  PLAN_KEY_TO_UI_TIER,
  seededEntitlementKeysForPlan,
  seededLimitsForPlan,
  type CanonicalPlanKey,
} from '../domain/plan-entitlement-seed.inventory';
import { normalizeAliasValue } from '../platform-plans.tokens';

@Injectable()
export class PlatformPlansSeedService {
  private readonly logger = new Logger(PlatformPlansSeedService.name);

  constructor(private readonly prisma: PrismaService) {}

  async seedAll(options?: { includeCommercialDefinitions?: boolean }): Promise<{
    plans: number;
    aliases: number;
    draftVersionsSeeded: number;
    entitlementsSeeded: number;
    limitsSeeded: number;
    persisted: { plans: number; aliases: number; versions: number; entitlements: number; limits: number };
  }> {
    return this.prisma.withPlatformBypass(async (client) => {
      await client.platformPlanAlias.updateMany({
        where: {
          aliasValue: 'business',
          sourceNamespace: 'clinic_ui_plan',
          lifecycle: 'ACTIVE',
        },
        data: {
          lifecycle: 'RETIRED',
          retiredAt: new Date(),
          migrationNote:
            'Retired — business is a non-Plan UI tier (Option B); not Plan-equivalent to PRO',
        },
      });

      let plans = 0;
      let aliases = 0;
      for (const seed of SEED_PLANS) {
        aliases += await this.upsertPlan(client, seed);
        plans += 1;
      }
      void UNRESOLVED_PLAN_IDENTIFIERS;
      void PLAN_KEY_TO_UI_TIER;

      let draftVersionsSeeded = 0;
      let entitlementsSeeded = 0;
      let limitsSeeded = 0;
      if (options?.includeCommercialDefinitions) {
        for (const planKey of Object.keys(PLAN_KEY_TO_UI_TIER) as CanonicalPlanKey[]) {
          const result = await this.ensureDraftCommercialDefinition(client, planKey);
          draftVersionsSeeded += result.draftCreated ? 1 : 0;
          entitlementsSeeded += result.entitlements;
          limitsSeeded += result.limits;
        }
      }

      const [planCount, aliasCount, versionCount, entitlementCount, limitCount] =
        await Promise.all([
          client.platformPlan.count(),
          client.platformPlanAlias.count({ where: { lifecycle: 'ACTIVE' } }),
          client.platformPlanVersion.count(),
          client.platformPlanVersionEntitlement.count(),
          client.platformPlanVersionLimit.count(),
        ]);
      this.logger.log(
        `Plans seed complete: plans=${planCount} versions=${versionCount} entitlements=${entitlementCount} limits=${limitCount}`,
      );
      return {
        plans,
        aliases,
        draftVersionsSeeded,
        entitlementsSeeded,
        limitsSeeded,
        persisted: {
          plans: planCount,
          aliases: aliasCount,
          versions: versionCount,
          entitlements: entitlementCount,
          limits: limitCount,
        },
      };
    });
  }

  private async ensureDraftCommercialDefinition(
    client: Prisma.TransactionClient,
    planKey: CanonicalPlanKey,
  ): Promise<{ draftCreated: boolean; entitlements: number; limits: number }> {
    const plan = await client.platformPlan.findUnique({ where: { canonicalKey: planKey } });
    if (!plan) return { draftCreated: false, entitlements: 0, limits: 0 };

    let draft = await client.platformPlanVersion.findFirst({
      where: { planId: plan.id, lifecycle: 'DRAFT' },
    });
    let draftCreated = false;
    if (!draft) {
      const agg = await client.platformPlanVersion.aggregate({
        where: { planId: plan.id },
        _max: { versionNumber: true },
      });
      const versionNumber = (agg._max.versionNumber ?? 0) + 1;
      draft = await client.platformPlanVersion.create({
        data: {
          planId: plan.id,
          versionNumber,
          lifecycle: 'DRAFT',
          systemSeeded: true,
          translations: {
            create: DRAFT_VERSION_TRANSLATIONS.map((t) => ({
              locale: t.locale,
              releaseLabel: t.releaseLabel,
              shortDescription: t.shortDescription,
            })),
          },
        },
      });
      draftCreated = true;
    }

    const ownership = (draft as { commercialDefinitionOwnership?: string })
      .commercialDefinitionOwnership ?? 'UNINITIALIZED';

    // Never overwrite administrator-owned Drafts (including intentionally empty).
    // Never re-seed already seed-initialized Drafts.
    if (ownership === 'ADMINISTRATOR_OWNED' || ownership === 'SEED_INITIALIZED') {
      return { draftCreated, entitlements: 0, limits: 0 };
    }

    // Legacy safety: if children already exist under UNINITIALIZED, treat as initialized.
    const existingEntitlementCount = await client.platformPlanVersionEntitlement.count({
      where: { planVersionId: draft.id },
    });
    const existingLimitCount = await client.platformPlanVersionLimit.count({
      where: { planVersionId: draft.id },
    });
    if (existingEntitlementCount > 0 || existingLimitCount > 0) {
      await client.platformPlanVersion.update({
        where: { id: draft.id },
        data: { commercialDefinitionOwnership: 'SEED_INITIALIZED' },
      });
      return { draftCreated, entitlements: 0, limits: 0 };
    }

    const entitlementKeys = seededEntitlementKeysForPlan(planKey);
    const catalogItems = await client.healthcareCatalogItem.findMany({
      where: { canonicalKey: { in: entitlementKeys } },
      select: { id: true, canonicalKey: true, kind: true },
    });
    const byKey = new Map(catalogItems.map((c) => [c.canonicalKey, c]));
    const missing = entitlementKeys.filter((k) => !byKey.has(k));
    if (missing.length) {
      this.logger.warn(
        `Skipping entitlement seed for ${planKey}: missing Catalog keys ${missing.slice(0, 5).join(',')}`,
      );
      return { draftCreated, entitlements: 0, limits: 0 };
    }

    await client.platformPlanVersionEntitlement.createMany({
      data: entitlementKeys.map((k) => ({
        planVersionId: draft!.id,
        catalogItemId: byKey.get(k)!.id,
      })),
      skipDuplicates: true,
    });

    const limitDefs = seededLimitsForPlan(planKey);
    const limitItems = await client.healthcareCatalogItem.findMany({
      where: { canonicalKey: { in: limitDefs.map((l) => l.canonicalCatalogKey) }, kind: 'LIMIT' },
      select: { id: true, canonicalKey: true },
    });
    const limitByKey = new Map(limitItems.map((c) => [c.canonicalKey, c]));
    const limitData = limitDefs
      .filter((l) => limitByKey.has(l.canonicalCatalogKey))
      .map((l) => ({
        planVersionId: draft!.id,
        catalogItemId: limitByKey.get(l.canonicalCatalogKey)!.id,
        unlimited: l.unlimited,
        valueText: l.valueText,
      }));
    if (limitData.length) {
      await client.platformPlanVersionLimit.createMany({
        data: limitData,
        skipDuplicates: true,
      });
    }

    await client.platformPlanVersion.update({
      where: { id: draft.id },
      data: { commercialDefinitionOwnership: 'SEED_INITIALIZED' },
    });

    return {
      draftCreated,
      entitlements: entitlementKeys.length,
      limits: limitData.length,
    };
  }

  private async upsertPlan(
    client: Prisma.TransactionClient,
    seed: (typeof SEED_PLANS)[number],
  ): Promise<number> {
    const existing = await client.platformPlan.findUnique({
      where: { canonicalKey: seed.canonicalKey },
      include: { translations: true },
    });

    let planId: string;
    if (!existing) {
      const created = await client.platformPlan.create({
        data: {
          canonicalKey: seed.canonicalKey,
          lifecycle: 'ACTIVE',
          sortOrder: seed.sortOrder,
          systemSeeded: true,
          translations: {
            create: seed.translations.map((tr) => ({
              locale: tr.locale,
              displayName: tr.displayName,
              shortDescription: tr.shortDescription,
            })),
          },
        },
      });
      planId = created.id;
    } else {
      planId = existing.id;
      await client.platformPlan.update({
        where: { id: planId },
        data: { sortOrder: seed.sortOrder, systemSeeded: true },
      });
      for (const tr of seed.translations) {
        const current = existing.translations.find((x) => x.locale === tr.locale);
        if (!current) {
          await client.platformPlanTranslation.create({
            data: {
              planId,
              locale: tr.locale,
              displayName: tr.displayName,
              shortDescription: tr.shortDescription,
            },
          });
        } else if (
          existing.systemSeeded &&
          current.createdAt.getTime() === current.updatedAt.getTime()
        ) {
          await client.platformPlanTranslation.update({
            where: { id: current.id },
            data: {
              displayName: tr.displayName,
              shortDescription: tr.shortDescription,
            },
          });
        }
      }
    }

    let aliasCount = 0;
    for (const alias of seed.aliases) {
      await client.platformPlanAlias.upsert({
        where: {
          sourceNamespace_aliasValue: {
            sourceNamespace: alias.sourceNamespace,
            aliasValue: alias.aliasValue,
          },
        },
        create: {
          planId,
          sourceNamespace: alias.sourceNamespace,
          aliasValue: alias.aliasValue,
          normalizedValue: normalizeAliasValue(alias.aliasValue),
          lifecycle: 'ACTIVE',
          migrationNote: alias.migrationNote,
        },
        update: {
          planId,
          migrationNote: alias.migrationNote,
          normalizedValue: normalizeAliasValue(alias.aliasValue),
        },
      });
      aliasCount += 1;
    }
    return aliasCount;
  }
}
