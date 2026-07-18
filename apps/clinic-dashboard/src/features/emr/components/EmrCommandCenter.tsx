import { Link } from 'react-router-dom';
import { AlertTriangle, Calendar, FileText, Stethoscope } from 'lucide-react';
import { useI18n } from '@booking/i18n/react';
import type { EmrDashboardResponse } from '../types/emr.types';
import { formatEncounterDate, formatFollowUpDate } from '../config/emr-config';
import styles from './EmrCommandCenter.module.css';

interface EmrCommandCenterProps {
  dashboard: EmrDashboardResponse | undefined;
  loading?: boolean;
}

export function EmrCommandCenter({ dashboard, loading }: EmrCommandCenterProps) {
  const { t, locale } = useI18n();
  const alerts = dashboard?.clinicalAlerts ?? [];
  const followUps = dashboard?.followUpTasks ?? [];
  const recent = dashboard?.recentEncounters ?? [];

  return (
    <section className={styles.grid} aria-label={t('emr.commandCenter.title')}>
      <article className={styles.panel}>
        <h2 className={styles.panelTitle}>
          <AlertTriangle size={16} aria-hidden />
          {t('emr.commandCenter.alerts')}
        </h2>
        {loading ? (
          <p className={styles.muted}>{t('emr.audit.loading')}</p>
        ) : alerts.length === 0 ? (
          <p className={styles.muted}>{t('emr.commandCenter.noAlerts')}</p>
        ) : (
          <ul className={styles.list}>
            {alerts.map((a) => (
              <li key={a.id} className={[styles.alertItem, styles[`sev_${a.severity}`]].join(' ')}>
                <Link
                  to={a.encounterId ? `/encounters/${a.encounterId}` : `/patients/${a.patientId}`}
                  className={styles.link}
                >
                  <strong>{a.patientName}</strong>
                  <span>{a.message}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </article>

      <article className={styles.panel}>
        <h2 className={styles.panelTitle}>
          <Stethoscope size={16} aria-hidden />
          {t('emr.commandCenter.recentActivity')}
        </h2>
        {recent.length === 0 ? (
          <p className={styles.muted}>{t('emr.empty.title')}</p>
        ) : (
          <ul className={styles.list}>
            {recent.map((e) => (
              <li key={e.id}>
                <Link to={`/encounters/${e.id}`} className={styles.link}>
                  <strong>{e.patientName}</strong>
                  <span>{e.chiefComplaint ?? formatEncounterDate(e.createdAt, locale)}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </article>

      <article className={styles.panel}>
        <h2 className={styles.panelTitle}>
          <Calendar size={16} aria-hidden />
          {t('emr.commandCenter.followUps')}
        </h2>
        {followUps.length === 0 ? (
          <p className={styles.muted}>{t('emr.commandCenter.noFollowUps')}</p>
        ) : (
          <ul className={styles.list}>
            {followUps.map((f) => (
              <li key={f.encounterId}>
                <Link to={`/encounters/${f.encounterId}`} className={styles.link}>
                  <strong>{f.patientName}</strong>
                  <span>{formatFollowUpDate(f.followUpDate, locale)}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </article>

      <article className={styles.panel}>
        <h2 className={styles.panelTitle}>
          <FileText size={16} aria-hidden />
          {t('emr.commandCenter.compliance')}
        </h2>
        <p className={styles.complianceValue} aria-busy={loading}>
          {loading ? '—' : `${dashboard?.documentationComplianceRate ?? 100}%`}
        </p>
        <p className={styles.muted}>{t('emr.commandCenter.complianceHint')}</p>
      </article>
    </section>
  );
}
