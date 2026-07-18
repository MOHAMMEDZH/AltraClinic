import { FormEvent, useState } from 'react';
import { useI18n } from '@booking/i18n/react';
import { AuthButton } from '@/features/auth/components/AuthButton';
import { AuthFormField } from '@/features/auth/components/AuthFormField';
import { AuthAlert } from '@/features/auth/components/AuthAlert';
import type { ListColumnId } from '../config/patients-config';
import type { PatientGender } from '../types';
import {
  deletePatientSavedView,
  listPatientSavedViews,
  savePatientSavedView,
  type PatientSavedView,
} from '../lib/patient-saved-views';
import styles from './PatientSavedViewsDialog.module.css';

export interface PatientViewState {
  search: string;
  status: 'active' | 'archived' | 'all';
  gender: PatientGender | null;
  columns: ListColumnId[];
}

interface PatientSavedViewsDialogProps {
  current: PatientViewState;
  onApply: (view: PatientSavedView) => void;
  onViewsChange: () => void;
}

export function PatientSavedViewsDialog({
  current,
  onApply,
  onViewsChange,
}: PatientSavedViewsDialogProps) {
  const { t } = useI18n();
  const [views, setViews] = useState(() => listPatientSavedViews());
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);

  function refresh() {
    setViews(listPatientSavedViews());
    onViewsChange();
  }

  function handleSave(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const trimmed = name.trim();
    if (!trimmed) {
      setError(t('patients.views.nameRequired'));
      return;
    }
    savePatientSavedView({
      name: trimmed,
      search: current.search,
      status: current.status,
      gender: current.gender,
      columns: current.columns,
    });
    setName('');
    refresh();
  }

  function removeView(id: string) {
    deletePatientSavedView(id);
    refresh();
  }

  function describeView(view: PatientSavedView): string {
    const parts = [
      t(`patients.filters.${view.status === 'all' ? 'all' : view.status}`),
      view.gender ? t(`patients.filters.${view.gender}`) : t('patients.views.anyGender'),
    ];
    if (view.search) parts.push(`"${view.search}"`);
    return parts.join(' · ');
  }

  return (
    <div>
      <p className={styles.intro}>{t('patients.views.intro')}</p>

      <form className={styles.form} onSubmit={handleSave}>
        <AuthFormField
          label={t('patients.views.saveAs')}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={t('patients.views.namePlaceholder')}
        />
        {error && <AuthAlert variant="error">{error}</AuthAlert>}
        <AuthButton type="submit">{t('patients.views.saveCurrent')}</AuthButton>
      </form>

      {views.length === 0 ? (
        <p className={styles.empty}>{t('patients.views.empty')}</p>
      ) : (
        <ul className={styles.list}>
          {views.map((view) => (
            <li key={view.id} className={styles.row}>
              <div className={styles.rowMain}>
                <span className={styles.name}>{view.name}</span>
                <span className={styles.meta}>{describeView(view)}</span>
              </div>
              <div className={styles.rowActions}>
                <AuthButton variant="secondary" onClick={() => onApply(view)}>
                  {t('patients.views.apply')}
                </AuthButton>
                <AuthButton variant="ghost" onClick={() => removeView(view.id)}>
                  {t('patients.views.delete')}
                </AuthButton>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
