import { describe, expect, it } from 'vitest';
import { filterTimelineItems, TIMELINE_FILTER_IDS } from '../lib/timeline-filters';
import { resolvePatientTabs } from '../config/patients-config';
import type { PatientTimelineEntry } from '../types';

const sampleItems: PatientTimelineEntry[] = [
  {
    id: '1',
    type: 'appointment',
    title: 'Visit',
    subtitle: null,
    occurredAt: '2026-01-01T10:00:00Z',
    status: 'confirmed',
  },
  {
    id: '2',
    type: 'encounter',
    title: 'Checkup',
    subtitle: null,
    occurredAt: '2026-01-02T10:00:00Z',
    status: null,
  },
  {
    id: '3',
    type: 'imaging',
    title: 'X-ray',
    subtitle: 'xray',
    occurredAt: '2026-01-03T10:00:00Z',
    status: null,
  },
];

describe('timeline-filters', () => {
  it('includes note in filter ids', () => {
    expect(TIMELINE_FILTER_IDS).toContain('note');
  });

  it('returns all items for all filter', () => {
    expect(filterTimelineItems(sampleItems, 'all')).toHaveLength(3);
  });

  it('filters by type', () => {
    expect(filterTimelineItems(sampleItems, 'imaging')).toEqual([sampleItems[2]]);
  });
});

describe('resolvePatientTabs', () => {
  it('hides billing when billing permission is false', () => {
    const tabs = resolvePatientTabs({ billing: false, medical: true, documents: true });
    expect(tabs).not.toContain('billing');
    expect(tabs).toContain('overview');
  });

  it('hides medical and documents when all clinical permissions are false', () => {
    const tabs = resolvePatientTabs({ billing: true, medical: false, documents: false });
    expect(tabs).not.toContain('medical');
    expect(tabs).not.toContain('documents');
    expect(tabs).toContain('appointments');
  });
});
