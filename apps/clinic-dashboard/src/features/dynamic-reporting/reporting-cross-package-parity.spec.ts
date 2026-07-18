import { describe, expect, it } from 'vitest';
import { BUILTIN_MODULE_MANIFESTS } from '@booking/module-registry';
import { validateReportingLayerParity } from '@booking/module-registry/reporting';
import { STATIC_REPORT_CATALOG } from './lib/static-report-catalog';

describe('reporting cross-package parity (Phase 33a)', () => {
  it('keeps canonical vocabulary, manifest contributions, and static catalog synchronized', () => {
    expect(validateReportingLayerParity(BUILTIN_MODULE_MANIFESTS, STATIC_REPORT_CATALOG)).toEqual([]);
  });
});
