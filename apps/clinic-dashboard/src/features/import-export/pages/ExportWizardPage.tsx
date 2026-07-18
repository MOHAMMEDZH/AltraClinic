import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/app/providers/AuthProvider';
import { AuthAlert } from '@/features/auth/components/AuthAlert';
import { AuthButton } from '@/features/auth/components/AuthButton';
import {
  canExportData,
  canViewImportExport,
  IMPORT_EXPORT_BASE_PATH,
} from '../config/import-export-config';
import {
  useExportArtifact,
  useImportExportCatalog,
  useImportExportJobs,
  useImportExportMutations,
  useJobProgress,
} from '../hooks/useImportExport';
import { EmptyState, ProgressBar, StatusBadge } from '../components/StatusParts';
import { logImportExportUiEvent } from '../lib/ui-events';
import styles from '../import-export-layout.module.css';

export function ExportsPage() {
  const { user } = useAuth();
  const roles = user?.roles?.map(String) ?? [];
  const canView = canViewImportExport(roles);
  const canExport = canExportData(roles);
  const jobs = useImportExportJobs({ direction: 'export', limit: 40 }, canView);

  if (!canView) return <AuthAlert variant="error">Missing import/export view permission.</AuthAlert>;

  return (
    <section className={styles.panel}>
      <div className={styles.toolbar}>
        <h2 className={styles.panelTitle}>Exports</h2>
        {canExport ? (
          <Link to={`${IMPORT_EXPORT_BASE_PATH}/exports/new`}>
            <AuthButton type="button">New export</AuthButton>
          </Link>
        ) : null}
      </div>
      {(jobs.data ?? []).length === 0 ? (
        <EmptyState title="No export jobs" />
      ) : (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Type</th>
                <th>Format</th>
                <th>Status</th>
                <th>Updated</th>
              </tr>
            </thead>
            <tbody>
              {(jobs.data ?? []).map((job) => (
                <tr key={job.id}>
                  <td>
                    <Link className={styles.linkBtn} to={`${IMPORT_EXPORT_BASE_PATH}/jobs/${job.id}`}>
                      {job.typeId}
                    </Link>
                  </td>
                  <td>{String(job.metadata.format ?? '—')}</td>
                  <td>
                    <StatusBadge status={job.status} />
                  </td>
                  <td>{new Date(job.updatedAt).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

export function ExportWizardPage() {
  const { user } = useAuth();
  const roles = user?.roles?.map(String) ?? [];
  const navigate = useNavigate();
  const canExport = canExportData(roles);
  const catalog = useImportExportCatalog(canExport);
  const { createExport, downloadArtifact } = useImportExportMutations();

  const exportTypes = useMemo(
    () =>
      (catalog.data?.types ?? []).filter(
        (t) => t.direction === 'export' && t.executable && t.adapterAttached,
      ),
    [catalog.data],
  );

  const [typeId, setTypeId] = useState('users-export');
  const [format, setFormat] = useState<'csv' | 'xlsx'>('csv');
  const [jobId, setJobId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const progress = useJobProgress(jobId ?? undefined, 'export');
  const artifact = useExportArtifact(
    jobId &&
      (progress.data?.status === 'completed' || progress.data?.status === 'completed_with_warnings')
      ? jobId
      : undefined,
  );

  useEffect(() => {
    logImportExportUiEvent('wizard_started', { wizard: 'export' });
  }, []);

  useEffect(() => {
    if (exportTypes.length && !exportTypes.some((t) => t.typeId === typeId)) {
      setTypeId(exportTypes[0].typeId);
    }
  }, [exportTypes, typeId]);

  if (!canExport) {
    return <AuthAlert variant="error">Missing api.importExport:export permission.</AuthAlert>;
  }

  if (catalog.data && !catalog.data.allowDataExport) {
    return <AuthAlert variant="warning">Licensing denies data export for this tenant.</AuthAlert>;
  }

  const onSubmit = async () => {
    setError(null);
    try {
      const created = await createExport.mutateAsync({
        typeId,
        format,
        branchId: user?.branchId,
        queueImmediately: true,
        idempotencyKey: `ui-export:${typeId}:${format}:${Date.now()}`,
      });
      setJobId(created.job.id);
      logImportExportUiEvent('wizard_completed', { wizard: 'export', jobId: created.job.id });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Export failed to start');
    }
  };

  const done =
    progress.data?.status === 'completed' ||
    progress.data?.status === 'completed_with_warnings' ||
    progress.data?.status === 'failed';

  return (
    <section className={styles.panel} aria-labelledby="export-wizard-title">
      <h2 id="export-wizard-title" className={styles.panelTitle}>
        Export wizard
      </h2>
      <p className={styles.muted}>Dataset generation runs on the server. No browser-side export generation.</p>

      {!jobId ? (
        <div className={styles.formGrid}>
          <label className={styles.label}>
            Export type
            <select
              className={styles.select}
              value={typeId}
              onChange={(e) => setTypeId(e.target.value)}
              aria-label="Export type"
            >
              {exportTypes.map((t) => (
                <option key={t.typeId} value={t.typeId}>
                  {t.displayName} ({t.typeId})
                </option>
              ))}
            </select>
          </label>
          <label className={styles.label}>
            Format
            <select
              className={styles.select}
              value={format}
              onChange={(e) => setFormat(e.target.value as 'csv' | 'xlsx')}
              aria-label="Export format"
            >
              <option value="csv">CSV</option>
              <option value="xlsx">XLSX</option>
            </select>
          </label>
          {error ? <AuthAlert variant="error">{error}</AuthAlert> : null}
          <div className={styles.actions}>
            <AuthButton
              type="button"
              onClick={() => void onSubmit()}
              disabled={createExport.isPending || exportTypes.length === 0}
            >
              Start export
            </AuthButton>
            <Link className={styles.linkBtn} to={`${IMPORT_EXPORT_BASE_PATH}/exports`}>
              Cancel
            </Link>
          </div>
          {exportTypes.length === 0 ? (
            <AuthAlert variant="warning">No executable export adapters are available.</AuthAlert>
          ) : null}
        </div>
      ) : (
        <div className={styles.formGrid}>
          <p className={styles.muted}>
            Job <code>{jobId}</code>
          </p>
          <ProgressBar
            percent={progress.data?.progress.percent ?? 0}
            label={progress.data?.progress.message ?? progress.data?.progress.stage ?? 'Queued'}
          />
          {progress.data ? <StatusBadge status={progress.data.status} /> : null}
          {artifact.data?.artifact ? (
            <AuthAlert variant="success">
              Artifact available: {artifact.data.artifact.filename} (
              {artifact.data.artifact.downloadEligible ? 'download eligible' : 'not eligible'})
            </AuthAlert>
          ) : null}
          {done ? (
            <div className={styles.actions}>
              {artifact.data?.artifact?.downloadEligible ? (
                <AuthButton
                  type="button"
                  onClick={async () => {
                    logImportExportUiEvent('artifact_downloaded', { jobId });
                    const file = await downloadArtifact.mutateAsync(jobId);
                    const url = URL.createObjectURL(file.blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = file.filename;
                    a.click();
                    URL.revokeObjectURL(url);
                  }}
                >
                  Download artifact
                </AuthButton>
              ) : null}
              <AuthButton type="button" variant="secondary" onClick={() => navigate(`${IMPORT_EXPORT_BASE_PATH}/jobs/${jobId}`)}>
                View job
              </AuthButton>
            </div>
          ) : (
            <p className={styles.muted}>Tracking progress live…</p>
          )}
        </div>
      )}
    </section>
  );
}
