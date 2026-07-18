import { useCallback } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { hasPermission } from '@booking/permissions';
import { useI18n } from '@booking/i18n/react';
import { useAuth } from '@/app/providers/AuthProvider';
import { AuthAlert } from '@/features/auth/components/AuthAlert';
import { canViewInventory, formatInventoryDate, supplierDisplayName } from './config/inventory-config';
import { useInventorySupplier, usePurchaseOrders } from './hooks/useInventory';
import styles from './SuppliersPage.module.css';

export function SupplierDetailPage() {
  const { supplierId } = useParams<{ supplierId: string }>();
  const { t, locale, direction } = useI18n();
  const { user } = useAuth();
  const roles = user?.roles ?? [];
  const perm = useCallback((action: string) => hasPermission(roles, 'api.inventory', action as never), [roles]);

  const canView = canViewInventory(perm);
  const supplierQuery = useInventorySupplier(supplierId, canView);
  const ordersQuery = usePurchaseOrders({ supplierId, page: 1, enabled: canView && Boolean(supplierId) });

  const supplier = supplierQuery.data;
  const orders = ordersQuery.data?.orders ?? [];

  if (!canView) {
    return (
      <div className={styles.page}>
        <AuthAlert variant="error">{t('inventory.accessDenied')}</AuthAlert>
      </div>
    );
  }

  if (supplierQuery.isLoading) {
    return <div className={styles.page} aria-busy="true" />;
  }

  if (supplierQuery.isError || !supplier) {
    return (
      <div className={styles.page}>
        <AuthAlert variant="error">{t('inventory.errors.notFound')}</AuthAlert>
        <Link to="/inventory/suppliers" className={styles.backLink}>{t('inventory.supplierDetail.back')}</Link>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <Link to="/inventory/suppliers" className={styles.backLink}>
        <ArrowLeft size={16} aria-hidden style={direction === 'rtl' ? { transform: 'scaleX(-1)' } : undefined} />
        {t('inventory.supplierDetail.back')}
      </Link>

      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>{supplierDisplayName(supplier, locale)}</h1>
          <p className={styles.subtitle}>{supplier.code}</p>
        </div>
      </header>

      <dl className={styles.facts}>
        <div><dt>{t('inventory.suppliers.contact')}</dt><dd>{supplier.contactName ?? '—'}</dd></div>
        <div><dt>{t('inventory.suppliers.email')}</dt><dd>{supplier.email ?? '—'}</dd></div>
        <div><dt>{t('inventory.suppliers.phone')}</dt><dd dir="ltr">{supplier.phone ?? '—'}</dd></div>
        <div><dt>{t('inventory.suppliers.address')}</dt><dd>{supplier.address ?? '—'}</dd></div>
        <div><dt>{t('inventory.suppliers.leadTime')}</dt><dd>{supplier.leadTimeDays ?? '—'}</dd></div>
        <div><dt>{t('inventory.supplierDetail.linkedItems')}</dt><dd>{supplier.metrics.linkedItemCount}</dd></div>
        <div><dt>{t('inventory.supplierDetail.orderCount')}</dt><dd>{supplier.metrics.orderCount}</dd></div>
        <div>
          <dt>{t('inventory.supplierDetail.lastOrder')}</dt>
          <dd>{supplier.metrics.lastOrderDate ? formatInventoryDate(supplier.metrics.lastOrderDate, locale) : '—'}</dd>
        </div>
        <div><dt>{t('inventory.suppliers.status')}</dt><dd>{supplier.isActive ? t('inventory.warehouses.active') : t('inventory.warehouses.inactive')}</dd></div>
      </dl>

      <section>
        <h2 className={styles.sectionTitle}>{t('inventory.supplierDetail.recentOrders')}</h2>
        {orders.length === 0 ? (
          <p className={styles.empty}>{t('inventory.supplierDetail.noOrders')}</p>
        ) : (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <caption className="sr-only">{t('inventory.supplierDetail.ordersCaption')}</caption>
              <thead>
                <tr>
                  <th>{t('inventory.procurement.poNumber')}</th>
                  <th>{t('inventory.procurement.statusLabel')}</th>
                  <th>{t('inventory.procurement.lines')}</th>
                  <th>{t('inventory.stockRequests.created')}</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((order) => (
                  <tr key={order.orderId}>
                    <td>
                      <Link to={`/inventory/procurement?orderId=${order.orderId}`}>{order.poNumber}</Link>
                    </td>
                    <td>{t(`inventory.procurement.status.${order.status}` as 'inventory.procurement.status.DRAFT')}</td>
                    <td>{order.lines.length}</td>
                    <td>{formatInventoryDate(order.createdAt, locale)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
