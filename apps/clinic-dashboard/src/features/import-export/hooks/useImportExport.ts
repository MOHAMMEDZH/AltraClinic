import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/app/providers/AuthProvider';
import {
  cancelImportExportJob,
  createExportSession,
  createImportSession,
  downloadExportArtifact,
  fetchExportArtifact,
  fetchExportProgress,
  fetchImportExportCatalog,
  fetchImportExportHealth,
  fetchImportExportJob,
  fetchImportProgress,
  listImportExportJobs,
  retryImportExportJob,
  uploadImportFile,
  type JobDirection,
  type JobStatus,
} from '../api/import-export-api';
import { isLiveJobStatus } from '../config/import-export-config';

const QUERY_ROOT = ['import-export'] as const;

export function useImportExportCatalog(enabled = true) {
  const { getValidAccessToken, user } = useAuth();
  return useQuery({
    queryKey: [...QUERY_ROOT, 'catalog', user?.tenantId],
    queryFn: async () => {
      const token = await getValidAccessToken();
      if (!token || !user?.tenantId) throw new Error('Not authenticated');
      const res = await fetchImportExportCatalog(token, user.tenantId);
      return res.catalog;
    },
    enabled: Boolean(user?.tenantId) && enabled,
    staleTime: 30_000,
  });
}

export function useImportExportHealth(enabled = true) {
  const { getValidAccessToken, user } = useAuth();
  return useQuery({
    queryKey: [...QUERY_ROOT, 'health', user?.tenantId],
    queryFn: async () => {
      const token = await getValidAccessToken();
      if (!token || !user?.tenantId) throw new Error('Not authenticated');
      return fetchImportExportHealth(token, user.tenantId);
    },
    enabled: Boolean(user?.tenantId) && enabled,
    staleTime: 15_000,
    refetchInterval: 15_000,
  });
}

export function useImportExportJobs(
  params: {
    status?: JobStatus;
    direction?: JobDirection;
    typeId?: string;
    limit?: number;
    offset?: number;
    search?: string;
  } = {},
  enabled = true,
) {
  const { getValidAccessToken, user } = useAuth();
  return useQuery({
    queryKey: [...QUERY_ROOT, 'jobs', user?.tenantId, params],
    queryFn: async () => {
      const token = await getValidAccessToken();
      if (!token || !user?.tenantId) throw new Error('Not authenticated');
      const res = await listImportExportJobs(token, user.tenantId, {
        status: params.status,
        direction: params.direction,
        typeId: params.typeId,
        limit: params.limit ?? 50,
        offset: params.offset ?? 0,
      });
      let jobs = res.jobs;
      if (params.search?.trim()) {
        const q = params.search.trim().toLowerCase();
        jobs = jobs.filter(
          (j) =>
            j.id.toLowerCase().includes(q) ||
            j.typeId.toLowerCase().includes(q) ||
            j.correlationId.toLowerCase().includes(q) ||
            j.status.toLowerCase().includes(q),
        );
      }
      return jobs;
    },
    enabled: Boolean(user?.tenantId) && enabled,
    staleTime: 5_000,
    refetchInterval: (query) => {
      const rows = query.state.data ?? [];
      return rows.some((j) => isLiveJobStatus(j.status)) ? 3000 : 10_000;
    },
  });
}

export function useImportExportJob(jobId: string | undefined, enabled = true) {
  const { getValidAccessToken, user } = useAuth();
  return useQuery({
    queryKey: [...QUERY_ROOT, 'job', user?.tenantId, jobId],
    queryFn: async () => {
      const token = await getValidAccessToken();
      if (!token || !user?.tenantId || !jobId) throw new Error('Not authenticated');
      const res = await fetchImportExportJob(token, user.tenantId, jobId);
      return res.job;
    },
    enabled: Boolean(user?.tenantId && jobId) && enabled,
    refetchInterval: (query) => {
      const job = query.state.data;
      return job && isLiveJobStatus(job.status) ? 2000 : false;
    },
  });
}

export function useJobProgress(jobId: string | undefined, direction: JobDirection | undefined) {
  const { getValidAccessToken, user } = useAuth();
  return useQuery({
    queryKey: [...QUERY_ROOT, 'progress', user?.tenantId, jobId, direction],
    queryFn: async () => {
      const token = await getValidAccessToken();
      if (!token || !user?.tenantId || !jobId || !direction) throw new Error('Not authenticated');
      return direction === 'import'
        ? fetchImportProgress(token, user.tenantId, jobId)
        : fetchExportProgress(token, user.tenantId, jobId);
    },
    enabled: Boolean(user?.tenantId && jobId && direction),
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      return status && isLiveJobStatus(status) ? 2000 : false;
    },
  });
}

export function useExportArtifact(jobId: string | undefined, enabled = true) {
  const { getValidAccessToken, user } = useAuth();
  return useQuery({
    queryKey: [...QUERY_ROOT, 'artifact', user?.tenantId, jobId],
    queryFn: async () => {
      const token = await getValidAccessToken();
      if (!token || !user?.tenantId || !jobId) throw new Error('Not authenticated');
      return fetchExportArtifact(token, user.tenantId, jobId);
    },
    enabled: Boolean(user?.tenantId && jobId) && enabled,
    retry: false,
  });
}

export function useImportExportMutations() {
  const { getValidAccessToken, user } = useAuth();
  const qc = useQueryClient();

  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: QUERY_ROOT });
  };

  const createImport = useMutation({
    mutationFn: async (body: Parameters<typeof createImportSession>[2]) => {
      const token = await getValidAccessToken();
      if (!token || !user?.tenantId) throw new Error('Not authenticated');
      return createImportSession(token, user.tenantId, body);
    },
    onSuccess: invalidate,
  });

  const uploadImport = useMutation({
    mutationFn: async (input: { jobId: string; file: File }) => {
      const token = await getValidAccessToken();
      if (!token || !user?.tenantId) throw new Error('Not authenticated');
      return uploadImportFile(token, user.tenantId, input.jobId, input.file);
    },
    onSuccess: invalidate,
  });

  const createExport = useMutation({
    mutationFn: async (body: Parameters<typeof createExportSession>[2]) => {
      const token = await getValidAccessToken();
      if (!token || !user?.tenantId) throw new Error('Not authenticated');
      return createExportSession(token, user.tenantId, body);
    },
    onSuccess: invalidate,
  });

  const cancelJob = useMutation({
    mutationFn: async (jobId: string) => {
      const token = await getValidAccessToken();
      if (!token || !user?.tenantId) throw new Error('Not authenticated');
      return cancelImportExportJob(token, user.tenantId, jobId);
    },
    onSuccess: invalidate,
  });

  const retryJob = useMutation({
    mutationFn: async (jobId: string) => {
      const token = await getValidAccessToken();
      if (!token || !user?.tenantId) throw new Error('Not authenticated');
      return retryImportExportJob(token, user.tenantId, jobId);
    },
    onSuccess: invalidate,
  });

  const downloadArtifact = useMutation({
    mutationFn: async (jobId: string) => {
      const token = await getValidAccessToken();
      if (!token || !user?.tenantId) throw new Error('Not authenticated');
      const meta = await fetchExportArtifact(token, user.tenantId, jobId);
      if (!meta.downloadToken) throw new Error('Download not available');
      return downloadExportArtifact(token, user.tenantId, jobId, meta.downloadToken);
    },
  });

  return { createImport, uploadImport, createExport, cancelJob, retryJob, downloadArtifact };
}
