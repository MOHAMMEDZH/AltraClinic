import { useCallback, useMemo, useRef, useState } from 'react';
import { Download, Eye, Upload } from 'lucide-react';
import { hasPermission } from '@booking/permissions';
import { useI18n } from '@booking/i18n/react';
import { useAuth } from '@/app/providers/AuthProvider';
import { AuthButton } from '@/features/auth/components/AuthButton';
import { AuthAlert } from '@/features/auth/components/AuthAlert';
import { useOnlineStatus } from '@/features/auth/hooks/useOnlineStatus';
import {
  canUpdateMedia,
  canUploadMedia,
  canViewMedia,
  formatFileSize,
} from '@/features/media/config/imaging-config';
import { fetchMediaBlob } from '@/features/media/api/media-api';
import { useMediaList, useUpdateMediaClinical, useUploadMedia } from '@/features/media/hooks/useMedia';
import type { MediaListItem } from '@/features/media/types/media.types';
import { Modal } from './Modal';
import { formatPatientDate } from '../lib/patient-format';
import styles from './PatientDocumentsPanel.module.css';

type DocumentCategory = 'patient_attachment' | 'medical_document';

const DOCUMENT_CATEGORIES = new Set<string>(['patient_attachment', 'medical_document']);

function isDocumentItem(item: MediaListItem): boolean {
  return DOCUMENT_CATEGORIES.has(item.category);
}

function displayCategory(item: MediaListItem): DocumentCategory {
  const override = item.metadata?.clinical?.documentCategory;
  if (override === 'patient_attachment' || override === 'medical_document') return override;
  if (item.category === 'medical_document' || item.category === 'patient_attachment') {
    return item.category;
  }
  return 'patient_attachment';
}

interface PatientDocumentsPanelProps {
  patientId: string;
}

