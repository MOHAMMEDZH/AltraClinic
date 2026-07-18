import type { LicensedModuleId, WhiteLabelContribution } from '../types';
import { moduleWhiteLabel } from '../builtin/extension-builders';
import { CANONICAL_WHITE_LABEL_SURFACES } from './canonical-surface-slots';
import type { CanonicalWhiteLabelSurface } from './white-label-types';

function surfaceToContribution(surface: CanonicalWhiteLabelSurface): WhiteLabelContribution {
  return moduleWhiteLabel(surface.moduleId, surface.localId, {
    surfaceId: surface.surfaceId,
    surface: surface.surface,
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
    categoryId: surface.categoryId,
    defaultEnabled: surface.defaultEnabled,
    rollbackBehavior: surface.rollbackBehavior,
    labelKey: surface.labelKey,
    descriptionKey: surface.descriptionKey,
    sortOrder: surface.sortOrder,
    providerKey: surface.providerKey,
    schemaVersion: surface.schemaVersion,
    resourceId: surface.adminResourceId,
  });
}

export function buildWhiteLabelContributionsForModule(moduleId: LicensedModuleId): WhiteLabelContribution[] {
  return CANONICAL_WHITE_LABEL_SURFACES.filter((surface) => surface.moduleId === moduleId).map(surfaceToContribution);
}

export function buildAllWhiteLabelContributions(): WhiteLabelContribution[] {
  return CANONICAL_WHITE_LABEL_SURFACES.map(surfaceToContribution);
}

export function listAllBuiltinWhiteLabelContributions(): WhiteLabelContribution[] {
  return buildAllWhiteLabelContributions();
}
