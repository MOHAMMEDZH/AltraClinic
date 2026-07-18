import { lazy, Suspense, useCallback, useMemo, useState } from 'react';
import { Columns2, MapPin, RefreshCw } from 'lucide-react';
import { hasPermission } from '@booking/permissions';
import { useI18n } from '@booking/i18n/react';
import { useAuth } from '@/app/providers/AuthProvider';
import { useOnlineStatus } from '@/features/auth/hooks/useOnlineStatus';
import { AuthAlert } from '@/features/auth/components/AuthAlert';
import { AuthButton } from '@/features/auth/components/AuthButton';
import { EmptyState } from '@/features/patients/components/EmptyState';
import { ImageUploadZone } from '@/features/media/components/ImageUploadZone';
import { MediaThumbnail } from '@/features/media/components/MediaThumbnail';
import { LazyCbctViewer, LazyImageViewer } from '@/features/media/lazy-imaging';
import { canUploadMedia, canUpdateMedia, canViewMedia } from '@/features/media/config/imaging-config';
import { IMAGING_TYPE_OPTIONS } from '@/features/media/config/imaging-config';
import { useMediaList, useUpdateMediaClinical, useUploadMedia } from '@/features/media/hooks/useMedia';
import {
  isCbctItem,
  mediaDisplayTitle,
  mediaImagingType,
  shouldVirtualizeGallery,
} from '@/features/media/api/media-api';
import type { ImagingType, MediaListItem } from '@/features/media/types/media.types';
import { formatDentalDate } from '@/features/dental/config/dental-config';
import styles from './DentalImagingWorkspace.module.css';

const LazyVirtualizedMediaGallery = lazy(() =>
  import('@/features/media/components/VirtualizedMediaGallery').then((m) => ({
    default: m.VirtualizedMediaGallery,
  })),
);

interface DentalImagingWorkspaceProps {
  patientId: string;
  ownerType?: string;
  ownerId?: string;
  encounterId?: string;
  toothNumbers?: number[];
  compact?: boolean;
}

