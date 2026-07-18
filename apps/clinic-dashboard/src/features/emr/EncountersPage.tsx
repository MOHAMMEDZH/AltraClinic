import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Plus, RefreshCw, Search } from 'lucide-react';
import { hasPermission } from '@booking/permissions';
import { useI18n } from '@booking/i18n/react';
import { useAuth } from '@/app/providers/AuthProvider';
import { useOnlineStatus } from '@/features/auth/hooks/useOnlineStatus';
import { AuthButton } from '@/features/auth/components/AuthButton';
import { AuthAlert } from '@/features/auth/components/AuthAlert';
import { Modal } from '@/features/patients/components/Modal';
import { EmptyState } from '@/features/patients/components/EmptyState';
import {
  canCreateEmr,
  canUpdateEmr,
  canViewEmr,
  endOfDay,
  isPendingDocumentation,
  resolveEmrViewMode,
  startOfDay,
} from './config/emr-config';
import { useCreateEncounter, useEmrDashboard, useEmrMetrics, useEncountersList, useClinicalSearch } from './hooks/useEmr';
import { EncounterMetrics } from './components/EncounterMetrics';
import { EmrCommandCenter } from './components/EmrCommandCenter';
import { NoteTemplateAdminPanel } from './components/NoteTemplateAdminPanel';
import { EncounterTable } from './components/EncounterTable';
import { EncounterForm } from './components/EncounterForm';
import styles from './EncountersPage.module.css';

type DateFilter = 'today' | 'week' | 'all' | 'pending';

