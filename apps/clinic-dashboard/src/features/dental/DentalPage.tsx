import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, RefreshCw, Search } from 'lucide-react';
import { hasPermission } from '@booking/permissions';
import { useI18n } from '@booking/i18n/react';
import { useAuth } from '@/app/providers/AuthProvider';
import { useOnlineStatus } from '@/features/auth/hooks/useOnlineStatus';
import { AuthButton } from '@/features/auth/components/AuthButton';
import { AuthAlert } from '@/features/auth/components/AuthAlert';
import { EmptyState } from '@/features/patients/components/EmptyState';
import { Modal } from '@/features/patients/components/Modal';
import { usePatientsList } from '@/features/patients/hooks/usePatients';
import { patientFullName } from '@/features/patients/lib/patient-format';
import {
  canCreateDental,
  canViewDental,
  formatDentalDate,
  resolveDentalViewMode,
} from './config/dental-config';
import { useCreateDentalChart, useDentalMetrics, useDentalOverview } from './hooks/useDental';
import { useDentalDashboard } from './hooks/useDentalDashboard';
import { useDentalKeyboardShortcuts } from './hooks/useDentalKeyboardShortcuts';
import { DentalMetrics } from './components/DentalMetrics';
import { DentalCommandCenter } from './components/DentalCommandCenter';
import { DentalWorkspaceBar } from './components/DentalWorkspaceBar';
import { TreatmentPlanAnalytics } from './treatment-plan/TreatmentPlanAnalytics';
import styles from './DentalPage.module.css';

