import { humanizeReportSlug } from '../application/services/ai-report-context.util';

describe('ai-report-context.util', () => {
  it('humanizes catalog report slugs', () => {
    expect(humanizeReportSlug('revenue-summary')).toBe('Revenue Summary');
  });
});
