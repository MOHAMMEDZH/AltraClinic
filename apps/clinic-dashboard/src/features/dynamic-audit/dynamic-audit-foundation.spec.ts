import { describe, expect, it } from 'vitest';
import { BUILTIN_MODULE_MANIFESTS, validateBuiltinManifestCompleteness } from '@booking/module-registry';
import {
  validateBuiltinAuditIntegrity,
  validateCanonicalAuditVocabulary,
  CANONICAL_AUDIT_ENTRY_COUNT,
  buildAllAuditContributions,
} from '@booking/module-registry/audit';
import { STATIC_AUDIT_CATALOG, STATIC_AUDIT_CATALOG_IS_RUNTIME_AUTHORITY } from './lib/static-audit-catalog';

describe('dynamic audit foundation (Phase 39a)', () => {
  it('keeps static catalog non-authoritative', () => {
    expect(STATIC_AUDIT_CATALOG_IS_RUNTIME_AUTHORITY).toBe(false);
  });

  it('settings owns feeds and surfaces', () => {
    const settings = BUILTIN_MODULE_MANIFESTS.find((m) => m.moduleId === 'settings');
    expect(settings?.extensions.audit?.some((c) => c.auditKind === 'feed')).toBe(true);
    expect(settings?.extensions.audit?.some((c) => c.auditKind === 'surface')).toBe(true);
  });

  it('manifest completeness includes audit integrity', () => {
    expect(validateBuiltinManifestCompleteness(BUILTIN_MODULE_MANIFESTS)).toEqual([]);
  });

  it('audit integrity is clean', () => {
    expect(validateBuiltinAuditIntegrity(BUILTIN_MODULE_MANIFESTS)).toEqual([]);
  });

  it('vocabulary is clean', () => {
    expect(validateCanonicalAuditVocabulary()).toEqual([]);
  });

  it('contribution count matches static catalog', () => {
    expect(buildAllAuditContributions()).toHaveLength(CANONICAL_AUDIT_ENTRY_COUNT);
    expect(STATIC_AUDIT_CATALOG).toHaveLength(CANONICAL_AUDIT_ENTRY_COUNT);
  });

  it('manifest and catalog agree on extensionIds field-by-field for types', () => {
    const manifestTypes = BUILTIN_MODULE_MANIFESTS.flatMap((m) => m.extensions.audit ?? []).filter(
      (c) => c.auditKind === 'type',
    );
    const catalogTypes = STATIC_AUDIT_CATALOG.filter((e) => e.auditKind === 'type');
    expect(manifestTypes.length).toBe(catalogTypes.length);

    const catalogById = new Map(catalogTypes.map((e) => [e.extensionId, e]));
    for (const contribution of manifestTypes) {
      const catalog = catalogById.get(contribution.extensionId);
      expect(catalog).toBeDefined();
      expect(contribution.auditEventTypeId).toBe(catalog!.auditEventTypeId);
      expect(contribution.categoryId).toBe(catalog!.categoryId);
      expect(contribution.severity).toBe(catalog!.severity);
      expect(contribution.risk).toBe(catalog!.risk);
      expect(contribution.action).toBe(catalog!.action);
      expect(contribution.retentionPolicyId).toBe(catalog!.retentionPolicyId);
      expect(contribution.permissionResource).toBe(catalog!.permissionResource);
    }
  });
});
