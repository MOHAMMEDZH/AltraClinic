import type { ReactNode } from 'react';
import e from '../../workflow-enterprise.module.css';

interface WorkflowSectionProps {
  title: string;
  hint?: string;
  actions?: ReactNode;
  children: ReactNode;
  flush?: boolean;
}

export function WorkflowSection({ title, hint, actions, children, flush }: WorkflowSectionProps) {
  return (
    <section className={e.section}>
      <div className={e.sectionHeader}>
        <div>
          <h2 className={e.sectionTitle}>{title}</h2>
          {hint && <p className={e.sectionHint}>{hint}</p>}
        </div>
        {actions}
      </div>
      <div className={flush ? e.sectionBodyFlush : e.sectionBody}>{children}</div>
    </section>
  );
}
