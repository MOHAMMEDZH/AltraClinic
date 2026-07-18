import { Link, useParams } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { useI18n } from '@booking/i18n/react';
import { hasPermission } from '@booking/permissions';
import { useCallback } from 'react';
import { useAuth } from '@/app/providers/AuthProvider';
import { AuthAlert } from '@/features/auth/components/AuthAlert';
import { canCreateBeauty, canUpdateBeauty, canViewBeauty } from './config/beauty-config';
import { useBeautyRecord, useCreateBeautyRecord } from './hooks/useBeauty';
import { BeautyGalleryWorkspace } from './components/BeautyGalleryWorkspace';
import styles from './BeautyImagingPage.module.css';

export function BeautyImagingPage() {
  const { patientId } = useParams<{ patientId: string }>();
  const { t, direction } = useI18n();
  const { user } = useAuth();
  const roles = user?.roles ?? [];
  const perm = useCallback((action: string) => hasPermission(roles, 'api.beauty', action as never), [roles]);
  const recordQuery = useBeautyRecord(patientId, canViewBeauty(perm));
  const createMutation = useCreateBeautyRecord();

  if (!canViewBeauty(perm)) {
    return <div className={styles.page}><AuthAlert variant="error">{t('beauty.errors.accessDenied')}</AuthAlert></div>;
  }

  if (recordQuery.isLoading) {
    return <div className={styles.page} aria-busy="true"><div className={styles.skeleton} /></div>;
  }

  const record = recordQuery.data;

  return (
    <div className={styles.page} id="beauty-imaging-region">
      <nav className={styles.breadcrumb} aria-label="Breadcrumb">
        <Link to="/beauty">{t('beauty.title')}</Link>
        <ChevronRight size={14} aria-hidden className={direction === 'rtl' ? styles.flip : undefined} />
        {patientId && (
          <>
            <Link to={`/beauty/workspace/${patientId}`}>{t('beauty.workspace.title')}</Link>
            <ChevronRight size={14} aria-hidden className={direction === 'rtl' ? styles.flip : undefined} />
          </>
        )}
        <span aria-current="page">{t('beauty.imaging.title')}</span>
      </nav>

      {!record && patientId && canCreateBeauty(perm) && (
        <AuthAlert variant="info">
          {t('beauty.imaging.noRecord')}
          <button type="button" className={styles.linkBtn} onClick={() => void createMutation.mutateAsync(patientId).then(() => recordQuery.refetch())}>
            {t('beauty.initializeRecord')}
          </button>
        </AuthAlert>
      )}

      {record && patientId && (
        <BeautyGalleryWorkspace
          patientId={patientId}
          recordId={record.id}
          consents={record.bodyMapState.consents}
          canUpload={canUpdateBeauty(perm)}
        />
      )}
    </div>
  );
}
