import { useCallback, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Edit, Package } from 'lucide-react';
import { hasPermission } from '@booking/permissions';
import { useI18n } from '@booking/i18n/react';
import { useAuth } from '@/app/providers/AuthProvider';
import { AuthButton } from '@/features/auth/components/AuthButton';
import { AuthAlert } from '@/features/auth/components/AuthAlert';
import { AuthFormField } from '@/features/auth/components/AuthFormField';
import { Modal } from '@/features/patients/components/Modal';
import { ItemForm, itemFormToApiBody } from './components/ItemForm';
import { StockMovementTimeline } from './components/StockMovementTimeline';
import { BatchList } from './components/BatchList';
import { mapInventoryApiError } from './api/inventory-api';
import {
  canUpdateInventory,
  canViewInventory,
  formatCurrency,
  formatInventoryDate,
  categoryDisplayName,
  itemDisplayName,
  supplierDisplayName,
  stockStatus,
} from './config/inventory-config';
import {
  useAdjustInventoryItem,
  useConsumeInventoryItem,
  useInventoryCategories,
  useInventorySuppliersList,
  useInventoryItem,
  useInventoryMovements,
  useReceiveInventoryItem,
  useUpdateInventoryItem,
  useInventoryItemBatches,
  useDisposeInventoryBatch,
  useItemWarehouseStock,
} from './hooks/useInventory';
import styles from './InventoryItemDetailPage.module.css';

