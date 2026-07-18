/**
 * Phase 42b — Import/Export registration contracts.
 * Metadata only. No executable methods.
 */

import type { PermissionAction } from '../../../common/authorization/permission-matrix.validation';

/** Hub extension kind (local runtime; Module Registry package unchanged). */
export const IMPORT_EXPORT_LOCAL_EXTENSION_KIND = 'importExport' as const;

export type ImportExportDirection = 'import' | 'export';

export type ImportExportRegistrationKind =
  | 'importer'
  | 'exporter'
  | 'templateProvider'
  | 'validatorProvider'
  | 'artifactProvider';

/**
 * Catalog lifecycle status.
 * Static baseline entries use `disabled` / `inactive` intentionally (no adapters).
 */
export type ImportExportRegistrationStatus =
  | 'disabled'
  | 'inactive'
  | 'active'
  | 'deprecated';

export type ImportExportSupportedFormat = 'csv' | 'xlsx' | 'json' | 'pdf' | 'xml';

/** Licensing gates consumed from TenantPolicyService (no commercial SKU map). */
export type ImportExportRequiredLicense =
  | 'allowDataImport'
  | 'allowDataExport';

export type ImportExportTenantScope = 'tenant' | 'platform' | 'any';
export type ImportExportBranchScope = 'branch' | 'tenant' | 'any' | 'none';

export interface ImportExportRequiredPermission {
  resource: string;
  action: PermissionAction;
}

/**
 * Strongly typed registration metadata.
 * Intentionally has no execute / validate / import / export methods.
 */
export interface ImportExportRegistrationMetadata {
  typeId: string;
  displayName: string;
  category: string;
  direction: ImportExportDirection;
  ownerModule: string;
  requiredPermission: ImportExportRequiredPermission;
  requiredLicense: ImportExportRequiredLicense;
  tenantScope: ImportExportTenantScope;
  branchScope: ImportExportBranchScope;
  supportsDryRun: boolean;
  supportsPreview: boolean;
  supportedFormats: readonly ImportExportSupportedFormat[];
  version: string;
  /** Optional per-type feature flag env key. */
  featureFlag: string | null;
  status: ImportExportRegistrationStatus;
  registrationKind: ImportExportRegistrationKind;
  /**
   * True when a runtime ImportAdapter is attached (Phase 42d+).
   */
  adapterAttached: boolean;
  /**
   * True when the registration may execute via an attached adapter.
   */
  executable: boolean;
  /** Optional tenant allowlist; omit/empty = unrestricted within tenantScope. */
  restrictedToTenantIds?: readonly string[];
  /** Optional branch allowlist; omit/empty = unrestricted within branchScope. */
  restrictedToBranchIds?: readonly string[];
}

export type ImportExportRegistrationInput = Omit<
  ImportExportRegistrationMetadata,
  'adapterAttached' | 'executable'
> & {
  adapterAttached?: boolean;
  executable?: boolean;
};

export interface ImportExportRegistrationValidationIssue {
  code:
    | 'duplicate_type_id'
    | 'duplicate_version'
    | 'invalid_owner'
    | 'missing_permission'
    | 'missing_license'
    | 'invalid_direction'
    | 'unsupported_format'
    | 'invalid_status'
    | 'invalid_registration_kind'
    | 'invalid_type_id'
    | 'invalid_version'
    | 'empty_formats';
  message: string;
  field?: string;
}

export interface ImportExportRegistrationValidationResult {
  valid: boolean;
  issues: ImportExportRegistrationValidationIssue[];
}

export interface EffectiveImportExportType {
  typeId: string;
  displayName: string;
  category: string;
  direction: ImportExportDirection;
  ownerModule: string;
  version: string;
  status: ImportExportRegistrationStatus;
  registrationKind: ImportExportRegistrationKind;
  supportedFormats: readonly ImportExportSupportedFormat[];
  supportsDryRun: boolean;
  supportsPreview: boolean;
  requiredPermission: ImportExportRequiredPermission;
  requiredLicense: ImportExportRequiredLicense;
  tenantScope: ImportExportTenantScope;
  branchScope: ImportExportBranchScope;
  featureFlag: string | null;
  adapterAttached: boolean;
  executable: boolean;
  visible: true;
}

export const IMPORT_EXPORT_SUPPORTED_FORMATS: readonly ImportExportSupportedFormat[] = [
  'csv',
  'xlsx',
  'json',
  'pdf',
  'xml',
] as const;

export const IMPORT_EXPORT_REGISTRATION_KINDS: readonly ImportExportRegistrationKind[] = [
  'importer',
  'exporter',
  'templateProvider',
  'validatorProvider',
  'artifactProvider',
] as const;

/** Known owner modules for registration validation (hub does not own their logic). */
export const IMPORT_EXPORT_KNOWN_OWNER_MODULES: readonly string[] = [
  'users',
  'identity',
  'inventory',
  'billing',
  'patients',
  'reporting',
  'analytics',
  'settings',
  'notifications',
  'platform',
  'importExport',
] as const;
