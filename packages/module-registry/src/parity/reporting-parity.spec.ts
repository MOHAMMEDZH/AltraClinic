import { describe, expect, it } from 'vitest';
import { BUILTIN_MODULE_MANIFESTS, validateBuiltinManifestCompleteness } from '../index';
import {
  validateBuiltinReportIntegrity,
  validateCanonicalReportVocabulary,
  CANONICAL_REPORT_CATEGORY_COUNT,
  CANONICAL_REPORT_HUB_COUNT,
  CANONICAL_REPORT_TEMPLATE_COUNT,
  CANONICAL_REPORT_TEMPLATES,
} from '../reporting';

describe('reporting parity (Phase 33a)', () => {
  it('canonical template vocabulary is stable', () => {
    expect(CANONICAL_REPORT_CATEGORY_COUNT).toBe(21);
    expect(CANONICAL_REPORT_TEMPLATE_COUNT).toBe(40);
    expect(CANONICAL_REPORT_HUB_COUNT).toBe(3);
  });

  it('canonical reportIds are unique', () => {
    const ids = CANONICAL_REPORT_TEMPLATES.map((t) => t.reportId);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('canonical vocabulary passes integrity validation', () => {
    expect(validateCanonicalReportVocabulary()).toEqual([]);
  });

  it('builtin manifests satisfy reporting integrity', () => {
    const errors = validateBuiltinReportIntegrity(BUILTIN_MODULE_MANIFESTS);
    expect(errors).toEqual([]);
  });

  it('builtin manifests satisfy global completeness', () => {
    expect(validateBuiltinManifestCompleteness(BUILTIN_MODULE_MANIFESTS)).toEqual([]);
  });
});
