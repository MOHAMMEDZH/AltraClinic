import { useI18n } from '@booking/i18n/react';
import { AuthButton } from '@/features/auth/components/AuthButton';
import { AuthFormField } from '@/features/auth/components/AuthFormField';
import type { ClinicalNoteTypeKey, StructuredClinicalNote, SoapNotes } from '../types/emr.types';
import { SoapNotesPanel } from './SoapNotesPanel';
import styles from './StructuredNotesPanel.module.css';

const NOTE_TYPES: ClinicalNoteTypeKey[] = [
  'consultation',
  'progress',
  'procedure',
  'follow-up',
];

interface StructuredNotesPanelProps {
  notes: StructuredClinicalNote[];
  soap: SoapNotes;
  readOnly?: boolean;
  onSoapChange?: (soap: SoapNotes) => void;
  onNotesChange?: (notes: StructuredClinicalNote[]) => void;
}

function newNoteId(): string {
  return `note-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

export function StructuredNotesPanel({
  notes,
  soap,
  readOnly,
  onSoapChange,
  onNotesChange,
}: StructuredNotesPanelProps) {
  const { t } = useI18n();

  function addNote(type: ClinicalNoteTypeKey) {
    if (readOnly || !onNotesChange) return;
    onNotesChange([
      ...notes,
      {
        id: newNoteId(),
        type,
        title: t(`emr.noteTypes.${type.replace('-', '_')}` as never),
        body: '',
        createdAt: new Date().toISOString(),
      },
    ]);
  }

  function updateNote(id: string, patch: Partial<StructuredClinicalNote>) {
    if (readOnly || !onNotesChange) return;
    onNotesChange(notes.map((n) => (n.id === id ? { ...n, ...patch } : n)));
  }

  function removeNote(id: string) {
    if (readOnly || !onNotesChange) return;
    onNotesChange(notes.filter((n) => n.id !== id));
  }

  return (
    <div className={styles.stack}>
      <section aria-label={t('emr.soap.title')}>
        <h3 className={styles.heading}>{t('emr.noteTypes.soap')}</h3>
        <SoapNotesPanel soap={soap} readOnly={readOnly} onChange={onSoapChange} />
      </section>

      <section aria-label={t('emr.structuredNotes.title')}>
        <div className={styles.header}>
          <h3 className={styles.heading}>{t('emr.structuredNotes.title')}</h3>
          {!readOnly && (
            <div className={styles.typeButtons} role="group" aria-label={t('emr.structuredNotes.add')}>
              {NOTE_TYPES.map((type) => (
                <AuthButton key={type} variant="secondary" onClick={() => addNote(type)}>
                  {t(`emr.noteTypes.${type.replace('-', '_')}` as never)}
                </AuthButton>
              ))}
            </div>
          )}
        </div>

        {notes.length === 0 ? (
          <p className={styles.muted}>{t('emr.structuredNotes.empty')}</p>
        ) : (
          notes.map((note) => (
            <article key={note.id} className={styles.note}>
              <header className={styles.noteHeader}>
                <span className={styles.typeBadge}>{t(`emr.noteTypes.${note.type.replace('-', '_')}` as never)}</span>
                {!readOnly && (
                  <AuthButton variant="ghost" onClick={() => removeNote(note.id)}>
                    {t('emr.detail.remove')}
                  </AuthButton>
                )}
              </header>
              {readOnly ? (
                <p className={styles.body}>{note.body?.trim() || '—'}</p>
              ) : (
                <AuthFormField
                  id={`note-body-${note.id}`}
                  label={t('emr.structuredNotes.body')}
                  value={note.body ?? ''}
                  onChange={(e) => updateNote(note.id, { body: e.target.value })}
                />
              )}
            </article>
          ))
        )}
      </section>
    </div>
  );
}
