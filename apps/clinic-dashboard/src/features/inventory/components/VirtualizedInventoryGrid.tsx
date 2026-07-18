import { memo, useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent } from 'react';
import { Link } from 'react-router-dom';
import { FixedSizeList, type ListChildComponentProps, type FixedSizeList as FixedSizeListType } from 'react-window';
import { useI18n } from '@booking/i18n/react';
import { formatMessage } from '@/i18n/messages';
import type { InventoryCategory, InventoryItem } from '../types/inventory.types';
import {
  INVENTORY_GRID_COLUMNS,
  INVENTORY_GRID_COLUMNS_READONLY,
  INVENTORY_GRID_MAX_HEIGHT,
  INVENTORY_GRID_SELECT_COLUMN,
  INVENTORY_ROW_HEIGHT,
  categoryDisplayName,
  formatInventoryDate,
  itemDisplayName,
  stockStatus,
} from '../config/inventory-config';
import { isGridNavKey, moveGridRowIndex } from '../utils/grid-keyboard-nav';
import styles from './VirtualizedInventoryGrid.module.css';

export interface VirtualizedInventoryGridProps {
  items: InventoryItem[];
  categories: InventoryCategory[];
  statusFilter: 'active' | 'archived';
  loading?: boolean;
  readOnly?: boolean;
  selectable?: boolean;
  selectedIds?: ReadonlySet<string>;
  allSelected?: boolean;
  onToggleItem?: (itemId: string) => void;
  onToggleAll?: () => void;
  canUpdate: boolean;
  canArchive: boolean;
  onEdit: (item: InventoryItem) => void;
  onReceive: (item: InventoryItem) => void;
  onConsume: (item: InventoryItem) => void;
  onArchive: (item: InventoryItem) => void;
  onReactivate: (item: InventoryItem) => void;
}

function SelectAllCheckbox({
  checked,
  indeterminate,
  label,
  onChange,
}: {
  checked: boolean;
  indeterminate: boolean;
  label: string;
  onChange: () => void;
}) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = indeterminate;
  }, [indeterminate]);
  return (
    <input
      ref={ref}
      type="checkbox"
      className={styles.rowCheck}
      checked={checked}
      aria-checked={indeterminate ? 'mixed' : checked}
      aria-label={label}
      onChange={onChange}
    />
  );
}

function actionLabel(action: string, item: InventoryItem, locale: string, t: (key: string) => string) {
  return formatMessage(t('inventory.a11y.actionForItem'), {
    action,
    item: itemDisplayName(item, locale),
  });
}

interface RowData {
  items: InventoryItem[];
  categoryMap: Map<string, InventoryCategory>;
  locale: string;
  statusFilter: 'active' | 'archived';
  readOnly: boolean;
  selectable: boolean;
  selectedIds: ReadonlySet<string>;
  allSelected: boolean;
  canUpdate: boolean;
  canArchive: boolean;
  t: (key: string) => string;
  onToggleItem?: (itemId: string) => void;
  onToggleAll?: () => void;
  onEdit: (item: InventoryItem) => void;
  onReceive: (item: InventoryItem) => void;
  onConsume: (item: InventoryItem) => void;
  onArchive: (item: InventoryItem) => void;
  onReactivate: (item: InventoryItem) => void;
  focusedIndex: number;
  registerRowRef: (index: number, el: HTMLDivElement | null) => void;
  onRowKeyDown: (index: number, event: KeyboardEvent<HTMLDivElement>) => void;
  onRowFocus: (index: number) => void;
}

