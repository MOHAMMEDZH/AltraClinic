import { describe, expect, it, afterEach } from 'vitest';
import {
  BUILTIN_MODULE_MANIFESTS,
  resolveDependencyGraph,
  resolveEffectiveModuleViews,
} from '@booking/module-registry';
import { hasPermission } from '@booking/permissions';
import {
  buildReportingCacheKey,
  clearReportingCache,
  readReportingCache,
  readReportingCacheForIdentity,
  writeReportingCache,
} from './lib/reporting-cache';
import {
  extractReportingContributions,
  isCatalogReportEntryIncluded,
  isHubReportId,
  resolveReportingCapabilities,
} from './lib/reporting-resolver';
import {
  buildRegistryReportingSnapshot,
  buildRestrictedReportSnapshot,
  buildStaticReportingSnapshot,
  getSnapshotTemplateByReportId,
} from './lib/reporting-snapshot-builder';
import { snapshotTemplateToReportTemplate } from './lib/report-template-adapter';
import { STATIC_REPORT_CATALOG } from './lib/static-report-catalog';
import {
  assertReportingCatalogValid,
  assertReportingSnapshotValid,
} from './lib/reporting-validation';

const ALL_ENABLED = Object.fromEntries(
  BUILTIN_MODULE_MANIFESTS.map((m) => [m.moduleId, 'enabled' as const]),
);

const IDENTITY = { tenantId: 'tenant-1', userId: 'user-1', rolesHash: 'owner' };

function buildViews(roles: string[]) {
  const graph = resolveDependencyGraph(BUILTIN_MODULE_MANIFESTS);
  return resolveEffectiveModuleViews({
    manifests: BUILTIN_MODULE_MANIFESTS,
    licenseModules: ALL_ENABLED,
    moduleFlags: {},
    canWrite: true,
    canMutate: true,
    licenseStatus: 'active',
    permissionEvaluator: {
      hasPermission: (resourceId, action = 'view') => hasPermission(roles, resourceId, action),
    },
    dependencyOrder: graph.order,
    dependencyHealthByModule: graph.healthByModule,
  });
}

const ROLE_PROFILES = ['owner', 'general_manager', 'receptionist', 'accountant'] as const;

describe('reporting catalog', () => {
  it('validates catalog integrity', () => {
    expect(assertReportingCatalogValid(), assertReportingCatalogValid().join('\n')).toEqual([]);
  });

  it('identifies hub report ids', () => {
    expect(isHubReportId('catalog')).toBe(true);
    expect(isHubReportId('executive-dashboard')).toBe(false);
  });
});

describe('reporting resolver', () => {
  it('extracts reporting contributions from effective views only', () => {
    const views = buildViews(['owner']);
    const contributions = extractReportingContributions(views);
    expect(contributions.length).toBeGreaterThan(0);
    expect(contributions.every((entry) => entry.extensionId.includes('/reporting/'))).toBe(true);
  });

  it('gates catalog entries by extension-level accessibility', () => {
    const views = buildViews(['receptionist']);
    const contributions = extractReportingContributions(views);
    const billingSummary = STATIC_REPORT_CATALOG.find((entry) => entry.reportId === 'billing-summary')!;
    expect(isCatalogReportEntryIncluded(billingSummary, views, contributions)).toBe(false);
    const schedulingAnalytics = STATIC_REPORT_CATALOG.find((entry) => entry.reportId === 'scheduling-analytics')!;
    expect(isCatalogReportEntryIncluded(schedulingAnalytics, views, contributions)).toBe(true);
  });

  it('derives capabilities from accessible snapshot entries', () => {
    const snapshot = buildStaticReportingSnapshot(['owner'], STATIC_REPORT_CATALOG, IDENTITY);
    const capabilities = resolveReportingCapabilities(snapshot);
    expect(capabilities.canViewReporting).toBe(true);
    expect(capabilities.canCreateReports).toBe(true);
    expect(capabilities.canExportReports).toBe(true);
  });
});

