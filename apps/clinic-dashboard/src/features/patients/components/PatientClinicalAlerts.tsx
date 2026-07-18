import { AuthAlert } from '@/features/auth/components/AuthAlert';
import { useI18n } from '@booking/i18n/react';
import type { PatientProfileData } from '../types';
import styles from './PatientClinicalAlerts.module.css';

interface PatientClinicalAlertsProps {
  profile: PatientProfileData;
}

export function PatientClinicalAlerts({ profile }: PatientClinicalAlertsProps) {
  const { t } = useI18n();
  const allergies = profile.allergies ?? [];
  const conditions = profile.chronicConditions ?? [];

  if (allergies.length === 0 && conditions.length === 0) return null;

  return (
    <div className={styles.wrap} role="region" aria-label={t('patients.clinical.alertsTitle')}>
      {allergies.length > 0 && (
        <AuthAlert variant="warning">
          {t('patients.detail.allergyAlert')}: {allergies.join(', ')}
        </AuthAlert>
      )}
      {conditions.length > 0 && (
        <AuthAlert variant="info">
          {t('patients.clinical.conditionsAlert')}: {conditions.join(', ')}
        </AuthAlert>
      )}
    </div>
  );
}
