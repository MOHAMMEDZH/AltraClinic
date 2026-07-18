import { appendGrantHistory, readGrantHistory } from './subscription-grant-history.util';

describe('subscription-grant-history.util', () => {
  it('appends and reads grant history entries', () => {
    const features = appendGrantHistory({}, {
      action: 'grant_trial',
      plan: 'professional',
      days: 14,
      grantedBy: 'admin-1',
      at: '2026-07-09T12:00:00.000Z',
    });

    const history = readGrantHistory(features);
    expect(history).toHaveLength(1);
    expect(history[0].action).toBe('grant_trial');
    expect(history[0].plan).toBe('professional');
    expect(history[0].days).toBe(14);
  });
});
