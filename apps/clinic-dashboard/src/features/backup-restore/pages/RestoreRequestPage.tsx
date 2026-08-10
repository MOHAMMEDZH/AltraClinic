import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/app/providers/AuthProvider';
import { AuthAlert } from '@/features/auth/components/AuthAlert';
import { AuthButton } from '@/features/auth/components/AuthButton';
import {
  canApproveRestore,
  canRestore,
  BACKUP_RESTORE_BASE_PATH,
} from '../config/backup-restore-config';
import {
  useBackupRestoreCatalog,
  useBackupRestoreMutations,
  useRecoveryPoints,
  useSnapshots,
} from '../hooks/useBackupRestore';
import { logBackupRestoreUiEvent } from '../lib/ui-events';
import styles from '../backup-restore-layout.module.css';

export function RestoreRequestPage() {
  const { user } = useAuth();
  const roles = user?.roles?.map(String) ?? [];
  const navigate = useNavigate();
  const canRunRestore = canRestore(roles);
  const canApprove = canApproveRestore(roles);
  const catalog = useBackupRestoreCatalog(canRunRestore);
  const recoveryPoints = useRecoveryPoints(canRunRestore);
  const snapshots = useSnapshots(canRunRestore);
  const { submitRestore } = useBackupRestoreMutations();

  const [snapshotId, setSnapshotId] = useState('');
  const [recoveryPointId, setRecoveryPointId] = useState('');
  const [typeId, setTypeId] = useState('postgres-logical');
  const [restoreMode, setRestoreMode] = useState<'drill' | 'controlled'>('drill');
  const [restoreTargetKind, setRestoreTargetKind] = useState('');
  const [approvedByUserId, setApprovedByUserId] = useState('');
  const [error, setError] = useState<string | null>(null);

  const selectablePoints = useMemo(
    () => (recoveryPoints.data ?? []).filter((rp) => rp.restoreAvailable),
    [recoveryPoints.data],
  );

  const selectableSnapshots = useMemo(() => snapshots.data ?? [], [snapshots.data]);

  useEffect(() => {
    logBackupRestoreUiEvent('page_opened', { page: 'restore_request' });
  }, []);

  useEffect(() => {
    if (selectablePoints.length && !snapshotId) {
      setSnapshotId(selectablePoints[0].snapshotId);
      setRecoveryPointId(selectablePoints[0].id);
      setTypeId(selectablePoints[0].typeId);
    } else if (selectableSnapshots.length && !snapshotId) {
      setSnapshotId(selectableSnapshots[0].id);
      setTypeId(selectableSnapshots[0].manifest.typeId);
    }
  }, [selectablePoints, selectableSnapshots, snapshotId]);

  if (!canRunRestore) {
    return <AuthAlert variant="error">Missing api.backupRestore:manage permission.</AuthAlert>;
  }

  const catalogView = catalog.data?.catalog;
  if (catalogView && !catalogView.allowBackupRestore) {
    return <AuthAlert variant="warning">Licensing denies restore for this tenant.</AuthAlert>;
  }

  const validationWarnings: string[] = [];
  if (restoreMode === 'controlled' && !canApprove) {
    validationWarnings.push('Controlled restore requires approve permission for dual-control.');
  }
  if (restoreMode === 'controlled' && !approvedByUserId.trim()) {
    validationWarnings.push('Approver user ID is required for controlled restore.');
  }
  if (!snapshotId) {
    validationWarnings.push('Select a snapshot or recovery point.');
  }

  return (
    <section className={styles.panel} aria-labelledby="br-restore-request-title">
      <div className={styles.toolbar}>
        <Link className={styles.linkBtn} to={`${BACKUP_RESTORE_BASE_PATH}/restores`}>
          ← Restores
        </Link>
      </div>
      <h2 id="br-restore-request-title" className={styles.panelTitle}>
        New restore request
      </h2>
      <p className={styles.muted}>Creates and executes a restore job on the server.</p>

      {validationWarnings.length ? (
        <AuthAlert variant="warning">{validationWarnings.join(' ')}</AuthAlert>
      ) : null}

      <form
        className={styles.formGrid}
        onSubmit={async (e) => {
          e.preventDefault();
          setError(null);
          if (validationWarnings.length) return;
          const confirmMsg =
            restoreMode === 'controlled'
              ? `Execute CONTROLLED restore for snapshot ${snapshotId}? This may overwrite production data.`
              : `Execute DRILL restore for snapshot ${snapshotId}?`;
          if (!window.confirm(confirmMsg)) return;
          try {
            logBackupRestoreUiEvent('restore_requested', { typeId, restoreMode });
            const res = await submitRestore.mutateAsync({
              typeId,
              snapshotId,
              restoreMode,
              restoreTargetKind: restoreTargetKind.trim() || undefined,
              recoveryPointId: recoveryPointId.trim() || undefined,
              approvedByUserId:
                restoreMode === 'controlled' ? approvedByUserId.trim() || undefined : undefined,
              idempotencyKey: crypto.randomUUID(),
            });
            navigate(`${BACKUP_RESTORE_BASE_PATH}/jobs/${res.job.id}`);
          } catch (err) {
            setError(err instanceof Error ? err.message : 'Restore request failed');
          }
        }}
      >
        <label className={styles.label}>
          Recovery point (verified)
          <select
            className={styles.select}
            value={recoveryPointId}
            onChange={(e) => {
              const rp = selectablePoints.find((p) => p.id === e.target.value);
              setRecoveryPointId(e.target.value);
              if (rp) {
                setSnapshotId(rp.snapshotId);
                setTypeId(rp.typeId);
              }
            }}
            aria-label="Recovery point"
          >
            <option value="">— select —</option>
            {selectablePoints.map((rp) => (
              <option key={rp.id} value={rp.id}>
                {rp.label ?? rp.id} · {rp.snapshotId.slice(0, 8)}…
              </option>
            ))}
          </select>
        </label>
        <label className={styles.label}>
          Snapshot
          <select
            className={styles.select}
            value={snapshotId}
            onChange={(e) => {
              const snap = selectableSnapshots.find((s) => s.id === e.target.value);
              setSnapshotId(e.target.value);
              if (snap) setTypeId(snap.manifest.typeId);
            }}
            aria-label="Snapshot"
          >
            <option value="">— select —</option>
            {selectableSnapshots.map((s) => (
              <option key={s.id} value={s.id}>
                {s.id.slice(0, 12)}… · {s.manifest.typeId} · {s.verificationStatus}
              </option>
            ))}
          </select>
        </label>
        <label className={styles.label}>
          Restore mode
          <select
            className={styles.select}
            value={restoreMode}
            onChange={(e) => setRestoreMode(e.target.value as 'drill' | 'controlled')}
            aria-label="Restore mode"
          >
            <option value="drill">drill (non-destructive)</option>
            <option value="controlled">controlled (production)</option>
          </select>
        </label>
        <label className={styles.label}>
          Target kind (optional)
          <input
            className={styles.input}
            value={restoreTargetKind}
            onChange={(e) => setRestoreTargetKind(e.target.value)}
            aria-label="Restore target kind"
            placeholder="e.g. postgres, media"
          />
        </label>
        {restoreMode === 'controlled' ? (
          <label className={styles.label}>
            Approved by user ID
            <input
              className={styles.input}
              value={approvedByUserId}
              onChange={(e) => setApprovedByUserId(e.target.value)}
              aria-label="Approved by user ID"
              required
            />
          </label>
        ) : null}
        {error ? <AuthAlert variant="error">{error}</AuthAlert> : null}
        <AuthButton type="submit" disabled={submitRestore.isPending || validationWarnings.length > 0}>
          {submitRestore.isPending ? 'Submitting…' : 'Start restore'}
        </AuthButton>
      </form>
    </section>
  );
}
