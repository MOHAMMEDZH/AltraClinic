import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useI18n } from '@booking/i18n/react';
import { useAuth } from '@/app/providers/AuthProvider';
import { pickLocalizedName } from '@/features/dashboard/lib/dashboard-format';
import { AuthAlert } from '@/features/auth/components/AuthAlert';
import { AuthButton } from '@/features/auth/components/AuthButton';
import { AuthFormField } from '@/features/auth/components/AuthFormField';
import { buildWorkflowPermCheck, canViewWorkflows, canManageWorkflows, canUpdateWorkflows } from './config/workflow-config';
import { useAdvanceWorkflow, useCancelWorkflow, useRetryWorkflow, useWorkflow } from './hooks/useWorkflows';
import { WorkflowStatusBadge } from './components/WorkflowStatusBadge';
import { WorkflowPageHeader } from './components/enterprise/WorkflowPageHeader';
import { WorkflowPipelineDiagram } from './components/enterprise/WorkflowPipelineDiagram';
import { WorkflowSection } from './components/enterprise/WorkflowSection';
import e from './workflow-enterprise.module.css';

export function WorkflowDetailPage() {
  const { workflowId = '' } = useParams();
  const { t, locale } = useI18n();
  const { user } = useAuth();
  const [comment, setComment] = useState('');
  const [reason, setReason] = useState('');
  const perm = useMemo(() => buildWorkflowPermCheck(user?.roles ?? []), [user?.roles]);
  const detailQuery = useWorkflow(workflowId, canViewWorkflows(perm));
  const advanceMutation = useAdvanceWorkflow();
  const cancelMutation = useCancelWorkflow();
  const retryMutation = useRetryWorkflow();

  if (!canViewWorkflows(perm)) {
    return <AuthAlert variant="error">{t('workflow.accessDenied')}</AuthAlert>;
  }

  const wf = detailQuery.data;
  if (detailQuery.isLoading) return <p className={e.pageSubtitle}>…</p>;
  if (!wf) return <AuthAlert variant="error">{t('workflow.notFound')}</AuthAlert>;

  const canAct = wf.status === 'active' && canUpdateWorkflows(perm);
  const canRetry = wf.status === 'failed' && canManageWorkflows(perm);
  const progressPct = wf.steps.length > 0 ? Math.round(((wf.currentStepIndex + 1) / wf.steps.length) * 100) : 0;

  return (
    <>
      <WorkflowPageHeader
        title={pickLocalizedName(locale, wf.nameEn, wf.nameAr)}
        breadcrumbs={[
          { label: t('workflow.nav.instances'), to: '/workflows/instances' },
          { label: pickLocalizedName(locale, wf.nameEn, wf.nameAr) },
        ]}
        actions={<WorkflowStatusBadge status={wf.status} />}
      />

      <WorkflowSection title={t('workflow.detail.steps')} hint={`${progressPct}% · ${t('workflow.table.progress')}`}>
        <WorkflowPipelineDiagram steps={wf.steps} currentStepIndex={wf.currentStepIndex} status={wf.status} />
        <div className={e.progressTrack} style={{ marginTop: 'var(--space-4)' }} aria-hidden>
          <div className={e.progressFill} style={{ width: `${progressPct}%` }} />
        </div>
      </WorkflowSection>

      {(canRetry || canAct) && (
        <WorkflowSection title={t('workflow.table.actions')}>
          <div className={e.detailActions}>
            {canRetry && (
              <AuthButton loading={retryMutation.isPending} onClick={() => void retryMutation.mutateAsync(workflowId)}>
                {t('workflow.detail.retry')}
              </AuthButton>
            )}
            {canAct && (
              <>
                <AuthFormField label={t('workflow.detail.comment')} id="wf-comment">
                  <input id="wf-comment" className={e.input} value={comment} onChange={(ev) => setComment(ev.target.value)} />
                </AuthFormField>
                <AuthButton
                  loading={advanceMutation.isPending}
                  onClick={() => void advanceMutation.mutateAsync({ workflowId, comment: comment.trim() || undefined })}
                >
                  {t('workflow.detail.advance')}
                </AuthButton>
                <AuthFormField label={t('workflow.detail.cancelReason')} id="wf-reason">
                  <input id="wf-reason" className={e.input} value={reason} onChange={(ev) => setReason(ev.target.value)} />
                </AuthFormField>
                <AuthButton
                  variant="secondary"
                  loading={cancelMutation.isPending}
                  onClick={() => void cancelMutation.mutateAsync({ workflowId, reason: reason.trim() || undefined })}
                >
                  {t('workflow.detail.cancel')}
                </AuthButton>
              </>
            )}
          </div>
        </WorkflowSection>
      )}

      <p className={e.pageSubtitle}>
        <Link to="/workflows/instances">← {t('workflow.backToInstances')}</Link>
      </p>
    </>
  );
}
