import { useMemo } from 'react';
import { useI18n } from '@booking/i18n/react';
import type { BeautyMeasurement } from '../types/beauty.types';
import styles from './MeasurementsPanel.module.css';

interface MeasurementsPanelProps {
  measurements: BeautyMeasurement[];
}

export function MeasurementsPanel({ measurements }: MeasurementsPanelProps) {
  const { t, locale } = useI18n();

  const grouped = useMemo(() => {
    const map = new Map<string, BeautyMeasurement[]>();
    for (const m of measurements) {
      const list = map.get(m.label) ?? [];
      list.push(m);
      map.set(m.label, list.sort((a, b) => new Date(a.recordedAt).getTime() - new Date(b.recordedAt).getTime()));
    }
    return map;
  }, [measurements]);

  if (!measurements.length) {
    return <p className={styles.empty}>{t('beauty.measurements.empty')}</p>;
  }

  return (
    <div className={styles.wrap}>
      {Array.from(grouped.entries()).map(([label, points]) => {
        const latest = points[points.length - 1];
        const first = points[0];
        const delta = latest.value - first.value;
        return (
          <article key={label} className={styles.card}>
            <h4 className={styles.label}>{label}</h4>
            <div className={styles.valueRow}>
              <span className={styles.value}>
                {latest.value} {latest.unit}
              </span>
              {points.length > 1 && (
                <span className={[styles.delta, delta <= 0 ? styles.good : styles.warn].join(' ')}>
                  {delta > 0 ? '+' : ''}
                  {delta.toFixed(1)} {latest.unit}
                </span>
              )}
            </div>
            <div className={styles.chart} role="img" aria-label={t('beauty.measurements.chart')}>
              {points.map((p) => {
                const max = Math.max(...points.map((x) => x.value), 1);
                const h = Math.max(8, (p.value / max) * 100);
                return (
                  <div
                    key={p.id}
                    className={styles.bar}
                    style={{ height: `${h}%` }}
                    title={`${new Date(p.recordedAt).toLocaleDateString(locale)}: ${p.value}`}
                  />
                );
              })}
            </div>
          </article>
        );
      })}
    </div>
  );
}
