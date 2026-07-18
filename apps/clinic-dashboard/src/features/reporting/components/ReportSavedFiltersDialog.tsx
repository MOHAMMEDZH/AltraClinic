import { useState } from 'react';
import { useI18n } from '@booking/i18n/react';
import { Modal } from '@/features/patients/components/Modal';
import { AuthButton } from '@/features/auth/components/AuthButton';
import {
  useDeleteReportFilterPreset,
  useReportFilterPresets,
  useSaveReportFilterPreset,
} from '../hooks/useReporting';
import type { ReportFilterState } from './ReportAdvancedFilters';
import { defaultReportFilterState } from './ReportAdvancedFilters';
import styles from '../reporting-layout.module.css';

interface ReportSavedFiltersDialogProps {
  open: boolean;
  currentFilters: ReportFilterState;
  onApply: (filters: ReportFilterState) => void;
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

function filtersToRecord(filters: ReportFilterState): Record<string, unknown> {
  return { ...filters };
}

export function ReportSavedFiltersDialog({
  open,
  currentFilters,
  onApply,
  onClose,
}: ReportSavedFiltersDialogProps) {
  const { t } = useI18n();
  const presetsQuery = useReportFilterPresets(open);
  const saveMutation = useSaveReportFilterPreset();
  const deleteMutation = useDeleteReportFilterPreset();
  const [name, setName] = useState('');

  function handleSave() {
    if (!name.trim()) return;
    void saveMutation.mutateAsync({
      name: name.trim(),
      filters: filtersToRecord(currentFilters),
    }).then(() => setName(''));
  }

  return (
    <Modal
      open={open}
      title={t('reports.savedFilters.title')}
      onClose={onClose}
      closeLabel={t('reports.savedFilters.close')}
      footer={
        <div className={styles.dialogActions}>
          <AuthButton variant="secondary" onClick={onClose}>{t('reports.savedFilters.close')}</AuthButton>
        </div>
      }
    >
      <div className={styles.formGrid}>
        <label>
          {t('reports.savedFilters.name')}
          <input value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        <AuthButton loading={saveMutation.isPending} onClick={handleSave}>
          {t('reports.savedFilters.save')}
        </AuthButton>
      </div>

      {presetsQuery.isLoading ? (
        <p className={styles.hint} aria-busy="true">{t('reports.savedFilters.loading')}</p>
      ) : (presetsQuery.data ?? []).length === 0 ? (
        <p className={styles.empty}>{t('reports.savedFilters.empty')}</p>
      ) : (
        <ul className={styles.list}>
          {(presetsQuery.data ?? []).map((preset) => (
            <li key={preset.id} className={styles.listItem}>
              <button
                type="button"
                className={styles.cardButton}
                onClick={() => {
                  onApply(filtersFromRecord(preset.filters));
                  onClose();
                }}
              >
                {preset.name}
              </button>
              <AuthButton
                variant="secondary"
                loading={deleteMutation.isPending}
                onClick={() => void deleteMutation.mutateAsync(preset.id)}
              >
                {t('reports.savedFilters.delete')}
              </AuthButton>
            </li>
          ))}
        </ul>
      )}
    </Modal>
  );
}
