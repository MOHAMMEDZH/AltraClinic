import type {
  EffectiveExtension,
  EffectiveModuleResolveInput,
  EffectiveModuleView,
  ExtensionKind,
  ModuleAccessMode,
  ModuleManifest,
  TenantRuntimeStatus,
} from '../types';

const EXTENSION_KINDS: ExtensionKind[] = [
  'navigation',
  'routing',
  'dashboard',
  'search',
  'reporting',
  'analytics',
  'workflow',
  'notifications',
  'ai',
  'whiteLabel',
  'branch',
  'activity',
  'audit',
  'journey',
  'notification',
];

function isLicenseBlocked(
  access: ModuleAccessMode,
  canWrite: boolean,
  licenseStatus?: string,
): boolean {
  if (access === 'hidden' || access === 'disabled') return true;
  if (access === 'read_only' && !canWrite) return true;
  if (licenseStatus === 'expired' || licenseStatus === 'cancelled' || licenseStatus === 'suspended') {
    return true;
  }
  return false;
}

function resolveRuntimeStatus(
  manifest: ModuleManifest,
  blocked: boolean,
  tenantDisabled: boolean,
): TenantRuntimeStatus {
  if (tenantDisabled) return 'disabled';
  if (blocked) return 'failed';
  return 'healthy';
}

function flattenExtensions(
  manifest: ModuleManifest,
  moduleVisible: boolean,
  moduleAccessible: boolean,
  evaluator: EffectiveModuleResolveInput['permissionEvaluator'],
): EffectiveExtension[] {
  const result: EffectiveExtension[] = [];
  for (const kind of EXTENSION_KINDS) {
    const list = manifest.extensions?.[kind] ?? [];
    for (const ext of list) {
      if (ext.hidden) continue;
      const extensionPermittedOk = extensionPermitted(ext.resourceId, evaluator);
      const extensionVisible = moduleVisible && extensionPermittedOk;
      const extensionAccessible = moduleAccessible && extensionPermittedOk;
      result.push({
        extensionId: ext.extensionId,
        kind,
        moduleId: manifest.moduleId,
        labelKey: ext.labelKey,
        sortOrder: ext.sortOrder,
        userVisible: extensionVisible,
        payload: {
          ...ext,
          userAccessible: extensionAccessible,
        } as Record<string, unknown>,
      });
    }
  }
  return result.sort((a, b) => a.sortOrder - b.sortOrder);
}

function extensionPermitted(
  resourceId: string | undefined,
  evaluator: EffectiveModuleResolveInput['permissionEvaluator'],
): boolean {
  if (!resourceId) return true;
  if (!evaluator) return true;
  return evaluator.hasPermission(resourceId, 'view');
}

export function resolveEffectiveModuleViews(input: EffectiveModuleResolveInput): EffectiveModuleView[] {
  const manifestById = new Map(input.manifests.map((m) => [m.moduleId, m]));
  const views: EffectiveModuleView[] = [];

  for (const moduleId of input.dependencyOrder) {
    const manifest = manifestById.get(moduleId);
    if (!manifest) continue;

    const licensedId = manifest.licensing.licensedModuleId ?? manifest.moduleId;
    const access: ModuleAccessMode = input.licenseModules[licensedId] ?? 'disabled';
    const flagValue = input.moduleFlags[licensedId] ?? input.moduleFlags[manifest.moduleId];
    const tenantOverride: EffectiveModuleView['tenantOverride'] =
      flagValue === false ? 'disabled' : flagValue === true ? 'enabled' : 'inherit';

    const deps = input.dependencyHealthByModule[moduleId] ?? [];
    const depBlocked = deps.some((d) => d.status === 'blocked');
    const tenantDisabled = tenantOverride === 'disabled';
    const licenseBlocked = isLicenseBlocked(access, input.canWrite, input.licenseStatus);

    const hasUnrestrictedNav = (manifest.extensions.navigation ?? []).some((nav) => !nav.resourceId);
    const navigationResources = (manifest.extensions.navigation ?? [])
      .map((nav) => nav.resourceId)
      .filter((resourceId): resourceId is string => Boolean(resourceId));
    const moduleResources = manifest.permissions.resources.map((resource) => resource.resourceId);
    const permissionCandidates = [...new Set([...moduleResources, ...navigationResources])];
    const permissionOk =
      hasUnrestrictedNav ||
      permissionCandidates.some((resourceId) =>
        extensionPermitted(resourceId, input.permissionEvaluator),
      );

    let lockReason: EffectiveModuleView['lockReason'] | undefined;
    if (depBlocked) lockReason = 'dependency';
    else if (tenantDisabled) lockReason = 'flag';
    else if (!permissionOk) lockReason = 'permission';
    else if (licenseBlocked) lockReason = 'plan';
    else if (input.licenseStatus === 'grace') lockReason = 'lifecycle';

    const userAccessible = !depBlocked && !tenantDisabled && !licenseBlocked && permissionOk && access !== 'hidden';
    const showWhenLocked = manifest.presentation.visibility.showWhenLocked === true;
    const userVisible =
      userAccessible ||
      (showWhenLocked && (licenseBlocked || tenantDisabled));

    const runtimeStatus = resolveRuntimeStatus(manifest, depBlocked, tenantDisabled);

    views.push({
      moduleId: manifest.moduleId,
      manifestId: manifest.manifestId,
      access,
      tenantOverride,
      runtimeStatus,
      userVisible,
      userAccessible,
      lockReason: userAccessible ? undefined : lockReason,
      dependencies: deps,
      extensions: flattenExtensions(manifest, userVisible, userAccessible, input.permissionEvaluator),
    });
  }

  return views.sort((a, b) => {
    const ma = manifestById.get(a.moduleId)?.metadata.sortOrder ?? 0;
    const mb = manifestById.get(b.moduleId)?.metadata.sortOrder ?? 0;
    return ma - mb;
  });
}

export function findEffectiveModuleView(
  views: EffectiveModuleView[],
  moduleId: string,
): EffectiveModuleView | undefined {
  return views.find((v) => v.moduleId === moduleId);
}
