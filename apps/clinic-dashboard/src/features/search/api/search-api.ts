import { apiRequest } from '@/lib/api-client';

export interface GlobalSearchHit {
  type: string;
  id: string;
  title: string;
  subtitle: string | null;
  score?: number;
  url?: string;
}

function qs(params: Record<string, string | number | undefined>): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== '') sp.set(k, String(v));
  }
  const s = sp.toString();
  return s ? `?${s}` : '';
}

export async function globalClinicalSearch(
  token: string,
  tenantId: string,
  q: string,
  types: string,
  limit = 15,
): Promise<GlobalSearchHit[]> {
  if (!types) {
    return [];
  }

  const res = await apiRequest<{ results: GlobalSearchHit[]; hits?: GlobalSearchHit[] }>(
    `/search${qs({ q, types, limit })}`,
    { token, tenantId },
  );
  return res.results ?? res.hits ?? [];
}
