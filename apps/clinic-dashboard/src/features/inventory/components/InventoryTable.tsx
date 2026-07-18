import { Link } from 'react-router-dom';
import { useState, type FormEvent } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useI18n } from '@booking/i18n/react';
import { formatMessage } from '@/i18n/messages';
import { AuthButton } from '@/features/auth/components/AuthButton';
import type { InventoryCategory, InventoryItem } from '../types/inventory.types';
import { itemDisplayName, stockStatus } from '../config/inventory-config';
import {
  clampCatalogPage,
  formatCatalogCount,
  INVENTORY_PAGE_JUMP_THRESHOLD,
} from '../utils/catalog-scale';
import { VirtualizedInventoryGrid } from './VirtualizedInventoryGrid';
import { InventoryEmptyState } from './InventoryEmptyState';
import styles from './InventoryTable.module.css';

function actionLabel(action: string, item: InventoryItem, locale: string, t: (key: string) => string) {
  return formatMessage(t('inventory.a11y.actionForItem'), {
    action,
    item: itemDisplayName(item, locale),
  });
}

export interface InventoryTableProps {
  items: InventoryItem[];
  categories: InventoryCategory[];
  statusFilter: 'active' | 'archived';
  loading?: boolean;
  fetching?: boolean;
  showDeepPageHint?: boolean;
  readOnly?: boolean;
  selectable?: boolean;
  selectedIds?: ReadonlySet<string>;
  allSelected?: boolean;
  onToggleItem?: (itemId: string) => void;
  onToggleAll?: () => void;
  selectedCount?: number;
  onExportSelected?: () => void;
  exportLoading?: boolean;
  onArchiveSelected?: () => void;
  archiveLoading?: boolean;
  showBulkArchive?: boolean;
  onClearSelection?: () => void;
  page: number;
  total: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange?: (size: number) => void;
  pageSizeOptions?: readonly number[];
  canUpdate: boolean;
  canArchive: boolean;
  onEdit: (item: InventoryItem) => void;
  onReceive: (item: InventoryItem) => void;
  onConsume: (item: InventoryItem) => void;
  onArchive: (item: InventoryItem) => void;
  onReactivate: (item: InventoryItem) => void;
  onClearFilters?: () => void;
  onAddItem?: () => void;
}

