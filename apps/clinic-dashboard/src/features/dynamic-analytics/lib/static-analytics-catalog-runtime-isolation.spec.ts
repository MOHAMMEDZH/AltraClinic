import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  STATIC_ANALYTICS_CATALOG_ALLOWED_IMPORT_SUFFIXES,
  STATIC_ANALYTICS_CATALOG_IS_RUNTIME_AUTHORITY,
  isStaticAnalyticsCatalogRuntimeAuthority,
} from '@booking/module-registry/analytics';
import { STATIC_ANALYTICS_CATALOG } from './static-analytics-catalog';

const featureRoot = fileURLToPath(new URL('..', import.meta.url));
const srcRoot = fileURLToPath(new URL('../../..', import.meta.url));

const PHASE_34B_ALLOWED_FEATURE_FILES = new Set([
  'lib/static-analytics-catalog.ts',
  'lib/static-analytics-catalog.spec.ts',
  'lib/static-analytics-catalog-runtime-isolation.spec.ts',
  'analytics-cross-package-parity.spec.ts',
  'context/DynamicAnalyticsProvider.tsx',
  'lib/analytics-validation.ts',
  'dynamic-analytics.spec.ts',
  'dynamic-analytics-provider.spec.ts',
  'dynamic-analytics-rollback.spec.ts',
]);

function collectSourceFiles(dir: string, acc: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === 'dist') continue;
      collectSourceFiles(fullPath, acc);
      continue;
    }
    if (/\.(ts|tsx)$/.test(entry.name) && !entry.name.endsWith('.d.ts')) {
      acc.push(fullPath);
    }
  }
  return acc;
}

function isAllowedStaticCatalogImporter(relativePath: string): boolean {
  const normalized = relativePath.replace(/\\/g, '/');
  return STATIC_ANALYTICS_CATALOG_ALLOWED_IMPORT_SUFFIXES.some((suffix) => normalized.endsWith(suffix));
}

describe('static analytics catalog runtime isolation (Phase 34a M3 / 34b provider)', () => {
  it('declares STATIC_ANALYTICS_CATALOG is not runtime authority', () => {
    expect(STATIC_ANALYTICS_CATALOG_IS_RUNTIME_AUTHORITY).toBe(false);
    expect(isStaticAnalyticsCatalogRuntimeAuthority()).toBe(false);
  });

  it('is imported only by parity tests, catalog module, and 34b provider pipeline', () => {
    const offenders: string[] = [];
    const importPattern = /static-analytics-catalog|STATIC_ANALYTICS_CATALOG/;

    for (const filePath of collectSourceFiles(srcRoot)) {
      const rel = relative(srcRoot, filePath).replace(/\\/g, '/');
      if (!importPattern.test(readFileSync(filePath, 'utf8'))) continue;
      if (!isAllowedStaticCatalogImporter(rel)) {
        offenders.push(rel);
      }
    }

    expect(offenders).toEqual([]);
  });

  it('remains confined to provider pipeline within the dynamic-analytics feature folder', () => {
    const featureFiles = collectSourceFiles(featureRoot).map((filePath) =>
      relative(featureRoot, filePath).replace(/\\/g, '/'),
    );
    const runtimeConsumers = featureFiles.filter(
      (file) =>
        file.includes('STATIC_ANALYTICS_CATALOG') ||
        (file.endsWith('.ts') && readFileSync(join(featureRoot, file), 'utf8').includes('STATIC_ANALYTICS_CATALOG')),
    );

    for (const file of runtimeConsumers) {
      expect(PHASE_34B_ALLOWED_FEATURE_FILES.has(file), file).toBe(true);
    }
  });

  it('exposes catalog data for provider join without being runtime authority', () => {
    expect(STATIC_ANALYTICS_CATALOG.length).toBe(25);
  });
});
