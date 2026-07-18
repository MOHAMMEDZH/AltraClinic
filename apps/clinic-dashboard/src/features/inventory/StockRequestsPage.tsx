import { useCallback, useEffect, useState } from 'react';
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
  canRequestInventory,
  canCreateInventory,
  canUpdateInventory,
  canViewInventory,
  itemDisplayName,
  resolveInventoryWorkspaceMode,
} from './config/inventory-config';
import { fetchStockRequest, mapInventoryApiError } from './api/inventory-api';
import type { InventoryItem, StockRequest, StockRequestLine } from './types/inventory.types';
import {
  useApproveStockRequest,
  useCancelStockRequest,
  useCreateStockRequest,
  useFulfillStockRequestLine,
  useInventoryItems,
  useRejectStockRequest,
  useStockRequests,
  useSubmitStockRequest,
  useConvertStockRequestToPo,
  useInventorySuppliersList,
} from './hooks/useInventory';
import styles from './StockRequestsPage.module.css';

const STATUS_FILTERS = ['', 'OPEN', 'DRAFT', 'SUBMITTED', 'APPROVED', 'FULFILLED', 'REJECTED', 'CANCELLED'] as const;

function statusBadgeClass(status: StockRequest['status']): string {
  if (status === 'DRAFT') return styles.badge_draft;
  if (status === 'SUBMITTED' || status === 'APPROVED') return styles.badge_pending;
  if (status === 'FULFILLED') return styles.badge_received;
  return styles.badge_cancelled;
}

interface DraftLine {
  itemId: string;
  sku: string;
  name: string;
  quantity: number;
}

