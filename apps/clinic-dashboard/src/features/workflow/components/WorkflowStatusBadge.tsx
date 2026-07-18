import e from '../workflow-enterprise.module.css';

export function WorkflowStatusBadge({ status }: { status: string }) {
  const normalized = status.toLowerCase();
  const cls =
    normalized === 'active' ||
    normalized === 'approved' ||
    normalized === 'completed' ||
    normalized === 'in_progress'
      ? e.badgeSuccess
      : normalized === 'failed' ||
          normalized === 'rejected' ||
          normalized === 'canceled' ||
          normalized === 'cancelled' ||
          normalized === 'overdue' ||
          normalized === 'escalated'
        ? normalized === 'overdue' || normalized === 'escalated'
          ? e.badgeWarning
          : e.badgeDanger
        : e.badgeNeutral;
  return (
    <span className={[e.badge, cls].join(' ')}>
      {status.replace(/_/g, ' ')}
    </span>
  );
}