const InventoryGridRow = memo(function InventoryGridRow({
  index,
  style,
  data,
}: ListChildComponentProps<RowData>) {
  const item = data.items[index];
  if (!item) return null;

  const status = stockStatus(item);
  const rowClass = status !== 'ok' ? styles[`row_${status}`] : undefined;
  const selected = data.selectedIds.has(item.itemId);
  const focused = data.focusedIndex === index;
  const rowLabel = formatMessage(data.t('inventory.a11y.gridRow'), {
    index: String(index + 1),
    total: String(data.items.length),
    item: itemDisplayName(item, data.locale),
  });

  return (
    <div
      ref={(el) => data.registerRowRef(index, el)}
      style={style as CSSProperties}
      className={`${styles.bodyRow} ${rowClass ?? ''} ${focused ? styles.bodyRowFocused : ''}`}
      role="row"
      aria-rowindex={index + 2}
      tabIndex={focused ? 0 : -1}
      aria-label={rowLabel}
      onFocus={() => data.onRowFocus(index)}
      onKeyDown={(event) => data.onRowKeyDown(index, event)}
    >
      {data.selectable && (
        <div role="cell" className={styles.cell}>
          <input
            type="checkbox"
            className={styles.rowCheck}
            checked={selected}
            aria-label={itemDisplayName(item, data.locale)}
            onChange={() => data.onToggleItem?.(item.itemId)}
          />
        </div>
      )}
      <div role="cell" className={styles.cell}>
        <Link to={`/inventory/items/${item.itemId}`} className={styles.skuLink}>
          {item.sku}
        </Link>
        {item.barcode && <span className={styles.barcodeMeta}>{item.barcode}</span>}
      </div>
      <div role="cell" className={styles.cell}>
        <Link to={`/inventory/items/${item.itemId}`} className={styles.nameLink}>
          {itemDisplayName(item, data.locale)}
        </Link>
      </div>
      <div role="cell" className={styles.cell}>
        {item.categoryId && data.categoryMap.get(item.categoryId) ? (
          <span className={styles.categoryBadge}>
            {categoryDisplayName(data.categoryMap.get(item.categoryId)!, data.locale)}
          </span>
        ) : (
          '—'
        )}
      </div>
      <div role="cell" className={`${styles.cell} ${styles.num}`}>
        {item.quantityOnHand} {item.unit}
      </div>
      <div role="cell" className={`${styles.cell} ${styles.num}`}>
        {item.reorderThreshold}
      </div>
      <div role="cell" className={styles.cell}>
        {formatInventoryDate(item.expiryDate, data.locale)}
      </div>
      <div role="cell" className={styles.cell}>
        <span className={`${styles.badge} ${styles[`badge_${status}`]}`}>
          {data.t(`inventory.status.${status}`)}
        </span>
      </div>
      {!data.readOnly && (
        <div role="cell" className={styles.cell}>
          <div className={styles.rowActions}>
            {data.canUpdate && data.statusFilter === 'active' && (
              <>
                <button
                  type="button"
                  className={styles.linkBtn}
                  aria-label={actionLabel(data.t('inventory.form.editAction'), item, data.locale, data.t)}
                  onClick={() => data.onEdit(item)}
                >
                  {data.t('inventory.form.editAction')}
                </button>
                <button
                  type="button"
                  className={styles.linkBtn}
                  aria-label={actionLabel(data.t('inventory.receive.title'), item, data.locale, data.t)}
                  onClick={() => data.onReceive(item)}
                >
                  {data.t('inventory.receive.title')}
                </button>
                <button
                  type="button"
                  className={styles.linkBtn}
                  aria-label={actionLabel(data.t('inventory.consume.title'), item, data.locale, data.t)}
                  onClick={() => data.onConsume(item)}
                >
                  {data.t('inventory.consume.title')}
                </button>
              </>
            )}
            {data.canArchive && data.statusFilter === 'active' && (
              <button
                type="button"
                className={styles.linkBtnDanger}
                aria-label={actionLabel(data.t('inventory.archive.action'), item, data.locale, data.t)}
                onClick={() => data.onArchive(item)}
              >
                {data.t('inventory.archive.action')}
              </button>
            )}
            {data.canUpdate && data.statusFilter === 'archived' && (
              <button
                type="button"
                className={styles.linkBtn}
                aria-label={actionLabel(data.t('inventory.reactivate.action'), item, data.locale, data.t)}
                onClick={() => data.onReactivate(item)}
              >
                {data.t('inventory.reactivate.action')}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
});

export function VirtualizedInventoryGrid({
  items,
  categories,
  statusFilter,
  loading,
  readOnly = false,
  selectable = false,
  selectedIds,
  allSelected = false,
  onToggleItem,
  onToggleAll,
  canUpdate,
  canArchive,
  onEdit,
  onReceive,
  onConsume,
  onArchive,
  onReactivate,
}: VirtualizedInventoryGridProps) {
  const { t, locale } = useI18n();
  const containerRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<FixedSizeListType>(null);
  const rowRefs = useRef(new Map<number, HTMLDivElement>());
  const [width, setWidth] = useState(0);
  const [focusedIndex, setFocusedIndex] = useState(-1);
  const selection = selectedIds ?? new Set<string>();
  const someSelected = items.some((item) => selection.has(item.itemId));
  const allSelectedOnPage = items.length > 0 && items.every((item) => selection.has(item.itemId));

  useEffect(() => {
    setFocusedIndex(-1);
    rowRefs.current.clear();
  }, [items]);

  const registerRowRef = useCallback((index: number, el: HTMLDivElement | null) => {
    if (el) rowRefs.current.set(index, el);
    else rowRefs.current.delete(index);
  }, []);

  const focusRow = useCallback((index: number) => {
    if (items.length === 0) return;
    const next = Math.max(0, Math.min(items.length - 1, index));
    setFocusedIndex(next);
    listRef.current?.scrollToItem(next, 'smart');
    requestAnimationFrame(() => rowRefs.current.get(next)?.focus());
  }, [items.length]);

  const onRowFocus = useCallback((index: number) => {
    setFocusedIndex(index);
  }, []);

  const onRowKeyDown = useCallback(
    (index: number, event: KeyboardEvent<HTMLDivElement>) => {
      if (!isGridNavKey(event.key)) return;
      const next = moveGridRowIndex(index, event.key, items.length);
      if (next === null) return;
      event.preventDefault();
      if (next !== index) focusRow(next);
    },
    [focusRow, items.length],
  );

  const onRowGroupKeyDown = useCallback(
    (event: KeyboardEvent<HTMLDivElement>) => {
      if (items.length === 0 || !isGridNavKey(event.key)) return;
      const start = focusedIndex >= 0 ? focusedIndex : 0;
      const next = moveGridRowIndex(start, event.key, items.length);
      if (next === null) return;
      event.preventDefault();
      focusRow(next);
    },
    [focusRow, focusedIndex, items.length],
  );

  const onRowGroupFocus = useCallback(() => {
    if (focusedIndex < 0 && items.length > 0) focusRow(0);
  }, [focusRow, focusedIndex, items.length]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      setWidth(entries[0]?.contentRect.width ?? 0);
    });
    ro.observe(el);
    setWidth(el.clientWidth);
    return () => ro.disconnect();
  }, []);

  const categoryMap = useMemo(() => new Map(categories.map((c) => [c.categoryId, c])), [categories]);

  const gridColumns = useMemo(() => {
    const base = readOnly ? INVENTORY_GRID_COLUMNS_READONLY : INVENTORY_GRID_COLUMNS;
    return selectable ? `${INVENTORY_GRID_SELECT_COLUMN} ${base}` : base;
  }, [readOnly, selectable]);

  const rowData = useMemo<RowData>(
    () => ({
      items,
      categoryMap,
      locale,
      statusFilter,
      readOnly,
      selectable,
      selectedIds: selection,
      allSelected,
      canUpdate,
      canArchive,
      t,
      onToggleItem,
      onToggleAll,
      onEdit,
      onReceive,
      onConsume,
      onArchive,
      onReactivate,
      focusedIndex,
      registerRowRef,
      onRowKeyDown,
      onRowFocus,
    }),
    [
      items,
      categoryMap,
      locale,
      statusFilter,
      readOnly,
      selectable,
      selection,
      allSelected,
      canUpdate,
      canArchive,
      t,
      onToggleItem,
      onToggleAll,
      onEdit,
      onReceive,
      onConsume,
      onArchive,
      onReactivate,
      focusedIndex,
      registerRowRef,
      onRowKeyDown,
      onRowFocus,
    ],
  );

  const listHeight = Math.min(
    INVENTORY_GRID_MAX_HEIGHT,
    Math.max(INVENTORY_ROW_HEIGHT * 3, items.length * INVENTORY_ROW_HEIGHT),
  );

  const gridLabel = `${t('inventory.table.caption')}. ${t('inventory.a11y.gridKeyboardHint')}`;

  return (
    <div
      ref={containerRef}
      className={styles.wrap}
      role="table"
      aria-label={gridLabel}
      aria-rowcount={items.length + 1}
      aria-busy={loading || undefined}
      style={{ ['--inv-grid-columns' as string]: gridColumns }}
    >
      <div className={styles.headerRow} role="row">
        {selectable && (
          <div role="columnheader" className={styles.cell}>
            <SelectAllCheckbox
              checked={allSelectedOnPage}
              indeterminate={someSelected && !allSelectedOnPage}
              label={t('inventory.bulk.selectAll')}
              onChange={() => onToggleAll?.()}
            />
          </div>
        )}
        <div role="columnheader">{t('inventory.table.sku')}</div>
        <div role="columnheader">{t('inventory.table.name')}</div>
        <div role="columnheader">{t('inventory.table.category')}</div>
        <div role="columnheader">{t('inventory.table.quantity')}</div>
        <div role="columnheader">{t('inventory.table.reorder')}</div>
        <div role="columnheader">{t('inventory.table.expiry')}</div>
        <div role="columnheader">{t('inventory.table.status')}</div>
        {!readOnly && <div role="columnheader">{t('inventory.table.actions')}</div>}
      </div>

      {loading && items.length === 0 && (
        <div className={styles.skeletonList} aria-hidden>
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className={styles.skeletonBar} />
          ))}
        </div>
      )}

      {!loading && items.length === 0 && (
        <p className={styles.emptyHint} role="status">
          {t('inventory.empty')}
        </p>
      )}

      {width > 0 && items.length > 0 && (
        <div
          role="rowgroup"
          tabIndex={0}
          className={styles.rowGroup}
          onKeyDown={onRowGroupKeyDown}
          onFocus={onRowGroupFocus}
        >
          <FixedSizeList
            ref={listRef}
            height={listHeight}
            width={width}
            itemCount={items.length}
            itemSize={INVENTORY_ROW_HEIGHT}
            itemData={rowData}
            overscanCount={6}
            className={styles.list}
          >
            {InventoryGridRow}
          </FixedSizeList>
        </div>
      )}
    </div>
  );
}
