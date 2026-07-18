import { Injectable } from '@nestjs/common';
import { rolesCanAccessResource } from '../../../common/authorization/permission-matrix.util';
import {
  ImportAdapterResolutionError,
  type ImportAdapter,
  type ImportFileFormat,
} from '../domain/import/import-adapter.contracts';
import { ImportExportRuntimeRegistry } from './import-export-runtime.registry';

export interface ResolveImportAdapterInput {
  typeId: string;
  tenantId: string;
  branchId?: string | null;
  roles: string[];
  allowDataImport: boolean;
  format?: ImportFileFormat;
}

/**
 * Phase 42d — resolve import adapters from Runtime Registry + attached executors.
 */
@Injectable()
export class ImportAdapterResolver {
  constructor(private readonly registry: ImportExportRuntimeRegistry) {}

  resolve(input: ResolveImportAdapterInput): ImportAdapter {
    const meta = this.registry.getByTypeId(input.typeId);
    if (!meta || meta.direction !== 'import') {
      throw new ImportAdapterResolutionError(
        'missing_adapter',
        `No import registration for typeId=${input.typeId}`,
      );
    }
    if (meta.status === 'disabled') {
      throw new ImportAdapterResolutionError(
        'disabled_adapter',
        `Import type ${input.typeId} is disabled`,
      );
    }
    if (meta.status === 'inactive' || meta.status === 'deprecated') {
      throw new ImportAdapterResolutionError(
        'inactive_adapter',
        `Import type ${input.typeId} is ${meta.status}`,
      );
    }
    if (meta.requiredLicense === 'allowDataImport' && !input.allowDataImport) {
      throw new ImportAdapterResolutionError(
        'license_mismatch',
        'Licensing denied: allowDataImport=false',
      );
    }
    if (
      !rolesCanAccessResource(
        input.roles,
        meta.requiredPermission.resource,
        meta.requiredPermission.action,
      )
    ) {
      throw new ImportAdapterResolutionError(
        'permission_mismatch',
        `Missing permission ${meta.requiredPermission.resource}:${meta.requiredPermission.action}`,
      );
    }
    if (
      meta.restrictedToTenantIds?.length &&
      !meta.restrictedToTenantIds.includes(input.tenantId)
    ) {
      throw new ImportAdapterResolutionError('tenant_mismatch', 'Tenant not allowed for this import type');
    }
    if (
      meta.branchScope === 'branch' &&
      meta.restrictedToBranchIds?.length &&
      (!input.branchId || !meta.restrictedToBranchIds.includes(input.branchId))
    ) {
      throw new ImportAdapterResolutionError('branch_mismatch', 'Branch not allowed for this import type');
    }

    const adapter = this.registry.getImportAdapter(input.typeId);
    if (!adapter || !meta.adapterAttached || !meta.executable) {
      throw new ImportAdapterResolutionError(
        'missing_adapter',
        `No executable import adapter attached for typeId=${input.typeId}`,
      );
    }

    if (input.format && !adapter.supportedFormats.includes(input.format)) {
      throw new ImportAdapterResolutionError(
        'format_unsupported',
        `Format ${input.format} not supported by adapter ${input.typeId}`,
      );
    }

    return adapter;
  }
}
