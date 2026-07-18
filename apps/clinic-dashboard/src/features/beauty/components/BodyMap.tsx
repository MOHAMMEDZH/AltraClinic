import { useCallback, useMemo } from 'react';
import { useI18n } from '@booking/i18n/react';
import { BODY_ZONES } from '../config/beauty-config';
import type { BeautyAnnotation } from '../types/beauty.types';
import styles from './BodyMap.module.css';

interface BodyMapProps {
  annotations: BeautyAnnotation[];
  readOnly?: boolean;
  onAddPin?: (coords: { x: number; y: number; view: string; zone: string }) => void;
}

const ZONE_RECTS: Record<string, { x: number; y: number; w: number; h: number }> = {
  neck: { x: 85, y: 28, w: 30, h: 18 },
  abdomen: { x: 70, y: 95, w: 60, h: 55 },
  flanks_left: { x: 48, y: 95, w: 22, h: 50 },
  flanks_right: { x: 130, y: 95, w: 22, h: 50 },
  arms: { x: 28, y: 55, w: 24, h: 70 },
  thighs: { x: 62, y: 155, w: 76, h: 55 },
  back: { x: 70, y: 55, w: 60, h: 90 },
  buttocks: { x: 68, y: 148, w: 64, h: 28 },
};

export function BodyMap({ annotations, readOnly, onAddPin }: BodyMapProps) {
  const { t } = useI18n();

  const bodyAnnotations = useMemo(
    () => annotations.filter((a) => BODY_ZONES.includes(a.zone as (typeof BODY_ZONES)[number])),
    [annotations],
  );

  const handleZoneClick = useCallback(
    (zone: string) => {
      if (readOnly || !onAddPin) return;
      const rect = ZONE_RECTS[zone];
      if (!rect) return;
      onAddPin({
        x: ((rect.x + rect.w / 2) / 200) * 100,
        y: ((rect.y + rect.h / 2) / 220) * 100,
        view: 'front',
        zone,
      });
    },
    [readOnly, onAddPin],
  );

  return (
    <div className={styles.wrap}>
      <p className={styles.hint}>{t('beauty.bodyMap.hint')}</p>
      <svg className={styles.svg} viewBox="0 0 200 220" role="img" aria-label={t('beauty.bodyMap.title')}>
        <ellipse cx="100" cy="22" rx="18" ry="20" className={styles.part} />
        <rect x="88" y="40" width="24" height="18" rx="4" className={styles.part} />
        <rect x="72" y="58" width="56" height="90" rx="12" className={styles.torso} />
        <rect x="28" y="58" width="22" height="75" rx="8" className={styles.limb} />
        <rect x="150" y="58" width="22" height="75" rx="8" className={styles.limb} />
        <rect x="68" y="148" width="28" height="65" rx="8" className={styles.limb} />
        <rect x="104" y="148" width="28" height="65" rx="8" className={styles.limb} />
        {BODY_ZONES.map((zone) => {
          const r = ZONE_RECTS[zone];
          if (!r) return null;
          return (
            <rect
              key={zone}
              x={r.x}
              y={r.y}
              width={r.w}
              height={r.h}
              className={styles.zone}
              role="button"
              tabIndex={readOnly ? -1 : 0}
              aria-label={t(`beauty.zones.${zone}`)}
              onClick={() => handleZoneClick(zone)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  handleZoneClick(zone);
                }
              }}
            />
          );
        })}
        {bodyAnnotations.map((ann) => (
          <circle
            key={ann.id}
            cx={(ann.coordinates.x / 100) * 200}
            cy={(ann.coordinates.y / 100) * 220}
            r="5"
            className={styles.pin}
          />
        ))}
      </svg>
      <div className={styles.zoneGrid}>
        {BODY_ZONES.map((zone) => (
          <button
            key={zone}
            type="button"
            className={styles.zoneBtn}
            disabled={readOnly}
            onClick={() => handleZoneClick(zone)}
          >
            {t(`beauty.zones.${zone}`)}
          </button>
        ))}
      </div>
    </div>
  );
}
