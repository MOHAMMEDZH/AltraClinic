import { useI18n } from '@booking/i18n/react';
import { SURFACE_CONDITIONS, TOOTH_SURFACES } from '../config/dental-config';
import type { ToothRecord, ToothSurface } from '../types/dental.types';
import styles from './SurfaceChartPanel.module.css';

interface SurfaceChartPanelProps {
  toothNumber: number;
  surfaces: Partial<Record<ToothSurface, string>>;
  readOnly?: boolean;
  onChange: (surfaces: Partial<Record<ToothSurface, string>>) => void;
}

export function SurfaceChartPanel({ toothNumber, surfaces, readOnly, onChange }: SurfaceChartPanelProps) {
  const { t } = useI18n();

  function setSurface(surface: ToothSurface, value: string) {
    const next = { ...surfaces };
    if (value === 'none' || !value) delete next[surface];
    else next[surface] = value;
    onChange(next);
  }

  return (
    <div className={styles.wrap} role="group" aria-label={t('dental.surfaces.title')}>
      <h3 className={styles.title}>{t('dental.surfaces.title')}</h3>
      <p className={styles.hint}>{t('dental.surfaces.hint')}</p>
      <div className={styles.grid}>
        {TOOTH_SURFACES.map(({ value, labelKey }) => (
          <label key={value} className={styles.cell}>
            <span className={styles.label}>{t(labelKey)}</span>
            <select
              value={surfaces[value] ?? 'none'}
              disabled={readOnly}
              onChange={(e) => setSurface(value, e.target.value)}
              aria-label={`${t(labelKey)} ${toothNumber}`}
            >
              {SURFACE_CONDITIONS.map(({ value: v, labelKey: lk }) => (
                <option key={v} value={v}>
                  {t(lk)}
                </option>
              ))}
            </select>
          </label>
        ))}
      </div>
      <div className={styles.diagram} aria-hidden>
        <span className={[styles.zone, surfaces.buccal ? styles.marked : ''].filter(Boolean).join(' ')}>B</span>
        <div className={styles.midRow}>
          <span className={[styles.zone, surfaces.mesial ? styles.marked : ''].filter(Boolean).join(' ')}>M</span>
          <span className={[styles.zone, surfaces.occlusal || surfaces.incisal ? styles.marked : ''].filter(Boolean).join(' ')}>
            O/I
          </span>
          <span className={[styles.zone, surfaces.distal ? styles.marked : ''].filter(Boolean).join(' ')}>D</span>
        </div>
        <span className={[styles.zone, surfaces.lingual ? styles.marked : ''].filter(Boolean).join(' ')}>L</span>
      </div>
    </div>
  );
}

export function mergeToothSurfaces(teeth: ToothRecord[], num: number, surfaces: Partial<Record<ToothSurface, string>>): ToothRecord[] {
  return teeth.map((t) => (t.toothNumber === num ? { ...t, surfaces } : t));
}
