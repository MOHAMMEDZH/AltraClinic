import { useMemo, useState } from 'react';
import { Inbox } from 'lucide-react';
import { useI18n } from '@booking/i18n/react';
import { useAuth } from '@/app/providers/AuthProvider';
import { AuthAlert } from '@/features/auth/components/AuthAlert';
import { buildWorkflowPermCheck, canApproveWorkflows, canViewWorkflows } from './config/workflow-config';import { WorkflowApprovalInbox } from './components/enterprise/WorkflowApprovalInbox';
import { WorkflowEmptyState } from './components/enterprise/WorkflowEmptyState';
import { WorkflowPageHeader } from './components/enterprise/WorkflowPageHeader';
import { WorkflowSection } from './components/enterprise/WorkflowSection';
import { useApproveWorkflow, useRejectWorkflow, useWorkflowApprovals } from './hooks/useWorkflows';
import e from './workflow-enterprise.module.css';

type RowDraft = { comment: string; reason: string };

export function WorkflowApprovalsPage() {
  const { t, locale } = useI18n();
  const { user } = useAuth();
  const [drafts, setDrafts] = useState<Record<string, RowDraft>>({});
  const perm = useMemo(() => buildWorkflowPermCheck(user?.roles ?? []), [user?.roles]);
  const approvalsQuery = useWorkflowApprovals('pending', canViewWorkflows(perm));
  const approveMutation = useApproveWorkflow();
  const rejectMutation = useRejectWorkflow();

  if (!canViewWorkflows(perm)) {
    return <AuthAlert variant="error">{t('workflow.accessDenied')}</AuthAlert>;
  }

  const items = approvalsQuery.data ?? [];
  const canApprove = canApproveWorkflows(perm);

  const getDraft = (id: string): RowDraft => drafts[id] ?? { comment: '', reason: '' };
  const setDraft = (id: string, patch: Partial<RowDraft>) => {
    setDrafts((prev) => ({ ...prev, [id]: { ...getDraft(id), ...patch } }));
  };

  return (
    <>
      <WorkflowPageHeader
        title={t('workflow.nav.approvals')}
        subtitle={t('workflow.approvals.inboxHint')}
        actions={
          <span className={e.livePill}>
            {items.length} {t('workflow.kpi.pendingApprovals').toLowerCase()}
          </span>
        }
      />

      <WorkflowSection title={t('workflow.enterprise.approvalInbox')} hint={t('workflow.approvals.inboxHint')}>
        {approvalsQuery.isLoading ? (
          <p className={e.pageSubtitle}>…</p>
        ) : items.length === 0 ? (
          <WorkflowEmptyState icon={Inbox} title={t('workflow.approvals.empty')} />
        ) : (
          <WorkflowApprovalInbox
            items={items}
            locale={locale}
            canApprove={canApprove}
            drafts={drafts}
            onDraftChange={setDraft}
            onApprove={(id, comment) => void approveMutation.mutateAsync({ approvalId: id, comment })}
            onReject={(id, reason) => void rejectMutation.mutateAsync({ approvalId: id, reason })}
            approveLoading={approveMutation.isPending}
            rejectLoading={rejectMutation.isPending}
          />
        )}
      </WorkflowSection>
    </>
  );
}
