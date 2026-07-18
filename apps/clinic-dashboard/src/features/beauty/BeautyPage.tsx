import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
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
  canCreateBeauty,
  canViewBeauty,
  formatBeautyDate,
  resolveBeautyViewMode,
} from './config/beauty-config';
import { useBeautyMetrics, useBeautyOverview, useCreateBeautyRecord } from './hooks/useBeauty';
import { BeautyMetrics } from './components/BeautyMetrics';
import { BeautyCommandCenter } from './components/BeautyCommandCenter';
import { useBeautyDashboard } from './hooks/useBeautyDashboard';
import { useBeautyKeyboardShortcuts } from './hooks/useBeautyKeyboardShortcuts';
import { ReceptionWorkspace } from './components/ReceptionWorkspace';
import { ManagerAnalytics } from './components/ManagerAnalytics';
import { PractitionerWorkspace } from './components/PractitionerWorkspace';
import styles from './BeautyPage.module.css';

export function BeautyPage() {
  const { t, locale } = useI18n();
  const navigate = useNavigate();
  const { user } = useAuth();
  const online = useOnlineStatus();
  const searchRef = useRef<HTMLInputElement>(null);
  const roles = user?.roles ?? [];
  const perm = useCallback((action: string) => hasPermission(roles, 'api.beauty', action as never), [roles]);
  const viewMode = resolveBeautyViewMode(roles);

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

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === '/' && document.activeElement?.tagName !== 'INPUT') {
        e.preventDefault();
        searchRef.current?.focus();
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useBeautyKeyboardShortcuts({ enabled: canViewBeauty(perm), onFocusSearch: () => searchRef.current?.focus() });

  const metricsQuery = useBeautyMetrics(canViewBeauty(perm));
  const overviewQuery = useBeautyOverview(canViewBeauty(perm));
  const dashboardQuery = useBeautyDashboard(canViewBeauty(perm));
  const patientsQuery = usePatientsList({ q: patientSearch || undefined, limit: 8, offset: 0 });
  const createMutation = useCreateBeautyRecord();

  const items = useMemo(() => {
    const list = overviewQuery.data ?? [];
    if (!debouncedQ) return list;
    const q = debouncedQ.toLowerCase();
    return list.filter((i) => i.patientName.toLowerCase().includes(q));
  }, [overviewQuery.data, debouncedQ]);

  if (!canViewBeauty(perm)) {
    return (
      <div className={styles.page}>
        <AuthAlert variant="error">{t('beauty.errors.accessDenied')}</AuthAlert>
      </div>
    );
  }

  return (
    <div className={styles.page} id="beauty-region">
      <a href="#beauty-main" className={styles.skipLink}>{t('beauty.a11y.skipToMain')}</a>
      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>{t('beauty.title')}</h1>
          <p className={styles.subtitle}>{t('beauty.subtitle')}</p>
          <p className={styles.hint}>{t('beauty.keyboard.hint')}</p>
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
            {t('beauty.refresh')}
          </AuthButton>
          {canCreateBeauty(perm) && (
            <AuthButton onClick={() => setInitOpen(true)}>
              <Plus size={16} aria-hidden />
              {t('beauty.initializeRecord')}
            </AuthButton>
          )}
        </div>
      </header>

      {!online && <AuthAlert variant="warning">{t('beauty.offlineBanner')}</AuthAlert>}
      {overviewQuery.isError && !online && <AuthAlert variant="info">{t('beauty.demoBanner')}</AuthAlert>}
      {error && <AuthAlert variant="error">{error}</AuthAlert>}

      <main id="beauty-main" className={styles.main}>
        <section className={styles.dashboardShell} aria-label={t('beauty.dashboard.overview')}>
          <BeautyMetrics metrics={metricsQuery.data} loading={metricsQuery.isLoading} />
          <BeautyCommandCenter dashboard={dashboardQuery.data} loading={dashboardQuery.isLoading} />
        </section>

      {viewMode === 'reception' && (
        <ReceptionWorkspace items={items} locale={locale} pipeline={metricsQuery.data?.revenueEstimate} />
      )}
      {viewMode === 'manager' && <ManagerAnalytics />}
      {viewMode === 'practitioner' && <PractitionerWorkspace items={items} locale={locale} />}
      </main>

      <div className={styles.toolbar}>
        <div className={styles.searchWrap}>
          <Search size={16} className={styles.searchIcon} aria-hidden />
          <input
            ref={searchRef}
            type="search"
            className={styles.searchInput}
            placeholder={t('beauty.searchPlaceholder')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label={t('beauty.searchPlaceholder')}
          />
        </div>
        <span className={styles.viewBadge}>{t(`beauty.views.${viewMode}`)}</span>
      </div>

      {overviewQuery.isLoading && !overviewQuery.data ? (
        <div className={styles.skeleton} aria-busy="true" />
      ) : !items.length ? (
        <EmptyState title={t('beauty.empty.title')} description={t('beauty.empty.description')} />
      ) : (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <caption className={styles.srOnly}>{t('beauty.list.caption')}</caption>
            <thead>
              <tr>
                <th scope="col">{t('beauty.table.client')}</th>
                <th scope="col" className={styles.num}>
                  {t('beauty.table.activePlans')}
                </th>
                <th scope="col" className={styles.num}>
                  {t('beauty.table.sessions')}
                </th>
                <th scope="col">{t('beauty.table.nextSession')}</th>
                <th scope="col">{t('beauty.table.lastUpdated')}</th>
                <th scope="col"><span className={styles.srOnly}>{t('beauty.table.open')}</span></th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.patientId}>
                  <td>
                    <Link to={`/beauty/workspace/${item.patientId}`} className={styles.patientLink}>
                      {item.patientName}
                    </Link>
                  </td>
                  <td className={styles.num}>{item.activePlans}</td>
                  <td className={styles.num}>{item.sessionCount}</td>
                  <td className={styles.date}>
                    {item.nextSession ? formatBeautyDate(item.nextSession, locale) : '—'}
                  </td>
                  <td className={styles.date}>{formatBeautyDate(item.lastUpdated, locale)}</td>
                  <td>
                    <Link to={`/beauty/workspace/${item.patientId}`} className={styles.openLink}>
                      {t('beauty.table.open')}
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal open={initOpen} title={t('beauty.initializeRecord')} onClose={() => setInitOpen(false)} size="md">
        <div className={styles.initForm}>
          <input
            type="search"
            placeholder={t('beauty.searchPlaceholder')}
            value={patientSearch}
            onChange={(e) => setPatientSearch(e.target.value)}
            className={styles.searchInput}
            aria-label={t('beauty.searchPlaceholder')}
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
            <AuthButton variant="ghost" onClick={() => setInitOpen(false)}>
              {t('beauty.cancel')}
            </AuthButton>
            <AuthButton
              loading={createMutation.isPending}
              disabled={!selectedPatientId}
              onClick={async () => {
                setError(null);
                try {
                  await createMutation.mutateAsync(selectedPatientId);
                  setInitOpen(false);
                  navigate(`/beauty/workspace/${selectedPatientId}`);
                } catch {
                  setError(t('beauty.errors.save'));
                }
              }}
            >
              {t('beauty.initializeRecord')}
            </AuthButton>
          </div>
        </div>
      </Modal>
    </div>
  );
}
