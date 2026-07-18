import { Link } from 'react-router-dom';
import { AlertCircle, ExternalLink } from 'lucide-react';
import { useI18n } from '@booking/i18n/react';
import { usePatient } from '@/features/patients/hooks/usePatients';
import { AuthAlert } from '@/features/auth/components/AuthAlert';
import styles from './PatientClinicalSummaryPanel.module.css';

interface PatientClinicalSummaryPanelProps {
  patientId: string;
}

export function PatientClinicalSummaryPanel({ patientId }: PatientClinicalSummaryPanelProps) {
  const { t } = useI18n();
  const patientQuery = usePatient(patientId);
  const profile = patientQuery.data?.profileData ?? {};
  const allergies = profile.allergies ?? [];
  const conditions = profile.chronicConditions ?? [];

  if (patientQuery.isLoading) {
    return <div className={styles.panel} aria-busy="true"><div className={styles.skeleton} /></div>;
  }

  return (
    <section className={styles.panel} aria-label={t('emr.summary.title')}>
      <div className={styles.header}>
        <h2 className={styles.title}>{t('emr.summary.title')}</h2>
        <Link to={`/patients/${patientId}`} className={styles.profileLink}>
          <ExternalLink size={14} aria-hidden />
          {t('emr.detail.patientLink')}
        </Link>
      </div>

      {allergies.length > 0 && (
        <AuthAlert variant="error">
          <AlertCircle size={16} aria-hidden />
          {t('emr.summary.allergies')}: {allergies.join(', ')}
        </AuthAlert>
      )}

      <dl className={styles.dl}>
        <div>
          <dt>{t('emr.summary.conditions')}</dt>
          <dd>{conditions.length ? conditions.join(', ') : '—'}</dd>
        </div>
        <div>
          <dt>{t('emr.summary.medicationHistory')}</dt>
          <dd>{profile.medicationHistory?.trim() || '—'}</dd>
        </div>
        <div>
          <dt>{t('emr.summary.familyHistory')}</dt>
          <dd>{profile.familyHistory?.trim() || '—'}</dd>
        </div>
        <div>
          <dt>{t('emr.summary.surgicalHistory')}</dt>
          <dd>{profile.surgicalHistory?.trim() || '—'}</dd>
        </div>
        <div>
          <dt>{t('emr.summary.socialHistory')}</dt>
          <dd>{profile.socialHistory?.trim() || '—'}</dd>
        </div>
        {patientQuery.data?.bloodGroup && (
          <div>
            <dt>{t('emr.summary.bloodGroup')}</dt>
            <dd>{patientQuery.data.bloodGroup}</dd>
          </div>
        )}
      </dl>
    </section>
  );
}
