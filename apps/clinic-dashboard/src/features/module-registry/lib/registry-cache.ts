import type { ModuleRegistryBootstrapResponse } from '../api/module-registry-api';

import {

  buildRegistryCacheKey,

  type RegistryCacheIdentity,

} from './registry-cache-identity';



const CACHE_STORAGE_KEY = 'booking.moduleRegistry.bootstrap';

const CACHE_TTL_MS = 60_000;



interface CacheEntry {

  cacheKey: string;

  identity: RegistryCacheIdentity;

  etag: string;

  fetchedAt: number;

  data: ModuleRegistryBootstrapResponse;

}



let memoryCache: CacheEntry | null = null;



function isFresh(entry: CacheEntry): boolean {

  return Date.now() - entry.fetchedAt < CACHE_TTL_MS;

}



function matchesPartialIdentity(

  entry: CacheEntry,

  partial: Pick<RegistryCacheIdentity, 'tenantId' | 'userId' | 'rolesHash'>,

): boolean {

  return (

    entry.identity.tenantId === partial.tenantId &&

    entry.identity.userId === partial.userId &&

    entry.identity.rolesHash === partial.rolesHash

  );

}



export function readRegistryCache(

  partial: Pick<RegistryCacheIdentity, 'tenantId' | 'userId' | 'rolesHash'>,

): CacheEntry | null {

  const tryEntry = (entry: CacheEntry | null): CacheEntry | null => {

    if (!entry || !isFresh(entry)) return null;

    if (!matchesPartialIdentity(entry, partial)) return null;

    return entry;

  };



  const fromMemory = tryEntry(memoryCache);

  if (fromMemory) return fromMemory;



  try {

    const raw = sessionStorage.getItem(CACHE_STORAGE_KEY);

    if (!raw) return null;

    const parsed = JSON.parse(raw) as CacheEntry;

    const valid = tryEntry(parsed);

    if (valid) {

      memoryCache = parsed;

      return parsed;

    }

    sessionStorage.removeItem(CACHE_STORAGE_KEY);

    return null;

  } catch {

    return null;

  }

}



export function writeRegistryCache(

  identity: RegistryCacheIdentity,

  data: ModuleRegistryBootstrapResponse,

  etag: string,

): void {

  const cacheKey = buildRegistryCacheKey(identity);

  const entry: CacheEntry = {

    cacheKey,

    identity,

    etag,

    fetchedAt: Date.now(),

    data,

  };

  memoryCache = entry;

  try {

    sessionStorage.setItem(CACHE_STORAGE_KEY, JSON.stringify(entry));

  } catch {

    // sessionStorage may be unavailable

  }

}



export function clearRegistryCache(): void {

  memoryCache = null;

  try {

    sessionStorage.removeItem(CACHE_STORAGE_KEY);

  } catch {

    // ignore

  }

}



export function registryCacheEtag(

  partial: Pick<RegistryCacheIdentity, 'tenantId' | 'userId' | 'rolesHash'>,

): string | null {

  return readRegistryCache(partial)?.etag ?? null;

}


