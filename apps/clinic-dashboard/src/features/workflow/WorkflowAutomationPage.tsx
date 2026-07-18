import { useMemo, useState } from 'react';
import { Zap } from 'lucide-react';
import { useI18n } from '@booking/i18n/react';
import { useAuth } from '@/app/providers/AuthProvider';
import { AuthAlert } from '@/features/auth/components/AuthAlert';
import { AuthButton } from '@/features/auth/components/AuthButton';
import { AuthFormField } from '@/features/auth/components/AuthFormField';
import { buildWorkflowPermCheck, canManageWorkflows, WORKFLOW_TRIGGERS } from './config/workflow-config';
import { useCreateAutomationRule, useWorkflowAutomation } from './hooks/useWorkflows';
import { WorkflowPageHeader } from './components/enterprise/WorkflowPageHeader';
import { WorkflowSection } from './components/enterprise/WorkflowSection';
import { WorkflowEmptyState } from './components/enterprise/WorkflowEmptyState';
import e from './workflow-enterprise.module.css';

export function WorkflowAutomationPage() {
  const { t } = useI18n();
  const { user } = useAuth();
  const perm = useMemo(() => buildWorkflowPermCheck(user?.roles ?? []), [user?.roles]);
  const canManage = canManageWorkflows(perm);
  const rulesQuery = useWorkflowAutomation(canManage);
  const createMutation = useCreateAutomationRule();

  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('');
  const [eventType, setEventType] = useState(WORKFLOW_TRIGGERS[0]);
  const [actionType, setActionType] = useState('create_task');
  const [isActive, setIsActive] = useState(true);

  if (!canManage) {
    return <AuthAlert variant="error">{t('workflow.accessDenied')}</AuthAlert>;
  }

  const rules = (rulesQuery.data ?? []) as Array<{
    id: string;
    name: string;
    eventType: string;
    actionType: string;
    isActive: boolean;
  }>;

  const handleCreate = async () => {
    if (!name.trim()) return;
    await createMutation.mutateAsync({ name: name.trim(), eventType, actionType, isActive });
    setShowForm(false);
    setName('');
  };

  return (
    <>
      <WorkflowPageHeader
        title={t('workflow.nav.automation')}
        subtitle={t('workflow.automation.subtitle')}
        actions={
          <AuthButton variant="secondary" onClick={() => setShowForm((v) => !v)}>
            {t('workflow.automation.create')}
          </AuthButton>
        }
      />

      {rulesQuery.isError && <AuthAlert variant="error">{t('workflow.loadError')}</AuthAlert>}

      <WorkflowSection title={t('workflow.automation.rulesTitle')}>
        {showForm && (
          <form
            className={e.filterRow}
            style={{ flexDirection: 'column', alignItems: 'stretch', marginBottom: 'var(--space-4)' }}
            onSubmit={(ev) => {
              ev.preventDefault();
              void handleCreate();
            }}
          >
            <AuthFormField label={t('workflow.automation.name')} id="auto-name">
              <input id="auto-name" className={e.input} value={name} onChange={(ev) => setName(ev.target.value)} required />
            </AuthFormField>
            <AuthFormField label={t('workflow.table.trigger')} id="auto-trigger">
              <select id="auto-trigger" className={e.select} value={eventType} onChange={(ev) => setEventType(ev.target.value)}>
                {WORKFLOW_TRIGGERS.map((tr) => (
                  <option key={tr} value={tr}>{tr}</option>
                ))}
              </select>
            </AuthFormField>
            <AuthFormField label={t('workflow.automation.action')} id="auto-action">
              <select id="auto-action" className={e.select} value={actionType} onChange={(ev) => setActionType(ev.target.value)}>
                <option value="create_task">{t('workflow.automation.actions.createTask')}</option>
                <option value="request_approval">{t('workflow.automation.actions.requestApproval')}</option>
                <option value="send_notification">{t('workflow.automation.actions.sendNotification')}</option>
                <option value="escalate">{t('workflow.automation.actions.escalate')}</option>
              </select>
            </AuthFormField>
            <label style={{ display: 'flex', gap: 8, fontSize: 'var(--text-sm)' }}>
              <input type="checkbox" checked={isActive} onChange={(ev) => setIsActive(ev.target.checked)} />
              {t('workflow.automation.enabled')}
            </label>
            <AuthButton type="submit" loading={createMutation.isPending}>{t('workflow.automation.save')}</AuthButton>
          </form>
        )}

        {rulesQuery.isLoading ? (
          <p className={e.pageSubtitle}>…</p>
        ) : rules.length === 0 ? (
          <WorkflowEmptyState icon={Zap} title={t('workflow.automation.empty')} />
        ) : (
          <div className={e.executionGrid}>
            {rules.map((rule) => (
              <div key={rule.id} className={e.executionRow}>
                <strong>{rule.name}</strong>
                <code>{rule.eventType}</code>
                <span>{rule.actionType}</span>
                <span className={rule.isActive ? e.livePillOn : e.livePill}>
                  {rule.isActive ? t('workflow.automation.enabled') : t('workflow.automation.disabled')}
                </span>
              </div>
            ))}
          </div>
        )}
      </WorkflowSection>
    </>
  );
}
