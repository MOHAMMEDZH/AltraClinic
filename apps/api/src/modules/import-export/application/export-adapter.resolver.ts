import { Injectable } from '@nestjs/common';
import { rolesCanAccessResource } from '../../../common/authorization/permission-matrix.util';
import {
  ExportAdapterResolutionError,
  type ExportAdapter,
  type ExportFileFormat,
} from '../domain/export/export-adapter.contracts';
import { ImportExportRuntimeRegistry } from './import-export-runtime.registry';

export interface ResolveExportAdapterInput {
  typeId: string;
  tenantId: string;
  branchId?: string | null;
  roles: string[];
  allowDataExport: boolean;
  format?: ExportFileFormat;
}

@Injectable()
export class ExportAdapterResolver {
  constructor(private readonly registry: ImportExportRuntimeRegistry) {}

  resolve(input: ResolveExportAdapterInput): ExportAdapter {
    const meta = this.registry.getByTypeId(input.typeId);
    if (!meta || meta.direction !== 'export') {
      throw new ExportAdapterResolutionError(
        'missing_adapter',
        `No export registration for typeId=${input.typeId}`,
      );
    }
    if (meta.status === 'disabled') {
      throw new ExportAdapterResolutionError(
        'disabled_adapter',
        `Export type ${input.typeId} is disabled`,
      );
    }
    if (meta.status === 'inactive' || meta.status === 'deprecated') {
      throw new ExportAdapterResolutionError(
        'inactive_adapter',
        `Export type ${input.typeId} is ${meta.status}`,
      );
    }
    if (meta.requiredLicense === 'allowDataExport' && !input.allowDataExport) {
      throw new ExportAdapterResolutionError(
        'license_mismatch',
        'Licensing denied: allowDataExport=false',
      );
    }
    if (
      !rolesCanAccessResource(
        input.roles,
        meta.requiredPermission.resource,
        meta.requiredPermission.action,
      )
    ) {
      throw new ExportAdapterResolutionError(
        'permission_mismatch',
        `Missing permission ${meta.requiredPermission.resource}:${meta.requiredPermission.action}`,
      );
    }
    if (
      meta.restrictedToTenantIds?.length &&
      !meta.restrictedToTenantIds.includes(input.tenantId)
    ) {
      throw new ExportAdapterResolutionError('tenant_mismatch', 'Tenant not allowed for this export type');
    }
    if (
      meta.branchScope === 'branch' &&
      meta.restrictedToBranchIds?.length &&
      (!input.branchId || !meta.restrictedToBranchIds.includes(input.branchId))
    ) {
      throw new ExportAdapterResolutionError('branch_mismatch', 'Branch not allowed for this export type');
    }

    const adapter = this.registry.getExportAdapter(input.typeId);
    if (!adapter || !meta.adapterAttached || !meta.executable) {
      throw new ExportAdapterResolutionError(
        'missing_adapter',
        `No executable export adapter attached for typeId=${input.typeId}`,
      );
    }

    if (input.format && !adapter.supportedFormats.includes(input.format)) {
      throw new ExportAdapterResolutionError(
        'format_unsupported',
        `Format ${input.format} not supported by adapter ${input.typeId}`,
      );
    }

    return adapter;
  }
}
