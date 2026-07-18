import { useMemo } from 'react';
import { useI18n } from '@booking/i18n/react';
import { useComparePerioExams, usePerioExam } from '../usePerio';
import { formatPerioDate } from '../perio-config';
import { PerioFullMouthChart } from './PerioFullMouthChart';
import styles from './PerioHistoryCompare.module.css';

interface PerioHistoryCompareProps {
  baselineExamId: string;
  compareExamId: string;
}

export function PerioHistoryCompare({ baselineExamId, compareExamId }: PerioHistoryCompareProps) {
  const { t, locale } = useI18n();
  const compareQuery = useComparePerioExams(baselineExamId, compareExamId);
  const compareExamQuery = usePerioExam(compareExamId, Boolean(compareExamId));

  const deltaMap = useMemo(() => {
    if (!compareQuery.data) return undefined;
    return new Map(compareQuery.data.toothDeltas.map((d) => [d.toothNumber, d.maxPdDelta]));
  }, [compareQuery.data]);

  if (compareQuery.isLoading || compareExamQuery.isLoading) {
    return <div className={styles.skeleton} aria-busy="true" />;
  }

  if (!compareQuery.data || !compareExamQuery.data) {
    return <p className={styles.empty}>{t('dental.perio.history.selectTwo')}</p>;
  }

  const { baseline, compare, summaryDelta } = compareQuery.data;

  return (
    <div className={styles.wrap}>
      <div className={styles.summaryDelta} role="status">
        <div>
          <span className={styles.label}>{t('dental.perio.history.bopChange')}</span>
          <span className={[styles.val, summaryDelta.bopPercent <= 0 ? styles.good : styles.bad].join(' ')}>
            {summaryDelta.bopPercent > 0 ? '+' : ''}
            {summaryDelta.bopPercent}%
          </span>
        </div>
        <div>
          <span className={styles.label}>{t('dental.perio.history.pdChange')}</span>
          <span className={[styles.val, summaryDelta.avgPocketDepth <= 0 ? styles.good : styles.bad].join(' ')}>
            {summaryDelta.avgPocketDepth > 0 ? '+' : ''}
            {summaryDelta.avgPocketDepth} mm
          </span>
        </div>
        <div>
          <span className={styles.label}>{t('dental.perio.history.sites4Change')}</span>
          <span className={[styles.val, summaryDelta.sitesPd4Plus <= 0 ? styles.good : styles.bad].join(' ')}>
            {summaryDelta.sitesPd4Plus > 0 ? '+' : ''}
            {summaryDelta.sitesPd4Plus}
          </span>
        </div>
      </div>

      <div className={styles.columns}>
        <div>
          <h4 className={styles.colTitle}>
            {t('dental.perio.history.baseline')}
            <time dateTime={baseline.examDate}>{formatPerioDate(baseline.examDate, locale)}</time>
          </h4>
          <p className={styles.stage}>{t(`dental.perio.stage.${baseline.summary.stage}`)}</p>
        </div>
        <div>
          <h4 className={styles.colTitle}>
            {t('dental.perio.history.compare')}
            <time dateTime={compare.examDate}>{formatPerioDate(compare.examDate, locale)}</time>
          </h4>
          <p className={styles.stage}>{t(`dental.perio.stage.${compare.summary.stage}`)}</p>
        </div>
      </div>

      <p className={styles.hint}>{t('dental.perio.history.deltaHint')}</p>
      <PerioFullMouthChart teeth={compareExamQuery.data.teeth} readOnly deltaByTooth={deltaMap} />
    </div>
  );
}
