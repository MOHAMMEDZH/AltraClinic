import { useEffect } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useAuth } from '@/app/providers/AuthProvider';
import { AuthAlert } from '@/features/auth/components/AuthAlert';
import { AuthButton } from '@/features/auth/components/AuthButton';
import {
  canManage,
  canViewBackupRestore,
  BACKUP_RESTORE_BASE_PATH,
  isLiveJobStatus,
} from '../config/backup-restore-config';
import { useBackupRestoreJob, useBackupRestoreMutations } from '../hooks/useBackupRestore';
import { ProgressBar, StatusBadge } from '../components/StatusParts';
import { logBackupRestoreUiEvent } from '../lib/ui-events';
import styles from '../backup-restore-layout.module.css';

export function JobDetailPage() {
  const { jobId } = useParams<{ jobId: string }>();
  const { user } = useAuth();
  const roles = user?.roles?.map(String) ?? [];
  const canView = canViewBackupRestore(roles);
  const canManageJobs = canManage(roles);
  const jobQuery = useBackupRestoreJob(jobId, canView);
  const job = jobQuery.data;
  const { cancelJob } = useBackupRestoreMutations();

  useEffect(() => {
    if (jobId) logBackupRestoreUiEvent('job_viewed', { jobId });
  }, [jobId]);

  if (!canView) {
    return <AuthAlert variant="error">Missing permission to view job details.</AuthAlert>;
  }
  if (jobQuery.isLoading) return <p className={styles.muted}>Loading job…</p>;
  if (jobQuery.isError || !job) return <AuthAlert variant="error">Job not found.</AuthAlert>;

  const progress = job.progress;
  const backupSummary = job.metadata.backupSummary as Record<string, unknown> | undefined;
  const restoreSummary = job.metadata.restoreSummary as Record<string, unknown> | undefined;

  return (
    <section className={styles.panel} aria-labelledby="br-job-detail-title">
      <div className={styles.toolbar}>
        <Link className={styles.linkBtn} to={`${BACKUP_RESTORE_BASE_PATH}/jobs`}>
          ← Jobs
        </Link>
        <StatusBadge status={job.status} />
      </div>
      <h2 id="br-job-detail-title" className={styles.panelTitle}>
        Job {job.typeId}
      </h2>

      <ProgressBar
        percent={Number(progress.percent ?? 0)}
        label={`${progress.phase ?? 'unknown'}${progress.statusMessage ? ` — ${progress.statusMessage}` : ''}`}
      />

      <dl className={styles.dl}>
        <div className={styles.dlRow}>
          <dt>Job ID</dt>
          <dd>
            <code>{job.id}</code>
          </dd>
        </div>
        <div className={styles.dlRow}>
          <dt>Kind</dt>
          <dd>{job.kind}</dd>
        </div>
        <div className={styles.dlRow}>
          <dt>Adapter / type</dt>
          <dd>{job.typeId}</dd>
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
          <dt>Failure</dt>
          <dd>
            {job.lastError ?? '—'}
            {job.failureClass ? ` (${job.failureClass})` : ''}
            {job.cancelReason ? ` · cancel: ${job.cancelReason}` : ''}
          </dd>
        </div>
        <div className={styles.dlRow}>
          <dt>Retry history</dt>
          <dd>
            attempt {job.attemptCount} of {job.maxAttempts}
          </dd>
        </div>
        <div className={styles.dlRow}>
          <dt>Dead letter</dt>
          <dd>
            {job.deadLetteredAt
              ? `Yes · ${new Date(job.deadLetteredAt).toLocaleString()}`
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
            who={job.initiatedByUserId}; when={new Date(job.updatedAt).toISOString()}; type={job.typeId};
            result={job.status}
          </dd>
        </div>
        <div className={styles.dlRow}>
          <dt>Notification summary</dt>
          <dd>Intents produced by hub on completion/failure. Failures never block jobs.</dd>
        </div>
        {backupSummary ? (
          <div className={styles.dlRow}>
            <dt>Backup summary</dt>
            <dd>
              <code>{JSON.stringify(backupSummary)}</code>
            </dd>
          </div>
        ) : null}
        {restoreSummary ? (
          <div className={styles.dlRow}>
            <dt>Restore summary</dt>
            <dd>
              <code>{JSON.stringify(restoreSummary)}</code>
            </dd>
          </div>
        ) : null}
      </dl>

      <div className={styles.actions}>
        {canManageJobs && isLiveJobStatus(job.status) ? (
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
      </div>
    </section>
  );
}
