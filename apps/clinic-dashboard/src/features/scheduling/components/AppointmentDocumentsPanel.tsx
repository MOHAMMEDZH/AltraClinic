import { useCallback, useMemo, useRef, useState } from 'react';
import { Download, Eye, Upload } from 'lucide-react';
import { hasPermission } from '@booking/permissions';
import { useI18n } from '@booking/i18n/react';
import { useAuth } from '@/app/providers/AuthProvider';
import { AuthButton } from '@/features/auth/components/AuthButton';
import { AuthAlert } from '@/features/auth/components/AuthAlert';
import {
  canUploadMedia,
  canViewMedia,
  formatFileSize,
} from '@/features/media/config/imaging-config';
import { fetchMediaBlob } from '@/features/media/api/media-api';
import { useMediaList, useUploadMedia } from '@/features/media/hooks/useMedia';
import type { MediaListItem } from '@/features/media/types/media.types';
import { Modal } from '@/features/patients/components/Modal';
import { formatPatientDate } from '@/features/patients/lib/patient-format';
import styles from './AppointmentDocumentsPanel.module.css';

interface AppointmentDocumentsPanelProps {
  appointmentId: string;
  patientId: string;
}

export function AppointmentDocumentsPanel({ appointmentId, patientId }: AppointmentDocumentsPanelProps) {
  const { t, locale } = useI18n();
  const { user, getValidAccessToken } = useAuth();
  const roles = user?.roles ?? [];
  const perm = useCallback(
    (action: string) => hasPermission(roles, 'api.media', action as never),
    [roles],
  );
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [previewItem, setPreviewItem] = useState<MediaListItem | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  const listQuery = useMediaList(
    { patientId, ownerType: 'appointment', ownerId: appointmentId },
    canViewMedia(perm),
  );
  const uploadMutation = useUploadMedia();

  const items = useMemo(
    () =>
      (listQuery.data?.items ?? []).filter(
        (item) => item.ownerType === 'appointment' && item.ownerId === appointmentId,
      ),
    [listQuery.data?.items, appointmentId],
  );

  async function handleUpload(files: FileList | null) {
    if (!files?.length || !canUploadMedia(perm)) return;
    setError(null);
    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        await uploadMutation.mutateAsync({
          file,
          category: 'patient_attachment',
          ownerType: 'appointment',
          ownerId: appointmentId,
          patientId,
          title: file.name,
        });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t('scheduling.documents.error'));
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  async function handleDownload(item: MediaListItem) {
    setDownloadingId(item.id);
    setError(null);
    try {
      const token = await getValidAccessToken();
      if (!token || !user?.tenantId) throw new Error('Not authenticated');
      const blob = await fetchMediaBlob(token, user.tenantId, item.id, 'original');
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = item.originalFilename;
      anchor.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('scheduling.documents.error'));
    } finally {
      setDownloadingId(null);
    }
  }

  async function handlePreview(item: MediaListItem) {
    setPreviewItem(item);
    setPreviewLoading(true);
    setPreviewUrl(null);
    try {
      const token = await getValidAccessToken();
      if (!token || !user?.tenantId) throw new Error('Not authenticated');
      const blob = await fetchMediaBlob(token, user.tenantId, item.id, 'original');
      setPreviewUrl(URL.createObjectURL(blob));
    } catch (err) {
      setError(err instanceof Error ? err.message : t('scheduling.documents.error'));
      setPreviewItem(null);
    } finally {
      setPreviewLoading(false);
    }
  }

  function closePreview() {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewItem(null);
    setPreviewUrl(null);
  }

  if (!canViewMedia(perm)) return null;

  return (
    <section className={styles.panel} aria-labelledby="appt-documents-heading">
      <div className={styles.header}>
        <h3 id="appt-documents-heading" className={styles.title}>
          {t('scheduling.documents.title')}
        </h3>
        {canUploadMedia(perm) && (
          <div className={styles.uploadRow}>
            <input
              ref={inputRef}
              type="file"
              className={styles.hiddenInput}
              accept=".pdf,image/*"
              multiple
              onChange={(e) => void handleUpload(e.target.files)}
            />
            <AuthButton
              variant="secondary"
              loading={uploading}
              onClick={() => inputRef.current?.click()}
            >
              <Upload size={16} aria-hidden />
              {t('scheduling.documents.upload')}
            </AuthButton>
          </div>
        )}
      </div>

      {error && <AuthAlert variant="error">{error}</AuthAlert>}

      {listQuery.isLoading ? (
        <p className={styles.hint}>{t('scheduling.documents.loading')}</p>
      ) : items.length === 0 ? (
        <p className={styles.hint}>{t('scheduling.documents.empty')}</p>
      ) : (
        <ul className={styles.list}>
          {items.map((item) => (
            <li key={item.id} className={styles.item}>
              <div className={styles.meta}>
                <p className={styles.name}>
                  {item.metadata?.clinical?.title || item.originalFilename}
                </p>
                <p className={styles.sub}>
                  {formatPatientDate(item.createdAt, locale)} · {formatFileSize(item.sizeBytes, locale)}
                </p>
              </div>
              <div className={styles.actions}>
                <AuthButton variant="ghost" onClick={() => void handlePreview(item)}>
                  <Eye size={16} aria-hidden />
                  {t('scheduling.documents.preview')}
                </AuthButton>
                <AuthButton
                  variant="ghost"
                  loading={downloadingId === item.id}
                  onClick={() => void handleDownload(item)}
                >
                  <Download size={16} aria-hidden />
                  {t('scheduling.documents.download')}
                </AuthButton>
              </div>
            </li>
          ))}
        </ul>
      )}

      <Modal
        open={Boolean(previewItem)}
        title={
          previewItem?.metadata?.clinical?.title ||
          previewItem?.originalFilename ||
          t('scheduling.documents.preview')
        }
        onClose={closePreview}
      >
        {previewLoading ? (
          <p>{t('scheduling.documents.loading')}</p>
        ) : previewUrl && previewItem?.mimeType?.startsWith('image/') ? (
          <img src={previewUrl} alt="" className={styles.previewImg} />
        ) : previewUrl ? (
          <iframe title={previewItem?.originalFilename} src={previewUrl} className={styles.previewFrame} />
        ) : null}
      </Modal>
    </section>
  );
}
