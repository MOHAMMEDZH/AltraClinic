import { useState } from 'react';
import { useI18n } from '@booking/i18n/react';
import { formatMessage } from '@/i18n/messages';
import { AuthButton } from '@/features/auth/components/AuthButton';
import { AuthAlert } from '@/features/auth/components/AuthAlert';
import { useMergePatients } from '../hooks/usePatients';
import type { PatientDuplicateCandidate } from '../types';
import styles from './PatientMergeDialog.module.css';

interface PatientMergeDialogProps {
  targetPatientId: string;
  targetName: string;
  candidates: PatientDuplicateCandidate[];
  loading?: boolean;
  onClose: () => void;
  onMerged: () => void;
}

export function PatientMergeDialog({
  targetPatientId,
  targetName,
  candidates,
  loading,
  onClose,
  onMerged,
}: PatientMergeDialogProps) {
  const { t } = useI18n();
  const mergeMutation = useMergePatients();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const selected = candidates.find((c) => c.id === selectedId);

  async function confirmMerge() {
    if (!selectedId) return;
    setError(null);
    try {
      await mergeMutation.mutateAsync({ targetId: targetPatientId, sourceId: selectedId });
      onMerged();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : t('patients.error.generic'));
    }
  }

  return (
    <div className={styles.wrap}>
      <p>{t('patients.merge.intro')}</p>
      <p className={styles.target}>
        {t('patients.merge.keepRecord')}: <strong>{targetName}</strong>
      </p>

      {loading && <p>{t('auth.loading')}</p>}

      {!loading && candidates.length === 0 && (
        <AuthAlert variant="info">{t('patients.merge.noCandidates')}</AuthAlert>
      )}

      {candidates.length > 0 && (
        <ul className={styles.list}>
          {candidates.map((candidate) => {
            const label = `${candidate.firstName} ${candidate.lastName}`;
            const checked = selectedId === candidate.id;
            return (
              <li key={candidate.id}>
                <label className={[styles.row, checked ? styles.rowActive : ''].join(' ')}>
                  <input
                    type="radio"
                    name="merge-source"
                    checked={checked}
                    onChange={() => setSelectedId(candidate.id)}
                  />
                  <span className={styles.rowMain}>
                    <span className={styles.name}>{label}</span>
                    <span className={styles.meta}>
                      {[candidate.phone, candidate.nationalId, candidate.email]
                        .filter(Boolean)
                        .join(' · ')}
                    </span>
                    <span className={styles.reasons}>{candidate.matchReasons.join(', ')}</span>
                  </span>
                  <span className={styles.score}>{candidate.matchScore}%</span>
                </label>
              </li>
            );
          })}
        </ul>
      )}

      {selected && (
        <AuthAlert variant="warning">
          {formatMessage(t('patients.merge.confirmWarning'), {
            source: `${selected.firstName} ${selected.lastName}`,
            target: targetName,
          })}
        </AuthAlert>
      )}

      {error && <AuthAlert variant="error">{error}</AuthAlert>}

      <div className={styles.actions}>
        <AuthButton variant="secondary" onClick={onClose}>
          {t('patients.actions.cancel')}
        </AuthButton>
        <AuthButton
          variant="danger"
          disabled={!selectedId}
          loading={mergeMutation.isPending}
          onClick={() => void confirmMerge()}
        >
          {t('patients.merge.confirm')}
        </AuthButton>
      </div>
    </div>
  );
}