export function DentalPage() {
  const { t, locale } = useI18n();
  const { user } = useAuth();
  const online = useOnlineStatus();
  const searchRef = useRef<HTMLInputElement>(null);
  const roles = user?.roles ?? [];
  const perm = useCallback((action: string) => hasPermission(roles, 'api.dental', action as never), [roles]);
  const viewMode = resolveDentalViewMode(roles);

  const [search, setSearch] = useState('');
  const [debouncedQ, setDebouncedQ] = useState('');
  const [initOpen, setInitOpen] = useState(false);
  const [patientSearch, setPatientSearch] = useState('');
  const [selectedPatientId, setSelectedPatientId] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const tmr = setTimeout(() => setDebouncedQ(search.trim()), 300);
    return () => clearTimeout(tmr);
  }, [search]);

  const metricsQuery = useDentalMetrics(canViewDental(perm));
  const overviewQuery = useDentalOverview(canViewDental(perm));
  const dashboardQuery = useDentalDashboard(canViewDental(perm));
  const patientsQuery = usePatientsList({ q: patientSearch || undefined, limit: 8, offset: 0 });
  const createChartMutation = useCreateDentalChart();

  useDentalKeyboardShortcuts({
    enabled: canViewDental(perm),
    onFocusSearch: () => searchRef.current?.focus(),
  });

  const items = useMemo(() => {
    const list = overviewQuery.data ?? [];
    if (!debouncedQ) return list;
    const q = debouncedQ.toLowerCase();
    return list.filter((i) => i.patientName.toLowerCase().includes(q));
  }, [overviewQuery.data, debouncedQ]);

  if (!canViewDental(perm)) {
    return (
      <div className={styles.page}>
        <AuthAlert variant="error">{t('dental.errors.accessDenied')}</AuthAlert>
      </div>
    );
  }

  return (
    <div className={styles.page} id="dental-region">
      <a href="#dental-main" className={styles.skipLink}>{t('dental.a11y.skipToMain')}</a>

      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>{t('dental.title')}</h1>
          <p className={styles.subtitle}>{t('dental.subtitle')}</p>
          <p className={styles.hint}>{t('dental.keyboard.hint')}</p>
        </div>
        <div className={styles.headerActions}>
          <AuthButton
            variant="secondary"
            onClick={() => {
              void metricsQuery.refetch();
              void overviewQuery.refetch();
              void dashboardQuery.refetch();
            }}
          >
            <RefreshCw size={16} aria-hidden className={overviewQuery.isFetching ? styles.spin : undefined} />
            {t('dental.refresh')}
          </AuthButton>
          {canCreateDental(perm) && (
            <AuthButton onClick={() => setInitOpen(true)}>
              <Plus size={16} aria-hidden />
              {t('dental.initializeChart')}
            </AuthButton>
          )}
        </div>
      </header>

      {!online && <AuthAlert variant="warning">{t('dental.offlineBanner')}</AuthAlert>}
      {overviewQuery.isError && online && <AuthAlert variant="info">{t('dental.demoBanner')}</AuthAlert>}
      {error && <AuthAlert variant="error">{error}</AuthAlert>}

      <DentalWorkspaceBar viewMode={viewMode} />

      <main id="dental-main">
        <DentalCommandCenter dashboard={dashboardQuery.data} loading={dashboardQuery.isLoading} />

        {dashboardQuery.data && (
          <dl className={styles.kpiRow} aria-label={t('dental.commandCenter.kpis')}>
            <div>
              <dt>{t('dental.commandCenter.pendingProcedures')}</dt>
              <dd>{dashboardQuery.data.pendingProcedures}</dd>
            </div>
            <div>
              <dt>{t('dental.commandCenter.pendingPlans')}</dt>
              <dd>{dashboardQuery.data.pendingApprovalPlans}</dd>
            </div>
            <div>
              <dt>{t('dental.commandCenter.followUps')}</dt>
              <dd>{dashboardQuery.data.followUpPatients}</dd>
            </div>
          </dl>
        )}

        <DentalMetrics metrics={metricsQuery.data} loading={metricsQuery.isLoading} />

        {viewMode === 'manager' && <TreatmentPlanAnalytics />}
      </main>

      <div className={styles.toolbar}>
        <div className={styles.searchWrap}>
          <Search size={16} className={styles.searchIcon} aria-hidden />
          <input
            ref={searchRef}
            type="search"
            className={styles.searchInput}
            placeholder={t('dental.searchPlaceholder')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label={t('dental.searchPlaceholder')}
          />
        </div>
        <span className={styles.viewBadge}>{t(`dental.views.${viewMode}`)}</span>
      </div>

      {overviewQuery.isLoading && !overviewQuery.data ? (
        <div className={styles.skeleton} aria-busy="true" />
      ) : !items.length ? (
        <EmptyState title={t('dental.empty.title')} description={t('dental.empty.description')} />
      ) : (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <caption className={styles.srOnly}>{t('dental.list.caption')}</caption>
            <thead>
              <tr>
                <th scope="col">{t('dental.list.patient')}</th>
                <th scope="col">{t('dental.list.procedures')}</th>
                <th scope="col">{t('dental.list.planned')}</th>
                <th scope="col">{t('dental.list.updated')}</th>
                <th scope="col"><span className={styles.srOnly}>{t('dental.openChart')}</span></th>
              </tr>
            </thead>
            <tbody>
              {items.map((row) => (
                <tr key={row.chartId}>
                  <td><Link to={`/dental/chart/${row.patientId}`} className={styles.patientLink}>{row.patientName}</Link></td>
                  <td className={styles.num}>{row.procedureCount}</td>
                  <td className={styles.num}>{row.plannedCount}</td>
                  <td className={styles.date}>{formatDentalDate(row.lastUpdated, locale)}</td>
                  <td><Link to={`/dental/chart/${row.patientId}`} className={styles.openLink}>{t('dental.openChart')}</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal open={initOpen} title={t('dental.initializeChart')} onClose={() => setInitOpen(false)} size="md">
        <div className={styles.initForm}>
          <input
            type="search"
            className={styles.searchInput}
            placeholder={t('dental.searchPlaceholder')}
            value={patientSearch}
            onChange={(e) => setPatientSearch(e.target.value)}
          />
          <ul className={styles.patientList}>
            {(patientsQuery.data?.items ?? []).map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  className={selectedPatientId === p.id ? styles.patientSelected : styles.patientOption}
                  onClick={() => setSelectedPatientId(p.id)}
                >
                  {patientFullName(p, locale)}
                </button>
              </li>
            ))}
          </ul>
          <div className={styles.modalActions}>
            <AuthButton variant="ghost" onClick={() => setInitOpen(false)}>{t('dental.form.cancel')}</AuthButton>
            <AuthButton
              loading={createChartMutation.isPending}
              disabled={!selectedPatientId}
              onClick={async () => {
                setError(null);
                try {
                  await createChartMutation.mutateAsync(selectedPatientId);
                  setInitOpen(false);
                  window.location.href = `/dental/chart/${selectedPatientId}`;
                } catch {
                  setError(t('dental.errors.create'));
                }
              }}
            >
              {t('dental.form.create')}
            </AuthButton>
          </div>
        </div>
      </Modal>
    </div>
  );
}
