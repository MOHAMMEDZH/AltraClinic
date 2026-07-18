import { describe, expect, it } from 'vitest';
import { BUILTIN_MODULE_MANIFESTS } from '@booking/module-registry';
import { validateJourneyLayerParity } from '@booking/module-registry/journey';
import { STATIC_JOURNEY_CATALOG } from './lib/static-journey-catalog';

describe('journey cross-package parity (Phase 40a)', () => {
  it('enforces vocabulary → manifest → static catalog parity', () => {
    expect(validateJourneyLayerParity(BUILTIN_MODULE_MANIFESTS, [...STATIC_JOURNEY_CATALOG])).toEqual([]);
  });
});
