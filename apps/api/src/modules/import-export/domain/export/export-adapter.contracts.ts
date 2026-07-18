/**
 * Phase 42e — Export Adapter contracts.
 * Adapters own query/transform/dataset generation. Hub orchestrates only.
 */

export type ExportFileFormat = 'csv' | 'xlsx';

export type ExportProgressStage =
  | 'queued'
  | 'preparing'
  | 'generating'
  | 'uploading'
  | 'finalizing'
  | 'completed'
  | 'failed'
  | 'cancelled';

export type ArtifactLifecycleStatus =
  | 'preparing'
  | 'generating'
  | 'stored'
  | 'available'
  | 'expired'
  | 'deleted';

export interface ExportProgress {
  stage: ExportProgressStage;
  percent: number;
  message?: string;
  updatedAt: string;
}

export interface ExportContext {
  jobId: string;
  tenantId: string;
  branchId: string | null;
  typeId: string;
  correlationId: string;
  initiatedByUserId: string;
  format: ExportFileFormat;
  roles: string[];
  filters?: Record<string, unknown>;
}

export interface ExportArtifactPayload {
  format: ExportFileFormat;
  contentType: string;
  filename: string;
  bytes: Buffer;
  rowCount: number;
}

export interface ExportExecutionSummary {
  rowCount: number;
  format: ExportFileFormat;
  byteLength: number;
}

export interface ExportResult {
  success: boolean;
  artifact?: ExportArtifactPayload;
  summary: ExportExecutionSummary;
  warnings: string[];
  error?: string;
}

export interface ExportArtifact {
  artifactId: string;
  jobId: string;
  tenantId: string;
  format: ExportFileFormat;
  size: number;
  checksum: string;
  contentType: string;
  filename: string;
  status: ArtifactLifecycleStatus;
  /** Opaque storage key — never a public filesystem path. */
  storageKey: string;
  downloadTokenHash: string;
  createdAt: Date;
  expiresAt: Date;
  deletedAt: Date | null;
}

/**
 * Domain-owned export executor.
 */
export interface ExportAdapter {
  readonly typeId: string;
  readonly supportedFormats: readonly ExportFileFormat[];
  execute(context: ExportContext): Promise<ExportResult>;
}

export class ExportAdapterResolutionError extends Error {
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
    this.name = 'ExportAdapterResolutionError';
  }
}
