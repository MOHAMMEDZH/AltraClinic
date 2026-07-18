import { describe, expect, it } from 'vitest';
import { BUILTIN_MODULE_MANIFESTS, validateBuiltinManifestCompleteness } from '../index';
import {
  CANONICAL_BRAND_ASSET_SLOT_COUNT,
  CANONICAL_WHITE_LABEL_SURFACE_COUNT,
  buildWhiteLabelContributionsForModule,
  validateBuiltinWhiteLabelIntegrity,
  validateCanonicalWhiteLabelVocabulary,
} from '../whitelabel';

describe('white label parity (Phase 35a)', () => {
  it('validates canonical vocabulary with zero errors', () => {
    expect(validateCanonicalWhiteLabelVocabulary()).toEqual([]);
  });

  it('validates builtin white label integrity with zero errors', () => {
    const errors = validateBuiltinWhiteLabelIntegrity(BUILTIN_MODULE_MANIFESTS);
    expect(errors, errors.join('\n')).toEqual([]);
  });

  it('includes white label integrity in bootstrap manifest completeness', () => {
    expect(validateBuiltinManifestCompleteness(BUILTIN_MODULE_MANIFESTS)).toEqual([]);
  });

  it('declares exactly 10 white label surfaces on settings module', () => {
    expect(buildWhiteLabelContributionsForModule('settings')).toHaveLength(CANONICAL_WHITE_LABEL_SURFACE_COUNT);
    expect(CANONICAL_WHITE_LABEL_SURFACE_COUNT).toBe(10);
  });

  it('declares 9 canonical brand asset slots', () => {
    expect(CANONICAL_BRAND_ASSET_SLOT_COUNT).toBe(9);
  });

  it('uses generated extensionIds settings/whiteLabel/{localId}', () => {
    const contributions = buildWhiteLabelContributionsForModule('settings');
    for (const contribution of contributions) {
      expect(contribution.extensionId).toMatch(/^settings\/whiteLabel\/[a-z0-9-]+$/);
      expect(contribution.schemaVersion).toBe(1);
      expect(contribution.providerKey).toBe('whitelabel.builtin');
    }
  });
});
