import { describe, expect, it } from 'vitest';
import { CLINIC_NAV_ITEMS } from '@booking/permissions';
import { BUILTIN_MODULE_MANIFESTS } from '../builtin/builtin-manifests';
import {
  verifyRegistryRoutingParity,
  verifyStaticNavParity,
} from './nav-parity';

describe('static navigation parity', () => {
  it('matches CLINIC_NAV_ITEMS sidebar metadata in registry manifests', () => {
    const mismatches = verifyStaticNavParity(CLINIC_NAV_ITEMS, BUILTIN_MODULE_MANIFESTS);
    expect(mismatches, JSON.stringify(mismatches, null, 2)).toEqual([]);
  });

  it('matches primary routing paths for sidebar modules', () => {
    const mismatches = verifyRegistryRoutingParity(CLINIC_NAV_ITEMS, BUILTIN_MODULE_MANIFESTS);
    expect(mismatches, JSON.stringify(mismatches, null, 2)).toEqual([]);
  });
});
