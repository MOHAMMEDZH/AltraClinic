import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/app/providers/AuthProvider';
import { AuthAlert } from '@/features/auth/components/AuthAlert';
import { AuthButton } from '@/features/auth/components/AuthButton';
import {
  canCreateImport,
  canViewImportExport,
  IMPORT_EXPORT_BASE_PATH,
} from '../config/import-export-config';
import {
  useImportExportCatalog,
  useImportExportJobs,
  useImportExportMutations,
  useJobProgress,
} from '../hooks/useImportExport';
import { EmptyState, ProgressBar, StatusBadge } from '../components/StatusParts';
import { logImportExportUiEvent } from '../lib/ui-events';
import styles from '../import-export-layout.module.css';

export function ImportsPage() {
  const { user } = useAuth();
  const roles = user?.roles?.map(String) ?? [];
  const canView = canViewImportExport(roles);
  const canCreate = canCreateImport(roles);
  const jobs = useImportExportJobs({ direction: 'import', limit: 40 }, canView);

  if (!canView) return <AuthAlert variant="error">Missing import/export view permission.</AuthAlert>;

  return (
    <section className={styles.panel}>
      <div className={styles.toolbar}>
        <h2 className={styles.panelTitle}>Imports</h2>
        {canCreate ? (
          <Link to={`${IMPORT_EXPORT_BASE_PATH}/imports/new`}>
            <AuthButton type="button">New import</AuthButton>
          </Link>
        ) : null}
      </div>
      {(jobs.data ?? []).length === 0 ? (
        <EmptyState title="No import jobs" />
      ) : (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Type</th>
                <th>Status</th>
                <th>Dry run</th>
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
                  <td>
                    <StatusBadge status={job.status} />
                  </td>
                  <td>{String(Boolean(job.metadata.dryRun))}</td>
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

export function ImportWizardPage() {
  const { user } = useAuth();
  const roles = user?.roles?.map(String) ?? [];
  const navigate = useNavigate();
  const canCreate = canCreateImport(roles);
  const catalog = useImportExportCatalog(canCreate);
  const { createImport, uploadImport } = useImportExportMutations();

  const importTypes = useMemo(
    () =>
      (catalog.data?.types ?? []).filter(
        (t) => t.direction === 'import' && t.executable && t.adapterAttached,
      ),
    [catalog.data],
  );

  const [typeId, setTypeId] = useState('users-import');
  const [dryRun, setDryRun] = useState(true);
  const [file, setFile] = useState<File | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const progress = useJobProgress(jobId ?? undefined, 'import');

  useEffect(() => {
    logImportExportUiEvent('wizard_started', { wizard: 'import' });
  }, []);

  useEffect(() => {
    if (importTypes.length && !importTypes.some((t) => t.typeId === typeId)) {
      setTypeId(importTypes[0].typeId);
    }
  }, [importTypes, typeId]);

  if (!canCreate) {
    return <AuthAlert variant="error">Missing api.importExport:create permission.</AuthAlert>;
  }

  if (catalog.data && !catalog.data.allowDataImport) {
    return <AuthAlert variant="warning">Licensing denies data import for this tenant.</AuthAlert>;
  }

  const onSubmit = async () => {
    setError(null);
    if (!file) {
      setError('Choose a CSV or XLSX file.');
      return;
    }
    try {
      const created = await createImport.mutateAsync({
        typeId,
        dryRun,
        branchId: user?.branchId,
        idempotencyKey: `ui-import:${typeId}:${Date.now()}`,
      });
      setJobId(created.job.id);
      await uploadImport.mutateAsync({ jobId: created.job.id, file });
      logImportExportUiEvent('wizard_completed', { wizard: 'import', jobId: created.job.id });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Import failed to start');
    }
  };

  const stage = progress.data?.progress.stage;
  const done =
    progress.data?.status === 'completed' ||
    progress.data?.status === 'completed_with_warnings' ||
    progress.data?.status === 'failed';

  return (
    <section className={styles.panel} aria-labelledby="import-wizard-title">
      <h2 id="import-wizard-title" className={styles.panelTitle}>
        Import wizard
      </h2>
      <p className={styles.muted}>Uploads and validation run on the server. UX checks only.</p>

      {!jobId ? (
        <div className={styles.formGrid}>
          <label className={styles.label}>
            Import type
            <select
              className={styles.select}
              value={typeId}
              onChange={(e) => setTypeId(e.target.value)}
              aria-label="Import type"
            >
              {importTypes.map((t) => (
                <option key={t.typeId} value={t.typeId}>
                  {t.displayName} ({t.typeId})
                </option>
              ))}
            </select>
          </label>
          <label className={styles.label}>
            <span>
              <input
                type="checkbox"
                checked={dryRun}
                onChange={(e) => setDryRun(e.target.checked)}
              />{' '}
              Dry run (validate only)
            </span>
          </label>
          <label className={styles.label}>
            File (CSV / XLSX)
            <input
              type="file"
              accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              aria-label="Import file"
            />
          </label>
          {error ? <AuthAlert variant="error">{error}</AuthAlert> : null}
          <div className={styles.actions}>
            <AuthButton
              type="button"
              onClick={() => void onSubmit()}
              disabled={createImport.isPending || uploadImport.isPending || importTypes.length === 0}
            >
              {dryRun ? 'Run dry import' : 'Start real import'}
            </AuthButton>
            <Link className={styles.linkBtn} to={`${IMPORT_EXPORT_BASE_PATH}/imports`}>
              Cancel
            </Link>
          </div>
          {importTypes.length === 0 ? (
            <AuthAlert variant="warning">No executable import adapters are available.</AuthAlert>
          ) : null}
        </div>
      ) : (
        <div className={styles.formGrid}>
          <p className={styles.muted}>
            Job <code>{jobId}</code>
          </p>
          <ProgressBar
            percent={progress.data?.progress.percent ?? 0}
            label={progress.data?.progress.message ?? stage ?? 'Queued'}
          />
          {progress.data ? <StatusBadge status={progress.data.status} /> : null}
          {done ? (
            <div className={styles.actions}>
              <AuthButton type="button" onClick={() => navigate(`${IMPORT_EXPORT_BASE_PATH}/jobs/${jobId}`)}>
                View job details
              </AuthButton>
              <AuthButton type="button" variant="secondary" onClick={() => setJobId(null)}>
                Start another
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
