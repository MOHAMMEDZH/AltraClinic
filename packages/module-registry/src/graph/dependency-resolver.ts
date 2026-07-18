import type {
  DependencyGraphResult,
  DependencyHealth,
  ModuleAccessMode,
  ModuleDependency,
  ModuleManifest,
} from '../types';
import { satisfiesRange } from '../semver';
import { PLATFORM_MODULE_ID } from '../types';

interface GraphNode {
  moduleId: string;
  version: string;
  dependencies: ModuleDependency[];
}

function buildNodes(manifests: ModuleManifest[]): Map<string, GraphNode> {
  const nodes = new Map<string, GraphNode>();
  nodes.set(PLATFORM_MODULE_ID, {
    moduleId: PLATFORM_MODULE_ID,
    version: '1.0.0',
    dependencies: [],
  });
  for (const m of manifests) {
    nodes.set(m.moduleId, {
      moduleId: m.moduleId,
      version: m.version,
      dependencies: m.dependencies ?? [],
    });
  }
  return nodes;
}

function detectCycles(nodes: Map<string, GraphNode>): string[][] {
  const cycles: string[][] = [];
  const visiting = new Set<string>();
  const visited = new Set<string>();
  const stack: string[] = [];

  const dfs = (nodeId: string): void => {
    if (visited.has(nodeId)) return;
    if (visiting.has(nodeId)) {
      const idx = stack.indexOf(nodeId);
      if (idx >= 0) cycles.push([...stack.slice(idx), nodeId]);
      return;
    }
    visiting.add(nodeId);
    stack.push(nodeId);
    const node = nodes.get(nodeId);
    if (node) {
      for (const dep of node.dependencies) {
        if (dep.type === 'required' || dep.type === 'optional') {
          if (nodes.has(dep.moduleId)) dfs(dep.moduleId);
        }
      }
    }
    stack.pop();
    visiting.delete(nodeId);
    visited.add(nodeId);
  };

  for (const nodeId of nodes.keys()) {
    if (nodeId !== PLATFORM_MODULE_ID) dfs(nodeId);
  }
  return cycles;
}

function topologicalSort(nodes: Map<string, GraphNode>): string[] {
  const inDegree = new Map<string, number>();
  const adj = new Map<string, string[]>();

  for (const id of nodes.keys()) {
    inDegree.set(id, 0);
    adj.set(id, []);
  }

  for (const [nodeId, node] of nodes) {
    if (nodeId === PLATFORM_MODULE_ID) continue;
    for (const dep of node.dependencies) {
      if (dep.type !== 'required') continue;
      if (!nodes.has(dep.moduleId)) continue;
      adj.get(dep.moduleId)!.push(nodeId);
      inDegree.set(nodeId, (inDegree.get(nodeId) ?? 0) + 1);
    }
    inDegree.set(nodeId, Math.max(inDegree.get(nodeId) ?? 0, 1));
  }

  const queue: string[] = [];
  for (const [id, deg] of inDegree) {
    if (id !== PLATFORM_MODULE_ID && deg === 0) queue.push(id);
  }

  const order: string[] = [];
  while (queue.length > 0) {
    const current = queue.shift()!;
    if (current !== PLATFORM_MODULE_ID) order.push(current);
    for (const next of adj.get(current) ?? []) {
      const deg = (inDegree.get(next) ?? 1) - 1;
      inDegree.set(next, deg);
      if (deg === 0) queue.push(next);
    }
  }

  const moduleIds = [...nodes.keys()].filter((id) => id !== PLATFORM_MODULE_ID);
  for (const id of moduleIds) {
    if (!order.includes(id)) order.push(id);
  }

  return order.sort((a, b) => {
    const na = nodes.get(a);
    const nb = nodes.get(b);
    return (na?.moduleId ?? a).localeCompare(nb?.moduleId ?? b);
  });
}

