import { AlertTriangle, Info } from 'lucide-react';
import { useI18n } from '@booking/i18n/react';
import type { PerioAlert } from '../perio.types';
import styles from './PerioAlertsPanel.module.css';

interface PerioAlertsPanelProps {
  alerts: PerioAlert[];
}

function alertMessage(t: (k: string) => string, alert: PerioAlert): string {
  const key = `dental.perio.alerts.${alert.code}`;
  let msg = t(key);
  if (msg === key) return alert.code;
  if (alert.params) {
    for (const [k, v] of Object.entries(alert.params)) {
      if (k === 'stage' && alert.code === 'periodontitis_stage') continue;
      msg = msg.replace(`{${k}}`, String(v));
    }
  }
  if (alert.params?.stage && alert.code === 'periodontitis_stage') {
    const stageKey = `dental.perio.stage.${alert.params.stage}`;
    const stageLabel = t(stageKey);
    msg = msg.replace('{stage}', stageLabel !== stageKey ? stageLabel : String(alert.params.stage));
  }
  if (alert.toothNumber) {
    msg = msg.replace('{tooth}', String(alert.toothNumber));
  }
  if (alert.site) {
    msg = msg.replace('{site}', alert.site.toUpperCase());
  }
  return msg;
}

export function PerioAlertsPanel({ alerts }: PerioAlertsPanelProps) {
  const { t } = useI18n();

  if (alerts.length === 0) {
    return (
      <div className={styles.empty} role="status">
        <Info size={16} aria-hidden />
        {t('dental.perio.alerts.none')}
      </div>
    );
  }

  return (
    <ul className={styles.list} aria-label={t('dental.perio.clinicalAlerts')}>
      {alerts.slice(0, 8).map((alert) => (
        <li
          key={alert.id}
          className={[styles.item, styles[`sev_${alert.severity}`]].join(' ')}
        >
          <AlertTriangle size={14} aria-hidden />
          <span>{alertMessage(t, alert)}</span>
        </li>
      ))}
    </ul>
  );
}
