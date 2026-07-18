import { Link } from 'react-router-dom';
import { ClipboardList, FileText, Smile, Sparkles, User } from 'lucide-react';
import { useI18n } from '@booking/i18n/react';
import { AuthButton } from '@/features/auth/components/AuthButton';
import type { ClinicalNavTarget } from '@/lib/appointment-clinical-nav';
import { useAppointment } from '../hooks/useScheduling';
import { useAppointmentClinicalLinks } from '../hooks/useAppointmentClinicalLinks';
import { useAppointmentContextDisplay } from '../hooks/useAppointmentContextDisplay';
import styles from './AppointmentClinicalWorkspaceBar.module.css';

interface AppointmentClinicalWorkspaceBarProps {
  current: ClinicalNavTarget;
}

export function AppointmentClinicalWorkspaceBar({ current }: AppointmentClinicalWorkspaceBarProps) {
  const { t } = useI18n();
  const { fromAppointment, ctx } = useAppointmentContextDisplay();
  const apptQuery = useAppointment(fromAppointment ? ctx.appointmentId : undefined);
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
    canBeauty,
  } = useAppointmentClinicalLinks(apptQuery.data ?? null);

  if (!fromAppointment || !links || (!canPatient && !canDental && !canBeauty && !canEmr)) return null;

  return (
    <nav className={styles.bar} aria-label={t('scheduling.clinical.workspaceNav')}>
      {canPatient && links.patient && (
        <Link
          to={links.patient}
          className={styles.chip}
          aria-current={current === 'patient' ? 'page' : undefined}
        >
          <User size={14} aria-hidden />
          {t('scheduling.clinical.patient')}
        </Link>
      )}
      {canDental && links.chart && (
        <Link
          to={links.chart}
          className={styles.chip}
          aria-current={current === 'chart' ? 'page' : undefined}
        >
          <Smile size={14} aria-hidden />
          {t('scheduling.clinical.chart')}
        </Link>
      )}
      {canDental && links.treatmentPlan && (
        <Link
          to={links.treatmentPlan}
          className={styles.chip}
          aria-current={current === 'plan' ? 'page' : undefined}
        >
          <ClipboardList size={14} aria-hidden />
          {t('scheduling.clinical.treatmentPlan')}
        </Link>
      )}
      {canBeauty && links.beauty && (
        <Link
          to={links.beauty}
          className={styles.chip}
          aria-current={current === 'beauty' ? 'page' : undefined}
        >
          <Sparkles size={14} aria-hidden />
          {t('beauty.clinical.beautyWorkspace')}
        </Link>
      )}
      {canEmr && current !== 'notes' && (
        encounter && links.clinicalNotes ? (
          <Link to={links.clinicalNotes} className={styles.chip}>
            <FileText size={14} aria-hidden />
            {t('scheduling.clinical.notes')}
          </Link>
        ) : canCreateNotes ? (
          <div className={styles.notesChip}>
            <AuthButton
              variant="secondary"
              loading={loadingEncounter || creatingNotes}
              onClick={() => void openClinicalNotes()}
            >
              <FileText size={14} aria-hidden />
              {t('scheduling.clinical.startNotes')}
            </AuthButton>
          </div>
        ) : null
      )}
      {canEmr && current === 'notes' && links.clinicalNotes && (
        <span className={[styles.chip, styles.chipActive].join(' ')} aria-current="page">
          <FileText size={14} aria-hidden />
          {t('scheduling.clinical.notes')}
        </span>
      )}
    </nav>
  );
}
