import { useCallback, useRef, useState } from 'react';
import { Download, Upload } from 'lucide-react';
import { hasPermission } from '@booking/permissions';
import { useI18n } from '@booking/i18n/react';
import { useAuth } from '@/app/providers/AuthProvider';
import { AuthButton } from '@/features/auth/components/AuthButton';
import { AuthAlert } from '@/features/auth/components/AuthAlert';
import { canUploadMedia, canViewMedia, formatFileSize } from '@/features/media/config/imaging-config';
import { fetchMediaBlob } from '@/features/media/api/media-api';
import { useMediaList, useUploadMedia } from '@/features/media/hooks/useMedia';
import { formatPatientDate } from '@/features/patients/lib/patient-format';
import styles from './InvoiceAttachmentsPanel.module.css';

interface InvoiceAttachmentsPanelProps {
  invoiceId: string;
  patientId: string;
}

export function InvoiceAttachmentsPanel({ invoiceId, patientId }: InvoiceAttachmentsPanelProps) {
  const { t, locale } = useI18n();
  const { getValidAccessToken, user } = useAuth();
  const roles = user?.roles ?? [];
  const perm = useCallback((action: string) => hasPermission(roles, 'api.media', action as never), [roles]);
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const listQuery = useMediaList(
    { patientId, category: 'invoice_attachment', ownerType: 'invoice', ownerId: invoiceId },
    canViewMedia(perm),
  );
  const uploadMutation = useUploadMedia();
  const items = (listQuery.data?.items ?? []).filter((item) => item.category === 'invoice_attachment');

  async function handleUpload(files: FileList | null) {
    if (!files?.length || !canUploadMedia(perm)) return;
    setError(null);
    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        await uploadMutation.mutateAsync({
          file,
          category: 'invoice_attachment',
          ownerType: 'invoice',
          ownerId: invoiceId,
          patientId,
          title: file.name,
        });
      }
      void listQuery.refetch();
    } catch {
      setError(t('billing.attachments.uploadError'));
    } finally {
      setUploading(false);
    }
  }

  async function handleDownload(mediaId: string, filename: string) {
    const token = await getValidAccessToken();
    if (!token || !user?.tenantId) return;
    const blob = await fetchMediaBlob(token, user.tenantId, mediaId);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <section className={styles.panel} aria-label={t('billing.attachments.title')}>
      <div className={styles.header}>
        <h2 className={styles.title}>{t('billing.attachments.title')}</h2>
        {canUploadMedia(perm) && (
          <>
            <input
              ref={inputRef}
              type="file"
              className={styles.hiddenInput}
              multiple
              onChange={(e) => void handleUpload(e.target.files)}
            />
            <AuthButton variant="secondary" loading={uploading} onClick={() => inputRef.current?.click()}>
              <Upload size={16} aria-hidden />
              {t('billing.attachments.upload')}
            </AuthButton>
          </>
        )}
      </div>
      {error && <AuthAlert variant="error">{error}</AuthAlert>}
      {items.length === 0 ? (
        <p className={styles.empty}>{t('billing.attachments.empty')}</p>
      ) : (
        <ul className={styles.list}>
          {items.map((item) => (
            <li key={item.id} className={styles.row}>
              <div>
                <strong>{item.metadata?.clinical?.title ?? item.originalFilename}</strong>
                <span className={styles.meta}>
                  {formatFileSize(item.sizeBytes, locale)} · {formatPatientDate(item.createdAt, locale)}
                </span>
              </div>
              <AuthButton variant="secondary" onClick={() => void handleDownload(item.id, item.originalFilename)}>
                <Download size={16} aria-hidden />
                {t('billing.attachments.download')}
              </AuthButton>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
