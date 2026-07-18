import { useCallback, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { hasPermission } from '@booking/permissions';
import { useI18n } from '@booking/i18n/react';
import { useAuth } from '@/app/providers/AuthProvider';
import { AuthAlert } from '@/features/auth/components/AuthAlert';
import { AuthButton } from '@/features/auth/components/AuthButton';
import { BatchList } from './components/BatchList';
import { canUpdateInventory, canViewInventory, formatInventoryDate } from './config/inventory-config';
import {
  useDisposeInventoryBatch,
  useInventoryBatches,
  useInventoryExpirySummary,
} from './hooks/useInventory';
import type { BatchExpiryFilter } from './types/inventory.types';
import styles from './ExpiryPage.module.css';

const EXPIRY_FILTERS: BatchExpiryFilter[] = ['all', 'expiring', 'expired'];

export function ExpiryPage() {
  const { t, locale, direction } = useI18n();
  const { user } = useAuth();
  const roles = user?.roles ?? [];
  const perm = useCallback((action: string) => hasPermission(roles, 'api.inventory', action as never), [roles]);

  const [expiryFilter, setExpiryFilter] = useState<BatchExpiryFilter>('expiring');
  const [page, setPage] = useState(1);

  const canView = canViewInventory(perm);
  const canDispose = canUpdateInventory(perm);

  const summaryQuery = useInventoryExpirySummary(canView);
  const batchesQuery = useInventoryBatches({
    expiry: expiryFilter === 'all' ? 'all' : expiryFilter,
    page,
    enabled: canView,
  });
  const disposeMutation = useDisposeInventoryBatch();

  const totalPages = Math.max(1, Math.ceil((batchesQuery.data?.total ?? 0) / (batchesQuery.data?.limit ?? 20)));

  if (!canView) {
    return (
      <div className={styles.page}>
        <AuthAlert variant="error">{t('inventory.accessDenied')}</AuthAlert>
      </div>
    );
  }

  const summary = summaryQuery.data;

  return (
    <div className={styles.page}>
      <nav aria-label={t('inventory.expiry.breadcrumb')}>
        <Link to="/inventory" className={styles.backLink}>
          <ArrowLeft
            size={16}
            aria-hidden
            style={direction === 'rtl' ? { transform: 'scaleX(-1)' } : undefined}
          />
          {t('inventory.detail.back')}
        </Link>
      </nav>

      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>{t('inventory.expiry.title')}</h1>
          <p className={styles.subtitle}>{t('inventory.expiry.subtitle')}</p>
        </div>
      </header>

      {summary && (
        <div className={styles.metrics}>
          <article className={`${styles.metricCard} ${summary.expiringSoonCount > 0 ? styles.warn : ''}`}>
            <span className={styles.metricLabel}>{t('inventory.metrics.expiringSoon')}</span>
            <strong>{summary.expiringSoonCount}</strong>
            <span className={styles.metricLabel}>
              {t('inventory.expiry.alertDays').replace('{days}', String(summary.alertDays))}
            </span>
          </article>
          <article className={`${styles.metricCard} ${summary.expiredCount > 0 ? styles.warn : ''}`}>
            <span className={styles.metricLabel}>{t('inventory.metrics.expired')}</span>
            <strong>{summary.expiredCount}</strong>
          </article>
        </div>
      )}

      <div className={styles.filters} role="group" aria-label={t('inventory.expiry.filters')}>
        {EXPIRY_FILTERS.map((f) => (
          <button
            key={f}
            type="button"
            className={expiryFilter === f ? styles.filterActive : styles.filterBtn}
            aria-pressed={expiryFilter === f}
            onClick={() => {
              setExpiryFilter(f);
              setPage(1);
            }}
          >
            {t(`inventory.expiry.filter.${f}`)}
          </button>
        ))}
      </div>

      <section aria-labelledby="expiry-batches-title">
        <h2 id="expiry-batches-title" className={styles.sectionTitle}>
          {t('inventory.batches.title')}
        </h2>
        <BatchList
          batches={batchesQuery.data?.batches ?? []}
          loading={batchesQuery.isLoading}
          canDispose={canDispose}
          showItemLink
          disposing={disposeMutation.isPending}
          onDispose={async (batchId, quantity, reason, notes) => {
            await disposeMutation.mutateAsync({ batchId, quantity, reason, notes });
          }}
        />
        {totalPages > 1 && (
          <nav className={styles.pagination}>
            <AuthButton variant="secondary" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
              {t('inventory.pagination.prev')}
            </AuthButton>
            <span>{page} / {totalPages}</span>
            <AuthButton variant="secondary" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
              {t('inventory.pagination.next')}
            </AuthButton>
          </nav>
        )}
      </section>

      {summary && summary.recentDisposals.length > 0 && (
        <section aria-labelledby="expiry-disposals-title">
          <h2 id="expiry-disposals-title" className={styles.sectionTitle}>
            {t('inventory.expiry.recentDisposals')}
          </h2>
          <div className={styles.disposalList}>
            {summary.recentDisposals.map((d) => (
              <article key={d.id} className={styles.disposalRow}>
                <p>
                  <Link to={`/inventory/items/${d.itemId}`}>{d.sku}</Link> — {d.itemName}
                </p>
                <p>
                  {d.quantity} {d.unit} · {d.reason}
                </p>
                <time dateTime={d.disposedAt}>{formatInventoryDate(d.disposedAt, locale)}</time>
              </article>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
