import { Link } from 'react-router-dom';
import { Calendar, CreditCard, ClipboardList, Package, Stethoscope, Users } from 'lucide-react';
import { useI18n } from '@booking/i18n/react';
import type { DashboardOverview, DashboardRange } from '../api/dashboard-api';
import {
  getQuickActionsForProfile,
  type DashboardProfileId,
  type DashboardWidgetId,
  type QuickActionId,
} from '../config/dashboard-config';
import { dashboardDrillDown } from '../lib/dashboard-drill-down';
import { useOptionalActivity } from '@/features/dynamic-activity/context/DynamicActivityProvider';
import { resolveActivityWidgetConfig } from '@/features/dynamic-activity/lib/activity-read-model';
import {
  formatCurrency,
  formatNumber,
  formatPercent,
  formatPersonName,
  formatRelativeTime,
  formatTime,
  formatWait,
  pickLocalizedName,
} from '../lib/dashboard-format';
import { WidgetEmpty, WidgetShell } from './WidgetShell';
import { KpiDrillCard, WidgetDrillLink } from './KpiDrillCard';
import { LazyAppointmentChart, LazyPatientGrowthChart, LazyRevenueChart } from './charts/LazyCharts';
import styles from '../DashboardPage.module.css';

interface DashboardWidgetsProps {
  widgetIds: DashboardWidgetId[];
  data: DashboardOverview;
  isDemo: boolean;
  branchId?: string | null;
  range?: DashboardRange;
  profile: DashboardProfileId;
}

const QUICK_ACTION_META: Record<
  QuickActionId,
  { to: string; icon: typeof Calendar; labelKey: string }
> = {
  appointments: { to: '/appointments', icon: Calendar, labelKey: 'nav.appointments' },
  queue: { to: '/queue', icon: Users, labelKey: 'nav.queue' },
  patients: { to: '/patients', icon: Stethoscope, labelKey: 'nav.patients' },
  billing: { to: '/billing', icon: CreditCard, labelKey: 'nav.billing' },
  inventory: { to: '/inventory', icon: Package, labelKey: 'nav.inventory' },
  encounters: { to: '/encounters', icon: ClipboardList, labelKey: 'nav.encounters' },
};

