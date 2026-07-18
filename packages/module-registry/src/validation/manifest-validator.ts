import type {
  ManifestValidationIssue,
  ManifestValidationResult,
  ModuleManifest,
  ModuleExtensions,
  ExtensionKind,
} from '../types';
import { ALL_LICENSED_MODULE_IDS } from '../types';

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
  'journey',
  'notification',
];

const MODULE_ID_PATTERN = /^[a-z][a-zA-Z0-9]*(\.[a-z][a-zA-Z0-9]*)*$/;

function pushIssue(
  issues: ManifestValidationIssue[],
  path: string,
  code: string,
  message: string,
): void {
  issues.push({ path, code, message });
}

function validateExtensions(
  extensions: ModuleExtensions,
  moduleId: string,
  issues: ManifestValidationIssue[],
  seenExtensionIds: Set<string>,
): void {
  for (const kind of EXTENSION_KINDS) {
    const list = extensions[kind];
    if (!list) continue;
    for (let i = 0; i < list.length; i += 1) {
      const ext = list[i];
      const basePath = `extensions.${kind}[${i}]`;
      if (!ext.extensionId) {
        pushIssue(issues, `${basePath}.extensionId`, 'required', 'extensionId is required');
      } else {
        if (seenExtensionIds.has(ext.extensionId)) {
          pushIssue(issues, `${basePath}.extensionId`, 'duplicate', `Duplicate extensionId: ${ext.extensionId}`);
        }
        seenExtensionIds.add(ext.extensionId);
        if (!ext.extensionId.startsWith(`${moduleId}/`)) {
          pushIssue(
            issues,
            `${basePath}.extensionId`,
            'invalid',
            `extensionId must be prefixed with moduleId (${moduleId}/)`,
          );
        }
      }
      if (!ext.labelKey) {
        pushIssue(issues, `${basePath}.labelKey`, 'required', 'labelKey is required');
      }
      if (kind === 'routing') {
        const route = ext as { path?: string; componentKey?: string };
        if (!route.path) pushIssue(issues, `${basePath}.path`, 'required', 'routing path is required');
        if (!route.componentKey) {
          pushIssue(issues, `${basePath}.componentKey`, 'required', 'routing componentKey is required');
        }
      }
      if (kind === 'navigation') {
        const nav = ext as { path?: string; placement?: string };
        if (!nav.path) pushIssue(issues, `${basePath}.path`, 'required', 'navigation path is required');
        if (!nav.placement) {
          pushIssue(issues, `${basePath}.placement`, 'required', 'navigation placement is required');
        }
      }
    }
  }
}

export function validateManifest(manifest: ModuleManifest): ManifestValidationResult {
  const issues: ManifestValidationIssue[] = [];
  const seenExtensionIds = new Set<string>();

  if (manifest.moduleManifestSchemaVersion !== '1.0') {
    pushIssue(issues, 'moduleManifestSchemaVersion', 'invalid', 'Must be "1.0"');
  }
  if (!manifest.moduleId || !MODULE_ID_PATTERN.test(manifest.moduleId)) {
    pushIssue(issues, 'moduleId', 'invalid', 'moduleId must be a valid identifier');
  }
  if (!manifest.manifestId || !manifest.manifestId.startsWith(`${manifest.moduleId}@`)) {
    pushIssue(issues, 'manifestId', 'invalid', 'manifestId must be {moduleId}@{version}');
  }
  if (!manifest.version) {
    pushIssue(issues, 'version', 'required', 'version is required');
  }
  if (!manifest.minPlatformVersion) {
    pushIssue(issues, 'minPlatformVersion', 'required', 'minPlatformVersion is required');
  }
  if (!manifest.identity?.displayNameKey) {
    pushIssue(issues, 'identity.displayNameKey', 'required', 'displayNameKey is required');
  }
  if (!manifest.identity?.category) {
    pushIssue(issues, 'identity.category', 'required', 'category is required');
  }
  if (manifest.metadata?.sortOrder === undefined || manifest.metadata.sortOrder < 0) {
    pushIssue(issues, 'metadata.sortOrder', 'invalid', 'sortOrder must be >= 0');
  }
  if (!manifest.licensing) {
    pushIssue(issues, 'licensing', 'required', 'licensing reference is required');
  } else if (
    ALL_LICENSED_MODULE_IDS.includes(manifest.moduleId as (typeof ALL_LICENSED_MODULE_IDS)[number]) &&
    !manifest.licensing.licensedModuleId
  ) {
    pushIssue(
      issues,
      'licensing.licensedModuleId',
      'required',
      'built-in modules must declare licensedModuleId',
    );
  }
  if (!manifest.permissions?.resources?.length) {
    pushIssue(issues, 'permissions.resources', 'required', 'at least one permission resource is required');
  }
  if (!manifest.presentation?.icons?.default) {
    pushIssue(issues, 'presentation.icons.default', 'required', 'default icon is required');
  }

  for (let i = 0; i < (manifest.dependencies ?? []).length; i += 1) {
    const dep = manifest.dependencies[i];
    if (dep.moduleId === manifest.moduleId) {
      pushIssue(issues, `dependencies[${i}]`, 'invalid', 'module cannot depend on itself');
    }
    if (!dep.moduleId) {
      pushIssue(issues, `dependencies[${i}].moduleId`, 'required', 'dependency moduleId is required');
    }
  }

  validateExtensions(manifest.extensions ?? {}, manifest.moduleId, issues, seenExtensionIds);

  return { valid: issues.length === 0, issues };
}

export function validateManifestCatalog(manifests: ModuleManifest[]): ManifestValidationResult {
  const issues: ManifestValidationIssue[] = [];
  const seenModuleIds = new Set<string>();
  const globalExtensionIds = new Set<string>();

  for (const manifest of manifests) {
    const result = validateManifest(manifest);
    issues.push(...result.issues);

    if (seenModuleIds.has(manifest.moduleId)) {
      pushIssue(issues, 'moduleId', 'duplicate', `Duplicate moduleId: ${manifest.moduleId}`);
    }
    seenModuleIds.add(manifest.moduleId);

    for (const kind of EXTENSION_KINDS) {
      const list = manifest.extensions?.[kind] ?? [];
      for (const ext of list) {
        if (globalExtensionIds.has(ext.extensionId)) {
          pushIssue(issues, 'extensions', 'duplicate', `Duplicate extensionId across catalog: ${ext.extensionId}`);
        }
        globalExtensionIds.add(ext.extensionId);
      }
    }
  }

  return { valid: issues.length === 0, issues };
}
