/**
 * Phase 42a — Audit action name interfaces only.
 * Does NOT emit Audit entries at runtime.
 */
import { IMPORT_EXPORT_AUDIT_ACTIONS } from '../import-export.constants';

export type ImportExportAuditActionName = (typeof IMPORT_EXPORT_AUDIT_ACTIONS)[number];

export class ImportExportAuditContracts {
  readonly actionNames: readonly ImportExportAuditActionName[] = IMPORT_EXPORT_AUDIT_ACTIONS;

  listActionNames(): readonly ImportExportAuditActionName[] {
    return this.actionNames;
  }
}
