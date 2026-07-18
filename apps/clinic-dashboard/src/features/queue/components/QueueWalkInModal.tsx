import { useMemo, useState } from 'react';
import { Download, UserPlus } from 'lucide-react';
import { useI18n } from '@booking/i18n/react';
import { hasPermission } from '@booking/permissions';
import { useAuth } from '@/app/providers/AuthProvider';
import { useSchedulingProviders } from '@/features/scheduling/hooks/useScheduling';
import { usePatientsList } from '@/features/patients/hooks/usePatients';
import { AuthButton } from '@/features/auth/components/AuthButton';
import { AuthAlert } from '@/features/auth/components/AuthAlert';
import { Modal } from '@/features/patients/components/Modal';
import { useWalkInQueue, downloadQueueExport } from '../hooks/useQueue';
import styles from './QueueWalkInModal.module.css';

interface QueueWalkInModalProps {
  open: boolean;
  branchId?: string;
  onClose: () => void;
  onSuccess?: () => void;
}

export function QueueWalkInModal({ open, branchId, onClose, onSuccess }: QueueWalkInModalProps) {
  const { t } = useI18n();
  const { user } = useAuth();
  const roles = user?.roles ?? [];
  const canCreate = hasPermission(roles, 'api.queue', 'create');
  const [patientSearch, setPatientSearch] = useState('');
  const [selectedPatientId, setSelectedPatientId] = useState('');
  const [providerId, setProviderId] = useState('');
  const [error, setError] = useState<string | null>(null);

  const patientsQuery = usePatientsList({ q: patientSearch || undefined, limit: 8 });
  const providersQuery = useSchedulingProviders(branchId);
  const walkInMutation = useWalkInQueue();

  const providers = providersQuery.data?.items ?? [];

  const selectedPatient = useMemo(
    () => patientsQuery.data?.items.find((p) => p.id === selectedPatientId),
    [patientsQuery.data?.items, selectedPatientId],
  );

  async function handleSubmit() {
    if (!selectedPatientId || !providerId) {
      setError(t('queue.walkIn.required'));
      return;
    }
    setError(null);
    try {
      await walkInMutation.mutateAsync({
        patientId: selectedPatientId,
        providerId,
        branchId,
        priority: 'walk_in',
      });
      onSuccess?.();
      onClose();
      setSelectedPatientId('');
      setPatientSearch('');
    } catch {
      setError(t('queue.errors.walkIn'));
    }
  }

  if (!canCreate) return null;

  return (
    <Modal
      open={open}
      title={t('queue.walkIn.title')}
      onClose={onClose}
      footer={
        <div className={styles.footer}>
          <AuthButton variant="secondary" onClick={onClose}>
            {t('queue.actions.cancelAction')}
          </AuthButton>
          <AuthButton loading={walkInMutation.isPending} onClick={() => void handleSubmit()}>
            <UserPlus size={16} aria-hidden />
            {t('queue.walkIn.submit')}
          </AuthButton>
        </div>
      }
    >
      <p className={styles.lead}>{t('queue.walkIn.description')}</p>
      {error && <AuthAlert variant="error">{error}</AuthAlert>}

      <label className={styles.field}>
        <span>{t('queue.walkIn.searchPatient')}</span>
        <input
          className={styles.input}
          value={patientSearch}
          onChange={(e) => setPatientSearch(e.target.value)}
          placeholder={t('queue.walkIn.searchPlaceholder')}
        />
      </label>

      <ul className={styles.patientList}>
        {(patientsQuery.data?.items ?? []).map((p) => (
          <li key={p.id}>
            <button
              type="button"
              className={[
                styles.patientOption,
                selectedPatientId === p.id ? styles.selected : '',
              ].join(' ')}
              onClick={() => setSelectedPatientId(p.id)}
            >
              {p.firstName} {p.lastName}
            </button>
          </li>
        ))}
      </ul>

      {selectedPatient && (
        <p className={styles.selectedLabel}>
          {t('queue.walkIn.selected')}: <strong>{selectedPatient.firstName} {selectedPatient.lastName}</strong>
        </p>
      )}

      <label className={styles.field}>
        <span>{t('queue.walkIn.provider')}</span>
        <select
          className={styles.input}
          value={providerId}
          onChange={(e) => setProviderId(e.target.value)}
        >
          <option value="">{t('queue.walkIn.selectProvider')}</option>
          {providers.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </label>
    </Modal>
  );
}

export function QueueExportButton({
  branchId,
  disabled,
}: {
  branchId?: string | null;
  disabled?: boolean;
}) {
  const { t } = useI18n();
  const { user, getValidAccessToken } = useAuth();
  const roles = user?.roles ?? [];
  const canExport = hasPermission(roles, 'api.queue', 'export');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!canExport) return null;

  return (
    <>
      {error && <AuthAlert variant="error">{error}</AuthAlert>}
      <AuthButton
        variant="secondary"
        disabled={disabled || busy}
        onClick={() => {
          void (async () => {
            if (!user?.tenantId) return;
            setBusy(true);
            setError(null);
            try {
              await downloadQueueExport(getValidAccessToken, user.tenantId, branchId);
            } catch {
              setError(t('queue.errors.export'));
            } finally {
              setBusy(false);
            }
          })();
        }}
      >
        <Download size={16} aria-hidden />
        {t('queue.export')}
      </AuthButton>
    </>
  );
}
