import styles from '../import-export-layout.module.css';

export function StatusBadge({ status }: { status: string }) {
  const tone =
    status.includes('fail') || status === 'dead_letter' || status === 'cancelled'
      ? styles.badgeErr
      : status.includes('warn') || status === 'retrying' || status === 'expired'
        ? styles.badgeWarn
        : status.includes('complete') || status === 'available' || status === 'active'
          ? styles.badgeOk
          : '';
  return <span className={[styles.badge, tone].filter(Boolean).join(' ')}>{status}</span>;
}

export function ProgressBar({ percent, label }: { percent: number; label?: string }) {
  const clamped = Math.max(0, Math.min(100, percent));
  return (
    <div>
      {label ? <p className={styles.muted}>{label}</p> : null}
      <div
        className={styles.progressTrack}
        role="progressbar"
        aria-valuenow={clamped}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={label ?? 'Progress'}
      >
        <div className={styles.progressFill} style={{ width: `${clamped}%` }} />
      </div>
    </div>
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
