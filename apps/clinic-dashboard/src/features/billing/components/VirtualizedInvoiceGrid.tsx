import { memo, useCallback, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { Link } from 'react-router-dom';
import { FixedSizeList, type ListChildComponentProps } from 'react-window';
import { useI18n } from '@booking/i18n/react';
import type { Invoice } from '../types/billing.types';
import {
  BILLING_GRID_MAX_HEIGHT,
  BILLING_ROW_HEIGHT,
  billingGridColumns,
  formatBillingCurrency,
  formatBillingDate,
} from '../config/billing-config';
import { isGridNavKey, moveGridRowIndex } from '@/features/inventory/utils/grid-keyboard-nav';
import styles from './VirtualizedInvoiceGrid.module.css';

interface VirtualizedInvoiceGridProps {
  invoices: Invoice[];
  loading?: boolean;
  selectable?: boolean;
  selectedIds?: ReadonlySet<string>;
  onToggle?: (invoiceId: string) => void;
}

interface RowData {
  invoices: Invoice[];
  locale: string;
  t: (key: string) => string;
  focusedIndex: number;
  onRowFocus: (index: number) => void;
  onRowKeyDown: (index: number, event: KeyboardEvent<HTMLDivElement>) => void;
  registerRowRef: (index: number, el: HTMLDivElement | null) => void;
  selectable: boolean;
  selectedIds: ReadonlySet<string>;
  onToggle?: (invoiceId: string) => void;
  gridColumns: string;
}

function statusClass(status: string): string {
  if (status === 'overdue') return styles.badgeDanger;
  if (status === 'paid') return styles.badgeSuccess;
  if (status === 'partial_paid') return styles.badgeWarn;
  return styles.badge;
}

const InvoiceRow = memo(function InvoiceRow({
  index,
  style,
  data,
}: ListChildComponentProps<RowData>) {
  const inv = data.invoices[index];
  if (!inv) return null;
  const focused = data.focusedIndex === index;

  return (
    <div
      style={{ ...style, gridTemplateColumns: data.gridColumns }}
      className={`${styles.row} ${focused ? styles.rowFocused : ''}`}
      role="row"
      tabIndex={focused ? 0 : -1}
      ref={(el) => data.registerRowRef(index, el)}
      onFocus={() => data.onRowFocus(index)}
      onKeyDown={(e) => data.onRowKeyDown(index, e)}
    >
      {data.selectable && (
        <span role="cell" className={styles.cell}>
          <input
            type="checkbox"
            checked={data.selectedIds.has(inv.invoiceId)}
            aria-label={inv.invoiceNumber}
            onChange={() => data.onToggle?.(inv.invoiceId)}
          />
        </span>
      )}
      <span role="cell" className={styles.cell}>
        <Link to={`/billing/invoices/${inv.invoiceId}`} className={styles.invoiceLink}>
          {inv.invoiceNumber}
        </Link>
      </span>
      <span role="cell" className={styles.cell}>
        <span className={statusClass(inv.status)}>
          {data.t(`billing.status.${inv.status}` as 'billing.status.draft')}
        </span>
      </span>
      <span role="cell" className={styles.cellNum}>
        {formatBillingCurrency(inv.amountTotal, data.locale, inv.currency)}
      </span>
      <span role="cell" className={styles.cellNum}>
        {formatBillingCurrency(inv.amountPaid, data.locale, inv.currency)}
      </span>
      <span role="cell" className={styles.cellNum}>
        {formatBillingCurrency(inv.amountDue, data.locale, inv.currency)}
      </span>
      <span role="cell" className={styles.cell}>
        {formatBillingDate(inv.invoiceDate, data.locale)}
      </span>
      <span role="cell" className={styles.cellAction}>
        <Link to={`/billing/invoices/${inv.invoiceId}`} className={styles.viewLink}>
          {data.t('billing.invoices.view')}
        </Link>
      </span>
    </div>
  );
});

export function VirtualizedInvoiceGrid({ invoices, loading, selectable = false, selectedIds, onToggle }: VirtualizedInvoiceGridProps) {
  const { t, locale } = useI18n();
  const [focusedIndex, setFocusedIndex] = useState(0);
  const rowRefs = useRef<Map<number, HTMLDivElement>>(new Map());
  const listHeight = Math.min(BILLING_GRID_MAX_HEIGHT, Math.max(BILLING_ROW_HEIGHT * 3, invoices.length * BILLING_ROW_HEIGHT));
  const gridColumns = billingGridColumns(selectable);

  const registerRowRef = useCallback((index: number, el: HTMLDivElement | null) => {
    if (el) rowRefs.current.set(index, el);
    else rowRefs.current.delete(index);
  }, []);

  const onRowFocus = useCallback((index: number) => setFocusedIndex(index), []);

  const onRowKeyDown = useCallback(
    (index: number, event: KeyboardEvent<HTMLDivElement>) => {
      if (!isGridNavKey(event.key)) return;
      event.preventDefault();
      const next = moveGridRowIndex(index, event.key, invoices.length);
      if (next == null || next === index) return;
      setFocusedIndex(next);
      rowRefs.current.get(next)?.focus();
    },
    [invoices.length],
  );

  const itemData = useMemo<RowData>(
    () => ({
      invoices,
      locale,
      t,
      focusedIndex,
      onRowFocus,
      onRowKeyDown,
      registerRowRef,
      selectable,
      selectedIds: selectedIds ?? new Set(),
      onToggle,
      gridColumns,
    }),
    [invoices, locale, t, focusedIndex, onRowFocus, onRowKeyDown, registerRowRef, selectable, selectedIds, onToggle, gridColumns],
  );

  if (loading && invoices.length === 0) {
    return <div className={styles.skeleton} aria-busy="true" />;
  }

  return (
    <div className={styles.gridWrap} role="grid" aria-rowcount={invoices.length} aria-label={t('billing.invoices.caption')}>
      <div className={styles.headerRow} role="row" style={{ gridTemplateColumns: gridColumns }}>
        {selectable && <span role="columnheader">✓</span>}
        <span role="columnheader">{t('billing.invoices.number')}</span>
        <span role="columnheader">{t('billing.invoices.status')}</span>
        <span role="columnheader">{t('billing.invoices.total')}</span>
        <span role="columnheader">{t('billing.invoices.paid')}</span>
        <span role="columnheader">{t('billing.invoices.due')}</span>
        <span role="columnheader">{t('billing.invoices.date')}</span>
        <span role="columnheader">{t('billing.invoices.view')}</span>
      </div>
      {invoices.length === 0 ? null : (
        <FixedSizeList
          height={listHeight}
          itemCount={invoices.length}
          itemSize={BILLING_ROW_HEIGHT}
          width="100%"
          itemData={itemData}
          overscanCount={8}
        >
          {InvoiceRow}
        </FixedSizeList>
      )}
    </div>
  );
}
