import { useState } from 'react';

import { useI18n } from '@booking/i18n/react';

import { Modal } from '@/features/patients/components/Modal';

import { AuthButton } from '@/features/auth/components/AuthButton';

import { buildReportShareLink, type ReportShareAccess } from '../lib/report-shares';

import { useCreateReportShare } from '../hooks/useReporting';

import styles from '../reporting-layout.module.css';



interface ShareReportDialogProps {

  open: boolean;

  reportId: string;

  reportName: string;

  reportKind?: string;

  onClose: () => void;

  onShared?: () => void;

}



export function ShareReportDialog({

  open,

  reportId,

  reportName,

  reportKind = 'analytics',

  onClose,

  onShared,

}: ShareReportDialogProps) {

  const { t } = useI18n();

  const shareMutation = useCreateReportShare();

  const [targetType, setTargetType] = useState<'user' | 'role' | 'branch'>('user');

  const [targetId, setTargetId] = useState('');

  const [access, setAccess] = useState<ReportShareAccess>('read');

  const [copied, setCopied] = useState(false);

  const [error, setError] = useState<string | null>(null);



  const shareLink = buildReportShareLink(reportId);



  function handleShare() {

    if (!targetId.trim()) return;

    setError(null);

    void shareMutation.mutateAsync({

      reportId,

      reportKind,

      targetType,

      targetId: targetId.trim(),

      access,

    }).then(() => {

      onShared?.();

      onClose();

    }).catch(() => setError(t('reports.share.error')));

  }



  function copyLink() {

    void navigator.clipboard.writeText(shareLink).then(() => {

      setCopied(true);

      setTimeout(() => setCopied(false), 2000);

    });

  }



  return (

    <Modal

      open={open}

      title={t('reports.share.title')}

      onClose={onClose}

      closeLabel={t('reports.share.cancel')}

      footer={

        <div className={styles.dialogActions}>

          <AuthButton variant="secondary" onClick={onClose}>{t('reports.share.cancel')}</AuthButton>

          <AuthButton loading={shareMutation.isPending} onClick={handleShare}>{t('reports.share.confirm')}</AuthButton>

        </div>

      }

    >

      <p className={styles.hint}>{reportName}</p>

      {error && <p className={styles.empty} role="alert">{error}</p>}

      <div className={styles.formGrid}>

        <label>

          {t('reports.share.targetType')}

          <select value={targetType} onChange={(e) => setTargetType(e.target.value as typeof targetType)}>

            <option value="user">{t('reports.share.user')}</option>

            <option value="role">{t('reports.share.role')}</option>

            <option value="branch">{t('reports.share.branch')}</option>

          </select>

        </label>

        <label>

          {t('reports.share.targetId')}

          <input value={targetId} onChange={(e) => setTargetId(e.target.value)} />

        </label>

        <label>

          {t('reports.share.access')}

          <select value={access} onChange={(e) => setAccess(e.target.value as ReportShareAccess)}>

            <option value="read">{t('reports.share.readOnly')}</option>

            <option value="edit">{t('reports.share.editable')}</option>

          </select>

        </label>

        <div>

          <span className={styles.hint}>{t('reports.share.link')}</span>

          <div className={styles.dialogActions}>

            <input readOnly value={shareLink} aria-label={t('reports.share.link')} />

            <AuthButton variant="secondary" onClick={copyLink}>

              {copied ? t('reports.share.copied') : t('reports.share.copy')}

            </AuthButton>

          </div>

        </div>

      </div>

    </Modal>

  );

}

