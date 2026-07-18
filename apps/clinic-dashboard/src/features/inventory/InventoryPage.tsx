import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Plus, RefreshCw, Search } from 'lucide-react';
import { hasPermission } from '@booking/permissions';
import { useI18n } from '@booking/i18n/react';
import { useAuth } from '@/app/providers/AuthProvider';
import { useOnlineStatus } from '@/features/auth/hooks/useOnlineStatus';
import { AuthButton } from '@/features/auth/components/AuthButton';
import { AuthAlert } from '@/features/auth/components/AuthAlert';
import { AuthFormField } from '@/features/auth/components/AuthFormField';
import { Modal } from '@/features/patients/components/Modal';
import {
  INVENTORY_DEFAULT_PAGE_SIZE,
  INVENTORY_PAGE_SIZES,
  type InventoryPageSize,
  STOCK_FILTERS,
  canArchiveInventory,
  canCreateInventory,
  canUpdateInventory,
  categoryDisplayName,
  canViewInventory,
  canExportInventory,
  isCatalogReadOnly,
  isCatalogGridReadOnly,
  isInventoryStaffWorkspace,
  type InventoryBarcodeAction,
  resolveInventoryWorkspaceMode,
} from './config/inventory-config';
import { formatMessage } from '@/i18n/messages';
import { buildInventoryItemsCsv, downloadInventoryBlob, downloadInventoryCsv } from './utils/inventory-export';
import {
  isDeepCatalogPage,
  isLargeCatalog,
  formatCatalogCount,
  resolveInventoryListQuery,
  shouldShowSearchMinHint,
} from './utils/catalog-scale';
import { activeCatalogFilterCount, hasActiveCatalogFilters } from './utils/catalog-filters';
import filterBarStyles from './components/InventoryFilterBar.module.css';
import { mapInventoryApiError } from './api/inventory-api';
import {
  useArchiveInventoryItem,
  useBulkArchiveInventoryItems,
  useConsumeInventoryItem,
  useCreateInventoryItem,
  useExportInventoryItemsCsv,
  useInventoryItems,
  useInventoryCategories,
  useInventorySuppliersList,
  useReceiveInventoryItem,
  useReactivateInventoryItem,
  useUpdateInventoryItem,
} from './hooks/useInventory';
import { InventoryTable } from './components/InventoryTable';
import { InventoryBarcodeLookup } from './components/InventoryBarcodeLookup';
import { ItemForm, itemFormToApiBody } from './components/ItemForm';
import type { InventoryItem, InventoryStatusFilter, InventoryStockFilter } from './types/inventory.types';
import styles from './InventoryPage.module.css';

