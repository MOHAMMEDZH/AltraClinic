import { useCallback, useEffect, useRef, useState } from 'react';
import { Maximize2, Minimize2, ZoomIn, ZoomOut } from 'lucide-react';
import { useI18n } from '@booking/i18n/react';
import { AuthButton } from '@/features/auth/components/AuthButton';
import { useMediaBlobUrl } from '../hooks/useMedia';
import type { MediaAnnotation, MediaListItem } from '../types/media.types';
import { mediaDisplayTitle } from '../api/media-api';
import styles from './ImageViewer.module.css';

interface ImageViewerProps {
  item: MediaListItem;
  compareItem?: MediaListItem | null;
  annotations?: MediaAnnotation[];
  annotateMode?: boolean;
  onAnnotate?: (annotations: MediaAnnotation[]) => void;
}

export function ImageViewer({
  item,
  compareItem,
  annotations = [],
  annotateMode,
  onAnnotate,
}: ImageViewerProps) {
  const { t } = useI18n();
  const containerRef = useRef<HTMLDivElement>(null);
  const { url, loading, error } = useMediaBlobUrl(item.id, 'webp');
  const compare = useMediaBlobUrl(compareItem?.id, 'webp');
  const [scale, setScale] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [fullscreen, setFullscreen] = useState(false);
  const [localAnnotations, setLocalAnnotations] = useState(annotations);

  useEffect(() => setLocalAnnotations(annotations), [annotations]);

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

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === '+' || e.key === '=') {
        e.preventDefault();
        setScale((s) => Math.min(5, s + 0.25));
      } else if (e.key === '-') {
        e.preventDefault();
        setScale((s) => Math.max(0.25, s - 0.25));
      } else if (e.key === '0') {
        setScale(1);
        setPan({ x: 0, y: 0 });
      } else if (e.key === 'f' || e.key === 'F') {
        void toggleFullscreen();
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [toggleFullscreen]);

  const onWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    setScale((s) => Math.min(5, Math.max(0.25, s - e.deltaY * 0.001)));
  }, []);

  function handleImageClick(e: React.MouseEvent<HTMLDivElement>, side: 'primary' | 'compare') {
    if (!annotateMode || !onAnnotate) return;
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    const next = [
      ...localAnnotations,
      { id: `ann_${Date.now()}`, x, y, text: '', color: side === 'compare' ? '#6366f1' : '#ef4444' },
    ];
    setLocalAnnotations(next);
    onAnnotate(next);
  }

  const panels = compareItem
    ? [
        { label: t('dental.imaging.compare.before'), url: compare.url, loading: compare.loading, side: 'compare' as const },
        { label: t('dental.imaging.compare.after'), url, loading, side: 'primary' as const },
      ]
    : [{ label: mediaDisplayTitle(item), url, loading, side: 'primary' as const }];

  return (
    <div ref={containerRef} className={[styles.viewer, compareItem ? styles.compare : ''].join(' ')} tabIndex={0}>
      <div className={styles.toolbar}>
        <AuthButton variant="ghost" onClick={() => setScale((s) => Math.min(5, s + 0.25))} aria-label={t('dental.imaging.viewer.zoomIn')}>
          <ZoomIn size={16} aria-hidden />
        </AuthButton>
        <AuthButton variant="ghost" onClick={() => setScale((s) => Math.max(0.25, s - 0.25))} aria-label={t('dental.imaging.viewer.zoomOut')}>
          <ZoomOut size={16} aria-hidden />
        </AuthButton>
        <span className={styles.zoomLabel}>{Math.round(scale * 100)}%</span>
        <AuthButton variant="ghost" onClick={() => { setScale(1); setPan({ x: 0, y: 0 }); }}>
          {t('dental.imaging.viewer.reset')}
        </AuthButton>
        <AuthButton variant="ghost" onClick={() => void toggleFullscreen()} aria-label={t('dental.imaging.viewer.fullscreen')}>
          {fullscreen ? <Minimize2 size={16} aria-hidden /> : <Maximize2 size={16} aria-hidden />}
        </AuthButton>
      </div>

      <div className={styles.panels}>
        {panels.map((panel) => (
          <div key={panel.label} className={styles.panel}>
            <p className={styles.panelLabel}>{panel.label}</p>
            <div
              className={styles.canvas}
              onWheel={onWheel}
              onMouseDown={(e) => { setDragging(true); setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y }); }}
              onMouseMove={(e) => { if (dragging) setPan({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y }); }}
              onMouseUp={() => setDragging(false)}
              onMouseLeave={() => setDragging(false)}
              onClick={(e) => handleImageClick(e, panel.side)}
            >
              {panel.loading && <div className={styles.loader} aria-busy="true" />}
              {panel.url && !error && (
                <img
                  src={panel.url}
                  alt={panel.label}
                  className={styles.image}
                  style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${scale})` }}
                  draggable={false}
                />
              )}
              {localAnnotations.map((a) => (
                <span
                  key={a.id}
                  className={styles.pin}
                  style={{ left: `${a.x}%`, top: `${a.y}%`, background: a.color ?? '#ef4444' }}
                  title={a.text}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
