import { summarizeUserAgent } from '../application/platform-device-summary';

describe('summarizeUserAgent', () => {
  it('produces stable summaries for known desktop browsers', () => {
    expect(
      summarizeUserAgent(
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      ),
    ).toEqual({ summary: 'Chrome on Windows', category: 'desktop' });

    expect(
      summarizeUserAgent(
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15',
      ),
    ).toEqual({ summary: 'Safari on macOS', category: 'desktop' });

    expect(
      summarizeUserAgent(
        'Mozilla/5.0 (X11; Linux x86_64; rv:121.0) Gecko/20100101 Firefox/121.0',
      ),
    ).toEqual({ summary: 'Firefox on Linux', category: 'desktop' });
  });

  it('produces stable summaries for known mobile browsers', () => {
    expect(
      summarizeUserAgent(
        'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
      ),
    ).toEqual({ summary: 'Mobile Safari on iOS', category: 'mobile' });

    expect(
      summarizeUserAgent(
        'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
      ),
    ).toEqual({ summary: 'Chrome on Android', category: 'mobile' });
  });

  it('unknown or malformed user-agent values produce a safe fallback', () => {
    expect(summarizeUserAgent('???')).toEqual({
      summary: 'Unknown browser',
      category: 'unknown',
    });
  });

  it('empty user-agent values produce a safe fallback', () => {
    expect(summarizeUserAgent('')).toEqual({
      summary: 'Unknown browser',
      category: 'unknown',
    });
    expect(summarizeUserAgent(null)).toEqual({
      summary: 'Unknown browser',
      category: 'unknown',
    });
    expect(summarizeUserAgent(undefined)).toEqual({
      summary: 'Unknown browser',
      category: 'unknown',
    });
  });
});
