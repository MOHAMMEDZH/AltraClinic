import {
  UnsafeWebhookUrlError,
  assertSafeWebhookUrl,
  evaluateWebhookUrlSafety,
  isPrivateOrReservedIpv4,
  isPrivateOrReservedIpv6,
} from '../ssrf-guard';

describe('ssrf-guard', () => {
  describe('isPrivateOrReservedIpv4', () => {
    it.each(['127.0.0.1', '10.0.0.5', '172.16.5.5', '192.168.1.1', '169.254.169.254', '0.0.0.0'])(
      'flags %s as private/reserved',
      (ip) => {
        expect(isPrivateOrReservedIpv4(ip)).toBe(true);
      },
    );

    it.each(['8.8.8.8', '1.1.1.1', '93.184.216.34'])('does not flag public IP %s', (ip) => {
      expect(isPrivateOrReservedIpv4(ip)).toBe(false);
    });
  });

  describe('isPrivateOrReservedIpv6', () => {
    it('flags loopback ::1', () => {
      expect(isPrivateOrReservedIpv6('::1')).toBe(true);
    });

    it('flags link-local fe80::', () => {
      expect(isPrivateOrReservedIpv6('fe80::1')).toBe(true);
    });

    it('flags IPv4-mapped private addresses', () => {
      expect(isPrivateOrReservedIpv6('::ffff:127.0.0.1')).toBe(true);
    });
  });

  describe('evaluateWebhookUrlSafety', () => {
    it('rejects non-HTTPS URLs', () => {
      const result = evaluateWebhookUrlSafety('http://example.com/webhook');
      expect(result.safe).toBe(false);
    });

    it('rejects localhost', () => {
      expect(evaluateWebhookUrlSafety('https://localhost/webhook').safe).toBe(false);
    });

    it('rejects loopback literal IPs', () => {
      expect(evaluateWebhookUrlSafety('https://127.0.0.1/webhook').safe).toBe(false);
    });

    it('rejects private 10.x IPs', () => {
      expect(evaluateWebhookUrlSafety('https://10.0.0.5/webhook').safe).toBe(false);
    });

    it('rejects the AWS/GCP cloud metadata address', () => {
      expect(evaluateWebhookUrlSafety('https://169.254.169.254/latest/meta-data').safe).toBe(false);
    });

    it('rejects .internal / .local hostnames', () => {
      expect(evaluateWebhookUrlSafety('https://service.internal/webhook').safe).toBe(false);
      expect(evaluateWebhookUrlSafety('https://printer.local/webhook').safe).toBe(false);
    });

    it('accepts a well-formed public HTTPS URL', () => {
      const result = evaluateWebhookUrlSafety('https://example.com/webhooks/booking');
      expect(result.safe).toBe(true);
    });

    it('rejects unparseable URLs', () => {
      expect(evaluateWebhookUrlSafety('not a url').safe).toBe(false);
    });
  });

  describe('assertSafeWebhookUrl', () => {
    it('throws UnsafeWebhookUrlError for unsafe URLs', () => {
      expect(() => assertSafeWebhookUrl('https://127.0.0.1/webhook')).toThrow(UnsafeWebhookUrlError);
    });

    it('returns a parsed URL for safe URLs', () => {
      const url = assertSafeWebhookUrl('https://example.com/webhook');
      expect(url.hostname).toBe('example.com');
    });
  });
});
