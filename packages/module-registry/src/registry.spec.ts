import { describe, expect, it } from 'vitest';
import {
  BUILTIN_MODULE_MANIFESTS,
  bootstrapRegistry,
  createBuiltinRegistrySnapshot,
  resolveDependencyGraph,
  resolveEffectiveModuleViews,
  validateManifestCatalog,
  validateBuiltinManifestCompleteness,
  ALL_LICENSED_MODULE_IDS,
  getBuiltinManifest,
} from './index';

describe('builtin manifests', () => {
  it('covers all 21 licensed module ids', () => {
    const ids = BUILTIN_MODULE_MANIFESTS.map((m) => m.moduleId).sort();
    expect(ids).toEqual([...ALL_LICENSED_MODULE_IDS].sort());
  });

  it('validates entire built-in catalog', () => {
    const result = validateManifestCatalog(BUILTIN_MODULE_MANIFESTS);
    expect(result.valid, JSON.stringify(result.issues, null, 2)).toBe(true);
  });

  it('passes built-in manifest completeness checks', () => {
    expect(validateBuiltinManifestCompleteness(BUILTIN_MODULE_MANIFESTS)).toEqual([]);
  });
});

describe('registry bootstrap', () => {
  it('bootstraps built-in catalog without validation errors', () => {
    const { snapshot, validationErrors } = createBuiltinRegistrySnapshot();
    expect(validationErrors).toEqual([]);
    expect(snapshot?.moduleCount).toBe(21);
    expect(snapshot?.dependencyOrder.length).toBe(21);
  });

  it('rejects duplicate module ids', () => {
    const dup = [...BUILTIN_MODULE_MANIFESTS, BUILTIN_MODULE_MANIFESTS[0]];
    const result = bootstrapRegistry(dup);
    expect(result.validationErrors.length).toBeGreaterThan(0);
    expect(result.snapshot).toBeNull();
  });

  it('rejects cyclic dependencies at bootstrap', () => {
    const a = structuredClone(getBuiltinManifest('patients')!);
    const b = structuredClone(getBuiltinManifest('scheduling')!);
    a.dependencies = [{ moduleId: 'scheduling', type: 'required' }];
    b.dependencies = [{ moduleId: 'patients', type: 'required' }];
    const result = bootstrapRegistry([a, b]);
    expect(result.snapshot).toBeNull();
    expect(result.validationErrors.some((e) => e.startsWith('dependency.cycle'))).toBe(true);
  });
});

describe('dependency graph', () => {
  it('has no cycles in built-in catalog', () => {
    const graph = resolveDependencyGraph(BUILTIN_MODULE_MANIFESTS);
    expect(graph.cycles).toEqual([]);
    expect(graph.order.length).toBe(21);
  });
});

describe('effective module view', () => {
  it('narrows access when tenant flag disables module', () => {
    const graph = resolveDependencyGraph(BUILTIN_MODULE_MANIFESTS);
    const views = resolveEffectiveModuleViews({
      manifests: BUILTIN_MODULE_MANIFESTS,
      licenseModules: { patients: 'enabled' },
      moduleFlags: { patients: false },
      canWrite: true,
      canMutate: true,
      dependencyOrder: graph.order,
      dependencyHealthByModule: graph.healthByModule,
    });
    const patients = views.find((v) => v.moduleId === 'patients');
    expect(patients?.tenantOverride).toBe('disabled');
    expect(patients?.userAccessible).toBe(false);
    expect(patients?.lockReason).toBe('flag');
  });

  it('does not widen beyond license when flag enabled', () => {
    const graph = resolveDependencyGraph(BUILTIN_MODULE_MANIFESTS);
    const views = resolveEffectiveModuleViews({
      manifests: BUILTIN_MODULE_MANIFESTS,
      licenseModules: { analytics: 'hidden' },
      moduleFlags: { analytics: true },
      canWrite: true,
      canMutate: true,
      dependencyOrder: graph.order,
      dependencyHealthByModule: graph.healthByModule,
    });
    const analytics = views.find((v) => v.moduleId === 'analytics');
    expect(analytics?.access).toBe('hidden');
    expect(analytics?.userAccessible).toBe(false);
  });

  it('respects permission evaluator', () => {
    const graph = resolveDependencyGraph(BUILTIN_MODULE_MANIFESTS);
    const views = resolveEffectiveModuleViews({
      manifests: BUILTIN_MODULE_MANIFESTS,
      licenseModules: { patients: 'enabled' },
      moduleFlags: {},
      canWrite: true,
      canMutate: true,
      dependencyOrder: graph.order,
      dependencyHealthByModule: graph.healthByModule,
      permissionEvaluator: {
        hasPermission: (resourceId) => resourceId !== 'api.patients',
      },
    });
    const patients = views.find((v) => v.moduleId === 'patients');
    expect(patients?.userAccessible).toBe(false);
    expect(patients?.lockReason).toBe('permission');
  });

  it('evaluates per-extension permission for navigation contributions', () => {
    const graph = resolveDependencyGraph(BUILTIN_MODULE_MANIFESTS);
    const views = resolveEffectiveModuleViews({
      manifests: BUILTIN_MODULE_MANIFESTS,
      licenseModules: { settings: 'enabled' },
      moduleFlags: {},
      canWrite: true,
      canMutate: true,
      dependencyOrder: graph.order,
      dependencyHealthByModule: graph.healthByModule,
      permissionEvaluator: {
        hasPermission: (resourceId) =>
          resourceId === 'api.identity' || resourceId === 'api.settings',
      },
    });
    const settings = views.find((v) => v.moduleId === 'settings');
    const subscriptionNav = settings?.extensions.find(
      (ext) => ext.kind === 'navigation' && ext.payload.path === '/settings/subscription',
    );
    const settingsNav = settings?.extensions.find(
      (ext) => ext.kind === 'navigation' && ext.payload.path === '/settings',
    );
    expect(settingsNav?.userVisible).toBe(true);
    expect(subscriptionNav?.userVisible).toBe(false);
  });

  it('exposes subscription nav when user has api.subscription but not api.settings', () => {
    const graph = resolveDependencyGraph(BUILTIN_MODULE_MANIFESTS);
    const views = resolveEffectiveModuleViews({
      manifests: BUILTIN_MODULE_MANIFESTS,
      licenseModules: { settings: 'enabled' },
      moduleFlags: {},
      canWrite: true,
      canMutate: true,
      dependencyOrder: graph.order,
      dependencyHealthByModule: graph.healthByModule,
      permissionEvaluator: {
        hasPermission: (resourceId) => resourceId === 'api.subscription',
      },
    });
    const settings = views.find((v) => v.moduleId === 'settings');
    const subscriptionNav = settings?.extensions.find(
      (ext) => ext.kind === 'navigation' && ext.payload.path === '/settings/subscription',
    );
    const settingsNav = settings?.extensions.find(
      (ext) => ext.kind === 'navigation' && ext.payload.path === '/settings',
    );
    expect(subscriptionNav?.userVisible).toBe(true);
    expect(settingsNav?.userVisible).toBe(false);
    expect(settings?.userAccessible).toBe(true);
  });
});
