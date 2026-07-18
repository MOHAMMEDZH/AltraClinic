import type { ImportExportRegistrationMetadata } from '../domain/import-export-registration.contracts';
import { isImportExportCenterEnabled } from '../config/import-export-config';
import { rolesCanAccessResource } from '../../../common/authorization/permission-matrix.util';

export interface ImportExportVisibilityContext {
  tenantId?: string | null;
  branchId?: string | null;
  roles?: readonly string[];
  allowDataImport: boolean;
  allowDataExport: boolean;
  /** Hub-level feature flag (IMPORT_EXPORT_CENTER_ENABLED). */
  centerEnabled: boolean;
  /** Resolve optional per-type feature flags. */
  isFeatureEnabled?: (flag: string) => boolean;
}

export interface ImportExportVisibilityResult {
  visible: boolean;
  reasons: string[];
}

/**
 * Phase 42b — visibility filtering (discovery only).
 * No business / adapter execution.
 */
export function evaluateImportExportVisibility(
  entry: ImportExportRegistrationMetadata,
  ctx: ImportExportVisibilityContext,
): ImportExportVisibilityResult {
  const reasons: string[] = [];

  if (!ctx.centerEnabled) {
    reasons.push('center_feature_flag_disabled');
  }

  if (entry.status === 'disabled' || entry.status === 'inactive' || entry.status === 'deprecated') {
    reasons.push(`status_${entry.status}`);
  }

  if (entry.featureFlag) {
    const enabled = ctx.isFeatureEnabled
      ? ctx.isFeatureEnabled(entry.featureFlag)
      : isEnvFlagEnabled(entry.featureFlag);
    if (!enabled) reasons.push('type_feature_flag_disabled');
  }

  if (entry.requiredLicense === 'allowDataImport' && !ctx.allowDataImport) {
    reasons.push('license_allowDataImport_denied');
  }
  if (entry.requiredLicense === 'allowDataExport' && !ctx.allowDataExport) {
    reasons.push('license_allowDataExport_denied');
  }

  if (entry.tenantScope === 'tenant' && !ctx.tenantId) {
    reasons.push('tenant_required');
  }
  if (entry.tenantScope === 'platform' && ctx.tenantId) {
    reasons.push('platform_scope_tenant_context');
  }
  if (
    entry.restrictedToTenantIds &&
    entry.restrictedToTenantIds.length > 0 &&
    (!ctx.tenantId || !entry.restrictedToTenantIds.includes(ctx.tenantId))
  ) {
    reasons.push('tenant_not_allowed');
  }

  if (entry.branchScope === 'branch' && !ctx.branchId) {
    reasons.push('branch_required');
  }
  if (
    entry.restrictedToBranchIds &&
    entry.restrictedToBranchIds.length > 0 &&
    (!ctx.branchId || !entry.restrictedToBranchIds.includes(ctx.branchId))
  ) {
    reasons.push('branch_not_allowed');
  }

  const roles = [...(ctx.roles ?? [])];
  if (roles.length > 0) {
    const allowed = rolesCanAccessResource(
      roles,
      entry.requiredPermission.resource,
      entry.requiredPermission.action,
    );
    if (!allowed) reasons.push('rbac_denied');
  } else {
    reasons.push('rbac_roles_missing');
  }

  // Catalog entries never execute in 42b; visibility still requires active status.
  if (entry.adapterAttached) {
    // Defensive: 42b contracts force adapterAttached=false; never treat as executable.
    reasons.push('unexpected_adapter_attached');
  }

  return { visible: reasons.length === 0, reasons };
}

export function isEnvFlagEnabled(flag: string, env: NodeJS.ProcessEnv = process.env): boolean {
  if (flag === 'IMPORT_EXPORT_CENTER_ENABLED') {
    return isImportExportCenterEnabled(env);
  }
  const raw = (env[flag] ?? 'false').trim().toLowerCase();
  return raw === 'true' || raw === '1' || raw === 'yes';
}
