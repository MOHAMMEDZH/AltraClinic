import type { PatientGender, PatientListItem } from './types';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Bookmark,
  Download,
  Plus,
  Search,
  Settings2,
  UserPlus,
  Users,
} from 'lucide-react';
import { hasPermission } from '@booking/permissions';
import { useI18n } from '@booking/i18n/react';
import { formatMessage } from '@/i18n/messages';
import { useAuth } from '@/app/providers/AuthProvider';
import { useOnlineStatus } from '@/features/auth/hooks/useOnlineStatus';
import { AuthButton } from '@/features/auth/components/AuthButton';
import { AuthAlert } from '@/features/auth/components/AuthAlert';
import { AuthFormField } from '@/features/auth/components/AuthFormField';
import authShared from '@/features/auth/auth-shared.module.css';
import {
  DEFAULT_VISIBLE_COLUMNS,
  PATIENT_PAGE_SIZE,
  canCreatePatient,
  canArchivePatient,
  canExportPatients,
  type ListColumnId,
} from './config/patients-config';
import { useCreatePatient, useArchivePatient, usePatientsList, useQuickRegisterPatient } from './hooks/usePatients';
import { fetchPatients } from './api/patients-api';
import { PatientTable } from './components/PatientTable';
import { PatientForm } from './components/PatientForm';
import { EmptyState } from './components/EmptyState';
import { RecentPatientsPanel } from './components/RecentPatientsPanel';
import { PatientBulkActionsBar } from './components/PatientBulkActionsBar';
import { PatientSavedViewsDialog } from './components/PatientSavedViewsDialog';
import { Modal } from './components/Modal';
import { downloadPatientsCsv } from './lib/export-patients-csv';
import { loadPatientListCache } from './lib/patient-list-cache';
import { getRecentPatients } from './lib/recent-patients';
import type { PatientSavedView } from './lib/patient-saved-views';
import {
  formatPatientDate,
  genderLabelKey,
  patientFullName,
} from './lib/patient-format';
import { useDashboardBranches } from '@/features/dashboard/hooks/useDashboardBranches';
import { canSelectDashboardBranch } from '@/features/dashboard/config/dashboard-branch-scope';
import styles from './PatientsPage.module.css';

const COLUMN_STORAGE_KEY = 'booking.patients.columns';

function parseStatusFilter(value: string | null): 'active' | 'archived' | 'all' {
  if (value === 'archived' || value === 'all') return value;
  return 'active';
}

function parseGenderFilter(value: string | null): PatientGender | null {
  if (value === 'male' || value === 'female') return value;
  return null;
}

