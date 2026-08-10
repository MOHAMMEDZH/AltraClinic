import type { NotificationCenterContribution, ModuleManifest } from '../types';
import {
  collectManifestNotificationContributions,
  validateBuiltinNotificationIntegrity,
} from './validate-notification-integrity';
import { validateCanonicalNotificationVocabulary } from './validate-canonical-notification-vocabulary';
import {
  validateStaticNotificationCatalogParity,
  type StaticNotificationCatalogEntryLike,
} from './validate-static-notification-catalog-parity';

function compareManifestToStaticCatalog(
  contributions: NotificationCenterContribution[],
  entries: readonly StaticNotificationCatalogEntryLike[],
): string[] {
  const errors: string[] = [];
  const staticByExtensionId = new Map(entries.map((entry) => [entry.extensionId, entry]));

  if (contributions.length !== entries.length) {
    errors.push(
      `Manifest/static notification catalog count mismatch: manifest=${contributions.length} static=${entries.length}`,
    );
  }

  for (const contribution of contributions) {
    const staticEntry = staticByExtensionId.get(contribution.extensionId);
    if (!staticEntry) {
      errors.push(`Manifest notification contribution "${contribution.extensionId}" missing from static catalog`);
      continue;
    }

    if (contribution.notificationKind !== staticEntry.notificationKind) {
      errors.push(
        `Manifest/static notificationKind mismatch for "${contribution.extensionId}": manifest=${contribution.notificationKind} static=${staticEntry.notificationKind}`,
      );
    }

    if (contribution.deepLinkTemplate !== staticEntry.deepLinkTemplate) {
      errors.push(`Manifest/static deepLinkTemplate mismatch for "${contribution.extensionId}"`);
    }

    if ((contribution.providerKey ?? null) !== staticEntry.providerKey) {
      errors.push(`Manifest/static providerKey mismatch for "${contribution.extensionId}"`);
    }
  }

  return errors;
}

/**
 * End-to-end notification layer parity:
 * Canonical Vocabulary → Manifest Contributions → STATIC_NOTIFICATION_CATALOG.
 * Phase 41a: metadata only, zero runtime authority.
 */
export function validateNotificationLayerParity(
  manifests: ModuleManifest[],
  staticCatalogEntries: readonly StaticNotificationCatalogEntryLike[],
): string[] {
  const errors: string[] = [];

  errors.push(...validateCanonicalNotificationVocabulary());
  errors.push(...validateBuiltinNotificationIntegrity(manifests));
  errors.push(...validateStaticNotificationCatalogParity(staticCatalogEntries));

  const contributions = collectManifestNotificationContributions(manifests);
  errors.push(...compareManifestToStaticCatalog(contributions, staticCatalogEntries));

  return errors;
}
