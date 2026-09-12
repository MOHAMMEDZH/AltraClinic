import { useCallback, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, RefreshCw, Download } from 'lucide-react';
import {
  Area,
  AreaChart,
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
import { AuthAlert } from '@/features/auth/components/AuthAlert';
import { AuthButton } from '@/features/auth/components/AuthButton';
import { canViewInventory, formatCurrency, movementTypeLabelKey, canExportInventory } from './config/inventory-config';
import { useInventoryAnalytics, useExportInventoryAnalytics, useInventoryUsageOwnerReport } from './hooks/useInventory';
import { downloadInventoryBlob } from './utils/inventory-export';
import styles from './InventoryReportsPage.module.css';

const PERIOD_OPTIONS = [7, 30, 90] as const;

export function InventoryReportsPage() {
  const { t, locale, direction } = useI18n();
  const { user } = useAuth();
  const roles = user?.roles ?? [];
  const perm = useCallback((action: string) => hasPermission(roles, 'api.inventory', action as never), [roles]);

  const [days, setDays] = useState<(typeof PERIOD_OPTIONS)[number]>(30);
  const canView = canViewInventory(perm);
  const canExport = canExportInventory(perm);
  const analyticsQuery = useInventoryAnalytics(days, canView);
  const ownerReportQuery = useInventoryUsageOwnerReport(days, canExport);
  const exportMutation = useExportInventoryAnalytics();
  const data = analyticsQuery.data;

  const consumptionChart = useMemo(
    () =>
      (data?.consumption.byDay ?? []).map((row) => ({
        label: row.date.slice(5),
        quantity: row.quantity,
      })),
    [data],
  );

  const valuationChart = useMemo(
    () =>
      (data?.valuation.byCategory ?? []).slice(0, 8).map((row) => ({
        name: row.categoryName,
        value: row.stockValue,
      })),
    [data],
  );

  const movementChart = useMemo(
    () =>
      (data?.movements.byType ?? []).map((row) => ({
        name: t(movementTypeLabelKey(row.movementType as never)),
        count: row.count,
      })),
    [data, t],
  );

  const consumptionSummary = useMemo(
    () => consumptionChart.map((row) => `${row.label}: ${row.quantity}`).join('; '),
    [consumptionChart],
  );

  if (!canView) {
    return (
      <div className={styles.page}>
        <AuthAlert variant="error">{t('inventory.accessDenied')}</AuthAlert>
      </div>
    );
  }

  return (
    <div className={styles.page} id="inventory-reports-region" data-testid="inventory-reports-region">
      <Link to="/inventory" className={styles.backLink}>
        <ArrowLeft size={16} aria-hidden style={direction === 'rtl' ? { transform: 'scaleX(-1)' } : undefined} />
        {t('inventory.reports.back')}
      </Link>

      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>{t('inventory.reports.title')}</h1>
          <p className={styles.subtitle}>{t('inventory.reports.subtitle')}</p>
        </div>
        <AuthButton
          variant="secondary"
          onClick={() => void analyticsQuery.refetch()}
          disabled={analyticsQuery.isFetching}
        >
          <RefreshCw size={16} aria-hidden className={analyticsQuery.isFetching ? styles.spin : undefined} />
          {t('inventory.refresh')}
        </AuthButton>
        {canExport && (
          <AuthButton
            variant="secondary"
            disabled={exportMutation.isPending || !analyticsQuery.data}
            onClick={() => {
              void exportMutation.mutateAsync(days).then(({ blob, filename }) => downloadInventoryBlob(filename, blob));
            }}
          >
            <Download size={16} aria-hidden />
            {t('inventory.reports.exportCsv')}
          </AuthButton>
        )}
      </header>

      <div className={styles.toolbar}>
        <span className={styles.periodLabel}>{t('inventory.reports.period')}</span>
        <div className={styles.filters} role="group" aria-label={t('inventory.reports.period')}>
          {PERIOD_OPTIONS.map((option) => (
            <button
              key={option}
              type="button"
              className={days === option ? styles.filterActive : styles.filterBtn}
              onClick={() => setDays(option)}
            >
              {formatMessage(t('inventory.reports.periodDays'), { days: option })}
            </button>
          ))}
        </div>
        {data && (
          <span className={styles.meta}>
            {formatMessage(t('inventory.reports.generatedAt'), {
              date: new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }).format(
                new Date(data.generatedAt),
              ),
            })}
          </span>
        )}
      </div>

      {analyticsQuery.isError && <AuthAlert variant="error">{t('inventory.loadError')}</AuthAlert>}

      {analyticsQuery.isLoading && !data ? (
        <div className={styles.skeleton} aria-busy="true" />
      ) : data ? (
        <>
          <div className={styles.kpis}>
            <article className={styles.kpi}>
              <span>{t('inventory.reports.stockValue')}</span>
              <strong>{formatCurrency(data.valuation.totalStockValue, locale)}</strong>
            </article>
            <article className={styles.kpi}>
              <span>{t('inventory.reports.itemCount')}</span>
              <strong>{data.valuation.itemCount}</strong>
            </article>
            <article className={`${styles.kpi} ${styles.kpiWarn}`}>
              <span>{t('inventory.filters.low')}</span>
              <strong>{data.stockHealth.lowStock}</strong>
            </article>
            <article className={`${styles.kpi} ${styles.kpiDanger}`}>
              <span>{t('inventory.filters.out')}</span>
              <strong>{data.stockHealth.outOfStock}</strong>
            </article>
            <article className={styles.kpi}>
              <span>{t('inventory.reports.consumedQty')}</span>
              <strong>{data.consumption.totalQuantity}</strong>
            </article>
            <article className={styles.kpi}>
              <span>{t('inventory.reports.consumptionEvents')}</span>
              <strong>{data.consumption.eventCount}</strong>
            </article>
            <article className={styles.kpi}>
              <span>{t('inventory.reports.orderedValue')}</span>
              <strong>{formatCurrency(data.procurement.orderedValue, locale)}</strong>
            </article>
            <article className={styles.kpi}>
              <span>{t('inventory.reports.receivedValue')}</span>
              <strong>{formatCurrency(data.procurement.receivedValue, locale)}</strong>
            </article>
          </div>

          <div className={styles.grid}>
            {consumptionChart.length > 0 && (
              <section className={styles.panel} aria-labelledby="inv-consumption-trend">
                <h2 id="inv-consumption-trend" className={styles.panelTitle}>
                  {t('inventory.reports.consumptionTrend')}
                </h2>
                <p className={styles.srOnly}>{consumptionSummary}</p>
                <div className={styles.chartWrap}>
                  <ResponsiveContainer width="100%" height={240}>
                    <AreaChart data={consumptionChart} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                      <CartesianGrid stroke="var(--color-border)" strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                      <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                      <Tooltip />
                      <Area type="monotone" dataKey="quantity" stroke="#2563eb" fill="#2563eb33" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </section>
            )}

            {valuationChart.length > 0 && (
              <section className={styles.panel} aria-labelledby="inv-valuation-cat">
                <h2 id="inv-valuation-cat" className={styles.panelTitle}>
                  {t('inventory.reports.valuationByCategory')}
                </h2>
                <div className={styles.chartWrap}>
                  <ResponsiveContainer width="100%" height={240}>
                    <BarChart data={valuationChart} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                      <XAxis dataKey="name" tick={{ fontSize: 10 }} interval={0} angle={-20} textAnchor="end" height={60} />
                      <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => formatCurrency(Number(v), locale)} width={72} />
                      <Tooltip formatter={(value) => formatCurrency(Number(value ?? 0), locale)} />
                      <Bar dataKey="value" fill="#059669" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </section>
            )}

            {movementChart.length > 0 && (
              <section className={styles.panel} aria-labelledby="inv-movements-type">
                <h2 id="inv-movements-type" className={styles.panelTitle}>
                  {t('inventory.reports.movementsByType')}
                </h2>
                <div className={styles.chartWrap}>
                  <ResponsiveContainer width="100%" height={240}>
                    <BarChart data={movementChart} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                      <XAxis dataKey="name" tick={{ fontSize: 10 }} interval={0} angle={-15} textAnchor="end" height={56} />
                      <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                      <Tooltip />
                      <Bar dataKey="count" fill="#7c3aed" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </section>
            )}

            {data.consumption.topItems.length > 0 && (
              <section className={styles.panel} aria-labelledby="inv-top-items">
                <h2 id="inv-top-items" className={styles.panelTitle}>
                  {t('inventory.reports.topConsumedItems')}
                </h2>
                <table className={styles.table}>
                  <caption className={styles.srOnly}>{t('inventory.reports.topConsumedItems')}</caption>
                  <thead>
                    <tr>
                      <th scope="col">{t('inventory.table.sku')}</th>
                      <th scope="col">{t('inventory.table.name')}</th>
                      <th scope="col">{t('inventory.reports.quantity')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.consumption.topItems.map((row) => (
                      <tr key={row.itemId}>
                        <td>{row.sku}</td>
                        <td>{row.name}</td>
                        <td>
                          {row.quantity} {row.unit}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </section>
            )}

            {data.consumption.byProcedure.length > 0 && (
              <section className={styles.panel} aria-labelledby="inv-by-procedure">
                <h2 id="inv-by-procedure" className={styles.panelTitle}>
                  {t('inventory.reports.consumptionByProcedure')}
                </h2>
                <table className={styles.table}>
                  <caption className={styles.srOnly}>{t('inventory.reports.consumptionByProcedure')}</caption>
                  <thead>
                    <tr>
                      <th scope="col">{t('inventory.reports.procedureCode')}</th>
                      <th scope="col">{t('inventory.reports.quantity')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.consumption.byProcedure.map((row) => (
                      <tr key={row.procedureCode}>
                        <td>{row.procedureCode}</td>
                        <td>{row.quantity}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </section>
            )}

            {data.procurement.byStatus.length > 0 && (
              <section className={styles.panel} aria-labelledby="inv-po-status">
                <h2 id="inv-po-status" className={styles.panelTitle}>
                  {t('inventory.reports.poByStatus')}
                </h2>
                <table className={styles.table}>
                  <caption className={styles.srOnly}>{t('inventory.reports.poByStatus')}</caption>
                  <thead>
                    <tr>
                      <th scope="col">{t('inventory.procurement.statusLabel')}</th>
                      <th scope="col">{t('inventory.reports.count')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.procurement.byStatus.map((row) => (
                      <tr key={row.status}>
                        <td>
                          {t(`inventory.procurement.status.${row.status}` as 'inventory.procurement.status.DRAFT')}
                        </td>
                        <td>{row.count}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </section>
            )}

            {data.procurement.topSuppliers.length > 0 && (
              <section className={styles.panel} aria-labelledby="inv-top-suppliers">
                <h2 id="inv-top-suppliers" className={styles.panelTitle}>
                  {t('inventory.reports.topSuppliers')}
                </h2>
                <table className={styles.table}>
                  <caption className={styles.srOnly}>{t('inventory.reports.topSuppliers')}</caption>
                  <thead>
                    <tr>
                      <th scope="col">{t('inventory.suppliers.name')}</th>
                      <th scope="col">{t('inventory.reports.orderCount')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.procurement.topSuppliers.map((row) => (
                      <tr key={row.supplierId}>
                        <td>{row.supplierName}</td>
                        <td>{row.orderCount}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </section>
            )}
          </div>
        </>
      ) : null}

      {canExport ? (
        <section
          className={styles.panel}
          aria-labelledby="inv-accountability-title"
          data-testid="inventory-accountability-panel"
        >
          <h2 id="inv-accountability-title" className={styles.panelTitle}>
            {t('inventory.reports.accountabilityTitle')}
          </h2>
          <p className={styles.subtitle}>{t('inventory.reports.accountabilitySubtitle')}</p>
          {ownerReportQuery.isError && <AuthAlert variant="error">{t('inventory.loadError')}</AuthAlert>}
          {ownerReportQuery.isLoading && !ownerReportQuery.data ? (
            <div className={styles.skeleton} aria-busy="true" />
          ) : ownerReportQuery.data ? (
            <>
              <div className={styles.kpis}>
                <article className={styles.kpi}>
                  <span>{t('inventory.reports.netQuantity')}</span>
                  <strong>{ownerReportQuery.data.aggregates.netQuantityTotal}</strong>
                </article>
                <article className={styles.kpi}>
                  <span>{t('inventory.reports.count')}</span>
                  <strong>{ownerReportQuery.data.total}</strong>
                </article>
              </div>
              {ownerReportQuery.data.rows.length === 0 ? (
                <p className={styles.meta}>{t('inventory.reports.accountabilityEmpty')}</p>
              ) : (
                <div className={styles.tableScroll}>
                  <table className={styles.table}>
                    <thead>
                      <tr>
                        <th>{t('inventory.reports.occurredAt')}</th>
                        <th>{t('inventory.reports.usageType')}</th>
                        <th>{t('inventory.reports.itemId')}</th>
                        <th>{t('inventory.reports.usedBy')}</th>
                        <th>{t('inventory.reports.netQuantity')}</th>
                        <th>{t('inventory.reports.status')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {ownerReportQuery.data.rows.map((row) => (
                        <tr key={row.id}>
                          <td>
                            {new Intl.DateTimeFormat(locale, {
                              dateStyle: 'medium',
                              timeStyle: 'short',
                            }).format(new Date(row.occurredAt))}
                          </td>
                          <td>{row.usageType}</td>
                          <td>
                            <code
                              className={styles.idCell}
                              dir="ltr"
                              title={row.inventoryItemId}
                              aria-label={`${t('inventory.reports.itemId')}: ${row.inventoryItemId}`}
                            >
                              {row.inventoryItemId.slice(0, 8)}…
                            </code>
                          </td>
                          <td>
                            {row.usedByUserId ? (
                              <code
                                className={styles.idCell}
                                dir="ltr"
                                title={row.usedByUserId}
                                aria-label={`${t('inventory.reports.usedBy')}: ${row.usedByUserId}`}
                              >
                                {row.usedByUserId.slice(0, 8)}…
                              </code>
                            ) : (
                              '—'
                            )}
                          </td>
                          <td>
                            {row.signedQuantity} {row.unit}
                          </td>
                          <td>{row.status}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}