export function PatientsPage() {
  const { t, locale } = useI18n();
  const { user, getValidAccessToken } = useAuth();
  const online = useOnlineStatus();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const roles = user?.roles ?? [];

  const perm = useCallback(
    (action: string) => hasPermission(roles, 'api.patients', action as never),
    [roles],
  );

  const canSelectBranch = canSelectDashboardBranch(roles);
  const { data: branches = [] } = useDashboardBranches();
  const showBranchSelect = canSelectBranch && branches.length > 0;

  const [search, setSearch] = useState(() => searchParams.get('q') ?? '');
  const [debouncedQ, setDebouncedQ] = useState(() => (searchParams.get('q') ?? '').trim());
  const [statusFilter, setStatusFilter] = useState(() => parseStatusFilter(searchParams.get('status')));
  const [genderFilter, setGenderFilter] = useState(() => parseGenderFilter(searchParams.get('gender')));
  const [branchFilter, setBranchFilter] = useState<string | null>(() => searchParams.get('branchId'));
  const [page, setPage] = useState(() => {
    const parsed = Number(searchParams.get('page') ?? '1');
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
  });
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [registerOpen, setRegisterOpen] = useState(false);
  const [quickOpen, setQuickOpen] = useState(false);
  const [columnsOpen, setColumnsOpen] = useState(false);
  const [viewsOpen, setViewsOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [bulkArchiving, setBulkArchiving] = useState(false);
  const [recentPatients, setRecentPatients] = useState(() => getRecentPatients());
  const [visibleColumns, setVisibleColumns] = useState<ListColumnId[]>(() => {
    try {
      const stored = localStorage.getItem(COLUMN_STORAGE_KEY);
      return stored ? (JSON.parse(stored) as ListColumnId[]) : DEFAULT_VISIBLE_COLUMNS;
    } catch {
      return DEFAULT_VISIBLE_COLUMNS;
    }
  });

  useEffect(() => {
    const tmr = setTimeout(() => setDebouncedQ(search.trim()), 300);
    return () => clearTimeout(tmr);
  }, [search]);

  useEffect(() => {
    setPage(1);
    setSelectedIds(new Set());
  }, [debouncedQ, statusFilter, genderFilter, branchFilter]);

  useEffect(() => {
    const next = new URLSearchParams();
    if (debouncedQ) next.set('q', debouncedQ);
    if (statusFilter !== 'active') next.set('status', statusFilter);
    if (genderFilter) next.set('gender', genderFilter);
    if (branchFilter) next.set('branchId', branchFilter);
    if (page > 1) next.set('page', String(page));
    setSearchParams(next, { replace: true });
  }, [debouncedQ, statusFilter, genderFilter, branchFilter, page, setSearchParams]);

  const listQuery = usePatientsList({
    q: debouncedQ || undefined,
    status: statusFilter,
    gender: genderFilter ?? undefined,
    branchId: branchFilter ?? undefined,
    limit: PATIENT_PAGE_SIZE,
    offset: (page - 1) * PATIENT_PAGE_SIZE,
  });

  const createMutation = useCreatePatient();
  const quickMutation = useQuickRegisterPatient();
  const archiveMutation = useArchivePatient();

  const items = listQuery.data?.items ?? [];
  const total = listQuery.data?.total ?? 0;
  const isDemo = listQuery.isError;
  const cachedPatients = useMemo(() => (!online ? loadPatientListCache() : null), [online]);

  function toggleColumn(id: ListColumnId) {
    setVisibleColumns((prev) => {
      const next = prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id];
      localStorage.setItem(COLUMN_STORAGE_KEY, JSON.stringify(next));
      return next.length ? next : prev;
    });
  }

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    if (items.every((p) => selectedIds.has(p.id))) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(items.map((p) => p.id)));
    }
  }

  useEffect(() => {
    setRecentPatients(getRecentPatients());
  }, []);

  const columnLabels = useMemo(
    () =>
      Object.fromEntries(
        (
          ['name', 'phone', 'email', 'dob', 'gender', 'nationalId', 'lastVisit', 'status'] as ListColumnId[]
        ).map((id) => [id, t(`patients.columns.${id === 'dob' ? 'dob' : id}`)]),
      ) as Record<ListColumnId, string>,
    [t],
  );

  const formatExportCell = useCallback(
    (item: PatientListItem, column: ListColumnId) => {
      switch (column) {
        case 'name':
          return patientFullName(item, locale);
        case 'phone':
          return item.phone ?? '';
        case 'email':
          return item.email ?? '';
        case 'dob':
          return formatPatientDate(item.dateOfBirth, locale);
        case 'gender':
          return t(genderLabelKey(item.gender));
        case 'nationalId':
          return item.nationalId ?? '';
        case 'lastVisit':
          return formatPatientDate(item.lastVisitAt, locale);
        case 'status':
          return item.archived ? t('patients.status.archived') : t('patients.status.active');
        default:
          return '';
      }
    },
    [locale, t],
  );

  async function handleExport(rows?: PatientListItem[]) {
    if (!user?.tenantId || exporting) return;
    setExporting(true);
    try {
      const exportRows =
        rows ??
        (await (async () => {
          const token = await getValidAccessToken();
          if (!token) return items;
          const data = await fetchPatients(token, user.tenantId, {
            q: debouncedQ || undefined,
            status: statusFilter,
            gender: genderFilter ?? undefined,
            limit: 5000,
            offset: 0,
          });
          return data.items;
        })());
      downloadPatientsCsv(
        exportRows,
        visibleColumns,
        columnLabels,
        `patients-${new Date().toISOString().slice(0, 10)}.csv`,
        formatExportCell,
      );
    } catch {
      downloadPatientsCsv(
        rows ?? items,
        visibleColumns,
        columnLabels,
        `patients-${new Date().toISOString().slice(0, 10)}.csv`,
        formatExportCell,
      );
    } finally {
      setExporting(false);
    }
  }

  async function handleExportSelected() {
    const token = await getValidAccessToken();
    if (!token || !user?.tenantId || selectedIds.size === 0) return;
    try {
      const data = await fetchPatients(token, user.tenantId, {
        q: debouncedQ || undefined,
        status: statusFilter,
        gender: genderFilter ?? undefined,
        limit: 5000,
        offset: 0,
      });
      const selected = data.items.filter((p) => selectedIds.has(p.id));
      if (selected.length === 0) {
        const pageSelected = items.filter((p) => selectedIds.has(p.id));
        await handleExport(pageSelected);
        return;
      }
      await handleExport(selected);
    } catch {
      await handleExport(items.filter((p) => selectedIds.has(p.id)));
    }
  }

  async function handleBulkArchive() {
    if (!canArchivePatient(perm) || selectedIds.size === 0 || bulkArchiving) return;
    const activeSelected = items.filter((p) => selectedIds.has(p.id) && !p.archived);
    if (activeSelected.length === 0) return;
    if (!window.confirm(t('patients.bulk.archiveConfirm'))) return;

    setBulkArchiving(true);
    try {
      for (const patient of activeSelected) {
        await archiveMutation.mutateAsync(patient.id);
      }
      setSelectedIds(new Set());
      void listQuery.refetch();
    } finally {
      setBulkArchiving(false);
    }
  }

  function applySavedView(view: PatientSavedView) {
    setSearch(view.search);
    setDebouncedQ(view.search.trim());
    setStatusFilter(view.status);
    setGenderFilter(view.gender);
    setVisibleColumns(view.columns.length ? view.columns : DEFAULT_VISIBLE_COLUMNS);
    localStorage.setItem(COLUMN_STORAGE_KEY, JSON.stringify(view.columns));
    setViewsOpen(false);
    setPage(1);
    setSelectedIds(new Set());
  }

  const genderFilters = useMemo(
    () =>
      [
        { key: null as PatientGender | null, label: t('patients.views.anyGender') },
        { key: 'male' as const, label: t('patients.filters.male') },
        { key: 'female' as const, label: t('patients.filters.female') },
      ],
    [t],
  );

  const toolbarFilters = useMemo(
    () =>
      [
        { key: 'active' as const, label: t('patients.filters.active') },
        { key: 'archived' as const, label: t('patients.filters.archived') },
        { key: 'all' as const, label: t('patients.filters.all') },
      ],
    [t],
  );

  return (
    <div id="patients-region" className={styles.page}>
      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>{t('patients.title')}</h1>
          <p className={styles.subtitle}>{t('patients.subtitle')}</p>
        </div>
        <div className={styles.headerActions}>
          {canCreatePatient(perm) && (
            <>
              <AuthButton variant="secondary" onClick={() => setQuickOpen(true)}>
                <UserPlus size={16} aria-hidden />
                {t('patients.actions.quickRegister')}
              </AuthButton>
              <AuthButton onClick={() => setRegisterOpen(true)}>
                <Plus size={16} aria-hidden />
                {t('patients.actions.register')}
              </AuthButton>
            </>
          )}
        </div>
      </header>

      {!online && (
        <AuthAlert variant="warning">{t('patients.offlineBanner')}</AuthAlert>
      )}
      {!online && cachedPatients && (
        <AuthAlert variant="info">
          {formatMessage(t('patients.offlineCached'), { count: cachedPatients.items.length })}
        </AuthAlert>
      )}
      {isDemo && online && (
        <AuthAlert variant="warning">{t('patients.demoBanner')}</AuthAlert>
      )}

      <RecentPatientsPanel items={recentPatients} />

      <div className={styles.toolbar}>
        <div className={styles.searchWrap}>
          <Search size={16} className={styles.searchIcon} aria-hidden />
          <input
            className={styles.searchInput}
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('patients.searchPlaceholder')}
            aria-label={t('patients.searchPlaceholder')}
          />
        </div>

        <div className={styles.filterGroup} role="group" aria-label={t('patients.filters.all')}>
          {toolbarFilters.map((f) => (
            <button
              key={f.key}
              type="button"
              className={[styles.filterBtn, statusFilter === f.key ? styles.filterActive : ''].join(' ')}
              onClick={() => setStatusFilter(f.key)}
            >
              {f.label}
            </button>
          ))}
        </div>

        <div className={styles.filterGroup} role="group" aria-label={t('patients.views.genderGroup')}>
          {genderFilters.map((f) => (
            <button
              key={f.key ?? 'any'}
              type="button"
              className={[styles.filterBtn, genderFilter === f.key ? styles.filterActive : ''].join(' ')}
              onClick={() => setGenderFilter(f.key)}
            >
              {f.label}
            </button>
          ))}
        </div>

        {showBranchSelect && (
          <label className={styles.branchSelect}>
            <span className="sr-only">{t('patients.filters.branch')}</span>
            <select
              value={branchFilter ?? ''}
              onChange={(e) => setBranchFilter(e.target.value || null)}
              aria-label={t('patients.filters.branch')}
            >
              <option value="">{t('patients.filters.allBranches')}</option>
              {branches.map((branch) => (
                <option key={branch.id} value={branch.id}>
                  {branch.name}
                </option>
              ))}
            </select>
          </label>
        )}

        <button
          type="button"
          className={styles.iconBtn}
          onClick={() => setViewsOpen(true)}
          aria-label={t('patients.savedViews')}
          title={t('patients.savedViews')}
        >
          <Bookmark size={16} aria-hidden />
        </button>

        <button type="button" className={styles.iconBtn} onClick={() => setColumnsOpen(true)} aria-label={t('patients.columnSettings')}>
          <Settings2 size={16} aria-hidden />
        </button>

        {canExportPatients(perm) && (
          <button
            type="button"
            className={styles.iconBtn}
            aria-label={t('patients.export')}
            title={t('patients.export')}
            disabled={exporting || items.length === 0}
            onClick={() => void handleExport()}
          >
            <Download size={16} aria-hidden />
          </button>
        )}
      </div>

      <PatientBulkActionsBar
        selectedCount={selectedIds.size}
        canArchive={canArchivePatient(perm)}
        exporting={exporting}
        archiving={bulkArchiving}
        onExportSelected={() => void handleExportSelected()}
        onArchiveSelected={() => void handleBulkArchive()}
        onClear={() => setSelectedIds(new Set())}
      />

      {listQuery.isLoading && items.length === 0 ? (
        <PatientTable
          items={[]}
          visibleColumns={visibleColumns}
          selectedIds={selectedIds}
          onToggleSelect={toggleSelect}
          onToggleSelectAll={toggleSelectAll}
          page={page}
          total={0}
          pageSize={PATIENT_PAGE_SIZE}
          onPageChange={setPage}
          loading
        />
      ) : items.length === 0 ? (
        <EmptyState
          icon={<Users size={24} />}
          title={debouncedQ ? t('patients.empty.search') : t('patients.empty.title')}
          description={debouncedQ ? t('patients.empty.searchHint') : t('patients.empty.description')}
          action={
            canCreatePatient(perm) && !debouncedQ ? (
              <AuthButton onClick={() => setRegisterOpen(true)}>{t('patients.empty.action')}</AuthButton>
            ) : undefined
          }
        />
      ) : (
        <PatientTable
          items={items}
          visibleColumns={visibleColumns}
          selectedIds={selectedIds}
          onToggleSelect={toggleSelect}
          onToggleSelectAll={toggleSelectAll}
          page={page}
          total={total}
          pageSize={PATIENT_PAGE_SIZE}
          onPageChange={setPage}
          loading={listQuery.isFetching}
        />
      )}

      <Modal
        open={registerOpen}
        title={t('patients.form.registerTitle')}
        onClose={() => setRegisterOpen(false)}
        size="lg"
      >
        <p className={styles.modalIntro}>{t('patients.form.registerSubtitle')}</p>
        <PatientForm
          submitLabel={t('patients.actions.register')}
          loading={createMutation.isPending}
          onCancel={() => setRegisterOpen(false)}
          onSubmit={async (payload) => {
            const res = await createMutation.mutateAsync(payload);
            setRegisterOpen(false);
            navigate(`/patients/${res.id}`);
          }}
        />
      </Modal>

      <Modal open={quickOpen} title={t('patients.form.quickTitle')} onClose={() => setQuickOpen(false)}>
        <p className={styles.modalIntro}>{t('patients.form.quickSubtitle')}</p>
        <QuickRegisterForm
          loading={quickMutation.isPending}
          onCancel={() => setQuickOpen(false)}
          onSubmit={async (payload) => {
            const res = await quickMutation.mutateAsync(payload);
            setQuickOpen(false);
            navigate(`/patients/${res.id}`);
          }}
        />
      </Modal>

      <Modal open={columnsOpen} title={t('patients.columnSettings')} onClose={() => setColumnsOpen(false)}>
        <ul className={styles.columnList}>
          {(['name', 'phone', 'email', 'dob', 'gender', 'nationalId', 'lastVisit', 'status'] as ListColumnId[]).map(
            (id) => (
              <li key={id}>
                <label className={styles.columnLabel}>
                  <input
                    type="checkbox"
                    checked={visibleColumns.includes(id)}
                    onChange={() => toggleColumn(id)}
                  />
                  {t(`patients.columns.${id === 'dob' ? 'dob' : id === 'lastVisit' ? 'lastVisit' : id}`)}
                </label>
              </li>
            ),
          )}
        </ul>
      </Modal>

      <Modal open={viewsOpen} title={t('patients.savedViews')} onClose={() => setViewsOpen(false)} size="lg">
        <PatientSavedViewsDialog
          current={{
            search,
            status: statusFilter,
            gender: genderFilter,
            columns: visibleColumns,
          }}
          onApply={applySavedView}
          onViewsChange={() => undefined}
        />
      </Modal>
    </div>
  );
}

function QuickRegisterForm({
  onSubmit,
  onCancel,
  loading,
}: {
  onSubmit: (p: { firstName: string; lastName: string; phone?: string; gender?: string }) => Promise<void>;
  onCancel: () => void;
  loading?: boolean;
}) {
  const { t } = useI18n();
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');

  return (
    <form
      className={authShared.formStack}
      onSubmit={async (e) => {
        e.preventDefault();
        await onSubmit({ firstName: firstName.trim(), lastName: lastName.trim(), phone: phone.trim() || undefined });
      }}
    >
      <AuthFormField label={t('patients.form.firstName')} value={firstName} onChange={(e) => setFirstName(e.target.value)} required />
      <AuthFormField label={t('patients.form.lastName')} value={lastName} onChange={(e) => setLastName(e.target.value)} required />
      <AuthFormField label={t('patients.form.phone')} value={phone} onChange={(e) => setPhone(e.target.value)} dir="ltr" />
      <div className={authShared.actions}>
        <AuthButton type="button" variant="secondary" onClick={onCancel}>{t('patients.actions.cancel')}</AuthButton>
        <AuthButton type="submit" loading={loading}>{t('patients.actions.quickRegister')}</AuthButton>
      </div>
    </form>
  );
}
