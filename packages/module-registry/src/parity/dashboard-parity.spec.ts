import { describe, expect, it } from 'vitest';
import { BUILTIN_MODULE_MANIFESTS, validateBuiltinManifestCompleteness } from '../index';
import {
  CANONICAL_DASHBOARD_WIDGET_IDS,
  CANONICAL_DASHBOARD_WIDGETS,
  listCanonicalComponentKeys,
  validateBuiltinDashboardIntegrity,
} from '../dashboard';

describe('dashboard widget parity', () => {
  it('defines exactly 20 canonical widget IDs', () => {
    expect(CANONICAL_DASHBOARD_WIDGET_IDS).toHaveLength(20);
    expect(new Set(CANONICAL_DASHBOARD_WIDGET_IDS).size).toBe(20);
  });

  it('maps each canonical widget to a unique componentKey', () => {
    const keys = Object.values(listCanonicalComponentKeys());
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('declares every canonical widget exactly once in builtin manifests', () => {
    const errors = validateBuiltinDashboardIntegrity(BUILTIN_MODULE_MANIFESTS);
    expect(errors, errors.join('\n')).toEqual([]);
  });

  it('includes dashboard integrity in builtin completeness checks', () => {
    expect(validateBuiltinManifestCompleteness(BUILTIN_MODULE_MANIFESTS)).toEqual([]);
  });

  it('assigns each canonical widget to a licensed module owner', () => {
    for (const widget of CANONICAL_DASHBOARD_WIDGETS) {
      expect(widget.moduleId).toBeTruthy();
      expect(widget.componentKey.startsWith('widget.')).toBe(true);
    }
  });

  it('requires resourceId for non-core dashboard widgets', () => {
    const coreIds = new Set(['kpi-overview', 'quick-actions']);
    for (const widget of CANONICAL_DASHBOARD_WIDGETS) {
      if (coreIds.has(widget.id)) {
        expect(widget.resourceId).toBeUndefined();
      } else {
        expect(widget.resourceId, widget.id).toBeTruthy();
      }
    }
  });
});
