import { Clock, GitBranch, Paperclip, User } from 'lucide-react';
import { useI18n } from '@booking/i18n/react';
import { AuthButton } from '@/features/auth/components/AuthButton';
import { AuthFormField } from '@/features/auth/components/AuthFormField';
import type { WorkflowApprovalSummary } from '../../api/workflow-api';
import { WorkflowStatusBadge } from '../WorkflowStatusBadge';
import e from '../../workflow-enterprise.module.css';

type RowDraft = { comment: string; reason: string };

interface WorkflowApprovalInboxProps {
  items: WorkflowApprovalSummary[];
  locale: string;
  canApprove: boolean;
  drafts: Record<string, RowDraft>;
  onDraftChange: (id: string, patch: Partial<RowDraft>) => void;
  onApprove: (approvalId: string, comment?: string) => void;
  onReject: (approvalId: string, reason: string) => void;
  approveLoading: boolean;
  rejectLoading: boolean;
}

export function WorkflowApprovalInbox({
  items,
  locale,
  canApprove,
  drafts,
  onDraftChange,
  onApprove,
  onReject,
  approveLoading,
  rejectLoading,
}: WorkflowApprovalInboxProps) {
  const { t } = useI18n();

  return (
    <div className={e.approvalInbox}>
      {items.map((row) => {
        const draft = drafts[row.approvalId] ?? { comment: '', reason: '' };
        return (
          <article key={row.approvalId} className={e.approvalCard}>
            <div className={e.approvalCardHeader}>
              <div>
                <h3 className={e.approvalCardTitle}>{row.title}</h3>
                <div className={e.approvalMeta}>
                  <span className={e.approvalMetaItem}>
                    <User size={14} aria-hidden />
                    {row.requestedBy.slice(0, 8)}…
                  </span>
                  {row.workflowId && (
                    <span className={e.approvalMetaItem}>
                      <GitBranch size={14} aria-hidden />
                      {row.workflowId.slice(0, 8)}…
                    </span>
                  )}
                  <span className={e.approvalMetaItem}>
                    <Clock size={14} aria-hidden />
                    {row.dueAt ? new Date(row.dueAt).toLocaleString(locale) : t('workflow.enterprise.noDue')}
                  </span>
                </div>
              </div>
              <WorkflowStatusBadge status={row.status} />
            </div>

            <div className={e.approvalMeta}>
              <span>{t('workflow.table.mode')}: {row.mode}</span>
              <span>{t('workflow.table.priority')}: {row.mode}</span>
              <span>{t('workflow.enterprise.received')}: {new Date(row.createdAt).toLocaleString(locale)}</span>
            </div>

            <div className={e.approvalMeta}>
              <span className={e.approvalMetaItem}>
                <Paperclip size={14} aria-hidden />
                {t('workflow.enterprise.noAttachments')}
              </span>
            </div>

            <p className={e.approvalHistory}>
              {t('workflow.enterprise.approvalHistory')}: {row.status} · {new Date(row.createdAt).toLocaleString(locale)}
            </p>

            {canApprove && (
              <>
                <div className={e.approvalFields}>
                  <AuthFormField label={t('workflow.approvals.comment')} id={`comment-${row.approvalId}`}>
                    <input
                      id={`comment-${row.approvalId}`}
                      className={e.input}
                      value={draft.comment}
                      onChange={(ev) => onDraftChange(row.approvalId, { comment: ev.target.value })}
                      placeholder={t('workflow.enterprise.approvalCommentHint')}
                    />
                  </AuthFormField>
                  <AuthFormField label={t('workflow.approvals.rejectionReason')} id={`reason-${row.approvalId}`}>
                    <input
                      id={`reason-${row.approvalId}`}
                      className={e.input}
                      value={draft.reason}
                      onChange={(ev) => onDraftChange(row.approvalId, { reason: ev.target.value })}
                      placeholder={t('workflow.enterprise.rejectionHint')}
                    />
                  </AuthFormField>
                </div>
                <div className={e.approvalActions}>
                  <AuthButton loading={approveLoading} onClick={() => onApprove(row.approvalId, draft.comment.trim() || undefined)}>
                    {t('workflow.approvals.approve')}
                  </AuthButton>
                  <AuthButton
                    variant="secondary"
                    loading={rejectLoading}
                    onClick={() => {
                      if (!draft.reason.trim()) return;
                      onReject(row.approvalId, draft.reason.trim());
                    }}
                  >
                    {t('workflow.approvals.reject')}
                  </AuthButton>
                </div>
              </>
            )}
          </article>
        );
      })}
    </div>
  );
}
