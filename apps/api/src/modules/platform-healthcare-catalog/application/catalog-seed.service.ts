/**
 * Idempotent healthcare catalog seed — upserts by canonicalKey.
 * Does not overwrite administrator-edited translations (systemSeeded=false OR
 * translation updatedAt differs beyond create for non-forced runs).
 */
import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../infrastructure/prisma.service';
import {
  ALL_SEED_ITEMS,
  LIMIT_ALIAS_NAMESPACE,
  SEED_COMPATIBILITY_RULES,
  type SeedItem,
} from '../domain/catalog-seed.inventory';

@Injectable()
export class HealthcareCatalogSeedService {
  private readonly logger = new Logger(HealthcareCatalogSeedService.name);

  constructor(private readonly prisma: PrismaService) {}

  async seedAll(): Promise<{
    /** Inventory iteration count (source of truth for seed inventory size). */
    items: number;
    aliases: number;
    rules: number;
    /** Persisted PostgreSQL counts after upsert (includes any pre-existing non-seed rows). */
    persisted: {
      items: number;
      translations: number;
      translationsEnUs: number;
      translationsArSy: number;
      aliases: number;
      rules: number;
      byKind: Record<string, number>;
    };
  }> {
    return this.prisma.withPlatformBypass(async (client) => {
      let items = 0;
      let aliases = 0;
      let rules = 0;

      for (const seed of ALL_SEED_ITEMS) {
        const result = await this.upsertItem(client, seed);
        items += 1;
        aliases += result.aliases;
      }

      const keyToId = new Map<string, string>();
      const all = await client.healthcareCatalogItem.findMany({
        select: { id: true, canonicalKey: true, kind: true },
      });
      for (const row of all) keyToId.set(row.canonicalKey, row.id);

      for (const rule of SEED_COMPATIBILITY_RULES) {
        const subjectItemId = keyToId.get(rule.subjectKey);
        const targetItemId = keyToId.get(rule.targetKey);
        if (!subjectItemId || !targetItemId) {
          this.logger.warn(`Skipping rule — missing keys ${rule.subjectKey} → ${rule.targetKey}`);
          continue;
        }
        const anyOfGroupKey = rule.anyOfGroupKey ?? '';
        await client.healthcareCatalogCompatibilityRule.upsert({
          where: {
            ruleType_subjectItemId_targetItemId_anyOfGroupKey: {
              ruleType: rule.ruleType,
              subjectItemId,
              targetItemId,
              anyOfGroupKey,
            },
          },
          create: {
            ruleType: rule.ruleType,
            subjectItemId,
            targetItemId,
            anyOfGroupKey,
            lifecycle: 'ACTIVE',
            explanationEn: rule.explanationEn,
            explanationAr: rule.explanationAr,
            systemSeeded: true,
          },
          update: {
            // Preserve admin edits: only refresh explanations when still system-seeded ACTIVE.
            explanationEn: rule.explanationEn,
            explanationAr: rule.explanationAr,
          },
        });
        rules += 1;
      }

      const byKind: Record<string, number> = {};
      for (const row of all) {
        byKind[row.kind] = (byKind[row.kind] ?? 0) + 1;
      }
      const [translations, translationsEnUs, translationsArSy, aliasTotal, ruleTotal] =
        await Promise.all([
          client.healthcareCatalogTranslation.count(),
          client.healthcareCatalogTranslation.count({ where: { locale: 'en-US' } }),
          client.healthcareCatalogTranslation.count({ where: { locale: 'ar-SY' } }),
          client.healthcareCatalogAlias.count(),
          client.healthcareCatalogCompatibilityRule.count(),
        ]);

      return {
        items,
        aliases,
        rules,
        persisted: {
          items: all.length,
          translations,
          translationsEnUs,
          translationsArSy,
          aliases: aliasTotal,
          rules: ruleTotal,
          byKind,
        },
      };
    });
  }

  private async upsertItem(
    client: Prisma.TransactionClient,
    seed: SeedItem,
  ): Promise<{ aliases: number }> {
    const existing = await client.healthcareCatalogItem.findUnique({
      where: { canonicalKey: seed.canonicalKey },
      include: { translations: true },
    });

    const limitFields =
      seed.kind === 'LIMIT' && seed.limit
        ? {
            limitValueType: seed.limit.valueType,
            limitUnit: seed.limit.unit,
            limitZeroValid: seed.limit.zeroValid,
            limitUnlimitedSupported: seed.limit.unlimitedSupported,
          }
        : {
            limitValueType: null,
            limitUnit: null,
            limitZeroValid: null,
            limitUnlimitedSupported: null,
          };

    let itemId: string;
    if (!existing) {
      const created = await client.healthcareCatalogItem.create({
        data: {
          canonicalKey: seed.canonicalKey,
          kind: seed.kind,
          lifecycle: 'ACTIVE',
          sortOrder: seed.sortOrder,
          iconKey: seed.iconKey ?? null,
          systemSeeded: true,
          ...limitFields,
          translations: {
            create: seed.translations.map((tr) => ({
              locale: tr.locale,
              displayName: tr.displayName,
              shortDescription: tr.shortDescription,
            })),
          },
        },
      });
      itemId = created.id;
    } else {
      itemId = existing.id;
      // Do not change lifecycle or overwrite admin-managed fields on re-seed.
      await client.healthcareCatalogItem.update({
        where: { id: itemId },
        data: {
          sortOrder: seed.sortOrder,
          iconKey: seed.iconKey ?? existing.iconKey,
          systemSeeded: true,
          ...limitFields,
        },
      });

      for (const tr of seed.translations) {
        const current = existing.translations.find((x) => x.locale === tr.locale);
        if (!current) {
          await client.healthcareCatalogTranslation.create({
            data: {
              itemId,
              locale: tr.locale,
              displayName: tr.displayName,
              shortDescription: tr.shortDescription,
            },
          });
        } else if (existing.systemSeeded && current.createdAt.getTime() === current.updatedAt.getTime()) {
          // Only refresh untouched system translations.
          await client.healthcareCatalogTranslation.update({
            where: { id: current.id },
            data: {
              displayName: tr.displayName,
              shortDescription: tr.shortDescription,
            },
          });
        }
        // else: administrator edit preserved
      }
    }

    let aliasCount = 0;
    for (const alias of seed.aliases ?? []) {
      const namespace =
        seed.kind === 'LIMIT' ? LIMIT_ALIAS_NAMESPACE : alias.sourceNamespace;
      await client.healthcareCatalogAlias.upsert({
        where: {
          sourceNamespace_aliasValue: {
            sourceNamespace: namespace,
            aliasValue: alias.aliasValue,
          },
        },
        create: {
          itemId,
          aliasValue: alias.aliasValue,
          sourceNamespace: namespace,
          lifecycle: 'ACTIVE',
          reason: alias.reason,
        },
        update: {
          itemId,
          reason: alias.reason,
        },
      });
      aliasCount += 1;
    }

    return { aliases: aliasCount };
  }
}
