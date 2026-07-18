import { useMemo } from 'react';
import { useI18n } from '@booking/i18n/react';
import type { ToothRecord, ToothStatus, OdontogramMode } from '../types/dental.types';
import {
  LOWER_TEETH,
  PEDIATRIC_LOWER,
  PEDIATRIC_UPPER,
  TOOTH_STATUS_OPTIONS,
  UPPER_TEETH,
  pediatricLetter,
  statusCssClass,
  toothFdiLabel,
} from '../config/dental-config';
import styles from './Odontogram.module.css';

interface OdontogramProps {
  teeth: ToothRecord[];
  mode?: OdontogramMode;
  selectedTooth?: number | null;
  readOnly?: boolean;
  onSelectTooth?: (toothNumber: number) => void;
}

function toothMap(teeth: ToothRecord[]): Map<number, ToothRecord> {
  return new Map(teeth.map((t) => [t.toothNumber, t]));
}

function ToothButton({
  num,
  tooth,
  selected,
  readOnly,
  onSelect,
  labelPrefix,
  mode,
}: {
  num: number;
  tooth?: ToothRecord;
  selected: boolean;
  readOnly?: boolean;
  onSelect?: (n: number) => void;
  labelPrefix: string;
  mode: OdontogramMode;
}) {
  const status = tooth?.status ?? 'healthy';
  const cls = statusCssClass(status);
  const hasSurfaces = tooth?.surfaces && Object.keys(tooth.surfaces).length > 0;
  const label = mode === 'pediatric' ? pediatricLetter(num) : String(num);
  const secondary = mode === 'pediatric' ? String(num) : toothFdiLabel(num);

  return (
    <button
      type="button"
      className={[
        styles.tooth,
        styles[cls],
        selected ? styles.selected : '',
        hasSurfaces ? styles.hasSurfaces : '',
        mode === 'pediatric' ? styles.pediatric : '',
      ]
        .filter(Boolean)
        .join(' ')}
      onClick={() => !readOnly && onSelect?.(num)}
      aria-label={`${labelPrefix} ${label}, ${status}`}
      aria-pressed={selected}
      disabled={readOnly}
    >
      <span className={styles.universal}>{label}</span>
      <span className={styles.fdi}>{secondary}</span>
    </button>
  );
}

export function Odontogram({ teeth, mode = 'adult', selectedTooth, readOnly, onSelectTooth }: OdontogramProps) {
  const { t } = useI18n();
  const map = useMemo(() => toothMap(teeth), [teeth]);
  const upper = mode === 'pediatric' ? PEDIATRIC_UPPER : UPPER_TEETH;
  const lower = mode === 'pediatric' ? PEDIATRIC_LOWER : LOWER_TEETH;

  return (
    <section className={styles.wrap} aria-label={t('dental.odontogram.title')}>
      <div className={styles.modeBadge}>{t(`dental.odontogram.${mode}`)}</div>
      <div className={styles.archLabel}>{t('dental.odontogram.upper')}</div>
      <div className={[styles.arch, mode === 'pediatric' ? styles.pediatricArch : ''].filter(Boolean).join(' ')} role="group" aria-label={t('dental.odontogram.upper')}>
        {upper.map((num) => (
          <ToothButton
            key={num}
            num={num}
            tooth={map.get(num)}
            selected={selectedTooth === num}
            readOnly={readOnly}
            onSelect={onSelectTooth}
            labelPrefix={t('dental.odontogram.tooth')}
            mode={mode}
          />
        ))}
      </div>
      <div className={styles.midline} aria-hidden />
      <div className={styles.archLabel}>{t('dental.odontogram.lower')}</div>
      <div className={[styles.arch, mode === 'pediatric' ? styles.pediatricArch : ''].filter(Boolean).join(' ')} role="group" aria-label={t('dental.odontogram.lower')}>
        {lower.map((num) => (
          <ToothButton
            key={num}
            num={num}
            tooth={map.get(num)}
            selected={selectedTooth === num}
            readOnly={readOnly}
            onSelect={onSelectTooth}
            labelPrefix={t('dental.odontogram.tooth')}
            mode={mode}
          />
        ))}
      </div>
      <div className={styles.legend} aria-label={t('dental.odontogram.legend')}>
        {TOOTH_STATUS_OPTIONS.map(({ value, labelKey, cssClass }) => (
          <span key={value} className={styles.legendItem}>
            <span className={[styles.legendSwatch, styles[cssClass]].join(' ')} aria-hidden />
            {t(labelKey)}
          </span>
        ))}
      </div>
    </section>
  );
}

export function getToothStatus(teeth: ToothRecord[], num: number): ToothStatus {
  return teeth.find((t) => t.toothNumber === num)?.status ?? 'healthy';
}

export function updateToothInList(
  teeth: ToothRecord[],
  num: number,
  status: ToothStatus,
  notes?: string | null,
  surfaces?: ToothRecord['surfaces'],
): ToothRecord[] {
  return teeth.map((t) =>
    t.toothNumber === num
      ? { ...t, status, notes: notes ?? t.notes, surfaces: surfaces ?? t.surfaces }
      : t,
  );
}
