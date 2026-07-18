import { API_BASE, ApiError, apiRequest } from '@/lib/api-client';

export type JobDirection = 'import' | 'export';
export type JobStatus =
  | 'draft'
  | 'queued'
  | 'running'
  | 'retrying'
  | 'completed'
  | 'completed_with_warnings'
  | 'failed'
  | 'cancelled'
  | 'expired'
  | 'dead_letter';

export interface ImportExportJob {
  id: string;
  tenantId: string;
  branchId: string | null;
  typeId: string;
  direction: JobDirection;
  status: JobStatus;
  priority: string;
  initiatedByUserId: string;
  idempotencyKey: string;
  correlationId: string;
  attemptCount: number;
  maxAttempts: number;
  lastError: string | null;
  failureReason: string | null;
  warningCount: number;
  metadata: Record<string, unknown>;
  scheduledAt: string | null;
  startedAt: string | null;
  completedAt: string | null;
  deadLetteredAt: string | null;
  expiresAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CatalogType {
  typeId: string;
  displayName: string;
  category: string;
  direction: JobDirection;
  ownerModule: string;
  version: string;
  status: string;
  registrationKind: string;
  supportedFormats: string[];
  supportsDryRun: boolean;
  supportsPreview: boolean;
  requiredPermission: { resource: string; action: string };
  requiredLicense: string;
  tenantScope: string;
  branchScope: string;
  featureFlag: string | null;
  adapterAttached: boolean;
  executable: boolean;
  visible: boolean;
}

export interface EffectiveCatalog {
  extensionKind: string;
  featureEnabled: boolean;
  allowDataImport: boolean;
  allowDataExport: boolean;
  types: CatalogType[];
  tenantId: string | null;
  branchId: string | null;
  visible: boolean;
  meta: {
    registeredCount: number;
    visibleCount: number;
    disabledCount: number;
    inactiveCount: number;
    invalidCount: number;
    executableCount: number;
    adapterAttachedCount: number;
  };
}

export interface ProgressPayload {
  stage: string;
  percent: number;
  message?: string;
  updatedAt: string;
}

export interface ArtifactMetadata {
  artifactId: string;
  jobId: string;
  format: string;
  size: number;
  checksum: string;
  contentType: string;
  filename: string;
  createdAt: string;
  expiresAt: string;
  status: string;
  downloadEligible: boolean;
}

export interface ImportExportHealth {
  ready: boolean;
  dormant: boolean;
  featureFlag: { name: string; enabled: boolean };
  queue: { name: string; connected: boolean; enqueuedCount: number };
  worker: Record<string, unknown>;
  importRuntime: { enabled: boolean; attachedAdapters: string[] };
  exportRuntime: {
    enabled: boolean;
    attachedAdapters: string[];
    artifactCleanup?: { enabled: boolean; runs: number; lastExpired: number; lastDeleted: number };
  };
  expirationScheduler: { enabled: boolean; runs: number };
  registry: Record<string, unknown>;
  effectiveView: Record<string, unknown>;
  jobs?: Record<string, number>;
}

function authOpts(token: string, tenantId: string) {
  return { token, tenantId };
}

export async function fetchImportExportCatalog(token: string, tenantId: string) {
  return apiRequest<{ catalog: EffectiveCatalog }>('/import-export/catalog', authOpts(token, tenantId));
}

export async function fetchImportExportHealth(token: string, tenantId: string) {
  return apiRequest<ImportExportHealth>('/import-export/health', authOpts(token, tenantId));
}

export async function listImportExportJobs(
  token: string,
  tenantId: string,
  params: {
    status?: JobStatus;
    typeId?: string;
    direction?: JobDirection;
    branchId?: string;
    limit?: number;
    offset?: number;
  } = {},
) {
  const q = new URLSearchParams();
  if (params.status) q.set('status', params.status);
  if (params.typeId) q.set('typeId', params.typeId);
  if (params.direction) q.set('direction', params.direction);
  if (params.branchId) q.set('branchId', params.branchId);
  if (params.limit != null) q.set('limit', String(params.limit));
  if (params.offset != null) q.set('offset', String(params.offset));
  const qs = q.toString();
  return apiRequest<{ jobs: ImportExportJob[] }>(
    `/import-export/jobs${qs ? `?${qs}` : ''}`,
    authOpts(token, tenantId),
  );
}

export async function fetchImportExportJob(token: string, tenantId: string, jobId: string) {
  return apiRequest<{ job: ImportExportJob }>(`/import-export/jobs/${jobId}`, authOpts(token, tenantId));
}

export async function cancelImportExportJob(token: string, tenantId: string, jobId: string) {
  return apiRequest<{ job: ImportExportJob }>(`/import-export/jobs/${jobId}/cancel`, {
    ...authOpts(token, tenantId),
    method: 'POST',
  });
}

export async function retryImportExportJob(token: string, tenantId: string, jobId: string) {
  return apiRequest<{ job: ImportExportJob }>(`/import-export/jobs/${jobId}/retry`, {
    ...authOpts(token, tenantId),
    method: 'POST',
  });
}

export async function createImportSession(
  token: string,
  tenantId: string,
  body: {
    typeId: string;
    branchId?: string | null;
    dryRun?: boolean;
    idempotencyKey?: string;
    correlationId?: string;
  },
) {
  return apiRequest<{ job: ImportExportJob }>('/import-export/imports', {
    ...authOpts(token, tenantId),
    method: 'POST',
    body,
    headers: body.idempotencyKey ? { 'idempotency-key': body.idempotencyKey } : undefined,
  });
}

export async function uploadImportFile(
  token: string,
  tenantId: string,
  jobId: string,
  file: File,
) {
  const form = new FormData();
  form.append('file', file);
  const res = await fetch(`${API_BASE}/import-export/imports/${jobId}/upload`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'x-tenant-id': tenantId,
    },
    body: form,
  });
  const text = await res.text();
  const data = text ? (JSON.parse(text) as unknown) : undefined;
  if (!res.ok) {
    const message =
      typeof data === 'object' && data !== null && 'message' in data
        ? String((data as { message: unknown }).message)
        : res.statusText;
    throw new ApiError(message, res.status, data);
  }
  return data as { job: ImportExportJob };
}