export function PatientDocumentsPanel({ patientId }: PatientDocumentsPanelProps) {
  const { t, locale } = useI18n();
  const { user, getValidAccessToken } = useAuth();
  const online = useOnlineStatus();
  const roles = user?.roles ?? [];
  const perm = useCallback(
    (action: string) => hasPermission(roles, 'api.media', action as never),
    [roles],
  );
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploadCategory, setUploadCategory] = useState<DocumentCategory>('patient_attachment');
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [previewItem, setPreviewItem] = useState<MediaListItem | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  const listQuery = useMediaList({ patientId }, canViewMedia(perm));
  const uploadMutation = useUploadMedia();
  const updateMutation = useUpdateMediaClinical();

  const items = useMemo(
    () => (listQuery.data?.items ?? []).filter(isDocumentItem),
    [listQuery.data?.items],
  );

  async function handleUpload(files: FileList | null) {
    if (!files?.length || !canUploadMedia(perm)) return;
    setError(null);
    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        const category =
          uploadCategory === 'medical_document' || file.type === 'application/pdf'
            ? 'medical_document'
            : uploadCategory;
        await uploadMutation.mutateAsync({
          file,
          category,
          ownerType: 'patient',
          ownerId: patientId,
          patientId,
          title: file.name,
        });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t('patients.error.generic'));
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
      setError(err instanceof Error ? err.message : t('patients.error.generic'));
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
      setError(err instanceof Error ? err.message : t('patients.error.generic'));
      setPreviewItem(null);
    } finally {
      setPreviewLoading(false);
    }
  }

  function closePreview() {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    setPreviewItem(null);
  }

  async function handleCategoryChange(item: MediaListItem, category: DocumentCategory) {
    setError(null);
    try {
      await updateMutation.mutateAsync({
        mediaId: item.id,
        clinical: { documentCategory: category },
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : t('patients.error.generic'));
    }
  }

  if (!canViewMedia(perm)) {
    return <p className={styles.empty}>{t('patients.documents.noAccess')}</p>;
  }

  const previewIsImage = previewItem?.mimeType.startsWith('image/');
  const previewIsPdf = previewItem?.mimeType === 'application/pdf';

  return (
    <>
      <section className={styles.panel} aria-labelledby="patient-documents-heading">
        <div className={styles.header}>
          <h3 id="patient-documents-heading" className={styles.title}>
            {t('patients.detail.attachments')}
          </h3>
          {canUploadMedia(perm) && (
            <div className={styles.uploadRow}>
              <label className={styles.categorySelect}>
                <span className={styles.categoryLabel}>{t('patients.documents.categoryLabel')}</span>
                <select
                  value={uploadCategory}
                  onChange={(e) => setUploadCategory(e.target.value as DocumentCategory)}
                >
                  <option value="patient_attachment">
                    {t('patients.documents.categories.patient_attachment')}
                  </option>
                  <option value="medical_document">
                    {t('patients.documents.categories.medical_document')}
                  </option>
                </select>
              </label>
              <input
                ref={inputRef}
                className={styles.hiddenInput}
                type="file"
                multiple
                accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.webp,application/pdf,image/*"
                onChange={(e) => void handleUpload(e.target.files)}
                tabIndex={-1}
                aria-hidden
              />
              <AuthButton
                variant="secondary"
                loading={uploading}
                disabled={!online}
                onClick={() => inputRef.current?.click()}
                aria-label={t('patients.actions.uploadDocument')}
              >
                <Upload size={16} aria-hidden />
                {t('patients.actions.uploadDocument')}
              </AuthButton>
            </div>
          )}
        </div>

        {error && <AuthAlert variant="error">{error}</AuthAlert>}

        {listQuery.isLoading ? (
          <p className={styles.empty}>{t('auth.loading')}</p>
        ) : items.length === 0 ? (
          <p className={styles.empty}>{t('patients.detail.noDocuments')}</p>
        ) : (
          <ul className={styles.list}>
            {items.map((item) => (
              <li key={item.id} className={styles.item}>
                <div className={styles.meta}>
                  <p className={styles.filename}>{item.originalFilename}</p>
                  <p className={styles.details}>
                    {formatFileSize(item.sizeBytes, locale)}
                    {' · '}
                    {formatPatientDate(item.createdAt, locale, {
                      dateStyle: 'medium',
                      timeStyle: 'short',
                    })}
                  </p>
                  {canUpdateMedia(perm) ? (
                    <label className={styles.inlineCategory}>
                      <span className={styles.categoryLabel}>{t('patients.documents.categoryLabel')}</span>
                      <select
                        value={displayCategory(item)}
                        disabled={updateMutation.isPending}
                        onChange={(e) =>
                          void handleCategoryChange(item, e.target.value as DocumentCategory)
                        }
                        aria-label={`${t('patients.documents.categoryLabel')} ${item.originalFilename}`}
                      >
                        <option value="patient_attachment">
                          {t('patients.documents.categories.patient_attachment')}
                        </option>
                        <option value="medical_document">
                          {t('patients.documents.categories.medical_document')}
                        </option>
                      </select>
                    </label>
                  ) : (
                    <p className={styles.details}>
                      {t(`patients.documents.categories.${displayCategory(item)}`)}
                    </p>
                  )}
                </div>
                <div className={styles.actions}>
                  <AuthButton variant="ghost" onClick={() => void handlePreview(item)}>
                    <Eye size={16} aria-hidden />
                    {t('patients.documents.preview')}
                  </AuthButton>
                  <AuthButton
                    variant="ghost"
                    loading={downloadingId === item.id}
                    onClick={() => void handleDownload(item)}
                  >
                    <Download size={16} aria-hidden />
                    {t('patients.documents.download')}
                  </AuthButton>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <Modal
        open={Boolean(previewItem)}
        title={previewItem?.originalFilename ?? t('patients.documents.preview')}
        onClose={closePreview}
        size="lg"
      >
        {previewLoading && <p>{t('auth.loading')}</p>}
        {!previewLoading && previewUrl && previewIsImage && (
          <img className={styles.previewImage} src={previewUrl} alt={previewItem?.originalFilename ?? ''} />
        )}
        {!previewLoading && previewUrl && previewIsPdf && (
          <iframe className={styles.previewFrame} src={previewUrl} title={previewItem?.originalFilename ?? ''} />
        )}
        {!previewLoading && previewUrl && !previewIsImage && !previewIsPdf && (
          <p>{t('patients.documents.previewUnsupported')}</p>
        )}
      </Modal>
    </>
  );
}
