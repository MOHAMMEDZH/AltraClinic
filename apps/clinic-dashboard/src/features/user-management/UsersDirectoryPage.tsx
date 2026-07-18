import { useMemo, useState } from 'react';

import { useSearchParams } from 'react-router-dom';

import { Download, Search } from 'lucide-react';

import { useI18n } from '@booking/i18n/react';

import { useAuth } from '@/app/providers/AuthProvider';

import { AuthAlert } from '@/features/auth/components/AuthAlert';

import { AuthButton } from '@/features/auth/components/AuthButton';

import { AuthFormField } from '@/features/auth/components/AuthFormField';

import { useDashboardBranches } from '@/features/dashboard/hooks/useDashboardBranches';

import type { EmploymentStatus } from './api/identity-api';

import {

  assignableRoles,

  buildIdentityPermCheck,

  canExportUsers,

  canManageUsers,

  canViewUsers,

  EMPLOYMENT_STATUS_FILTERS,

  USER_STATUS_FILTERS,

  type UserStatusFilter,

} from './config/user-management-config';

import { useBulkUserAction, useInfiniteUsers, useUsers } from './hooks/useUserManagement';

import {

  useDeleteSavedFilter,

  useDepartments,

  useExportUsersPdf,

  useExportUsersXlsx,

  useRegions,

  useSaveFilter,

  useSavedFilters,

} from './hooks/useUserEnterprise';

import { UserDirectoryViews, type DirectoryView } from './components/UserDirectoryViews';

import { UsersImportPanel } from './components/UsersImportPanel';

import { VirtualizedUsersTable } from './components/VirtualizedUsersTable';

import { downloadUsersCsv } from './lib/export-users-csv';

import { fetchUsers } from './api/identity-api';

import styles from './user-management-layout.module.css';



type BulkDialog = 'roles' | 'branches' | 'department' | null;



