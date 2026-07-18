import styles from './ImagingPageSkeleton.module.css';

export function ImagingPageSkeleton() {
  return (
    <div className={styles.page} aria-busy="true" aria-label="Loading imaging workspace">
      <div className={styles.breadcrumb} />
      <div className={styles.header}>
        <div className={styles.titleLine} />
        <div className={styles.subtitleLine} />
      </div>
      <div className={styles.toolbar}>
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className={styles.chip} />
        ))}
      </div>
      <div className={styles.upload} />
      <div className={styles.gallery}>
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className={styles.card} />
        ))}
      </div>
    </div>
  );
}

export function ImagingWorkspaceSkeleton({ compact }: { compact?: boolean }) {
  return (
    <div className={[styles.workspace, compact ? styles.compact : ''].join(' ')} aria-busy="true">
      <div className={styles.toolbar}>
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className={styles.chip} />
        ))}
      </div>
      <div className={styles.upload} />
      <div className={styles.gallery}>
        {Array.from({ length: compact ? 4 : 6 }).map((_, i) => (
          <div key={i} className={styles.card} />
        ))}
      </div>
    </div>
  );
}
