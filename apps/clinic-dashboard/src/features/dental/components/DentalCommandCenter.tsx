import { Link } from 'react-router-dom';
import { AlertTriangle, Calendar, DollarSign, Stethoscope } from 'lucide-react';
import { useI18n } from '@booking/i18n/react';
import { formatDentalDate } from '../config/dental-config';
import type { DentalDashboardResponse } from '../api/dental-dashboard-api';
import styles from './DentalCommandCenter.module.css';

interface DentalCommandCenterProps {
  dashboard: DentalDashboardResponse | undefined;
  loading?: boolean;
}

export function DentalCommandCenter({ dashboard, loading }: DentalCommandCenterProps) {
  const { t, locale } = useI18n();
  const alerts = dashboard?.clinicalAlerts ?? [];
  const appts = dashboard?.todayAppointments ?? [];
  const plans = dashboard?.activeTreatmentPlans ?? [];
  const revenue = dashboard?.revenueSummary;

  return (
    <section className={styles.grid} aria-label={t('dental.commandCenter.title')}>
      <article className={styles.panel}>
        <h2 className={styles.panelTitle}>
          <Calendar size={16} aria-hidden />
          {t('dental.commandCenter.todayAppointments')}
        </h2>
        {loading ? (
          <p className={styles.muted}>{t('dental.commandCenter.loading')}</p>
        ) : appts.length === 0 ? (
          <p className={styles.muted}>{t('dental.commandCenter.noAppointments')}</p>
        ) : (
          <ul className={styles.list}>
            {appts.map((a) => (
              <li key={a.id}>
                <Link to={`/dental/chart/${a.patientId}`} className={styles.link}>
                  <strong>{a.patientName}</strong>
                  <span>{formatDentalDate(a.scheduledStart, locale)}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </article>

      <article className={styles.panel}>
        <h2 className={styles.panelTitle}>
          <Stethoscope size={16} aria-hidden />
          {t('dental.commandCenter.activePlans')}
        </h2>
        {plans.length === 0 ? (
          <p className={styles.muted}>{t('dental.commandCenter.noPlans')}</p>
        ) : (
          <ul className={styles.list}>
            {plans.map((p) => (
              <li key={p.id}>
                <Link to={`/dental/chart/${p.patientId}/plan/${p.id}`} className={styles.link}>
                  <strong>{p.patientName}</strong>
                  <span>{p.title}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </article>

      <article className={styles.panel}>
        <h2 className={styles.panelTitle}>
          <DollarSign size={16} aria-hidden />
          {t('dental.commandCenter.revenue')}
        </h2>
        {revenue ? (
          <dl className={styles.revenue}>
            <div><dt>{t('dental.commandCenter.revenueWeek')}</dt><dd>{revenue.revenueThisWeek.toFixed(2)} {revenue.currency}</dd></div>
            <div><dt>{t('dental.commandCenter.collected')}</dt><dd>{revenue.collectedThisWeek.toFixed(2)}</dd></div>
            <div><dt>{t('dental.commandCenter.outstanding')}</dt><dd>{revenue.outstandingThisWeek.toFixed(2)}</dd></div>
          </dl>
        ) : (
          <p className={styles.muted}>—</p>
        )}
      </article>

      <article className={styles.panel}>
        <h2 className={styles.panelTitle}>
          <AlertTriangle size={16} aria-hidden />
          {t('dental.commandCenter.alerts')}
        </h2>
        {alerts.length === 0 ? (
          <p className={styles.muted}>{t('dental.commandCenter.noAlerts')}</p>
        ) : (
          <ul className={styles.list}>
            {alerts.map((a) => (
              <li key={a.id} className={[styles.alertItem, styles[`sev_${a.severity}`]].join(' ')}>
                <Link to={a.href} className={styles.link}>
                  {a.patientName && <strong>{a.patientName}</strong>}
                  <span>{a.message}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </article>
    </section>
  );
}
