import type { DataRecord, ConsolidatedRecord, Dictionary, CutoutRecord } from './types';

// When deployed on GitHub Pages the app is served from /<repo-name>/.
// We build URLs relative to Vite's injected BASE_URL so static JSON in
// public/data/ resolves correctly under any subpath.
const BASE_URL: string = (import.meta as { env?: Record<string, string> }).env?.BASE_URL || '/';

const buildDataUrl = (file: string) => {
  const base = BASE_URL.endsWith('/') ? BASE_URL : `${BASE_URL}/`;
  return `${base}data/${file}`;
};

async function fetchJson<T>(file: string): Promise<T> {
  const url = buildDataUrl(file);
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30000);

  try {
    const res = await fetch(url, { signal: controller.signal, headers: { Accept: 'application/json' } });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Failed to fetch ${url} (HTTP ${res.status}) - First 120 chars: ${text.slice(0, 120)}`);
    }
    return await res.json();
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      throw new Error(`Request timeout for ${url}`);
    }
    throw err;
  } finally {
    clearTimeout(timeoutId);
  }
}

export const loadDatabase = (): Promise<DataRecord[]> => fetchJson<DataRecord[]>('database.json');
export const loadConsolidated = (): Promise<ConsolidatedRecord[]> => fetchJson<ConsolidatedRecord[]>('consolidated_database.json');
export const loadDictionary = (): Promise<Dictionary> => fetchJson<Dictionary>('dictionary.json');
export const loadCutouts = (): Promise<CutoutRecord[]> => fetchJson<CutoutRecord[]>('cutouts.json');

// MinIO direct image retrieval.
// Endpoint resolution rules:
//  - VITE_MINIO_ENDPOINT may include a scheme (http:// or https://); if not,
//    we prepend VITE_MINIO_SCHEME (default 'https').
//  - In dev, requests go through the Vite proxy in vite.config.ts, which
//    injects the zrok interstitial-bypass header.
const env = (import.meta as { env?: Record<string, string> }).env || {};
const RAW_ENDPOINT: string | undefined = env.VITE_MINIO_ENDPOINT;
const ENDPOINT_SCHEME: string = (env.VITE_MINIO_SCHEME || 'https').replace(/:$/, '');
const DEBUG_CUTOUTS = !!env.VITE_DEBUG_CUTOUTS;

export const buildCutoutUrl = (objectKey: string): string => {
  const cleaned = objectKey.trim().replace(/^\/+/, '');
  const path = cleaned.startsWith('Cutouts/') ? cleaned : `Cutouts/${cleaned}`;

  if (env.DEV) {
    const proxied = '/proxy-cutouts/' + path.replace(/^Cutouts\//, '');
    if (DEBUG_CUTOUTS) console.debug('[cutout-url-dev-proxy]', { objectKey, path, proxied });
    return proxied;
  }

  if (!RAW_ENDPOINT) {
    const base = BASE_URL.endsWith('/') ? BASE_URL : `${BASE_URL}/`;
    return `${base}${path}`;
  }

  let base = RAW_ENDPOINT.trim();
  if (!/^https?:\/\//i.test(base)) base = `${ENDPOINT_SCHEME}://${base}`;
  base = base.replace(/\/$/, '');
  const url = `${base}/slcomp/${path}`;
  if (DEBUG_CUTOUTS) console.debug('[cutout-url]', { objectKey, path, url });
  return url;
};

// Cache of blob URLs keyed by source URL. We intentionally do NOT revoke
// these on component unmount: react-query keeps the URL string in its cache
// for `staleTime`, and revoking would leave broken images on remount.
// The map bounds growth — same URL fetched twice reuses the same blob.
const blobCache = new Map<string, string>();

export const getCutoutObject = async (objectKey: string): Promise<string | null> => {
  const url = buildCutoutUrl(objectKey);

  if (env.DEV) return url;

  const cached = blobCache.get(url);
  if (cached) return cached;

  try {
    const response = await fetch(url, {
      headers: { skip_zrok_interstitial: 'true', Accept: 'image/*' }
    });
    if (!response.ok) throw new Error(`HTTP ${response.status} ${response.statusText}`);
    const blob = await response.blob();
    const blobUrl = URL.createObjectURL(blob);
    blobCache.set(url, blobUrl);
    return blobUrl;
  } catch (error) {
    if (DEBUG_CUTOUTS) console.error('[cutout-fetch-failed]', { objectKey, url, error });
    return url;
  }
};
