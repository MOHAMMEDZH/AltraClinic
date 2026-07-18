import { Link } from 'react-router-dom';
import { useI18n } from '@booking/i18n/react';
import type { WorkflowWorkspaceId } from '../config/workflow-config';
import { WORKFLOW_WORKSPACES } from '../config/workflow-config';
import e from '../workflow-enterprise.module.css';

interface WorkflowRoleWorkspaceProps {
  activeWorkspace: WorkflowWorkspaceId;
  onSelect: (id: WorkflowWorkspaceId) => void;
}

export function WorkflowRoleWorkspace({ activeWorkspace, onSelect }: WorkflowRoleWorkspaceProps) {
  const { t } = useI18n();

  return (
    <nav className={e.workspaceNav} aria-label={t('workflow.workspaces.title')}>
      {WORKFLOW_WORKSPACES.map((ws) => (
        <button
          key={ws.id}
          type="button"
          className={[e.workspaceTab, activeWorkspace === ws.id ? e.workspaceTabActive : ''].filter(Boolean).join(' ')}
          onClick={() => onSelect(ws.id)}
        >
          {t(`workflow.workspaces.${ws.id}`)}
        </button>
      ))}
    </nav>
  );
}

export function WorkflowWorkspaceLinks({ workspace }: { workspace: WorkflowWorkspaceId }) {
  const { t } = useI18n();
  const ws = WORKFLOW_WORKSPACES.find((w) => w.id === workspace);
  if (!ws) return null;

  return (
    <div className={e.workspaceLinks}>
      {ws.links.map((link) => (
        <Link key={link.to} to={link.to} className={e.workspaceLink}>
          {t(link.labelKey)}
        </Link>
      ))}
    </div>
  );
}
