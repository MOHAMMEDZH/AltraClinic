import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/app/providers/AuthProvider';
import { useOnlineStatus } from '@/features/auth/hooks/useOnlineStatus';
import { shouldUseDemoFallback } from '@/lib/demo-fallback';
import {
  createDemoMediaList,
  fetchMediaBlob,
  fetchMediaList,
  updateMediaClinical,
  uploadMedia,
} from '../api/media-api';
import type { MediaVariantType, UploadMediaOptions } from '../types/media.types';

function authKeys(user: { tenantId: string } | null) {
  return [user?.tenantId ?? 'none'] as const;
}

const blobCache = new Map<string, string>();

export function useMediaList(
  params: {
    patientId?: string;
    category?: string;
    ownerType?: string;
    ownerId?: string;
    encounterId?: string;
  },
  enabled = true,
) {
  const { getValidAccessToken, user } = useAuth();
  const online = useOnlineStatus();

  return useQuery({
    queryKey: ['media', 'list', ...authKeys(user), params],
    enabled: enabled && Boolean(params.patientId),
    queryFn: async () => {
      const token = await getValidAccessToken();
      if (!token || !user?.tenantId || !params.patientId) throw new Error('Not authenticated');
      try {
        return await fetchMediaList(token, user.tenantId, { limit: 100, ...params });
      } catch (err) {
        if (shouldUseDemoFallback(err, online)) {
          return createDemoMediaList(params.patientId);
        }
        throw err;
      }
    },
    staleTime: 20_000,
    placeholderData: (prev) => prev,
  });
}

export function useUploadMedia() {
  const { getValidAccessToken, user } = useAuth();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (options: UploadMediaOptions) => {
      const token = await getValidAccessToken();
      if (!token || !user?.tenantId) throw new Error('Not authenticated');
      return uploadMedia(token, user.tenantId, options);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['media', 'list'] });
      void qc.invalidateQueries({ queryKey: ['patients', 'timeline'] });
    },
  });
}

export function useUpdateMediaClinical() {
  const { getValidAccessToken, user } = useAuth();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({ mediaId, clinical }: { mediaId: string; clinical: Record<string, unknown> }) => {
      const token = await getValidAccessToken();
      if (!token || !user?.tenantId) throw new Error('Not authenticated');
      return updateMediaClinical(token, user.tenantId, mediaId, clinical);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['media'] });
    },
  });
}

export function useMediaBlobUrl(mediaId: string | undefined, variant: MediaVariantType = 'webp') {
  const { getValidAccessToken, user } = useAuth();
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const cacheKey = `${mediaId}:${variant}`;

  const load = useCallback(async () => {
    if (!mediaId) return;
    if (blobCache.has(cacheKey)) {
      setUrl(blobCache.get(cacheKey)!);
      return;
    }
    setLoading(true);
    setError(false);
    try {
      const token = await getValidAccessToken();
      if (!token || !user?.tenantId) throw new Error('Not authenticated');
      const blob = await fetchMediaBlob(token, user.tenantId, mediaId, variant);
      const objectUrl = URL.createObjectURL(blob);
      blobCache.set(cacheKey, objectUrl);
      setUrl(objectUrl);
    } catch {
      setError(true);
      setUrl(null);
    } finally {
      setLoading(false);
    }
  }, [cacheKey, getValidAccessToken, mediaId, user?.tenantId, variant]);

  useEffect(() => {
    void load();
  }, [load]);

  return { url, loading, error, reload: load };
}

export function revokeMediaBlobCache() {
  for (const url of blobCache.values()) URL.revokeObjectURL(url);
  blobCache.clear();
}
