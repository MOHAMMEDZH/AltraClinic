import { FormEvent, useEffect, useState } from 'react';
import { useI18n } from '@booking/i18n/react';
import { AuthButton } from '@/features/auth/components/AuthButton';
import { AuthAlert } from '@/features/auth/components/AuthAlert';
import fieldStyles from '@/features/auth/components/AuthFormField.module.css';
import styles from './PatientNotesPanel.module.css';

interface PatientNotesPanelProps {
  initialNotes: string | null;
  canEdit: boolean;
  saving?: boolean;
  onSave: (notes: string) => Promise<void>;
}

export function PatientNotesPanel({
  initialNotes,
  canEdit,
  saving,
  onSave,
}: PatientNotesPanelProps) {
  const { t } = useI18n();
  const [notes, setNotes] = useState(initialNotes ?? '');
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setNotes(initialNotes ?? '');
  }, [initialNotes]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSaved(false);
    try {
      await onSave(notes.trim());
      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('patients.error.generic'));
    }
  }

  if (!canEdit) {
    return <p className={styles.readOnly}>{initialNotes?.trim() ? initialNotes : '—'}</p>;
  }

  return (
    <form className={styles.form} onSubmit={(e) => void handleSubmit(e)}>
      <label className={fieldStyles.field}>
        <span className={fieldStyles.label}>{t('patients.form.notes')}</span>
        <textarea
          className={styles.textarea}
          rows={8}
          value={notes}
          onChange={(e) => {
            setNotes(e.target.value);
            setSaved(false);
          }}
        />
      </label>
      {error && <AuthAlert variant="error">{error}</AuthAlert>}
      {saved && <AuthAlert variant="success">{t('patients.success.updated')}</AuthAlert>}
      <div className={styles.actions}>
        <AuthButton type="submit" loading={saving}>
          {t('patients.actions.save')}
        </AuthButton>
      </div>
    </form>
  );
}
