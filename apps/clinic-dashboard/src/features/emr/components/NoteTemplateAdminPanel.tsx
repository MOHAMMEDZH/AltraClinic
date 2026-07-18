import { useState } from 'react';
import { useI18n } from '@booking/i18n/react';
import { AuthButton } from '@/features/auth/components/AuthButton';
import { AuthFormField } from '@/features/auth/components/AuthFormField';
import { useCreateNoteTemplate, useDeleteNoteTemplate, useNoteTemplates } from '../hooks/useEmr';
import styles from './NoteTemplateAdminPanel.module.css';

export function NoteTemplateAdminPanel() {
  const { t } = useI18n();
  const query = useNoteTemplates();
  const createMutation = useCreateNoteTemplate();
  const deleteMutation = useDeleteNoteTemplate();
  const [name, setName] = useState('');
  const [noteType, setNoteType] = useState('consultation');

  async function handleCreate() {
    if (!name.trim()) return;
    await createMutation.mutateAsync({ name: name.trim(), noteType });
    setName('');
  }

  const templates = query.data ?? [];

  return (
    <section className={styles.panel} aria-label={t('emr.templateAdmin.title')}>
      <h2 className={styles.title}>{t('emr.templateAdmin.title')}</h2>
      <p className={styles.hint}>{t('emr.templateAdmin.hint')}</p>

      <div className={styles.form}>
        <AuthFormField id="tpl-name" label={t('emr.templateAdmin.name')} value={name} onChange={(e) => setName(e.target.value)} />
        <label className={styles.label} htmlFor="tpl-type">{t('emr.templateAdmin.type')}</label>
        <select id="tpl-type" className={styles.select} value={noteType} onChange={(e) => setNoteType(e.target.value)}>
          <option value="consultation">{t('emr.noteTypes.consultation')}</option>
          <option value="progress">{t('emr.noteTypes.progress')}</option>
          <option value="procedure">{t('emr.noteTypes.procedure')}</option>
          <option value="follow-up">{t('emr.noteTypes.follow_up')}</option>
        </select>
        <AuthButton loading={createMutation.isPending} onClick={() => void handleCreate()}>
          {t('emr.templateAdmin.create')}
        </AuthButton>
      </div>

      {templates.length === 0 ? (
        <p className={styles.muted}>{t('emr.templateAdmin.empty')}</p>
      ) : (
        <ul className={styles.list}>
          {templates.map((tpl) => (
            <li key={tpl.id} className={styles.item}>
              <div>
                <strong>{tpl.name}</strong>
                <span className={styles.type}>{tpl.noteType}</span>
              </div>
              <AuthButton variant="ghost" loading={deleteMutation.isPending} onClick={() => void deleteMutation.mutateAsync(tpl.id)}>
                {t('emr.templateAdmin.deactivate')}
              </AuthButton>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