export function DentalImagingWorkspace({
  patientId,
  ownerType = 'patient',
  ownerId,
  encounterId,
  toothNumbers,
  compact,
}: DentalImagingWorkspaceProps) {
  const { t, locale } = useI18n();
  const { user } = useAuth();
  const online = useOnlineStatus();
  const roles = user?.roles ?? [];
  const perm = useCallback((action: string) => hasPermission(roles, 'api.media', action as never), [roles]);

  const [typeFilter, setTypeFilter] = useState<ImagingType | ''>('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [compareMode, setCompareMode] = useState(false);
  const [compareId, setCompareId] = useState<string | null>(null);
  const [annotateMode, setAnnotateMode] = useState(false);
  const [uploadType, setUploadType] = useState<ImagingType>('xray');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const resolvedOwnerId = ownerId ?? patientId;

  const listQuery = useMediaList(
    { patientId, category: 'dental_image', encounterId: encounterId || undefined },
    canViewMedia(perm),
  );
  const uploadMutation = useUploadMedia();
  const updateMutation = useUpdateMediaClinical();

  const items = useMemo(() => {
    const all = listQuery.data?.items ?? [];
    if (!typeFilter) return all;
    return all.filter((i) => mediaImagingType(i) === typeFilter);
  }, [listQuery.data?.items, typeFilter]);

  const selected = items.find((i) => i.id === selectedId) ?? null;
  const compareItem = items.find((i) => i.id === compareId) ?? null;

  const comparisonPair = useMemo(() => {
    if (!selected?.comparisonGroupId) return null;
    const group = items.filter((i) => i.comparisonGroupId === selected.comparisonGroupId);
    const before = group.find((i) => i.comparisonRole === 'before');
    const after = group.find((i) => i.comparisonRole === 'after');
    return before && after ? { before, after } : null;
  }, [items, selected]);

  const handleSelect = useCallback(
    (item: MediaListItem) => {
      if (compareMode && selectedId && selectedId !== item.id) {
        setCompareId(item.id);
      } else {
        setSelectedId(item.id);
      }
    },
    [compareMode, selectedId],
  );

  async function handleUpload(files: File[]) {
    setError(null);
    const groupId = uploadType === 'before' || uploadType === 'after' ? crypto.randomUUID() : undefined;
    try {
      for (const file of files) {
        await uploadMutation.mutateAsync({
          file,
          category: 'dental_image',
          ownerType,
          ownerId: resolvedOwnerId,
          patientId,
          imagingType: uploadType,
          title: file.name,
          toothNumbers,
          encounterId,
          comparisonGroupId: groupId,
          comparisonRole: uploadType === 'before' ? 'before' : uploadType === 'after' ? 'after' : undefined,
        });
      }
      setSuccess(t('dental.imaging.upload.success'));
      void listQuery.refetch();
    } catch {
      setError(t('dental.imaging.upload.error'));
    }
  }

  if (!canViewMedia(perm)) {
    return <AuthAlert variant="error">{t('dental.imaging.errors.accessDenied')}</AuthAlert>;
  }

  const useVirtualGallery = shouldVirtualizeGallery(items.length);

  return (
    <div className={[styles.workspace, compact ? styles.compact : ''].join(' ')}>
      <div aria-live="polite" className={styles.liveRegion}>
        {success}
      </div>
      {!online && <AuthAlert variant="warning">{t('dental.offlineBanner')}</AuthAlert>}
      {error && <AuthAlert variant="error">{error}</AuthAlert>}
      {success && <AuthAlert variant="success">{success}</AuthAlert>}

      <div className={styles.toolbar}>
        <div className={styles.filters} role="group" aria-label={t('dental.imaging.filter.label')}>
          {IMAGING_TYPE_OPTIONS.map(({ value, labelKey }) => (
            <button
              key={labelKey}
              type="button"
              className={typeFilter === value ? styles.filterActive : styles.filterBtn}
              aria-pressed={typeFilter === value}
              onClick={() => setTypeFilter(value as ImagingType | '')}
            >
              {t(labelKey)}
            </button>
          ))}
        </div>
        <div className={styles.actions}>
          <AuthButton variant="secondary" onClick={() => void listQuery.refetch()} aria-label={t('dental.refresh')}>
            <RefreshCw size={16} aria-hidden />
          </AuthButton>
          <AuthButton
            variant={compareMode ? 'primary' : 'secondary'}
            onClick={() => { setCompareMode(!compareMode); setCompareId(null); }}
          >
            <Columns2 size={16} aria-hidden />
            {t('dental.imaging.compare.mode')}
          </AuthButton>
          {canUpdateMedia(perm) && (
            <AuthButton variant={annotateMode ? 'primary' : 'secondary'} onClick={() => setAnnotateMode(!annotateMode)}>
              <MapPin size={16} aria-hidden />
              {t('dental.imaging.annotate')}
            </AuthButton>
          )}
        </div>
      </div>

      {canUploadMedia(perm) && (
        <div className={styles.uploadRow}>
          <label className={styles.uploadTypeLabel}>
            {t('dental.imaging.upload.type')}
            <select
              className={styles.select}
              value={uploadType}
              onChange={(e) => setUploadType(e.target.value as ImagingType)}
            >
              {IMAGING_TYPE_OPTIONS.filter((o) => o.value).map(({ value, labelKey }) => (
                <option key={value} value={value}>{t(labelKey)}</option>
              ))}
            </select>
          </label>
          <ImageUploadZone
            disabled={!online}
            uploading={uploadMutation.isPending}
            onUpload={handleUpload}
          />
        </div>
      )}

      {selected && (
        isCbctItem(selected) ? (
          <LazyCbctViewer item={selected} />
        ) : (
          <LazyImageViewer
            item={comparisonPair?.before ?? selected}
            compareItem={compareMode ? (comparisonPair?.after ?? compareItem) : null}
            annotations={selected.metadata?.clinical?.annotations ?? []}
            annotateMode={annotateMode}
            onAnnotate={async (annotations) => {
              if (!canUpdateMedia(perm)) return;
              await updateMutation.mutateAsync({ mediaId: selected.id, clinical: { annotations } });
            }}
          />
        )
      )}

      {listQuery.isLoading && !listQuery.data ? (
        <div className={styles.gallerySkeleton} aria-busy="true" />
      ) : !items.length ? (
        <EmptyState title={t('dental.imaging.empty.title')} description={t('dental.imaging.empty.description')} />
      ) : useVirtualGallery ? (
        <Suspense fallback={<div className={styles.gallerySkeleton} aria-busy="true" />}>
          <LazyVirtualizedMediaGallery
            items={items}
            selectedId={selectedId}
            compareMode={compareMode}
            onSelect={handleSelect}
            compact={compact}
          />
        </Suspense>
      ) : (
        <div className={styles.gallery} role="list">
          {items.map((item) => (
            <article key={item.id} className={styles.card} role="listitem">
              <MediaThumbnail
                mediaId={item.id}
                alt={mediaDisplayTitle(item)}
                selected={selectedId === item.id}
                onClick={() => handleSelect(item)}
              />
              <div className={styles.cardMeta}>
                <p className={styles.cardTitle}>{mediaDisplayTitle(item)}</p>
                <p className={styles.cardSub}>
                  {t(`dental.imaging.types.${mediaImagingType(item) as 'xray'}`)} · {formatDentalDate(item.createdAt, locale)}
                </p>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
