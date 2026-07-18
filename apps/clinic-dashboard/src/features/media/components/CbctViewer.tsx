import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Layers3, Maximize2, Minimize2, RotateCcw } from 'lucide-react';
import { useI18n } from '@booking/i18n/react';
import { AuthButton } from '@/features/auth/components/AuthButton';
import {
  cbctSliceVariant,
  getCbctMeta,
  isCbctItem,
  listCbctSliceIndices,
  mediaDisplayTitle,
} from '../api/media-api';
import { renderMprToCanvas, useCbctSliceStack } from '../hooks/useCbctSliceStack';
import { useMediaBlobUrl } from '../hooks/useMedia';
import type { CbctPlane, MediaListItem } from '../types/media.types';
import styles from './CbctViewer.module.css';

const LazyDicomCanvas = lazy(() =>
  import('./DicomCanvas').then((m) => ({ default: m.DicomCanvas })),
);

interface CbctViewerProps {
  item: MediaListItem;
}

const WW_PRESETS = [
  { id: 'bone', ww: 2500, wl: 480 },
  { id: 'soft', ww: 400, wl: 40 },
  { id: 'dental', ww: 3000, wl: 500 },
] as const;

export function CbctViewer({ item }: CbctViewerProps) {
  const { t } = useI18n();
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const meta = getCbctMeta(item);
  const sliceIndices = useMemo(() => listCbctSliceIndices(item), [item]);
  const isDicom = item.mimeType === 'application/dicom';
  const hasVolume = sliceIndices.length > 1;

  const [plane, setPlane] = useState<CbctPlane>('axial');
  const [sliceIndex, setSliceIndex] = useState(() =>
    Math.floor((sliceIndices.length || meta.sliceCount) / 2),
  );
  const [crossIndex, setCrossIndex] = useState(() => Math.floor(meta.sliceWidth / 2));
  const [windowWidth, setWindowWidth] = useState<number>(WW_PRESETS[0].ww);
  const [windowCenter, setWindowCenter] = useState<number>(WW_PRESETS[0].wl);
  const [fullscreen, setFullscreen] = useState(false);
  const [scale, setScale] = useState(1);

  const stack = useCbctSliceStack(item.id, sliceIndices, hasVolume && !isDicom);

  const fallbackVariant = sliceIndices.length
    ? cbctSliceVariant(sliceIndices[Math.min(sliceIndex, sliceIndices.length - 1)] ?? 0)
    : 'webp';
  const { url, loading: singleLoading } = useMediaBlobUrl(
    hasVolume ? undefined : item.id,
    fallbackVariant,
  );

  const maxSlice = Math.max(0, (stack.slices.length || sliceIndices.length || meta.sliceCount) - 1);
  const maxCross = plane === 'sagittal' ? stack.width - 1 : stack.height - 1;

  useEffect(() => {
    if (isDicom || !canvasRef.current || !hasVolume || !stack.slices.length) return;
    renderMprToCanvas(
      canvasRef.current,
      stack,
      plane,
      sliceIndex,
      crossIndex,
      windowWidth,
      windowCenter,
    );
  }, [stack, plane, sliceIndex, crossIndex, windowWidth, windowCenter, isDicom, hasVolume]);

  useEffect(() => {
    if (isDicom || hasVolume || !url || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const img = new Image();
    img.onload = () => {
      canvas.width = img.width;
      canvas.height = img.height;
      ctx.drawImage(img, 0, 0);
    };
    img.src = url;
  }, [url, isDicom, hasVolume]);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'ArrowUp' || e.key === 'ArrowRight') {
        e.preventDefault();
        if (plane === 'axial') setSliceIndex((i) => Math.min(maxSlice, i + 1));
        else setCrossIndex((i) => Math.min(maxCross, i + 1));
      } else if (e.key === 'ArrowDown' || e.key === 'ArrowLeft') {
        e.preventDefault();
        if (plane === 'axial') setSliceIndex((i) => Math.max(0, i - 1));
        else setCrossIndex((i) => Math.max(0, i - 1));
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [maxSlice, maxCross, plane]);

  const toggleFullscreen = useCallback(async () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      await containerRef.current.requestFullscreen();
      setFullscreen(true);
    } else {
      await document.exitFullscreen();
      setFullscreen(false);
    }
  }, []);

  if (!isCbctItem(item)) return null;

  const sliderMax = plane === 'axial' ? maxSlice : maxCross;
  const sliderValue = plane === 'axial' ? Math.min(sliceIndex, maxSlice) : Math.min(crossIndex, maxCross);
  const loading = stack.loading || singleLoading;

  return (
    <section ref={containerRef} className={styles.viewer} aria-label={t('dental.imaging.cbct.title')}>
      <header className={styles.header}>
        <div className={styles.titleRow}>
          <Layers3 size={18} aria-hidden />
          <div>
            <h3 className={styles.title}>{mediaDisplayTitle(item)}</h3>
            <p className={styles.subtitle}>{t('dental.imaging.cbct.subtitle')}</p>
          </div>
        </div>
        <div className={styles.headerActions}>
          <AuthButton
            variant="ghost"
            onClick={() => {
              setScale(1);
              setSliceIndex(Math.floor(maxSlice / 2));
              setCrossIndex(Math.floor(meta.sliceWidth / 2));
              setPlane('axial');
            }}
          >
            <RotateCcw size={16} aria-hidden />
            {t('dental.imaging.viewer.reset')}
          </AuthButton>
          <AuthButton
            variant="ghost"
            onClick={() => void toggleFullscreen()}
            aria-label={t('dental.imaging.viewer.fullscreen')}
          >
            {fullscreen ? <Minimize2 size={16} aria-hidden /> : <Maximize2 size={16} aria-hidden />}
          </AuthButton>
        </div>
      </header>

      <div className={styles.controls} role="toolbar" aria-label={t('dental.imaging.cbct.controls')}>
        <div className={styles.planes} role="radiogroup" aria-label={t('dental.imaging.cbct.plane')}>
          {(['axial', 'sagittal', 'coronal'] as CbctPlane[]).map((p) => (
            <button
              key={p}
              type="button"
              className={plane === p ? styles.planeActive : styles.planeBtn}
              role="radio"
              aria-checked={plane === p}
              onClick={() => setPlane(p)}
            >
              {t(`dental.imaging.cbct.planes.${p}`)}
            </button>
          ))}
        </div>

        <div className={styles.presets} role="group" aria-label={t('dental.imaging.cbct.presets')}>
          {WW_PRESETS.map(({ id, ww, wl }) => (
            <button
              key={id}
              type="button"
              className={windowWidth === ww && windowCenter === wl ? styles.presetActive : styles.presetBtn}
              onClick={() => { setWindowWidth(ww); setWindowCenter(wl); }}
            >
              {t(`dental.imaging.cbct.preset.${id}`)}
            </button>
          ))}
        </div>
      </div>

      <div className={styles.sliceRow}>
        <label className={styles.sliceLabel} htmlFor="cbct-slice">
          {(plane === 'axial' ? t('dental.imaging.cbct.slice') : t('dental.imaging.cbct.crosshair'))}{' '}
          {sliderValue + 1} / {sliderMax + 1}
        </label>
        <input
          id="cbct-slice"
          type="range"
          min={0}
          max={sliderMax}
          value={sliderValue}
          onChange={(e) => {
            const v = Number(e.target.value);
            if (plane === 'axial') setSliceIndex(v);
            else setCrossIndex(v);
          }}
          className={styles.sliceSlider}
          aria-valuetext={`${sliderValue + 1} of ${sliderMax + 1}`}
        />
      </div>

      <div className={styles.canvasWrap}>
        {loading && <div className={styles.loader} aria-busy="true" aria-label={t('dental.imaging.cbct.loading')} />}
        {stack.error && (
          <p className={styles.error} role="alert">{t('dental.imaging.cbct.loadError')}</p>
        )}
        {isDicom ? (
          <Suspense fallback={<div className={styles.loader} aria-busy="true" />}>
            <LazyDicomCanvas
              mediaId={item.id}
              windowWidth={windowWidth}
              windowCenter={windowCenter}
              scale={scale}
            />
          </Suspense>
        ) : (
          <canvas
            ref={canvasRef}
            className={styles.canvas}
            style={{ transform: `scale(${scale})` }}
            aria-label={t(`dental.imaging.cbct.planes.${plane}`)}
          />
        )}
      </div>

      <dl className={styles.metaGrid}>
        <div><dt>{t('dental.imaging.cbct.voxelSize')}</dt><dd>{meta.voxelSpacing?.x ?? '—'} mm</dd></div>
        <div><dt>{t('dental.imaging.cbct.dimensions')}</dt><dd>{meta.sliceWidth}×{meta.sliceHeight}×{stack.slices.length || meta.sliceCount}</dd></div>
        <div><dt>{t('dental.imaging.cbct.window')}</dt><dd>WW {windowWidth} / WL {windowCenter}</dd></div>
      </dl>
    </section>
  );
}
