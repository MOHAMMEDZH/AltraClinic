import { useI18n } from '@booking/i18n/react';
import type { InventorySummary } from '../types/inventory.types';
import { formatCurrency } from '../config/inventory-config';
import type { InventoryStockFilter } from '../types/inventory.types';
import styles from './InventoryMetrics.module.css';

interface InventoryMetricsProps {
  summary: InventorySummary | undefined;
  loading?: boolean;
  onFilter?: (stock: InventoryStockFilter) => void;
  onSuppliersClick?: () => void;
  onProcurementClick?: (status?: string) => void;
  onStockCountsClick?: (status?: string) => void;
  onStockRequestsClick?: (status?: string) => void;
}

export function InventoryMetrics({ summary, loading, onFilter, onSuppliersClick, onProcurementClick, onStockCountsClick, onStockRequestsClick }: InventoryMetricsProps) {
  const { t, locale } = useI18n();

  if (loading && !summary) {
    return <div className={styles.skeleton} aria-hidden />;
  }
  if (!summary) return null;

  const cards: Array<{
    labelKey: keyof typeof summary | 'stockValue';
    value: string;
    warn: boolean;
    filter?: InventoryStockFilter;
    poFilter?: string;
    countFilter?: string;
    requestFilter?: string;
  }> = [
    { labelKey: 'totalItems', value: String(summary.totalItems), warn: false },
    { labelKey: 'stockValue', value: formatCurrency(summary.stockValue, locale), warn: false },
    { labelKey: 'lowStockCount', value: String(summary.lowStockCount), warn: summary.lowStockCount > 0, filter: 'low' },
    { labelKey: 'outOfStockCount', value: String(summary.outOfStockCount), warn: summary.outOfStockCount > 0, filter: 'out' },
    { labelKey: 'expiringSoonCount', value: String(summary.expiringSoonCount), warn: summary.expiringSoonCount > 0, filter: 'expiring' },
    { labelKey: 'expiredCount', value: String(summary.expiredCount), warn: summary.expiredCount > 0, filter: 'expired' },
    { labelKey: 'activeSupplierCount', value: String(summary.activeSupplierCount ?? 0), warn: false, filter: undefined },
    { labelKey: 'pendingPoApprovalCount', value: String(summary.pendingPoApprovalCount ?? 0), warn: (summary.pendingPoApprovalCount ?? 0) > 0, filter: undefined, poFilter: 'PENDING_APPROVAL' },
    { labelKey: 'openPoCount', value: String(summary.openPoCount ?? 0), warn: (summary.openPoCount ?? 0) > 0, filter: undefined, poFilter: 'OPEN' },
    { labelKey: 'pendingCountApprovalCount', value: String(summary.pendingCountApprovalCount ?? 0), warn: (summary.pendingCountApprovalCount ?? 0) > 0, filter: undefined, countFilter: 'PENDING_APPROVAL' },
    { labelKey: 'openCountSessions', value: String(summary.openCountSessions ?? 0), warn: (summary.openCountSessions ?? 0) > 0, filter: undefined, countFilter: 'IN_PROGRESS' },
    { labelKey: 'pendingRequestApprovalCount', value: String(summary.pendingRequestApprovalCount ?? 0), warn: (summary.pendingRequestApprovalCount ?? 0) > 0, filter: undefined, requestFilter: 'SUBMITTED' },
    { labelKey: 'openRequestFulfillmentCount', value: String(summary.openRequestFulfillmentCount ?? 0), warn: (summary.openRequestFulfillmentCount ?? 0) > 0, filter: undefined, requestFilter: 'APPROVED' },
  ];

  const labelMap: Record<string, string> = {
    totalItems: t('inventory.metrics.totalItems'),
    stockValue: t('inventory.metrics.stockValue'),
    lowStockCount: t('inventory.metrics.lowStock'),
    outOfStockCount: t('inventory.metrics.outOfStock'),
    expiringSoonCount: t('inventory.metrics.expiringSoon'),
    expiredCount: t('inventory.metrics.expired'),
    activeSupplierCount: t('inventory.metrics.activeSuppliers'),
    pendingPoApprovalCount: t('inventory.metrics.pendingPoApproval'),
    openPoCount: t('inventory.metrics.openPo'),
    pendingCountApprovalCount: t('inventory.metrics.pendingCountApproval'),
    openCountSessions: t('inventory.metrics.openCountSessions'),
    pendingRequestApprovalCount: t('inventory.metrics.pendingRequestApproval'),
    openRequestFulfillmentCount: t('inventory.metrics.openRequestFulfillment'),
  };

  return (
    <div className={styles.grid}>
      {cards.map((card) => (
        <article key={card.labelKey} className={`${styles.card} ${card.warn ? styles.warn : ''}`}>
          <span className={styles.label}>{labelMap[card.labelKey]}</span>
          {card.filter && onFilter ? (
            <button type="button" className={styles.valueBtn} onClick={() => onFilter(card.filter!)}>
              <strong>{card.value}</strong>
            </button>
          ) : card.labelKey === 'activeSupplierCount' && onSuppliersClick ? (
            <button type="button" className={styles.valueBtn} onClick={onSuppliersClick}>
              <strong>{card.value}</strong>
            </button>
          ) : (card.labelKey === 'pendingPoApprovalCount' || card.labelKey === 'openPoCount') && onProcurementClick ? (
            <button type="button" className={styles.valueBtn} onClick={() => onProcurementClick(card.poFilter)}>
              <strong>{card.value}</strong>
            </button>
          ) : (card.labelKey === 'pendingCountApprovalCount' || card.labelKey === 'openCountSessions') && onStockCountsClick ? (
            <button type="button" className={styles.valueBtn} onClick={() => onStockCountsClick(card.countFilter)}>
              <strong>{card.value}</strong>
            </button>
          ) : (card.labelKey === 'pendingRequestApprovalCount' || card.labelKey === 'openRequestFulfillmentCount') && onStockRequestsClick ? (
            <button type="button" className={styles.valueBtn} onClick={() => onStockRequestsClick(card.requestFilter)}>
              <strong>{card.value}</strong>
            </button>
          ) : (
            <strong className={styles.value}>{card.value}</strong>
          )}
        </article>
      ))}
    </div>
  );
}
