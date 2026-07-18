import { useCallback, useRef, useState } from 'react';
import { ImagePlus, Upload } from 'lucide-react';
import { useI18n } from '@booking/i18n/react';
import { AuthButton } from '@/features/auth/components/AuthButton';
import { AuthAlert } from '@/features/auth/components/AuthAlert';
import { MediaThumbnail } from '@/features/media/components/MediaThumbnail';
import { VirtualizedMediaGallery } from '@/features/media/components/VirtualizedMediaGallery';
import { ImageViewer } from '@/features/media/components/ImageViewer';
import { useMediaList, useUploadMedia } from '@/features/media/hooks/useMedia';
import { shouldVirtualizeGallery } from '@/features/media/api/media-api';
import { mediaDisplayTitle } from '@/features/media/api/media-api';
import type { MediaListItem } from '@/features/media/types/media.types';
import type { BeautyBodyMapState } from '../types/beauty.types';
import styles from './BeautyGalleryWorkspace.module.css';

interface BeautyGalleryWorkspaceProps {
  patientId: string;
  recordId: string;
  consents: BeautyBodyMapState['consents'];
  canUpload?: boolean;
}

interface UploadProgress {
  name: string;
  percent: number;
  status: 'pending' | 'done' | 'error';
}

export function BeautyGalleryWorkspace({ patientId, recordId, consents, canUpload }: BeautyGalleryWorkspaceProps) {
  const { t } = useI18n();
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploadRole, setUploadRole] = useState<'before' | 'after'>('before');
  const [layoutMode, setLayoutMode] = useState<'grid' | 'timeline'>('grid');
  const [compareMode, setCompareMode] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [compareId, setCompareId] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [progress, setProgress] = useState<UploadProgress[]>([]);
  const [error, setError] = useState<string | null>(null);

  const photoConsent = consents.some((c) => c.type === 'photo' && c.granted);
  const uploadMutation = useUploadMedia();
  const mediaQuery = useMediaList({ patientId, category: 'beauty_before_after' }, Boolean(patientId));

  const items = mediaQuery.data?.items ?? [];
  const selected = items.find((i) => i.id === selectedId) ?? null;
  const compareItem = items.find((i) => i.id === compareId) ?? null;
  const useVirtual = shouldVirtualizeGallery(items.length);

  const uploadFiles = useCallback(
    async (files: FileList | File[]) => {
      if (!photoConsent || !canUpload) return;
      setError(null);
      const list = Array.from(files).filter((f) => f.type.startsWith('image/'));
      if (!list.length) return;

      const groupId = crypto.randomUUID();
      setProgress(list.map((f) => ({ name: f.name, percent: 0, status: 'pending' as const })));

      for (let i = 0; i < list.length; i++) {
        const file = list[i]!;
        try {
          setProgress((p) => p.map((x, idx) => (idx === i ? { ...x, percent: 30 } : x)));
          await uploadMutation.mutateAsync({
            file,
            category: 'beauty_before_after',
            ownerType: 'beauty_record',
            ownerId: recordId,
            patientId,
            imagingType: uploadRole,
            title: file.name,
            comparisonGroupId: groupId,
            comparisonRole: uploadRole,
          });
          setProgress((p) => p.map((x, idx) => (idx === i ? { ...x, percent: 100, status: 'done' } : x)));
        } catch {
          setProgress((p) => p.map((x, idx) => (idx === i ? { ...x, status: 'error' } : x)));
          setError(t('beauty.gallery.uploadError'));
        }
      }
      void mediaQuery.refetch();
      setTimeout(() => setProgress([]), 2000);
    },
    [photoConsent, canUpload, uploadMutation, recordId, patientId, uploadRole, mediaQuery, t],
  );

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files.length) void uploadFiles(e.dataTransfer.files);
  }

  function handleSelect(item: MediaListItem) {
    if (compareMode && selectedId && selectedId !== item.id) {
      setCompareId(item.id);
    } else {
      setSelectedId(item.id);
    }
  }

  return (
    <section className={styles.wrap} aria-label={t('beauty.gallery.title')}>
      <header className={styles.toolbar}>
        <div className={styles.roleToggle} role="group" aria-label={t('beauty.gallery.uploadRole')}>
          <button
            type="button"
            className={uploadRole === 'before' ? styles.roleActive : styles.roleBtn}
            aria-pressed={uploadRole === 'before'}
            onClick={() => setUploadRole('before')}
          >
            {t('beauty.gallery.before')}
          </button>
          <button
            type="button"
            className={uploadRole === 'after' ? styles.roleActive : styles.roleBtn}
            aria-pressed={uploadRole === 'after'}
            onClick={() => setUploadRole('after')}
          >
            {t('beauty.gallery.after')}
          </button>
        </div>
        <div className={styles.actions}>
          {canUpload && (
            <>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                multiple
                capture="environment"
                className={styles.hidden}
                onChange={(e) => e.target.files && void uploadFiles(e.target.files)}
              />
              <AuthButton
                variant="secondary"
                disabled={!photoConsent || uploadMutation.isPending}
                onClick={() => fileRef.current?.click()}
              >
                <ImagePlus size={16} aria-hidden />
                {t('beauty.gallery.upload')}
              </AuthButton>
            </>
          )}
          <AuthButton variant={compareMode ? 'primary' : 'secondary'} aria-pressed={compareMode} onClick={() => setCompareMode((v) => !v)}>
            {t('beauty.gallery.sideBySide')}
          </AuthButton>
          <AuthButton
            variant={layoutMode === 'timeline' ? 'primary' : 'secondary'}
            aria-pressed={layoutMode === 'timeline'}
            onClick={() => setLayoutMode((m) => (m === 'grid' ? 'timeline' : 'grid'))}
          >
            {t('beauty.gallery.timeline')}
          </AuthButton>
        </div>
      </header>

      {!photoConsent && <AuthAlert variant="warning">{t('beauty.gallery.consentRequired')}</AuthAlert>}
      {error && <AuthAlert variant="error">{error}</AuthAlert>}

      {canUpload && photoConsent && (
        <div
          className={[styles.dropzone, dragOver ? styles.dropActive : ''].join(' ')}
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          role="region"
          aria-label={t('beauty.gallery.dropzone')}
        >
          <Upload size={24} aria-hidden />
          <p>{t('beauty.gallery.dropHint')}</p>
        </div>
      )}

      {progress.length > 0 && (
        <ul className={styles.progressList} aria-live="polite">
          {progress.map((p) => (
            <li key={p.name}>
              <span>{p.name}</span>
              <progress max={100} value={p.percent} />
              <span>{p.status === 'done' ? '✓' : p.status === 'error' ? '!' : `${p.percent}%`}</span>
            </li>
          ))}
        </ul>
      )}

      <div className={styles.layout}>
        <div className={styles.galleryCol}>
          {mediaQuery.isLoading ? (
            <div className={styles.skeleton} aria-busy="true" />
          ) : !items.length ? (
            <p className={styles.empty}>{t('beauty.gallery.empty')}</p>
          ) : layoutMode === 'timeline' ? (
            <ol className={styles.timelineList}>
              {[...items]
                .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
                .map((item) => (
                  <li key={item.id}>
                    <button type="button" className={styles.timelineItem} onClick={() => handleSelect(item)}>
                      <MediaThumbnail mediaId={item.id} alt={mediaDisplayTitle(item)} />
                      <span>{mediaDisplayTitle(item)}</span>
                      {item.comparisonRole && <span>{t(`beauty.gallery.${item.comparisonRole}`)}</span>}
                    </button>
                  </li>
                ))}
            </ol>
          ) : useVirtual ? (
            <VirtualizedMediaGallery
              items={items}
              selectedId={selectedId}
              compareMode={compareMode}
              onSelect={handleSelect}
            />
          ) : (
            <div className={styles.grid}>
              {items.map((item) => (
                <figure key={item.id} className={styles.figure}>
                  <MediaThumbnail
                    mediaId={item.id}
                    alt={mediaDisplayTitle(item)}
                    selected={selectedId === item.id}
                    onClick={() => handleSelect(item)}
                  />
                  {item.comparisonRole && (
                    <figcaption>{t(`beauty.gallery.${item.comparisonRole}`)}</figcaption>
                  )}
                </figure>
              ))}
            </div>
          )}
        </div>

        {selected && (
          <div className={styles.viewerCol}>
            <ImageViewer item={selected} compareItem={compareItem} />
          </div>
        )}
      </div>
    </section>
  );
}
