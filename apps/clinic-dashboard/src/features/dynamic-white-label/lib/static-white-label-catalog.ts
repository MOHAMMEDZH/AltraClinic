import { CANONICAL_WHITE_LABEL_SURFACES } from '@booking/module-registry/whitelabel';
import {
  STATIC_WHITE_LABEL_CATALOG_IS_RUNTIME_AUTHORITY,
  isStaticWhiteLabelCatalogRuntimeAuthority,
} from '@booking/module-registry/whitelabel';

export { STATIC_WHITE_LABEL_CATALOG_IS_RUNTIME_AUTHORITY, isStaticWhiteLabelCatalogRuntimeAuthority };

export interface WhiteLabelCatalogEntry {
  extensionId: string;
  moduleId: string;
  localId: string;
  surfaceId: string;
  surface: string;
  categoryId: string;
  requiredFeature: string;
  settingsPath: string;
  deepLinkTemplate: string;
  adminResourceId: string;
  adminAction: 'view' | 'update';
  appliesTo: string[];
  assetSlots: string[];
  tokenGroups: string[];
  layoutProfileId?: string;
  localizationOptionIds: string[];
  defaultEnabled: boolean;
  rollbackBehavior: 'platform' | 'tenant-json';
  labelKey: string;
  descriptionKey: string;
  providerKey: string;
  sortOrder: number;
  schemaVersion: 1;
}

function surfaceToEntry(surface: (typeof CANONICAL_WHITE_LABEL_SURFACES)[number]): WhiteLabelCatalogEntry {
  return {
    extensionId: `${surface.moduleId}/whiteLabel/${surface.localId}`,
    moduleId: surface.moduleId,
    localId: surface.localId,
    surfaceId: surface.surfaceId,
    surface: surface.surface,
    categoryId: surface.categoryId,
    requiredFeature: surface.requiredFeature,
    settingsPath: surface.settingsPath,
    deepLinkTemplate: surface.deepLinkTemplate,
    adminResourceId: surface.adminResourceId,
    adminAction: surface.adminAction,
    appliesTo: [...surface.appliesTo],
    assetSlots: [...surface.assetSlots],
    tokenGroups: [...surface.tokenGroups],
    layoutProfileId: surface.layoutProfileId,
    localizationOptionIds: [...surface.localizationOptionIds],
    defaultEnabled: surface.defaultEnabled,
    rollbackBehavior: surface.rollbackBehavior,
    labelKey: surface.labelKey,
    descriptionKey: surface.descriptionKey,
    providerKey: surface.providerKey,
    sortOrder: surface.sortOrder,
    schemaVersion: 1,
  };
}

/** Parity baseline only — not consumed at runtime until Phase 35b. */
export const STATIC_WHITE_LABEL_CATALOG: readonly WhiteLabelCatalogEntry[] =
  CANONICAL_WHITE_LABEL_SURFACES.map(surfaceToEntry);

export function getWhiteLabelCatalogEntry(extensionId: string): WhiteLabelCatalogEntry | undefined {
  return STATIC_WHITE_LABEL_CATALOG.find((entry) => entry.extensionId === extensionId);
}

export function listWhiteLabelCatalogSurfaceIds(): string[] {
  return STATIC_WHITE_LABEL_CATALOG.map((entry) => entry.surfaceId);
}
