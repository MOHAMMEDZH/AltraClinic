import { describe, expect, it } from 'vitest';
import { BUILTIN_MODULE_MANIFESTS, validateBuiltinManifestCompleteness } from '@booking/module-registry';
import {
  buildWhiteLabelContributionsForModule,
  validateBuiltinWhiteLabelIntegrity,
  validateCanonicalWhiteLabelVocabulary,
} from '@booking/module-registry/whitelabel';
import { verifyWhiteLabelCatalogParity } from './lib/white-label-validation';
import { STATIC_WHITE_LABEL_CATALOG } from './lib/static-white-label-catalog';
import { listAllBuiltinWhiteLabelContributions } from '@booking/module-registry/whitelabel';

describe('dynamic white label foundation (Phase 35a)', () => {
  it('generates 10 settings module white label contributions', () => {
    const settings = buildWhiteLabelContributionsForModule('settings');
    expect(settings).toHaveLength(10);
  });

  it('passes bootstrap manifest completeness including white label integrity', () => {
    expect(validateBuiltinManifestCompleteness(BUILTIN_MODULE_MANIFESTS)).toEqual([]);
  });

  it('passes dedicated white label integrity validation', () => {
    expect(validateBuiltinWhiteLabelIntegrity(BUILTIN_MODULE_MANIFESTS)).toEqual([]);
  });

  it('matches manifest contributions to static catalog field-by-field', () => {
    const mismatches = verifyWhiteLabelCatalogParity(
      listAllBuiltinWhiteLabelContributions(),
      [...STATIC_WHITE_LABEL_CATALOG],
    );
    expect(mismatches, mismatches.join('\n')).toEqual([]);
  });

  it('has fail-closed canonical vocabulary with zero errors', () => {
    expect(validateCanonicalWhiteLabelVocabulary()).toEqual([]);
  });
});