export async function fetchImportProgress(token: string, tenantId: string, jobId: string) {
  return apiRequest<{ jobId: string; progress: ProgressPayload; status: JobStatus }>(
    `/import-export/imports/${jobId}/progress`,
    authOpts(token, tenantId),
  );
}

export async function createExportSession(
  token: string,
  tenantId: string,
  body: {
    typeId: string;
    format: 'csv' | 'xlsx';
    branchId?: string | null;
    filters?: Record<string, unknown>;
    idempotencyKey?: string;
    correlationId?: string;
    queueImmediately?: boolean;
  },
) {
  return apiRequest<{ job: ImportExportJob }>('/import-export/exports', {
    ...authOpts(token, tenantId),
    method: 'POST',
    body,
    headers: body.idempotencyKey ? { 'idempotency-key': body.idempotencyKey } : undefined,
  });
}

export async function fetchExportProgress(token: string, tenantId: string, jobId: string) {
  return apiRequest<{ jobId: string; progress: ProgressPayload; status: JobStatus }>(
    `/import-export/exports/${jobId}/progress`,
    authOpts(token, tenantId),
  );
}

export async function fetchExportArtifact(token: string, tenantId: string, jobId: string) {
  return apiRequest<{ artifact: ArtifactMetadata; downloadToken?: string }>(
    `/import-export/exports/${jobId}/artifact`,
    authOpts(token, tenantId),
  );
}

export async function downloadExportArtifact(
  token: string,
  tenantId: string,
  jobId: string,
  downloadToken: string,
): Promise<{ blob: Blob; filename: string; contentType: string }> {
  const res = await fetch(
    `${API_BASE}/import-export/exports/${jobId}/artifact?token=${encodeURIComponent(downloadToken)}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        'x-tenant-id': tenantId,
      },
    },
  );
  if (!res.ok) {
    const text = await res.text();
    throw new ApiError(text || res.statusText, res.status);
  }
  const blob = await res.blob();
  const disposition = res.headers.get('Content-Disposition') ?? '';
  const match = /filename="([^"]+)"/.exec(disposition);
  return {
    blob,
    filename: match?.[1] ?? `export-${jobId}`,
    contentType: res.headers.get('Content-Type') ?? 'application/octet-stream',
  };
}
