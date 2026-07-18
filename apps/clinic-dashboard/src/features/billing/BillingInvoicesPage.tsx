import { useCallback, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { hasPermission } from '@booking/permissions';
import { useI18n } from '@booking/i18n/react';
import { useAuth } from '@/app/providers/AuthProvider';
import { AuthAlert } from '@/features/auth/components/AuthAlert';
import { AuthButton } from '@/features/auth/components/AuthButton';
import { EmptyState } from '@/features/patients/components/EmptyState';
import {
  BILLING_PAGE_SIZES,
  canCreateBilling,
  canExportBilling,
  canUpdateBilling,
  canViewBilling,
  normalizeStatusFilter,
  resolveBillingWorkspaceMode,
} from './config/billing-config';
import { useExportInvoices, useInvoicesPaginated, useIssueInvoice } from './hooks/useBilling';
import { BillingQuickNav } from './components/BillingQuickNav';
import { InvoiceFilterBar } from './components/InvoiceFilterBar';
import { VirtualizedInvoiceGrid } from './components/VirtualizedInvoiceGrid';
import { BillingSavedViewsDialog } from './components/BillingSavedViewsDialog';
import { downloadBillingCsv } from './utils/billing-export';
import { formatMessage } from '@/i18n/messages';
import styles from './billing-layout.module.css';

export function BillingInvoicesPage() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user } = useAuth();
  const roles = user?.roles ?? [];
  const perm = useCallback((action: string) => hasPermission(roles, 'api.billing', action as never), [roles]);
  const workspaceMode = resolveBillingWorkspaceMode(roles);

  const statusParam = searchParams.get('status') ?? 'all';
  const patientIdParam = searchParams.get('patientId');
  const pageParam = Number.parseInt(searchParams.get('page') ?? '1', 10);
  const pageSizeParam = Number.parseInt(searchParams.get('pageSize') ?? '25', 10);

  const [search, setSearch] = useState('');
  const [status, setStatus] = useState(statusParam);
  const [page, setPage] = useState(Number.isFinite(pageParam) ? pageParam : 1);
  const [pageSize, setPageSize] = useState(BILLING_PAGE_SIZES.includes(pageSizeParam as 25) ? pageSizeParam : 25);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [savedViewsOpen, setSavedViewsOpen] = useState(false);

  const canView = canViewBilling(perm);
  const canCreate = canCreateBilling(perm);
  const canExport = canExportBilling(perm);
  const canUpdate = canUpdateBilling(perm);

  const apiStatus = normalizeStatusFilter(status === 'all' ? undefined : status);
  const invoicesQuery = useInvoicesPaginated({
    enabled: canView,
    status: apiStatus,
    patientId: patientIdParam ?? undefined,
    search: search || undefined,
    page,
    pageSize,
  });
  const exportMutation = useExportInvoices();
  const issueMutation = useIssueInvoice();

  const paged = invoicesQuery.data;
  const invoices = paged?.items ?? [];

  const allSelected = useMemo(
    () => invoices.length > 0 && invoices.every((inv) => selectedIds.has(inv.invoiceId)),
    [invoices, selectedIds],
  );

  function toggleAll() {
    if (allSelected) setSelectedIds(new Set());
    else setSelectedIds(new Set(invoices.map((inv) => inv.invoiceId)));
  }

  function toggleOne(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function handleStatusChange(next: string) {
    setStatus(next);
    setPage(1);
    const params = new URLSearchParams(searchParams);
    if (next === 'all') params.delete('status');
    else params.set('status', next);
    params.set('page', '1');
    setSearchParams(params, { replace: true });
  }

  if (!canView) {
    return (
      <div className={styles.page}>
        <AuthAlert variant="error">{t('billing.accessDenied')}</AuthAlert>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>{t('billing.invoices.title')}</h1>
          <p className={styles.subtitle}>{t('billing.invoices.subtitle')}</p>
        </div>
        <div className={styles.headerActions}>
          <AuthButton variant="secondary" onClick={() => setSavedViewsOpen(true)}>{t('billing.savedViews.open')}</AuthButton>
          {canCreate && <AuthButton onClick={() => navigate('/billing/invoices/new')}>{t('billing.nav.create')}</AuthButton>}
        </div>
      </header>

      <BillingQuickNav mode={workspaceMode} canCreate={canCreate} />

      <InvoiceFilterBar
        search={search}
        status={status}
        onSearchChange={(value) => { setSearch(value); setPage(1); }}
        onStatusChange={handleStatusChange}
        canExport={canExport}
        exporting={exportMutation.isPending}
        onExport={() => {
          void exportMutation.mutateAsync({ status: apiStatus }).then(({ csv, filename }) => downloadBillingCsv(filename, csv));
        }}
      />

      {selectedIds.size > 0 && (
        <div className={styles.toolbar}>
          <span className={styles.hint}>{formatMessage(t('billing.bulk.selected'), { count: selectedIds.size })}</span>
          {canUpdate && (
            <AuthButton
              variant="secondary"
              loading={issueMutation.isPending}
              onClick={() => {
                const drafts = invoices.filter((inv) => selectedIds.has(inv.invoiceId) && inv.status === 'draft');
                void Promise.all(drafts.map((inv) => issueMutation.mutateAsync(inv.invoiceId))).then(() => setSelectedIds(new Set()));
              }}
            >
              {t('billing.bulk.issue')}
            </AuthButton>
          )}
          {canExport && (
            <AuthButton
              variant="secondary"
              onClick={() => {
                const selected = invoices.filter((inv) => selectedIds.has(inv.invoiceId));
                const header = 'invoiceNumber,status,total,paid,due\n';
                const body = selected.map((inv) => `${inv.invoiceNumber},${inv.status},${inv.amountTotal},${inv.amountPaid},${inv.amountDue}`).join('\n');
                downloadBillingCsv(`invoices-selected-${Date.now()}.csv`, header + body);
              }}
            >
              {t('billing.bulk.exportSelected')}
            </AuthButton>
          )}
        </div>
      )}

      {invoicesQuery.isError && <AuthAlert variant="error">{t('billing.loadError')}</AuthAlert>}

      {invoices.length === 0 && !invoicesQuery.isLoading ? (
        <EmptyState
          title={t('billing.invoices.empty')}
          description={canCreate ? t('billing.invoices.emptyHint') : undefined}
          action={canCreate ? <AuthButton onClick={() => navigate('/billing/invoices/new')}>{t('billing.nav.create')}</AuthButton> : undefined}
        />
      ) : (
        <>
          <div className={styles.toolbar}>
            <label className={styles.hint}>
              <input type="checkbox" checked={allSelected} onChange={toggleAll} aria-label={t('billing.bulk.selectAll')} />
              {' '}{t('billing.bulk.selectAll')}
            </label>
          </div>
          <VirtualizedInvoiceGrid
            invoices={invoices}
            loading={invoicesQuery.isLoading}
            selectable
            selectedIds={selectedIds}
            onToggle={toggleOne}
          />
          {paged && (
            <div className={styles.toolbar}>
              <AuthButton variant="secondary" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>{t('billing.pagination.prev')}</AuthButton>
              <span className={styles.hint}>{formatMessage(t('billing.pagination.page'), { page, total: paged.totalPages })}</span>
              <AuthButton variant="secondary" disabled={page >= paged.totalPages} onClick={() => setPage((p) => p + 1)}>{t('billing.pagination.next')}</AuthButton>
              <select className={styles.selectInput} value={pageSize} aria-label={t('billing.pagination.pageSize')} onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }}>
                {BILLING_PAGE_SIZES.map((size) => <option key={size} value={size}>{size}</option>)}
              </select>
            </div>
          )}
        </>
      )}

      <BillingSavedViewsDialog
        open={savedViewsOpen}
        onClose={() => setSavedViewsOpen(false)}
        current={{ search, status }}
        onApply={(view) => { setSearch(view.search); setStatus(view.status); setPage(1); }}
      />
    </div>
  );
}
