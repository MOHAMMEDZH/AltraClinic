import { useMemo } from 'react';
import { useI18n } from '@booking/i18n/react';
import { AuthButton } from '@/features/auth/components/AuthButton';
import { AuthAlert } from '@/features/auth/components/AuthAlert';
import { useCheckInQueue } from '@/features/queue/hooks/useQueue';
import { useAppointmentsList } from '@/features/scheduling/hooks/useScheduling';
import { formatTimeRange } from '@/features/scheduling/config/scheduling-config';
import { StatusBadge } from '@/features/scheduling/components/StatusBadge';
import type { AppointmentListItem } from '@/features/scheduling/types/scheduling.types';
import styles from './PatientCheckInDialog.module.css';

function todayRange(): { from: string; to: string } {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
  return { from: start.toISOString(), to: end.toISOString() };
}

const CHECK_IN_STATUSES = new Set(['pending', 'confirmed']);

interface PatientCheckInDialogProps {
  patientId: string;
  onClose: () => void;
  onSuccess: () => void;
}

export function PatientCheckInDialog({ patientId, onClose, onSuccess }: PatientCheckInDialogProps) {
  const { t, locale } = useI18n();
  const range = useMemo(() => todayRange(), []);
  const appointmentsQuery = useAppointmentsList(
    { patientId, from: range.from, to: range.to, limit: 20, offset: 0 },
    Boolean(patientId),
  );
  const checkInMutation = useCheckInQueue();

  const eligible = (appointmentsQuery.data?.items ?? []).filter((appt) =>
    CHECK_IN_STATUSES.has(appt.status),
  );

  async function checkIn(appointment: AppointmentListItem) {
    await checkInMutation.mutateAsync(appointment.id);
    onSuccess();
    onClose();
  }

  return (
    <div className={styles.wrap}>
      {appointmentsQuery.isLoading && <p>{t('auth.loading')}</p>}
      {!appointmentsQuery.isLoading && eligible.length === 0 && (
        <>
          <AuthAlert variant="warning">{t('patients.checkIn.noAppointments')}</AuthAlert>
          <div className={styles.actions}>
            <AuthButton variant="secondary" onClick={onClose}>
              {t('patients.actions.cancel')}
            </AuthButton>
          </div>
        </>
      )}
      {eligible.length > 0 && (
        <>
          <p className={styles.intro}>{t('patients.checkIn.selectAppointment')}</p>
          <ul className={styles.list}>
            {eligible.map((appt) => (
              <li key={appt.id} className={styles.item}>
                <div>
                  <p className={styles.time}>{formatTimeRange(appt.start, appt.end, locale)}</p>
                  <StatusBadge status={appt.status} />
                </div>
                <AuthButton
                  loading={checkInMutation.isPending}
                  onClick={() => void checkIn(appt)}
                >
                  {t('patients.actions.checkIn')}
                </AuthButton>
              </li>
            ))}
          </ul>
          <div className={styles.actions}>
            <AuthButton variant="secondary" onClick={onClose}>
              {t('patients.actions.cancel')}
            </AuthButton>
          </div>
        </>
      )}
    </div>
  );
}
