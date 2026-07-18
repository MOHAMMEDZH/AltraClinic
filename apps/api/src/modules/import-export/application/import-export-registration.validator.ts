import type { PermissionAction } from '../../../common/authorization/permission-matrix.validation';
import {
  IMPORT_EXPORT_KNOWN_OWNER_MODULES,
  IMPORT_EXPORT_REGISTRATION_KINDS,
  IMPORT_EXPORT_SUPPORTED_FORMATS,
  type ImportExportRegistrationInput,
  type ImportExportRegistrationMetadata,
  type ImportExportRegistrationValidationIssue,
  type ImportExportRegistrationValidationResult,
  type ImportExportSupportedFormat,
} from '../domain/import-export-registration.contracts';

const PERMISSION_ACTIONS: readonly PermissionAction[] = [
  'view',
  'create',
  'update',
  'delete',
  'approve',
  'export',
  'manage',
];

const TYPE_ID_PATTERN = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;
const VERSION_PATTERN = /^\d+\.\d+\.\d+(?:-[a-zA-Z0-9.]+)?$/;
const OWNER_PATTERN = /^[a-z][a-zA-Z0-9]*$/;

function push(
  issues: ImportExportRegistrationValidationIssue[],
  code: ImportExportRegistrationValidationIssue['code'],
  message: string,
  field?: string,
): void {
  issues.push({ code, message, field });
}

/**
 * Phase 42b — registration metadata validation only.
 * Rejects invalid registrations; does not execute anything.
 */
export function validateImportExportRegistration(
  input: ImportExportRegistrationInput,
  existing: readonly ImportExportRegistrationMetadata[],
): ImportExportRegistrationValidationResult {
  const issues: ImportExportRegistrationValidationIssue[] = [];

  if (!input.typeId || !TYPE_ID_PATTERN.test(input.typeId)) {
    push(issues, 'invalid_type_id', 'typeId must be kebab-case (e.g. users-import)', 'typeId');
  }

  if (!input.version || !VERSION_PATTERN.test(input.version)) {
    push(issues, 'invalid_version', 'version must be semver (e.g. 1.0.0)', 'version');
  }

  if (!input.ownerModule || !OWNER_PATTERN.test(input.ownerModule)) {
    push(issues, 'invalid_owner', 'ownerModule is required and must be camelCase/id', 'ownerModule');
  } else if (!IMPORT_EXPORT_KNOWN_OWNER_MODULES.includes(input.ownerModule)) {
    push(
      issues,
      'invalid_owner',
      `ownerModule "${input.ownerModule}" is not a known owning module`,
      'ownerModule',
    );
  }

  if (!input.requiredPermission?.resource?.trim()) {
    push(issues, 'missing_permission', 'requiredPermission.resource is required', 'requiredPermission.resource');
  }
  if (!input.requiredPermission?.action || !PERMISSION_ACTIONS.includes(input.requiredPermission.action)) {
    push(issues, 'missing_permission', 'requiredPermission.action must be a matrix action', 'requiredPermission.action');
  }

  if (
    input.requiredLicense !== 'allowDataImport' &&
    input.requiredLicense !== 'allowDataExport'
  ) {
    push(
      issues,
      'missing_license',
      'requiredLicense must be allowDataImport or allowDataExport',
      'requiredLicense',
    );
  }

  if (input.direction !== 'import' && input.direction !== 'export') {
    push(issues, 'invalid_direction', 'direction must be import or export', 'direction');
  }

  if (!IMPORT_EXPORT_REGISTRATION_KINDS.includes(input.registrationKind)) {
    push(
      issues,
      'invalid_registration_kind',
      `registrationKind must be one of: ${IMPORT_EXPORT_REGISTRATION_KINDS.join(', ')}`,
      'registrationKind',
    );
  }

  const formats = input.supportedFormats ?? [];
  if (formats.length === 0) {
    push(issues, 'empty_formats', 'supportedFormats must include at least one format', 'supportedFormats');
  } else {
    for (const format of formats) {
      if (!IMPORT_EXPORT_SUPPORTED_FORMATS.includes(format as ImportExportSupportedFormat)) {
        push(
          issues,
          'unsupported_format',
          `unsupported format "${String(format)}"`,
          'supportedFormats',
        );
      }
    }
  }

  if (
    input.status !== 'disabled' &&
    input.status !== 'inactive' &&
    input.status !== 'active' &&
    input.status !== 'deprecated'
  ) {
    push(issues, 'invalid_status', 'status is invalid', 'status');
  }

  if (input.typeId && input.version) {
    const sameType = existing.filter((entry) => entry.typeId === input.typeId);
    if (sameType.some((entry) => entry.version === input.version)) {
      push(
        issues,
        'duplicate_version',
        `duplicate typeId+version: ${input.typeId}@${input.version}`,
        'version',
      );
    }
    // Only one registration per typeId in the runtime catalog (versioned upgrades replace later).
    if (sameType.length > 0) {
      push(issues, 'duplicate_type_id', `duplicate typeId: ${input.typeId}`, 'typeId');
    }
  }

  return { valid: issues.length === 0, issues };
}

export function toRegistrationMetadata(
  input: ImportExportRegistrationInput,
): ImportExportRegistrationMetadata {
  return {
    ...input,
    featureFlag: input.featureFlag ?? null,
    adapterAttached: input.adapterAttached ?? false,
    executable: input.executable ?? false,
  };
}
