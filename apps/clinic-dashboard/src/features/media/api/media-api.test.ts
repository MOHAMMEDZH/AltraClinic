import { describe, expect, it } from 'vitest';
import {
  cbctSliceVariant,
  isCbctItem,
  listCbctSliceIndices,
  shouldVirtualizeGallery,
} from '../api/media-api';
import type { MediaListItem } from '../types/media.types';

const baseItem = (overrides: Partial<MediaListItem> = {}): MediaListItem => ({
  id: '1',
  category: 'dental_image',
  ownerType: 'patient',
  ownerId: 'p1',
  patientId: 'p1',
  originalFilename: 'test.jpg',
  mimeType: 'image/jpeg',
  sizeBytes: 1000,
  status: 'ready',
  variants: [{ type: 'slice-0', mimeType: 'image/jpeg', sizeBytes: 100 }],
  metadata: { clinical: { imagingType: 'cbct' } },
  comparisonGroupId: null,
  comparisonRole: null,
  createdAt: new Date().toISOString(),
  processedAt: null,
  ...overrides,
});

describe('media-api imaging helpers', () => {
  it('detects cbct items', () => {
    expect(isCbctItem(baseItem())).toBe(true);
    expect(isCbctItem(baseItem({ metadata: { clinical: { imagingType: 'xray' } } }))).toBe(false);
  });

  it('lists slice indices', () => {
    expect(listCbctSliceIndices(baseItem({
      variants: [
        { type: 'slice-2', mimeType: 'image/jpeg', sizeBytes: 1 },
        { type: 'slice-0', mimeType: 'image/jpeg', sizeBytes: 1 },
        { type: 'webp', mimeType: 'image/webp', sizeBytes: 1 },
      ],
    }))).toEqual([0, 2]);
  });

  it('builds slice variant keys', () => {
    expect(cbctSliceVariant(5)).toBe('slice-5');
  });

  it('virtualizes large galleries', () => {
    expect(shouldVirtualizeGallery(19)).toBe(false);
    expect(shouldVirtualizeGallery(20)).toBe(true);
  });
});
