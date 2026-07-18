import { ReactNode } from 'react';
import styles from './Tabs.module.css';

export interface TabItem<T extends string> {
  id: T;
  label: string;
  badge?: number;
}

interface TabsProps<T extends string> {
  tabs: TabItem<T>[];
  active: T;
  onChange: (id: T) => void;
  ariaLabel: string;
}

export function Tabs<T extends string>({ tabs, active, onChange, ariaLabel }: TabsProps<T>) {
  return (
    <div className={styles.wrap} role="tablist" aria-label={ariaLabel}>
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          role="tab"
          id={`tab-${tab.id}`}
          aria-selected={active === tab.id}
          aria-controls={`panel-${tab.id}`}
          className={[styles.tab, active === tab.id ? styles.active : ''].join(' ')}
          onClick={() => onChange(tab.id)}
        >
          <span>{tab.label}</span>
          {tab.badge != null && tab.badge > 0 && (
            <span className={styles.badge} aria-label={`${tab.badge} items`}>
              {tab.badge}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}

interface TabPanelProps {
  id: string;
  labelledBy: string;
  active: boolean;
  children: ReactNode;
}

export function TabPanel({ id, labelledBy, active, children }: TabPanelProps) {
  return (
    <div
      role="tabpanel"
      id={`panel-${id}`}
      aria-labelledby={labelledBy}
      hidden={!active}
      className={styles.panel}
    >
      {active ? children : null}
    </div>
  );
}
