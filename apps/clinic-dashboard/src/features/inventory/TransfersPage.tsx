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
import { canCreateInventory, canUpdateInventory, canViewInventory, itemDisplayName } from './config/inventory-config';
import { fetchStockTransfer, mapInventoryApiError } from './api/inventory-api';
import type { StockTransfer, StockTransferLine } from './types/inventory.types';
import {
  useCancelStockTransfer,
  useCreateStockTransfer,
  useInventoryItems,
  useInventoryWarehouses,
  useReceiveStockTransferLine,
  useShipStockTransfer,
  useStockTransfers,
} from './hooks/useInventory';
import styles from './TransfersPage.module.css';

const STATUS_FILTERS = ['', 'DRAFT', 'IN_TRANSIT', 'RECEIVED', 'CANCELLED'] as const;

function statusBadgeClass(status: StockTransfer['status']): string {
  if (status === 'DRAFT') return styles.badge_draft;
  if (status === 'IN_TRANSIT') return styles.badge_pending;
  if (status === 'RECEIVED') return styles.badge_received;
  return styles.badge_cancelled;
}

export function TransfersPage() {
  const { t, locale, direction } = useI18n();
  const { user, getValidAccessToken } = useAuth();
  const roles = user?.roles ?? [];
  const perm = useCallback((action: string) => hasPermission(roles, 'api.inventory', action as never), [roles]);

  const [searchParams] = useSearchParams();
  const [statusFilter, setStatusFilter] = useState(() => searchParams.get('status') ?? '');
  const [page, setPage] = useState(1);
  const [createOpen, setCreateOpen] = useState(false);
  const [detailTransfer, setDetailTransfer] = useState<StockTransfer | null>(null);
  const [receiveLine, setReceiveLine] = useState<StockTransferLine | null>(null);
  const [receiveQty, setReceiveQty] = useState(1);
  const [errorKey, setErrorKey] = useState<string | null>(null);

  const [fromWarehouseId, setFromWarehouseId] = useState('');
  const [toWarehouseId, setToWarehouseId] = useState('');
  const [notes, setNotes] = useState('');
  const [lines, setLines] = useState([{ itemId: '', quantity: 1 }]);

  const canView = canViewInventory(perm);
  const canCreate = canCreateInventory(perm);
  const canUpdate = canUpdateInventory(perm);

  const listQuery = useStockTransfers({ status: statusFilter || undefined, page, enabled: canView });
  const warehousesQuery = useInventoryWarehouses({ enabled: canView });
  const itemsQuery = useInventoryItems({ page: 1, enabled: createOpen && canView });

  const createMutation = useCreateStockTransfer();
  const shipMutation = useShipStockTransfer();
  const cancelMutation = useCancelStockTransfer();
  const receiveMutation = useReceiveStockTransferLine();

  const warehouses = warehousesQuery.data ?? [];
  const items = itemsQuery.data?.items ?? [];
  const transfers = listQuery.data?.transfers ?? [];
  const totalPages = Math.max(1, Math.ceil((listQuery.data?.total ?? 0) / (listQuery.data?.limit ?? 20)));

  async function handleCreate() {
    setErrorKey(null);
    const validLines = lines.filter((l) => l.itemId && l.quantity > 0);
    if (!fromWarehouseId || !toWarehouseId || validLines.length === 0) {
      setErrorKey('invalidRequest');
      return;
    }
    try {
      const result = await createMutation.mutateAsync({
        fromWarehouseId,
        toWarehouseId,
        notes: notes.trim() || null,
        lines: validLines,
      });
      setCreateOpen(false);
      setFromWarehouseId('');
      setToWarehouseId('');
      setNotes('');
      setLines([{ itemId: '', quantity: 1 }]);
      void listQuery.refetch();
      if (result.transferId) {
        const token = await getValidAccessToken();
        if (token && user?.tenantId) {
          const transfer = await fetchStockTransfer(token, user.tenantId, result.transferId);
          setDetailTransfer(transfer);
        }
      }
    } catch (err) {
      setErrorKey(mapInventoryApiError(err));
    }
  }

  async function runTransferAction(action: 'ship' | 'cancel', transfer: StockTransfer) {
    setErrorKey(null);
    try {
      const updated =
        action === 'ship'
          ? await shipMutation.mutateAsync(transfer.transferId)
          : await cancelMutation.mutateAsync(transfer.transferId);
      setDetailTransfer(updated);
    } catch (err) {
      setErrorKey(mapInventoryApiError(err));
    }
  }

  async function confirmReceive() {
    if (!receiveLine) return;
    setErrorKey(null);
    try {
      const updated = await receiveMutation.mutateAsync({ lineId: receiveLine.lineId, quantity: receiveQty });
      setDetailTransfer(updated);
      setReceiveLine(null);
    } catch (err) {
      setErrorKey(mapInventoryApiError(err));
    }
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
      <nav aria-label={t('inventory.transfers.breadcrumb')}>
        <Link to="/inventory" className={styles.backLink}>
          <ArrowLeft size={16} aria-hidden style={direction === 'rtl' ? { transform: 'scaleX(-1)' } : undefined} />
          {t('inventory.detail.back')}
        </Link>
      </nav>

      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>{t('inventory.transfers.title')}</h1>
          <p className={styles.subtitle}>{t('inventory.transfers.subtitle')}</p>
        </div>
        {canCreate && (
          <AuthButton onClick={() => setCreateOpen(true)}>
            <Plus size={16} aria-hidden />
            {t('inventory.transfers.create')}
          </AuthButton>
        )}
      </header>

      {errorKey && <AuthAlert variant="error">{t(`inventory.errors.${errorKey}` as 'inventory.errors.generic')}</AuthAlert>}

      <div className={styles.filters} role="group" aria-label={t('inventory.transfers.filters')}>
        {STATUS_FILTERS.map((f) => (
          <button
            key={f || 'all'}
            type="button"
            className={statusFilter === f ? styles.filterActive : styles.filterBtn}
            onClick={() => { setStatusFilter(f); setPage(1); }}
          >
            {f ? t(`inventory.transfers.status.${f}` as 'inventory.transfers.status.DRAFT') : t('inventory.filters.all')}
          </button>
        ))}
      </div>

      {transfers.length === 0 ? (
        <div className={styles.empty}>{t('inventory.transfers.empty')}</div>
      ) : (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <caption className="sr-only">{t('inventory.transfers.tableCaption')}</caption>
            <thead>
              <tr>
                <th>{t('inventory.transfers.transferNumber')}</th>
                <th>{t('inventory.transfers.from')}</th>
                <th>{t('inventory.transfers.to')}</th>
                <th>{t('inventory.transfers.statusLabel')}</th>
                <th>{t('inventory.transfers.lines')}</th>
                <th>{t('inventory.transfers.created')}</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {transfers.map((tr) => (
                <tr key={tr.transferId}>
                  <td>{tr.transferNumber}</td>
                  <td>{tr.fromWarehouseName}</td>
                  <td>{tr.toWarehouseName}</td>
                  <td>
                    <span className={statusBadgeClass(tr.status)}>
                      {t(`inventory.transfers.status.${tr.status}` as 'inventory.transfers.status.DRAFT')}
                    </span>
                  </td>
                  <td>{tr.lines.length}</td>
                  <td>{new Date(tr.createdAt).toLocaleDateString(locale)}</td>
                  <td>
                    <AuthButton variant="secondary" onClick={() => setDetailTransfer(tr)}>
                      {t('inventory.transfers.view')}
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

      <Modal open={createOpen} title={t('inventory.transfers.createTitle')} onClose={() => setCreateOpen(false)}>
        <AuthFormField label={t('inventory.transfers.from')} required>
          <select value={fromWarehouseId} onChange={(e) => setFromWarehouseId(e.target.value)}>
            <option value="">—</option>
            {warehouses.map((w) => (
              <option key={w.warehouseId} value={w.warehouseId}>{w.code} — {w.nameEn}</option>
            ))}
          </select>
        </AuthFormField>
        <AuthFormField label={t('inventory.transfers.to')} required>
          <select value={toWarehouseId} onChange={(e) => setToWarehouseId(e.target.value)}>
            <option value="">—</option>
            {warehouses.map((w) => (
              <option key={w.warehouseId} value={w.warehouseId}>{w.code} — {w.nameEn}</option>
            ))}
          </select>
        </AuthFormField>
        <AuthFormField label={t('inventory.transfers.notes')}>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
        </AuthFormField>
        <p>{t('inventory.transfers.lines')}</p>
        {lines.map((line, idx) => (
          <div key={idx} className={styles.lineRow}>
            <select value={line.itemId} onChange={(e) => {
              const next = [...lines];
              next[idx] = { ...next[idx], itemId: e.target.value };
              setLines(next);
            }}>
              <option value="">—</option>
              {items.map((item) => (
                <option key={item.itemId} value={item.itemId}>{item.sku} — {itemDisplayName(item, locale)}</option>
              ))}
            </select>
            <input
              type="number"
              min={1}
              value={line.quantity}
              onChange={(e) => {
                const next = [...lines];
                next[idx] = { ...next[idx], quantity: Number(e.target.value) || 1 };
                setLines(next);
              }}
            />
          </div>
        ))}
        <AuthButton variant="secondary" onClick={() => setLines([...lines, { itemId: '', quantity: 1 }])}>
          {t('inventory.transfers.addLine')}
        </AuthButton>
        <AuthButton onClick={() => void handleCreate()} disabled={createMutation.isPending}>
          {t('inventory.form.save')}
        </AuthButton>
      </Modal>

      <Modal
        open={detailTransfer != null}
        title={detailTransfer?.transferNumber ?? ''}
        onClose={() => setDetailTransfer(null)}
      >
        {detailTransfer && (
          <>
            <p>
              {t('inventory.transfers.statusLabel')}:{' '}
              {t(`inventory.transfers.status.${detailTransfer.status}` as 'inventory.transfers.status.DRAFT')}
            </p>
            <p>{detailTransfer.fromWarehouseName} → {detailTransfer.toWarehouseName}</p>
            <ul>
              {detailTransfer.lines.map((line) => (
                <li key={line.lineId}>
                  {line.sku} — {line.quantityReceived}/{line.quantity} {line.unit}
                  {detailTransfer.status === 'IN_TRANSIT' && line.quantityRemaining > 0 && canUpdate && (
                    <AuthButton
                      variant="secondary"
                      onClick={() => {
                        setReceiveLine(line);
                        setReceiveQty(line.quantityRemaining);
                      }}
                    >
                      {t('inventory.transfers.receive')}
                    </AuthButton>
                  )}
                </li>
              ))}
            </ul>
            {detailTransfer.status === 'DRAFT' && canUpdate && (
              <>
                <AuthButton onClick={() => void runTransferAction('ship', detailTransfer)}>
                  {t('inventory.transfers.ship')}
                </AuthButton>
                <AuthButton variant="secondary" onClick={() => void runTransferAction('cancel', detailTransfer)}>
                  {t('inventory.transfers.cancel')}
                </AuthButton>
              </>
            )}
          </>
        )}
      </Modal>

      <Modal open={receiveLine != null} title={t('inventory.transfers.receiveTitle')} onClose={() => setReceiveLine(null)}>
        {receiveLine && (
          <>
            <p>{receiveLine.sku} — {receiveLine.itemName}</p>
            <AuthFormField label={t('inventory.receive.quantity')} required>
              <input
                type="number"
                min={1}
                max={receiveLine.quantityRemaining}
                value={receiveQty}
                onChange={(e) => setReceiveQty(Number(e.target.value) || 1)}
              />
            </AuthFormField>
            <AuthButton onClick={() => void confirmReceive()} disabled={receiveMutation.isPending}>
              {t('inventory.transfers.receive')}
            </AuthButton>
          </>
        )}
      </Modal>
    </div>
  );
}
