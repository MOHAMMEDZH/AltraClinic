import { useCallback, useRef, useState } from 'react';
import { Upload } from 'lucide-react';
import { useI18n } from '@booking/i18n/react';
import { compressImageForUpload } from '../api/media-api';
import type { ImagingType } from '../types/media.types';
import styles from './ImageUploadZone.module.css';

interface ImageUploadZoneProps {
  disabled?: boolean;
  uploading?: boolean;
  imagingType?: ImagingType;
  onUpload: (files: File[]) => Promise<void>;
}

export function ImageUploadZone({ disabled, uploading, onUpload }: ImageUploadZoneProps) {
  const { t } = useI18n();
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);

  const processFiles = useCallback(
    async (files: FileList | File[]) => {
      const list = Array.from(files).filter((f) => f.type.startsWith('image/'));
      if (!list.length) return;
      setProgress(t('dental.imaging.upload.compressing'));
      const compressed = await Promise.all(list.map((f) => compressImageForUpload(f)));
      setProgress(t('dental.imaging.upload.uploading'));
      await onUpload(compressed);
      setProgress(null);
    },
    [onUpload, t],
  );

  return (
    <div
      className={[styles.zone, dragOver ? styles.dragOver : '', disabled ? styles.disabled : ''].join(' ')}
      onDragOver={(e) => { e.preventDefault(); if (!disabled) setDragOver(true); }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragOver(false);
        if (!disabled && e.dataTransfer.files.length) void processFiles(e.dataTransfer.files);
      }}
      onClick={() => !disabled && inputRef.current?.click()}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          inputRef.current?.click();
        }
      }}
      aria-label={t('dental.imaging.upload.dropzone')}
      aria-busy={uploading}
    >
      <Upload size={28} aria-hidden className={styles.icon} />
      <p className={styles.title}>{t('dental.imaging.upload.title')}</p>
      <p className={styles.hint}>{t('dental.imaging.upload.hint')}</p>
      {progress && <p className={styles.progress}>{progress}</p>}
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/tiff"
        multiple
        className={styles.hiddenInput}
        disabled={disabled || uploading}
        onChange={(e) => {
          if (e.target.files?.length) void processFiles(e.target.files);
          e.target.value = '';
        }}
      />
    </div>
  );
}
