import { useI18n } from '@booking/i18n/react';
import { Bell, Mail, Sparkles } from 'lucide-react';
import { Link } from 'react-router-dom';
import styles from './BeautyCommunicationPanel.module.css';

interface BeautyCommunicationPanelProps {
  patientId: string;
  followUpDue?: number;
  upcomingSessions?: number;
}

export function BeautyCommunicationPanel({ patientId, followUpDue = 0, upcomingSessions = 0 }: BeautyCommunicationPanelProps) {
  const { t } = useI18n();

  return (
    <section className={styles.panel} aria-label={t('beauty.communication.title')}>
      <h3 className={styles.title}>{t('beauty.communication.title')}</h3>
      <ul className={styles.list}>
        <li>
          <Bell size={16} aria-hidden />
          <div>
            <strong>{t('beauty.communication.appointmentReminders')}</strong>
            <p>
              {upcomingSessions > 0
                ? t('beauty.communication.upcomingCount').replace('{n}', String(upcomingSessions))
                : t('beauty.communication.noUpcoming')}
            </p>
            <Link to={`/scheduling/appointments?patientId=${patientId}`}>{t('beauty.communication.viewSchedule')}</Link>
          </div>
        </li>
        <li>
          <Mail size={16} aria-hidden />
          <div>
            <strong>{t('beauty.communication.followUpReminders')}</strong>
            <p>
              {followUpDue > 0
                ? t('beauty.communication.followUpCount').replace('{n}', String(followUpDue))
                : t('beauty.communication.noFollowUps')}
            </p>
          </div>
        </li>
        <li>
          <Sparkles size={16} aria-hidden />
          <div>
            <strong>{t('beauty.communication.loyalty')}</strong>
            <p>{t('beauty.communication.loyaltyHint')}</p>
            <Link to={`/patients/${patientId}`}>{t('beauty.communication.viewLoyalty')}</Link>
          </div>
        </li>
      </ul>
    </section>
  );
}
