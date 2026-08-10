import { useEffect } from 'react';
import { useAuth } from '@/app/providers/AuthProvider';
import { AuthAlert } from '@/features/auth/components/AuthAlert';
import { canViewBackupRestore } from '../config/backup-restore-config';
import { useBackupRestoreCatalog, useBackupRestoreHealth } from '../hooks/useBackupRestore';
import { EmptyState, StatusBadge } from '../components/StatusParts';
import { logBackupRestoreUiEvent } from '../lib/ui-events';
import styles from '../backup-restore-layout.module.css';

export function CatalogPage() {
  const { user } = useAuth();
  const canView = canViewBackupRestore(user?.roles?.map(String) ?? []);
  const catalog = useBackupRestoreCatalog(canView);
  const health = useBackupRestoreHealth(canView);

  useEffect(() => {
    logBackupRestoreUiEvent('catalog_viewed');
  }, []);

  if (!canView) {
    return <AuthAlert variant="error">Missing permission to view catalog.</AuthAlert>;
  }

  const catalogView = catalog.data?.catalog;
  const types = catalog.data?.types ?? catalogView?.types ?? [];

  return (
    <section className={styles.panel} aria-labelledby="br-catalog-title">
      <h2 id="br-catalog-title" className={styles.panelTitle}>
        Runtime catalog
      </h2>
      <p className={styles.muted}>
        Sourced from EffectiveBackupRestoreView plus static catalog entries. Static catalog is not runtime authority.
      </p>
      {catalog.isLoading ? <p className={styles.muted}>Loading catalog…</p> : null}
      {catalog.isError ? <AuthAlert variant="error">Failed to load catalog.</AuthAlert> : null}
      {catalogView ? (
        <div className={styles.statGrid}>
          <div className={styles.statCard}>
            <p className={styles.statValue}>{String(catalogView.featureEnabled)}</p>
            <p className={styles.statLabel}>Feature enabled</p>
          </div>
          <div className={styles.statCard}>
            <p className={styles.statValue}>{String(catalogView.allowBackupRestore)}</p>
            <p className={styles.statLabel}>allowBackupRestore</p>
          </div>
          <div className={styles.statCard}>
            <p className={styles.statValue}>{catalogView.meta.catalogCount}</p>
            <p className={styles.statLabel}>Catalog count</p>
          </div>
          <div className={styles.statCard}>
            <p className={styles.statValue}>{catalogView.meta.executableCount}</p>
            <p className={styles.statLabel}>Executable adapters</p>
          </div>
        </div>
      ) : null}

      {health.data?.licensing ? (
        <AuthAlert variant="warning">
          Licensing capabilities: {health.data.licensing.capabilities.join(', ') || 'none'}. Upgrade messaging
          applies for advancedRestore, scheduledBackup, crossRegionBackup, and pointInTimeRestore when not licensed
          or feature flags are off.
        </AuthAlert>
      ) : null}

      {types.length === 0 && !catalog.isLoading ? (
        <EmptyState
          title="No visible types"
          detail="Types may be disabled, inactive, or blocked by licensing / permissions."
        />
      ) : (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Display name</th>
                <th>typeId</th>
                <th>Category</th>
                <th>Owner</th>
                <th>Status</th>
                <th>Feature flag</th>
                <th>License</th>
                <th>Adapter</th>
                <th>Executable</th>
              </tr>
            </thead>
            <tbody>
              {types.map((t) => (
                <tr key={t.typeId}>
                  <td>{t.displayName}</td>
                  <td>
                    <code>{t.typeId}</code>
                  </td>
                  <td>{t.category}</td>
                  <td>{t.ownerModule}</td>
                  <td>
                    <StatusBadge status={t.status} />
                  </td>
                  <td>{t.featureFlag ?? '—'}</td>
                  <td>{t.requiredLicense}</td>
                  <td>{t.adapterAttached ? 'yes' : 'no'}</td>
                  <td>{t.executable ? 'yes' : 'no'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
