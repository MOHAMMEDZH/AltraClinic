import { describe, expect, it } from 'vitest';
import { serializeAiRouteContext } from './ai-context-params';
import type { AiRouteContext } from './ai-types';

describe('ai sidebar context helpers', () => {
  it('serializes route context for live inference payloads', () => {
    const context: AiRouteContext = {
      path: '/patients/p1',
      module: 'patients',
      patientId: 'p1',
      encounterId: undefined,
      appointmentId: 'appt-1',
    };

    expect(serializeAiRouteContext(context)).toEqual({
      path: '/patients/p1',
      module: 'patients',
      patientId: 'p1',
      appointmentId: 'appt-1',
    });
  });

  it('maps summary items for sidebar display labels', () => {
    const items = [
      { key: 'patient', labelKey: 'ai.context.entities.patient', value: 'Ada Lovelace' },
      { key: 'appointment', labelKey: 'ai.context.entities.appointment', value: '2026-01-01' },
    ];

    expect(items.map((item) => item.labelKey)).toContain('ai.context.entities.patient');
    expect(items.some((item) => item.key === 'appointment')).toBe(true);
  });
});
