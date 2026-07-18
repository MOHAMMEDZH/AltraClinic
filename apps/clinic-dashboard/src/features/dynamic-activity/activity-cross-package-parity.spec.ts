import { describe, expect, it } from 'vitest';
import { BUILTIN_MODULE_MANIFESTS } from '@booking/module-registry';
import { validateActivityLayerParity } from '@booking/module-registry/activity';
import { STATIC_ACTIVITY_CATALOG } from './lib/static-activity-catalog';

describe('activity cross-package parity (Phase 38a)', () => {
  it('passes end-to-end vocabulary → manifest → static catalog parity', () => {
    const errors = validateActivityLayerParity(BUILTIN_MODULE_MANIFESTS, [...STATIC_ACTIVITY_CATALOG]);
    expect(errors, errors.join('\n')).toEqual([]);
  });
});
