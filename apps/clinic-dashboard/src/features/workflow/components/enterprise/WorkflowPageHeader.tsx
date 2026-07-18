import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import e from '../../workflow-enterprise.module.css';

interface WorkflowPageHeaderProps {
  title: string;
  subtitle?: string;
  breadcrumbs?: Array<{ label: string; to?: string }>;
  actions?: ReactNode;
}

export function WorkflowPageHeader({ title, subtitle, breadcrumbs, actions }: WorkflowPageHeaderProps) {
  return (
    <header className={e.pageHeader}>
      <div className={e.pageHeaderText}>
        {breadcrumbs && breadcrumbs.length > 0 && (
          <ol className={e.breadcrumb}>
            {breadcrumbs.map((crumb, i) => (
              <li key={`${crumb.label}-${i}`}>
                {crumb.to ? <Link to={crumb.to}>{crumb.label}</Link> : crumb.label}
                {i < breadcrumbs.length - 1 && <span aria-hidden> / </span>}
              </li>
            ))}
          </ol>
        )}
        <h1 className={e.pageTitle}>{title}</h1>
        {subtitle && <p className={e.pageSubtitle}>{subtitle}</p>}
      </div>
      {actions && <div className={e.pageActions}>{actions}</div>}
    </header>
  );
}
