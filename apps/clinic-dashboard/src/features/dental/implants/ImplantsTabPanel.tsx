import { useState } from 'react';
import { Plus } from 'lucide-react';
import { useI18n } from '@booking/i18n/react';
import { AuthButton } from '@/features/auth/components/AuthButton';
import { AuthAlert } from '@/features/auth/components/AuthAlert';
import { EmptyState } from '@/features/patients/components/EmptyState';
import { formatDentalDate } from '../config/dental-config';
import { useCreateImplantRecord, useImplantRecords, useUpdateImplantRecord } from '../hooks/useDentalExtended';
import styles from './ImplantsTabPanel.module.css';

interface ImplantsTabPanelProps {
  patientId: string;
  canEdit: boolean;
  defaultToothId?: string;
}

export function ImplantsTabPanel({ patientId, canEdit, defaultToothId }: ImplantsTabPanelProps) {
  const { t, locale } = useI18n();
  const implantsQuery = useImplantRecords(patientId);
  const createMutation = useCreateImplantRecord();
  const updateMutation = useUpdateImplantRecord(patientId);
  const [toothId, setToothId] = useState(defaultToothId ?? '11');
  const [system, setSystem] = useState('');
  const [error, setError] = useState<string | null>(null);

  const items = implantsQuery.data?.items ?? [];

  async function handleCreate() {
    setError(null);
    try {
      await createMutation.mutateAsync({
        patientId,
        toothId,
        implantSystem: system || null,
        status: 'planned',
      });
      setSystem('');
    } catch {
      setError(t('dental.implants.errors.create'));
    }
  }

  return (
    <div className={styles.wrap}>
      <header className={styles.header}>
        <div>
          <h2 className={styles.title}>{t('dental.implants.title')}</h2>
          <p className={styles.subtitle}>{t('dental.implants.subtitle')}</p>
        </div>
        {canEdit && (
          <div className={styles.createRow}>
            <input
              aria-label={t('dental.implants.toothFdi')}
              value={toothId}
              onChange={(e) => setToothId(e.target.value)}
              placeholder="11"
              className={styles.input}
            />
            <input
              aria-label={t('dental.implants.system')}
              value={system}
              onChange={(e) => setSystem(e.target.value)}
              placeholder={t('dental.implants.systemPlaceholder')}
              className={styles.input}
            />
            <AuthButton loading={createMutation.isPending} onClick={() => void handleCreate()}>
              <Plus size={16} aria-hidden />
              {t('dental.implants.add')}
            </AuthButton>
          </div>
        )}
      </header>

      {error && <AuthAlert variant="error">{error}</AuthAlert>}

      {implantsQuery.isLoading ? (
        <div className={styles.skeleton} aria-busy="true" />
      ) : !items.length ? (
        <EmptyState title={t('dental.implants.empty.title')} description={t('dental.implants.empty.description')} />
      ) : (
        <table className={styles.table}>
          <caption className={styles.srOnly}>{t('dental.implants.tableCaption')}</caption>
          <thead>
            <tr>
              <th scope="col">{t('dental.implants.toothFdi')}</th>
              <th scope="col">{t('dental.implants.system')}</th>
              <th scope="col">{t('dental.implants.statusLabel')}</th>
              <th scope="col">{t('dental.implants.updated')}</th>
              {canEdit && <th scope="col">{t('dental.implants.actions')}</th>}
            </tr>
          </thead>
          <tbody>
            {items.map((row) => (
              <tr key={row.id}>
                <td>{row.toothId}</td>
                <td>{row.implantSystem ?? '—'}</td>
                <td>{t(`dental.implants.status.${row.status}`)}</td>
                <td>{formatDentalDate(row.updatedAt, locale)}</td>
                {canEdit && row.status === 'planned' && (
                  <td>
                    <AuthButton
                      variant="secondary"
                      loading={updateMutation.isPending}
                      onClick={() =>
                        void updateMutation.mutateAsync({
                          implantId: row.id,
                          body: { status: 'placed', placedAt: new Date().toISOString() },
                        })
                      }
                    >
                      {t('dental.implants.markPlaced')}
                    </AuthButton>
                  </td>
                )}
                {canEdit && row.status !== 'planned' && <td>—</td>}
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
