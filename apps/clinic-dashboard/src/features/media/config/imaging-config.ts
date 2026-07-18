import type { ImagingType } from '../types/media.types';

export const GALLERY_VIRTUALIZE_THRESHOLD = 20;
export const GALLERY_COLUMN_MIN_WIDTH = 176;
export const GALLERY_ROW_HEIGHT = 228;

export const IMAGING_TYPE_OPTIONS: { value: ImagingType | ''; labelKey: string }[] = [
  { value: '', labelKey: 'dental.imaging.filter.all' },
  { value: 'xray', labelKey: 'dental.imaging.types.xray' },
  { value: 'panoramic', labelKey: 'dental.imaging.types.panoramic' },
  { value: 'intraoral', labelKey: 'dental.imaging.types.intraoral' },
  { value: 'before', labelKey: 'dental.imaging.types.before' },
  { value: 'after', labelKey: 'dental.imaging.types.after' },
  { value: 'treatment', labelKey: 'dental.imaging.types.treatment' },
  { value: 'cbct', labelKey: 'dental.imaging.types.cbct' },
];

export function canViewMedia(perm: (action: string) => boolean): boolean {
  return perm('view');
}

export function canUploadMedia(perm: (action: string) => boolean): boolean {
  return perm('create');
}

export function canUpdateMedia(perm: (action: string) => boolean): boolean {
  return perm('update');
}

export function formatFileSize(bytes: number, locale: string): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${new Intl.NumberFormat(locale).format(Math.round(bytes / 1024))} KB`;
  return `${new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(bytes / (1024 * 1024))} MB`;
}
