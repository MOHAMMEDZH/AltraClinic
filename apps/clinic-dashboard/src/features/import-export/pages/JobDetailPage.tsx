import { useEffect } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useAuth } from '@/app/providers/AuthProvider';
import { AuthAlert } from '@/features/auth/components/AuthAlert';
import { AuthButton } from '@/features/auth/components/AuthButton';
import {
  canManageImportExport,
  canViewImportExport,
  IMPORT_EXPORT_BASE_PATH,
} from '../config/import-export-config';
import {
  useExportArtifact,
  useImportExportJob,
  useImportExportMutations,
  useJobProgress,
} from '../hooks/useImportExport';
import { ProgressBar, StatusBadge } from '../components/StatusParts';
import { logImportExportUiEvent } from '../lib/ui-events';
import styles from '../import-export-layout.module.css';

export function JobDetailPage() {
  const { jobId } = useParams<{ jobId: string }>();
  const { user } = useAuth();
  const roles = user?.roles?.map(String) ?? [];
  const canView = canViewImportExport(roles);
  const canManage = canManageImportExport(roles);
  const jobQuery = useImportExportJob(jobId, canView);
  const job = jobQuery.data;
  const progress = useJobProgress(jobId, job?.direction);
  const artifact = useExportArtifact(
    job?.direction === 'export' && ['completed', 'completed_with_warnings'].includes(job.status)
      ? job.id
      : undefined,
    Boolean(job),
  );
  const { cancelJob, retryJob, downloadArtifact } = useImportExportMutations();

  useEffect(() => {
    if (jobId) logImportExportUiEvent('job_viewed', { jobId });
  }, [jobId]);

  if (!canView) {
    return <AuthAlert variant="error">Missing permission to view job details.</AuthAlert>;
  }
  if (jobQuery.isLoading) return <p className={styles.muted}>Loading job…</p>;
  if (jobQuery.isError || !job) return <AuthAlert variant="error">Job not found.</AuthAlert>;

  const progressMeta = (job.metadata.progress as { stage?: string; percent?: number; message?: string }) ?? {};
  const liveProgress = progress.data?.progress ?? progressMeta;
  const importSummary = job.metadata.importSummary as Record<string, unknown> | undefined;
  const exportSummary = job.metadata.exportSummary as Record<string, unknown> | undefined;

  return (
    <section className={styles.panel} aria-labelledby="job-detail-title">
      <div className={styles.toolbar}>
        <Link className={styles.linkBtn} to={`${IMPORT_EXPORT_BASE_PATH}/jobs`}>
          ← Jobs
        </Link>
        <StatusBadge status={job.status} />
      </div>
      <h2 id="job-detail-title" className={styles.panelTitle}>
        Job {job.typeId}
      </h2>

      <ProgressBar
        percent={Number(liveProgress.percent ?? 0)}
        label={`${liveProgress.stage ?? 'unknown'}${liveProgress.message ? ` — ${liveProgress.message}` : ''}`}
      />

      <dl className={styles.dl}>
        <div className={styles.dlRow}>
          <dt>Job ID</dt>
          <dd>
            <code>{job.id}</code>
          </dd>
        </div>
        <div className={styles.dlRow}>
          <dt>Adapter / type</dt>
          <dd>{job.typeId}</dd>
        </div>
        <div className={styles.dlRow}>
          <dt>Direction</dt>
          <dd>{job.direction}</dd>
        </div>
        <div className={styles.dlRow}>
          <dt>Tenant</dt>
          <dd>{job.tenantId}</dd>
        </div>
        <div className={styles.dlRow}>
          <dt>Branch</dt>
          <dd>{job.branchId ?? '—'}</dd>
        </div>
        <div className={styles.dlRow}>
          <dt>Initiator</dt>
          <dd>{job.initiatedByUserId}</dd>
        </div>
        <div className={styles.dlRow}>
          <dt>Correlation ID</dt>
          <dd>
            <code>{job.correlationId}</code>
          </dd>
        </div>
        <div className={styles.dlRow}>
          <dt>Retry history</dt>
          <dd>
            attempt {job.attemptCount} of {job.maxAttempts}
            {job.lastError ? ` · last error: ${job.lastError}` : ''}
          </dd>
        </div>
        <div className={styles.dlRow}>
          <dt>Dead letter</dt>
          <dd>
            {job.deadLetteredAt
              ? `Yes · ${new Date(job.deadLetteredAt).toLocaleString()} · ${job.failureReason ?? ''}`
              : 'No'}
          </dd>
        </div>
        <div className={styles.dlRow}>
          <dt>Timeline</dt>
          <dd>
            created {new Date(job.createdAt).toLocaleString()}
            {job.startedAt ? ` · started ${new Date(job.startedAt).toLocaleString()}` : ''}
            {job.completedAt ? ` · completed ${new Date(job.completedAt).toLocaleString()}` : ''}
          </dd>
        </div>
        <div className={styles.dlRow}>
          <dt>Activity summary</dt>
          <dd>Orchestration events are recorded server-side (job lifecycle). No stack traces exposed.</dd>
        </div>
        <div className={styles.dlRow}>
          <dt>Audit summary</dt>
          <dd>
            who={job.initiatedByUserId}; when={new Date(job.updatedAt).toISOString()}; adapter={job.typeId};
            result={job.status}
          </dd>
        </div>
        <div className={styles.dlRow}>
          <dt>Notification summary</dt>
          <dd>Intents produced by hub on completion/failure (Phase 41 consumer). Failures never block jobs.</dd>
        </div>
        {importSummary ? (
          <div className={styles.dlRow}>
            <dt>Import summary</dt>
            <dd>
              <code>{JSON.stringify(importSummary)}</code>
            </dd>
          </div>
        ) : null}
        {exportSummary ? (
          <div className={styles.dlRow}>
            <dt>Export summary</dt>
            <dd>
              <code>{JSON.stringify(exportSummary)}</code>
            </dd>
          </div>
        ) : null}
        {artifact.data?.artifact ? (
          <div className={styles.dlRow}>
            <dt>Artifact</dt>
            <dd>
              {artifact.data.artifact.filename} · {artifact.data.artifact.format} ·{' '}
              <StatusBadge status={artifact.data.artifact.status} />
              {artifact.data.artifact.downloadEligible ? (
                <>
                  {' '}
                  <AuthButton
                    type="button"
                    onClick={async () => {
                      logImportExportUiEvent('artifact_downloaded', { jobId: job.id });
                      const file = await downloadArtifact.mutateAsync(job.id);
                      const url = URL.createObjectURL(file.blob);
                      const a = document.createElement('a');
                      a.href = url;
                      a.download = file.filename;
                      a.click();
                      URL.revokeObjectURL(url);
                    }}
                  >
                    Download
                  </AuthButton>
                </>
              ) : null}
            </dd>
          </div>
        ) : null}
      </dl>

      <div className={styles.actions}>
        {canManage && ['queued', 'running', 'retrying', 'draft'].includes(job.status) ? (
          <AuthButton
            type="button"
            variant="danger"
            onClick={() => {
              if (!window.confirm('Cancel this job?')) return;
              cancelJob.mutate(job.id);
            }}
          >
            Cancel job
          </AuthButton>
        ) : null}
        {canManage && (job.status === 'failed' || job.status === 'dead_letter') ? (
          <AuthButton type="button" onClick={() => retryJob.mutate(job.id)}>
            Retry job
          </AuthButton>
        ) : null}
      </div>
    </section>
  );
}
