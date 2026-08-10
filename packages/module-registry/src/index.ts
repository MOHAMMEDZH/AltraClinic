import { BUILTIN_MODULE_MANIFESTS } from './builtin/builtin-manifests';
import { resolveDependencyGraph } from './graph/dependency-resolver';
import {
  bootstrapRegistry,
  loadManifests,
} from './loader/registry-bootstrap';
import {
  resolveEffectiveModuleViews,
} from './resolver/effective-module-resolver';

export * from './types';
export { BUILTIN_MODULE_MANIFESTS, getBuiltinManifest, validateBuiltinManifestCompleteness } from './builtin/builtin-manifests';
export {
  bootstrapRegistry,
  evaluateModuleHealth,
  loadManifests,
} from './loader/registry-bootstrap';
export { resolveDependencyGraph, applyLicenseToDependencyHealth } from './graph/dependency-resolver';
export {
  resolveEffectiveModuleViews,
  findEffectiveModuleView,
} from './resolver/effective-module-resolver';
export {
  validateManifest,
  validateManifestCatalog,
} from './validation/manifest-validator';
export { createRegistryEvent, REGISTRY_EVENT_CATALOG } from './events/registry-events';
export { satisfiesMinVersion, satisfiesRange, compareSemver, parseSemver } from './semver';

/** Enterprise module registry — catalog bootstrap from built-in manifests. */
export function createBuiltinRegistrySnapshot() {
  return bootstrapRegistry(loadManifests(BUILTIN_MODULE_MANIFESTS));
}

export {
  BUILTIN_MODULE_MANIFESTS as builtinManifests,
  resolveDependencyGraph as buildDependencyGraph,
  resolveEffectiveModuleViews as buildEffectiveModuleViews,
};
export * from './dashboard';
export * from './search';
export * from './reporting';
export * from './analytics';
