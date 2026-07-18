import type { LucideIcon } from 'lucide-react';
import e from '../../ai-enterprise.module.css';

export function AiEmptyState({ icon: Icon, title, hint }: { icon: LucideIcon; title: string; hint?: string }) {
  return (
    <div className={e.emptyState}>
      <span className={e.emptyIcon} aria-hidden>
        <Icon size={22} />
      </span>
      <p className={e.pageTitle} style={{ fontSize: 'var(--text-base)' }}>
        {title}
      </p>
      {hint && <p className={e.pageSubtitle}>{hint}</p>}
    </div>
  );
}
