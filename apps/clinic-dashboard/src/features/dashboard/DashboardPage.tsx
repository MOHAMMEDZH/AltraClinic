import { useMemo, useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { RefreshCw, Search, Download, LayoutGrid } from 'lucide-react';
import { useI18n } from '@booking/i18n/react';
import { useAuth } from '@/app/providers/AuthProvider';
import { useOnlineStatus } from '@/features/auth/hooks/useOnlineStatus';
import { AuthAlert } from '@/features/auth/components/AuthAlert';
import { canShowDemoOverview } from '@/lib/demo-fallback';
import { DynamicDashboardProvider, useDynamicDashboard } from '@/features/dynamic-dashboard/context/DynamicDashboardProvider';
import { useOptionalBranch } from '@/features/dynamic-branch/context/DynamicBranchProvider';
import {
  clearRemoteDashboardLayout,
  fetchRemoteDashboardLayout,
  saveRemoteDashboardLayout,
} from './api/dashboard-layout-api';
import {
  filterWidgetsByCategory,
  getProfileLabelKey,
  getProfileLayoutType,
  getProfileSubtitleKey,
  resolveDashboardProfile,
  type DashboardWidgetId,
} from './config/dashboard-config';
import {
  canSelectDashboardBranch,
  resolveDashboardBranchSelection,
} from './config/dashboard-branch-scope';
import { useDashboardOverview } from './hooks/useDashboardOverview';
import { useDashboardBranches } from './hooks/useDashboardBranches';
import { useDashboardRealtime } from './hooks/useDashboardRealtime';
import { DashboardWidgets } from './components/DashboardWidgets';
import {
  buildInitialLayoutPrefs,
  DashboardLayoutDialog,
} from './components/DashboardLayoutDialog';
import { WidgetSkeleton } from './components/WidgetShell';
import { createDemoOverview, type DashboardRange } from './api/dashboard-api';
import { downloadDashboardExcel } from './lib/export-dashboard-excel';
import { downloadDashboardWord } from './lib/export-dashboard-word';
import { runExport } from '@/lib/run-export';
import {
  buildDashboardRangeQuery,
  DASHBOARD_PRESET_RANGES,
  defaultCustomRange,
  parseDashboardCustomRangeParams,
  type DashboardCustomRange,
} from './lib/dashboard-range';
import {
  applyLayoutPreferences,
  clearDashboardLayout,
  loadDashboardLayout,
  saveDashboardLayout,
  type DashboardLayoutPrefs,
} from './lib/dashboard-layout-storage';
import {
  parseDashboardBranchParam,
  parseDashboardCategoryParam,
  parseDashboardRangeParam,
  type DashboardWidgetCategory,
} from './lib/dashboard-drill-down';
import styles from './DashboardPage.module.css';

function widgetTitleKey(id: DashboardWidgetId): string {
  const map: Partial<Record<DashboardWidgetId, string>> = {
    'kpi-overview': 'kpi',
    'quick-actions': 'quickActions',
    'today-appointments': 'appointments',
    'queue-status': 'queue',
    'patient-stats': 'patients',
    'revenue-summary': 'revenue',
    'outstanding-payments': 'outstanding',
    'revenue-chart': 'revenueChart',
    'appointment-trends': 'appointmentTrends',
    'patient-growth': 'patientGrowth',
    'branch-performance': 'branch',
    'doctor-performance': 'doctor',
    'treatment-stats': 'treatment',
    'inventory-alerts': 'inventory',
    'low-stock': 'lowStock',
    'subscription-status': 'subscription',
    notifications: 'notifications',
    'recent-activities': 'activities',
    'tasks-reminders': 'tasks',
    'business-health': 'health',
  };
  return map[id] ?? id;
}

const RANGE_OPTIONS = DASHBOARD_PRESET_RANGES;
const CATEGORY_OPTIONS: DashboardWidgetCategory[] = [
  'all',
  'operations',
  'finance',
  'clinical',
  'inventory',
  'platform',
];

const LAYOUT_CLASS = {
  executive: styles.pageExecutive,
  operational: styles.pageOperational,
  clinical: styles.pageClinical,
} as const;

export function DashboardPage() {
  return (
    <DynamicDashboardProvider>
      <DashboardPageContent />
    </DynamicDashboardProvider>
  );
}

function DashboardPageContent() {
  const { t, locale } = useI18n();
  const { user, getValidAccessToken } = useAuth();
  const online = useOnlineStatus();
  const [searchParams, setSearchParams] = useSearchParams();
  const [search, setSearch] = useState('');
  const [layoutOpen, setLayoutOpen] = useState(false);
  const roles = user?.roles ?? [];
  const branchCtx = useOptionalBranch();
  const canSelectBranch =
    branchCtx?.view.canSelectBranch ?? canSelectDashboardBranch(roles);
  const profile = resolveDashboardProfile(roles);
  const layoutType = getProfileLayoutType(profile);

  const [range, setRange] = useState<DashboardRange>(() =>
    parseDashboardRangeParam(searchParams.get('range')),
  );
  const [customRange, setCustomRange] = useState<DashboardCustomRange>(() =>
    parseDashboardCustomRangeParams(searchParams.get('from'), searchParams.get('to')),
  );
  const [selectedBranchId, setSelectedBranchId] = useState<string | null>(() =>
    canSelectBranch ? parseDashboardBranchParam(searchParams.get('branchId')) : null,
  );
  const [category, setCategory] = useState<DashboardWidgetCategory>(() =>
    parseDashboardCategoryParam(searchParams.get('category')),
  );

  const configuredBranchId =
    branchCtx?.configuration.reporting.defaultBranchFilter ??
    branchCtx?.activeBranchId ??
    user?.branchId;
  const branchId = resolveDashboardBranchSelection(roles, configuredBranchId, selectedBranchId);
  const { data: branches = [] } = useDashboardBranches();
  const showBranchSelect = canSelectBranch && branches.length > 0;

  const syncUrl = useCallback(() => {
    const next = new URLSearchParams();
    for (const [key, value] of Object.entries(buildDashboardRangeQuery(range, customRange))) {
      next.set(key, value);
    }
    if (showBranchSelect) next.set('branchId', selectedBranchId ?? 'all');
    if (category !== 'all') next.set('category', category);
    setSearchParams(next, { replace: true });
  }, [range, customRange, selectedBranchId, category, showBranchSelect, setSearchParams]);

  useEffect(() => {
    syncUrl();
  }, [syncUrl]);

  const { widgetIds: defaultWidgetIds } = useDynamicDashboard();

  const [layoutPrefs, setLayoutPrefs] = useState<DashboardLayoutPrefs>(() =>
    buildInitialLayoutPrefs(defaultWidgetIds),
  );

  useEffect(() => {
    let cancelled = false;

    async function loadLayout() {
      const defaults = buildInitialLayoutPrefs(defaultWidgetIds);
      if (!user?.userId || !user?.tenantId) {
        if (!cancelled) setLayoutPrefs(defaults);
        return;
      }

      const local = loadDashboardLayout(user.userId, user.tenantId, profile);
      try {
        const token = await getValidAccessToken();
        if (token && online) {
          const remote = await fetchRemoteDashboardLayout(token, user.tenantId, profile);
          if (remote) {
            saveDashboardLayout(user.userId, user.tenantId, profile, remote);
            if (!cancelled) setLayoutPrefs(remote);
            return;
          }
        }
      } catch {
        // fall back to local cache
      }

      if (!cancelled) setLayoutPrefs(local ?? defaults);
    }

    void loadLayout();
    return () => {
      cancelled = true;
    };
  }, [user?.userId, user?.tenantId, profile, defaultWidgetIds, getValidAccessToken, online]);

  const layoutWidgets = useMemo(
    () => applyLayoutPreferences(defaultWidgetIds, layoutPrefs),
    [defaultWidgetIds, layoutPrefs],
  );

  const categoryWidgets = useMemo(
    () => filterWidgetsByCategory(layoutWidgets, category),
    [layoutWidgets, category],
  );

  const filteredWidgets = useMemo(() => {
    if (!search.trim()) return categoryWidgets;
    const q = search.toLowerCase();
    return categoryWidgets.filter((id) =>
      t(`dashboard.widgets.${widgetTitleKey(id)}.title`, id).toLowerCase().includes(q),
    );
  }, [categoryWidgets, search, t]);

  const { data, isLoading, isError, refetch, isFetching, dataUpdatedAt } = useDashboardOverview(
    branchId,
    range,
    range === 'custom' ? customRange : undefined,
  );

  const isDemo = canShowDemoOverview(online, isError, Boolean(data));
  const { connectionState } = useDashboardRealtime(online && !isDemo);
  const overview = data ?? (isDemo ? createDemoOverview(range, customRange) : null);

  const branchLabel = useMemo(() => {
    if (!showBranchSelect) {
      const own = branches.find((b) => b.id === user?.branchId);
      return own?.name ?? t('dashboard.branch.current');
    }
    if (selectedBranchId === null) return t('dashboard.branch.all');
    const match = branches.find((b) => b.id === selectedBranchId);
    return match?.name ?? t('dashboard.branch.all');
  }, [showBranchSelect, selectedBranchId, branches, user?.branchId, t]);

  const updatedLabel = dataUpdatedAt
    ? new Intl.DateTimeFormat(locale, { hour: '2-digit', minute: '2-digit' }).format(
        new Date(dataUpdatedAt),
      )
    : '—';

  const liveConnected = connectionState === 'connected';
  const profileSubtitle = t(getProfileSubtitleKey(profile), t('dashboard.subtitle'));

  function persistLayout(prefs: DashboardLayoutPrefs) {
    setLayoutPrefs(prefs);
    if (user?.userId && user?.tenantId) {
      saveDashboardLayout(user.userId, user.tenantId, profile, prefs);
      void (async () => {
        try {
          const token = await getValidAccessToken();
          if (token && online) {
            await saveRemoteDashboardLayout(token, user.tenantId, profile, prefs);
          }
        } catch {
          // local cache remains authoritative offline
        }
      })();
    }
  }

  function resetLayout() {
    const defaults = buildInitialLayoutPrefs(defaultWidgetIds);
    setLayoutPrefs(defaults);
    if (user?.userId && user?.tenantId) {
      clearDashboardLayout(user.userId, user.tenantId, profile);
      void (async () => {
        try {
          const token = await getValidAccessToken();
          if (token && online) {
            await clearRemoteDashboardLayout(token, user.tenantId, profile);
          }
        } catch {
          // ignore
        }
      })();
    }
  }

  return (
    <div className={[styles.page, LAYOUT_CLASS[layoutType]].join(' ')}>
      <header className={styles.header}>
        <div className={styles.headerMain}>
          <h1 className={styles.title}>{t('dashboard.title')}</h1>
          <p className={styles.subtitle}>{profileSubtitle}</p>
          <div className={styles.meta}>
            <span className={styles.badge}>{t(getProfileLabelKey(profile))}</span>
            <span
              className={[
                styles.staleDot,
                !online ? styles.staleDotOffline : liveConnected ? styles.staleDotLive : '',
              ].join(' ')}
              aria-hidden
            />
            <span>
              {t('dashboard.lastUpdated')}: {updatedLabel}
            </span>
            <span aria-hidden>·</span>
            <span>{t(`dashboard.range.${range}`)}</span>
            <span aria-hidden>·</span>
            <span>{branchLabel}</span>
          </div>
        </div>

        <div className={styles.toolbar}>
          <div className={styles.toolbarScroll}>
            {showBranchSelect && (
              <label className={styles.branchSelectWrap}>
                <span className={styles.visuallyHidden}>{t('dashboard.branch.label')}</span>
                <select
                  className={styles.branchSelect}
                  value={selectedBranchId ?? 'all'}
                  onChange={(e) =>
                    setSelectedBranchId(e.target.value === 'all' ? null : e.target.value)
                  }
                  aria-label={t('dashboard.branch.label')}
                >
                  <option value="all">{t('dashboard.branch.all')}</option>
                  {branches.map((branch) => (
                    <option key={branch.id} value={branch.id}>
                      {locale.startsWith('ar') && branch.nameAr ? branch.nameAr : branch.name}
                    </option>
                  ))}
                </select>
              </label>
            )}

            <div className={styles.rangeGroup} role="group" aria-label={t('dashboard.rangeLabel')}>
              {RANGE_OPTIONS.map((option) => (
                <button
                  key={option}
                  type="button"
                  className={[
                    styles.toolbarBtn,
                    range === option ? styles.toolbarBtnActive : '',
                  ].join(' ')}
                  aria-pressed={range === option}
                  onClick={() => {
                    setRange(option);
                    if (option === 'custom') {
                      setCustomRange((current) =>
                        current.from && current.to ? current : defaultCustomRange(),
                      );
                    }
                  }}
                >
                  {t(`dashboard.range.${option}`)}
                </button>
              ))}
            </div>

            {range === 'custom' && (
              <div className={styles.customRangeGroup}>
                <label className={styles.customRangeField}>
                  <span className={styles.visuallyHidden}>{t('dashboard.customRangeFrom')}</span>
                  <span className={styles.customRangeLabel}>{t('dashboard.customRangeFrom')}</span>
                  <input
                    type="date"
                    className={styles.customRangeInput}
                    value={customRange.from}
                    max={customRange.to}
                    onChange={(e) => setCustomRange((prev) => ({ ...prev, from: e.target.value }))}
                    aria-label={t('dashboard.customRangeFrom')}
                  />
                </label>
                <label className={styles.customRangeField}>
                  <span className={styles.visuallyHidden}>{t('dashboard.customRangeTo')}</span>
                  <span className={styles.customRangeLabel}>{t('dashboard.customRangeTo')}</span>
                  <input
                    type="date"
                    className={styles.customRangeInput}
                    value={customRange.to}
                    min={customRange.from}
                    onChange={(e) => setCustomRange((prev) => ({ ...prev, to: e.target.value }))}
                    aria-label={t('dashboard.customRangeTo')}
                  />
                </label>
              </div>
            )}

            <div
              className={styles.rangeGroup}
              role="group"
              aria-label={t('dashboard.categoryLabel')}
            >
              {CATEGORY_OPTIONS.map((option) => (
                <button
                  key={option}
                  type="button"
                  className={[
                    styles.toolbarBtn,
                    styles.toolbarBtnCompact,
                    category === option ? styles.toolbarBtnActive : '',
                  ].join(' ')}
                  aria-pressed={category === option}
                  onClick={() => setCategory(option)}
                >
                  {t(`dashboard.categories.${option}`)}
                </button>
              ))}
            </div>
          </div>

          <div className={styles.searchWrap}>
            <Search size={16} className={styles.searchIcon} aria-hidden />
            <input
              className={styles.searchInput}
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t('dashboard.searchPlaceholder')}
              aria-label={t('dashboard.searchPlaceholder')}
            />
          </div>
          <button
            type="button"
            className={styles.toolbarBtn}
            onClick={() => setLayoutOpen(true)}
            aria-label={t('dashboard.layout.open')}
          >
            <LayoutGrid size={16} />
            {t('dashboard.layout.open')}
          </button>
          <button
            type="button"
            className={styles.toolbarBtn}
            onClick={() =>
              overview &&
              void runExport(
                () => downloadDashboardExcel(overview, t('dashboard.title'), locale),
                'Excel export failed',
              )
            }
            disabled={!overview}
            aria-label={t('dashboard.exportExcel')}
          >
            <Download size={16} />
            {t('dashboard.exportExcel')}
          </button>
          <button
            type="button"
            className={styles.toolbarBtn}
            onClick={() =>
              overview &&
              void runExport(
                () => downloadDashboardWord(overview, t('dashboard.title'), locale),
                'Word export failed',
              )
            }
            disabled={!overview}
            aria-label={t('dashboard.exportWord')}
          >
            <Download size={16} />
            {t('dashboard.exportWord')}
          </button>
          <button
            type="button"
            className={styles.toolbarBtn}
            onClick={() => void refetch()}
            aria-label={t('dashboard.refresh')}
          >
            <RefreshCw size={16} className={isFetching ? styles.spin : undefined} />
            {t('dashboard.refresh')}
          </button>
        </div>
      </header>

      {!online && (
        <p className={styles.offlineNote} role="status">
          {t('dashboard.offline')}
        </p>
      )}

      {isDemo && online && (
        <p className={styles.offlineNote} role="status">
          {t('dashboard.demoNote')}
        </p>
      )}

      {isError && !isDemo && !isLoading && !overview && (
        <AuthAlert variant="error">{t('dashboard.loadError')}</AuthAlert>
      )}

      <div id="dashboard-region" className={styles.grid} aria-label={t('dashboard.title')} aria-live="polite">
        {isLoading ? (
          layoutWidgets.slice(0, 6).map((id) => <WidgetSkeleton key={id} span="half" />)
        ) : !overview ? (
          isError && !isDemo ? null : (
            layoutWidgets.slice(0, 6).map((id) => <WidgetSkeleton key={id} span="half" />)
          )
        ) : filteredWidgets.length === 0 ? (
          <p className={styles.emptyFilter} role="status">
            {t('dashboard.empty.filter')}
          </p>
        ) : (
          <DashboardWidgets
            widgetIds={filteredWidgets}
            data={overview}
            isDemo={isDemo}
            branchId={branchId}
            range={range}
            profile={profile}
          />
        )}
      </div>

      <DashboardLayoutDialog
        open={layoutOpen}
        onClose={() => setLayoutOpen(false)}
        widgetIds={defaultWidgetIds}
        prefs={layoutPrefs}
        onSave={persistLayout}
        onReset={resetLayout}
        widgetTitle={(id) => t(`dashboard.widgets.${widgetTitleKey(id)}.title`, id)}
      />
    </div>
  );
}
