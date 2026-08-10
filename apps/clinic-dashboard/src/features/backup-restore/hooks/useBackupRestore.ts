import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/app/providers/AuthProvider';
import {
  cancelBackupRestoreJob,
  createBackup,
  createRestore,
  fetchBackupRestoreCatalog,
  fetchBackupRestoreHealth,
  fetchBackupRestoreJob,
  listBackupRestoreJobs,
  listRecoveryPoints,
  listRetention,
  listSnapshots,
  listVerificationResults,
  type BackupRestoreJobKind,
  type BackupRestoreJobStatus,
} from '../api/backup-restore-api';
import { isLiveJobStatus } from '../config/backup-restore-config';

const QUERY_ROOT = ['backup-restore'] as const;

export function useBackupRestoreCatalog(enabled = true) {
  const { getValidAccessToken, user } = useAuth();
  return useQuery({
    queryKey: [...QUERY_ROOT, 'catalog', user?.tenantId],
    queryFn: async () => {
      const token = await getValidAccessToken();
      if (!token || !user?.tenantId) throw new Error('Not authenticated');
      return fetchBackupRestoreCatalog(token, user.tenantId);
    },
    enabled: Boolean(user?.tenantId) && enabled,
    staleTime: 30_000,
  });
}

export function useBackupRestoreHealth(enabled = true) {
  const { getValidAccessToken, user } = useAuth();
  return useQuery({
    queryKey: [...QUERY_ROOT, 'health', user?.tenantId],
    queryFn: async () => {
      const token = await getValidAccessToken();
      if (!token || !user?.tenantId) throw new Error('Not authenticated');
      return fetchBackupRestoreHealth(token, user.tenantId);
    },
    enabled: Boolean(user?.tenantId) && enabled,
    staleTime: 15_000,
    refetchInterval: 15_000,
  });
}

export function useBackupRestoreJobs(
  params: {
    kind?: BackupRestoreJobKind;
    status?: BackupRestoreJobStatus;
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
      const res = await listBackupRestoreJobs(token, user.tenantId, {
        kind: params.kind,
        status: params.status,
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
            j.status.toLowerCase().includes(q) ||
            j.kind.toLowerCase().includes(q),
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

export function useBackupRestoreJob(jobId: string | undefined, enabled = true) {
  const { getValidAccessToken, user } = useAuth();
  return useQuery({
    queryKey: [...QUERY_ROOT, 'job', user?.tenantId, jobId],
    queryFn: async () => {
      const token = await getValidAccessToken();
      if (!token || !user?.tenantId || !jobId) throw new Error('Not authenticated');
      const res = await fetchBackupRestoreJob(token, user.tenantId, jobId);
      return res.job;
    },
    enabled: Boolean(user?.tenantId && jobId) && enabled,
    refetchInterval: (query) => {
      const job = query.state.data;
      return job && isLiveJobStatus(job.status) ? 2000 : false;
    },
  });
}

export function useSnapshots(enabled = true) {
  const { getValidAccessToken, user } = useAuth();
  return useQuery({
    queryKey: [...QUERY_ROOT, 'snapshots', user?.tenantId],
    queryFn: async () => {
      const token = await getValidAccessToken();
      if (!token || !user?.tenantId) throw new Error('Not authenticated');
      const res = await listSnapshots(token, user.tenantId);
      return res.snapshots;
    },
    enabled: Boolean(user?.tenantId) && enabled,
    staleTime: 10_000,
  });
}

export function useVerificationResults(enabled = true) {
  const { getValidAccessToken, user } = useAuth();
  return useQuery({
    queryKey: [...QUERY_ROOT, 'verification', user?.tenantId],
    queryFn: async () => {
      const token = await getValidAccessToken();
      if (!token || !user?.tenantId) throw new Error('Not authenticated');
      const res = await listVerificationResults(token, user.tenantId);
      return res.results;
    },
    enabled: Boolean(user?.tenantId) && enabled,
    staleTime: 10_000,
  });
}

export function useRetention(enabled = true) {
  const { getValidAccessToken, user } = useAuth();
  return useQuery({
    queryKey: [...QUERY_ROOT, 'retention', user?.tenantId],
    queryFn: async () => {
      const token = await getValidAccessToken();
      if (!token || !user?.tenantId) throw new Error('Not authenticated');
      return listRetention(token, user.tenantId);
    },
    enabled: Boolean(user?.tenantId) && enabled,
    staleTime: 15_000,
  });
}

export function useRecoveryPoints(enabled = true) {
  const { getValidAccessToken, user } = useAuth();
  return useQuery({
    queryKey: [...QUERY_ROOT, 'recovery-points', user?.tenantId],
    queryFn: async () => {
      const token = await getValidAccessToken();
      if (!token || !user?.tenantId) throw new Error('Not authenticated');
      const res = await listRecoveryPoints(token, user.tenantId);
      return res.recoveryPoints;
    },
    enabled: Boolean(user?.tenantId) && enabled,
    staleTime: 10_000,
  });
}

export function useBackupRestoreMutations() {
  const { getValidAccessToken, user } = useAuth();
  const qc = useQueryClient();

  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: QUERY_ROOT });
  };

  const submitBackup = useMutation({
    mutationFn: async (body: Parameters<typeof createBackup>[2]) => {
      const token = await getValidAccessToken();
      if (!token || !user?.tenantId) throw new Error('Not authenticated');
      return createBackup(token, user.tenantId, body);
    },
    onSuccess: invalidate,
  });

  const submitRestore = useMutation({
    mutationFn: async (body: Parameters<typeof createRestore>[2]) => {
      const token = await getValidAccessToken();
      if (!token || !user?.tenantId) throw new Error('Not authenticated');
      return createRestore(token, user.tenantId, body);
    },
    onSuccess: invalidate,
  });

  const cancelJob = useMutation({
    mutationFn: async (jobId: string) => {
      const token = await getValidAccessToken();
      if (!token || !user?.tenantId) throw new Error('Not authenticated');
      return cancelBackupRestoreJob(token, user.tenantId, jobId);
    },
    onSuccess: invalidate,
  });

  return { submitBackup, submitRestore, cancelJob };
}
