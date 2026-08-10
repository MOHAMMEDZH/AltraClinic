import type { ReactNode } from 'react';

interface PageHeaderProps {
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
}

/**
 * Page title block. `#main-heading` is the focus target `useRouteFocus`
 * moves to after every client-side navigation, so it must always be
 * present, unique per page, and programmatically focusable.
 */
export function PageHeader({ title, description, actions }: PageHeaderProps) {
  return (
    <div className="sa-page-header">
      <div className="sa-page-header-text">
        <h1 id="main-heading" tabIndex={-1}>
          {title}
        </h1>
        {description ? <p className="sa-page-header-description sa-muted">{description}</p> : null}
      </div>
      {actions ? <div className="sa-page-header-actions">{actions}</div> : null}
    </div>
  );
}
