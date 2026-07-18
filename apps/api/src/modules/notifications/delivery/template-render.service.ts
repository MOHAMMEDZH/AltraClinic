import { Injectable } from '@nestjs/common';
import { NotificationChannelId, NotificationLocale } from './delivery.types';

/**
 * Server-side template rendering. Deliberately NOT a general templating engine:
 * only flat `{{var}}` substitution is supported — no conditionals, loops, partials,
 * helpers, or raw/triple-mustache output. This keeps rendering fully deterministic
 * and immune to template-injection style attacks against the 41a-c catalog authority.
 */

export const CHANNEL_LENGTH_LIMITS: Partial<Record<NotificationChannelId, number>> = {
  sms: 1600,
  whatsapp: 4096,
};

export class TemplateSyntaxError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TemplateSyntaxError';
  }
}

export class TemplateUnknownVariableError extends Error {
  constructor(public readonly variableName: string) {
    super(`Template references unknown variable "${variableName}"`);
    this.name = 'TemplateUnknownVariableError';
  }
}

const VARIABLE_PATTERN = /\{\{\s*([a-zA-Z0-9_.]+)\s*\}\}/g;
/** Disallow handlebars-style block/partial/raw syntax: {{#..}}, {{/..}}, {{^..}}, {{>..}}, {{!..}}, {{{..}}}. */
const EXECUTABLE_SYNTAX_PATTERN = /\{\{\{|\{\{\s*[#/^!>]/;

/** Extract the ordered, de-duplicated set of `{{var}}` names referenced by a template. */
export function extractTemplateVariables(template: string): string[] {
  const found = new Set<string>();
  let match: RegExpExecArray | null;
  const re = new RegExp(VARIABLE_PATTERN);
  while ((match = re.exec(template)) !== null) {
    found.add(match[1]);
  }
  return Array.from(found);
}

/** Throws if the template contains anything beyond flat variable interpolation. */
export function assertNoExecutableTemplateSyntax(template: string): void {
  if (EXECUTABLE_SYNTAX_PATTERN.test(template)) {
    throw new TemplateSyntaxError('Template contains disallowed executable syntax (blocks/partials/raw output are not permitted)');
  }
}

export type TemplateVariableValue = string | number | boolean | null | undefined;

/**
 * Substitutes `{{var}}` placeholders with stringified values from `variables`.
 * Rejects (throws) if the template references any variable not present in `variables`
 * — fail closed rather than silently rendering an empty/undefined value.
 */
export function substituteTemplateVariables(
  template: string,
  variables: Record<string, TemplateVariableValue>,
): string {
  assertNoExecutableTemplateSyntax(template);

  const referenced = extractTemplateVariables(template);
  for (const name of referenced) {
    if (!Object.prototype.hasOwnProperty.call(variables, name)) {
      throw new TemplateUnknownVariableError(name);
    }
  }

  return template.replace(VARIABLE_PATTERN, (_full, name: string) => {
    const value = variables[name];
    if (value === null || value === undefined) return '';
    return String(value);
  });
}

const SCRIPT_TAG_PATTERN = /<script\b[^>]*>[\s\S]*?<\/script\s*>/gi;
const IFRAME_TAG_PATTERN = /<iframe\b[^>]*>[\s\S]*?<\/iframe\s*>/gi;
const SELF_CLOSING_DANGEROUS_TAG_PATTERN = /<(script|iframe|object|embed)\b[^>]*\/?>/gi;
/** on* attributes, quoted or unquoted: onclick="...", onload='...', onerror=... */
const ON_ATTR_PATTERN = /\son\w+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi;
const JAVASCRIPT_HREF_PATTERN = /\s(href|src)\s*=\s*(?:"javascript:[^"]*"|'javascript:[^']*')/gi;

/** Strips <script>, <iframe>, <object>/<embed>, and all on* event-handler attributes. */
export function sanitizeHtml(html: string): string {
  return html
    .replace(SCRIPT_TAG_PATTERN, '')
    .replace(IFRAME_TAG_PATTERN, '')
    .replace(SELF_CLOSING_DANGEROUS_TAG_PATTERN, '')
    .replace(ON_ATTR_PATTERN, '')
    .replace(JAVASCRIPT_HREF_PATTERN, ' $1="#"');
}

const ALLOWED_URL_SCHEMES = new Set(['http:', 'https:', 'mailto:']);

/** Returns the URL unchanged if scheme is http/https/mailto, otherwise null (reject). */
export function sanitizeUrl(rawUrl: string): string | null {
  const trimmed = rawUrl.trim();
  try {
    const url = new URL(trimmed);
    if (!ALLOWED_URL_SCHEMES.has(url.protocol)) return null;
    return trimmed;
  } catch {
    return null;
  }
}

/** Rewrites href/src attribute values in-place, dropping ones with disallowed schemes. */
export function sanitizeHtmlUrls(html: string): string {
  return html.replace(/\s(href|src)\s*=\s*(")([^"]*)(")|\s(href|src)\s*=\s*(')([^']*)(')/gi, (fullMatch, attr1, q1, url1, _q1c, attr2, q2, url2) => {
    const attr = attr1 ?? attr2;
    const url = url1 ?? url2;
    const safe = sanitizeUrl(url);
    if (safe === null) {
      return ` ${attr}="#"`;
    }
    return ` ${attr}="${safe}"`;
  });
}

export interface TruncateResult {
  text: string;
  truncated: boolean;
}

/** Enforces per-channel max length (SMS 1600, WhatsApp 4096); other channels are unbounded here. */
export function truncateForChannel(text: string, channel: NotificationChannelId): TruncateResult {
  const limit = CHANNEL_LENGTH_LIMITS[channel];
  if (!limit || text.length <= limit) {
    return { text, truncated: false };
  }
  const ellipsis = '…';
  return { text: text.slice(0, limit - ellipsis.length) + ellipsis, truncated: true };
}

export interface LocalizedSource {
  en: string;
  ar?: string | null;
}

export interface RenderMessageInput {
  subject?: LocalizedSource | null;
  body: LocalizedSource;
  variables: Record<string, TemplateVariableValue>;
  locale: NotificationLocale;
  channel: NotificationChannelId;
  /** Set true when body should be treated/sanitized as HTML (e.g. email). */
  html?: boolean;
}

export interface RenderMessageOutput {
  locale: NotificationLocale;
  localeFallbackApplied: boolean;
  subject?: string;
  body: string;
  html?: string;
  truncated: boolean;
}

function resolveLocalizedSource(source: LocalizedSource, locale: NotificationLocale): { text: string; fallbackApplied: boolean } {
  if (locale === 'ar') {
    if (source.ar && source.ar.trim().length > 0) {
      return { text: source.ar, fallbackApplied: false };
    }
    return { text: source.en, fallbackApplied: true };
  }
  return { text: source.en, fallbackApplied: false };
}

@Injectable()
export class TemplateRenderService {
  render(input: RenderMessageInput): RenderMessageOutput {
    const bodyResolved = resolveLocalizedSource(input.body, input.locale);
    let localeFallbackApplied = bodyResolved.fallbackApplied;

    let renderedBody = substituteTemplateVariables(bodyResolved.text, input.variables);

    let renderedSubject: string | undefined;
    if (input.subject) {
      const subjectResolved = resolveLocalizedSource(input.subject, input.locale);
      localeFallbackApplied = localeFallbackApplied || subjectResolved.fallbackApplied;
      renderedSubject = substituteTemplateVariables(subjectResolved.text, input.variables);
    }

    let html: string | undefined;
    if (input.html) {
      html = sanitizeHtmlUrls(sanitizeHtml(renderedBody));
    }

    const { text: truncatedBody, truncated } = truncateForChannel(renderedBody, input.channel);
    renderedBody = truncatedBody;

    return {
      locale: input.locale,
      localeFallbackApplied,
      subject: renderedSubject,
      body: renderedBody,
      html,
      truncated,
    };
  }
}
