import { useI18n } from '@booking/i18n/react';
import { stageTone } from '../perio-config';
import type { PerioSummary } from '../perio.types';
import styles from './PerioSummaryBar.module.css';

interface PerioSummaryBarProps {
  summary: PerioSummary;
  examDate?: string;
}

export function PerioSummaryBar({ summary, examDate }: PerioSummaryBarProps) {
  const { t, locale } = useI18n();
  const tone = stageTone(summary.stage);

  return (
    <div className={styles.bar} role="region" aria-label={t('dental.perio.summary')}>
      <div className={styles.stageRow}>
        <span className={[styles.badge, styles[`tone_${tone}`]].join(' ')}>
          {t(`dental.perio.stage.${summary.stage}`)}
        </span>
        {examDate && (
          <time className={styles.date} dateTime={examDate}>
            {new Date(examDate).toLocaleDateString(locale, { month: 'short', day: 'numeric', year: 'numeric' })}
          </time>
        )}
      </div>
      <dl className={styles.stats}>
        <div>
          <dt>{t('dental.perio.metrics.bop')}</dt>
          <dd>{summary.bopPercent}%</dd>
        </div>
        <div>
          <dt>{t('dental.perio.metrics.avgPd')}</dt>
          <dd>{summary.avgPocketDepth} mm</dd>
        </div>
        <div>
          <dt>{t('dental.perio.metrics.sites4Plus')}</dt>
          <dd>{summary.sitesPd4Plus}</dd>
        </div>
        <div>
          <dt>{t('dental.perio.metrics.maxPd')}</dt>
          <dd>{summary.maxPocketDepth} mm</dd>
        </div>
        <div>
          <dt>{t('dental.perio.metrics.mobility')}</dt>
          <dd>{summary.teethWithMobility}</dd>
        </div>
        <div>
          <dt>{t('dental.perio.metrics.plaque')}</dt>
          <dd>{summary.avgPlaqueIndex}</dd>
        </div>
      </dl>
    </div>
  );
}