export function UsersDirectoryPage() {

  const { t, locale } = useI18n();

  const { user, getValidAccessToken } = useAuth();

  const [searchParams, setSearchParams] = useSearchParams();

  const perm = useMemo(() => buildIdentityPermCheck(user?.roles ?? []), [user?.roles]);

  const canView = canViewUsers(perm);

  const canManage = canManageUsers(perm);

  const canExport = canExportUsers(perm);

  const bulkMutation = useBulkUserAction();

  const exportXlsx = useExportUsersXlsx();

  const exportPdf = useExportUsersPdf();

  const saveFilterMutation = useSaveFilter();

  const deleteFilterMutation = useDeleteSavedFilter();

  const { data: branches = [] } = useDashboardBranches();

  const { data: departments = [] } = useDepartments(canView);

  const { data: regions = [] } = useRegions(canView);

  const { data: savedFilters = [] } = useSavedFilters(canView);



  const [searchInput, setSearchInput] = useState(searchParams.get('search') ?? '');

  const [selected, setSelected] = useState<Set<string>>(new Set());

  const [exporting, setExporting] = useState(false);

  const [filterName, setFilterName] = useState('');

  const [bulkDialog, setBulkDialog] = useState<BulkDialog>(null);

  const [bulkRoles, setBulkRoles] = useState<string[]>([]);

  const [bulkBranchIds, setBulkBranchIds] = useState<string[]>([]);

  const [bulkDepartmentId, setBulkDepartmentId] = useState('');

  const [view, setView] = useState<DirectoryView>((searchParams.get('view') as DirectoryView) || 'table');

  const status = (searchParams.get('status') as UserStatusFilter) || 'all';

  const role = searchParams.get('role') ?? '';

  const branchId = searchParams.get('branchId') ?? '';

  const departmentId = searchParams.get('departmentId') ?? '';

  const regionId = searchParams.get('regionId') ?? '';

  const employmentStatus = (searchParams.get('employmentStatus') as EmploymentStatus) || '';

  const page = Number(searchParams.get('page') ?? '1');



  const listParams = {

    search: searchParams.get('search') ?? undefined,

    status,

    role: role || undefined,

    branchId: branchId || undefined,

    departmentId: departmentId || undefined,

    regionId: regionId || undefined,

    employmentStatus: employmentStatus || undefined,

    page,

    limit: 25,

  };



  const infiniteParams = {

    search: listParams.search,

    status: listParams.status,

    role: listParams.role,

    branchId: listParams.branchId,

    departmentId: listParams.departmentId,

    regionId: listParams.regionId,

    employmentStatus: listParams.employmentStatus,

    limit: 50,

  };



  const usersQuery = useUsers(listParams, canView && view !== 'table');

  const infiniteUsersQuery = useInfiniteUsers(infiniteParams, canView && view === 'table');



  if (!canView) {

    return <AuthAlert variant="error">{t('users.accessDenied')}</AuthAlert>;

  }



  const data = usersQuery.data;

  const tableUsers = infiniteUsersQuery.data?.pages.flatMap((p) => p.items) ?? [];

  const tableTotal = infiniteUsersQuery.data?.pages[0]?.total ?? data?.total ?? 0;

  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.limit)) : 1;

  const displayItems = view === 'table' ? tableUsers : (data?.items ?? []);

  const pageIds = displayItems.map((r) => r.id);

  const allPageSelected = pageIds.length > 0 && pageIds.every((id) => selected.has(id));



  function applyFilters(

    next: Partial<{

      search: string;

      status: string;

      role: string;

      branchId: string;

      departmentId: string;

      regionId: string;

      employmentStatus: string;

      page: number;

    }>,

  ) {

    const params = new URLSearchParams(searchParams);

    const resetPage = next.page === undefined;

    if (next.search !== undefined) {

      if (next.search) params.set('search', next.search);

      else params.delete('search');

      if (resetPage) params.delete('page');

    }

    if (next.status !== undefined) {

      if (next.status && next.status !== 'all') params.set('status', next.status);

      else params.delete('status');

      if (resetPage) params.delete('page');

    }

    if (next.role !== undefined) {

      if (next.role) params.set('role', next.role);

      else params.delete('role');

      if (resetPage) params.delete('page');

    }

    if (next.branchId !== undefined) {

      if (next.branchId) params.set('branchId', next.branchId);

      else params.delete('branchId');

      if (resetPage) params.delete('page');

    }

    if (next.departmentId !== undefined) {

      if (next.departmentId) params.set('departmentId', next.departmentId);

      else params.delete('departmentId');

      if (resetPage) params.delete('page');

    }

    if (next.regionId !== undefined) {

      if (next.regionId) params.set('regionId', next.regionId);

      else params.delete('regionId');

      if (resetPage) params.delete('page');

    }

    if (next.employmentStatus !== undefined) {

      if (next.employmentStatus) params.set('employmentStatus', next.employmentStatus);

      else params.delete('employmentStatus');

      if (resetPage) params.delete('page');

    }

    if (next.page !== undefined) params.set('page', String(next.page));

    setSearchParams(params);

  }



  function currentFilterSnapshot() {

    return {

      search: searchParams.get('search') ?? '',

      status,

      role,

      branchId,

      departmentId,

      regionId,

      employmentStatus,

    };

  }



  function loadSavedFilter(filters: Record<string, unknown>) {

    applyFilters({

      search: String(filters.search ?? ''),

      status: String(filters.status ?? 'all'),

      role: String(filters.role ?? ''),

      branchId: String(filters.branchId ?? ''),

      departmentId: String(filters.departmentId ?? ''),

      regionId: String(filters.regionId ?? ''),

      employmentStatus: String(filters.employmentStatus ?? ''),

    });

    setSearchInput(String(filters.search ?? ''));

  }



  function toggleRow(id: string) {

    setSelected((prev) => {

      const next = new Set(prev);

      if (next.has(id)) next.delete(id);

      else next.add(id);

      return next;

    });

  }



  function togglePage() {

    setSelected((prev) => {

      const next = new Set(prev);

      if (allPageSelected) pageIds.forEach((id) => next.delete(id));

      else pageIds.forEach((id) => next.add(id));

      return next;

    });

  }



  async function handleExportCsv() {

    if (!user?.tenantId) return;

    setExporting(true);

    try {

      const token = await getValidAccessToken();

      if (!token) throw new Error('Not authenticated');

      const result = await fetchUsers(token, user.tenantId, { ...listParams, page: 1, limit: 5000 });

      downloadUsersCsv(result.items, `users-export-${new Date().toISOString().slice(0, 10)}.csv`);

    } finally {

      setExporting(false);

    }

  }



  function branchName(id: string | null) {

    if (!id) return '—';

    const branch = branches.find((b) => b.id === id);

    if (!branch) return id;

    return locale.startsWith('ar') && branch.nameAr ? branch.nameAr : branch.name;

  }



  async function confirmBulkDialog() {

    if (!bulkDialog || selected.size === 0) return;

    const userIds = [...selected];

    if (bulkDialog === 'roles') {

      await bulkMutation.mutateAsync({ userIds, action: 'assign_roles', roles: bulkRoles });

    } else if (bulkDialog === 'branches') {

      await bulkMutation.mutateAsync({ userIds, action: 'assign_branches', branchIds: bulkBranchIds });

    } else if (bulkDialog === 'department') {

      await bulkMutation.mutateAsync({

        userIds,

        action: 'assign_departments',

        departmentId: bulkDepartmentId || undefined,

      });

    }

    setBulkDialog(null);

    setSelected(new Set());

  }



  return (

    <section className={styles.panel} aria-labelledby="users-directory-title">

      <div className={styles.toolbar}>

        <h2 id="users-directory-title" className={styles.panelTitle}>

          {t('users.directory.title')}

        </h2>

        <div className={styles.actions}>

          <div className={styles.viewToggle} role="group" aria-label={t('users.directory.viewMode')}>

            {(['table', 'grid', 'cards'] as DirectoryView[]).map((v) => (

              <AuthButton

                key={v}

                variant={view === v ? 'primary' : 'secondary'}

                onClick={() => {

                  setView(v);

                  const params = new URLSearchParams(searchParams);

                  params.set('view', v);

                  setSearchParams(params);

                }}

              >

                {t(`users.directory.view${v.charAt(0).toUpperCase()}${v.slice(1)}` as 'users.title')}

              </AuthButton>

            ))}

          </div>

          {canExport && (

            <>

              <AuthButton variant="secondary" loading={exporting} onClick={() => void handleExportCsv()}>

                <Download size={16} aria-hidden />

                {t('users.directory.exportCsv')}

              </AuthButton>

              <AuthButton variant="secondary" loading={exportXlsx.isPending} onClick={() => void exportXlsx.mutateAsync(listParams)}>

                {t('users.directory.exportExcel')}

              </AuthButton>

              <AuthButton variant="secondary" loading={exportPdf.isPending} onClick={() => void exportPdf.mutateAsync()}>

                {t('users.directory.exportPdf')}

              </AuthButton>

            </>

          )}

          {data && view !== 'table' && (

            <p className={styles.fieldLabel}>

              {t('users.directory.total').replace('{count}', String(data.total))}

            </p>

          )}

          {view === 'table' && tableTotal > 0 && (

            <p className={styles.fieldLabel}>

              {t('users.directory.total').replace('{count}', String(tableTotal))}

            </p>

          )}

        </div>

      </div>



      <div className={styles.toolbar}>

        <label className={styles.filters}>

          <span className="visually-hidden">{t('users.directory.search')}</span>

          <Search size={16} aria-hidden />

          <input

            className={styles.input}

            value={searchInput}

            placeholder={t('users.directory.searchPlaceholder')}

            onChange={(e) => setSearchInput(e.target.value)}

            onKeyDown={(e) => {

              if (e.key === 'Enter') applyFilters({ search: searchInput.trim() });

            }}

          />

          <AuthButton variant="secondary" onClick={() => applyFilters({ search: searchInput.trim() })}>

            {t('users.directory.search')}

          </AuthButton>

        </label>



        <div className={styles.filters}>

          <select className={styles.select} value={status} aria-label={t('users.directory.status')} onChange={(e) => applyFilters({ status: e.target.value })}>

            <option value="all">{t('users.directory.allStatuses')}</option>

            {USER_STATUS_FILTERS.filter((s) => s !== 'all').map((s) => (

              <option key={s} value={s}>{t(`users.status.${s}`)}</option>

            ))}

          </select>



          <select className={styles.select} value={role} aria-label={t('users.directory.role')} onChange={(e) => applyFilters({ role: e.target.value })}>

            <option value="">{t('users.directory.allRoles')}</option>

            {assignableRoles().map((r) => (

              <option key={r} value={r}>{t(`users.roleLabels.${r}` as 'users.title')}</option>

            ))}

          </select>



          <select className={styles.select} value={branchId} aria-label={t('users.directory.branch')} onChange={(e) => applyFilters({ branchId: e.target.value })}>

            <option value="">{t('users.directory.allBranches')}</option>

            {branches.map((b) => (

              <option key={b.id} value={b.id}>

                {locale.startsWith('ar') && b.nameAr ? b.nameAr : b.name}

              </option>

            ))}

          </select>



          <select className={styles.select} value={departmentId} aria-label={t('users.directory.department')} onChange={(e) => applyFilters({ departmentId: e.target.value })}>

            <option value="">{t('users.directory.allDepartments')}</option>

            {departments.map((d) => (

              <option key={d.id} value={d.id}>

                {locale.startsWith('ar') && d.nameAr ? d.nameAr : d.name}

              </option>

            ))}

          </select>



          {regions.length > 0 && (

            <select className={styles.select} value={regionId} aria-label={t('users.directory.region')} onChange={(e) => applyFilters({ regionId: e.target.value })}>

              <option value="">{t('users.directory.allRegions')}</option>

              {regions.map((r) => (

                <option key={r.id} value={r.id}>

                  {locale.startsWith('ar') && r.nameAr ? r.nameAr : r.name}

                </option>

              ))}

            </select>

          )}



          <select

            className={styles.select}

            value={employmentStatus}

            aria-label={t('users.directory.employmentStatus')}

            onChange={(e) => applyFilters({ employmentStatus: e.target.value })}

          >

            <option value="">{t('users.directory.allEmploymentStatuses')}</option>

            {EMPLOYMENT_STATUS_FILTERS.map((s) => (

              <option key={s} value={s}>{t(`users.employment.${s}` as 'users.title')}</option>

            ))}

          </select>

        </div>

      </div>



      <div className={styles.savedFiltersRow}>

        <AuthFormField

          label={t('users.directory.filterName')}

          name="filterName"

          value={filterName}

          onChange={(e) => setFilterName(e.target.value)}

        />

        <AuthButton

          variant="secondary"

          disabled={!filterName.trim()}

          loading={saveFilterMutation.isPending}

          onClick={() =>

            void saveFilterMutation

              .mutateAsync({ name: filterName.trim(), filters: currentFilterSnapshot() })

              .then(() => setFilterName(''))

          }

        >

          {t('users.directory.saveFilter')}

        </AuthButton>

        {savedFilters.length > 0 && (

          <span className={styles.fieldLabel}>{t('users.directory.savedFilters')}:</span>

        )}

        {savedFilters.map((sf) => (

          <span key={sf.id} className={styles.savedFiltersRow}>

            <AuthButton variant="secondary" onClick={() => loadSavedFilter(sf.filters)}>

              {t('users.directory.loadFilter')}: {sf.name}

            </AuthButton>

            <AuthButton

              variant="secondary"

              loading={deleteFilterMutation.isPending}

              onClick={() => void deleteFilterMutation.mutateAsync(sf.id)}

            >

              {t('users.directory.deleteFilter')}

            </AuthButton>

          </span>

        ))}

      </div>



      {canManage && selected.size > 0 && (

        <div className={styles.actions}>

          <span className={styles.fieldLabel}>

            {t('users.directory.selected').replace('{count}', String(selected.size))}

          </span>

          <AuthButton variant="secondary" loading={bulkMutation.isPending} onClick={() => void bulkMutation.mutateAsync({ userIds: [...selected], action: 'suspend' }).then(() => setSelected(new Set()))}>

            {t('users.directory.bulkSuspend')}

          </AuthButton>

          <AuthButton variant="secondary" loading={bulkMutation.isPending} onClick={() => void bulkMutation.mutateAsync({ userIds: [...selected], action: 'deactivate' }).then(() => setSelected(new Set()))}>

            {t('users.directory.bulkDeactivate')}

          </AuthButton>

          <AuthButton variant="secondary" loading={bulkMutation.isPending} onClick={() => void bulkMutation.mutateAsync({ userIds: [...selected], action: 'reactivate' }).then(() => setSelected(new Set()))}>

            {t('users.directory.bulkReactivate')}

          </AuthButton>

          <AuthButton variant="secondary" loading={bulkMutation.isPending} onClick={() => void bulkMutation.mutateAsync({ userIds: [...selected], action: 'archive' }).then(() => setSelected(new Set()))}>

            {t('users.directory.bulkArchive')}

          </AuthButton>

          <AuthButton variant="secondary" loading={bulkMutation.isPending} onClick={() => void bulkMutation.mutateAsync({ userIds: [...selected], action: 'restore' }).then(() => setSelected(new Set()))}>

            {t('users.directory.bulkRestore')}

          </AuthButton>

          <AuthButton variant="secondary" onClick={() => setBulkDialog('roles')}>{t('users.directory.bulkAssignRoles')}</AuthButton>

          <AuthButton variant="secondary" onClick={() => setBulkDialog('branches')}>{t('users.directory.bulkAssignBranches')}</AuthButton>

          <AuthButton variant="secondary" onClick={() => setBulkDialog('department')}>{t('users.directory.bulkAssignDepartment')}</AuthButton>

        </div>

      )}



      {bulkDialog && (

        <div className={styles.bulkDialog} role="dialog" aria-modal="true" aria-labelledby="bulk-dialog-title">

          <div className={styles.bulkDialogPanel}>

            <h3 id="bulk-dialog-title" className={styles.panelTitle}>{t('users.directory.bulkDialogTitle')}</h3>

            {bulkDialog === 'roles' && (

              <fieldset>

                <legend className={styles.fieldLabel}>{t('users.directory.selectRoles')}</legend>

                <div className={styles.checkboxGrid}>

                  {assignableRoles().map((r) => (

                    <label key={r} className={styles.checkboxLabel}>

                      <input

                        type="checkbox"

                        checked={bulkRoles.includes(r)}

                        onChange={() =>

                          setBulkRoles((prev) => (prev.includes(r) ? prev.filter((x) => x !== r) : [...prev, r]))

                        }

                      />

                      {t(`users.roleLabels.${r}` as 'users.title')}

                    </label>

                  ))}

                </div>

              </fieldset>

            )}

            {bulkDialog === 'branches' && (

              <fieldset>

                <legend className={styles.fieldLabel}>{t('users.directory.selectBranches')}</legend>

                <div className={styles.checkboxGrid}>

                  {branches.map((b) => (

                    <label key={b.id} className={styles.checkboxLabel}>

                      <input

                        type="checkbox"

                        checked={bulkBranchIds.includes(b.id)}

                        onChange={() =>

                          setBulkBranchIds((prev) =>

                            prev.includes(b.id) ? prev.filter((x) => x !== b.id) : [...prev, b.id],

                          )

                        }

                      />

                      {locale.startsWith('ar') && b.nameAr ? b.nameAr : b.name}

                    </label>

                  ))}

                </div>

              </fieldset>

            )}

            {bulkDialog === 'department' && (

              <label className={styles.field}>

                <span className={styles.fieldLabel}>{t('users.directory.selectDepartment')}</span>

                <select className={styles.select} value={bulkDepartmentId} onChange={(e) => setBulkDepartmentId(e.target.value)}>

                  <option value="">{t('users.detail.unassigned')}</option>

                  {departments.map((d) => (

                    <option key={d.id} value={d.id}>

                      {locale.startsWith('ar') && d.nameAr ? d.nameAr : d.name}

                    </option>

                  ))}

                </select>

              </label>

            )}

            <div className={styles.actions}>

              <AuthButton loading={bulkMutation.isPending} onClick={() => void confirmBulkDialog()}>

                {t('users.directory.bulkDialogConfirm')}

              </AuthButton>

              <AuthButton variant="secondary" onClick={() => setBulkDialog(null)}>

                {t('users.directory.bulkDialogCancel')}

              </AuthButton>

            </div>

          </div>

        </div>

      )}



      {(usersQuery.isError || infiniteUsersQuery.isError) && <AuthAlert variant="error">{t('users.loadError')}</AuthAlert>}



      {view !== 'table' && (

        <UserDirectoryViews

          users={displayItems}

          view={view}

          selected={selected}

          canManage={canManage}

          branchName={branchName}

          onToggle={toggleRow}

        />

      )}



      {view === 'table' && (

        <VirtualizedUsersTable

          users={displayItems}

          selected={selected}

          canManage={canManage}

          allPageSelected={allPageSelected}

          branchName={branchName}

          onToggle={toggleRow}

          onTogglePage={togglePage}

          hasMore={Boolean(infiniteUsersQuery.hasNextPage)}

          loadingMore={infiniteUsersQuery.isFetchingNextPage}

          onLoadMore={() => void infiniteUsersQuery.fetchNextPage()}

        />

      )}



      <UsersImportPanel />



      {!usersQuery.isLoading && !infiniteUsersQuery.isLoading && displayItems.length === 0 && (

        <p className={styles.empty}>{t('users.directory.empty')}</p>

      )}



      {view !== 'table' && data && data.total > data.limit && (

        <div className={styles.pagination}>

          <AuthButton variant="secondary" disabled={page <= 1} onClick={() => applyFilters({ page: page - 1 })}>

            ←

          </AuthButton>

          <span>

            {t('users.directory.page').replace('{page}', String(page)).replace('{totalPages}', String(totalPages))}

          </span>

          <AuthButton variant="secondary" disabled={page >= totalPages} onClick={() => applyFilters({ page: page + 1 })}>

            →

          </AuthButton>

        </div>

      )}

    </section>

  );

}


