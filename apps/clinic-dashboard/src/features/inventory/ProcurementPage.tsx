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
import {
  canApproveInventory,
  canCreateInventory,
  canUpdateInventory,
  canViewInventory,
  itemDisplayName,
  supplierDisplayName,
} from './config/inventory-config';
import { mapInventoryApiError, fetchPurchaseOrder } from './api/inventory-api';
import type { PurchaseOrder, PurchaseOrderLine, PurchaseOrderStatus } from './types/inventory.types';
import {
  useApprovePurchaseOrder,
  useCancelPurchaseOrder,
  useCreatePurchaseOrder,
  useInventoryItems,
  useInventorySuppliersList,
  usePurchaseOrders,
  useReceivePurchaseOrderLine,
  useSubmitPurchaseOrder,
  usePreviewAutoReorder,
  useRunAutoReorder,
  useInventorySummary,
} from './hooks/useInventory';
import { InventoryMetrics } from './components/InventoryMetrics';
import { formatMessage } from '@/i18n/messages';
import styles from './ProcurementPage.module.css';

const STATUS_FILTERS = ['', 'DRAFT', 'PENDING_APPROVAL', 'OPEN', 'RECEIVED', 'CANCELLED'] as const;

function statusBadgeClass(status: PurchaseOrderStatus): string {
  if (status === 'DRAFT') return styles.badge_draft;
  if (status === 'PENDING_APPROVAL') return styles.badge_pending;
  if (status === 'APPROVED' || status === 'PARTIALLY_RECEIVED') return styles.badge_approved;
  if (status === 'RECEIVED') return styles.badge_received;
  return styles.badge_cancelled;
}

