import { useCallback, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { RefreshCw } from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { hasPermission } from '@booking/permissions';
import { useI18n } from '@booking/i18n/react';
import { formatMessage } from '@/i18n/messages';
import { useAuth } from '@/app/providers/AuthProvider';
import { useOnlineStatus } from '@/features/auth/hooks/useOnlineStatus';
import { AuthAlert } from '@/features/auth/components/AuthAlert';
import { AuthButton } from '@/features/auth/components/AuthButton';
import {
  canCreateInventory,
  canUpdateInventory,
  canViewInventory,
  formatCurrency,
  isInventoryStaffWorkspace,
  resolveInventoryWorkspaceMode,
} from './config/inventory-config';
import { useInventoryAnalytics, useInventorySummary } from './hooks/useInventory';
import { InventoryQuickNav } from './components/InventoryQuickNav';
import { StockMovementTimeline } from './components/StockMovementTimeline';
import styles from './InventoryDashboardPage.module.css';

export function InventoryDashboardPage() {
  const { t, locale } = useI18n();
  const navigate = useNavigate();
  const { user } = useAuth();
  const online = useOnlineStatus();
  const roles = user?.roles ?? [];
  const perm = useCallback((action: string) => hasPermission(roles, 'api.inventory', action as never), [roles]);
  const workspaceMode = resolveInventoryWorkspaceMode(roles);

  const canView = canViewInventory(perm);
  const canCreate = canCreateInventory(perm);
  const canReceiveScan = isInventoryStaffWorkspace(workspaceMode) && canUpdateInventory(perm);
  const summaryQuery = useInventorySummary(canView);
  const analyticsQuery = useInventoryAnalytics(30, canView);

  const summary = summaryQuery.data;
  const analytics = analyticsQuery.data;

  const valuationChart = useMemo(
    () =>
      (analytics?.valuation.byCategory ?? []).slice(0, 6).map((row) => ({
        name: row.categoryName,
        value: row.stockValue,
      })),
    [analytics],
  );

  const refreshing = summaryQuery.isFetching || analyticsQuery.isFetching;

  function goCatalog(stock?: string) {
    navigate(stock ? `/inventory/catalog?stock=${encodeURIComponent(stock)}` : '/inventory/catalog');
  }

  if (!canView) {
    return (
      <div className={styles.page}>
        <AuthAlert variant="error">{t('inventory.accessDenied')}</AuthAlert>
      </div>
    );
  }

  const loading = (summaryQuery.isLoading || analyticsQuery.isLoading) && !summary && !analytics;

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>{t('inventory.dashboard.title')}</h1>
          <p className={styles.subtitle}>{t('inventory.dashboard.subtitle')}</p>
        </div>
        <div className={styles.headerActions}>
          <AuthButton
            variant="secondary"
            onClick={() => {
              void summaryQuery.refetch();
              void analyticsQuery.refetch();
            }}
            disabled={refreshing}
          >
            <RefreshCw size={16} aria-hidden className={refreshing ? styles.spin : undefined} />
            {t('inventory.refresh')}
          </AuthButton>
          {canReceiveScan && (
            <AuthButton variant="secondary" onClick={() => navigate('/inventory/catalog?scan=1&receive=1')}>
              {t('inventory.barcode.receiveScanLink')}
            </AuthButton>
          )}
          {canCreate && isInventoryStaffWorkspace(workspaceMode) && (
            <AuthButton onClick={() => navigate('/inventory/catalog')}>{t('inventory.addItem')}</AuthButton>
          )}
        </div>
      </header>

      {workspaceMode === 'management' && (
        <p className={styles.workspaceBanner}>{t('inventory.dashboard.managementBanner')}</p>
      )}
      {workspaceMode === 'operations' && (
        <p className={styles.workspaceBanner}>{t('inventory.dashboard.operationsBanner')}</p>
      )}

      {!online && <AuthAlert variant="warning">{t('auth.offline')}</AuthAlert>}
      {(summaryQuery.isError || analyticsQuery.isError) && online && (
        <AuthAlert variant="error">{t('inventory.loadError')}</AuthAlert>
      )}

      {loading ? (
        <div className={styles.skeleton} aria-busy="true" aria-label={t('inventory.dashboard.loading')} />
      ) : (
        <>
          {summary && (
            <section aria-labelledby="inv-dash-kpis">
              <h2 id="inv-dash-kpis" className="sr-only">
                {t('inventory.dashboard.kpis')}
              </h2>
              <div className={styles.primaryKpis}>
                <article className={styles.kpi}>
                  <span>{t('inventory.metrics.stockValue')}</span>
                  <strong>{formatCurrency(summary.stockValue, locale)}</strong>
                </article>
                <article className={styles.kpi}>
                  <span id="kpi-total-items">{t('inventory.metrics.totalItems')}</span>
                  <button
                    type="button"
                    className={styles.kpiBtn}
                    aria-labelledby="kpi-total-items"
                    onClick={() => goCatalog()}
                  >
                    <strong>{summary.totalItems}</strong>
                  </button>
                </article>
                <article className={`${styles.kpi} ${summary.lowStockCount > 0 ? styles.kpiWarn : ''}`}>
                  <span id="kpi-low-stock">{t('inventory.metrics.lowStock')}</span>
                  <button
                    type="button"
                    className={styles.kpiBtn}
                    aria-labelledby="kpi-low-stock"
                    onClick={() => goCatalog('low')}
                  >
                    <strong>{summary.lowStockCount}</strong>
                  </button>
                </article>
                <article className={`${styles.kpi} ${summary.outOfStockCount > 0 ? styles.kpiDanger : ''}`}>
                  <span id="kpi-out-stock">{t('inventory.metrics.outOfStock')}</span>
                  <button
                    type="button"
                    className={styles.kpiBtn}
                    aria-labelledby="kpi-out-stock"
                    onClick={() => goCatalog('out')}
                  >
                    <strong>{summary.outOfStockCount}</strong>
                  </button>
                </article>
                <article className={`${styles.kpi} ${summary.expiringSoonCount > 0 ? styles.kpiWarn : ''}`}>
                  <span id="kpi-expiring">{t('inventory.metrics.expiringSoon')}</span>
                  <button
                    type="button"
                    className={styles.kpiBtn}
                    aria-labelledby="kpi-expiring"
                    onClick={() => navigate('/inventory/expiry')}
                  >
                    <strong>{summary.expiringSoonCount}</strong>
                  </button>
                </article>
                <article className={`${styles.kpi} ${summary.expiredCount > 0 ? styles.kpiDanger : ''}`}>
                  <span id="kpi-expired">{t('inventory.metrics.expired')}</span>
                  <button
                    type="button"
                    className={styles.kpiBtn}
                    aria-labelledby="kpi-expired"
                    onClick={() => navigate('/inventory/expiry')}
                  >
                    <strong>{summary.expiredCount}</strong>
                  </button>
                </article>
              </div>
            </section>
          )}

          {analytics && (
            <section className={styles.primaryKpis} aria-label={t('inventory.dashboard.periodKpis')}>
              <article className={styles.kpi}>
                <span>{t('inventory.dashboard.consumed30d')}</span>
                <strong>{analytics.consumption.totalQuantity}</strong>
              </article>
              <article className={styles.kpi}>
                <span>{t('inventory.dashboard.procurementOrdered')}</span>
                <strong>{formatCurrency(analytics.procurement.orderedValue, locale)}</strong>
              </article>
              <article className={styles.kpi}>
                <span>{t('inventory.dashboard.procurementReceived')}</span>
                <strong>{formatCurrency(analytics.procurement.receivedValue, locale)}</strong>
              </article>
              <article className={styles.kpi}>
                <span>{t('inventory.metrics.activeSuppliers')}</span>
                <button type="button" className={styles.kpiBtn} onClick={() => navigate('/inventory/suppliers')}>
                  <strong>{summary?.activeSupplierCount ?? analytics.procurement.activeSupplierCount}</strong>
                </button>
              </article>
            </section>
          )}

          <section aria-labelledby="inv-dash-nav">
            <h2 id="inv-dash-nav" className={styles.sectionTitle}>
              {t('inventory.dashboard.quickNav')}
            </h2>
            <InventoryQuickNav mode={workspaceMode} />
          </section>

          {summary && isInventoryStaffWorkspace(workspaceMode) && (
            <section className={styles.panel} aria-labelledby="inv-dash-ops">
              <h2 id="inv-dash-ops" className={styles.sectionTitle}>
                {t('inventory.dashboard.operations')}
              </h2>
              <div className={styles.operationsGrid}>
                {[
                  {
                    label: t('inventory.metrics.pendingPoApproval'),
                    value: summary.pendingPoApprovalCount,
                    warn: summary.pendingPoApprovalCount > 0,
                    onClick: () => navigate('/inventory/procurement?status=PENDING_APPROVAL'),
                  },
                  {
                    label: t('inventory.metrics.openPo'),
                    value: summary.openPoCount,
                    warn: summary.openPoCount > 0,
                    onClick: () => navigate('/inventory/procurement?status=OPEN'),
                  },
                  {
                    label: t('inventory.metrics.openTransfers'),
                    value: summary.openTransferCount,
                    warn: summary.openTransferCount > 0,
                    onClick: () => navigate('/inventory/transfers'),
                  },
                  {
                    label: t('inventory.metrics.pendingCountApproval'),
                    value: summary.pendingCountApprovalCount,
                    warn: summary.pendingCountApprovalCount > 0,
                    onClick: () => navigate('/inventory/stock-counts?status=PENDING_APPROVAL'),
                  },
                  {
                    label: t('inventory.metrics.openCountSessions'),
                    value: summary.openCountSessions,
                    warn: summary.openCountSessions > 0,
                    onClick: () => navigate('/inventory/stock-counts?status=IN_PROGRESS'),
                  },
                  {
                    label: t('inventory.metrics.pendingRequestApproval'),
                    value: summary.pendingRequestApprovalCount ?? 0,
                    warn: (summary.pendingRequestApprovalCount ?? 0) > 0,
                    onClick: () => navigate('/inventory/stock-requests?status=SUBMITTED'),
                  },
                  {
                    label: t('inventory.metrics.openRequestFulfillment'),
                    value: summary.openRequestFulfillmentCount ?? 0,
                    warn: (summary.openRequestFulfillmentCount ?? 0) > 0,
                    onClick: () => navigate('/inventory/stock-requests?status=APPROVED'),
                  },
                  {
                    label: t('inventory.metrics.activeWarehouses'),
                    value: summary.activeWarehouseCount,
                    warn: false,
                    onClick: () => navigate('/inventory/warehouses'),
                  },
                ].map((row, index) => {
                  const labelId = `inv-op-kpi-${index}`;
                  return (
                  <article key={row.label} className={`${styles.opCard} ${row.warn ? styles.opWarn : ''}`}>
                    <span id={labelId}>{row.label}</span>
                    <button type="button" className={styles.opBtn} aria-labelledby={labelId} onClick={row.onClick}>
                      <strong>{row.value}</strong>
                    </button>
                  </article>
                  );
                })}
              </div>
            </section>
          )}

          <div className={styles.grid}>
            {valuationChart.length > 0 && (
              <section className={styles.panel} aria-labelledby="inv-dash-valuation">
                <div className={styles.panelHeader}>
                  <h2 id="inv-dash-valuation" className={styles.sectionTitle}>
                    {t('inventory.dashboard.valuationByCategory')}
                  </h2>
                  <Link to="/inventory/reports" className={styles.panelLink}>
                    {t('inventory.dashboard.viewReports')}
                  </Link>
                </div>
                <div className={styles.chartWrap} role="img" aria-label={t('inventory.dashboard.valuationByCategory')}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={valuationChart} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                      <XAxis dataKey="name" tick={{ fontSize: 11 }} interval={0} angle={-20} textAnchor="end" height={56} />
                      <YAxis tick={{ fontSize: 11 }} width={48} />
                      <Tooltip formatter={(value) => formatCurrency(Number(value ?? 0), locale)} />
                      <Bar dataKey="value" fill="var(--color-primary-500)" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <ul className="sr-only">
                  {valuationChart.map((row) => (
                    <li key={row.name}>
                      {formatMessage(t('inventory.a11y.chartCategoryValue'), {
                        category: row.name,
                        value: formatCurrency(row.value, locale),
                      })}
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {analytics && (
              <section className={styles.panel} aria-labelledby="inv-dash-po">
                <div className={styles.panelHeader}>
                  <h2 id="inv-dash-po" className={styles.sectionTitle}>
                    {t('inventory.dashboard.poOverview')}
                  </h2>
                  <Link to="/inventory/procurement" className={styles.panelLink}>
                    {t('inventory.procurement.link')}
                  </Link>
                </div>
                {analytics.procurement.byStatus.length === 0 ? (
                  <p className={styles.emptyHint}>{t('inventory.dashboard.noPoData')}</p>
                ) : (
                  <div className={styles.tableWrap}>
                    <table className={styles.table}>
                      <caption className="sr-only">{t('inventory.a11y.poTableCaption')}</caption>
                      <thead>
                        <tr>
                          <th scope="col">{t('inventory.procurement.statusLabel')}</th>
                          <th scope="col">{t('inventory.dashboard.count')}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {analytics.procurement.byStatus.map((row) => (
                          <tr key={row.status}>
                            <td>
                              {t(`inventory.procurement.status.${row.status}` as 'inventory.procurement.status.DRAFT')}
                            </td>
                            <td>{row.count}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>
            )}

            {analytics && (
              <section className={styles.panel} aria-labelledby="inv-dash-suppliers">
                <div className={styles.panelHeader}>
                  <h2 id="inv-dash-suppliers" className={styles.sectionTitle}>
                    {t('inventory.dashboard.supplierOverview')}
                  </h2>
                  <Link to="/inventory/suppliers" className={styles.panelLink}>
                    {t('inventory.suppliers.link')}
                  </Link>
                </div>
                {analytics.procurement.topSuppliers.length === 0 ? (
                  <p className={styles.emptyHint}>{t('inventory.dashboard.noSupplierOrders')}</p>
                ) : (
                  <div className={styles.tableWrap}>
                    <table className={styles.table}>
                      <caption className="sr-only">{t('inventory.a11y.supplierTableCaption')}</caption>
                      <thead>
                        <tr>
                          <th scope="col">{t('inventory.suppliers.tableCaption')}</th>
                          <th scope="col">{t('inventory.dashboard.orders30d')}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {analytics.procurement.topSuppliers.map((row) => (
                          <tr key={row.supplierId}>
                            <td>{row.supplierName}</td>
                            <td>{row.orderCount}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>
            )}
          </div>

          {summary && (
            <section className={styles.panel} aria-labelledby="inv-dash-movements">
              <div className={styles.panelHeader}>
                <h2 id="inv-dash-movements" className={styles.sectionTitle}>
                  {t('inventory.movements.title')}
                </h2>
                <Link to="/inventory/catalog" className={styles.panelLink}>
                  {t('inventory.dashboard.viewCatalog')}
                </Link>
              </div>
              <StockMovementTimeline movements={summary.recentMovements} showItem loading={summaryQuery.isLoading} />
            </section>
          )}

          {analytics && (
            <p className={styles.emptyHint}>
              {formatMessage(t('inventory.dashboard.generatedAt'), {
                date: new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }).format(
                  new Date(analytics.generatedAt),
                ),
              })}
            </p>
          )}
        </>
      )}
    </div>
  );
}
