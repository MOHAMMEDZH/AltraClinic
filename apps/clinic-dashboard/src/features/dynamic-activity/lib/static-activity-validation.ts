import { BUILTIN_MODULE_MANIFESTS } from '@booking/module-registry';
import {
  validateActivityLayerParity,
  listAllBuiltinActivityContributions,
  type StaticActivityCatalogEntryLike,
} from '@booking/module-registry/activity';
import type { ActivityCatalogEntry } from './static-activity-catalog';
import { STATIC_ACTIVITY_CATALOG } from './static-activity-catalog';
import type { ActivityContribution } from '@booking/module-registry';
import { assertActivityCatalogLoaded as assertCatalogLoadedCore } from './activity-validation';

export function assertActivityCatalogLoaded(): void {
  assertCatalogLoadedCore();
}

export function assertActivityCatalogValid(
  entries: readonly ActivityCatalogEntry[] = STATIC_ACTIVITY_CATALOG,
): string[] {
  return validateActivityLayerParity(BUILTIN_MODULE_MANIFESTS, [
    ...entries,
  ] as StaticActivityCatalogEntryLike[]);
}

export function verifyActivityCatalogParity(
  contributions: ActivityContribution[],
  entries: readonly ActivityCatalogEntry[],
): string[] {
  const errors: string[] = [];
  const staticById = new Map(entries.map((entry) => [entry.extensionId, entry]));

  if (contributions.length !== entries.length) {
    errors.push(
      `Contribution/catalog count mismatch: contributions=${contributions.length} catalog=${entries.length}`,
    );
  }

  for (const contribution of contributions) {
    const entry = staticById.get(contribution.extensionId);
    if (!entry) {
      errors.push(`Missing catalog entry for ${contribution.extensionId}`);
      continue;
    }
    if (contribution.activityKind !== entry.activityKind) {
      errors.push(`activityKind drift for ${contribution.extensionId}`);
    }
    if (contribution.deepLinkTemplate !== entry.deepLinkTemplate) {
      errors.push(`deepLinkTemplate drift for ${contribution.extensionId}`);
    }
    if (contribution.providerKey !== entry.providerKey) {
      errors.push(`providerKey drift for ${contribution.extensionId}`);
    }
    if (contribution.activityKind === 'type' && contribution.activityTypeId !== entry.activityTypeId) {
      errors.push(`activityTypeId drift for ${contribution.extensionId}`);
    }
  }

  return errors;
}

export function verifyBuiltinActivityParity(): string[] {
  return verifyActivityCatalogParity(listAllBuiltinActivityContributions(), [...STATIC_ACTIVITY_CATALOG]);
}