export function ProcurementPage() {
  const { t, locale, direction } = useI18n();
  const { user, getValidAccessToken } = useAuth();
  const roles = user?.roles ?? [];
  const perm = useCallback((action: string) => hasPermission(roles, 'api.inventory', action as never), [roles]);

  const [searchParams] = useSearchParams();
  const [statusFilter, setStatusFilter] = useState(() => searchParams.get('status') ?? '');
  const [page, setPage] = useState(1);
  const [createOpen, setCreateOpen] = useState(false);
  const [detailOrder, setDetailOrder] = useState<PurchaseOrder | null>(null);
  const [receiveLine, setReceiveLine] = useState<PurchaseOrderLine | null>(null);
  const [receiveQty, setReceiveQty] = useState(1);
  const [receiveLot, setReceiveLot] = useState('');
  const [receiveExpiry, setReceiveExpiry] = useState('');
  const [errorKey, setErrorKey] = useState<string | null>(null);

  const [supplierId, setSupplierId] = useState('');
  const [notes, setNotes] = useState('');
  const [lines, setLines] = useState([{ itemId: '', quantity: 1, unitCost: '' as number | '' }]);

  const canView = canViewInventory(perm);
  const canCreate = canCreateInventory(perm);
  const canUpdate = canUpdateInventory(perm);
  const canApprove = canApproveInventory(perm);

  const listQuery = usePurchaseOrders({
    status: statusFilter || undefined,
    page,
    enabled: canView,
  });
  const suppliersQuery = useInventorySuppliersList(canView);
  const itemsQuery = useInventoryItems({ page: 1, enabled: createOpen && canView });
  const suppliers = suppliersQuery.data ?? [];
  const items = itemsQuery.data?.items ?? [];

  const createMutation = useCreatePurchaseOrder();
  const submitMutation = useSubmitPurchaseOrder();
  const approveMutation = useApprovePurchaseOrder();
  const cancelMutation = useCancelPurchaseOrder();
  const receiveMutation = useReceivePurchaseOrderLine();
  const reorderPreviewQuery = usePreviewAutoReorder(canView && canCreate);
  const runReorderMutation = useRunAutoReorder();
  const summaryQuery = useInventorySummary(canView);

  const orders = listQuery.data?.orders ?? [];
  const totalPages = Math.max(1, Math.ceil((listQuery.data?.total ?? 0) / (listQuery.data?.limit ?? 20)));

  async function handleCreate() {
    setErrorKey(null);
    const validLines = lines.filter((l) => l.itemId && l.quantity > 0);
    if (validLines.length === 0) {
      setErrorKey('invalidRequest');
      return;
    }
    try {
      const result = await createMutation.mutateAsync({
        supplierId: supplierId || null,
        notes: notes.trim() || null,
        lines: validLines.map((l) => ({
          itemId: l.itemId,
          quantity: l.quantity,
          unitCost: l.unitCost === '' ? null : l.unitCost,
        })),
      });
      setCreateOpen(false);
      setSupplierId('');
      setNotes('');
      setLines([{ itemId: '', quantity: 1, unitCost: '' }]);
      void listQuery.refetch();
      if (result.orderId) {
        const token = await getValidAccessToken();
        if (token && user?.tenantId) {
          const order = await fetchPurchaseOrder(token, user.tenantId, result.orderId);
          setDetailOrder(order);
        }
      }
    } catch (err) {
      setErrorKey(mapInventoryApiError(err));
    }
  }

  async function runOrderAction(action: 'submit' | 'approve' | 'cancel', order: PurchaseOrder) {
    setErrorKey(null);
    try {
      let updated: PurchaseOrder;
      if (action === 'submit') updated = await submitMutation.mutateAsync(order.orderId);
      else if (action === 'approve') updated = await approveMutation.mutateAsync(order.orderId);
      else updated = await cancelMutation.mutateAsync(order.orderId);
      setDetailOrder(updated);
    } catch (err) {
      setErrorKey(mapInventoryApiError(err));
    }
  }

  async function confirmReceive() {
    if (!receiveLine || !detailOrder) return;
    setErrorKey(null);
    try {
      const updated = await receiveMutation.mutateAsync({
        lineId: receiveLine.lineId,
        quantity: receiveQty,
        lotNumber: receiveLot.trim() || undefined,
        expiryDate: receiveExpiry || undefined,
      });
      setDetailOrder(updated);
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
      <nav aria-label={t('inventory.procurement.breadcrumb')}>
        <Link to="/inventory" className={styles.backLink}>
          <ArrowLeft size={16} aria-hidden style={direction === 'rtl' ? { transform: 'scaleX(-1)' } : undefined} />
          {t('inventory.detail.back')}
        </Link>
      </nav>

      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>{t('inventory.procurement.title')}</h1>
          <p className={styles.subtitle}>{t('inventory.procurement.subtitle')}</p>
        </div>
        <div className={styles.headerActions}>
          {canCreate && reorderPreviewQuery.data && reorderPreviewQuery.data.candidateCount > 0 && (
            <AuthButton
              variant="secondary"
              loading={runReorderMutation.isPending}
              onClick={() => {
                void runReorderMutation.mutateAsync({ autoSubmit: false }).then((result) => {
                  if (result.created.length > 0) {
                    void listQuery.refetch();
                    void reorderPreviewQuery.refetch();
                  }
                });
              }}
            >
              {formatMessage(t('inventory.reorder.preview'), {
                count: reorderPreviewQuery.data.candidateCount,
                groups: reorderPreviewQuery.data.purchaseOrderCount,
              })}
            </AuthButton>
          )}
          {canCreate && (
            <AuthButton onClick={() => setCreateOpen(true)}>
              <Plus size={16} aria-hidden />
              {t('inventory.procurement.create')}
            </AuthButton>
          )}
        </div>
      </header>

      <InventoryMetrics
        summary={summaryQuery.data}
        loading={summaryQuery.isLoading}
        onProcurementClick={(status) => {
          setStatusFilter(status ?? '');
          setPage(1);
        }}
      />

      {errorKey && (
        <AuthAlert variant="error">
          {t(`inventory.errors.${errorKey}` as 'inventory.errors.generic')}
        </AuthAlert>
      )}

      <div className={styles.filters} role="group" aria-label={t('inventory.procurement.filters')}>
        {STATUS_FILTERS.map((f) => (
          <button
            key={f || 'all'}
            type="button"
            className={statusFilter === f ? styles.filterActive : styles.filterBtn}
            onClick={() => { setStatusFilter(f); setPage(1); }}
          >
            {f ? t(`inventory.procurement.status.${f}` as 'inventory.procurement.status.DRAFT') : t('inventory.filters.all')}
          </button>
        ))}
      </div>

      {listQuery.isLoading ? (
        <div className={styles.empty} aria-busy="true" />
      ) : orders.length === 0 ? (
        <div className={styles.empty}>{t('inventory.procurement.empty')}</div>
      ) : (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <caption className="sr-only">{t('inventory.procurement.tableCaption')}</caption>
            <thead>
              <tr>
                <th>{t('inventory.procurement.poNumber')}</th>
                <th>{t('inventory.form.supplier')}</th>
                <th>{t('inventory.procurement.statusLabel')}</th>
                <th>{t('inventory.procurement.lines')}</th>
                <th>{t('inventory.procurement.created')}</th>
                <th>{t('inventory.table.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => (
                <tr key={order.orderId}>
                  <td dir="ltr">{order.poNumber}</td>
                  <td>{order.supplierName ?? '—'}</td>
                  <td>
                    <span className={`${styles.badge} ${statusBadgeClass(order.status)}`}>
                      {t(`inventory.procurement.status.${order.status}` as 'inventory.procurement.status.DRAFT')}
                    </span>
                  </td>
                  <td>{order.lines.length}</td>
                  <td>{new Date(order.createdAt).toLocaleDateString(locale)}</td>
                  <td>
                    <AuthButton variant="secondary" onClick={() => setDetailOrder(order)}>
                      {t('inventory.procurement.view')}
                    </AuthButton>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {totalPages > 1 && (
        <nav className={styles.pagination}>
          <AuthButton variant="secondary" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
            {t('inventory.pagination.prev')}
          </AuthButton>
          <span>{page} / {totalPages}</span>
          <AuthButton variant="secondary" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
            {t('inventory.pagination.next')}
          </AuthButton>
        </nav>
      )}

      <Modal open={createOpen} title={t('inventory.procurement.createTitle')} onClose={() => setCreateOpen(false)}>
        <AuthFormField label={t('inventory.form.supplier')}>
          <select value={supplierId} onChange={(e) => setSupplierId(e.target.value)}>
            <option value="">{t('inventory.form.supplierNone')}</option>
            {suppliers.map((s) => (
              <option key={s.supplierId} value={s.supplierId}>
                {supplierDisplayName(s, locale)} ({s.code})
              </option>
            ))}
          </select>
        </AuthFormField>
        <AuthFormField label={t('inventory.procurement.notes')}>
          <textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </AuthFormField>
        <p>{t('inventory.procurement.lines')}</p>
        {lines.map((line, idx) => (
          <div key={idx} className={styles.lineRow}>
            <AuthFormField label={t('inventory.table.name')}>
              <select
                value={line.itemId}
                onChange={(e) =>
                  setLines((rows) => rows.map((r, i) => (i === idx ? { ...r, itemId: e.target.value } : r)))
                }
              >
                <option value="">—</option>
                {items.map((item) => (
                  <option key={item.itemId} value={item.itemId}>
                    {item.sku} — {itemDisplayName(item, locale)}
                  </option>
                ))}
              </select>
            </AuthFormField>
            <AuthFormField label={t('inventory.receive.quantity')}>
              <input
                type="number"
                min={1}
                value={line.quantity}
                onChange={(e) =>
                  setLines((rows) =>
                    rows.map((r, i) => (i === idx ? { ...r, quantity: Number(e.target.value) || 1 } : r)),
                  )
                }
              />
            </AuthFormField>
            <AuthFormField label={t('inventory.form.cost')}>
              <input
                type="number"
                min={0}
                step="0.01"
                value={line.unitCost}
                onChange={(e) =>
                  setLines((rows) =>
                    rows.map((r, i) =>
                      i === idx ? { ...r, unitCost: e.target.value === '' ? '' : Number(e.target.value) } : r,
                    ),
                  )
                }
              />
            </AuthFormField>
            {lines.length > 1 && (
              <AuthButton variant="ghost" onClick={() => setLines((rows) => rows.filter((_, i) => i !== idx))}>
                ×
              </AuthButton>
            )}
          </div>
        ))}
        <AuthButton variant="secondary" onClick={() => setLines((rows) => [...rows, { itemId: '', quantity: 1, unitCost: '' }])}>
          {t('inventory.procurement.addLine')}
        </AuthButton>
        <div className={styles.modalActions}>
          <AuthButton variant="ghost" onClick={() => setCreateOpen(false)}>{t('inventory.form.cancel')}</AuthButton>
          <AuthButton loading={createMutation.isPending} onClick={() => void handleCreate()}>
            {t('inventory.form.save')}
          </AuthButton>
        </div>
      </Modal>

      <Modal
        open={detailOrder != null}
        title={detailOrder ? `${detailOrder.poNumber}` : ''}
        onClose={() => setDetailOrder(null)}
      >
        {detailOrder && (
          <>
            <p>
              {t('inventory.form.supplier')}: {detailOrder.supplierName ?? '—'}
            </p>
            <p>
              {t('inventory.procurement.statusLabel')}:{' '}
              {t(`inventory.procurement.status.${detailOrder.status}` as 'inventory.procurement.status.DRAFT')}
            </p>
            {detailOrder.notes && <p>{detailOrder.notes}</p>}

            <div className={styles.detailLines}>
              {detailOrder.lines.map((line) => (
                <div key={line.lineId} className={styles.detailLine}>
                  <div>
                    <strong>{line.sku}</strong> — {line.itemName}
                    <br />
                    {line.quantityReceived} / {line.quantityOrdered} {line.unit}
                  </div>
                  {canUpdate &&
                    ['APPROVED', 'PARTIALLY_RECEIVED'].includes(detailOrder.status) &&
                    line.quantityRemaining > 0 && (
                      <AuthButton
                        variant="secondary"
                        onClick={() => {
                          setReceiveLine(line);
                          setReceiveQty(line.quantityRemaining);
                          setReceiveLot('');
                          setReceiveExpiry('');
                        }}
                      >
                        {t('inventory.procurement.receive')}
                      </AuthButton>
                    )}
                </div>
              ))}
            </div>

            <div className={styles.modalActions}>
              {canUpdate && detailOrder.status === 'DRAFT' && (
                <AuthButton loading={submitMutation.isPending} onClick={() => void runOrderAction('submit', detailOrder)}>
                  {t('inventory.procurement.submit')}
                </AuthButton>
              )}
              {canApprove && detailOrder.status === 'PENDING_APPROVAL' && (
                <AuthButton loading={approveMutation.isPending} onClick={() => void runOrderAction('approve', detailOrder)}>
                  {t('inventory.procurement.approve')}
                </AuthButton>
              )}
              {canUpdate && ['DRAFT', 'PENDING_APPROVAL', 'APPROVED'].includes(detailOrder.status) && (
                <AuthButton variant="ghost" loading={cancelMutation.isPending} onClick={() => void runOrderAction('cancel', detailOrder)}>
                  {t('inventory.procurement.cancel')}
                </AuthButton>
              )}
            </div>
          </>
        )}
      </Modal>

      <Modal open={receiveLine != null} title={t('inventory.procurement.receiveTitle')} onClose={() => setReceiveLine(null)}>
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
            <AuthFormField label={t('inventory.receive.lot')}>
              <input value={receiveLot} onChange={(e) => setReceiveLot(e.target.value)} />
            </AuthFormField>
            <AuthFormField label={t('inventory.receive.expiryDate')}>
              <input type="date" value={receiveExpiry} onChange={(e) => setReceiveExpiry(e.target.value)} />
            </AuthFormField>
            <div className={styles.modalActions}>
              <AuthButton variant="ghost" onClick={() => setReceiveLine(null)}>{t('inventory.form.cancel')}</AuthButton>
              <AuthButton loading={receiveMutation.isPending} onClick={() => void confirmReceive()}>
                {t('inventory.receive.confirm')}
              </AuthButton>
            </div>
          </>
        )}
      </Modal>
    </div>
  );
}
