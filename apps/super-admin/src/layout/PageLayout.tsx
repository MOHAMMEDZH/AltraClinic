import type { ReactNode } from 'react';
import { PageHeader } from './PageHeader';

interface PageLayoutProps {
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
  children?: ReactNode;
}

/** Standard content page wrapper: title/description/actions header + body. */
export function PageLayout({ title, description, actions, children }: PageLayoutProps) {
  return (
    <article className="sa-page">
      <PageHeader title={title} description={description} actions={actions} />
      {children ? <div className="sa-page-body">{children}</div> : null}
    </article>
  );
}
