import styles from '../api-integrations-layout.module.css';

export function StatusBadge({ status }: { status: string }) {
  const tone =
    status.includes('fail') ||
    status === 'dead_lettered' ||
    status === 'revoked' ||
    status === 'disabled' ||
    status === 'denied'
      ? styles.badgeErr
      : status.includes('expir') ||
          status === 'rotated' ||
          status === 'dormant' ||
          status === 'paused'
        ? styles.badgeWarn
        : status === 'active' ||
            status === 'ready' ||
            status === 'success' ||
            status === 'delivered' ||
            status === 'on'
          ? styles.badgeOk
          : '';
  return (
    <span className={[styles.badge, tone].filter(Boolean).join(' ')}>{status}</span>
  );
}

export function EmptyState({ title, detail }: { title: string; detail?: string }) {
  return (
    <div className={styles.empty} role="status">
      <strong>{title}</strong>
      {detail ? <p className={styles.muted}>{detail}</p> : null}
    </div>
  );
}

export function LoadingBlock({ label = 'Loading…' }: { label?: string }) {
  return (
    <div role="status" aria-busy="true" aria-label={label} className={styles.content}>
      <div className={styles.skeleton} />
      <div className={styles.skeleton} style={{ width: '70%' }} />
      <div className={styles.skeleton} style={{ width: '40%' }} />
    </div>
  );
}
