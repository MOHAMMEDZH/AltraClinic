import { describe, expect, it } from 'vitest';
import { BUILTIN_MODULE_MANIFESTS, validateBuiltinManifestCompleteness } from '../index';
import {
  validateBuiltinAuditIntegrity,
  validateCanonicalAuditVocabulary,
  CANONICAL_AUDIT_CATEGORY_COUNT,
  CANONICAL_AUDIT_SEVERITY_COUNT,
  CANONICAL_AUDIT_RISK_COUNT,
  CANONICAL_AUDIT_ACTION_COUNT,
  CANONICAL_AUDIT_OUTCOME_COUNT,
  CANONICAL_AUDIT_POLICY_COUNT,
  CANONICAL_AUDIT_EVENT_TYPE_COUNT,
  CANONICAL_AUDIT_FEED_COUNT,
  CANONICAL_AUDIT_NAV_SURFACE_COUNT,
  CANONICAL_AUDIT_ENTRY_COUNT,
  STATIC_AUDIT_CATALOG_IS_RUNTIME_AUTHORITY,
  buildAllAuditContributions,
  buildAuditContributionsForModule,
  CANONICAL_AUDIT_POLICIES,
} from '../audit';

describe('audit parity (Phase 39a)', () => {
  it('declares static catalog is never runtime authority', () => {
    expect(STATIC_AUDIT_CATALOG_IS_RUNTIME_AUTHORITY).toBe(false);
  });

  it('canonical vocabulary counts are stable', () => {
    expect(CANONICAL_AUDIT_CATEGORY_COUNT).toBe(28);
    expect(CANONICAL_AUDIT_SEVERITY_COUNT).toBe(5);
    expect(CANONICAL_AUDIT_RISK_COUNT).toBe(5);
    expect(CANONICAL_AUDIT_ACTION_COUNT).toBe(32);
    expect(CANONICAL_AUDIT_OUTCOME_COUNT).toBe(7);
    expect(CANONICAL_AUDIT_POLICY_COUNT).toBe(16);
    expect(CANONICAL_AUDIT_EVENT_TYPE_COUNT).toBe(42);
    expect(CANONICAL_AUDIT_FEED_COUNT).toBe(14);
    expect(CANONICAL_AUDIT_NAV_SURFACE_COUNT).toBe(4);
    expect(CANONICAL_AUDIT_ENTRY_COUNT).toBe(60);
  });

  it('canonical policies are fail-closed with stable ownership', () => {
    expect(CANONICAL_AUDIT_POLICIES.every((p) => p.failClosed === true)).toBe(true);
    expect(CANONICAL_AUDIT_POLICIES.every((p) => p.providerKey === 'audit.builtin')).toBe(true);
  });

  it('canonical vocabulary passes integrity validation', () => {
    expect(validateCanonicalAuditVocabulary()).toEqual([]);
  });

  it('buildAllAuditContributions produces expected count', () => {
    expect(buildAllAuditContributions()).toHaveLength(CANONICAL_AUDIT_ENTRY_COUNT);
  });

  it('per-module builders avoid handwritten audit entries', () => {
    expect(buildAuditContributionsForModule('userManagement').every((c) => c.auditKind === 'type')).toBe(
      true,
    );
    expect(buildAuditContributionsForModule('settings').length).toBe(8 + 14 + 4);
    expect(buildAuditContributionsForModule('dashboard')).toHaveLength(0);
  });

  it('event types carry required identity and policy metadata', () => {
    const types = buildAllAuditContributions().filter((c) => c.auditKind === 'type');
    expect(types.length).toBe(42);
    for (const type of types) {
      expect(type.auditEventTypeId).toBeTruthy();
      expect(type.owningModuleId).toBeTruthy();
      expect(type.producerModuleId).toBeTruthy();
      expect(type.retentionPolicyId).toBeTruthy();
      expect(type.redactionPolicyId).toBeTruthy();
      expect(type.integrityPolicyId).toBeTruthy();
      expect(type.exportPolicyId).toBeTruthy();
      expect(type.permissionResource).toMatch(/^api\./);
      expect(type.tenantScoped).toBe(true);
      expect(type.eventVersion).toBe('1.0.0');
      expect(type.schemaVersion).toBe('1');
    }
  });

  it('feeds declare ownership and policy contracts', () => {
    const feeds = buildAuditContributionsForModule('settings').filter((c) => c.auditKind === 'feed');
    expect(feeds).toHaveLength(14);
    for (const feed of feeds) {
      expect(feed.ownerModuleId).toBe('settings');
      expect(feed.visibility).toBeTruthy();
      expect(feed.licensing).toBe('auditLogs');
      expect(feed.retentionPolicyId).toBeTruthy();
      expect(feed.redactionPolicyId).toBeTruthy();
      expect(feed.exportPolicyId).toBeTruthy();
      expect(feed.defaultFilters).toBeDefined();
    }
  });

  it('builtin manifests satisfy audit integrity', () => {
    const errors = validateBuiltinAuditIntegrity(BUILTIN_MODULE_MANIFESTS);
    expect(errors).toEqual([]);
  });

  it('builtin manifests satisfy global completeness', () => {
    expect(validateBuiltinManifestCompleteness(BUILTIN_MODULE_MANIFESTS)).toEqual([]);
  });
});