function computeHealthForModule(
  moduleId: string,
  nodes: Map<string, GraphNode>,
  activeModuleIds: Set<string>,
): DependencyHealth[] {
  const node = nodes.get(moduleId);
  if (!node) return [];
  const health: DependencyHealth[] = [];

  for (const dep of node.dependencies) {
    if (dep.type === 'conflicts') {
      if (activeModuleIds.has(dep.moduleId)) {
        health.push({
          moduleId: dep.moduleId,
          status: 'blocked',
          reasonKey: 'dependency.conflict',
        });
      }
      continue;
    }

    const depNode = nodes.get(dep.moduleId);
    if (!depNode) {
      if (dep.type === 'required') {
        health.push({
          moduleId: dep.moduleId,
          status: 'blocked',
          reasonKey: 'dependency.missing',
        });
      } else {
        health.push({
          moduleId: dep.moduleId,
          status: 'degraded',
          reasonKey: 'dependency.optional_missing',
        });
      }
      continue;
    }

    if (dep.semverRange && !satisfiesRange(depNode.version, dep.semverRange)) {
      health.push({
        moduleId: dep.moduleId,
        status: dep.type === 'required' ? 'blocked' : 'degraded',
        reasonKey: 'dependency.version_mismatch',
      });
      continue;
    }

    if (dep.type === 'required' && !activeModuleIds.has(dep.moduleId)) {
      health.push({
        moduleId: dep.moduleId,
        status: 'blocked',
        reasonKey: 'dependency.inactive',
      });
      continue;
    }

    health.push({ moduleId: dep.moduleId, status: 'healthy' });
  }

  return health;
}

export function resolveDependencyGraph(manifests: ModuleManifest[]): DependencyGraphResult {
  const nodes = buildNodes(manifests);
  const cycles = detectCycles(nodes);
  const blocked: Array<{ moduleId: string; reason: string }> = [];

  if (cycles.length > 0) {
    for (const cycle of cycles) {
      for (const moduleId of cycle) {
        if (moduleId !== PLATFORM_MODULE_ID) {
          blocked.push({ moduleId, reason: 'circular_dependency' });
        }
      }
    }
  }

  const order = cycles.length > 0 ? [] : topologicalSort(nodes);
  const activeModuleIds = new Set(order);
  const healthByModule: Record<string, DependencyHealth[]> = {};

  for (const manifest of manifests) {
    healthByModule[manifest.moduleId] = computeHealthForModule(
      manifest.moduleId,
      nodes,
      activeModuleIds,
    );
    const hasBlocked = healthByModule[manifest.moduleId].some((h) => h.status === 'blocked');
    if (hasBlocked) {
      blocked.push({ moduleId: manifest.moduleId, reason: 'dependency_blocked' });
    }
  }

  return { order, cycles, blocked, healthByModule };
}

function isDependencyLicensed(
  depModuleId: string,
  licenseModules: Record<string, ModuleAccessMode>,
  manifestById: Map<string, ModuleManifest>,
): boolean {
  const manifest = manifestById.get(depModuleId);
  const licensedId = manifest?.licensing.licensedModuleId ?? depModuleId;
  const access = licenseModules[licensedId] ?? 'disabled';
  return access === 'enabled' || access === 'read_only' || access === 'preview';
}

/** Intersects catalog dependency health with tenant licensing (§7.2). */
export function applyLicenseToDependencyHealth(
  catalogHealth: Record<string, DependencyHealth[]>,
  manifests: ModuleManifest[],
  licenseModules: Record<string, ModuleAccessMode>,
): Record<string, DependencyHealth[]> {
  const manifestById = new Map(manifests.map((m) => [m.moduleId, m]));
  const result: Record<string, DependencyHealth[]> = {};

  for (const manifest of manifests) {
    const deps = catalogHealth[manifest.moduleId] ?? [];
    const depTypeById = new Map((manifest.dependencies ?? []).map((dep) => [dep.moduleId, dep.type]));

    result[manifest.moduleId] = deps.map((entry) => {
      if (entry.status === 'blocked') return entry;
      const depType = depTypeById.get(entry.moduleId) ?? 'optional';
      if (isDependencyLicensed(entry.moduleId, licenseModules, manifestById)) {
        return entry;
      }
      return {
        moduleId: entry.moduleId,
        status: depType === 'required' ? 'blocked' : 'degraded',
        reasonKey: depType === 'required' ? 'dependency.unlicensed' : 'dependency.optional_unlicensed',
      };
    });
  }

  return result;
}
