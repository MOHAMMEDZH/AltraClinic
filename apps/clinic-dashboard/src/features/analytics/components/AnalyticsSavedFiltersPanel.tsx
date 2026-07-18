import { useState } from 'react';
import { Bookmark } from 'lucide-react';
import { useI18n } from '@booking/i18n/react';
import { AuthButton } from '@/features/auth/components/AuthButton';
import { Modal } from '@/features/patients/components/Modal';
import { useAnalyticsFilterPresets } from '../hooks/useAnalyticsAlerts';
import type { useAnalyticsFilters } from '../hooks/useAnalyticsFilters';
import styles from '../analytics-layout.module.css';

type FiltersState = ReturnType<typeof useAnalyticsFilters>;

interface AnalyticsSavedFiltersPanelProps {
  filters: FiltersState;
}

export function AnalyticsSavedFiltersPanel({ filters }: AnalyticsSavedFiltersPanelProps) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const { data: presets = [], createPreset, deletePreset } = useAnalyticsFilterPresets(open);

  function snapshotFilters() {
    return {
      range: filters.range,
      customRange: filters.customRange,
      branchId: filters.selectedBranchId,
    };
  }

  function applyPreset(raw: Record<string, unknown>) {
    if (raw.range) filters.setRange(raw.range as FiltersState['range']);
    if (raw.customRange) filters.setCustomRange(raw.customRange as FiltersState['customRange']);
    if (raw.branchId === null || typeof raw.branchId === 'string') {
      filters.setSelectedBranchId(raw.branchId as string | null);
    }
    setOpen(false);
  }

  return (
    <>
      <button type="button" className={styles.toolBtn} onClick={() => setOpen(true)}>
        <Bookmark size={16} aria-hidden />
        {t('analytics.filters.saved')}
      </button>

      <Modal
        open={open}
        title={t('analytics.filters.savedTitle')}
        onClose={() => setOpen(false)}
        closeLabel={t('analytics.filters.close')}
        footer={
          <AuthButton variant="secondary" onClick={() => setOpen(false)}>
            {t('analytics.filters.close')}
          </AuthButton>
        }
      >
        <div className={styles.panel} style={{ padding: 0, border: 'none', boxShadow: 'none' }}>
          <label className={styles.kpiHint}>
            {t('analytics.filters.name')}
            <input
              className={styles.chip}
              style={{ width: '100%', marginTop: 'var(--space-2)' }}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </label>
          <AuthButton
            loading={createPreset.isPending}
            onClick={() => {
              if (!name.trim()) return;
              void createPreset.mutateAsync({ name: name.trim(), filters: snapshotFilters() }).then(() => {
                setName('');
              });
            }}
          >
            {t('analytics.filters.save')}
          </AuthButton>

          {presets.length === 0 ? (
            <p className={styles.empty}>{t('analytics.filters.empty')}</p>
          ) : (
            <ul className={styles.list}>
              {presets.map((preset) => (
                <li key={preset.id} className={styles.listItem}>
                  <button type="button" onClick={() => applyPreset(preset.filters)}>
                    {preset.name}
                  </button>
                  <button
                    type="button"
                    className={styles.reportDownloadBtn}
                    onClick={() => void deletePreset.mutateAsync(preset.id)}
                  >
                    {t('analytics.filters.delete')}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </Modal>
    </>
  );
}
