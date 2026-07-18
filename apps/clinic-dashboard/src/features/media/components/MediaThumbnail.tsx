import { useMediaBlobUrl } from '../hooks/useMedia';
import styles from './MediaThumbnail.module.css';

export function MediaThumbnail({
  mediaId,
  alt,
  selected,
  onClick,
}: {
  mediaId: string;
  alt: string;
  selected?: boolean;
  onClick?: () => void;
}) {
  const { url, loading } = useMediaBlobUrl(mediaId, 'thumbnail');

  return (
    <button
      type="button"
      className={[styles.thumb, selected ? styles.selected : ''].join(' ')}
      onClick={onClick}
      aria-label={alt}
      aria-pressed={selected}
    >
      {loading && <span className={styles.skeleton} aria-hidden />}
      {url && <img src={url} alt="" loading="lazy" className={styles.img} />}
    </button>
  );
}
