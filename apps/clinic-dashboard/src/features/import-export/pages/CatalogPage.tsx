import { useEffect } from 'react';
import { useAuth } from '@/app/providers/AuthProvider';
import { AuthAlert } from '@/features/auth/components/AuthAlert';
import { canViewImportExport } from '../config/import-export-config';
import { useImportExportCatalog } from '../hooks/useImportExport';
import { EmptyState, StatusBadge } from '../components/StatusParts';
import { logImportExportUiEvent } from '../lib/ui-events';
import styles from '../import-export-layout.module.css';

export function CatalogPage() {
  const { user } = useAuth();
  const canView = canViewImportExport(user?.roles?.map(String) ?? []);
  const catalog = useImportExportCatalog(canView);

  useEffect(() => {
    logImportExportUiEvent('catalog_viewed');
  }, []);

  if (!canView) {
    return <AuthAlert variant="error">Missing permission to view catalog.</AuthAlert>;
  }

  const types = catalog.data?.types ?? [];

  return (
    <section className={styles.panel} aria-labelledby="catalog-title">
      <h2 id="catalog-title" className={styles.panelTitle}>
        Runtime catalog
      </h2>
      <p className={styles.muted}>
        Sourced from EffectiveImportExportView. Filtering is performed by the backend.
      </p>
      {catalog.isLoading ? <p className={styles.muted}>Loading catalog…</p> : null}
      {catalog.isError ? <AuthAlert variant="error">Failed to load catalog.</AuthAlert> : null}
      {catalog.data ? (
        <div className={styles.statGrid}>
          <div className={styles.statCard}>
            <p className={styles.statValue}>{String(catalog.data.featureEnabled)}</p>
            <p className={styles.statLabel}>Feature enabled</p>
          </div>
          <div className={styles.statCard}>
            <p className={styles.statValue}>{String(catalog.data.allowDataImport)}</p>
            <p className={styles.statLabel}>allowDataImport</p>
          </div>
          <div className={styles.statCard}>
            <p className={styles.statValue}>{String(catalog.data.allowDataExport)}</p>
            <p className={styles.statLabel}>allowDataExport</p>
          </div>
          <div className={styles.statCard}>
            <p className={styles.statValue}>{catalog.data.meta.adapterAttachedCount}</p>
            <p className={styles.statLabel}>Adapters attached</p>
          </div>
        </div>
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
                <th>Direction</th>
                <th>Owner</th>
                <th>Formats</th>
                <th>Status</th>
                <th>Feature flag</th>
                <th>License</th>
                <th>Permission</th>
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
                  <td>{t.direction}</td>
                  <td>{t.ownerModule}</td>
                  <td>{t.supportedFormats.join(', ')}</td>
                  <td>
                    <StatusBadge status={t.status} />
                  </td>
                  <td>{t.featureFlag ?? '—'}</td>
                  <td>{t.requiredLicense}</td>
                  <td>
                    {t.requiredPermission.resource}:{t.requiredPermission.action}
                  </td>
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
