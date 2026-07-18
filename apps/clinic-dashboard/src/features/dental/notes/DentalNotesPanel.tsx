import { useState } from 'react';
import { useI18n } from '@booking/i18n/react';
import { AuthButton } from '@/features/auth/components/AuthButton';
import { AuthAlert } from '@/features/auth/components/AuthAlert';
import { EmptyState } from '@/features/patients/components/EmptyState';
import { formatDentalDate } from '../config/dental-config';
import { useCreateDentalClinicalNote, useDentalClinicalNotes } from '../hooks/useDentalExtended';
import styles from './DentalNotesPanel.module.css';

interface DentalNotesPanelProps {
  patientId: string;
  chartId?: string;
  canEdit: boolean;
}

export function DentalNotesPanel({ patientId, chartId, canEdit }: DentalNotesPanelProps) {
  const { t, locale } = useI18n();
  const notesQuery = useDentalClinicalNotes(patientId);
  const createMutation = useCreateDentalClinicalNote();
  const [content, setContent] = useState('');
  const [noteType, setNoteType] = useState('progress');
  const [error, setError] = useState<string | null>(null);

  const items = notesQuery.data?.items ?? [];

  async function handleSave() {
    if (!content.trim()) return;
    setError(null);
    try {
      await createMutation.mutateAsync({
        patientId,
        content: content.trim(),
        noteType,
        dentalRecordId: chartId ?? null,
      });
      setContent('');
    } catch {
      setError(t('dental.notes.errors.save'));
    }
  }

  return (
    <div className={styles.wrap}>
      <h2 className={styles.title}>{t('dental.notes.title')}</h2>
      {canEdit && (
        <div className={styles.form}>
          <label>
            {t('dental.notes.type')}
            <select value={noteType} onChange={(e) => setNoteType(e.target.value)}>
              <option value="progress">{t('dental.notes.types.progress')}</option>
              <option value="referral">{t('dental.notes.types.referral')}</option>
              <option value="consent">{t('dental.notes.types.consent')}</option>
              <option value="general">{t('dental.notes.types.general')}</option>
            </select>
          </label>
          <label>
            {t('dental.notes.content')}
            <textarea
              rows={4}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder={t('dental.notes.placeholder')}
            />
          </label>
          <AuthButton loading={createMutation.isPending} onClick={() => void handleSave()}>
            {t('dental.notes.save')}
          </AuthButton>
        </div>
      )}
      {error && <AuthAlert variant="error">{error}</AuthAlert>}
      {notesQuery.isLoading ? (
        <div className={styles.skeleton} aria-busy="true" />
      ) : !items.length ? (
        <EmptyState title={t('dental.notes.empty.title')} description={t('dental.notes.empty.description')} />
      ) : (
        <ul className={styles.list}>
          {items.map((n) => (
            <li key={n.id} className={styles.note}>
              <header>
                <span className={styles.type}>{t(`dental.notes.types.${n.noteType}`)}</span>
                <time dateTime={n.createdAt}>{formatDentalDate(n.createdAt, locale)}</time>
              </header>
              <p>{n.content}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