export function EncountersPage() {
  const { t } = useI18n();
  const { user } = useAuth();
  const online = useOnlineStatus();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const searchRef = useRef<HTMLInputElement>(null);

  const roles = user?.roles ?? [];
  const clinicianId = user?.userId ?? '';
  const perm = useCallback(
    (action: string) => hasPermission(roles, 'api.emr', action as never),
    [roles],
  );

  const viewMode = resolveEmrViewMode(roles);
  const initialPatientId = searchParams.get('patientId') ?? undefined;

  const [search, setSearch] = useState('');
  const [debouncedQ, setDebouncedQ] = useState('');
  const [dateFilter, setDateFilter] = useState<DateFilter>(() => {
    const raw = searchParams.get('filter');
    if (raw === 'pending') return 'pending';
    if (raw === 'week') return 'week';
    if (raw === 'all') return 'all';
    return 'today';
  });
  const [createOpen, setCreateOpen] = useState(Boolean(initialPatientId));
  const [formError, setFormError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    const tmr = setTimeout(() => setDebouncedQ(search.trim()), 300);
    return () => clearTimeout(tmr);
  }, [search]);

  const range = useMemo(() => {
    const now = new Date();
    if (dateFilter === 'all' || dateFilter === 'pending') return {};
    if (dateFilter === 'week') {
      const start = new Date(now);
      start.setDate(start.getDate() - 7);
      return { from: startOfDay(start).toISOString(), to: endOfDay(now).toISOString() };
    }
    return { from: startOfDay(now).toISOString(), to: endOfDay(now).toISOString() };
  }, [dateFilter]);

  const listQuery = useEncountersList(
    {
      q: debouncedQ || undefined,
      clinicianId: viewMode === 'doctor' ? clinicianId : undefined,
      ...range,
    },
    canViewEmr(perm),
  );
  const metricsQuery = useEmrMetrics(canViewEmr(perm));
  const dashboardQuery = useEmrDashboard(canViewEmr(perm));
  const searchQuery = useClinicalSearch(debouncedQ, debouncedQ.length >= 2 && canViewEmr(perm));
  const createMutation = useCreateEncounter();

  const isDemo = listQuery.isError;

  const encounters = useMemo(() => {
    if (debouncedQ.length >= 2 && searchQuery.data?.encounters.length) {
      return searchQuery.data.encounters;
    }
    const items = listQuery.data?.items ?? [];
    if (dateFilter !== 'pending') return items;
    return items.filter((e) => isPendingDocumentation(e));
  }, [listQuery.data?.items, dateFilter, debouncedQ, searchQuery.data?.encounters]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === '/' && searchRef.current) {
        e.preventDefault();
        searchRef.current.focus();
      }
      if (e.key === 'n' && canCreateEmr(perm)) {
        setCreateOpen(true);
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [perm]);

  if (!canViewEmr(perm)) {
    return (
      <div className={styles.page}>
        <AuthAlert variant="error">{t('emr.errors.accessDenied')}</AuthAlert>
      </div>
    );
  }

  return (
    <div className={styles.page} id="encounters-region">
      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>{t('emr.title')}</h1>
          <p className={styles.subtitle}>{t('emr.subtitle')}</p>
          <p className={styles.keyboardHint}>{t('emr.keyboard.hint')}</p>
        </div>
        <div className={styles.headerActions}>
          <AuthButton
            variant="secondary"
            onClick={() => {
              void listQuery.refetch();
              void metricsQuery.refetch();
              void dashboardQuery.refetch();
            }}
            aria-label={t('emr.refresh')}
          >
            <RefreshCw size={16} aria-hidden className={listQuery.isFetching ? styles.spin : undefined} />
            {t('emr.refresh')}
          </AuthButton>
          {canCreateEmr(perm) && (
            <AuthButton onClick={() => setCreateOpen(true)}>
              <Plus size={16} aria-hidden />
              {t('emr.newEncounter')}
            </AuthButton>
          )}
        </div>
      </header>

      {!online && <AuthAlert variant="warning">{t('emr.offlineBanner')}</AuthAlert>}
      {isDemo && online && <AuthAlert variant="info">{t('emr.demoBanner')}</AuthAlert>}
      {success && <AuthAlert variant="success">{success}</AuthAlert>}
      {formError && <AuthAlert variant="error">{formError}</AuthAlert>}

      <EncounterMetrics
        metrics={dashboardQuery.data ?? metricsQuery.data}
        loading={dashboardQuery.isLoading || metricsQuery.isLoading}
      />

      <EmrCommandCenter dashboard={dashboardQuery.data} loading={dashboardQuery.isLoading} />

      {viewMode === 'manager' && canUpdateEmr(perm) && <NoteTemplateAdminPanel />}

      {viewMode === 'manager' && dashboardQuery.data?.pendingDocumentationList?.length ? (
        <section className={styles.dashboardSection}>
          <h2 className={styles.dashboardTitle}>{t('emr.dashboard.pendingTitle')}</h2>
          <EncounterTable encounters={dashboardQuery.data.pendingDocumentationList} />
        </section>
      ) : null}

      <div className={styles.toolbar}>
        <div className={styles.searchWrap}>
          <Search size={16} className={styles.searchIcon} aria-hidden />
          <input
            ref={searchRef}
            type="search"
            className={styles.searchInput}
            placeholder={t('emr.searchPlaceholder')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label={t('emr.searchPlaceholder')}
          />
        </div>
        <div className={styles.filters} role="group" aria-label={t('emr.filter.today')}>
          {(['today', 'week', 'all', 'pending'] as DateFilter[]).map((f) => (
            <button
              key={f}
              type="button"
              className={dateFilter === f ? styles.filterActive : styles.filterBtn}
              aria-pressed={dateFilter === f}
              onClick={() => setDateFilter(f)}
            >
              {t(`emr.filter.${f === 'pending' ? 'pendingDocs' : f}`)}
            </button>
          ))}
        </div>
        <span className={styles.viewBadge}>{t(`emr.views.${viewMode}`)}</span>
      </div>

      {listQuery.isLoading && !listQuery.data ? (
        <div className={styles.skeleton} aria-busy="true" />
      ) : !encounters.length ? (
        <EmptyState
          title={t('emr.empty.title')}
          description={t('emr.empty.description')}
          action={
            canCreateEmr(perm) ? (
              <AuthButton onClick={() => setCreateOpen(true)}>{t('emr.empty.action')}</AuthButton>
            ) : undefined
          }
        />
      ) : (
        <EncounterTable encounters={encounters} />
      )}

      <Modal
        open={createOpen}
        title={t('emr.form.createTitle')}
        onClose={() => setCreateOpen(false)}
        size="lg"
      >
        <EncounterForm
          clinicianId={clinicianId}
          initialPatientId={initialPatientId}
          submitLabel={t('emr.form.create')}
          loading={createMutation.isPending}
          onCancel={() => setCreateOpen(false)}
          onSubmit={async (payload) => {
            setFormError(null);
            try {
              const result = await createMutation.mutateAsync(payload);
              setCreateOpen(false);
              setSuccess(t('emr.success.created'));
              navigate(`/encounters/${result.id}`);
            } catch {
              setFormError(t('emr.errors.create'));
            }
          }}
        />
      </Modal>
    </div>
  );
}