export function InventoryItemDetailPage() {
  const { itemId } = useParams<{ itemId: string }>();
  const { t, locale, direction } = useI18n();
  const { user } = useAuth();
  const roles = user?.roles ?? [];
  const perm = useCallback((action: string) => hasPermission(roles, 'api.inventory', action as never), [roles]);

  const [editOpen, setEditOpen] = useState(false);
  const [stockMode, setStockMode] = useState<'consume' | 'receive' | 'adjust' | null>(null);
  const [stockQty, setStockQty] = useState(1);
  const [adjustQty, setAdjustQty] = useState(0);
  const [adjustReason, setAdjustReason] = useState('');
  const [stockNotes, setStockNotes] = useState('');
  const [receiveLot, setReceiveLot] = useState('');
  const [receiveMfgDate, setReceiveMfgDate] = useState('');
  const [receiveExpiryDate, setReceiveExpiryDate] = useState('');
  const [errorKey, setErrorKey] = useState<string | null>(null);
  const [movementPage, setMovementPage] = useState(1);

  const canView = canViewInventory(perm);
  const itemQuery = useInventoryItem(itemId, canView);
  const categoriesQuery = useInventoryCategories(canView);
  const suppliersQuery = useInventorySuppliersList(canView);
  const movementsQuery = useInventoryMovements({ itemId, page: movementPage, enabled: canView && Boolean(itemId) });
  const batchesQuery = useInventoryItemBatches(itemId, canView);
  const warehouseStockQuery = useItemWarehouseStock(itemId, canView);

  const updateMutation = useUpdateInventoryItem();
  const consumeMutation = useConsumeInventoryItem();
  const receiveMutation = useReceiveInventoryItem();
  const adjustMutation = useAdjustInventoryItem();
  const disposeMutation = useDisposeInventoryBatch();

  const item = itemQuery.data;
  const categories = categoriesQuery.data ?? [];
  const suppliers = suppliersQuery.data ?? [];
  const category = item?.categoryId ? categories.find((c) => c.categoryId === item.categoryId) : null;
  const supplier = item?.supplierId ? suppliers.find((s) => s.supplierId === item.supplierId) : null;
  const status = item ? stockStatus(item) : 'ok';
  const movementTotalPages = Math.max(
    1,
    Math.ceil((movementsQuery.data?.total ?? 0) / (movementsQuery.data?.limit ?? 20)),
  );

  async function handleUpdate(values: Parameters<typeof itemFormToApiBody>[0]) {
    if (!item) return;
    setErrorKey(null);
    try {
      await updateMutation.mutateAsync({
        itemId: item.itemId,
        body: itemFormToApiBody(values, 'edit'),
      });
      setEditOpen(false);
    } catch (err) {
      setErrorKey(mapInventoryApiError(err));
    }
  }

  async function handleStockAction() {
    if (!item || !stockMode) return;
    setErrorKey(null);
    try {
      if (stockMode === 'consume') {
        await consumeMutation.mutateAsync({
          itemId: item.itemId,
          quantity: stockQty,
          notes: stockNotes.trim() || undefined,
        });
      } else if (stockMode === 'receive') {
        await receiveMutation.mutateAsync({
          itemId: item.itemId,
          quantity: stockQty,
          notes: stockNotes.trim() || undefined,
          lotNumber: receiveLot.trim() || undefined,
          manufacturedDate: receiveMfgDate || undefined,
          expiryDate: receiveExpiryDate || undefined,
        });
      } else {
        await adjustMutation.mutateAsync({
          itemId: item.itemId,
          quantityAfter: adjustQty,
          reason: adjustReason.trim(),
          notes: stockNotes.trim() || undefined,
        });
      }
      setStockMode(null);
      setStockQty(1);
      setStockNotes('');
      setReceiveLot('');
      setReceiveMfgDate('');
      setReceiveExpiryDate('');
      setAdjustReason('');
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

  if (itemQuery.isLoading) {
    return <div className={styles.page} aria-busy="true" />;
  }

  if (itemQuery.isError || !item) {
    return (
      <div className={styles.page}>
        <AuthAlert variant="error">{t('inventory.errors.notFound')}</AuthAlert>
        <Link to="/inventory/catalog" className={styles.backLink}>
          {t('inventory.detail.back')}
        </Link>
      </div>
    );
  }

  const BackIcon = direction === 'rtl' ? ArrowLeft : ArrowLeft;

  return (
    <div className={styles.page}>
      <nav className={styles.breadcrumb} aria-label={t('inventory.detail.breadcrumb')}>
        <Link to="/inventory/catalog" className={styles.backLink}>
          <BackIcon size={16} aria-hidden style={direction === 'rtl' ? { transform: 'scaleX(-1)' } : undefined} />
          {t('inventory.detail.back')}
        </Link>
      </nav>

      <header className={styles.header}>
        <div className={styles.headerMain}>
          <span className={styles.iconWrap} aria-hidden>
            <Package size={22} />
          </span>
          <div>
            <h1 className={styles.title}>{itemDisplayName(item, locale)}</h1>
            <p className={styles.subtitle}>
              {item.sku} · {t(`inventory.status.${status}`)}
            </p>
          </div>
        </div>
        {canUpdateInventory(perm) && !item.archivedAt && (
          <div className={styles.headerActions}>
            <AuthButton variant="secondary" onClick={() => setEditOpen(true)}>
              <Edit size={16} aria-hidden />
              {t('inventory.form.editAction')}
            </AuthButton>
            <AuthButton variant="secondary" onClick={() => { setStockMode('receive'); setStockQty(1); }}>
              {t('inventory.receive.title')}
            </AuthButton>
            <AuthButton variant="secondary" onClick={() => { setStockMode('consume'); setStockQty(1); }}>
              {t('inventory.consume.title')}
            </AuthButton>
            <AuthButton onClick={() => { setStockMode('adjust'); setAdjustQty(item.quantityOnHand); }}>
              {t('inventory.adjust.title')}
            </AuthButton>
          </div>
        )}
      </header>

      {errorKey && (
        <AuthAlert variant="error">
          {t(`inventory.errors.${errorKey}` as 'inventory.errors.generic')}
        </AuthAlert>
      )}

      <section className={styles.grid} aria-labelledby="inv-detail-overview">
        <div className={styles.panel}>
          <h2 id="inv-detail-overview" className={styles.panelTitle}>
            {t('inventory.detail.overview')}
          </h2>
          <dl className={styles.facts}>
            <div>
              <dt>{t('inventory.form.category')}</dt>
              <dd>{category ? categoryDisplayName(category, locale) : '—'}</dd>
            </div>
            <div>
              <dt>{t('inventory.form.supplier')}</dt>
              <dd>{supplier ? supplierDisplayName(supplier, locale) : '—'}</dd>
            </div>
            <div>
              <dt>{t('inventory.form.barcode')}</dt>
              <dd dir="ltr">{item.barcode ?? '—'}</dd>
            </div>
            <div>
              <dt>{t('inventory.form.brand')}</dt>
              <dd>{item.brand ?? '—'}</dd>
            </div>
            <div>
              <dt>{t('inventory.table.quantity')}</dt>
              <dd className={styles.qtyValue}>
                {item.quantityOnHand} {item.unit}
              </dd>
            </div>
            <div>
              <dt>{t('inventory.form.minQuantity')}</dt>
              <dd>{item.minQuantity ?? '—'}</dd>
            </div>
            <div>
              <dt>{t('inventory.table.reorder')}</dt>
              <dd>{item.reorderThreshold}</dd>
            </div>
            <div>
              <dt>{t('inventory.form.maxQuantity')}</dt>
              <dd>{item.maxQuantity ?? '—'}</dd>
            </div>
            <div>
              <dt>{t('inventory.form.storageLocation')}</dt>
              <dd>{item.storageLocation ?? '—'}</dd>
            </div>
            <div>
              <dt>{t('inventory.table.expiry')}</dt>
              <dd>{formatInventoryDate(item.expiryDate, locale)}</dd>
            </div>
            <div>
              <dt>{t('inventory.form.lot')}</dt>
              <dd>{item.lotNumber ?? '—'}</dd>
            </div>
            <div>
              <dt>{t('inventory.form.cost')}</dt>
              <dd>{item.costPerUnit != null ? formatCurrency(item.costPerUnit, locale) : '—'}</dd>
            </div>
            <div>
              <dt>{t('inventory.form.sellingPrice')}</dt>
              <dd>{item.sellingPrice != null ? formatCurrency(item.sellingPrice, locale) : '—'}</dd>
            </div>
            <div>
              <dt>{t('inventory.detail.updated')}</dt>
              <dd>{formatInventoryDate(item.updatedAt, locale)}</dd>
            </div>
          </dl>
        </div>

        <div className={styles.panel}>
          <h2 className={styles.panelTitle}>{t('inventory.detail.movements')}</h2>
          <StockMovementTimeline
            movements={movementsQuery.data?.movements ?? []}
            loading={movementsQuery.isLoading}
          />
          {movementTotalPages > 1 && (
            <nav className={styles.movementPagination}>
              <AuthButton variant="secondary" disabled={movementPage <= 1} onClick={() => setMovementPage((p) => p - 1)}>
                {t('inventory.pagination.prev')}
              </AuthButton>
              <span>{movementPage} / {movementTotalPages}</span>
              <AuthButton variant="secondary" disabled={movementPage >= movementTotalPages} onClick={() => setMovementPage((p) => p + 1)}>
                {t('inventory.pagination.next')}
              </AuthButton>
            </nav>
          )}
        </div>
      </section>

      <section className={styles.panel} aria-labelledby="inv-detail-batches">
        <h2 id="inv-detail-batches" className={styles.panelTitle}>
          {t('inventory.batches.title')}
        </h2>
        <BatchList
          batches={batchesQuery.data ?? []}
          loading={batchesQuery.isLoading}
          canDispose={canUpdateInventory(perm)}
          disposing={disposeMutation.isPending}
          onDispose={async (batchId, quantity, reason, notes) => {
            await disposeMutation.mutateAsync({ batchId, quantity, reason, notes });
          }}
        />
      </section>

      {(warehouseStockQuery.data?.stock.length ?? 0) > 0 && (
        <section className={styles.panel} aria-labelledby="inv-detail-warehouses">
          <h2 id="inv-detail-warehouses" className={styles.panelTitle}>
            {t('inventory.detail.warehouseStock')}
          </h2>
          <dl className={styles.facts}>
            {warehouseStockQuery.data?.stock.map((row) => (
              <div key={row.warehouseId}>
                <dt>{row.warehouseCode} — {row.warehouseName}</dt>
                <dd>{row.quantityOnHand} {row.unit}</dd>
              </div>
            ))}
          </dl>
        </section>
      )}

      <Modal open={editOpen} title={t('inventory.form.editTitle')} onClose={() => setEditOpen(false)}>
        <ItemForm
          mode="edit"
          initial={item}
          categories={categories}
          suppliers={suppliers}
          loading={updateMutation.isPending}
          onSubmit={(v) => void handleUpdate(v)}
          onCancel={() => setEditOpen(false)}
        />
      </Modal>

      <Modal
        open={stockMode != null}
        title={
          stockMode === 'consume'
            ? t('inventory.consume.title')
            : stockMode === 'receive'
              ? t('inventory.receive.title')
              : t('inventory.adjust.title')
        }
        onClose={() => setStockMode(null)}
      >
        {stockMode === 'adjust' ? (
          <>
            <AuthFormField label={t('inventory.adjust.quantityAfter')} required>
              <input
                type="number"
                min={0}
                value={adjustQty}
                onChange={(e) => setAdjustQty(Number(e.target.value) || 0)}
              />
            </AuthFormField>
            <AuthFormField label={t('inventory.adjust.reason')} required>
              <input value={adjustReason} onChange={(e) => setAdjustReason(e.target.value)} />
            </AuthFormField>
            <AuthFormField label={t('inventory.adjust.notes')}>
              <textarea rows={2} value={stockNotes} onChange={(e) => setStockNotes(e.target.value)} />
            </AuthFormField>
          </>
        ) : (
          <>
            <AuthFormField
              label={stockMode === 'consume' ? t('inventory.consume.quantity') : t('inventory.receive.quantity')}
              required
            >
              <input
                type="number"
                min={1}
                max={stockMode === 'consume' ? item.quantityOnHand : undefined}
                value={stockQty}
                onChange={(e) => setStockQty(Number(e.target.value) || 1)}
              />
            </AuthFormField>
            <AuthFormField label={stockMode === 'consume' ? t('inventory.consume.notes') : t('inventory.receive.notes')}>
              <textarea rows={2} value={stockNotes} onChange={(e) => setStockNotes(e.target.value)} />
            </AuthFormField>
            {stockMode === 'receive' && (
              <>
                <AuthFormField label={t('inventory.receive.lot')}>
                  <input value={receiveLot} onChange={(e) => setReceiveLot(e.target.value)} />
                </AuthFormField>
                <AuthFormField label={t('inventory.receive.manufacturedDate')}>
                  <input type="date" value={receiveMfgDate} onChange={(e) => setReceiveMfgDate(e.target.value)} />
                </AuthFormField>
                <AuthFormField label={t('inventory.receive.expiryDate')}>
                  <input type="date" value={receiveExpiryDate} onChange={(e) => setReceiveExpiryDate(e.target.value)} />
                </AuthFormField>
              </>
            )}
          </>
        )}
        <div className={styles.modalActions}>
          <AuthButton variant="ghost" onClick={() => setStockMode(null)}>
            {t('inventory.form.cancel')}
          </AuthButton>
          <AuthButton
            loading={consumeMutation.isPending || receiveMutation.isPending || adjustMutation.isPending}
            onClick={() => void handleStockAction()}
          >
            {stockMode === 'adjust' ? t('inventory.adjust.confirm') : stockMode === 'consume' ? t('inventory.consume.confirm') : t('inventory.receive.confirm')}
          </AuthButton>
        </div>
      </Modal>
    </div>
  );
}
