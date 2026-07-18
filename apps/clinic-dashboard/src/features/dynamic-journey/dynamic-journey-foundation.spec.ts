import { describe, expect, it } from 'vitest';
import { BUILTIN_MODULE_MANIFESTS, validateBuiltinManifestCompleteness } from '@booking/module-registry';
import {
  validateBuiltinJourneyIntegrity,
  validateCanonicalJourneyVocabulary,
  CANONICAL_JOURNEY_ENTRY_COUNT,
  CANONICAL_JOURNEY_STAGE_COUNT,
  buildAllJourneyContributions,
} from '@booking/module-registry/journey';
import { STATIC_JOURNEY_CATALOG, STATIC_JOURNEY_CATALOG_IS_RUNTIME_AUTHORITY } from './lib/static-journey-catalog';

describe('dynamic journey foundation (Phase 40a)', () => {
  it('keeps static catalog non-authoritative', () => {
    expect(STATIC_JOURNEY_CATALOG_IS_RUNTIME_AUTHORITY).toBe(false);
  });

  it('asserts canonical stage count is exactly 21', () => {
    expect(CANONICAL_JOURNEY_STAGE_COUNT).toBe(21);
  });

  it('patients owns acquisition and episode-closure stages', () => {
    const patients = BUILTIN_MODULE_MANIFESTS.find((m) => m.moduleId === 'patients');
    expect(patients?.extensions.journey?.some((c) => c.journeyKind === 'stage' && c.stageId === 'lead')).toBe(true);
    expect(patients?.extensions.journey?.some((c) => c.journeyKind === 'stage' && c.stageId === 'discharge')).toBe(
      true,
    );
  });

  it('settings owns pathway-settings surface', () => {
    const settings = BUILTIN_MODULE_MANIFESTS.find((m) => m.moduleId === 'settings');
    expect(
      settings?.extensions.journey?.some((c) => c.journeyKind === 'surface' && c.surfaceId === 'pathway-settings'),
    ).toBe(true);
  });

  it('manifest completeness includes journey integrity', () => {
    expect(validateBuiltinManifestCompleteness(BUILTIN_MODULE_MANIFESTS)).toEqual([]);
  });

  it('journey integrity is clean', () => {
    expect(validateBuiltinJourneyIntegrity(BUILTIN_MODULE_MANIFESTS)).toEqual([]);
  });

  it('vocabulary is clean', () => {
    expect(validateCanonicalJourneyVocabulary()).toEqual([]);
  });

  it('contribution count matches static catalog', () => {
    expect(buildAllJourneyContributions()).toHaveLength(CANONICAL_JOURNEY_ENTRY_COUNT);
    expect(STATIC_JOURNEY_CATALOG).toHaveLength(CANONICAL_JOURNEY_ENTRY_COUNT);
  });

  it('manifest and catalog agree on extensionIds field-by-field for stages', () => {
    const manifestStages = BUILTIN_MODULE_MANIFESTS.flatMap((m) => m.extensions.journey ?? []).filter(
      (c) => c.journeyKind === 'stage',
    );
    const catalogStages = STATIC_JOURNEY_CATALOG.filter((e) => e.journeyKind === 'stage');
    expect(manifestStages.length).toBe(catalogStages.length);

    const catalogById = new Map(catalogStages.map((e) => [e.extensionId, e]));
    for (const contribution of manifestStages) {
      const catalog = catalogById.get(contribution.extensionId);
      expect(catalog).toBeDefined();
      expect(contribution.stageId).toBe(catalog!.stageId);
      expect(contribution.categoryId).toBe(catalog!.categoryId);
      expect(contribution.terminal).toBe(catalog!.terminal);
      expect(contribution.permissionResource).toBe(catalog!.permissionResource);
    }
  });

  it('manifest and catalog agree on extensionIds field-by-field for transitions', () => {
    const manifestTransitions = BUILTIN_MODULE_MANIFESTS.flatMap((m) => m.extensions.journey ?? []).filter(
      (c) => c.journeyKind === 'transition',
    );
    const catalogTransitions = STATIC_JOURNEY_CATALOG.filter((e) => e.journeyKind === 'transition');
    expect(manifestTransitions.length).toBe(catalogTransitions.length);

    const catalogById = new Map(catalogTransitions.map((e) => [e.extensionId, e]));
    for (const contribution of manifestTransitions) {
      const catalog = catalogById.get(contribution.extensionId);
      expect(catalog).toBeDefined();
      expect(contribution.fromStageId).toBe(catalog!.fromStageId);
      expect(contribution.toStageId).toBe(catalog!.toStageId);
    }
  });
});
