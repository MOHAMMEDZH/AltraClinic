import { useCallback, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Plus } from 'lucide-react';
import { hasPermission } from '@booking/permissions';
import { useI18n } from '@booking/i18n/react';
import { useAuth } from '@/app/providers/AuthProvider';
import { AuthAlert } from '@/features/auth/components/AuthAlert';
import { AuthButton } from '@/features/auth/components/AuthButton';
import { AuthFormField } from '@/features/auth/components/AuthFormField';
import { Modal } from '@/features/patients/components/Modal';
import { canApproveInventory, canCreateInventory, canUpdateInventory, canViewInventory } from './config/inventory-config';
import { fetchStockCount, mapInventoryApiError } from './api/inventory-api';
import { InventoryBarcodeLookup } from './components/InventoryBarcodeLookup';
import type { InventoryItem, StockCount, StockCountLine } from './types/inventory.types';
import {
  useApproveStockCount,
  useCancelStockCount,
  useCreateStockCount,
  useInventoryWarehouses,
  useStartStockCount,
  useStockCounts,
  useSubmitStockCount,
  useUpdateStockCountLine,
} from './hooks/useInventory';
import styles from './StockCountsPage.module.css';

const STATUS_FILTERS = ['', 'DRAFT', 'IN_PROGRESS', 'PENDING_APPROVAL', 'APPROVED', 'CANCELLED'] as const;

function statusBadgeClass(status: StockCount['status']): string {
  if (status === 'DRAFT') return styles.badge_draft;
  if (status === 'IN_PROGRESS' || status === 'PENDING_APPROVAL') return styles.badge_pending;
  if (status === 'APPROVED') return styles.badge_received;
  return styles.badge_cancelled;
}

function varianceClass(variance: number | null): string {
  if (variance == null || variance === 0) return '';
  return variance > 0 ? styles.variancePos : styles.varianceNeg;
}

