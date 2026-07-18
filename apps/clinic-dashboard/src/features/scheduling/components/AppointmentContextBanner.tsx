import { Link, useSearchParams } from 'react-router-dom';
import { ArrowLeft, CalendarClock } from 'lucide-react';
import { useI18n } from '@booking/i18n/react';
import { isFromAppointment, parseAppointmentContext } from '@/lib/appointment-clinical-nav';
import styles from './AppointmentContextBanner.module.css';

interface AppointmentContextBannerProps {
  patientName?: string;
  appointmentLabel?: string;
}

export function AppointmentContextBanner({ patientName, appointmentLabel }: AppointmentContextBannerProps) {
  const { t } = useI18n();
  const [searchParams] = useSearchParams();
  const ctx = parseAppointmentContext(searchParams);

  if (!isFromAppointment(ctx)) return null;

  const backHref = ctx.returnTo ?? '/appointments';

  return (
    <div className={styles.banner} role="status">
      <Link to={backHref} className={styles.back}>
        <ArrowLeft size={14} aria-hidden />
        {t('scheduling.clinical.backToAppointment')}
      </Link>
      <span className={styles.context}>
        <CalendarClock size={14} aria-hidden />
        {t('scheduling.clinical.contextLabel')}
        {patientName && <strong>{patientName}</strong>}
        {appointmentLabel && <span className={styles.time}>{appointmentLabel}</span>}
      </span>
    </div>
  );
}
