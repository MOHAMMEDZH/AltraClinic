import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { FileStack } from 'lucide-react';
import { useI18n } from '@booking/i18n/react';
import { useAuth } from '@/app/providers/AuthProvider';
import { pickLocalizedName } from '@/features/dashboard/lib/dashboard-format';
import { AuthAlert } from '@/features/auth/components/AuthAlert';
import { AuthButton } from '@/features/auth/components/AuthButton';
import { buildWorkflowPermCheck, canManageWorkflows, canViewWorkflows } from './config/workflow-config';
import { usePublishTemplate, useStartFromTemplate, useWorkflowTemplates } from './hooks/useWorkflows';
import { WorkflowStatusBadge } from './components/WorkflowStatusBadge';
import { WorkflowPageHeader } from './components/enterprise/WorkflowPageHeader';
import { WorkflowSection } from './components/enterprise/WorkflowSection';
import { WorkflowEmptyState } from './components/enterprise/WorkflowEmptyState';
import e from './workflow-enterprise.module.css';

export function WorkflowTemplatesPage() {
  const { t, locale } = useI18n();
  const navigate = useNavigate();
  const { user } = useAuth();
  const perm = useMemo(() => buildWorkflowPermCheck(user?.roles ?? []), [user?.roles]);
  const templatesQuery = useWorkflowTemplates(undefined, canViewWorkflows(perm));
  const publishMutation = usePublishTemplate();
  const startMutation = useStartFromTemplate();

  if (!canViewWorkflows(perm)) {
    return <AuthAlert variant="error">{t('workflow.accessDenied')}</AuthAlert>;
  }

  const templates = templatesQuery.data ?? [];

  return (
    <>
      <WorkflowPageHeader title={t('workflow.nav.templates')} subtitle={t('workflow.templates.subtitle')} />

      <WorkflowSection title={t('workflow.nav.templates')}>
        {templatesQuery.isLoading ? (
          <p className={e.pageSubtitle}>…</p>
        ) : templates.length === 0 ? (
          <WorkflowEmptyState icon={FileStack} title={t('workflow.templates.empty')} />
        ) : (
          <div className={e.templateGrid}>
            {templates.map((tpl) => (
              <article key={tpl.id} className={e.templateCard}>
                <h3 className={e.approvalCardTitle}>{pickLocalizedName(locale, tpl.nameEn, tpl.nameAr)}</h3>
                <code style={{ fontSize: 'var(--text-xs)' }}>{tpl.triggerType}</code>
                <WorkflowStatusBadge status={tpl.status} />
                <div className={e.approvalActions}>
                  {(tpl.status === 'active' || tpl.status === 'ACTIVE') && (
                    <AuthButton
                      variant="secondary"
                      loading={startMutation.isPending}
                      onClick={async () => {
                        const res = await startMutation.mutateAsync(tpl.id);
                        navigate(`/workflows/instances/${res.workflowId}`);
                      }}
                    >
                      {t('workflow.templates.use')}
                    </AuthButton>
                  )}
                  {canManageWorkflows(perm) && (tpl.status === 'draft' || tpl.status === 'DRAFT') && (
                    <AuthButton variant="secondary" loading={publishMutation.isPending} onClick={() => void publishMutation.mutateAsync(tpl.id)}>
                      {t('workflow.templates.publish')}
                    </AuthButton>
                  )}
                </div>
              </article>
            ))}
          </div>
        )}
      </WorkflowSection>
    </>
  );
}
