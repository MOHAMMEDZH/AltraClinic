import { useState } from 'react';
import { useI18n } from '@booking/i18n/react';
import { AuthButton } from '@/features/auth/components/AuthButton';
import { AuthFormField } from '@/features/auth/components/AuthFormField';
import { formatServiceTypeLabel } from '../config/scheduling-config';
import {
  useAppointmentTemplates,
  useCreateAppointmentTemplate,
  useDeleteAppointmentTemplate,
} from '../hooks/useScheduling';
import type { AppointmentTemplate } from '../types/scheduling.types';
import styles from './AppointmentTemplatesPanel.module.css';

interface AppointmentTemplatesPanelProps {
  canCreate: boolean;
  canDelete: boolean;
  onApply: (template: AppointmentTemplate) => void;
}

export function AppointmentTemplatesPanel({
  canCreate,
  canDelete,
  onApply,
}: AppointmentTemplatesPanelProps) {
  const { t } = useI18n();
  const templatesQuery = useAppointmentTemplates();
  const createMutation = useCreateAppointmentTemplate();
  const deleteMutation = useDeleteAppointmentTemplate();
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('');

  const items = templatesQuery.data?.items ?? [];

  async function handleCreate() {
    if (!name.trim()) return;
    await createMutation.mutateAsync({ name: name.trim(), serviceType: 'consultation', durationMin: 30 });
    setName('');
    setShowForm(false);
  }

  return (
    <section className={styles.panel} aria-labelledby="scheduling-templates-heading">
      <div className={styles.header}>
        <h2 id="scheduling-templates-heading" className={styles.title}>
          {t('scheduling.templates.title')}
        </h2>
        {canCreate && (
          <AuthButton variant="secondary" onClick={() => setShowForm((v) => !v)}>
            {t('scheduling.templates.add')}
          </AuthButton>
        )}
      </div>

      {showForm && canCreate && (
        <div className={styles.form}>
          <AuthFormField
            id="template-name"
            label={t('scheduling.templates.name')}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <AuthButton loading={createMutation.isPending} onClick={() => void handleCreate()}>
            {t('scheduling.templates.save')}
          </AuthButton>
        </div>
      )}

      {items.length === 0 ? (
        <p className={styles.empty}>{t('scheduling.templates.empty')}</p>
      ) : (
        <ul className={styles.list}>
          {items.map((template) => (
            <li key={template.id} className={styles.item}>
              <div>
                <strong>{template.name}</strong>
                <span className={styles.meta}>
                  {formatServiceTypeLabel(template.serviceType, t)} · {template.durationMin} min
                </span>
              </div>
              <div className={styles.actions}>
                <AuthButton variant="secondary" onClick={() => onApply(template)}>
                  {t('scheduling.templates.apply')}
                </AuthButton>
                {canDelete && (
                  <AuthButton
                    variant="ghost"
                    loading={deleteMutation.isPending}
                    onClick={() => void deleteMutation.mutateAsync(template.id)}
                  >
                    {t('scheduling.templates.remove')}
                  </AuthButton>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
