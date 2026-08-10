import { formatMessage } from '@/i18n/messages';
import { useState } from 'react';
import { useI18n } from '@booking/i18n/react';
import { AuthButton } from '@/features/auth/components/AuthButton';
import { AuthFormField } from '@/features/auth/components/AuthFormField';
import { formatEncounterDate } from '../config/emr-config';
import {
  useCreateTreatmentPlan,
  useTreatmentPlans,
  useUpdateTreatmentPlanItemStatus,
} from '../hooks/useEmr';
import styles from './TreatmentPlanPanel.module.css';

interface TreatmentPlanPanelProps {
  patientId: string;
  canEdit?: boolean;
}

export function TreatmentPlanPanel({ patientId, canEdit }: TreatmentPlanPanelProps) {
  const { t, locale } = useI18n();
  const query = useTreatmentPlans(patientId);
  const createMutation = useCreateTreatmentPlan(patientId);
  const statusMutation = useUpdateTreatmentPlanItemStatus(patientId);

  const [title, setTitle] = useState('');
  const [itemCode, setItemCode] = useState('');
  const [itemDesc, setItemDesc] = useState('');

  async function handleCreate() {
    if (!title.trim()) return;
    await createMutation.mutateAsync({
      title: title.trim(),
      items: itemCode.trim() && itemDesc.trim()
        ? [{ code: itemCode.trim(), description: itemDesc.trim() }]
        : [],
    });
    setTitle('');
    setItemCode('');
    setItemDesc('');
  }

  const plans = query.data ?? [];

  if (query.isLoading) {
    return <p className={styles.muted}>{t('emr.audit.loading')}</p>;
  }

  return (
    <section className={styles.panel} aria-label={t('emr.carePlan.title')}>
      {canEdit && (
        <div className={styles.form}>
          <h3 className={styles.formTitle}>{t('emr.carePlan.create')}</h3>
          <AuthFormField id="plan-title" label={t('emr.carePlan.planTitle')} value={title} onChange={(e) => setTitle(e.target.value)} />
          <div className={styles.row}>
            <AuthFormField id="item-code" label={t('emr.detail.code')} value={itemCode} onChange={(e) => setItemCode(e.target.value)} />
            <AuthFormField id="item-desc" label={t('emr.detail.description')} value={itemDesc} onChange={(e) => setItemDesc(e.target.value)} />
          </div>
          <AuthButton loading={createMutation.isPending} onClick={() => void handleCreate()}>
            {t('emr.carePlan.save')}
          </AuthButton>
        </div>
      )}

      {plans.length === 0 ? (
        <p className={styles.muted}>{t('emr.carePlan.empty')}</p>
      ) : (
        plans.map((plan) => (
          <article key={plan.id} className={styles.plan}>
            <header className={styles.header}>
              <h3 className={styles.title}>{plan.title}</h3>
              <span className={styles.badge}>{plan.status}</span>
            </header>
            <p className={styles.progress}>
              {formatMessage(t('emr.carePlan.progress'), { completed: plan.completedItems, total: plan.totalItems })}
            </p>
            {plan.phases.map((phase) => (
              <div key={phase.id} className={styles.phase}>
                <ul className={styles.items}>
                  {phase.items.map((item) => (
                    <li key={item.id} className={styles.item}>
                      <span className={styles.itemCode}>{item.code}</span>
                      <span>{item.description}</span>
                      <span className={styles.itemStatus}>{item.status}</span>
                      {canEdit && item.status !== 'completed' && (
                        <AuthButton
                          variant="ghost"
                          loading={statusMutation.isPending}
                          onClick={() =>
                            void statusMutation.mutateAsync({
                              planId: plan.id,
                              itemId: item.id,
                              status: 'completed',
                            })
                          }
                        >
                          {t('emr.carePlan.completeItem')}
                        </AuthButton>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
            <p className={styles.updated}>
              {t('emr.detail.lastUpdated')}: {formatEncounterDate(plan.updatedAt, locale)}
            </p>
          </article>
        ))
      )}
    </section>
  );
}
