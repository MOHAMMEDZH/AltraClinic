import { useState } from 'react';
import { Plus } from 'lucide-react';
import { hasPermission } from '@booking/permissions';
import { useI18n } from '@booking/i18n/react';
import { useAuth } from '@/app/providers/AuthProvider';
import { AuthButton } from '@/features/auth/components/AuthButton';
import { AuthAlert } from '@/features/auth/components/AuthAlert';
import { migratePlan } from '../config/beauty-form-utils';
import {
  buildPlanLineItems,
  mapBillingApiError,
  validatePlanForBilling,
} from '../config/billing-utils';
import type { BeautyBodyMapState, BeautyTreatmentPlan } from '../types/beauty.types';
import { useCanCreateBillingInvoice, useCreatePlanInvoice } from '../hooks/useBilling';
import { useApproveBeautyPlan } from '../hooks/useBeautyExtended';
import { TreatmentPlanBuilder, createSessionsFromPlan } from './TreatmentPlanBuilder';
import { TreatmentPlansPanel } from './TreatmentPlansPanel';
import styles from './PlansWorkspace.module.css';

interface PlansWorkspaceProps {
  patientId: string;
  state: BeautyBodyMapState;
  clinicianId: string;
  locale: string;
  readOnly?: boolean;
  onPatch: (updater: (prev: BeautyBodyMapState) => BeautyBodyMapState) => void;
  onPersist?: () => Promise<void>;
}

export function PlansWorkspace({ patientId, state, clinicianId, locale, readOnly, onPatch, onPersist }: PlansWorkspaceProps) {
  const { t } = useI18n();
  const { user } = useAuth();
  const roles = user?.roles ?? [];
  const canApprove = hasPermission(roles, 'api.beauty', 'approve' as never);
  const approveMutation = useApproveBeautyPlan(patientId);
  const [building, setBuilding] = useState(false);
  const [editing, setEditing] = useState<BeautyTreatmentPlan | null>(null);
  const [billingErrorKey, setBillingErrorKey] = useState<string | null>(null);
  const [billingSuccess, setBillingSuccess] = useState<string | null>(null);
  const canCreateInvoice = useCanCreateBillingInvoice();
  const invoiceMutation = useCreatePlanInvoice(patientId);

  function savePlan(plan: BeautyTreatmentPlan) {
    onPatch((prev) => {
      const migrated = migratePlan(plan);
      const exists = prev.treatmentPlans.some((p) => p.id === migrated.id);
      const treatmentPlans = exists
        ? prev.treatmentPlans.map((p) => (p.id === migrated.id ? migrated : p))
        : [migrated, ...prev.treatmentPlans];
      let sessions = prev.sessions;
      if (!exists && migrated.status === 'approved') {
        sessions = [...createSessionsFromPlan(migrated, clinicianId), ...sessions];
      }
      return { ...prev, treatmentPlans, sessions };
    });
    setBuilding(false);
    setEditing(null);
  }

  async function handleApprove(plan: BeautyTreatmentPlan) {
    const migrated = migratePlan(plan);
    if (canApprove) {
      await approveMutation.mutateAsync(migrated.id);
      setBuilding(false);
      setEditing(null);
      return;
    }
    savePlan({ ...migrated, status: 'approved', approvedAt: new Date().toISOString(), approvedBy: clinicianId });
  }

  async function createInvoice(plan: BeautyTreatmentPlan) {
    setBillingErrorKey(null);
    setBillingSuccess(null);

    const validationError = validatePlanForBilling(plan);
    if (validationError) {
      setBillingErrorKey(validationError);
      return;
    }
    if (!canCreateInvoice) {
      setBillingErrorKey('noPermission');
      return;
    }

    try {
      const migrated = migratePlan(plan);
      const result = await invoiceMutation.mutateAsync({
        planId: migrated.id,
        planTitle: migrated.title,
        lineItems: buildPlanLineItems(migrated),
      });
      onPatch((prev) => ({
        ...prev,
        treatmentPlans: prev.treatmentPlans.map((p) =>
          p.id === plan.id
            ? { ...p, invoiceId: result.invoiceId, invoiceNumber: result.invoiceNumber, status: 'active' }
            : p,
        ),
      }));
      await onPersist?.();
      setBillingSuccess(result.invoiceNumber);
    } catch (err) {
      setBillingErrorKey(mapBillingApiError(err));
    }
  }

  return (
    <div className={styles.wrap}>
      {!readOnly && !building && !editing && (
        <AuthButton variant="secondary" onClick={() => setBuilding(true)}>
          <Plus size={16} aria-hidden />
          {t('beauty.plans.add')}
        </AuthButton>
      )}

      {billingErrorKey && (
        <AuthAlert variant="error">
          {t(`beauty.billing.errors.${billingErrorKey}` as 'beauty.billing.errors.createFailed')}
        </AuthAlert>
      )}
      {billingSuccess && (
        <AuthAlert variant="success">
          {t('beauty.billing.invoiceCreated').replace('{number}', billingSuccess)}
        </AuthAlert>
      )}

      {(building || editing) && (
        <div className={styles.panel}>
          <TreatmentPlanBuilder
            initial={editing ?? undefined}
            locale={locale}
            onSave={savePlan}
            onApprove={(p) => void handleApprove(p)}
            onCreateInvoice={(p) => void createInvoice(p)}
            invoicePending={invoiceMutation.isPending}
            canCreateInvoice={canCreateInvoice}
            onCancel={() => {
              setBuilding(false);
              setEditing(null);
            }}
          />
        </div>
      )}

      <TreatmentPlansPanel
        plans={state.treatmentPlans}
        onEdit={readOnly ? undefined : (p) => setEditing(migratePlan(p))}
      />
    </div>
  );
}
