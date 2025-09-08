import type { DataRecord, ConsolidatedRecord, Dictionary, CutoutRecord } from './types';

// In absence of a backend we will load static JSON via fetch (can be swapped later)

export const loadDatabase = async (): Promise<DataRecord[]> => {
  const res = await fetch('/data/database.json');
  return res.json();
};

export const loadConsolidated = async (): Promise<ConsolidatedRecord[]> => {
  const res = await fetch('/data/consolidated_database.json');
  return res.json();
};

export const loadDictionary = async (): Promise<Dictionary> => {
  // dictionary.npy not easily consumable directly; expect a JSON conversion later.
  // Placeholder expects a json representation placed at /data/dictionary.json
  const res = await fetch('/data/dictionary.json');
  return res.json();
};

export const loadCutouts = async (): Promise<CutoutRecord[]> => {
  const res = await fetch('/data/cutouts.json');
  return res.json();
};

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
