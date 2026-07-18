import { describe, expect, it } from 'vitest';
import {
  canUpdateMedia,
  canUploadMedia,
  canViewMedia,
  formatFileSize,
  GALLERY_VIRTUALIZE_THRESHOLD,
  IMAGING_TYPE_OPTIONS,
} from './imaging-config';

describe('imaging-config', () => {
  it('gates media permissions', () => {
    expect(canViewMedia((a) => a === 'view')).toBe(true);
    expect(canUploadMedia((a) => a === 'create')).toBe(true);
    expect(canUpdateMedia((a) => a === 'update')).toBe(true);
  });

  it('lists imaging categories', () => {
    expect(IMAGING_TYPE_OPTIONS.some((o) => o.value === 'xray')).toBe(true);
    expect(IMAGING_TYPE_OPTIONS.some((o) => o.value === 'cbct')).toBe(true);
  });

  it('formats file sizes', () => {
    expect(formatFileSize(512, 'en')).toBe('512 B');
    expect(formatFileSize(2048, 'en')).toContain('KB');
  });

  it('defines virtualization threshold', () => {
    expect(GALLERY_VIRTUALIZE_THRESHOLD).toBeGreaterThan(0);
  });
});
