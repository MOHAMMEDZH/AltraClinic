import { useState } from 'react';
import { useI18n } from '@booking/i18n/react';
import { useAuth } from '@/app/providers/AuthProvider';
import {
  AppointmentForm,
  formValuesToPayload,
  type AppointmentFormValues,
} from '@/features/scheduling/components/AppointmentForm';
import { useCreateAppointment } from '@/features/scheduling/hooks/useScheduling';

interface PatientBookAppointmentDialogProps {
  patientId: string;
  patientName: string;
  onClose: () => void;
  onSuccess: () => void;
}

export function PatientBookAppointmentDialog({
  patientId,
  patientName,
  onClose,
  onSuccess,
}: PatientBookAppointmentDialogProps) {
  const { t } = useI18n();
  const { user } = useAuth();
  const createMutation = useCreateAppointment();
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(values: AppointmentFormValues) {
    setError(null);
    try {
      await createMutation.mutateAsync(
        formValuesToPayload({ ...values, patientId }, user?.userId ?? ''),
      );
      onSuccess();
      onClose();
    } catch (err) {
      const msg = err instanceof Error ? err.message : t('scheduling.form.conflict');
      if (msg.toLowerCase().includes('conflict')) {
        setError(t('scheduling.form.conflict'));
      } else {
        setError(msg);
      }
    }
  }

  return (
    <AppointmentForm
      mode="create"
      providerId={user?.userId ?? ''}
      defaultPatientId={patientId}
      lockPatient={{ id: patientId, name: patientName }}
      submitting={createMutation.isPending}
      error={error}
      onSubmit={(values) => void handleSubmit(values)}
      onCancel={onClose}
    />
  );
}
