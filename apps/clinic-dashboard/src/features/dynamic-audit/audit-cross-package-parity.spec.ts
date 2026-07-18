import { describe, expect, it } from 'vitest';
import { BUILTIN_MODULE_MANIFESTS } from '@booking/module-registry';
import { validateAuditLayerParity } from '@booking/module-registry/audit';
import { STATIC_AUDIT_CATALOG } from './lib/static-audit-catalog';

describe('audit cross-package parity (Phase 39a)', () => {
  it('enforces vocabulary → manifest → static catalog parity', () => {
    expect(validateAuditLayerParity(BUILTIN_MODULE_MANIFESTS, [...STATIC_AUDIT_CATALOG])).toEqual([]);
  });
});
