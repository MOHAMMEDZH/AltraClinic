import { CANONICAL_BRAND_ASSET_SLOTS, CANONICAL_BRAND_ASSET_SLOT_ID_SET } from './canonical-brand-assets';
import { CANONICAL_BRANDING_CATEGORIES, CANONICAL_BRANDING_CATEGORY_ID_SET } from './canonical-branding-categories';
import { CANONICAL_LAYOUT_PROFILES, CANONICAL_LAYOUT_PROFILE_ID_SET } from './canonical-layout-profiles';
import { CANONICAL_LOCALIZATION_OPTIONS, CANONICAL_LOCALIZATION_OPTION_ID_SET } from './canonical-localization-options';
import {
  CANONICAL_WHITE_LABEL_SURFACES,
  CANONICAL_WHITE_LABEL_SETTINGS_ROUTE_PATHS,
  CANONICAL_WHITE_LABEL_SURFACE_ID_SET,
} from './canonical-surface-slots';
import { CANONICAL_THEME_TOKENS, CANONICAL_THEME_TOKEN_GROUP_IDS, CANONICAL_THEME_TOKEN_ID_SET } from './canonical-theme-tokens';
import {
  BRAND_ASSET_VERSION_METADATA_CONTRACT,
  CANONICAL_WHITE_LABEL_FEATURE_IDS,
  type ThemeTokenTier,
} from './white-label-types';

const VALID_FEATURE_IDS = new Set<string>(CANONICAL_WHITE_LABEL_FEATURE_IDS);
const VALID_TOKEN_TIERS = new Set<ThemeTokenTier>([
  'platformLocked',
  'tenantOverride',
  'marketplaceTheme',
  'runtimePreference',
]);
const PROVIDER_KEY_PATTERN = /^[a-z][a-z0-9]*(\.[a-z][a-z0-9-]*)+$/;
const SETTINGS_ROUTE_PATHS = new Set<string>(CANONICAL_WHITE_LABEL_SETTINGS_ROUTE_PATHS);

function stripHash(path: string): string {
  return path.split('#')[0] ?? path;
}

