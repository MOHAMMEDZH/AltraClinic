import { Link } from 'react-router-dom';
import { AlertTriangle, Calendar, Camera, DollarSign, Stethoscope } from 'lucide-react';
import { useI18n } from '@booking/i18n/react';
import { formatBeautyDate } from '../config/beauty-config';
import type { BeautyDashboardResponse } from '../api/beauty-dashboard-api';
import styles from './BeautyCommandCenter.module.css';

interface BeautyCommandCenterProps {
  dashboard: BeautyDashboardResponse | undefined;
  loading?: boolean;
}

export function BeautyCommandCenter({ dashboard, loading }: BeautyCommandCenterProps) {
  const { t, locale } = useI18n();

  return (
    <section className={styles.section} aria-label={t('beauty.commandCenter.title')}>
      <h2 className={styles.sectionTitle}>{t('beauty.commandCenter.title')}</h2>
      <div className={styles.grid}>
      <article className={styles.panel}>
        <h2 className={styles.panelTitle}>
          <Calendar size={16} aria-hidden />
          {t('beauty.commandCenter.todayAppointments')}
        </h2>
        {loading ? (
          <p className={styles.muted}>{t('beauty.commandCenter.loading')}</p>
        ) : !dashboard?.todayAppointments.length ? (
          <p className={styles.muted}>{t('beauty.commandCenter.noAppointments')}</p>
        ) : (
          <ul className={styles.list}>
            {dashboard.todayAppointments.map((a) => (
              <li key={a.id}>
                <Link to={`/beauty/workspace/${a.patientId}`} className={styles.link}>
                  <strong>{a.patientName}</strong>
                  <span>{formatBeautyDate(a.scheduledStart, locale)}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </article>

      <article className={styles.panel}>
        <h2 className={styles.panelTitle}>
          <Stethoscope size={16} aria-hidden />
          {t('beauty.commandCenter.activePlans')}
        </h2>
        {!dashboard?.activeTreatmentPlans.length ? (
          <p className={styles.muted}>{t('beauty.commandCenter.noPlans')}</p>
        ) : (
          <ul className={styles.list}>
            {dashboard.activeTreatmentPlans.map((p) => (
              <li key={`${p.patientId}-${p.id}`}>
                <Link to={`/beauty/workspace/${p.patientId}?tab=plans`} className={styles.link}>
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
          {t('beauty.commandCenter.revenue')}
        </h2>
        {dashboard?.revenueSummary ? (
          <dl className={styles.revenue}>
            <div><dt>{t('beauty.commandCenter.revenueWeek')}</dt><dd>{dashboard.revenueSummary.revenueThisWeek.toFixed(2)} {dashboard.revenueSummary.currency}</dd></div>
            <div><dt>{t('beauty.commandCenter.collected')}</dt><dd>{dashboard.revenueSummary.collectedThisWeek.toFixed(2)}</dd></div>
            <div><dt>{t('beauty.commandCenter.outstanding')}</dt><dd>{dashboard.revenueSummary.outstandingThisWeek.toFixed(2)}</dd></div>
          </dl>
        ) : (
          <p className={styles.muted}>—</p>
        )}
      </article>

      <article className={styles.panel}>
        <h2 className={styles.panelTitle}>
          <Camera size={16} aria-hidden />
          {t('beauty.commandCenter.beforeAfter')}
        </h2>
        {!dashboard?.beforeAfterActivity.length ? (
          <p className={styles.muted}>{t('beauty.commandCenter.noGallery')}</p>
        ) : (
          <ul className={styles.list}>
            {dashboard.beforeAfterActivity.map((m) => (
              <li key={m.id}>
                <Link to={m.patientId ? `/beauty/imaging/${m.patientId}` : '/beauty'} className={styles.link}>
                  <strong>{m.filename}</strong>
                  <span>{m.role ?? 'image'}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </article>

      <article className={styles.panel}>
        <h2 className={styles.panelTitle}>
          <AlertTriangle size={16} aria-hidden />
          {t('beauty.commandCenter.alerts')}
        </h2>
        {!dashboard?.clinicalAlerts.length ? (
          <p className={styles.muted}>{t('beauty.commandCenter.noAlerts')}</p>
        ) : (
          <ul className={styles.list}>
            {dashboard.clinicalAlerts.map((a) => (
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
      </div>
    </section>
  );
}
