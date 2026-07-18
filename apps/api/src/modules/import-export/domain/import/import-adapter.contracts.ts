/**
 * Phase 42d — Import Adapter contracts.
 * Adapters own business logic. Hub orchestrates only.
 */

export type ImportFileFormat = 'csv' | 'xlsx';

export type ImportProgressStage =
  | 'queued'
  | 'uploading'
  | 'scanning'
  | 'validating'
  | 'importing'
  | 'finalizing'
  | 'completed'
  | 'failed'
  | 'cancelled';

export interface ImportProgress {
  stage: ImportProgressStage;
  percent: number;
  message?: string;
  processedRows?: number;
  totalRows?: number;
  updatedAt: string;
}

export interface ImportContext {
  jobId: string;
  tenantId: string;
  branchId: string | null;
  typeId: string;
  correlationId: string;
  initiatedByUserId: string;
  dryRun: boolean;
  format: ImportFileFormat;
  filename: string;
  /** Parsed row objects — hub may pre-parse file structure; adapters own business meaning. */
  rows: Record<string, unknown>[];
  roles: string[];
}

export interface ImportValidationIssue {
  row?: number;
  code: string;
  message: string;
  field?: string;
}

export interface ImportValidationResult {
  valid: boolean;
  issues: ImportValidationIssue[];
  rowCount: number;
  validRowCount: number;
}

export interface ImportExecutionSummary {
  created: number;
  updated: number;
  skipped: number;
  failed: number;
  dryRun: boolean;
}

export interface ImportResult {
  success: boolean;
  validation: ImportValidationResult;
  summary: ImportExecutionSummary;
  warnings: string[];
  error?: string;
}

/**
 * Domain-owned import executor. Hub never implements business rules here.
 */
export interface ImportAdapter {
  readonly typeId: string;
  readonly supportedFormats: readonly ImportFileFormat[];
  validate(context: ImportContext): Promise<ImportValidationResult>;
  /**
   * Execute business import. Must no-op persistence when context.dryRun === true.
   */
  execute(context: ImportContext): Promise<ImportResult>;
}

export class ImportAdapterResolutionError extends Error {
  constructor(
    public readonly code:
      | 'missing_adapter'
      | 'disabled_adapter'
      | 'inactive_adapter'
      | 'license_mismatch'
      | 'permission_mismatch'
      | 'tenant_mismatch'
      | 'branch_mismatch'
      | 'direction_mismatch'
      | 'format_unsupported',
    message: string,
  ) {
    super(message);
    this.name = 'ImportAdapterResolutionError';
  }
}
