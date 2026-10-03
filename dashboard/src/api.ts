import type { DataRecord, ConsolidatedRecord, Dictionary, CutoutRecord } from './types';
export { dataBucket } from './dataBucket';

// When deployed on GitHub Pages the app is served from /<repo-name>/.
// We build URLs relative to Vite's injected BASE_URL so static JSON in
// public/data/ resolves correctly under any subpath.
const BASE_URL: string = (import.meta as { env?: Record<string, string> }).env?.BASE_URL || '/';

const buildDataUrl = (file: string) => {
  const base = BASE_URL.endsWith('/') ? BASE_URL : `${BASE_URL}/`;
  return `${base}data/${file}`;
};

async function fetchJson<T>(file: string, signal?: AbortSignal): Promise<T> {
  const url = buildDataUrl(file);
  const controller = new AbortController();
  const abort = () => controller.abort();
  signal?.addEventListener('abort', abort, { once: true });
  if (signal?.aborted) controller.abort();
  let timedOut = false;
  const timeoutId = setTimeout(() => { timedOut = true; controller.abort(); }, 30000);

  try {
    const res = await fetch(url, { signal: controller.signal, headers: { Accept: 'application/json' } });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Failed to fetch ${url} (HTTP ${res.status}) - First 120 chars: ${text.slice(0, 120)}`);
    }
    return await res.json();
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError' && timedOut) {
      throw new Error(`Request timeout for ${url}`);
    }
    throw err;
  } finally {
    clearTimeout(timeoutId);
    signal?.removeEventListener('abort', abort);
  }
}

export interface CatalogObject {
  JNAME: string;
  RA: number | null;
  DEC: number | null;
  z_L: number | null;
  z_S: number | null;
  recordCount: number;
  imageCount: number;
  [key: string]: unknown;
}
export interface CatalogIndex {
  objects: CatalogObject[];
  domain: Record<string, { min: number; max: number }>;
}
export interface ObjectDetails {
  database: DataRecord[];
  consolidated: ConsolidatedRecord[];
  cutouts: CutoutRecord[];
}
export const loadCatalog = (signal?: AbortSignal): Promise<CatalogIndex> => fetchJson('catalog.json', signal);
export const loadDetails = (bucket: string, signal?: AbortSignal): Promise<Record<string, ObjectDetails>> => fetchJson(`objects/${bucket}.json`, signal);
export const loadDictionary = (): Promise<Dictionary> => fetchJson<Dictionary>('dictionary.json');

// MinIO direct image retrieval.
// Endpoint resolution rules:
//  - VITE_MINIO_ENDPOINT may include a scheme (http:// or https://); if not,
//    we prepend VITE_MINIO_SCHEME (default 'https').
//  - In dev, requests go through the Vite proxy in vite.config.ts, which
//    injects the zrok interstitial-bypass header.
const env = (import.meta as { env?: Record<string, string> }).env || {};
const RAW_ENDPOINT: string | undefined = env.VITE_MINIO_ENDPOINT;
const ENDPOINT_SCHEME: string = (env.VITE_MINIO_SCHEME || 'https').replace(/:$/, '');
// VITE_* env vars come through as strings — `!!env.VITE_DEBUG_CUTOUTS` would
// treat "false" as truthy. Accept only an explicit opt-in.
const DEBUG_CUTOUTS = ['true', '1'].includes((env.VITE_DEBUG_CUTOUTS || '').trim().toLowerCase());

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

// React Query owns each blob URL. Its cache removal event revokes the URL;
// there is no second, unbounded session cache here.
export const getCutoutObject = async (objectKey: string, signal?: AbortSignal): Promise<string | null> => {
  const url = buildCutoutUrl(objectKey);
  if (env.DEV) return url;
  try {
    const response = await fetch(url, {
      signal,
      headers: { skip_zrok_interstitial: 'true', Accept: 'image/*' }
    });
    if (!response.ok) throw new Error(`HTTP ${response.status} ${response.statusText}`);
    const blob = await response.blob();
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
    const blobUrl = URL.createObjectURL(blob);
    // Cancellation can race the promise handoff to the query cache.
    signal?.addEventListener('abort', () => URL.revokeObjectURL(blobUrl), { once: true });
    return blobUrl;
  } catch (error) {
    if (signal?.aborted) throw error;
    if (DEBUG_CUTOUTS) console.error('[cutout-fetch-failed]', { objectKey, url, error });
    return url;
  }
};