export function InventoryTable({
  items,
  categories,
  statusFilter,
  loading,
  fetching = false,
  showDeepPageHint = false,
  readOnly = false,
  selectable = false,
  selectedIds,
  allSelected = false,
  onToggleItem,
  onToggleAll,
  selectedCount = 0,
  onExportSelected,
  exportLoading = false,
  onArchiveSelected,
  archiveLoading = false,
  showBulkArchive = false,
  onClearSelection,
  page,
  total,
  pageSize,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions,
  canUpdate,
  canArchive,
  onEdit,
  onReceive,
  onConsume,
  onArchive,
  onReactivate,
  onClearFilters,
  onAddItem,
}: InventoryTableProps) {
  const { t, locale, direction } = useI18n();
  const [jumpPage, setJumpPage] = useState('');
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const PrevIcon = direction === 'rtl' ? ChevronRight : ChevronLeft;
  const NextIcon = direction === 'rtl' ? ChevronLeft : ChevronRight;
  const rangeStart = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const rangeEnd = Math.min(page * pageSize, total);
  const showPageJump = totalPages > INVENTORY_PAGE_JUMP_THRESHOLD;

  function submitPageJump(event: FormEvent) {
    event.preventDefault();
    const parsed = Number(jumpPage);
    if (!Number.isFinite(parsed)) return;
    onPageChange(clampCatalogPage(parsed, totalPages));
    setJumpPage('');
  }

  return (
    <div className={`${styles.wrap} ${fetching ? styles.wrapFetching : ''}`} aria-busy={fetching || undefined}>
      {selectable && selectedCount > 0 && (
        <div className={styles.bulkBar} role="toolbar" aria-label={t('inventory.a11y.bulkToolbar')}>
          <span aria-live="polite" aria-atomic="true">
            {formatMessage(t('inventory.bulk.selected'), { count: String(selectedCount) })}
          </span>
          <div className={styles.bulkActions}>
            <AuthButton variant="secondary" onClick={onClearSelection}>
              {t('inventory.bulk.clearSelection')}
            </AuthButton>
            {showBulkArchive && onArchiveSelected && (
              <AuthButton variant="danger" loading={archiveLoading} onClick={onArchiveSelected}>
                {t('inventory.bulk.archiveSelected')}
              </AuthButton>
            )}
            {onExportSelected && (
              <AuthButton loading={exportLoading} onClick={onExportSelected}>
                {t('inventory.bulk.exportCsv')}
              </AuthButton>
            )}
          </div>
        </div>
      )}

      {!loading && items.length === 0 ? (
        <InventoryEmptyState
          title={t('inventory.empty')}
          description={t('inventory.emptyHint')}
          action={
            <>
              {onClearFilters && (
                <AuthButton variant="secondary" onClick={onClearFilters}>
                  {t('inventory.clearFilters')}
                </AuthButton>
              )}
              {onAddItem && (
                <AuthButton onClick={onAddItem}>{t('inventory.addItem')}</AuthButton>
              )}
            </>
          }
        />
      ) : (
        <>
      <VirtualizedInventoryGrid
        items={items}
        categories={categories}
        statusFilter={statusFilter}
        loading={loading}
        readOnly={readOnly}
        selectable={selectable}
        selectedIds={selectedIds}
        allSelected={allSelected}
        onToggleItem={onToggleItem}
        onToggleAll={onToggleAll}
        canUpdate={canUpdate}
        canArchive={canArchive}
        onEdit={onEdit}
        onReceive={onReceive}
        onConsume={onConsume}
        onArchive={onArchive}
        onReactivate={onReactivate}
      />

      <ul className={styles.cardList} aria-label={t('inventory.table.caption')}>
        {!loading &&
          items.map((item) => {
            const status = stockStatus(item);
            const selected = selectedIds?.has(item.itemId) ?? false;
            const rowClass = status !== 'ok' ? styles[`cardRow_${status}`] : undefined;
            return (
              <li key={`card-${item.itemId}`} className={rowClass}>
                <div className={styles.cardRow}>
                  {selectable && (
                    <input
                      type="checkbox"
                      className={styles.cardCheck}
                      checked={selected}
                      aria-label={itemDisplayName(item, locale)}
                      onChange={() => onToggleItem?.(item.itemId)}
                    />
                  )}
                  <div className={styles.cardMain}>
                    <Link to={`/inventory/items/${item.itemId}`} className={styles.card}>
                      <span className={styles.cardSku}>{item.sku}</span>
                      <span className={styles.cardBody}>
                        <span className={styles.cardName}>{itemDisplayName(item, locale)}</span>
                        <span className={styles.cardMeta}>
                          {item.quantityOnHand} {item.unit} · {t(`inventory.status.${status}`)}
                          {item.barcode ? ` · ${item.barcode}` : ''}
                        </span>
                      </span>
                    </Link>
                    {!readOnly && (
                      <div className={styles.cardActions}>
                        {canUpdate && statusFilter === 'active' && (
                          <>
                            <button
                              type="button"
                              className={styles.linkBtn}
                              aria-label={actionLabel(t('inventory.form.editAction'), item, locale, t)}
                              onClick={() => onEdit(item)}
                            >
                              {t('inventory.form.editAction')}
                            </button>
                            <button
                              type="button"
                              className={styles.linkBtn}
                              aria-label={actionLabel(t('inventory.receive.title'), item, locale, t)}
                              onClick={() => onReceive(item)}
                            >
                              {t('inventory.receive.title')}
                            </button>
                            <button
                              type="button"
                              className={styles.linkBtn}
                              aria-label={actionLabel(t('inventory.consume.title'), item, locale, t)}
                              onClick={() => onConsume(item)}
                            >
                              {t('inventory.consume.title')}
                            </button>
                          </>
                        )}
                        {canArchive && statusFilter === 'active' && (
                          <button
                            type="button"
                            className={styles.linkBtnDanger}
                            aria-label={actionLabel(t('inventory.archive.action'), item, locale, t)}
                            onClick={() => onArchive(item)}
                          >
                            {t('inventory.archive.action')}
                          </button>
                        )}
                        {canUpdate && statusFilter === 'archived' && (
                          <button
                            type="button"
                            className={styles.linkBtn}
                            aria-label={actionLabel(t('inventory.reactivate.action'), item, locale, t)}
                            onClick={() => onReactivate(item)}
                          >
                            {t('inventory.reactivate.action')}
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        {loading &&
          Array.from({ length: 4 }).map((_, i) => (
            <li key={`card-sk-${i}`}>
              <div className={styles.cardSkeleton} aria-hidden />
            </li>
          ))}
      </ul>

      <footer className={styles.footer}>
        <div className={styles.footerMeta}>
          {total > 0 && (
            <span className={styles.range} aria-live="polite">
              {formatMessage(t('inventory.pagination.range'), {
                start: formatCatalogCount(rangeStart, locale),
                end: formatCatalogCount(rangeEnd, locale),
                total: formatCatalogCount(total, locale),
              })}
            </span>
          )}
          {showDeepPageHint && (
            <span className={styles.scaleHint}>{t('inventory.scale.deepPageHint')}</span>
          )}
          {onPageSizeChange && pageSizeOptions && pageSizeOptions.length > 1 && (
            <label className={styles.pageSizeLabel}>
              {t('inventory.pagination.pageSize')}
              <select
                value={pageSize}
                onChange={(e) => onPageSizeChange(Number(e.target.value))}
                aria-label={t('inventory.pagination.pageSize')}
              >
                {pageSizeOptions.map((size) => (
                  <option key={size} value={size}>
                    {size}
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>

        {totalPages > 1 && (
          <nav
            className={styles.pagination}
            aria-label={formatMessage(t('inventory.pagination.page'), {
              page: String(page),
              total: String(totalPages),
            })}
          >
            <button type="button" className={styles.pageBtn} disabled={page <= 1} onClick={() => onPageChange(page - 1)}>
              <PrevIcon size={16} aria-hidden />
              {t('inventory.pagination.prev')}
            </button>
            <span className={styles.pageInfo} aria-current="page">
              {formatMessage(t('inventory.pagination.page'), {
                page: String(page),
                total: String(totalPages),
              })}
            </span>
            <button
              type="button"
              className={styles.pageBtn}
              disabled={page >= totalPages}
              onClick={() => onPageChange(page + 1)}
            >
              {t('inventory.pagination.next')}
              <NextIcon size={16} aria-hidden />
            </button>
            {showPageJump && (
              <form className={styles.pageJump} onSubmit={submitPageJump}>
                <label className={styles.pageJumpLabel}>
                  {t('inventory.pagination.jumpToPage')}
                  <input
                    type="number"
                    min={1}
                    max={totalPages}
                    value={jumpPage}
                    className={styles.pageJumpInput}
                    aria-label={t('inventory.pagination.jumpToPage')}
                    onChange={(e) => setJumpPage(e.target.value)}
                  />
                </label>
                <button type="submit" className={styles.pageBtn}>
                  {t('inventory.pagination.jumpButton')}
                </button>
              </form>
            )}
          </nav>
        )}
      </footer>
        </>
      )}
    </div>
  );
}
