import { useCallback, useMemo, useRef, useState } from 'react';

import { useI18n } from '@booking/i18n/react';

import { TREATMENT_TYPES } from '../config/beauty-config';

import type { BeautyAnnotation } from '../types/beauty.types';

import styles from './FaceMap.module.css';



interface FaceMapProps {

  annotations: BeautyAnnotation[];

  readOnly?: boolean;

  view?: string;

  selectedTreatment?: string;

  onTreatmentChange?: (treatment: string) => void;

  onAddPin?: (coords: { x: number; y: number; view: string }) => void;

  onSelectAnnotation?: (id: string) => void;

}



const TREATMENT_COLORS: Record<string, string> = {

  botox: '#3b82f6',

  filler: '#ec4899',

  laser: '#f97316',

  prp: '#8b5cf6',

  peel: '#14b8a6',

  microneedling: '#eab308',

  other: '#64748b',

};



function coordsFromSvg(svg: SVGSVGElement, clientX: number, clientY: number) {

  const rect = svg.getBoundingClientRect();

  return {

    x: Math.round(((clientX - rect.left) / rect.width) * 1000) / 10,

    y: Math.round(((clientY - rect.top) / rect.height) * 1000) / 10,

  };

}



export function FaceMap({

  annotations,

  readOnly,

  view = 'front',

  selectedTreatment = 'botox',

  onTreatmentChange,

  onAddPin,

  onSelectAnnotation,

}: FaceMapProps) {

  const { t } = useI18n();

  const svgRef = useRef<SVGSVGElement>(null);

  const [hover, setHover] = useState<{ x: number; y: number } | null>(null);

  const [focusPin, setFocusPin] = useState<{ x: number; y: number } | null>(null);



  const visible = useMemo(

    () => annotations.filter((a) => a.coordinates.view === view),

    [annotations, view],

  );



  const placePin = useCallback(

    (x: number, y: number) => {

      if (readOnly || !onAddPin) return;

      onAddPin({ x, y, view });

      setFocusPin(null);

    },

    [readOnly, onAddPin, view],

  );



  const handleClick = useCallback(

    (e: React.MouseEvent<SVGSVGElement>) => {

      if (readOnly || !onAddPin) return;

      const coords = coordsFromSvg(e.currentTarget, e.clientX, e.clientY);

      placePin(coords.x, coords.y);

    },

    [readOnly, onAddPin, placePin],

  );



  const handleSvgKeyDown = useCallback(

    (e: React.KeyboardEvent<SVGSVGElement>) => {

      if (readOnly || !onAddPin) return;

      const svg = svgRef.current;

      if (!svg) return;

      const step = e.shiftKey ? 5 : 1;

      const origin = focusPin ?? hover ?? { x: 50, y: 50 };

      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {

        e.preventDefault();

        const next = { ...origin };

        if (e.key === 'ArrowUp') next.y = Math.max(0, next.y - step);

        if (e.key === 'ArrowDown') next.y = Math.min(100, next.y + step);

        if (e.key === 'ArrowLeft') next.x = Math.max(0, next.x - step);

        if (e.key === 'ArrowRight') next.x = Math.min(100, next.x + step);

        setFocusPin(next);

        setHover(next);

      }

      if (e.key === 'Enter' || e.key === ' ') {

        e.preventDefault();

        placePin(origin.x, origin.y);

      }

    },

    [readOnly, onAddPin, focusPin, hover, placePin],

  );



  return (

    <div className={styles.wrap}>

      <p className={styles.hint}>{t('beauty.faceMap.hint')}</p>

      <p className={styles.srOnly}>{t('beauty.faceMap.keyboardHint')}</p>

      <div className={styles.legend} aria-label={t('beauty.faceMap.legend')}>

        {TREATMENT_TYPES.slice(0, 5).map((tr) => (

          <span key={tr} className={styles.legendItem}>

            <span className={styles.swatch} style={{ background: TREATMENT_COLORS[tr] }} aria-hidden />

            {t(`beauty.treatments.${tr}`)}

          </span>

        ))}

      </div>

      <svg

        ref={svgRef}

        className={styles.svg}

        viewBox="0 0 200 260"

        role="img"

        tabIndex={readOnly ? -1 : 0}

        aria-label={t('beauty.faceMap.title')}

        onClick={handleClick}

        onKeyDown={handleSvgKeyDown}

        onMouseMove={(e) => {

          const coords = coordsFromSvg(e.currentTarget, e.clientX, e.clientY);

          setHover(coords);

        }}

        onMouseLeave={() => setHover(null)}

        onFocus={() => setFocusPin((p) => p ?? hover ?? { x: 50, y: 50 })}

      >

        <ellipse cx="100" cy="130" rx="72" ry="95" className={styles.faceOutline} />

        <ellipse cx="100" cy="118" rx="58" ry="72" className={styles.faceFill} />

        <ellipse cx="72" cy="108" rx="14" ry="8" className={styles.feature} />

        <ellipse cx="128" cy="108" rx="14" ry="8" className={styles.feature} />

        <path d="M 78 125 Q 100 138 122 125" className={styles.feature} fill="none" strokeWidth="2" />

        <ellipse cx="100" cy="168" rx="22" ry="14" className={styles.feature} />

        {visible.map((ann) => (

          <g key={ann.id}>

            <circle

              cx={(ann.coordinates.x / 100) * 200}

              cy={(ann.coordinates.y / 100) * 260}

              r="6"

              className={styles.pin}

              fill={TREATMENT_COLORS[ann.treatment] ?? TREATMENT_COLORS.other}

              role="button"

              tabIndex={0}

              aria-label={`${t(`beauty.zones.${ann.zone as 'forehead'}`)} — ${t(`beauty.treatments.${ann.treatment as 'botox'}`)}`}

              onClick={(e) => {

                e.stopPropagation();

                onSelectAnnotation?.(ann.id);

              }}

              onKeyDown={(e) => {

                if (e.key === 'Enter' || e.key === ' ') {

                  e.preventDefault();

                  e.stopPropagation();

                  onSelectAnnotation?.(ann.id);

                }

              }}

            />

            <title>{ann.notes ?? ann.zone}</title>

          </g>

        ))}

        {!readOnly && (hover || focusPin) && (

          <circle

            cx={((focusPin ?? hover)!.x / 100) * 200}

            cy={((focusPin ?? hover)!.y / 100) * 260}

            r="4"

            className={styles.crosshair}

          />

        )}

      </svg>

      <div className={styles.toolbar}>

        <label className={styles.field}>

          <span>{t('beauty.faceMap.treatment')}</span>

          <select

            value={selectedTreatment}

            disabled={readOnly}

            aria-label={t('beauty.faceMap.treatment')}

            onChange={(e) => onTreatmentChange?.(e.target.value)}

          >

            {TREATMENT_TYPES.map((tr) => (

              <option key={tr} value={tr}>

                {t(`beauty.treatments.${tr}`)}

              </option>

            ))}

          </select>

        </label>

      </div>

      {visible.length > 0 && (

        <ul className={styles.pinList}>

          {visible.map((ann) => (

            <li key={ann.id}>

              <span className={styles.pinDot} style={{ background: TREATMENT_COLORS[ann.treatment] }} aria-hidden />

              <span>{t(`beauty.zones.${ann.zone as 'forehead'}`)}</span>

              <span className={styles.pinMeta}>{ann.notes}</span>

            </li>

          ))}

        </ul>

      )}

    </div>

  );

}