export function validateCanonicalWhiteLabelVocabulary(): string[] {
  const errors: string[] = [];

  const seenAssetSlotIds = new Set<string>();
  for (const slot of CANONICAL_BRAND_ASSET_SLOTS) {
    if (seenAssetSlotIds.has(slot.slotId)) {
      errors.push(`Duplicate assetSlotId "${slot.slotId}"`);
    } else {
      seenAssetSlotIds.add(slot.slotId);
    }
    if (!slot.requiresContentHash || !slot.requiresAssetVersion) {
      errors.push(`Asset slot "${slot.slotId}" must require contentHash and assetVersion`);
    }
    if (!slot.cdnPathTemplate.includes('{contentHash}')) {
      errors.push(`Asset slot "${slot.slotId}" cdnPathTemplate must include {contentHash}`);
    }
  }

  const seenTokenIds = new Set<string>();
  for (const token of CANONICAL_THEME_TOKENS) {
    if (seenTokenIds.has(token.tokenId)) {
      errors.push(`Duplicate tokenId "${token.tokenId}"`);
    } else {
      seenTokenIds.add(token.tokenId);
    }
    if (!VALID_TOKEN_TIERS.has(token.tier)) {
      errors.push(`Token "${token.tokenId}" has invalid tier "${token.tier}"`);
    }
    if (token.tier === 'platformLocked' && token.marketplaceAllowlist) {
      errors.push(`Platform locked token "${token.tokenId}" cannot be marketplaceAllowlist`);
    }
    if (!CANONICAL_THEME_TOKEN_GROUP_IDS.includes(token.tokenGroupId)) {
      errors.push(`Token "${token.tokenId}" references unknown tokenGroupId "${token.tokenGroupId}"`);
    }
  }

  const seenLayoutIds = new Set<string>();
  for (const profile of CANONICAL_LAYOUT_PROFILES) {
    if (seenLayoutIds.has(profile.layoutId)) {
      errors.push(`Duplicate layoutId "${profile.layoutId}"`);
    } else {
      seenLayoutIds.add(profile.layoutId);
    }
  }

  const seenLocalizationIds = new Set<string>();
  for (const option of CANONICAL_LOCALIZATION_OPTIONS) {
    if (seenLocalizationIds.has(option.localizationId)) {
      errors.push(`Duplicate localizationId "${option.localizationId}"`);
    } else {
      seenLocalizationIds.add(option.localizationId);
    }
  }

  const seenCategoryIds = new Set<string>();
  for (const category of CANONICAL_BRANDING_CATEGORIES) {
    if (seenCategoryIds.has(category.categoryId)) {
      errors.push(`Duplicate branding categoryId "${category.categoryId}"`);
    } else {
      seenCategoryIds.add(category.categoryId);
    }
  }

  const seenSurfaceIds = new Set<string>();
  const seenLocalIds = new Set<string>();
  const seenDeepLinks = new Set<string>();
  const seenRoutes = new Set<string>();

  for (const surface of CANONICAL_WHITE_LABEL_SURFACES) {
    if (seenSurfaceIds.has(surface.surfaceId)) {
      errors.push(`Duplicate surfaceId "${surface.surfaceId}"`);
    } else {
      seenSurfaceIds.add(surface.surfaceId);
    }

    const localKey = `${surface.moduleId}/${surface.localId}`;
    if (seenLocalIds.has(localKey)) {
      errors.push(`Duplicate localId "${surface.localId}" on module "${surface.moduleId}"`);
    } else {
      seenLocalIds.add(localKey);
    }

    if (!VALID_FEATURE_IDS.has(surface.requiredFeature)) {
      errors.push(`Surface "${surface.surfaceId}" has invalid requiredFeature "${surface.requiredFeature}"`);
    }

    if (!surface.providerKey || !PROVIDER_KEY_PATTERN.test(surface.providerKey)) {
      errors.push(`Surface "${surface.surfaceId}" has invalid providerKey "${surface.providerKey}"`);
    }

    if (!CANONICAL_BRANDING_CATEGORY_ID_SET.has(surface.categoryId)) {
      errors.push(`Surface "${surface.surfaceId}" references invalid categoryId "${surface.categoryId}"`);
    }

    for (const slotId of surface.assetSlots) {
      if (!CANONICAL_BRAND_ASSET_SLOT_ID_SET.has(slotId)) {
        errors.push(`Surface "${surface.surfaceId}" references unknown assetSlotId "${slotId}"`);
      }
    }

    for (const groupId of surface.tokenGroups) {
      if (!CANONICAL_THEME_TOKEN_GROUP_IDS.includes(groupId)) {
        errors.push(`Surface "${surface.surfaceId}" references unknown tokenGroupId "${groupId}"`);
      }
    }

    if (surface.layoutProfileId && !CANONICAL_LAYOUT_PROFILE_ID_SET.has(surface.layoutProfileId)) {
      errors.push(`Surface "${surface.surfaceId}" references unknown layoutProfileId "${surface.layoutProfileId}"`);
    }

    for (const localizationId of surface.localizationOptionIds) {
      if (!CANONICAL_LOCALIZATION_OPTION_ID_SET.has(localizationId)) {
        errors.push(`Surface "${surface.surfaceId}" references unknown localizationId "${localizationId}"`);
      }
    }

    const routeBase = stripHash(surface.settingsPath);
    if (!SETTINGS_ROUTE_PATHS.has(routeBase)) {
      errors.push(`Surface "${surface.surfaceId}" settingsPath "${surface.settingsPath}" not in known route list`);
    }

    if (!surface.deepLinkTemplate.startsWith('/')) {
      errors.push(`Surface "${surface.surfaceId}" deepLinkTemplate must start with "/"`);
    } else if (seenDeepLinks.has(surface.deepLinkTemplate)) {
      errors.push(`Duplicate deepLinkTemplate "${surface.deepLinkTemplate}"`);
    } else {
      seenDeepLinks.add(surface.deepLinkTemplate);
    }

    if (seenRoutes.has(routeBase)) {
      // hash-only variants on same base path are allowed
    } else {
      seenRoutes.add(routeBase);
    }
  }

  if (!BRAND_ASSET_VERSION_METADATA_CONTRACT.requiresContentHash) {
    errors.push('Brand asset version metadata contract must require contentHash');
  }

  if (CANONICAL_BRAND_ASSET_SLOT_ID_SET.size !== CANONICAL_BRAND_ASSET_SLOTS.length) {
    errors.push('Canonical brand asset slot IDs contain duplicates');
  }

  if (CANONICAL_THEME_TOKEN_ID_SET.size !== CANONICAL_THEME_TOKENS.length) {
    errors.push('Canonical theme token IDs contain duplicates');
  }

  if (CANONICAL_WHITE_LABEL_SURFACE_ID_SET.size !== CANONICAL_WHITE_LABEL_SURFACES.length) {
    errors.push('Canonical white label surface IDs contain duplicates');
  }

  return errors;
}