export function StockCountsPage() {
  const { t, locale, direction } = useI18n();
  const { user, getValidAccessToken } = useAuth();
  const roles = user?.roles ?? [];
  const perm = useCallback((action: string) => hasPermission(roles, 'api.inventory', action as never), [roles]);

  const [searchParams] = useSearchParams();
  const [statusFilter, setStatusFilter] = useState(() => searchParams.get('status') ?? '');
  const [page, setPage] = useState(1);
  const [createOpen, setCreateOpen] = useState(false);
  const [detailCount, setDetailCount] = useState<StockCount | null>(null);
  const [countDrafts, setCountDrafts] = useState<Record<string, number>>({});
  const [warehouseId, setWarehouseId] = useState('');
  const [notes, setNotes] = useState('');
  const [errorKey, setErrorKey] = useState<string | null>(null);
  const [scanMode, setScanMode] = useState(false);

  const canView = canViewInventory(perm);
  const canCreate = canCreateInventory(perm);
  const canUpdate = canUpdateInventory(perm);
  const canApprove = canApproveInventory(perm);

  const listQuery = useStockCounts({ status: statusFilter || undefined, page, enabled: canView });
  const warehousesQuery = useInventoryWarehouses({ enabled: canView });

  const createMutation = useCreateStockCount();
  const startMutation = useStartStockCount();
  const submitMutation = useSubmitStockCount();
  const approveMutation = useApproveStockCount();
  const cancelMutation = useCancelStockCount();
  const updateLineMutation = useUpdateStockCountLine();

  const counts = listQuery.data?.counts ?? [];
  const warehouses = warehousesQuery.data ?? [];
  const totalPages = Math.max(1, Math.ceil((listQuery.data?.total ?? 0) / (listQuery.data?.limit ?? 20)));

  async function handleCreate() {
    setErrorKey(null);
    if (!warehouseId) {
      setErrorKey('invalidRequest');
      return;
    }
    try {
      const result = await createMutation.mutateAsync({
        warehouseId,
        notes: notes.trim() || null,
      });
      setCreateOpen(false);
      setWarehouseId('');
      setNotes('');
      void listQuery.refetch();
      if (result.countId) {
        const token = await getValidAccessToken();
        if (token && user?.tenantId) {
          const count = await fetchStockCount(token, user.tenantId, result.countId);
          setDetailCount(count);
        }
      }
    } catch (err) {
      setErrorKey(mapInventoryApiError(err));
    }
  }

  async function runCountAction(action: 'start' | 'submit' | 'approve' | 'cancel', count: StockCount) {
    setErrorKey(null);
    try {
      let updated: StockCount;
      if (action === 'start') updated = await startMutation.mutateAsync(count.countId);
      else if (action === 'submit') updated = await submitMutation.mutateAsync(count.countId);
      else if (action === 'approve') updated = await approveMutation.mutateAsync(count.countId);
      else updated = await cancelMutation.mutateAsync(count.countId);
      setDetailCount(updated);
      setCountDrafts({});
    } catch (err) {
      setErrorKey(mapInventoryApiError(err));
    }
  }

  async function saveLineCount(line: StockCountLine) {
    const qty = countDrafts[line.lineId] ?? line.countedQuantity ?? line.systemQuantity;
    setErrorKey(null);
    try {
      const updated = await updateLineMutation.mutateAsync({ lineId: line.lineId, countedQuantity: qty });
      setDetailCount(updated);
    } catch (err) {
      setErrorKey(mapInventoryApiError(err));
    }
  }

  function openDetail(count: StockCount) {
    setDetailCount(count);
    setCountDrafts({});
    setScanMode(false);
  }

  function handleBarcodeItem(item: InventoryItem) {
    if (!detailCount) return;
    const line = detailCount.lines.find((l) => l.itemId === item.itemId);
    if (!line) {
      setErrorKey('notFound');
      return;
    }
    setCountDrafts((prev) => ({
      ...prev,
      [line.lineId]: prev[line.lineId] ?? line.countedQuantity ?? line.systemQuantity,
    }));
    setErrorKey(null);
  }

  if (!canView) {
    return (
      <div className={styles.page}>
        <AuthAlert variant="error">{t('inventory.accessDenied')}</AuthAlert>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <nav aria-label={t('inventory.stockCounts.breadcrumb')}>
        <Link to="/inventory" className={styles.backLink}>
          <ArrowLeft size={16} aria-hidden style={direction === 'rtl' ? { transform: 'scaleX(-1)' } : undefined} />
          {t('inventory.detail.back')}
        </Link>
      </nav>

      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>{t('inventory.stockCounts.title')}</h1>
          <p className={styles.subtitle}>{t('inventory.stockCounts.subtitle')}</p>
        </div>
        {canCreate && (
          <AuthButton onClick={() => setCreateOpen(true)}>
            <Plus size={16} aria-hidden />
            {t('inventory.stockCounts.create')}
          </AuthButton>
        )}
      </header>

      {errorKey && <AuthAlert variant="error">{t(`inventory.errors.${errorKey}` as 'inventory.errors.generic')}</AuthAlert>}

      <div className={styles.filters} role="group" aria-label={t('inventory.stockCounts.filters')}>
        {STATUS_FILTERS.map((f) => (
          <button
            key={f || 'all'}
            type="button"
            className={statusFilter === f ? styles.filterActive : styles.filterBtn}
            onClick={() => { setStatusFilter(f); setPage(1); }}
          >
            {f ? t(`inventory.stockCounts.status.${f}` as 'inventory.stockCounts.status.DRAFT') : t('inventory.filters.all')}
          </button>
        ))}
      </div>

      {counts.length === 0 ? (
        <div className={styles.empty}>{t('inventory.stockCounts.empty')}</div>
      ) : (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <caption className="sr-only">{t('inventory.stockCounts.tableCaption')}</caption>
            <thead>
              <tr>
                <th>{t('inventory.stockCounts.countNumber')}</th>
                <th>{t('inventory.stockCounts.location')}</th>
                <th>{t('inventory.stockCounts.statusLabel')}</th>
                <th>{t('inventory.stockCounts.lines')}</th>
                <th>{t('inventory.stockCounts.variances')}</th>
                <th>{t('inventory.stockCounts.created')}</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {counts.map((count) => (
                <tr key={count.countId}>
                  <td>{count.countNumber}</td>
                  <td>{count.warehouseName}</td>
                  <td>
                    <span className={statusBadgeClass(count.status)}>
                      {t(`inventory.stockCounts.status.${count.status}` as 'inventory.stockCounts.status.DRAFT')}
                    </span>
                  </td>
                  <td>{count.metrics.lineCount}</td>
                  <td>{count.metrics.varianceLineCount}</td>
                  <td>{new Date(count.createdAt).toLocaleDateString(locale)}</td>
                  <td>
                    <AuthButton variant="secondary" onClick={() => openDetail(count)}>
                      {t('inventory.stockCounts.view')}
                    </AuthButton>
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
          <span>{t('inventory.pagination.page').replace('{page}', String(page)).replace('{total}', String(totalPages))}</span>
          <AuthButton variant="secondary" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
            {t('inventory.pagination.next')}
          </AuthButton>
        </div>
      )}

      <Modal open={createOpen} title={t('inventory.stockCounts.createTitle')} onClose={() => setCreateOpen(false)}>
        <AuthFormField label={t('inventory.stockCounts.location')} required>
          <select value={warehouseId} onChange={(e) => setWarehouseId(e.target.value)}>
            <option value="">—</option>
            {warehouses.map((w) => (
              <option key={w.warehouseId} value={w.warehouseId}>{w.code} — {w.nameEn}</option>
            ))}
          </select>
        </AuthFormField>
        <AuthFormField label={t('inventory.stockCounts.notes')}>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
        </AuthFormField>
        <AuthButton onClick={() => void handleCreate()} disabled={createMutation.isPending}>
          {t('inventory.form.save')}
        </AuthButton>
      </Modal>

      <Modal
        open={detailCount != null}
        title={detailCount?.countNumber ?? ''}
        onClose={() => setDetailCount(null)}
      >
        {detailCount && (
          <>
            <p>
              {t('inventory.stockCounts.statusLabel')}:{' '}
              {t(`inventory.stockCounts.status.${detailCount.status}` as 'inventory.stockCounts.status.DRAFT')}
            </p>
            <p>{detailCount.warehouseName}</p>
            <p>
              {t('inventory.stockCounts.progress')
                .replace('{counted}', String(detailCount.metrics.countedLineCount))
                .replace('{total}', String(detailCount.metrics.lineCount))}
            </p>

            {detailCount.status === 'IN_PROGRESS' && canUpdate && (
              <div style={{ marginBottom: 'var(--space-3)' }}>
                <p className={styles.subtitle}>{t('inventory.stockCounts.scanHint')}</p>
                <InventoryBarcodeLookup
                  scanMode={scanMode}
                  onScanModeChange={setScanMode}
                  onItemFound={(item) => handleBarcodeItem(item)}
                />
              </div>
            )}

            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>{t('inventory.table.sku')}</th>
                    <th>{t('inventory.stockCounts.systemQty')}</th>
                    <th>{t('inventory.stockCounts.countedQty')}</th>
                    <th>{t('inventory.stockCounts.variance')}</th>
                    {detailCount.status === 'IN_PROGRESS' && canUpdate && <th />}
                  </tr>
                </thead>
                <tbody>
                  {detailCount.lines.map((line) => {
                    const draft = countDrafts[line.lineId] ?? line.countedQuantity ?? line.systemQuantity;
                    const variance = line.countedQuantity != null ? line.countedQuantity - line.systemQuantity : null;
                    return (
                      <tr key={line.lineId}>
                        <td>{line.sku}</td>
                        <td>{line.systemQuantity}</td>
                        <td>
                          {detailCount.status === 'IN_PROGRESS' && canUpdate ? (
                            <input
                              type="number"
                              min={0}
                              value={draft}
                              onChange={(e) =>
                                setCountDrafts({ ...countDrafts, [line.lineId]: Number(e.target.value) || 0 })
                              }
                            />
                          ) : (
                            line.countedQuantity ?? '—'
                          )}
                        </td>
                        <td className={varianceClass(variance)}>{variance ?? '—'}</td>
                        {detailCount.status === 'IN_PROGRESS' && canUpdate && (
                          <td>
                            <AuthButton variant="secondary" onClick={() => void saveLineCount(line)}>
                              {t('inventory.stockCounts.saveLine')}
                            </AuthButton>
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {detailCount.status === 'DRAFT' && canUpdate && (
              <AuthButton onClick={() => void runCountAction('start', detailCount)}>
                {t('inventory.stockCounts.start')}
              </AuthButton>
            )}
            {detailCount.status === 'IN_PROGRESS' && canUpdate && (
              <AuthButton onClick={() => void runCountAction('submit', detailCount)}>
                {t('inventory.stockCounts.submit')}
              </AuthButton>
            )}
            {detailCount.status === 'PENDING_APPROVAL' && canApprove && (
              <AuthButton onClick={() => void runCountAction('approve', detailCount)}>
                {t('inventory.stockCounts.approve')}
              </AuthButton>
            )}
            {['DRAFT', 'IN_PROGRESS', 'PENDING_APPROVAL'].includes(detailCount.status) && canUpdate && (
              <AuthButton variant="secondary" onClick={() => void runCountAction('cancel', detailCount)}>
                {t('inventory.stockCounts.cancel')}
              </AuthButton>
            )}
          </>
        )}
      </Modal>
    </div>
  );
}
