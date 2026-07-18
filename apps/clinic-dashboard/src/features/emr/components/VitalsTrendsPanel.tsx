import { useMemo } from 'react';
import { useI18n } from '@booking/i18n/react';
import type { ObservationRecord } from '../types/emr.types';
import { VITAL_TYPES } from '../config/emr-config';
import styles from './VitalsTrendsPanel.module.css';

interface VitalsTrendsPanelProps {
  observations: ObservationRecord[];
}

export function VitalsTrendsPanel({ observations }: VitalsTrendsPanelProps) {
  const { t } = useI18n();

  const history = useMemo(() => {
    const byType = new Map<string, ObservationRecord[]>();
    for (const obs of observations) {
      if (!obs.recordedAt) continue;
      const list = byType.get(obs.type) ?? [];
      list.push(obs);
      byType.set(obs.type, list);
    }
    for (const [, list] of byType) {
      list.sort((a, b) => new Date(b.recordedAt!).getTime() - new Date(a.recordedAt!).getTime());
    }
    return byType;
  }, [observations]);

  const hasHistory = [...history.values()].some((list) => list.length > 1);
  if (!hasHistory) return null;

  return (
    <section className={styles.panel} aria-label={t('emr.vitals.trends')}>
      <h3 className={styles.title}>{t('emr.vitals.trends')}</h3>
      <div className={styles.grid}>
        {VITAL_TYPES.map(({ type, labelKey, unit }) => {
          const entries = history.get(type);
          if (!entries || entries.length < 2) return null;
          return (
            <article key={type} className={styles.card}>
              <p className={styles.label}>{t(labelKey)}</p>
              <ul className={styles.history}>
                {entries.slice(0, 5).map((e, i) => (
                  <li key={i}>
                    <span className={styles.value}>{e.value}</span>
                    {unit && <span className={styles.unit}>{unit}</span>}
                    {e.recordedAt && (
                      <span className={styles.time}>
                        {new Date(e.recordedAt).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </article>
          );
        })}
      </div>
    </section>
  );
}
