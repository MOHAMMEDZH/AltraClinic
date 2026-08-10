/**
 * Phase 46a — HTTP client foundation (no auth product).
 */

export interface PortalApiError {
  code: string;
  message: string;
  status: number;
  correlationId: string | null;
}

export interface PortalRequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  headers?: Record<string, string>;
  body?: unknown;
  tenantId?: string | null;
  branchId?: string | null;
  correlationId?: string | null;
  accessToken?: string | null;
  signal?: AbortSignal;
}

export interface PortalHttpClient {
  request<T>(path: string, options?: PortalRequestOptions): Promise<T>;
}

function createCorrelationId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `pp-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function createPortalHttpClient(baseUrl: string): PortalHttpClient {
  const normalizedBase = baseUrl.replace(/\/$/, '');

  return {
    async request<T>(path: string, options: PortalRequestOptions = {}): Promise<T> {
      const correlationId = options.correlationId ?? createCorrelationId();
      const headers: Record<string, string> = {
        Accept: 'application/json',
        'X-Correlation-Id': correlationId,
        ...(options.headers ?? {}),
      };
      if (options.tenantId) {
        headers['X-Tenant-Id'] = options.tenantId;
      }
      if (options.branchId) {
        headers['X-Branch-Id'] = options.branchId;
      }
      if (options.accessToken) {
        headers.Authorization = `Bearer ${options.accessToken}`;
      }
      if (options.body !== undefined) {
        headers['Content-Type'] = 'application/json';
      }

      const response = await fetch(`${normalizedBase}${path.startsWith('/') ? path : `/${path}`}`, {
        method: options.method ?? 'GET',
        headers,
        body: options.body === undefined ? undefined : JSON.stringify(options.body),
        credentials: 'same-origin',
        signal: options.signal,
      });

      if (!response.ok) {
        let code = 'PATIENT_PORTAL_UNAVAILABLE';
        let message = 'Request failed';
        try {
          const payload = (await response.json()) as { code?: string; message?: string };
          if (payload.code) code = payload.code;
          if (payload.message) message = payload.message;
        } catch {
          /* ignore non-JSON */
        }
        const error: PortalApiError = {
          code,
          message,
          status: response.status,
          correlationId: response.headers.get('x-correlation-id') ?? correlationId,
        };
        throw error;
      }

      if (response.status === 204) {
        return undefined as T;
      }
      return (await response.json()) as T;
    },
  };
}
