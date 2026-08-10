import { CANONICAL_WHITE_LABEL_SURFACE_COUNT } from './canonical-surface-slots';

export interface StaticWhiteLabelCatalogEntryLike {
  extensionId: string;
  surfaceId: string;
  moduleId: string;
  localId: string;
  surface: string;
  categoryId: string;
  requiredFeature: string;
  settingsPath: string;
  deepLinkTemplate: string;
  providerKey: string;
  schemaVersion: number;
}

export function validateStaticWhiteLabelCatalogParity(entries: readonly StaticWhiteLabelCatalogEntryLike[]): string[] {
  const errors: string[] = [];
  const seenExtensionIds = new Set<string>();
  const seenSurfaceIds = new Set<string>();
  const seenDeepLinks = new Set<string>();

  if (entries.length !== CANONICAL_WHITE_LABEL_SURFACE_COUNT) {
    errors.push(
      `Static white label catalog count mismatch: entries=${entries.length} expected=${CANONICAL_WHITE_LABEL_SURFACE_COUNT}`,
    );
  }

  for (const entry of entries) {
    if (seenExtensionIds.has(entry.extensionId)) {
      errors.push(`Duplicate static catalog extensionId "${entry.extensionId}"`);
    } else {
      seenExtensionIds.add(entry.extensionId);
    }

    if (seenSurfaceIds.has(entry.surfaceId)) {
      errors.push(`Duplicate static catalog surfaceId "${entry.surfaceId}"`);
    } else {
      seenSurfaceIds.add(entry.surfaceId);
    }

    if (seenDeepLinks.has(entry.deepLinkTemplate)) {
      errors.push(`Duplicate static catalog deepLinkTemplate "${entry.deepLinkTemplate}"`);
    } else {
      seenDeepLinks.add(entry.deepLinkTemplate);
    }

    if (!entry.extensionId.startsWith(`${entry.moduleId}/whiteLabel/`)) {
      errors.push(`Static catalog extensionId "${entry.extensionId}" has invalid module prefix`);
    }

    if (entry.schemaVersion !== 1) {
      errors.push(`Static catalog entry "${entry.surfaceId}" must have schemaVersion 1`);
    }
  }

  return errors;
}
