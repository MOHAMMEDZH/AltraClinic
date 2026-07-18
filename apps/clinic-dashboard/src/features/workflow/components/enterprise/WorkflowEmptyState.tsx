import type { LucideIcon } from 'lucide-react';
import e from '../../workflow-enterprise.module.css';

interface WorkflowEmptyStateProps {
  icon: LucideIcon;
  title: string;
  description?: string;
}

export function WorkflowEmptyState({ icon: Icon, title, description }: WorkflowEmptyStateProps) {
  return (
    <div className={e.emptyState}>
      <span className={e.emptyStateIcon} aria-hidden>
        <Icon size={24} />
      </span>
      <p>{title}</p>
      {description && <p className={e.pageSubtitle}>{description}</p>}
    </div>
  );
}
