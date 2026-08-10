import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/app/providers/AuthProvider';
import { AuthAlert } from '@/features/auth/components/AuthAlert';
import { AuthButton } from '@/features/auth/components/AuthButton';
import {
  canCreateBackup,
  BACKUP_RESTORE_BASE_PATH,
} from '../config/backup-restore-config';
import { useBackupRestoreCatalog, useBackupRestoreMutations } from '../hooks/useBackupRestore';
import { logBackupRestoreUiEvent } from '../lib/ui-events';
import styles from '../backup-restore-layout.module.css';

const DEFAULT_TYPES = ['postgres-logical', 'media-prefix'];

export function BackupRequestPage() {
  const { user } = useAuth();
  const roles = user?.roles?.map(String) ?? [];
  const navigate = useNavigate();
  const canCreate = canCreateBackup(roles);
  const catalog = useBackupRestoreCatalog(canCreate);
  const { submitBackup } = useBackupRestoreMutations();

  const backupTypes = useMemo(() => {
    const fromCatalog = (catalog.data?.types ?? [])
      .filter((t) => t.registrationKind === 'backupAdapter')
      .map((t) => t.typeId);
    return fromCatalog.length ? fromCatalog : DEFAULT_TYPES;
  }, [catalog.data]);

  const [typeId, setTypeId] = useState('postgres-logical');
  const [targetId, setTargetId] = useState('');
  const [description, setDescription] = useState('');
  const [compression, setCompression] = useState('gzip');
  const [encryptionClass, setEncryptionClass] = useState('envelope');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    logBackupRestoreUiEvent('page_opened', { page: 'backup_request' });
  }, []);

  useEffect(() => {
    if (backupTypes.length && !backupTypes.includes(typeId)) {
      setTypeId(backupTypes[0]);
    }
  }, [backupTypes, typeId]);

  if (!canCreate) {
    return <AuthAlert variant="error">Missing api.backupRestore:create permission.</AuthAlert>;
  }

  const catalogView = catalog.data?.catalog;
  if (catalogView && !catalogView.allowBackupRestore) {
    return <AuthAlert variant="warning">Licensing denies backup for this tenant.</AuthAlert>;
  }

  return (
    <section className={styles.panel} aria-labelledby="br-backup-request-title">
      <div className={styles.toolbar}>
        <Link className={styles.linkBtn} to={`${BACKUP_RESTORE_BASE_PATH}/backups`}>
          ← Backups
        </Link>
      </div>
      <h2 id="br-backup-request-title" className={styles.panelTitle}>
        New backup request
      </h2>
      <p className={styles.muted}>Creates and executes a backup job on the server.</p>

      <form
        className={styles.formGrid}
        onSubmit={async (e) => {
          e.preventDefault();
          setError(null);
          if (
            !window.confirm(
              `Start backup for type "${typeId}"? This may affect production data paths on the server.`,
            )
          ) {
            return;
          }
          try {
            logBackupRestoreUiEvent('backup_requested', { typeId });
            const res = await submitBackup.mutateAsync({
              typeId,
              targetId: targetId.trim() || undefined,
              description: description.trim() || undefined,
              compression,
              encryptionClass,
              idempotencyKey: crypto.randomUUID(),
            });
            navigate(`${BACKUP_RESTORE_BASE_PATH}/jobs/${res.job.id}`);
          } catch (err) {
            setError(err instanceof Error ? err.message : 'Backup request failed');
          }
        }}
      >
        <label className={styles.label}>
          Backup type
          <select
            className={styles.select}
            value={typeId}
            onChange={(e) => setTypeId(e.target.value)}
            aria-label="Backup type"
          >
            {backupTypes.map((id) => (
              <option key={id} value={id}>
                {id}
              </option>
            ))}
          </select>
        </label>
        <label className={styles.label}>
          Target ID (optional)
          <input
            className={styles.input}
            value={targetId}
            onChange={(e) => setTargetId(e.target.value)}
            aria-label="Target ID"
          />
        </label>
        <label className={styles.label}>
          Description (optional)
          <input
            className={styles.input}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            aria-label="Description"
          />
        </label>
        <label className={styles.label}>
          Compression
          <select
            className={styles.select}
            value={compression}
            onChange={(e) => setCompression(e.target.value)}
            aria-label="Compression"
          >
            <option value="gzip">gzip</option>
            <option value="none">none</option>
            <option value="zstd">zstd</option>
          </select>
        </label>
        <label className={styles.label}>
          Encryption class
          <select
            className={styles.select}
            value={encryptionClass}
            onChange={(e) => setEncryptionClass(e.target.value)}
            aria-label="Encryption class"
          >
            <option value="envelope">envelope</option>
            <option value="none">none</option>
            <option value="tenant_kms">tenant_kms</option>
          </select>
        </label>
        {error ? <AuthAlert variant="error">{error}</AuthAlert> : null}
        <AuthButton type="submit" disabled={submitBackup.isPending}>
          {submitBackup.isPending ? 'Submitting…' : 'Start backup'}
        </AuthButton>
      </form>
    </section>
  );
}
