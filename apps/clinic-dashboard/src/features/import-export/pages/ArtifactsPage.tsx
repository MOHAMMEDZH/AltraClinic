import { useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/app/providers/AuthProvider';
import { AuthAlert } from '@/features/auth/components/AuthAlert';
import { AuthButton } from '@/features/auth/components/AuthButton';
import {
  canExportData,
  canViewImportExport,
  formatBytes,
  IMPORT_EXPORT_BASE_PATH,
} from '../config/import-export-config';
import { useExportArtifact, useImportExportJobs, useImportExportMutations } from '../hooks/useImportExport';
import { EmptyState, StatusBadge } from '../components/StatusParts';
import { logImportExportUiEvent } from '../lib/ui-events';
import styles from '../import-export-layout.module.css';

function ArtifactRow({ jobId }: { jobId: string }) {
  const { user } = useAuth();
  const canDownload = canExportData(user?.roles?.map(String) ?? []);
  const artifact = useExportArtifact(jobId, canDownload);
  const { downloadArtifact } = useImportExportMutations();

  if (artifact.isLoading) return <tr><td colSpan={7}>Loading artifact…</td></tr>;
  if (artifact.isError || !artifact.data?.artifact) {
    return (
      <tr>
        <td colSpan={7}>
          <span className={styles.muted}>No artifact metadata for {jobId}</span>
        </td>
      </tr>
    );
  }

  const a = artifact.data.artifact;
  return (
    <tr>
      <td>
        <Link className={styles.linkBtn} to={`${IMPORT_EXPORT_BASE_PATH}/jobs/${jobId}`}>
          {jobId.slice(0, 8)}…
        </Link>
      </td>
      <td>
        <StatusBadge status={a.status} />
      </td>
      <td>{a.format}</td>
      <td>{formatBytes(a.size)}</td>
      <td>{new Date(a.createdAt).toLocaleString()}</td>
      <td>{new Date(a.expiresAt).toLocaleString()}</td>
      <td>
        {a.downloadEligible && canDownload ? (
          <AuthButton
            type="button"
            onClick={async () => {
              logImportExportUiEvent('artifact_downloaded', { jobId });
              const file = await downloadArtifact.mutateAsync(jobId);
              const url = URL.createObjectURL(file.blob);
              const anchor = document.createElement('a');
              anchor.href = url;
              anchor.download = file.filename;
              anchor.click();
              URL.revokeObjectURL(url);
            }}
            disabled={downloadArtifact.isPending}
          >
            Download
          </AuthButton>
        ) : (
          <span className={styles.muted}>Unavailable</span>
        )}
      </td>
    </tr>
  );
}

export function ArtifactsPage() {
  const { user } = useAuth();
  const roles = user?.roles?.map(String) ?? [];
  const canView = canViewImportExport(roles);
  const jobs = useImportExportJobs({ direction: 'export', limit: 50 }, canView);

  useEffect(() => {
    logImportExportUiEvent('page_opened', { page: 'artifacts' });
  }, []);

  const completedExports = useMemo(
    () =>
      (jobs.data ?? []).filter((j) =>
        ['completed', 'completed_with_warnings'].includes(j.status),
      ),
    [jobs.data],
  );

  if (!canView) {
    return <AuthAlert variant="error">Missing permission to view artifacts.</AuthAlert>;
  }

  return (
    <section className={styles.panel} aria-labelledby="artifacts-title">
      <h2 id="artifacts-title" className={styles.panelTitle}>
        Artifact center
      </h2>
      <p className={styles.muted}>
        Downloads use backend authorization and signed tokens. Filesystem paths are never shown.
      </p>
      {completedExports.length === 0 ? (
        <EmptyState title="No export artifacts" detail="Completed exports will appear here." />
      ) : (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Job</th>
                <th>Status</th>
                <th>Format</th>
                <th>Size</th>
                <th>Created</th>
                <th>Expires</th>
                <th>Download</th>
              </tr>
            </thead>
            <tbody>
              {completedExports.map((job) => (
                <ArtifactRow key={job.id} jobId={job.id} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