export function StockRequestsPage() {
  const { t, locale, direction } = useI18n();
  const { user, getValidAccessToken } = useAuth();
  const roles = user?.roles ?? [];
  const perm = useCallback((action: string) => hasPermission(roles, 'api.inventory', action as never), [roles]);
  const workspaceMode = resolveInventoryWorkspaceMode(roles);
  const userId = user?.userId ?? '';

  const [searchParams] = useSearchParams();
  const [statusFilter, setStatusFilter] = useState(() => searchParams.get('status') ?? '');
  const [myOnly, setMyOnly] = useState(workspaceMode === 'clinical');
  const [page, setPage] = useState(1);
  const [createOpen, setCreateOpen] = useState(false);
  const [detailRequest, setDetailRequest] = useState<StockRequest | null>(null);
  const [errorKey, setErrorKey] = useState<string | null>(null);

  const [requestType, setRequestType] = useState<'DEPARTMENT' | 'CLINICAL'>(
    workspaceMode === 'clinical' ? 'CLINICAL' : 'DEPARTMENT',
  );
  const [departmentName, setDepartmentName] = useState('');
  const [notes, setNotes] = useState('');
  const [itemSearch, setItemSearch] = useState('');
  const [debouncedItemQ, setDebouncedItemQ] = useState('');
  const [draftLines, setDraftLines] = useState<DraftLine[]>([]);
  const [pickQty, setPickQty] = useState(1);
  const [rejectReason, setRejectReason] = useState('');
  const [fulfillQty, setFulfillQty] = useState<Record<string, number>>({});
  const [poSupplierId, setPoSupplierId] = useState('');

  useEffect(() => {
    const tmr = setTimeout(() => setDebouncedItemQ(itemSearch.trim()), 300);
    return () => clearTimeout(tmr);
  }, [itemSearch]);

  const canView = canViewInventory(perm);
  const canRequest = canRequestInventory(perm);
  const canFulfill = canUpdateInventory(perm);
  const canApprove = canApproveInventory(perm);

  const listQuery = useStockRequests({
    status: statusFilter || undefined,
    requestedBy: myOnly && userId ? userId : undefined,
    page,
    enabled: canView,
  });
  const itemsQuery = useInventoryItems({
    q: debouncedItemQ,
    status: 'active',
    page: 1,
    enabled: createOpen && debouncedItemQ.length >= 1,
  });

  const createMutation = useCreateStockRequest();
  const submitMutation = useSubmitStockRequest();
  const approveMutation = useApproveStockRequest();
  const rejectMutation = useRejectStockRequest();
  const cancelMutation = useCancelStockRequest();
  const fulfillMutation = useFulfillStockRequestLine();
  const convertToPoMutation = useConvertStockRequestToPo();
  const suppliersQuery = useInventorySuppliersList(canView);

  const requests = listQuery.data?.requests ?? [];
  const totalPages = Math.max(1, Math.ceil((listQuery.data?.total ?? 0) / (listQuery.data?.limit ?? 20)));
  const searchItems = itemsQuery.data?.items ?? [];

  function addLine(item: InventoryItem) {
    if (draftLines.some((l) => l.itemId === item.itemId)) return;
    setDraftLines((prev) => [
      ...prev,
      {
        itemId: item.itemId,
        sku: item.sku,
        name: itemDisplayName(item, locale),
        quantity: pickQty,
      },
    ]);
    setItemSearch('');
    setPickQty(1);
  }

  async function handleCreate() {
    setErrorKey(null);
    if (draftLines.length === 0) {
      setErrorKey('invalidRequest');
      return;
    }
    try {
      const result = await createMutation.mutateAsync({
        requestType,
        departmentName: departmentName.trim() || null,
        notes: notes.trim() || null,
        lines: draftLines.map((l) => ({ itemId: l.itemId, quantity: l.quantity })),
      });
      setCreateOpen(false);
      setDraftLines([]);
      setDepartmentName('');
      setNotes('');
      const token = await getValidAccessToken();
      if (token && user?.tenantId && result.requestId) {
        const req = await fetchStockRequest(token, user.tenantId, result.requestId);
        setDetailRequest(req);
      }
      void listQuery.refetch();
    } catch (err) {
      setErrorKey(mapInventoryApiError(err));
    }
  }

  async function runAction(
    action: 'submit' | 'approve' | 'reject' | 'cancel' | 'fulfill-all',
    request: StockRequest,
  ) {
    setErrorKey(null);
    try {
      let updated: StockRequest;
      if (action === 'submit') updated = await submitMutation.mutateAsync(request.requestId);
      else if (action === 'approve') updated = await approveMutation.mutateAsync(request.requestId);
      else if (action === 'reject') updated = await rejectMutation.mutateAsync({ requestId: request.requestId, reason: rejectReason });
      else if (action === 'cancel') updated = await cancelMutation.mutateAsync(request.requestId);
      else {
        updated = request;
        for (const line of request.lines) {
          if (line.quantityRemaining <= 0) continue;
          const qty = fulfillQty[line.lineId] ?? line.quantityRemaining;
          updated = await fulfillMutation.mutateAsync({ lineId: line.lineId, quantity: qty });
        }
      }
      setDetailRequest(updated);
      void listQuery.refetch();
    } catch (err) {
      setErrorKey(mapInventoryApiError(err));
    }
  }

  async function convertToPo(request: StockRequest) {
    setErrorKey(null);
    try {
      await convertToPoMutation.mutateAsync({
        requestId: request.requestId,
        supplierId: poSupplierId || null,
      });
      setDetailRequest(null);
      void listQuery.refetch();
      window.location.assign('/inventory/procurement?status=DRAFT');
    } catch (err) {
      setErrorKey(mapInventoryApiError(err));
    }
  }

  async function fulfillLine(line: StockRequestLine) {
    setErrorKey(null);
    const qty = fulfillQty[line.lineId] ?? line.quantityRemaining;
    try {
      const updated = await fulfillMutation.mutateAsync({ lineId: line.lineId, quantity: qty });
      setDetailRequest(updated);
      void listQuery.refetch();
    } catch (err) {
      setErrorKey(mapInventoryApiError(err));
    }
  }

  if (!canView) {
    return <AuthAlert variant="error">{t('inventory.accessDenied')}</AuthAlert>;
  }

  return (
    <div className={styles.page}>
      <Link to="/inventory" className={styles.backLink}>
        <ArrowLeft size={16} aria-hidden style={direction === 'rtl' ? { transform: 'scaleX(-1)' } : undefined} />
        {t('inventory.title')}
      </Link>

      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>{t('inventory.stockRequests.title')}</h1>
          <p className={styles.subtitle}>{t('inventory.stockRequests.subtitle')}</p>
        </div>
        {canRequest && workspaceMode !== 'lookup' && (
          <AuthButton onClick={() => setCreateOpen(true)}>
            <Plus size={16} aria-hidden />
            {t('inventory.stockRequests.create')}
          </AuthButton>
        )}
      </header>

      {workspaceMode === 'clinical' && (
        <p className={styles.workspaceBanner}>{t('inventory.stockRequests.workspaceClinical')}</p>
      )}
      {(workspaceMode === 'operations' || workspaceMode === 'management') && (
        <p className={styles.workspaceBanner}>
          {workspaceMode === 'management'
            ? t('inventory.stockRequests.workspaceManagement')
            : t('inventory.stockRequests.workspaceOperations')}
        </p>
      )}
      {workspaceMode === 'lookup' && (
        <p className={styles.workspaceBanner}>{t('inventory.stockRequests.workspaceLookup')}</p>
      )}

      {errorKey && (
        <AuthAlert variant="error">
          {t(`inventory.errors.${errorKey}` as 'inventory.errors.generic')}
        </AuthAlert>
      )}

      <div className={styles.filters} role="group" aria-label={t('inventory.stockRequests.filters')}>
        {STATUS_FILTERS.map((s) => (
          <button
            key={s || 'all'}
            type="button"
            className={statusFilter === s ? styles.filterActive : styles.filterBtn}
            onClick={() => { setStatusFilter(s); setPage(1); }}
          >
            {s ? t(`inventory.stockRequests.status.${s}` as 'inventory.stockRequests.status.DRAFT') : t('inventory.filters.all')}
          </button>
        ))}
        {canRequest && (
          <button
            type="button"
            className={myOnly ? styles.filterActive : styles.filterBtn}
            aria-pressed={myOnly}
            onClick={() => { setMyOnly((v) => !v); setPage(1); }}
          >
            {t('inventory.stockRequests.myRequests')}
          </button>
        )}
      </div>

      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <caption className="sr-only">{t('inventory.stockRequests.tableCaption')}</caption>
          <thead>
            <tr>
              <th scope="col">{t('inventory.stockRequests.requestNumber')}</th>
              <th scope="col">{t('inventory.stockRequests.type')}</th>
              <th scope="col">{t('inventory.stockRequests.statusLabel')}</th>
              <th scope="col">{t('inventory.stockRequests.lines')}</th>
              <th scope="col">{t('inventory.stockRequests.created')}</th>
              <th scope="col">{t('inventory.stockRequests.view')}</th>
            </tr>
          </thead>
          <tbody>
            {requests.map((row) => (
              <tr key={row.requestId}>
                <td>{row.requestNumber}</td>
                <td>{t(`inventory.stockRequests.types.${row.requestType}` as 'inventory.stockRequests.types.DEPARTMENT')}</td>
                <td>
                  <span className={statusBadgeClass(row.status)}>
                    {t(`inventory.stockRequests.status.${row.status}` as 'inventory.stockRequests.status.DRAFT')}
                  </span>
                </td>
                <td>{row.metrics.lineCount}</td>
                <td>{new Date(row.createdAt).toLocaleDateString(locale)}</td>
                <td>
                  <AuthButton variant="ghost" onClick={() => setDetailRequest(row)}>
                    {t('inventory.stockRequests.view')}
                  </AuthButton>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {requests.length === 0 && !listQuery.isLoading && (
          <p className={styles.empty}>{t('inventory.stockRequests.empty')}</p>
        )}
      </div>

      {totalPages > 1 && (
        <div className={styles.pagination}>
          <AuthButton variant="ghost" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
            {t('inventory.pagination.prev')}
          </AuthButton>
          <span>{page} / {totalPages}</span>
          <AuthButton variant="ghost" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
            {t('inventory.pagination.next')}
          </AuthButton>
        </div>
      )}

      {createOpen && (
        <Modal open={createOpen} title={t('inventory.stockRequests.createTitle')} onClose={() => setCreateOpen(false)}>
          <label className={styles.subtitle} htmlFor="req-type">{t('inventory.stockRequests.type')}</label>
          <select
            id="req-type"
            value={requestType}
            onChange={(e) => setRequestType(e.target.value as 'DEPARTMENT' | 'CLINICAL')}
            style={{ width: '100%', marginBottom: 'var(--space-3)', padding: 'var(--space-2)' }}
          >
            <option value="DEPARTMENT">{t('inventory.stockRequests.types.DEPARTMENT')}</option>
            <option value="CLINICAL">{t('inventory.stockRequests.types.CLINICAL')}</option>
          </select>
          {requestType === 'DEPARTMENT' && (
            <AuthFormField label={t('inventory.stockRequests.department')} value={departmentName} onChange={(e) => setDepartmentName(e.target.value)} />
          )}
          <AuthFormField label={t('inventory.stockRequests.notes')} value={notes} onChange={(e) => setNotes(e.target.value)} />
          <div className={styles.addLineRow}>
            <AuthFormField label={t('inventory.stockRequests.searchItem')} value={itemSearch} onChange={(e) => setItemSearch(e.target.value)} placeholder={t('inventory.searchPlaceholder')} />
            <AuthFormField label={t('inventory.stockRequests.quantity')} type="number" min={1} value={pickQty} onChange={(e) => setPickQty(Number(e.target.value))} />
          </div>
          {searchItems.length > 0 && (
            <ul className={styles.linePicker}>
              {searchItems.slice(0, 8).map((item) => (
                <li key={item.itemId}>
                  <AuthButton variant="ghost" onClick={() => addLine(item)}>
                    {item.sku} — {itemDisplayName(item, locale)} ({item.quantityOnHand} {item.unit})
                  </AuthButton>
                </li>
              ))}
            </ul>
          )}
          {draftLines.length > 0 && (
            <div className={styles.linePicker}>
              {draftLines.map((line) => (
                <div key={line.itemId} className={styles.lineRow}>
                  <span>{line.sku} — {line.name}</span>
                  <span>{line.quantity}</span>
                </div>
              ))}
            </div>
          )}
          <div className={styles.modalActions}>
            <AuthButton variant="ghost" onClick={() => setCreateOpen(false)}>{t('inventory.procurement.cancel')}</AuthButton>
            <AuthButton loading={createMutation.isPending} onClick={() => void handleCreate()}>{t('inventory.stockRequests.create')}</AuthButton>
          </div>
        </Modal>
      )}

      {detailRequest && (
        <Modal open={Boolean(detailRequest)} title={detailRequest.requestNumber} onClose={() => setDetailRequest(null)}>
          <p>
            <span className={statusBadgeClass(detailRequest.status)}>
              {t(`inventory.stockRequests.status.${detailRequest.status}` as 'inventory.stockRequests.status.DRAFT')}
            </span>
          </p>
          {detailRequest.notes && <p>{detailRequest.notes}</p>}
          {detailRequest.rejectionReason && (
            <AuthAlert variant="warning">{detailRequest.rejectionReason}</AuthAlert>
          )}
          {detailRequest.lines.map((line) => (
            <div key={line.lineId} className={styles.lineRow}>
              <span>{line.sku} — {line.itemName}</span>
              <span>{line.quantityFulfilled} / {line.quantityRequested} {line.unit}</span>
              {detailRequest.status === 'APPROVED' && line.quantityRemaining > 0 && canFulfill && (
                <>
                  <input
                    type="number"
                    min={0.0001}
                    max={line.quantityRemaining}
                    className={styles.filterBtn}
                    value={fulfillQty[line.lineId] ?? line.quantityRemaining}
                    onChange={(e) => setFulfillQty((prev) => ({ ...prev, [line.lineId]: Number(e.target.value) }))}
                    aria-label={t('inventory.stockRequests.quantity')}
                  />
                  <AuthButton loading={fulfillMutation.isPending} onClick={() => void fulfillLine(line)}>
                    {t('inventory.stockRequests.fulfill')}
                  </AuthButton>
                </>
              )}
            </div>
          ))}
          <div className={styles.modalActions}>
            {(detailRequest.status === 'APPROVED' || detailRequest.status === 'FULFILLED') &&
              detailRequest.lines.some((l) => l.quantityRemaining > 0) &&
              canCreateInventory(perm) && (
              <>
                <AuthFormField label={t('inventory.form.supplier')}>
                  <select value={poSupplierId} onChange={(e) => setPoSupplierId(e.target.value)}>
                    <option value="">{t('inventory.form.supplierNone')}</option>
                    {(suppliersQuery.data ?? []).map((s) => (
                      <option key={s.supplierId} value={s.supplierId}>{s.code} — {s.nameEn}</option>
                    ))}
                  </select>
                </AuthFormField>
                <AuthButton loading={convertToPoMutation.isPending} onClick={() => void convertToPo(detailRequest)}>
                  {t('inventory.stockRequests.convertToPo')}
                </AuthButton>
              </>
            )}
            {detailRequest.status === 'DRAFT' && canRequest && (
              <AuthButton loading={submitMutation.isPending} onClick={() => void runAction('submit', detailRequest)}>
                {t('inventory.stockRequests.submit')}
              </AuthButton>
            )}
            {detailRequest.status === 'SUBMITTED' && canApprove && (
              <>
                <AuthFormField label={t('inventory.stockRequests.rejectReason')} value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} />
                <AuthButton variant="ghost" loading={rejectMutation.isPending} onClick={() => void runAction('reject', detailRequest)}>
                  {t('inventory.stockRequests.reject')}
                </AuthButton>
                <AuthButton loading={approveMutation.isPending} onClick={() => void runAction('approve', detailRequest)}>
                  {t('inventory.stockRequests.approve')}
                </AuthButton>
              </>
            )}
            {(detailRequest.status === 'DRAFT' || detailRequest.status === 'SUBMITTED') && canRequest && (
              <AuthButton variant="ghost" loading={cancelMutation.isPending} onClick={() => void runAction('cancel', detailRequest)}>
                {t('inventory.stockRequests.cancel')}
              </AuthButton>
            )}
          </div>
        </Modal>
      )}
    </div>
  );
}
