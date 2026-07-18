import { useMemo } from 'react';
import { useI18n } from '@booking/i18n/react';
import {
  LOWER_TEETH,
  UPPER_TEETH,
  bopSiteCount,
  maxPocketDepth,
  pdSeverity,
  pdSeverityClass,
  toothFdiLabel,
} from '../perio-config';
import type { PerioToothRecord } from '../perio.types';
import styles from './PerioFullMouthChart.module.css';

interface PerioFullMouthChartProps {
  teeth: PerioToothRecord[];
  selectedTooth?: number | null;
  readOnly?: boolean;
  onSelectTooth?: (toothNumber: number) => void;
  deltaByTooth?: Map<number, number>;
}

function PerioToothCell({
  tooth,
  selected,
  readOnly,
  onSelect,
  delta,
}: {
  tooth: PerioToothRecord;
  selected: boolean;
  readOnly?: boolean;
  onSelect?: (n: number) => void;
  delta?: number;
}) {
  const { t } = useI18n();
  const num = tooth.toothNumber;
  const maxPd = maxPocketDepth(tooth);
  const severity = pdSeverity(maxPd);
  const bop = bopSiteCount(tooth);
  const fdi = toothFdiLabel(num);

  return (
    <button
      type="button"
      className={[
        styles.cell,
        styles[pdSeverityClass(severity)],
        selected ? styles.selected : '',
        tooth.missing ? styles.missing : '',
      ]
        .filter(Boolean)
        .join(' ')}
      onClick={() => !readOnly && !tooth.missing && onSelect?.(num)}
      aria-label={`${t('dental.odontogram.tooth')} ${num}, FDI ${fdi}, ${t('dental.perio.pocketDepth')} ${maxPd}`}
      aria-pressed={selected}
      disabled={readOnly || tooth.missing}
    >
      <span className={styles.num}>{num}</span>
      <span className={styles.pd}>{tooth.missing ? '—' : maxPd}</span>
      {bop > 0 && !tooth.missing && (
        <span className={styles.bop} aria-label={t('dental.perio.bop')}>
          {bop}
        </span>
      )}
      {tooth.mobility > 0 && (
        <span className={styles.mobility} aria-label={t('dental.perio.mobility')}>
          M{tooth.mobility}
        </span>
      )}
      {delta != null && delta !== 0 && (
        <span className={[styles.delta, delta < 0 ? styles.deltaGood : styles.deltaBad].join(' ')}>
          {delta > 0 ? '+' : ''}
          {delta}
        </span>
      )}
    </button>
  );
}

export function PerioFullMouthChart({
  teeth,
  selectedTooth,
  readOnly,
  onSelectTooth,
  deltaByTooth,
}: PerioFullMouthChartProps) {
  const { t } = useI18n();
  const map = useMemo(() => new Map(teeth.map((x) => [x.toothNumber, x])), [teeth]);

  return (
    <section className={styles.wrap} aria-label={t('dental.perio.fullMouth')}>
      <div className={styles.legend} aria-label={t('dental.perio.colorLegend')}>
        {(['healthy', 'watch', 'moderate', 'severe', 'critical'] as const).map((s) => (
          <span key={s} className={styles.legendItem}>
            <span className={[styles.legendSwatch, styles[`pd_${s}`]].join(' ')} aria-hidden />
            {t(`dental.perio.severity.${s}`)}
          </span>
        ))}
        <span className={styles.legendItem}>
          <span className={[styles.legendSwatch, styles.bopSwatch].join(' ')} aria-hidden />
          {t('dental.perio.bop')}
        </span>
      </div>
      <div className={styles.archBlock}>
        <div className={styles.archLabel}>{t('dental.odontogram.upper')}</div>
        <div className={styles.archScroll}>
          <div className={styles.arch} role="group" aria-label={t('dental.odontogram.upper')}>
            {UPPER_TEETH.map((num) => (
              <PerioToothCell
                key={num}
                tooth={map.get(num) ?? { toothNumber: num, mobility: 0, furcation: null, plaqueIndex: 0, sites: {} as never }}
                selected={selectedTooth === num}
                readOnly={readOnly}
                onSelect={onSelectTooth}
                delta={deltaByTooth?.get(num)}
              />
            ))}
          </div>
        </div>
      </div>
      <div className={styles.midline} aria-hidden />
      <div className={styles.archBlock}>
        <div className={styles.archLabel}>{t('dental.odontogram.lower')}</div>
        <div className={styles.archScroll}>
          <div className={styles.arch} role="group" aria-label={t('dental.odontogram.lower')}>
            {LOWER_TEETH.map((num) => (
              <PerioToothCell
                key={num}
                tooth={map.get(num) ?? { toothNumber: num, mobility: 0, furcation: null, plaqueIndex: 0, sites: {} as never }}
                selected={selectedTooth === num}
                readOnly={readOnly}
                onSelect={onSelectTooth}
                delta={deltaByTooth?.get(num)}
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