describe('reporting snapshot builder', () => {
  it('builds registry snapshot with templates and hubs separated', () => {
    const views = buildViews(['owner']);
    const snapshot = buildRegistryReportingSnapshot(
      ['owner'],
      STATIC_REPORT_CATALOG,
      views,
      1,
      'active',
      IDENTITY,
    );
    expect(assertReportingSnapshotValid(snapshot), assertReportingSnapshotValid(snapshot).join('\n')).toEqual([]);
    expect(snapshot.templates.length).toBeGreaterThan(30);
    expect(snapshot.hubEntries.length).toBe(3);
    expect(snapshot.canViewReporting).toBe(true);
  });

  it('builds static snapshot from catalog permissions', () => {
    const snapshot = buildStaticReportingSnapshot(['owner'], STATIC_REPORT_CATALOG, IDENTITY);
    expect(snapshot.source).toBe('static-only');
    expect(snapshot.templates.length).toBeGreaterThan(20);
    expect(snapshot.categories.length).toBeGreaterThan(0);
  });

  it('builds restricted snapshot fail-closed', () => {
    const snapshot = buildRestrictedReportSnapshot(IDENTITY, 1, 'active');
    expect(snapshot.templates).toEqual([]);
    expect(snapshot.hubEntries).toEqual([]);
    expect(snapshot.canViewReporting).toBe(false);
    expect(snapshot.canCreateReports).toBe(false);
    expect(snapshot.canExportReports).toBe(false);
  });

  it.each(['owner', 'general_manager'] as const)(
    'registry templates are subset of static RBAC for %s',
    (role) => {
      const roles = [role];
      const views = buildViews(roles);
      const staticIds = new Set(
        buildStaticReportingSnapshot(roles, STATIC_REPORT_CATALOG, IDENTITY, 'static-fallback').templates.map(
          (template) => template.reportId,
        ),
      );
      const registryIds = buildRegistryReportingSnapshot(
        roles,
        STATIC_REPORT_CATALOG,
        views,
        1,
        'active',
        IDENTITY,
      ).templates.map((template) => template.reportId);
      for (const reportId of registryIds) {
        expect(staticIds.has(reportId), reportId).toBe(true);
      }
    },
  );

  it('maps snapshot templates to legacy report template shape', () => {
    const snapshot = buildStaticReportingSnapshot(['owner'], STATIC_REPORT_CATALOG, IDENTITY);
    const template = getSnapshotTemplateByReportId(snapshot, 'executive-dashboard');
    expect(template).toBeDefined();
    const legacy = snapshotTemplateToReportTemplate(template!);
    expect(legacy.id).toBe('executive-dashboard');
    expect(legacy.permission.resource).toMatch(/^api\./);
  });
});

describe('reporting cache', () => {
  afterEach(() => {
    clearReportingCache();
  });

  it('stores and reads identity-scoped cache entries', () => {
    const snapshot = buildStaticReportingSnapshot(['owner'], STATIC_REPORT_CATALOG, IDENTITY);
    const key = buildReportingCacheKey({
      tenantId: 'tenant-1',
      userId: 'user-1',
      rolesHash: 'owner',
      catalogGeneration: 1,
      entitlementVersion: 'active',
      moduleCount: 43,
      source: 'registry',
    });
    writeReportingCache(key, { ...snapshot, source: 'registry' });
    expect(readReportingCache(key)?.templates.length).toBe(snapshot.templates.length);
  });

  it('reads cache by partial identity during loading', () => {
    const snapshot = buildRestrictedReportSnapshot(IDENTITY, 1, 'active');
    const key = buildReportingCacheKey({
      tenantId: 'tenant-1',
      userId: 'user-1',
      rolesHash: 'owner',
      catalogGeneration: 1,
      entitlementVersion: 'active',
      moduleCount: 43,
      source: 'registry',
    });
    writeReportingCache(key, snapshot);
    expect(
      readReportingCacheForIdentity({
        tenantId: 'tenant-1',
        userId: 'user-1',
        rolesHash: 'owner',
        catalogGeneration: 1,
        entitlementVersion: 'active',
      }),
    ).toEqual(snapshot);
  });

  it('clears cache on clearReportingCache', () => {
    const snapshot = buildStaticReportingSnapshot(['owner'], STATIC_REPORT_CATALOG, IDENTITY);
    const key = buildReportingCacheKey({
      tenantId: 'tenant-1',
      userId: 'user-1',
      rolesHash: 'owner',
      catalogGeneration: null,
      entitlementVersion: null,
      moduleCount: 0,
      source: 'static-only',
    });
    writeReportingCache(key, snapshot);
    clearReportingCache();
    expect(readReportingCache(key)).toBeNull();
  });
});

describe('reporting role profiles', () => {
  it.each(ROLE_PROFILES)('builds non-empty static snapshot for %s when permitted', (role) => {
    const snapshot = buildStaticReportingSnapshot([role], STATIC_REPORT_CATALOG, IDENTITY);
    expect(assertReportingSnapshotValid(snapshot), assertReportingSnapshotValid(snapshot).join('\n')).toEqual([]);
  });
});
