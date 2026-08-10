import { useState } from 'react';
import { useI18n } from '@booking/i18n/react';
import { Modal } from '@/features/patients/components/Modal';
import { AuthButton } from '@/features/auth/components/AuthButton';
import {
  useDeleteReportCustomDefinition,
  useReportCustomDefinitions,
  useSaveReportCustomDefinition,
} from '../hooks/useReporting';
import type { ReportCustomDefinitionRecord } from '../api/reporting-api';
import type { ReportFilterState } from './ReportAdvancedFilters';
import { defaultReportFilterState } from './ReportAdvancedFilters';
import styles from '../reporting-layout.module.css';

export interface BuilderDefinitionState {
  name: string;
  reportType: string;
  format: string;
  visualization: string;
  dataset: string;
  dimensions: string[];
  measures: string[];
  filters: ReportFilterState;
  isScheduled: boolean;
  scheduleFrequency: 'daily' | 'weekly' | 'monthly' | null;
  recipientEmails: string[];
}

interface ReportSavedDefinitionDialogProps {
  open: boolean;
  current: BuilderDefinitionState;
  onApply: (definition: BuilderDefinitionState) => void;
  onClose: () => void;
}

function filtersFromRecord(raw: Record<string, unknown>): ReportFilterState {
  const base = defaultReportFilterState();
  return {
    range: (raw.range as ReportFilterState['range']) ?? base.range,
    customRange: (raw.customRange as ReportFilterState['customRange']) ?? base.customRange,
    branchId: raw.branchId != null ? String(raw.branchId) : null,
    doctorId: raw.doctorId != null ? String(raw.doctorId) : '',
    departmentId: raw.departmentId != null ? String(raw.departmentId) : '',
    status: raw.status != null ? String(raw.status) : '',
    paymentMethod: raw.paymentMethod != null ? String(raw.paymentMethod) : '',
  };
}

function definitionToState(record: ReportCustomDefinitionRecord): BuilderDefinitionState {
  return {
    name: record.name,
    reportType: record.reportType,
    format: record.format,
    visualization: record.visualization,
    dataset: record.dataset,
    dimensions: record.dimensions,
    measures: record.measures,
    filters: filtersFromRecord(record.filters),
    isScheduled: record.isScheduled,
    scheduleFrequency:
      record.scheduleFrequency === 'daily' ||
      record.scheduleFrequency === 'weekly' ||
      record.scheduleFrequency === 'monthly'
        ? record.scheduleFrequency
        : null,
    recipientEmails: record.recipientEmails,
  };
}

export function ReportSavedDefinitionDialog({
  open,
  current,
  onApply,
  onClose,
}: ReportSavedDefinitionDialogProps) {
  const { t } = useI18n();
  const definitionsQuery = useReportCustomDefinitions(open);
  const saveMutation = useSaveReportCustomDefinition();
  const deleteMutation = useDeleteReportCustomDefinition();
  const [name, setName] = useState('');

  function handleSave() {
    const saveName = name.trim() || current.name.trim();
    if (!saveName) return;
    void saveMutation.mutateAsync({
      name: saveName,
      reportType: current.reportType,
      format: current.format,
      visualization: current.visualization,
      dataset: current.dataset,
      dimensions: current.dimensions,
      measures: current.measures,
      filters: { ...current.filters } as Record<string, unknown>,
      isScheduled: current.isScheduled,
      scheduleFrequency: current.scheduleFrequency,
      recipientEmails: current.recipientEmails,
    } as Omit<ReportCustomDefinitionRecord, 'createdAt' | 'updatedAt'> & { id?: string }).then(() => setName(''));
  }

  return (
    <Modal
      open={open}
      title={t('reports.savedDefinitions.title')}
      onClose={onClose}
      closeLabel={t('reports.savedDefinitions.close')}
      footer={
        <div className={styles.dialogActions}>
          <AuthButton variant="secondary" onClick={onClose}>{t('reports.savedDefinitions.close')}</AuthButton>
        </div>
      }
    >
      <div className={styles.formGrid}>
        <label>
          {t('reports.savedDefinitions.name')}
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder={current.name || t('reports.builder.defaultName')} />
        </label>
        <AuthButton loading={saveMutation.isPending} onClick={handleSave}>
          {t('reports.savedDefinitions.save')}
        </AuthButton>
      </div>

      {definitionsQuery.isLoading ? (
        <p className={styles.hint} aria-busy="true">{t('reports.savedDefinitions.loading')}</p>
      ) : (definitionsQuery.data ?? []).length === 0 ? (
        <p className={styles.empty}>{t('reports.savedDefinitions.empty')}</p>
      ) : (
        <ul className={styles.list}>
          {(definitionsQuery.data ?? []).map((definition) => (
            <li key={definition.id} className={styles.listItem}>
              <button
                type="button"
                className={styles.cardButton}
                onClick={() => {
                  onApply(definitionToState(definition));
                  onClose();
                }}
              >
                {definition.name}
              </button>
              <AuthButton
                variant="secondary"
                loading={deleteMutation.isPending}
                onClick={() => void deleteMutation.mutateAsync(definition.id)}
              >
                {t('reports.savedDefinitions.delete')}
              </AuthButton>
            </li>
          ))}
        </ul>
      )}
    </Modal>
  );
}
