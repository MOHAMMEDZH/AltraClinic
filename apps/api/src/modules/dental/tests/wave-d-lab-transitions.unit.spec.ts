import { LAB_TRANSITIONS } from '../services/wave-d-reference.validation';

describe('Wave D lab status transitions', () => {
  it('allows DRAFT → SENT', () => {
    expect(LAB_TRANSITIONS.DRAFT).toContain('SENT');
  });

  it('forbids SEATED → SENT', () => {
    expect(LAB_TRANSITIONS.SEATED).not.toContain('SENT');
  });

  it('forbids CANCELLED outgoing transitions', () => {
    expect(LAB_TRANSITIONS.CANCELLED).toEqual([]);
  });

  it('allows SENT → RECEIVED', () => {
    expect(LAB_TRANSITIONS.SENT).toContain('RECEIVED');
  });
});