export function DashboardWidgets({
  widgetIds,
  data,
  isDemo,
  branchId,
  range = '7d',
  profile,
}: DashboardWidgetsProps) {
  const { t, locale } = useI18n();
  const activityCtx = useOptionalActivity();
  const activityWidgetConfig = resolveActivityWidgetConfig(activityCtx?.snapshot);
  const { kpis } = data;
  const drill = t('dashboard.viewDetails');
  const quickActions = getQuickActionsForProfile(profile);

  const widgets: Record<DashboardWidgetId, JSX.Element | null> = {
    'kpi-overview': (
      <WidgetShell key="kpi" title={t('dashboard.widgets.kpi.title')} span="full">
        <div className={styles.kpiGrid}>
          <KpiDrillCard
            label={t('dashboard.kpi.patients')}
            value={formatNumber(kpis.totalPatients, locale)}
            to={dashboardDrillDown.patients()}
            ariaLabel={`${t('dashboard.kpi.patients')}: ${formatNumber(kpis.totalPatients, locale)}`}
          />
          <KpiDrillCard
            label={t('dashboard.kpi.appointmentsToday')}
            value={formatNumber(kpis.appointmentsToday, locale)}
            to={dashboardDrillDown.appointmentsToday(branchId)}
            ariaLabel={`${t('dashboard.kpi.appointmentsToday')}: ${formatNumber(kpis.appointmentsToday, locale)}`}
          />
          <KpiDrillCard
            label={t('dashboard.kpi.queue')}
            value={formatNumber(kpis.queueWaiting, locale)}
            to={dashboardDrillDown.queue()}
            ariaLabel={`${t('dashboard.kpi.queue')}: ${formatNumber(kpis.queueWaiting, locale)}`}
          />
          <KpiDrillCard
            label={t('dashboard.kpi.revenueToday')}
            value={formatCurrency(kpis.revenueToday, locale)}
            to={dashboardDrillDown.billing()}
            ariaLabel={`${t('dashboard.kpi.revenueToday')}: ${formatCurrency(kpis.revenueToday, locale)}`}
          />
          <KpiDrillCard
            label={t('dashboard.kpi.revenueMonth')}
            value={formatCurrency(kpis.revenueMonth, locale)}
            to={dashboardDrillDown.billing()}
            ariaLabel={`${t('dashboard.kpi.revenueMonth')}: ${formatCurrency(kpis.revenueMonth, locale)}`}
          />
          <KpiDrillCard
            label={t('dashboard.kpi.outstanding')}
            value={formatCurrency(kpis.outstandingAmount, locale)}
            to={dashboardDrillDown.billingOutstanding()}
            ariaLabel={`${t('dashboard.kpi.outstanding')}: ${formatCurrency(kpis.outstandingAmount, locale)}`}
          />
        </div>
      </WidgetShell>
    ),
    'quick-actions': (
      <WidgetShell key="qa" title={t('dashboard.widgets.quickActions.title')} span="full">
        <nav className={styles.quickActions} aria-label={t('dashboard.widgets.quickActions.title')}>
          {quickActions.map((actionId) => {
            const meta = QUICK_ACTION_META[actionId];
            const Icon = meta.icon;
            return (
              <Link key={actionId} className={styles.quickAction} to={meta.to}>
                <Icon size={16} aria-hidden />
                {t(meta.labelKey)}
              </Link>
            );
          })}
        </nav>
      </WidgetShell>
    ),
    'today-appointments': (
      <WidgetShell
        key="appt"
        title={t('dashboard.widgets.appointments.title')}
        description={t('dashboard.widgets.appointments.desc')}
        span="half"
        footer={<Link to="/appointments">{t('dashboard.viewAll')}</Link>}
      >
        {data.todayAppointments.length === 0 ? (
          <WidgetEmpty message={t('dashboard.empty.appointments')} />
        ) : (
          <ul className={styles.list}>
            {data.todayAppointments.map((a) => (
              <li key={a.id} className={styles.listItem}>
                <Link className={styles.listItemLink} to={dashboardDrillDown.appointmentSelected(a.id)}>
                  <p className={styles.listPrimary}>
                    {t('dashboard.patientRef', a.patientId.slice(0, 8))}
                  </p>
                  <p className={styles.listSecondary}>
                    {formatTime(a.scheduledStart, locale)} · {a.status}
                  </p>
                </Link>
                <span
                  className={[
                    styles.statusPill,
                    a.status === 'CONFIRMED' ? styles.statusConfirmed : styles.statusPending,
                  ].join(' ')}
                >
                  {a.status}
                </span>
              </li>
            ))}
          </ul>
        )}
      </WidgetShell>
    ),
    'queue-status': (
      <WidgetShell
        key="queue"
        title={t('dashboard.widgets.queue.title')}
        span="half"
        footer={<Link to="/queue">{t('dashboard.viewAll')}</Link>}
      >
        {data.queue.length === 0 ? (
          <WidgetEmpty message={t('dashboard.empty.queue')} />
        ) : (
          <ul className={styles.list}>
            {data.queue.map((q) => (
              <li key={q.id} className={styles.listItem}>
                <Link className={styles.listItemLink} to={dashboardDrillDown.queue()}>
                  <p className={styles.listPrimary}>
                    {t('dashboard.patientRef', q.patientId.slice(0, 8))}
                  </p>
                  <p className={styles.listSecondary}>
                    {t('dashboard.waitTime')}: {formatWait(q.waitTimeSeconds)}
                  </p>
                </Link>
                <span className={[styles.statusPill, styles.statusWaiting].join(' ')}>{q.status}</span>
              </li>
            ))}
          </ul>
        )}
      </WidgetShell>
    ),
    'patient-stats': (
      <WidgetShell
        key="patients"
        title={t('dashboard.widgets.patients.title')}
        span="half"
        action={<WidgetDrillLink to={dashboardDrillDown.patients()} label={drill} />}
        footer={<Link to={dashboardDrillDown.patients()}>{t('dashboard.viewAll')}</Link>}
      >
        <div className={styles.kpiGrid}>
          <article className={styles.kpiCard}>
            <p className={styles.kpiLabel}>{t('dashboard.kpi.patients')}</p>
            <p className={styles.kpiValue}>{formatNumber(kpis.totalPatients, locale)}</p>
          </article>
          <article className={styles.kpiCard}>
            <p className={styles.kpiLabel}>{t('dashboard.kpi.newToday')}</p>
            <p className={styles.kpiValue}>{formatNumber(data.live.newPatientsToday, locale)}</p>
          </article>
        </div>
      </WidgetShell>
    ),
    'revenue-summary': (
      <WidgetShell
        key="rev"
        title={t('dashboard.widgets.revenue.title')}
        span="half"
        action={<WidgetDrillLink to={dashboardDrillDown.billing()} label={drill} />}
        footer={<Link to={dashboardDrillDown.billing()}>{t('dashboard.viewAll')}</Link>}
      >
        <div className={styles.kpiGrid}>
          <article className={styles.kpiCard}>
            <p className={styles.kpiLabel}>{t('dashboard.kpi.revenueToday')}</p>
            <p className={styles.kpiValue}>{formatCurrency(kpis.revenueToday, locale)}</p>
          </article>
          <article className={styles.kpiCard}>
            <p className={styles.kpiLabel}>{t('dashboard.kpi.revenueMonth')}</p>
            <p className={styles.kpiValue}>{formatCurrency(kpis.revenueMonth, locale)}</p>
          </article>
        </div>
      </WidgetShell>
    ),
    'outstanding-payments': (
      <WidgetShell
        key="out"
        title={t('dashboard.widgets.outstanding.title')}
        span="half"
        action={<WidgetDrillLink to={dashboardDrillDown.billingOutstanding()} label={drill} />}
        footer={<Link to={dashboardDrillDown.billingOutstanding()}>{t('dashboard.viewAll')}</Link>}
      >
        <p className={styles.kpiValue}>{formatCurrency(kpis.outstandingAmount, locale)}</p>
        <p className={styles.listSecondary}>{t('dashboard.widgets.outstanding.desc')}</p>
      </WidgetShell>
    ),
    'revenue-chart': (
      <WidgetShell
        key="revchart"
        title={t('dashboard.widgets.revenueChart.title')}
        span="two-thirds"
        action={<WidgetDrillLink to={dashboardDrillDown.analytics('revenue', range, branchId)} label={drill} />}
        footer={<Link to={dashboardDrillDown.analytics('revenue', range, branchId)}>{t('dashboard.viewAll')}</Link>}
      >
        <LazyRevenueChart data={data.revenueTrend} locale={locale} />
      </WidgetShell>
    ),
    'appointment-trends': (
      <WidgetShell
        key="apptchart"
        title={t('dashboard.widgets.appointmentTrends.title')}
        span="two-thirds"
        action={<WidgetDrillLink to={dashboardDrillDown.analytics('appointments', range, branchId)} label={drill} />}
        footer={<Link to={dashboardDrillDown.analytics('appointments', range, branchId)}>{t('dashboard.viewAll')}</Link>}
      >
        <LazyAppointmentChart data={data.appointmentTrend} />
      </WidgetShell>
    ),
    'patient-growth': (
      <WidgetShell
        key="growth"
        title={t('dashboard.widgets.patientGrowth.title')}
        span="two-thirds"
        action={<WidgetDrillLink to={dashboardDrillDown.analytics('patients', range, branchId)} label={drill} />}
        footer={<Link to={dashboardDrillDown.analytics('patients', range, branchId)}>{t('dashboard.viewAll')}</Link>}
      >
        <LazyPatientGrowthChart data={data.patientGrowthTrend} />
      </WidgetShell>
    ),
    'branch-performance': (
      <WidgetShell key="branch" title={t('dashboard.widgets.branch.title')} span="half">
        {data.branchPerformance.length === 0 ? (
          <WidgetEmpty message={t('dashboard.empty.branchPerformance')} />
        ) : (
          <ul className={styles.performanceList}>
            {data.branchPerformance.map((branch) => {
              const maxAppts = Math.max(...data.branchPerformance.map((b) => b.appointments), 1);
              const width = Math.round((branch.appointments / maxAppts) * 100);
              return (
                <li key={branch.branchId} className={styles.performanceItem}>
                  <Link
                    className={styles.performanceLink}
                    to={dashboardDrillDown.branchDashboard(branch.branchId, range)}
                  >
                    <div className={styles.performanceHeader}>
                    <span className={styles.listPrimary}>
                      {pickLocalizedName(locale, branch.name, branch.nameAr)}
                    </span>
                    <span className={styles.listSecondary}>
                      {formatNumber(branch.appointments, locale)} ·{' '}
                      {formatCurrency(branch.revenue, locale)}
                    </span>
                  </div>
                  <div className={styles.performanceBarTrack} aria-hidden>
                    <div className={styles.performanceBarFill} style={{ width: `${width}%` }} />
                  </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </WidgetShell>
    ),
    'doctor-performance': (
      <WidgetShell key="doc" title={t('dashboard.widgets.doctor.title')} span="half">
        {data.doctorPerformance.length === 0 ? (
          <WidgetEmpty message={t('dashboard.empty.doctorPerformance')} />
        ) : (
          <ul className={styles.list}>
            {data.doctorPerformance.map((doc) => (
              <li key={doc.providerId} className={styles.listItem}>
                <Link
                  className={styles.listItemLink}
                  to={dashboardDrillDown.appointmentsByProvider(doc.providerId, branchId)}
                >
                  <p className={styles.listPrimary}>
                    {formatPersonName(
                      locale,
                      doc.firstName,
                      doc.lastName,
                      doc.firstNameAr,
                      doc.lastNameAr,
                    )}
                  </p>
                  <p className={styles.listSecondary}>
                    {formatNumber(doc.appointments, locale)} {t('dashboard.doctorAppointments')} ·{' '}
                    {formatNumber(doc.encounters, locale)} {t('dashboard.doctorEncounters')}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </WidgetShell>
    ),
    'treatment-stats': (
      <WidgetShell
        key="treat"
        title={t('dashboard.widgets.treatment.title')}
        span="half"
        action={<WidgetDrillLink to={dashboardDrillDown.encountersPending()} label={drill} />}
        footer={<Link to={dashboardDrillDown.encountersPending()}>{t('dashboard.viewAll')}</Link>}
      >
        <p className={styles.kpiValue}>{formatNumber(kpis.encountersOpen, locale)}</p>
        <p className={styles.listSecondary}>{t('dashboard.widgets.treatment.desc')}</p>
      </WidgetShell>
    ),
    'inventory-alerts': (
      <WidgetShell
        key="inv"
        title={t('dashboard.widgets.inventory.title')}
        span="half"
        action={<WidgetDrillLink to={dashboardDrillDown.inventoryLowStock()} label={drill} />}
        footer={<Link to={dashboardDrillDown.inventoryLowStock()}>{t('dashboard.viewAll')}</Link>}
      >
        <p className={styles.kpiValue}>{formatNumber(kpis.lowStockCount, locale)}</p>
        <p className={styles.listSecondary}>{t('dashboard.widgets.inventory.desc')}</p>
      </WidgetShell>
    ),
    'low-stock': (
      <WidgetShell
        key="stock"
        title={t('dashboard.widgets.lowStock.title')}
        span="half"
        footer={<Link to={dashboardDrillDown.inventoryLowStock()}>{t('dashboard.viewAll')}</Link>}
      >
        {data.lowStockItems.length === 0 ? (
          <WidgetEmpty message={t('dashboard.empty.inventory')} />
        ) : (
          <ul className={styles.list}>
            {data.lowStockItems.map((item) => (
              <li key={item.id} className={styles.listItem}>
                <Link className={styles.listItemLink} to={dashboardDrillDown.inventoryItem(item.id)}>
                  <p className={styles.listPrimary}>
                    {pickLocalizedName(locale, item.nameEn, item.nameAr)}
                  </p>
                  <p className={styles.listSecondary}>
                    {item.sku} · {item.quantityOnHand} / {item.reorderThreshold}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </WidgetShell>
    ),
    'subscription-status': (
      <WidgetShell key="sub" title={t('dashboard.widgets.subscription.title')} span="half">
        {!data.subscription ? (
          <WidgetEmpty message={t('dashboard.empty.subscription')} />
        ) : (
          <div className={styles.kpiGrid}>
            <article className={styles.kpiCard}>
              <p className={styles.kpiLabel}>{t('dashboard.subscription.plan')}</p>
              <p className={styles.kpiValue}>{data.subscription.plan}</p>
            </article>
            <article className={styles.kpiCard}>
              <p className={styles.kpiLabel}>{t('dashboard.subscription.status')}</p>
              <p className={styles.kpiValue}>{data.subscription.status}</p>
            </article>
            {data.subscription.pricePerMonth > 0 && (
              <article className={styles.kpiCard}>
                <p className={styles.kpiLabel}>{t('dashboard.subscription.price')}</p>
                <p className={styles.kpiValue}>
                  {formatCurrency(
                    data.subscription.pricePerMonth,
                    locale,
                    data.subscription.currency,
                  )}
                </p>
              </article>
            )}
          </div>
        )}
      </WidgetShell>
    ),
    notifications: (
      <WidgetShell
        key="notif"
        title={t('dashboard.widgets.notifications.title')}
        span="half"
        footer={<Link to="/settings/notifications/inbox">{t('dashboard.viewAll')}</Link>}
      >
        {data.notifications.length === 0 ? (
          <WidgetEmpty message={t('dashboard.empty.notifications')} />
        ) : (
          <ul className={styles.list}>
            {data.notifications.map((n) => (
              <li
                key={n.id}
                className={[styles.listItem, !n.readAt ? styles.notificationUnread : ''].join(' ')}
              >
                <Link to={`/settings/notifications/inbox/${n.id}`} className={styles.listPrimary}>
                  {n.title}
                </Link>
                <p className={styles.listSecondary}>{formatRelativeTime(n.createdAt, locale)}</p>
              </li>
            ))}
          </ul>
        )}
      </WidgetShell>
    ),
    'recent-activities': (
      <WidgetShell
        key="act"
        title={t('dashboard.widgets.activities.title')}
        span="half"
        footer={<Link to={activityWidgetConfig.viewAllHref}>{t('dashboard.viewAll')}</Link>}
      >
        {data.recentActivities.length === 0 ? (
          <WidgetEmpty message={t('dashboard.empty.activities')} />
        ) : (
          <ul className={styles.list}>
            {data.recentActivities.map((a) => (
              <li key={a.id} className={styles.listItem}>
                <p className={styles.listPrimary}>
                  {pickLocalizedName(locale, a.descriptionEn, a.descriptionAr) ?? a.action}
                </p>
                <p className={styles.listSecondary}>{formatRelativeTime(a.createdAt, locale)}</p>
              </li>
            ))}
          </ul>
        )}
      </WidgetShell>
    ),
    'tasks-reminders': (
      <WidgetShell
        key="tasks"
        title={t('dashboard.widgets.tasks.title')}
        span="half"
        footer={<Link to="/workflows">{t('dashboard.viewAll')}</Link>}
      >
        {data.tasks.length === 0 ? (
          <WidgetEmpty message={t('dashboard.empty.tasks')} />
        ) : (
          <ul className={styles.list}>
            {data.tasks.map((task) => (
              <li key={task.id} className={styles.listItem}>
                <Link to={`/workflows/instances/${task.id}`} className={styles.listPrimary}>
                  {pickLocalizedName(locale, task.nameEn, task.nameAr)}
                </Link>
                <p className={styles.listSecondary}>
                  {t('dashboard.taskProgress')}: {task.currentStepIndex + 1}/{task.stepsTotal}
                </p>
              </li>
            ))}
          </ul>
        )}
      </WidgetShell>
    ),
    'business-health': (
      <WidgetShell
        key="health"
        title={t('dashboard.widgets.health.title')}
        span="full"
        footer={<Link to={dashboardDrillDown.analytics('health', range, branchId)}>{t('dashboard.viewAll')}</Link>}
      >
        <div className={styles.healthGrid}>
          <Link className={styles.healthItemLink} to={dashboardDrillDown.appointmentTrends(branchId)}>
            <div className={styles.healthItem}>
              <p className={styles.kpiLabel}>{t('dashboard.health.utilization')}</p>
              <p className={styles.healthScore}>
                {formatPercent(data.businessHealth.utilizationPercent, locale)}
              </p>
            </div>
          </Link>
          <Link className={styles.healthItemLink} to={dashboardDrillDown.billingOutstanding()}>
            <div className={styles.healthItem}>
              <p className={styles.kpiLabel}>{t('dashboard.health.collection')}</p>
              <p className={styles.healthScore}>
                {formatPercent(data.businessHealth.collectionPercent, locale)}
              </p>
            </div>
          </Link>
          <Link
            className={styles.healthItemLink}
            to={dashboardDrillDown.appointmentsByStatus('NO_SHOW', branchId)}
          >
            <div className={styles.healthItem}>
              <p className={styles.kpiLabel}>{t('dashboard.health.noShow')}</p>
              <p className={styles.healthScore}>
                {formatPercent(data.businessHealth.noShowPercent, locale)}
              </p>
            </div>
          </Link>
        </div>
        {isDemo && <p className={styles.listSecondary}>{t('dashboard.demoNote')}</p>}
      </WidgetShell>
    ),
  };

  return <>{widgetIds.map((id) => widgets[id]).filter(Boolean)}</>;
}
