import type {

  ModuleHealthReport,

  ModuleManifest,

  RegistrySnapshot,

  TenantRuntimeStatus,

} from '../types';

import { satisfiesMinVersion } from '../semver';

import { createRegistryEvent } from '../events/registry-events';

import { resolveDependencyGraph } from '../graph/dependency-resolver';

import { validateManifestCatalog } from '../validation/manifest-validator';

import { validateBuiltinManifestCompleteness } from '../builtin/builtin-manifests';

import { PLATFORM_VERSION } from '../types';



export interface RegistryBootstrapResult {

  snapshot: RegistrySnapshot | null;

  validationErrors: string[];

  events: ReturnType<typeof createRegistryEvent>[];

}



let catalogGeneration = 0;



function collectBootstrapValidationErrors(manifests: ModuleManifest[]): string[] {
  const errors: string[] = [];
  if (manifests.length === 0) {
    errors.push('catalog: at least one manifest is required');
    return errors;
  }

  const validation = validateManifestCatalog(manifests);

  if (!validation.valid) {

    errors.push(...validation.issues.map((i) => `${i.path}: ${i.message}`));

  }



  errors.push(...validateBuiltinManifestCompleteness(manifests));



  const manifestIds = new Set(manifests.map((m) => m.moduleId));

  for (const manifest of manifests) {

    if (!satisfiesMinVersion(PLATFORM_VERSION, manifest.minPlatformVersion)) {

      errors.push(

        `${manifest.moduleId}.minPlatformVersion: platform ${PLATFORM_VERSION} does not satisfy ${manifest.minPlatformVersion}`,

      );

    }

    for (let i = 0; i < (manifest.dependencies ?? []).length; i += 1) {

      const dep = manifest.dependencies[i];

      if (

        (dep.type === 'required' || dep.type === 'optional') &&

        !manifestIds.has(dep.moduleId) &&

        dep.moduleId !== 'platform'

      ) {

        errors.push(`${manifest.moduleId}.dependencies[${i}]: broken dependency ${dep.moduleId}`);

      }

    }

  }



  const graph = resolveDependencyGraph(manifests);

  if (graph.cycles.length > 0) {

    for (const cycle of graph.cycles) {

      errors.push(`dependency.cycle: ${cycle.join(' -> ')}`);

    }

  } else if (graph.order.length !== manifests.length) {

    errors.push('dependency.order: incomplete topological ordering for catalog');

  }



  if (graph.blocked.some((entry) => entry.reason === 'dependency_blocked')) {

    for (const entry of graph.blocked.filter((b) => b.reason === 'dependency_blocked')) {

      errors.push(`${entry.moduleId}: blocked dependency graph (${entry.reason})`);

    }

  }



  return errors;

}



export function bootstrapRegistry(manifests: ModuleManifest[]): RegistryBootstrapResult {

  const validationErrors = collectBootstrapValidationErrors(manifests);



  if (validationErrors.length > 0) {

    return {

      snapshot: null,

      validationErrors,

      events: [

        createRegistryEvent('module.failed', 'platform', {

          toState: 'failed',

          payload: { reason: 'bootstrap_validation_failed', errors: validationErrors },

        }),

      ],

    };

  }



  const graph = resolveDependencyGraph(manifests);

  catalogGeneration += 1;



  const events = manifests.map((m) =>

    createRegistryEvent('module.validated', m.moduleId, {

      manifestId: m.manifestId,

      toState: 'validated',

      payload: { catalogGeneration },

    }),

  );



  events.push(

    createRegistryEvent('module.initialized', 'platform', {

      toState: 'initialized',

      payload: { moduleCount: manifests.length },

    }),

  );



  const snapshot: RegistrySnapshot = {

    schemaVersion: '1.0',

    platformVersion: PLATFORM_VERSION,

    generatedAt: new Date().toISOString(),

    catalogGeneration,

    manifests,

    dependencyOrder: graph.order,

    moduleCount: manifests.length,

  };



  return {

    snapshot,

    validationErrors: [],

    events,

  };

}



export function evaluateModuleHealth(

  manifest: ModuleManifest,

  runtimeStatus: TenantRuntimeStatus,

  probeResults: Record<string, 'pass' | 'fail' | 'skip'>,

): ModuleHealthReport {

  const probes = (manifest.healthChecks ?? []).map((check) => ({

    probeId: check.probeId,

    status: probeResults[check.probeId] ?? ('skip' as const),

    message: probeResults[check.probeId] === 'fail' ? `Probe failed: ${check.target}` : undefined,

  }));



  return {

    moduleId: manifest.moduleId,

    manifestId: manifest.manifestId,

    runtimeStatus,

    probes,

  };

}



export function loadManifests(manifests: ModuleManifest[]): ModuleManifest[] {

  return [...manifests].sort((a, b) => a.metadata.sortOrder - b.metadata.sortOrder);

}


