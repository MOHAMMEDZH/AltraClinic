import { useMemo } from 'react';
import { Shield } from 'lucide-react';
import { useI18n } from '@booking/i18n/react';
import { useAuth } from '@/app/providers/AuthProvider';
import { AuthAlert } from '@/features/auth/components/AuthAlert';
import { buildWorkflowPermCheck, canViewWorkflows } from './config/workflow-config';
import { useWorkflowAudit } from './hooks/useWorkflows';
import { WorkflowAuditTimeline } from './components/enterprise/WorkflowAuditTimeline';
import { WorkflowEmptyState } from './components/enterprise/WorkflowEmptyState';
import { WorkflowPageHeader } from './components/enterprise/WorkflowPageHeader';
import { WorkflowSection } from './components/enterprise/WorkflowSection';

export function WorkflowAuditPage() {
  const { t, locale } = useI18n();
  const { user } = useAuth();
  const perm = useMemo(() => buildWorkflowPermCheck(user?.roles ?? []), [user?.roles]);
  const auditQuery = useWorkflowAudit(canViewWorkflows(perm));

  if (!canViewWorkflows(perm)) {
    return <AuthAlert variant="error">{t('workflow.accessDenied')}</AuthAlert>;
  }

  const entries = auditQuery.data ?? [];

  return (
    <>
      <WorkflowPageHeader title={t('workflow.nav.audit')} subtitle={t('workflow.audit.subtitle')} />

      <WorkflowSection title={t('workflow.audit.timeline')} hint={t('workflow.audit.hint')}>
        {auditQuery.isLoading ? (
          <p>…</p>
        ) : entries.length === 0 ? (
          <WorkflowEmptyState icon={Shield} title={t('workflow.audit.empty')} />
        ) : (
          <WorkflowAuditTimeline entries={entries} locale={locale} />
        )}
      </WorkflowSection>
    </>
  );
}
