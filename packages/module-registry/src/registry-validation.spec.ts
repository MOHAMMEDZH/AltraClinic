import { describe, expect, it } from 'vitest';
import {
  BUILTIN_MODULE_MANIFESTS,
  bootstrapRegistry,
  createRegistryEvent,
  evaluateModuleHealth,
  getBuiltinManifest,
  resolveDependencyGraph,
  applyLicenseToDependencyHealth,
  satisfiesRange,
  validateManifest,
  validateManifestCatalog,
  type ModuleManifest,
} from './index';

function cloneManifest(manifest: ModuleManifest): ModuleManifest {
  return JSON.parse(JSON.stringify(manifest)) as ModuleManifest;
}

describe('manifest validation', () => {
  it('rejects invalid module id', () => {
    const manifest = cloneManifest(BUILTIN_MODULE_MANIFESTS[0]);
    manifest.moduleId = 'Invalid-ID';
    const result = validateManifest(manifest);
    expect(result.valid).toBe(false);
    expect(result.issues.some((i) => i.path === 'moduleId')).toBe(true);
  });

  it('rejects missing required fields', () => {
    const manifest = cloneManifest(BUILTIN_MODULE_MANIFESTS[0]);
    manifest.version = '';
    const result = validateManifest(manifest);
    expect(result.valid).toBe(false);
    expect(result.issues.some((i) => i.path === 'version')).toBe(true);
  });

  it('rejects duplicate extension ids within manifest', () => {
    const manifest = cloneManifest(getBuiltinManifest('dashboard')!);
    const nav = manifest.extensions.navigation?.[0];
    if (!nav) throw new Error('dashboard nav missing');
    manifest.extensions.navigation = [nav, { ...nav }];
    const result = validateManifest(manifest);
    expect(result.valid).toBe(false);
    expect(result.issues.some((i) => i.code === 'duplicate')).toBe(true);
  });

  it('rejects self-referencing dependency', () => {
    const manifest = cloneManifest(getBuiltinManifest('patients')!);
    manifest.dependencies = [{ moduleId: 'patients', type: 'required' }];
    const result = validateManifest(manifest);
    expect(result.valid).toBe(false);
    expect(result.issues.some((i) => i.message.includes('itself'))).toBe(true);
  });
});

describe('dependency graph', () => {
  it('detects circular dependencies', () => {
    const a = cloneManifest(getBuiltinManifest('patients')!);
    const b = cloneManifest(getBuiltinManifest('scheduling')!);
    a.dependencies = [{ moduleId: 'scheduling', type: 'required' }];
    b.dependencies = [{ moduleId: 'patients', type: 'required' }];
    const graph = resolveDependencyGraph([a, b]);
    expect(graph.cycles.length).toBeGreaterThan(0);
    expect(graph.order).toEqual([]);
  });

  it('marks optional unlicensed dependency as degraded', () => {
    const graph = resolveDependencyGraph(BUILTIN_MODULE_MANIFESTS);
    const health = applyLicenseToDependencyHealth(graph.healthByModule, BUILTIN_MODULE_MANIFESTS, {
      emr: 'enabled',
      dental: 'enabled',
      reporting: 'hidden',
      analytics: 'enabled',
    });
    expect(health.analytics?.some((h) => h.reasonKey === 'dependency.optional_unlicensed')).toBe(true);
  });

  it('rejects bootstrap when catalog has broken dependency reference', () => {
    const manifest = cloneManifest(getBuiltinManifest('dashboard')!);
    manifest.dependencies = [{ moduleId: 'missing.module', type: 'required' }];
    const result = bootstrapRegistry([...BUILTIN_MODULE_MANIFESTS.filter((m) => m.moduleId !== 'dashboard'), manifest]);
    expect(result.snapshot).toBeNull();
    expect(result.validationErrors.some((e) => e.includes('broken dependency'))).toBe(true);
  });

  it('flags version mismatch on required dependency', () => {
    const dependent = cloneManifest(getBuiltinManifest('emr')!);
    dependent.dependencies = [
      { moduleId: 'patients', type: 'required', semverRange: '>=99.0.0' },
    ];
    const graph = resolveDependencyGraph([...BUILTIN_MODULE_MANIFESTS.filter((m) => m.moduleId !== 'emr'), dependent]);
    const health = graph.healthByModule.emr ?? [];
    expect(health.some((h) => h.reasonKey === 'dependency.version_mismatch')).toBe(true);
  });

  it('marks optional missing dependency as degraded', () => {
    const manifest = cloneManifest(getBuiltinManifest('dashboard')!);
    manifest.dependencies = [{ moduleId: 'nonexistent.module', type: 'optional' }];
    const graph = resolveDependencyGraph([manifest]);
    const health = graph.healthByModule.dashboard ?? [];
    expect(health.some((h) => h.reasonKey === 'dependency.optional_missing')).toBe(true);
  });

  it('validates semver ranges', () => {
    expect(satisfiesRange('1.0.0', '>=1.0.0')).toBe(true);
    expect(satisfiesRange('0.9.0', '>=1.0.0')).toBe(false);
  });
});

describe('module health', () => {
  it('evaluates probe results', () => {
    const manifest = getBuiltinManifest('dashboard')!;
    const probeId = manifest.healthChecks?.[0]?.probeId;
    if (!probeId) throw new Error('dashboard health probe missing');
    const report = evaluateModuleHealth(manifest, 'healthy', {
      [probeId]: 'pass',
    });
    expect(report.moduleId).toBe('dashboard');
    expect(report.runtimeStatus).toBe('healthy');
    expect(report.probes.some((p) => p.status === 'pass')).toBe(true);
  });

  it('reports failed probes', () => {
    const manifest = getBuiltinManifest('patients')!;
    const probeId = manifest.healthChecks?.[0]?.probeId;
    if (!probeId) throw new Error('patients health probe missing');
    const report = evaluateModuleHealth(manifest, 'degraded', { [probeId]: 'fail' });
    expect(report.probes.find((p) => p.probeId === probeId)?.status).toBe('fail');
  });
});

describe('registry lifecycle events', () => {
  it('emits bootstrap events', () => {
    const result = bootstrapRegistry(BUILTIN_MODULE_MANIFESTS.slice(0, 2));
    expect(result.events.some((e) => e.eventType === 'module.initialized')).toBe(true);
    expect(result.events.filter((e) => e.eventType === 'module.validated').length).toBe(2);
    expect(result.snapshot).not.toBeNull();
  });

  it('emits failure event when bootstrap is invalid', () => {
    const result = bootstrapRegistry([]);
    expect(result.snapshot).toBeNull();
    expect(result.events.some((e) => e.eventType === 'module.failed')).toBe(true);
  });

  it('creates typed registry events', () => {
    const event = createRegistryEvent('module.registered', 'dashboard', {
      toState: 'registered',
    });
    expect(event.moduleId).toBe('dashboard');
    expect(event.eventType).toBe('module.registered');
    expect(event.occurredAt).toBeTruthy();
  });
});

describe('catalog validation', () => {
  it('rejects duplicate module ids in catalog', () => {
    const dup = [...BUILTIN_MODULE_MANIFESTS, BUILTIN_MODULE_MANIFESTS[0]];
    const result = validateManifestCatalog(dup);
    expect(result.valid).toBe(false);
    expect(result.issues.some((i) => i.code === 'duplicate')).toBe(true);
  });
});
