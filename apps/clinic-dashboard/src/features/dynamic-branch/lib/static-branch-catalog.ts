import { CANONICAL_BRANCH_SURFACES } from '@booking/module-registry/branch';
import {
  STATIC_BRANCH_CATALOG_IS_RUNTIME_AUTHORITY,
  isStaticBranchCatalogRuntimeAuthority,
} from '@booking/module-registry/branch';

export { STATIC_BRANCH_CATALOG_IS_RUNTIME_AUTHORITY, isStaticBranchCatalogRuntimeAuthority };

export interface BranchCatalogEntry {
  extensionId: string;
  moduleId: string;
  localId: string;
  surfaceId: string;
  surface: string;
  categoryId: string;
  configurationCategory: string;
  branchScoped: boolean;
  crossBranchAllowed: boolean;
  inheritanceMode: string;
  adminResourceId: string;
  adminAction: 'view' | 'update' | 'manage';
  settingsPath: string;
  deepLinkTemplate: string;
  requiredFeature?: string;
  labelKey: string;
  descriptionKey: string;
  providerKey: string;
  sortOrder: number;
  schemaVersion: 1;
}

function surfaceToEntry(surface: (typeof CANONICAL_BRANCH_SURFACES)[number]): BranchCatalogEntry {
  return {
    extensionId: `${surface.moduleId}/branch/${surface.localId}`,
    moduleId: surface.moduleId,
    localId: surface.localId,
    surfaceId: surface.surfaceId,
    surface: surface.surface,
    categoryId: surface.categoryId,
    configurationCategory: surface.configurationCategory,
    branchScoped: surface.branchScoped,
    crossBranchAllowed: surface.crossBranchAllowed,
    inheritanceMode: surface.inheritanceMode,
    adminResourceId: surface.adminResourceId,
    adminAction: surface.adminAction,
    settingsPath: surface.settingsPath,
    deepLinkTemplate: surface.deepLinkTemplate,
    requiredFeature: surface.requiredFeature,
    labelKey: surface.labelKey,
    descriptionKey: surface.descriptionKey,
    providerKey: surface.providerKey,
    sortOrder: surface.sortOrder,
    schemaVersion: 1,
  };
}

/** Parity baseline + Phase 36b provider pipeline — never runtime authority (`STATIC_BRANCH_CATALOG_IS_RUNTIME_AUTHORITY = false`). */
export const STATIC_BRANCH_CATALOG: readonly BranchCatalogEntry[] = CANONICAL_BRANCH_SURFACES.map(surfaceToEntry);

export function getBranchCatalogEntry(extensionId: string): BranchCatalogEntry | undefined {
  return STATIC_BRANCH_CATALOG.find((entry) => entry.extensionId === extensionId);
}

export function listBranchCatalogSurfaceIds(): string[] {
  return STATIC_BRANCH_CATALOG.map((entry) => entry.surfaceId);
}
