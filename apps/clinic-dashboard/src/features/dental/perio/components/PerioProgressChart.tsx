import { useMemo } from 'react';
import { useI18n } from '@booking/i18n/react';
import type { PerioProgress } from '../perio.types';
import { formatPerioDate } from '../perio-config';
import styles from './PerioProgressChart.module.css';

interface PerioProgressChartProps {
  progress: PerioProgress;
}

function Sparkline({
  values,
  max,
  label,
  invert,
}: {
  values: number[];
  max: number;
  label: string;
  invert?: boolean;
}) {
  const w = 280;
  const h = 48;
  const pad = 4;
  const scale = max > 0 ? max : 1;
  const points = values.map((v, i) => {
    const x = pad + (i / Math.max(values.length - 1, 1)) * (w - pad * 2);
    const y = h - pad - (v / scale) * (h - pad * 2);
    return `${x},${y}`;
  });

  const latest = values[values.length - 1];
  const first = values[0];
  const delta = latest != null && first != null ? latest - first : 0;
  const improved = invert ? delta < 0 : delta > 0;
  const worsened = invert ? delta > 0 : delta < 0;

  return (
    <div className={styles.spark}>
      <div className={styles.sparkHead}>
        <span className={styles.sparkLabel}>{label}</span>
        {values.length > 1 && delta !== 0 && (
          <span className={[styles.delta, improved ? styles.good : worsened ? styles.bad : ''].join(' ')}>
            {delta > 0 ? '+' : ''}
            {Math.round(delta * 10) / 10}
          </span>
        )}
      </div>
      <svg viewBox={`0 0 ${w} ${h}`} className={styles.svg} role="img" aria-label={label}>
        <polyline
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinejoin="round"
          strokeLinecap="round"
          points={points.join(' ')}
        />
        {values.map((v, i) => {
          const x = pad + (i / Math.max(values.length - 1, 1)) * (w - pad * 2);
          const y = h - pad - (v / scale) * (h - pad * 2);
          return <circle key={i} cx={x} cy={y} r="3" fill="currentColor" />;
        })}
      </svg>
    </div>
  );
}

export function PerioProgressChart({ progress }: PerioProgressChartProps) {
  const { t, locale } = useI18n();
  const points = progress.points;

  const bopValues = useMemo(() => points.map((p) => p.bopPercent), [points]);
  const pdValues = useMemo(() => points.map((p) => p.avgPocketDepth), [points]);
  const deepValues = useMemo(() => points.map((p) => p.sitesPd4Plus), [points]);

  if (points.length === 0) {
    return <p className={styles.empty}>{t('dental.perio.progress.empty')}</p>;
  }

  return (
    <div className={styles.wrap}>
      {progress.delta && (
        <div className={styles.deltaBanner} role="status">
          {t('dental.perio.progress.sinceBaseline')
            .replace('{bop}', String(progress.delta.bopPercent))
            .replace('{pd}', String(progress.delta.avgPocketDepth))
            .replace('{sites}', String(progress.delta.sitesPd4Plus))}
        </div>
      )}
      <div className={styles.grid}>
        <Sparkline values={bopValues} max={100} label={t('dental.perio.metrics.bop')} invert />
        <Sparkline values={pdValues} max={Math.max(...pdValues, 6)} label={t('dental.perio.metrics.avgPd')} invert />
        <Sparkline values={deepValues} max={Math.max(...deepValues, 10)} label={t('dental.perio.metrics.sites4Plus')} invert />
      </div>
      <ol className={styles.timeline}>
        {[...points].reverse().map((p) => (
          <li key={p.examId}>
            <time dateTime={p.examDate}>{formatPerioDate(p.examDate, locale)}</time>
            <span>{t(`dental.perio.stage.${p.stage}`)}</span>
            <span className={styles.meta}>
              BOP {p.bopPercent}% · PD {p.avgPocketDepth} mm
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}
