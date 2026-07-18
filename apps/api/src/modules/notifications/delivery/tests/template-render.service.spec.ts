import {
  TemplateRenderService,
  TemplateSyntaxError,
  TemplateUnknownVariableError,
  extractTemplateVariables,
  sanitizeHtml,
  sanitizeUrl,
  substituteTemplateVariables,
  truncateForChannel,
} from '../template-render.service';

describe('TemplateRenderService (pure functions)', () => {
  describe('extractTemplateVariables', () => {
    it('extracts unique variable names', () => {
      expect(extractTemplateVariables('Hi {{firstName}}, your code is {{code}}. Bye {{firstName}}')).toEqual([
        'firstName',
        'code',
      ]);
    });
  });

  describe('substituteTemplateVariables', () => {
    it('substitutes known variables', () => {
      expect(substituteTemplateVariables('Hi {{name}}!', { name: 'Alice' })).toBe('Hi Alice!');
    });

    it('rejects unknown variables (fail closed)', () => {
      expect(() => substituteTemplateVariables('Hi {{name}}!', {})).toThrow(TemplateUnknownVariableError);
    });

    it('rejects handlebars-style block syntax', () => {
      expect(() => substituteTemplateVariables('{{#if x}}Hi{{/if}}', { x: true })).toThrow(TemplateSyntaxError);
    });

    it('rejects triple-mustache raw output', () => {
      expect(() => substituteTemplateVariables('{{{rawHtml}}}', { rawHtml: '<b>hi</b>' })).toThrow(TemplateSyntaxError);
    });

    it('treats null/undefined values as empty string', () => {
      expect(substituteTemplateVariables('Value: {{v}}', { v: null })).toBe('Value: ');
    });
  });

  describe('sanitizeHtml', () => {
    it('strips <script> tags', () => {
      expect(sanitizeHtml('<p>hi</p><script>alert(1)</script>')).toBe('<p>hi</p>');
    });

    it('strips <iframe> tags', () => {
      expect(sanitizeHtml('<iframe src="evil.com"></iframe><p>ok</p>')).toBe('<p>ok</p>');
    });

    it('strips on* event handler attributes', () => {
      expect(sanitizeHtml('<a href="#" onclick="evil()">click</a>')).not.toMatch(/onclick/);
    });
  });

  describe('sanitizeUrl', () => {
    it.each(['http://example.com', 'https://example.com', 'mailto:a@b.com'])('allows %s', (url) => {
      expect(sanitizeUrl(url)).toBe(url);
    });

    it.each(['javascript:alert(1)', 'ftp://example.com', 'data:text/html,evil'])('rejects %s', (url) => {
      expect(sanitizeUrl(url)).toBeNull();
    });
  });

  describe('truncateForChannel', () => {
    it('does not truncate under the SMS limit', () => {
      const { text, truncated } = truncateForChannel('short message', 'sms');
      expect(text).toBe('short message');
      expect(truncated).toBe(false);
    });

    it('truncates over the SMS 1600 limit', () => {
      const long = 'a'.repeat(2000);
      const { text, truncated } = truncateForChannel(long, 'sms');
      expect(truncated).toBe(true);
      expect(text.length).toBe(1600);
    });

    it('truncates over the WhatsApp 4096 limit', () => {
      const long = 'a'.repeat(5000);
      const { text, truncated } = truncateForChannel(long, 'whatsapp');
      expect(truncated).toBe(true);
      expect(text.length).toBe(4096);
    });

    it('does not truncate unbounded channels like email', () => {
      const long = 'a'.repeat(10000);
      const { truncated } = truncateForChannel(long, 'email');
      expect(truncated).toBe(false);
    });
  });

  describe('render', () => {
    let service: TemplateRenderService;

    beforeEach(() => {
      service = new TemplateRenderService();
    });

    it('renders english by default', () => {
      const result = service.render({
        body: { en: 'Hello {{name}}', ar: 'مرحبا {{name}}' },
        variables: { name: 'Sam' },
        locale: 'en',
        channel: 'in-app',
      });
      expect(result.body).toBe('Hello Sam');
      expect(result.localeFallbackApplied).toBe(false);
    });

    it('renders arabic when requested and available', () => {
      const result = service.render({
        body: { en: 'Hello {{name}}', ar: 'مرحبا {{name}}' },
        variables: { name: 'Sam' },
        locale: 'ar',
        channel: 'in-app',
      });
      expect(result.body).toBe('مرحبا Sam');
      expect(result.localeFallbackApplied).toBe(false);
    });

    it('falls back to english when arabic is missing', () => {
      const result = service.render({
        body: { en: 'Hello {{name}}' },
        variables: { name: 'Sam' },
        locale: 'ar',
        channel: 'in-app',
      });
      expect(result.body).toBe('Hello Sam');
      expect(result.localeFallbackApplied).toBe(true);
    });

    it('sanitizes html output and strips scripts', () => {
      const result = service.render({
        body: { en: '<p>Hi {{name}}</p><script>alert(1)</script>' },
        variables: { name: 'Sam' },
        locale: 'en',
        channel: 'email',
        html: true,
      });
      expect(result.html).toContain('Hi Sam');
      expect(result.html).not.toContain('<script>');
    });

    it('applies channel length limits to the rendered body', () => {
      const result = service.render({
        body: { en: 'x'.repeat(2000) },
        variables: {},
        locale: 'en',
        channel: 'sms',
      });
      expect(result.truncated).toBe(true);
      expect(result.body.length).toBe(1600);
    });
  });
});
