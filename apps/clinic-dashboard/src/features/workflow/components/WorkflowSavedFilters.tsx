import { useState } from 'react';
import { useI18n } from '@booking/i18n/react';
import { AuthButton } from '@/features/auth/components/AuthButton';
import { AuthFormField } from '@/features/auth/components/AuthFormField';
import {
  useDeleteWorkflowSavedFilter,
  useSaveWorkflowFilter,
  useWorkflowSavedFilters,
} from '../hooks/useWorkflows';
import e from '../workflow-enterprise.module.css';

interface WorkflowSavedFiltersProps {
  scope: string;
  currentFilters: Record<string, unknown>;
  onLoad: (filters: Record<string, unknown>) => void;
  enabled?: boolean;
}

export function WorkflowSavedFilters({ scope, currentFilters, onLoad, enabled = true }: WorkflowSavedFiltersProps) {
  const { t } = useI18n();
  const filtersQuery = useWorkflowSavedFilters(scope, enabled);
  const saveMutation = useSaveWorkflowFilter();
  const deleteMutation = useDeleteWorkflowSavedFilter();
  const [filterName, setFilterName] = useState('');

  const saved = filtersQuery.data ?? [];

  const handleSave = async () => {
    if (!filterName.trim()) return;
    await saveMutation.mutateAsync({ name: filterName.trim(), filters: currentFilters, scope });
    setFilterName('');
  };

  return (
    <div className={e.savedFilters}>
      <AuthFormField label={t('workflow.filters.saveFilter')} id={`save-filter-${scope}`}>
        <input
          id={`save-filter-${scope}`}
          className={e.input}
          value={filterName}
          onChange={(ev) => setFilterName(ev.target.value)}
          placeholder={t('workflow.filters.filterName')}
        />
      </AuthFormField>
      <AuthButton variant="secondary" loading={saveMutation.isPending} onClick={() => void handleSave()}>
        {t('workflow.filters.save')}
      </AuthButton>
      {saved.map((sf) => (
        <span key={sf.id} className={e.savedFilterChip}>
          <AuthButton variant="secondary" onClick={() => onLoad(sf.filters as Record<string, unknown>)}>
            {sf.name.replace(`${scope}:`, '')}
          </AuthButton>
          <AuthButton
            variant="secondary"
            loading={deleteMutation.isPending}
            onClick={() => void deleteMutation.mutateAsync(sf.id)}
          >
            {t('workflow.filters.delete')}
          </AuthButton>
        </span>
      ))}
    </div>
  );
}
