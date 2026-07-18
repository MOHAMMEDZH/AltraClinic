import styles from './ViewerSkeleton.module.css';

export function ViewerSkeleton() {
  return (
    <div className={styles.viewer} aria-busy="true" aria-label="Loading image viewer">
      <div className={styles.toolbar}>
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className={styles.toolBtn} />
        ))}
      </div>
      <div className={styles.canvas} />
    </div>
  );
}
