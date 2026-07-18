import { useCallback, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Search } from 'lucide-react';
import { hasPermission } from '@booking/permissions';
import { useI18n } from '@booking/i18n/react';
import { useAuth } from '@/app/providers/AuthProvider';
import { AuthAlert } from '@/features/auth/components/AuthAlert';
import { AuthButton } from '@/features/auth/components/AuthButton';
import { canViewInventory, warehouseDisplayName } from './config/inventory-config';
import { useInventoryWarehouses, useWarehouseStock } from './hooks/useInventory';
import styles from './WarehousesPage.module.css';

export function WarehouseDetailPage() {
  const { warehouseId } = useParams<{ warehouseId: string }>();
  const { t, locale, direction } = useI18n();
  const { user } = useAuth();
  const roles = user?.roles ?? [];
  const perm = useCallback((action: string) => hasPermission(roles, 'api.inventory', action as never), [roles]);

  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const canView = canViewInventory(perm);

  const warehousesQuery = useInventoryWarehouses({ enabled: canView });
  const warehouse = warehousesQuery.data?.find((w) => w.warehouseId === warehouseId);
  const stockQuery = useWarehouseStock({
    warehouseId,
    q: search.trim() || undefined,
    page,
    enabled: canView && Boolean(warehouseId),
  });

  const stock = stockQuery.data?.stock ?? [];
  const totalPages = Math.max(1, Math.ceil((stockQuery.data?.total ?? 0) / (stockQuery.data?.limit ?? 20)));

  if (!canView) {
    return (
      <div className={styles.page}>
        <AuthAlert variant="error">{t('inventory.accessDenied')}</AuthAlert>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <nav aria-label={t('inventory.warehouses.breadcrumb')}>
        <Link to="/inventory/warehouses" className={styles.backLink}>
          <ArrowLeft size={16} aria-hidden style={direction === 'rtl' ? { transform: 'scaleX(-1)' } : undefined} />
          {t('inventory.warehouseDetail.back')}
        </Link>
      </nav>

      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>
            {warehouse ? warehouseDisplayName(warehouse, locale) : t('inventory.warehouseDetail.title')}
          </h1>
          <p className={styles.subtitle}>
            {warehouse
              ? `${warehouse.code}${warehouse.isDefault ? ` · ${t('inventory.warehouses.default')}` : ''}`
              : t('inventory.warehouseDetail.subtitle')}
          </p>
        </div>
      </header>

      {warehouse && (
        <p className={styles.subtitle}>
          {t('inventory.warehouses.items')}: {warehouse.metrics.itemCount} · {t('inventory.warehouses.quantity')}: {warehouse.metrics.totalQuantity}
        </p>
      )}

      <div className={styles.toolbar}>
        <div className={styles.searchWrap}>
          <Search size={16} className={styles.searchIcon} aria-hidden />
          <input
            className={styles.searchInput}
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            placeholder={t('inventory.warehouseDetail.searchPlaceholder')}
            aria-label={t('inventory.warehouseDetail.searchPlaceholder')}
          />
        </div>
      </div>

      {stock.length === 0 ? (
        <div className={styles.empty}>{t('inventory.warehouseDetail.empty')}</div>
      ) : (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <caption className="sr-only">{t('inventory.warehouseDetail.tableCaption')}</caption>
            <thead>
              <tr>
                <th>{t('inventory.table.sku')}</th>
                <th>{t('inventory.table.name')}</th>
                <th>{t('inventory.table.quantity')}</th>
                <th>{t('inventory.table.unit')}</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {stock.map((row) => (
                <tr key={`${row.warehouseId}-${row.itemId}`}>
                  <td>{row.sku}</td>
                  <td>{row.itemName}</td>
                  <td>{row.quantityOnHand}</td>
                  <td>{row.unit}</td>
                  <td>
                    <Link to={`/inventory/items/${row.itemId}`}>{t('inventory.warehouseDetail.viewItem')}</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {totalPages > 1 && (
        <div className={styles.pagination}>
          <AuthButton variant="secondary" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
            {t('inventory.pagination.prev')}
          </AuthButton>
          <span>{page} / {totalPages}</span>
          <AuthButton variant="secondary" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
            {t('inventory.pagination.next')}
          </AuthButton>
        </div>
      )}
    </div>
  );
}
