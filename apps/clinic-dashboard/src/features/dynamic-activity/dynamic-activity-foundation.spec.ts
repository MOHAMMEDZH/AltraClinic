import { describe, expect, it } from 'vitest';
import { BUILTIN_MODULE_MANIFESTS, validateBuiltinManifestCompleteness } from '@booking/module-registry';
import {
  buildActivityContributionsForModule,
  listAllBuiltinActivityContributions,
  validateBuiltinActivityIntegrity,
  validateCanonicalActivityVocabulary,
  CANONICAL_ACTIVITY_ENTRY_COUNT,
} from '@booking/module-registry/activity';
import { verifyActivityCatalogParity, assertActivityCatalogLoaded } from './lib/static-activity-validation';
import { STATIC_ACTIVITY_CATALOG } from './lib/static-activity-catalog';

describe('dynamic activity foundation (Phase 38a)', () => {
  it('generates expected notifications module contributions (feeds + hubs + types)', () => {
    const notifications = buildActivityContributionsForModule('notifications');
    expect(notifications.length).toBeGreaterThan(0);
    expect(notifications.some((c) => c.activityKind === 'feed')).toBe(true);
    expect(notifications.some((c) => c.activityKind === 'hub')).toBe(true);
  });

  it('passes bootstrap manifest completeness including activity integrity', () => {
    expect(validateBuiltinManifestCompleteness(BUILTIN_MODULE_MANIFESTS)).toEqual([]);
  });

  it('passes dedicated activity integrity validation', () => {
    expect(validateBuiltinActivityIntegrity(BUILTIN_MODULE_MANIFESTS)).toEqual([]);
  });

  it('matches manifest contributions to static catalog field-by-field', () => {
    const mismatches = verifyActivityCatalogParity(
      listAllBuiltinActivityContributions(),
      [...STATIC_ACTIVITY_CATALOG],
    );
    expect(mismatches, mismatches.join('\n')).toEqual([]);
  });

  it('has fail-closed canonical vocabulary with zero errors', () => {
    expect(validateCanonicalActivityVocabulary()).toEqual([]);
  });

  it('listAllBuiltinActivityContributions matches catalog length', () => {
    expect(listAllBuiltinActivityContributions()).toHaveLength(CANONICAL_ACTIVITY_ENTRY_COUNT);
    expect(STATIC_ACTIVITY_CATALOG).toHaveLength(CANONICAL_ACTIVITY_ENTRY_COUNT);
  });

  it('assertActivityCatalogLoaded does not throw', () => {
    expect(() => assertActivityCatalogLoaded()).not.toThrow();
  });
});