export function InventoryPage() {
  const { t, locale } = useI18n();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const online = useOnlineStatus();
  const roles = user?.roles ?? [];
  const perm = useCallback((action: string) => hasPermission(roles, 'api.inventory', action as never), [roles]);
  const workspaceMode = resolveInventoryWorkspaceMode(roles);
  const scanFromUrl = searchParams.get('scan') === '1';
  const receiveFromUrl = searchParams.get('receive') === '1';
  const canUpdate = canUpdateInventory(perm);
  const showReceiveScan = isInventoryStaffWorkspace(workspaceMode) && canUpdate;

  const [search, setSearch] = useState('');
  const [debouncedQ, setDebouncedQ] = useState('');
  const initialStock = searchParams.get('stock');
  const validStock = STOCK_FILTERS.includes(initialStock as InventoryStockFilter)
    ? (initialStock as InventoryStockFilter)
    : 'all';
  const [stockFilter, setStockFilter] = useState<InventoryStockFilter>(validStock);
  const [categoryFilter, setCategoryFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState<InventoryStatusFilter>('active');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<InventoryPageSize>(INVENTORY_DEFAULT_PAGE_SIZE);
  const [errorKey, setErrorKey] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [formOpen, setFormOpen] = useState(false);
  const [editItem, setEditItem] = useState<InventoryItem | null>(null);
  const [archiveTarget, setArchiveTarget] = useState<InventoryItem | null>(null);
  const [stockItem, setStockItem] = useState<InventoryItem | null>(null);
  const [stockMode, setStockMode] = useState<'consume' | 'receive'>('consume');
  const [stockQty, setStockQty] = useState(1);
  const [stockNotes, setStockNotes] = useState('');
  const [receiveLot, setReceiveLot] = useState('');
  const [receiveMfgDate, setReceiveMfgDate] = useState('');
  const [receiveExpiryDate, setReceiveExpiryDate] = useState('');
  const [scanMode, setScanMode] = useState(scanFromUrl || receiveFromUrl || workspaceMode === 'lookup');
  const [barcodeAction, setBarcodeAction] = useState<InventoryBarcodeAction>(
    receiveFromUrl && showReceiveScan ? 'receive' : 'navigate',
  );
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [bulkArchiveOpen, setBulkArchiveOpen] = useState(false);

  useEffect(() => {
    const tmr = setTimeout(() => setDebouncedQ(search.trim()), 300);
    return () => clearTimeout(tmr);
  }, [search]);

  useEffect(() => {
    if (!success) return;
    const tmr = setTimeout(() => setSuccess(null), 5000);
    return () => clearTimeout(tmr);
  }, [success]);

  const listQueryQ = resolveInventoryListQuery(debouncedQ);

  useEffect(() => {
    setPage(1);
  }, [listQueryQ, stockFilter, statusFilter, categoryFilter, pageSize]);

  const canView = canViewInventory(perm);
  const categoriesQuery = useInventoryCategories(canView);
  const suppliersQuery = useInventorySuppliersList(canView);
  const categories = categoriesQuery.data ?? [];
  const suppliers = suppliersQuery.data ?? [];
  const listQuery = useInventoryItems({
    q: listQueryQ,
    stock: stockFilter,
    status: statusFilter,
    categoryId: categoryFilter || undefined,
    page,
    pageSize,
    enabled: canView,
  });

  const createMutation = useCreateInventoryItem();
  const updateMutation = useUpdateInventoryItem();
  const consumeMutation = useConsumeInventoryItem();
  const receiveMutation = useReceiveInventoryItem();
  const archiveMutation = useArchiveInventoryItem();
  const bulkArchiveMutation = useBulkArchiveInventoryItems();
  const exportMutation = useExportInventoryItemsCsv();
  const reactivateMutation = useReactivateInventoryItem();

  const items = listQuery.data?.items ?? [];
  const total = listQuery.data?.total ?? 0;
  const readOnlyCatalog = isCatalogReadOnly(workspaceMode);
  const readOnlyGrid = isCatalogGridReadOnly(workspaceMode);
  const canArchive = canArchiveInventory(perm);
  const bulkEnabled = isInventoryStaffWorkspace(workspaceMode) && canExportInventory(perm);
  const bulkArchiveEnabled = isInventoryStaffWorkspace(workspaceMode) && canArchive && statusFilter === 'active';
  const bulkSelectionEnabled = bulkEnabled || bulkArchiveEnabled;
  const allSelected = items.length > 0 && items.every((item) => selectedIds.has(item.itemId));

  const pageTitle =
    workspaceMode === 'lookup'
      ? t('inventory.workspace.catalogLookup.title')
      : workspaceMode === 'clinical'
        ? t('inventory.workspace.catalogClinical.title')
        : workspaceMode === 'management'
          ? t('inventory.workspace.catalogManagement.title')
          : workspaceMode === 'operations'
            ? t('inventory.workspace.catalogOperations.title')
            : t('inventory.catalog.title');

  const pageSubtitle =
    workspaceMode === 'lookup'
      ? t('inventory.workspace.catalogLookup.subtitle')
      : workspaceMode === 'clinical'
        ? t('inventory.workspace.catalogClinical.subtitle')
        : workspaceMode === 'management'
          ? t('inventory.workspace.catalogManagement.subtitle')
          : workspaceMode === 'operations'
            ? t('inventory.workspace.catalogOperations.subtitle')
            : t('inventory.catalog.subtitle');

  const workspaceBanner =
    workspaceMode === 'lookup'
      ? t('inventory.workspace.catalogLookup.banner')
      : workspaceMode === 'clinical'
        ? t('inventory.workspace.catalogClinical.banner')
        : workspaceMode === 'management'
          ? t('inventory.workspace.catalogManagement.banner')
          : workspaceMode === 'operations'
            ? t('inventory.workspace.catalogOperations.banner')
            : null;

  const filterState = {
    search,
    listQueryQ,
    stock: stockFilter,
    categoryId: categoryFilter,
    status: statusFilter,
  };
  const filtersActive = hasActiveCatalogFilters(filterState);
  const filterCount = activeCatalogFilterCount(filterState);

  function clearCatalogFilters() {
    setSearch('');
    setDebouncedQ('');
    setStockFilter('all');
    setCategoryFilter('');
    setStatusFilter('active');
    setPage(1);
  }

  useEffect(() => {
    setSelectedIds(new Set());
  }, [listQueryQ, stockFilter, statusFilter, categoryFilter, page, pageSize]);

  function toggleSelectedItem(itemId: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(itemId)) next.delete(itemId);
      else next.add(itemId);
      return next;
    });
  }

  function toggleSelectAllOnPage() {
    if (allSelected) setSelectedIds(new Set());
    else setSelectedIds(new Set(items.map((item) => item.itemId)));
  }

  async function exportSelectedItems() {
    const ids = [...selectedIds];
    if (ids.length === 0) return;
    setErrorKey(null);
    if (online) {
      try {
        const { blob, filename } = await exportMutation.mutateAsync({
          itemIds: ids,
          q: listQueryQ,
          status: statusFilter,
          stock: stockFilter,
          categoryId: categoryFilter || undefined,
        });
        downloadInventoryBlob(filename, blob);
        return;
      } catch (err) {
        setErrorKey(mapInventoryApiError(err));
        return;
      }
    }
    const selected = items.filter((item) => selectedIds.has(item.itemId));
    const csv = buildInventoryItemsCsv(selected, locale);
    const stamp = new Date().toISOString().slice(0, 10);
    downloadInventoryCsv(`inventory-export-${stamp}.csv`, csv);
  }

  async function confirmBulkArchive() {
    const ids = [...selectedIds];
    if (ids.length === 0) return;
    setErrorKey(null);
    try {
      const result = await bulkArchiveMutation.mutateAsync(ids);
      setBulkArchiveOpen(false);
      setSelectedIds(new Set());
      if (result.skipped.length > 0) {
        setSuccess(
          formatMessage(t('inventory.bulk.archivePartial'), {
            archived: String(result.count),
            skipped: String(result.skipped.length),
          }),
        );
      } else {
        setSuccess(formatMessage(t('inventory.bulk.archiveSuccess'), { count: String(result.count) }));
      }
    } catch (err) {
      setErrorKey(mapInventoryApiError(err));
    }
  }

  async function handleCreate(values: Parameters<typeof itemFormToApiBody>[0]) {
    setErrorKey(null);
    try {
      await createMutation.mutateAsync(itemFormToApiBody(values, 'create'));
      setFormOpen(false);
      setSuccess(t('inventory.form.save'));
    } catch (err) {
      setErrorKey(mapInventoryApiError(err));
    }
  }

  async function handleUpdate(values: Parameters<typeof itemFormToApiBody>[0]) {
    if (!editItem) return;
    setErrorKey(null);
    try {
      await updateMutation.mutateAsync({
        itemId: editItem.itemId,
        body: itemFormToApiBody(values, 'edit'),
      });
      setEditItem(null);
    } catch (err) {
      setErrorKey(mapInventoryApiError(err));
    }
  }

  async function handleStockAction() {
    if (!stockItem) return;
    setErrorKey(null);
    try {
      if (stockMode === 'consume') {
        await consumeMutation.mutateAsync({
          itemId: stockItem.itemId,
          quantity: stockQty,
          notes: stockNotes.trim() || undefined,
        });
        setSuccess(t('inventory.consume.success'));
      } else {
        await receiveMutation.mutateAsync({
          itemId: stockItem.itemId,
          quantity: stockQty,
          notes: stockNotes.trim() || undefined,
          lotNumber: receiveLot.trim() || undefined,
          manufacturedDate: receiveMfgDate || undefined,
          expiryDate: receiveExpiryDate || undefined,
        });
        setSuccess(t('inventory.receive.success'));
      }
      setStockItem(null);
      setStockQty(1);
      setStockNotes('');
      setReceiveLot('');
      setReceiveMfgDate('');
      setReceiveExpiryDate('');
    } catch (err) {
      setErrorKey(mapInventoryApiError(err));
    }
  }

  async function confirmArchive() {
    if (!archiveTarget) return;
    setErrorKey(null);
    try {
      await archiveMutation.mutateAsync(archiveTarget.itemId);
      setArchiveTarget(null);
      setSuccess(t('inventory.archive.success'));
    } catch (err) {
      setErrorKey(mapInventoryApiError(err));
    }
  }

  useEffect(() => {
    if (searchParams.get('create') === '1' && canCreateInventory(perm)) {
      setFormOpen(true);
    }
  }, [searchParams, roles]);

  function openReceiveForItem(item: InventoryItem) {
    setStockItem(item);
    setStockMode('receive');
    setStockQty(1);
    setStockNotes('');
    setReceiveLot('');
    setReceiveMfgDate('');
    setReceiveExpiryDate('');
  }

  function handleBarcodeFound(item: InventoryItem) {
    if (barcodeAction === 'receive' && showReceiveScan) {
      openReceiveForItem(item);
      return;
    }
    navigate(`/inventory/items/${item.itemId}`);
  }

  function handleScanModeChange(active: boolean) {
    setScanMode(active);
    const next = new URLSearchParams(searchParams);
    if (active) next.set('scan', '1');
    else next.delete('scan');
    navigate({ pathname: '/inventory/catalog', search: next.toString() ? `?${next.toString()}` : '' }, { replace: true });
  }

  function handleBarcodeActionChange(action: InventoryBarcodeAction) {
    setBarcodeAction(action);
    const next = new URLSearchParams(searchParams);
    if (action === 'receive') {
      next.set('receive', '1');
      setScanMode(true);
      next.set('scan', '1');
    } else {
      next.delete('receive');
    }
    navigate({ pathname: '/inventory/catalog', search: next.toString() ? `?${next.toString()}` : '' }, { replace: true });
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
      <nav className={styles.skipNav} aria-label={t('inventory.a11y.skipToCatalog')}>
        <a href="#inv-barcode-panel" className="skip-link">
          {t('inventory.a11y.skipToScanner')}
        </a>
        <a href="#inv-catalog-region" className="skip-link">
          {t('inventory.a11y.skipToCatalog')}
        </a>
      </nav>

      <Link to="/inventory" className={styles.backLink}>
        <ArrowLeft size={16} aria-hidden />
        {t('inventory.catalog.back')}
      </Link>

      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>{pageTitle}</h1>
          <p className={styles.subtitle}>{pageSubtitle}</p>
        </div>
        <div className={styles.headerActions}>
          {isInventoryStaffWorkspace(workspaceMode) && showReceiveScan && (
            <AuthButton
              variant="secondary"
              onClick={() => handleBarcodeActionChange(barcodeAction === 'receive' ? 'navigate' : 'receive')}
            >
              {barcodeAction === 'receive' ? t('inventory.barcode.lookupMode') : t('inventory.barcode.receiveScanLink')}
            </AuthButton>
          )}
          {isInventoryStaffWorkspace(workspaceMode) && (
            <>
              <AuthButton variant="secondary" onClick={() => navigate('/inventory/reports')}>
                {t('inventory.reports.link')}
              </AuthButton>
              <AuthButton variant="secondary" onClick={() => navigate('/inventory/stock-requests')}>
                {t('inventory.stockRequests.link')}
              </AuthButton>
              <AuthButton variant="secondary" onClick={() => navigate('/inventory/stock-counts')}>
                {t('inventory.stockCounts.link')}
              </AuthButton>
              <AuthButton variant="secondary" onClick={() => navigate('/inventory/warehouses')}>
                {t('inventory.warehouses.link')}
              </AuthButton>
              <AuthButton variant="secondary" onClick={() => navigate('/inventory/transfers')}>
                {t('inventory.transfers.link')}
              </AuthButton>
              <AuthButton variant="secondary" onClick={() => navigate('/inventory/procurement')}>
                {t('inventory.procurement.link')}
              </AuthButton>
              <AuthButton variant="secondary" onClick={() => navigate('/inventory/suppliers')}>
                {t('inventory.suppliers.link')}
              </AuthButton>
              <AuthButton variant="secondary" onClick={() => navigate('/inventory/expiry')}>
                {t('inventory.expiry.link')}
              </AuthButton>
            </>
          )}
          {workspaceMode === 'clinical' && (
            <AuthButton variant="secondary" onClick={() => navigate('/inventory/stock-requests')}>
              {t('inventory.stockRequests.link')}
            </AuthButton>
          )}
          <AuthButton variant="secondary" onClick={() => void listQuery.refetch()}>
            <RefreshCw size={16} aria-hidden className={listQuery.isFetching ? styles.spin : undefined} />
            {t('inventory.refresh')}
          </AuthButton>
          {isInventoryStaffWorkspace(workspaceMode) && canCreateInventory(perm) && (
            <AuthButton onClick={() => setFormOpen(true)}>
              <Plus size={16} aria-hidden />
              {t('inventory.addItem')}
            </AuthButton>
          )}
        </div>
      </header>

      {workspaceBanner && <p className={styles.workspaceBanner}>{workspaceBanner}</p>}

      {!online && <AuthAlert variant="warning">{t('auth.offline')}</AuthAlert>}
      {listQuery.isError && online && <AuthAlert variant="error">{t('inventory.loadError')}</AuthAlert>}
      {errorKey && (
        <AuthAlert variant="error">
          {t(`inventory.errors.${errorKey}` as 'inventory.errors.generic')}
        </AuthAlert>
      )}
      {success && <AuthAlert variant="success">{success}</AuthAlert>}

      <InventoryBarcodeLookup
        scanMode={scanMode}
        onScanModeChange={handleScanModeChange}
        action={barcodeAction}
        onActionChange={showReceiveScan ? handleBarcodeActionChange : undefined}
        showReceiveAction={showReceiveScan}
        onItemFound={handleBarcodeFound}
      />

      <div className={styles.toolbar}>
        <div className={styles.searchWrap}>
          <Search size={16} className={styles.searchIcon} aria-hidden />
          <input
            className={styles.searchInput}
            value={search}
            placeholder={t('inventory.searchPlaceholder')}
            aria-label={t('inventory.searchPlaceholder')}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select
          className={styles.categorySelect}
          value={categoryFilter}
          aria-label={t('inventory.form.category')}
          onChange={(e) => setCategoryFilter(e.target.value)}
        >
          <option value="">{t('inventory.filters.allCategories')}</option>
          {categories.map((cat) => (
            <option key={cat.categoryId} value={cat.categoryId}>
              {categoryDisplayName(cat, locale)}
            </option>
          ))}
        </select>
        <div className={styles.filters} role="group" aria-label={t('inventory.filters.all')}>
          {STOCK_FILTERS.map((f) => (
            <button
              key={f}
              type="button"
              className={stockFilter === f ? styles.filterActive : styles.filterBtn}
              aria-pressed={stockFilter === f}
              onClick={() => setStockFilter(f)}
            >
              {t(`inventory.filters.${f}`)}
            </button>
          ))}
        </div>
        {!readOnlyCatalog && (
          <div className={styles.filters} role="group" aria-label={t('inventory.a11y.statusFilters')}>
            {(['active', 'archived'] as const).map((f) => (
              <button
                key={f}
                type="button"
                className={statusFilter === f ? styles.filterActive : styles.filterBtn}
                aria-pressed={statusFilter === f}
                onClick={() => setStatusFilter(f)}
              >
                {t(`inventory.filters.${f}`)}
              </button>
            ))}
          </div>
        )}
      </div>

      {shouldShowSearchMinHint(search) && (
        <p className={styles.scaleHint} role="status">
          {t('inventory.scale.searchMinHint')}
        </p>
      )}
      {isLargeCatalog(total) && (
        <p className={styles.scaleHint}>
          {formatMessage(t('inventory.scale.largeCatalogHint'), {
            total: formatCatalogCount(total, locale),
          })}
        </p>
      )}

      {filtersActive && (
        <div className={filterBarStyles.filterBar} aria-label={t('inventory.activeFilters')}>
          <span className={filterBarStyles.filterLabel}>{t('inventory.activeFilters')}</span>
          <span className={filterBarStyles.chip}>
            {formatMessage(t('inventory.bulk.selected'), { count: String(filterCount) })}
          </span>
          {listQueryQ && <span className={filterBarStyles.chip}>{listQueryQ}</span>}
          {stockFilter !== 'all' && (
            <span className={filterBarStyles.chip}>{t(`inventory.filters.${stockFilter}`)}</span>
          )}
          {categoryFilter && categories.find((c) => c.categoryId === categoryFilter) && (
            <span className={filterBarStyles.chip}>
              {categoryDisplayName(categories.find((c) => c.categoryId === categoryFilter)!, locale)}
            </span>
          )}
          {statusFilter !== 'active' && (
            <span className={filterBarStyles.chip}>{t(`inventory.filters.${statusFilter}`)}</span>
          )}
          <button type="button" className={filterBarStyles.clearBtn} onClick={clearCatalogFilters}>
            {t('inventory.clearFilters')}
          </button>
        </div>
      )}

      <div id="inv-catalog-region">
      <InventoryTable
        items={items}
        categories={categories}
        statusFilter={statusFilter}
        loading={listQuery.isLoading}
        fetching={listQuery.isFetching}
        readOnly={readOnlyGrid}
        selectable={bulkSelectionEnabled}
        selectedIds={selectedIds}
        allSelected={allSelected}
        onToggleItem={toggleSelectedItem}
        onToggleAll={toggleSelectAllOnPage}
        selectedCount={selectedIds.size}
        onExportSelected={bulkEnabled ? () => void exportSelectedItems() : undefined}
        exportLoading={exportMutation.isPending}
        showBulkArchive={bulkArchiveEnabled}
        onArchiveSelected={() => setBulkArchiveOpen(true)}
        archiveLoading={bulkArchiveMutation.isPending}
        onClearSelection={() => setSelectedIds(new Set())}
        page={page}
        total={total}
        pageSize={pageSize}
        pageSizeOptions={INVENTORY_PAGE_SIZES}
        onPageSizeChange={(size) => setPageSize(size as InventoryPageSize)}
        onPageChange={setPage}
        showDeepPageHint={isDeepCatalogPage(page)}
        onClearFilters={filtersActive ? clearCatalogFilters : undefined}
        onAddItem={
          !readOnlyCatalog && canCreateInventory(perm) ? () => setFormOpen(true) : undefined
        }
        canUpdate={!readOnlyGrid && canUpdate}
        canArchive={!readOnlyGrid && canArchive}
        onEdit={setEditItem}
        onReceive={openReceiveForItem}
        onConsume={(item) => {
          setStockItem(item);
          setStockMode('consume');
        }}
        onArchive={setArchiveTarget}
        onReactivate={(item) => void reactivateMutation.mutateAsync(item.itemId)}
      />
      </div>

      {!readOnlyCatalog && (
        <>
          <Modal open={formOpen} title={t('inventory.form.createTitle')} onClose={() => setFormOpen(false)} closeLabel={t('inventory.a11y.closeDialog')}>
            <ItemForm
              mode="create"
              categories={categories}
              suppliers={suppliers}
              loading={createMutation.isPending}
              onSubmit={(v) => void handleCreate(v)}
              onCancel={() => setFormOpen(false)}
            />
          </Modal>

          <Modal open={!!editItem} title={t('inventory.form.editTitle')} onClose={() => setEditItem(null)} closeLabel={t('inventory.a11y.closeDialog')}>
            {editItem && (
              <ItemForm
                mode="edit"
                initial={editItem}
                categories={categories}
                suppliers={suppliers}
                loading={updateMutation.isPending}
                onSubmit={(v) => void handleUpdate(v)}
                onCancel={() => setEditItem(null)}
              />
            )}
          </Modal>

          <Modal open={bulkArchiveOpen} title={t('inventory.bulk.archiveSelected')} onClose={() => setBulkArchiveOpen(false)} closeLabel={t('inventory.a11y.closeDialog')}>
            <p>
              {formatMessage(t('inventory.bulk.archiveConfirm'), { count: String(selectedIds.size) })}
            </p>
            <div className={styles.modalActions}>
              <AuthButton variant="ghost" onClick={() => setBulkArchiveOpen(false)}>
                {t('inventory.form.cancel')}
              </AuthButton>
              <AuthButton variant="danger" loading={bulkArchiveMutation.isPending} onClick={() => void confirmBulkArchive()}>
                {t('inventory.archive.action')}
              </AuthButton>
            </div>
          </Modal>

          <Modal open={!!archiveTarget} title={t('inventory.archive.action')} onClose={() => setArchiveTarget(null)} closeLabel={t('inventory.a11y.closeDialog')}>
            <p>{t('inventory.archive.confirm')}</p>
            <div className={styles.modalActions}>
              <AuthButton variant="ghost" onClick={() => setArchiveTarget(null)}>
                {t('inventory.form.cancel')}
              </AuthButton>
              <AuthButton variant="danger" loading={archiveMutation.isPending} onClick={() => void confirmArchive()}>
                {t('inventory.archive.action')}
              </AuthButton>
            </div>
          </Modal>

          <Modal
            open={!!stockItem}
            title={stockMode === 'consume' ? t('inventory.consume.title') : t('inventory.receive.title')}
            onClose={() => setStockItem(null)}
            closeLabel={t('inventory.a11y.closeDialog')}
          >
            {stockItem && (
              <>
                <AuthFormField
                  label={stockMode === 'consume' ? t('inventory.consume.quantity') : t('inventory.receive.quantity')}
                  required
                >
                  <input
                    type="number"
                    min={1}
                    max={stockMode === 'consume' ? stockItem.quantityOnHand : undefined}
                    value={stockQty}
                    onChange={(e) => setStockQty(Number(e.target.value) || 1)}
                  />
                </AuthFormField>
                <AuthFormField
                  label={stockMode === 'consume' ? t('inventory.consume.notes') : t('inventory.receive.notes')}
                >
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
                <div className={styles.modalActions}>
                  <AuthButton variant="ghost" onClick={() => setStockItem(null)}>
                    {t('inventory.form.cancel')}
                  </AuthButton>
                  <AuthButton
                    loading={consumeMutation.isPending || receiveMutation.isPending}
                    onClick={() => void handleStockAction()}
                  >
                    {stockMode === 'consume' ? t('inventory.consume.confirm') : t('inventory.receive.confirm')}
                  </AuthButton>
                </div>
              </>
            )}
          </Modal>
        </>
      )}
    </div>
  );
}
