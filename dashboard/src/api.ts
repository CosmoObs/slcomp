import type { DataRecord, ConsolidatedRecord, Dictionary, CutoutRecord } from './types';

// NOTE: When deployed on GitHub Pages the app is usually served from /<repo-name>/.
// Using absolute paths (starting with "/") causes fetches to point at the domain root
// (e.g. https://<user>.github.io/data/...) which 404s and returns the HTML index page.
// That HTML then triggers: "SyntaxError: Unexpected token '<'" when res.json() is called.
// We instead build URLs relative to Vite's injected BASE_URL (import.meta.env.BASE_URL).

const BASE_URL: string = (import.meta as { env?: Record<string, string> }).env?.BASE_URL || '/';

const buildDataUrl = (file: string) => {
  // Ensure exactly one trailing slash for BASE_URL then append data/<file>
  const base = BASE_URL.endsWith('/') ? BASE_URL : `${BASE_URL}/`;
  return `${base}data/${file}`;
};

// Add request optimization and caching
const requestCache = new Map<string, Promise<any>>();

async function fetchJson<T>(file: string): Promise<T> {
  const url = buildDataUrl(file);
  
  // Return cached promise if available
  if (requestCache.has(url)) {
    return requestCache.get(url);
  }
  
  const fetchPromise = (async () => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000); // 30s timeout
    
    try {
      const res = await fetch(url, { 
        cache: 'force-cache', // Use browser cache when available
        signal: controller.signal,
        headers: {
          'Accept': 'application/json',
          'Cache-Control': 'public, max-age=3600' // Cache for 1 hour
        }
      });
      
      clearTimeout(timeoutId);
      
      if (!res.ok) {
        // Surface clearer diagnostics when something goes wrong (like path issues on Pages)
        const text = await res.text();
        throw new Error(`Failed to fetch ${url} (HTTP ${res.status}) - First 120 chars: ${text.slice(0, 120)}`);
      }
      
      const data = await res.json();
      return data;
    } catch (err) {
      clearTimeout(timeoutId);
      
      if (err instanceof Error && err.name === 'AbortError') {
        throw new Error(`Request timeout for ${url}`);
      }
      
      // Provide snippet of body to aid debugging of unexpected HTML responses
      throw new Error(`Failed to load ${url}: ${(err as Error).message}`);
    }
  })();
  
  // Cache the promise
  requestCache.set(url, fetchPromise);
  
  // Remove from cache after completion (success or failure)
  fetchPromise.finally(() => {
    setTimeout(() => requestCache.delete(url), 5000); // Keep cache for 5s
  });
  
  return fetchPromise;
}

// Public data loaders (can be swapped for real API later)
export const loadDatabase = (): Promise<DataRecord[]> => fetchJson<DataRecord[]>('database.json');
export const loadConsolidated = (): Promise<ConsolidatedRecord[]> => fetchJson<ConsolidatedRecord[]>('consolidated_database.json');
export const loadDictionary = (): Promise<Dictionary> => fetchJson<Dictionary>('dictionary.json');
export const loadCutouts = (): Promise<CutoutRecord[]> => fetchJson<CutoutRecord[]>('cutouts.json');

// MinIO direct image retrieval (signed URL pattern) - placeholder using fetch of gateway
// Direct public path construction (no proxy). Expect objectKey like
//   Processed_Cutouts/20asec/HSC/J100139....png
// Base endpoint rules:
//  - If VITE_MINIO_ENDPOINT includes scheme (http:// or https://) we use it verbatim.
//  - Else we prepend scheme from VITE_MINIO_SCHEME (default 'https').
//  - This allows using plain HTTP during local dev / tunnels without mixed content surprises.
// const RAW_ENDPOINT: string | undefined = (import.meta as { env?: Record<string, string> }).env?.VITE_MINIO_ENDPOINT;
const RAW_ENDPOINT: string | undefined = "nonarithmetically-undeliberating-janelle.ngrok-free.app";
const ENDPOINT_SCHEME: string = ((import.meta as { env?: Record<string, string> }).env?.VITE_MINIO_SCHEME || 'https').replace(/:$/,'');
export const buildCutoutUrl = (objectKey: string): string => {
  const cleaned = objectKey.trim().replace(/^\/+/, '');
  // Ensure Cutouts/ prefix once
  const path = cleaned.startsWith('Cutouts/') ? cleaned : `Cutouts/${cleaned}`;
  if(!RAW_ENDPOINT) return path; // fallback relative path if not configured
  let base = RAW_ENDPOINT.trim();
  if(!/^https?:\/\//i.test(base)) {
    base = `${ENDPOINT_SCHEME}://${base}`;
  }
  base = base.replace(/\/$/, '');
  const url = `${base}/slcomp/${path}`;
  if((import.meta as { env?: Record<string, string> }).env?.VITE_DEBUG_CUTOUTS) console.debug('[cutout-url]', { objectKey, path, url, base, scheme: ENDPOINT_SCHEME });
  return url;
};

// Simple async wrapper (keeps existing calling pattern with react-query)
export const getCutoutObject = async (objectKey: string): Promise<string | null> => {
  const url = buildCutoutUrl(objectKey);
  
  // For ngrok URLs, we need to add headers to bypass the browser warning
  if (RAW_ENDPOINT && RAW_ENDPOINT.includes('ngrok')) {
    try {
      console.log('[DEBUG] Fetching image with ngrok headers:', url);
      
      // Create a new URL object to add ngrok bypass headers
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'ngrok-skip-browser-warning': 'true',
          'User-Agent': 'LaStBeRu-Explorer/1.0 (Custom)'
        },
        mode: 'cors',
        credentials: 'omit'
      });
      
      console.log('[DEBUG] Response status:', response.status, response.statusText);
      
      if (response.ok) {
        // Convert to blob URL for better browser handling
        const blob = await response.blob();
        const blobUrl = URL.createObjectURL(blob);
        console.log('[DEBUG] Created blob URL:', blobUrl);
        return blobUrl;
      } else {
        console.warn('[DEBUG] Response not ok:', response.status, response.statusText);
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
    } catch (error) {
      console.warn('Failed to fetch image with headers:', error);
      // Try creating an image element that can handle the ngrok redirect
      return new Promise((resolve) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
          console.log('[DEBUG] Image loaded successfully via img element');
          resolve(url);
        };
        img.onerror = () => {
          console.warn('[DEBUG] Image failed to load via img element');
          resolve(url); // Still return URL, let the component handle the error
        };
        img.src = url;
      });
    }
  }
  
  console.log('[DEBUG] Using direct URL:', url);
  return url;
};
