import type { ReactNode } from 'react';
import { PackageOpen } from 'lucide-react';
import styles from './InventoryEmptyState.module.css';

export interface InventoryEmptyStateProps {
  title: string;
  description?: string;
  action?: ReactNode;
}

export function InventoryEmptyState({ title, description, action }: InventoryEmptyStateProps) {
  return (
    <div className={styles.wrap} role="status">
      <div className={styles.icon} aria-hidden>
        <PackageOpen size={28} strokeWidth={1.75} />
      </div>
      <h3 className={styles.title}>{title}</h3>
      {description && <p className={styles.desc}>{description}</p>}
      {action && <div className={styles.action}>{action}</div>}
    </div>
  );
}
