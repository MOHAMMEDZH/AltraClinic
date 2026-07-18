import { describe, expect, it } from 'vitest';
import { BUILTIN_MODULE_MANIFESTS } from '@booking/module-registry';
import { validateWhiteLabelLayerParity } from '@booking/module-registry/whitelabel';
import { STATIC_WHITE_LABEL_CATALOG } from './lib/static-white-label-catalog';

describe('white label cross-package parity (Phase 35a)', () => {
  it('keeps canonical vocabulary, manifest contributions, and static catalog synchronized', () => {
    expect(validateWhiteLabelLayerParity(BUILTIN_MODULE_MANIFESTS, STATIC_WHITE_LABEL_CATALOG)).toEqual([]);
  });
});
