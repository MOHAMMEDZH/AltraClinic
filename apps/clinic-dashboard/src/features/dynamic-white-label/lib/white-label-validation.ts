import type { WhiteLabelContribution } from '@booking/module-registry';
import { validateStaticWhiteLabelCatalogParity, validateWhiteLabelLayerParity } from '@booking/module-registry/whitelabel';
import { BUILTIN_MODULE_MANIFESTS } from '@booking/module-registry';
import type { WhiteLabelCatalogEntry } from './static-white-label-catalog';
import type { WhiteLabelSnapshot } from './white-label-types';
import { STATIC_WHITE_LABEL_CATALOG } from './static-white-label-catalog';
import { resolveWhiteLabelCapabilitiesFromSnapshot } from './white-label-resolver';

export function assertWhiteLabelCatalogValid(entries: WhiteLabelCatalogEntry[] = STATIC_WHITE_LABEL_CATALOG): string[] {
  return validateStaticWhiteLabelCatalogParity(entries);
}

export function verifyWhiteLabelCatalogParity(
  contributions: WhiteLabelContribution[],
  entries: WhiteLabelCatalogEntry[],
): string[] {
  const errors = validateStaticWhiteLabelCatalogParity(entries);
  const staticByExtensionId = new Map(entries.map((entry) => [entry.extensionId, entry]));

  if (contributions.length !== entries.length) {
    errors.push(`Contribution/catalog length mismatch: ${contributions.length} vs ${entries.length}`);
  }

  for (const contribution of contributions) {
    const catalog = staticByExtensionId.get(contribution.extensionId);
    if (!catalog) {
      errors.push(`Missing catalog entry for ${contribution.extensionId}`);
      continue;
    }
    if (contribution.surfaceId !== catalog.surfaceId) {
      errors.push(`surfaceId mismatch for ${contribution.extensionId}`);
    }
    if (contribution.deepLinkTemplate !== catalog.deepLinkTemplate) {
      errors.push(`deepLinkTemplate mismatch for ${contribution.extensionId}`);
    }
    if (contribution.providerKey !== catalog.providerKey) {
      errors.push(`providerKey mismatch for ${contribution.extensionId}`);
    }
  }

  return errors;
}

export function assertWhiteLabelSnapshotValid(snapshot: WhiteLabelSnapshot): string[] {
  const errors: string[] = [];
  const seenSurfaceIds = new Set<string>();

  for (const entry of snapshot.entries) {
    if (seenSurfaceIds.has(entry.surfaceId)) {
      errors.push(`Duplicate surfaceId in snapshot: ${entry.surfaceId}`);
    }
    seenSurfaceIds.add(entry.surfaceId);

    const catalogEntry = STATIC_WHITE_LABEL_CATALOG.find(
      (item) => item.extensionId === entry.extensionId,
    );
    if (snapshot.source === 'registry' && !catalogEntry) {
      errors.push(`Snapshot entry missing catalog match: ${entry.extensionId}`);
    }
  }

  const capabilities = resolveWhiteLabelCapabilitiesFromSnapshot(snapshot);
  if (snapshot.capabilities.canCustomizeBranding !== capabilities.canCustomizeBranding) {
    errors.push('Snapshot canCustomizeBranding capability mismatch');
  }
  if (snapshot.capabilities.canCustomizeTheme !== capabilities.canCustomizeTheme) {
    errors.push('Snapshot canCustomizeTheme capability mismatch');
  }
  if (snapshot.capabilities.canCustomizeLayout !== capabilities.canCustomizeLayout) {
    errors.push('Snapshot canCustomizeLayout capability mismatch');
  }
  if (snapshot.capabilities.canCustomizeLocalization !== capabilities.canCustomizeLocalization) {
    errors.push('Snapshot canCustomizeLocalization capability mismatch');
  }
  if (snapshot.capabilities.canUseCustomDomain !== capabilities.canUseCustomDomain) {
    errors.push('Snapshot canUseCustomDomain capability mismatch');
  }

  if (snapshot.source === 'restricted') {
    if (snapshot.entries.length > 0) {
      errors.push('Restricted snapshot must not expose white label surfaces');
    }
    if (snapshot.capabilities.canCustomizeBranding) {
      errors.push('Restricted snapshot must not enable branding capabilities');
    }
  }

  return errors;
}

export function assertWhiteLabelCatalogLoaded(): void {
  const errors = validateWhiteLabelLayerParity(BUILTIN_MODULE_MANIFESTS, STATIC_WHITE_LABEL_CATALOG);
  if (errors.length > 0) {
    throw new Error(`Invalid static white label catalog:\n${errors.join('\n')}`);
  }
}