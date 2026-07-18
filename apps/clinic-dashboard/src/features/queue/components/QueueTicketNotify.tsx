import { useMutation } from '@tanstack/react-query';
import { MessageCircle, Smartphone } from 'lucide-react';
import { hasPermission } from '@booking/permissions';
import { useI18n } from '@booking/i18n/react';
import { useAuth } from '@/app/providers/AuthProvider';
import { AuthButton } from '@/features/auth/components/AuthButton';
import { sendPatientNotification } from '@/features/patients/lib/patient-notifications';
import { buildWhatsAppUrl } from '@/features/patients/lib/whatsapp-message';
import type { QueueBoardItem } from '../types/queue.types';
import styles from './QueueTicketNotify.module.css';

interface QueueTicketNotifyProps {
  ticket: QueueBoardItem;
  patientPhone?: string | null;
  compact?: boolean;
}

export function QueueTicketNotify({ ticket, patientPhone, compact }: QueueTicketNotifyProps) {
  const { t } = useI18n();
  const { getValidAccessToken, user } = useAuth();
  const roles = user?.roles ?? [];
  const canNotify = hasPermission(roles, 'api.notifications', 'create');

  const position = ticket.position ?? '—';
  const body = t('queue.notify.calledBody').replace('{name}', ticket.patientName).replace('{n}', String(position));
  const title = t('queue.notify.calledTitle');

  const sendMutation = useMutation({
    mutationFn: async (channel: 'sms' | 'whatsapp') => {
      const token = await getValidAccessToken();
      if (!token || !user?.tenantId) throw new Error('Not authenticated');
      return sendPatientNotification(token, user.tenantId, {
        patientId: ticket.patientId,
        channel,
        title,
        body,
        branchId: ticket.branchId,
      });
    },
  });

  if (!canNotify || compact) return null;

  return (
    <div className={styles.row}>
      <AuthButton
        variant="ghost"
        disabled={!patientPhone || sendMutation.isPending}
        onClick={() => void sendMutation.mutateAsync('sms')}
      >
        <Smartphone size={14} aria-hidden />
        {t('queue.notify.sendSms')}
      </AuthButton>
      <AuthButton
        variant="ghost"
        disabled={!patientPhone}
        onClick={() => {
          if (!patientPhone) return;
          window.open(buildWhatsAppUrl(patientPhone, body), '_blank', 'noopener,noreferrer');
        }}
      >
        <MessageCircle size={14} aria-hidden />
        {t('queue.notify.openWhatsapp')}
      </AuthButton>
    </div>
  );
}
