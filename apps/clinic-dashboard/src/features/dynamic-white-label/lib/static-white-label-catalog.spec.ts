import { describe, expect, it } from 'vitest';
import {
  CANONICAL_BRAND_ASSET_SLOT_COUNT,
  CANONICAL_LAYOUT_PROFILE_COUNT,
  CANONICAL_LOCALIZATION_OPTION_COUNT,
  CANONICAL_THEME_TOKEN_COUNT,
  CANONICAL_WHITE_LABEL_SURFACE_COUNT,
  listAllBuiltinWhiteLabelContributions,
  validateCanonicalWhiteLabelVocabulary,
} from '@booking/module-registry/whitelabel';
import {
  STATIC_WHITE_LABEL_CATALOG,
  STATIC_WHITE_LABEL_CATALOG_IS_RUNTIME_AUTHORITY,
  isStaticWhiteLabelCatalogRuntimeAuthority,
} from './static-white-label-catalog';
import { assertWhiteLabelCatalogValid } from './white-label-validation';

describe('static white label catalog generation (Phase 35a)', () => {
  it('derives catalog entries from canonical registry vocabulary', () => {
    const contributions = listAllBuiltinWhiteLabelContributions();
    expect(STATIC_WHITE_LABEL_CATALOG).toHaveLength(contributions.length);
    expect(STATIC_WHITE_LABEL_CATALOG).toHaveLength(CANONICAL_WHITE_LABEL_SURFACE_COUNT);
    for (const contribution of contributions) {
      const catalog = STATIC_WHITE_LABEL_CATALOG.find((entry) => entry.extensionId === contribution.extensionId);
      expect(catalog, contribution.extensionId).toBeTruthy();
      expect(catalog?.surfaceId).toBe(contribution.surfaceId);
    }
  });

  it('lists expected canonical hierarchy counts', () => {
    expect(CANONICAL_BRAND_ASSET_SLOT_COUNT).toBe(9);
    expect(CANONICAL_THEME_TOKEN_COUNT).toBeGreaterThanOrEqual(20);
    expect(CANONICAL_LAYOUT_PROFILE_COUNT).toBe(4);
    expect(CANONICAL_LOCALIZATION_OPTION_COUNT).toBe(9);
    expect(CANONICAL_WHITE_LABEL_SURFACE_COUNT).toBe(10);
  });

  it('passes catalog integrity validation', () => {
    const errors = assertWhiteLabelCatalogValid(STATIC_WHITE_LABEL_CATALOG);
    expect(errors, errors.join('\n')).toEqual([]);
  });

  it('passes canonical vocabulary validation', () => {
    expect(validateCanonicalWhiteLabelVocabulary()).toEqual([]);
  });

  it('is not runtime authority', () => {
    expect(STATIC_WHITE_LABEL_CATALOG_IS_RUNTIME_AUTHORITY).toBe(false);
    expect(isStaticWhiteLabelCatalogRuntimeAuthority()).toBe(false);
  });
});
