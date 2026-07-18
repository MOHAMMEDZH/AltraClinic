import { describe, expect, it } from 'vitest';
import {
  STATIC_AUDIT_CATALOG,
  STATIC_AUDIT_CATALOG_IS_RUNTIME_AUTHORITY,
  assertAuditCatalogValid,
} from './static-audit-catalog';

describe('STATIC_AUDIT_CATALOG (Phase 39a)', () => {
  it('is never runtime authority', () => {
    expect(STATIC_AUDIT_CATALOG_IS_RUNTIME_AUTHORITY).toBe(false);
  });

  it('contains 60 parity entries', () => {
    expect(STATIC_AUDIT_CATALOG).toHaveLength(60);
  });

  it('has unique extensionIds', () => {
    const ids = STATIC_AUDIT_CATALOG.map((e) => e.extensionId);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('passes local catalog validation', () => {
    expect(assertAuditCatalogValid()).toEqual([]);
  });
});
