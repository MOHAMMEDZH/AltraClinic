import { Link } from 'react-router-dom';
import { ClipboardList, FileText, Smile, User } from 'lucide-react';
import { useI18n } from '@booking/i18n/react';
import { AuthButton } from '@/features/auth/components/AuthButton';
import type { AppointmentListItem } from '../types/scheduling.types';
import { useAppointmentClinicalLinks } from '../hooks/useAppointmentClinicalLinks';
import styles from './AppointmentClinicalQuickNav.module.css';

interface AppointmentClinicalQuickNavProps {
  appointment: AppointmentListItem;
}

export function AppointmentClinicalQuickNav({ appointment }: AppointmentClinicalQuickNavProps) {
  const { t } = useI18n();
  const {
    links,
    openClinicalNotes,
    loadingEncounter,
    creatingNotes,
    canPatient,
    canDental,
    canEmr,
    canCreateNotes,
    encounter,
  } = useAppointmentClinicalLinks(appointment);

  if (!links || (!canPatient && !canDental && !canEmr)) return null;

  return (
    <section className={styles.section} aria-label={t('scheduling.clinical.title')}>
      <h3 className={styles.heading}>{t('scheduling.clinical.title')}</h3>
      <p className={styles.hint}>{t('scheduling.clinical.hint')}</p>
      <div className={styles.grid} role="group">
        {canPatient && links.patient && (
          <Link to={links.patient} className={styles.chip}>
            <User size={16} aria-hidden />
            <span>{t('scheduling.clinical.patient')}</span>
          </Link>
        )}
        {canDental && links.chart && (
          <Link to={links.chart} className={styles.chip}>
            <Smile size={16} aria-hidden />
            <span>{t('scheduling.clinical.chart')}</span>
          </Link>
        )}
        {canDental && links.treatmentPlan && (
          <Link to={links.treatmentPlan} className={styles.chip}>
            <ClipboardList size={16} aria-hidden />
            <span>{t('scheduling.clinical.treatmentPlan')}</span>
          </Link>
        )}
        {canEmr && (
          encounter && links.clinicalNotes ? (
            <Link to={links.clinicalNotes} className={styles.chip}>
              <FileText size={16} aria-hidden />
              <span>{t('scheduling.clinical.notes')}</span>
            </Link>
          ) : canCreateNotes ? (
            <div className={styles.notesBtn}>
              <AuthButton
                variant="secondary"
                loading={loadingEncounter || creatingNotes}
                onClick={() => void openClinicalNotes()}
              >
                <FileText size={16} aria-hidden />
                {t('scheduling.clinical.startNotes')}
              </AuthButton>
            </div>
          ) : null
        )}
      </div>
    </section>
  );
}
