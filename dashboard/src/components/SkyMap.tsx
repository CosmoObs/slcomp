import React, { useMemo, useRef, useEffect, useState, useCallback, memo } from 'react';
import { Box, Button, IconButton, Paper, Typography } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import RemoveIcon from '@mui/icons-material/Remove';
import { FootprintLayers, type FootprintImage } from './FootprintLayers';
import { SURPRISE_LOCATION } from '../skySurprise';
import SkyProjectionWorker from '../workers/skyProjectionWorker?worker';

interface SkyObject {
  JNAME: string;
  RA?: number | null;
  DEC?: number | null;
  [k: string]: unknown;
}

interface Props {
  objects: SkyObject[];
  height?: number;
  width?: number;
  onSelect: (jname: string) => void;
  selected: string;
  onSurprise: () => void;
}

interface ProjectedPoint {
  x: number;
  y: number;
  jname: string;
  ra: number;
  dec: number;
}

const MAX_X = 2 * Math.SQRT2;
const MAX_Y = Math.SQRT2;

// --- Projection helpers (used as main-thread fallback) ---
const raToLon = (raDeg: number) => {
  const wrapped = ((raDeg + 180) % 360) - 180;
  return -wrapped;
};
const deg2rad = (d: number) => d * Math.PI / 180;
const toNum = (v: unknown) => typeof v === 'number' ? v : typeof v === 'string' ? parseFloat(v) : NaN;

function solveTheta(phi: number) {
  const HALF_PI = Math.PI / 2;
  if (Math.abs(Math.abs(phi) - HALF_PI) < 1e-12) return Math.sign(phi) * HALF_PI;
  let theta = Math.max(-HALF_PI, Math.min(HALF_PI, phi));
  for (let i = 0; i < 12; i++) {
    const f = 2 * theta + Math.sin(2 * theta) - Math.PI * Math.sin(phi);
    const fp = 2 + 2 * Math.cos(2 * theta);
    if (Math.abs(fp) < 1e-12) break;
    const delta = f / fp;
    theta -= delta;
    if (Math.abs(delta) < 1e-10) break;
  }
  return theta;
}

function projectMainThread(objects: SkyObject[]): ProjectedPoint[] {
  const result: ProjectedPoint[] = [];
  for (const o of objects) {
    if (!o) continue;
    let RA = toNum(o.RA);
    const DEC = toNum(o.DEC);
    if (isNaN(RA) || isNaN(DEC)) continue;
    if (RA < 0) RA = ((RA % 360) + 360) % 360;
    if (RA >= 360) RA = RA % 360;
    if (DEC < -90 || DEC > 90) continue;
    const lon = deg2rad(raToLon(RA));
    const lat = deg2rad(DEC);
    const theta = solveTheta(lat);
    const xNorm = (2 * Math.SQRT2 / Math.PI) * lon * Math.cos(theta);
    const yNorm = -Math.SQRT2 * Math.sin(theta);
    result.push({ x: xNorm, y: yNorm, jname: o.JNAME, ra: RA, dec: DEC });
  }
  return result;
}

// --- Worker singleton (typed module worker via Vite's ?worker import) ---
interface PendingRequest {
  resolve: (r: ProjectedPoint[]) => void;
  objects: SkyObject[];
  timeoutId: ReturnType<typeof setTimeout>;
}

class WorkerPool {
  private worker: Worker | null = null;
  private nextId = 0;
  private pending = new Map<number, PendingRequest>();

  constructor() {
    try {
      this.worker = new SkyProjectionWorker();
      this.worker.onmessage = (e: MessageEvent) => {
        const { requestId, projectedPoints, success } = e.data || {};
        const req = this.pending.get(requestId);
        if (!req) return;
        clearTimeout(req.timeoutId);
        this.pending.delete(requestId);
        // On worker error, fall back immediately to main-thread projection
        // rather than letting the request hang until the timeout fires.
        if (success) req.resolve(projectedPoints);
        else req.resolve(projectMainThread(req.objects));
      };
    } catch {
      this.worker = null;
    }
  }

  project(objects: SkyObject[]): Promise<ProjectedPoint[]> {
    if (!this.worker || objects.length < 1000) {
      return Promise.resolve(projectMainThread(objects));
    }
    return new Promise((resolve) => {
      const id = ++this.nextId;
      const timeoutId = setTimeout(() => {
        if (this.pending.has(id)) {
          this.pending.delete(id);
          resolve(projectMainThread(objects));
        }
      }, 15000);
      this.pending.set(id, { resolve, objects, timeoutId });
      this.worker!.postMessage({ objects, requestId: id });
    });
  }

  destroy() {
    this.worker?.terminate();
    this.worker = null;
    for (const req of this.pending.values()) clearTimeout(req.timeoutId);
    this.pending.clear();
  }
}

const workerPool = new WorkerPool();

// Wrap the unload listener so HMR can replace it cleanly without leaving
// duplicates registered or terminating the worker mid-update.
if (typeof window !== 'undefined') {
  const handleBeforeUnload = () => workerPool.destroy();
  window.addEventListener('beforeunload', handleBeforeUnload);
  if (import.meta.hot) {
    import.meta.hot.dispose(() => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      workerPool.destroy();
    });
  }
}

export const SkyMap: React.FC<Props> = memo(({ objects, height = 360, width = 600, onSelect, selected, onSurprise }) => {
  const padding = 16;
  const baseCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const dpr = typeof window !== 'undefined' ? Math.min(2, window.devicePixelRatio || 1) : 1;
  const [canvasW, setCanvasW] = useState<number>(width);
  const [canvasH, setCanvasH] = useState<number>(height - 26);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const isPanningRef = useRef(false);
  const lastPosRef = useRef({ x: 0, y: 0 });
  const [pts, setPts] = useState<ProjectedPoint[]>([]);
  const [isProjecting, setIsProjecting] = useState(false);
  const [footprintImages, setFootprintImages] = useState<FootprintImage[]>([]);
  const [footprintOpacity, setFootprintOpacity] = useState(0.95);
  const onSurpriseRef = useRef(onSurprise);
  useEffect(() => { onSurpriseRef.current = onSurprise; }, [onSurprise]);
  const surprisePoint = useMemo(() => projectMainThread([{ JNAME: '__surprise__', ...SURPRISE_LOCATION }])[0], []);

  // Composite selected overlays once; pan/zoom draw a single texture.
  const footprintComposite = useMemo(() => {
    if (!footprintImages.length) return null;
    const canvas = document.createElement('canvas');
    canvas.width = 1024; canvas.height = 512;
    const context = canvas.getContext('2d')!;
    context.globalAlpha = footprintOpacity;
    for (const image of footprintImages) context.drawImage(image, 0, 0, 1024, 512);
    return canvas;
  }, [footprintImages, footprintOpacity]);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const element = containerRef.current;
    if (!element) return;
    let intersecting = false;
    const update = () => setVisible(intersecting && !document.hidden);
    const observer = new IntersectionObserver(entries => { intersecting = entries[0].isIntersecting; update(); });
    observer.observe(element);
    document.addEventListener('visibilitychange', update);
    return () => { observer.disconnect(); document.removeEventListener('visibilitychange', update); };
  }, []);

  // Async projection.
  useEffect(() => {
    let cancelled = false;
    if (!objects || objects.length === 0) {
      setPts([]);
      setIsProjecting(false);
      return;
    }
    setIsProjecting(true);
    workerPool.project(objects).then((p) => {
      if (cancelled) return;
      setPts(p);
      setIsProjecting(false);
    });
    return () => { cancelled = true; };
  }, [objects]);

  // Track the actual viewport dimensions, including responsive height.
  useEffect(() => {
    if (!containerRef.current) return;
    const ro = new ResizeObserver((entries) => {
      for (const e of entries) {
        setCanvasW(e.contentRect.width);
        setCanvasH(e.contentRect.height);
      }
    });
    ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, []);


  // Shared transform for hit-testing and overlay.
  const transform = useMemo(() => {
    const innerW = canvasW - padding * 2;
    const innerH = canvasH - padding * 2;
    // A single scale preserves the 2:1 Mollweide ellipse on every viewport.
    const scale = Math.max(0, Math.min(innerW / (MAX_X * 2), innerH / (MAX_Y * 2)));
    return {
      baseScaleX: scale,
      baseScaleY: scale,
      centerX: canvasW / 2 + pan.x,
      centerY: canvasH / 2 + pan.y
    };
  }, [canvasW, canvasH, pan.x, pan.y]);

  // Pan reuses native point geometry; only data, selection, radius or zoom
  // changes rebuild the 31k-point path.
  const pointPath = useMemo(() => {
    const path = new Path2D();
    if (!transform.baseScaleX) return path;
    const basePx = Math.max(0.8, Math.min(2, 12 / Math.sqrt(pts.length || 1)));
    const radius = basePx * Math.pow(zoom, 0.1) / (transform.baseScaleX * zoom);
    for (const point of pts) {
      if (point.jname === selected) continue;
      path.moveTo(point.x + radius, point.y);
      path.arc(point.x, point.y, radius, 0, Math.PI * 2);
    }
    path.moveTo(surprisePoint.x + radius, surprisePoint.y);
    path.arc(surprisePoint.x, surprisePoint.y, radius, 0, Math.PI * 2);
    return path;
  }, [pts, selected, transform.baseScaleX, zoom, surprisePoint]);

  // Index pts by JNAME so the overlay's per-frame lookup is O(1).
  const pointByJname = useMemo(() => {
    const m = new Map<string, ProjectedPoint>();
    for (const p of pts) m.set(p.jname, p);
    return m;
  }, [pts]);
  const selectedPoint = useMemo(
    () => (selected ? pointByJname.get(selected) : undefined),
    [selected, pointByJname]
  );

  // Refs that mirror volatile state, so the interaction listeners stay
  // attached for the lifetime of the canvas instead of being torn down/
  // re-attached on every pan/zoom (each pointermove was previously
  // recreating all 7 listeners via setPan -> transform -> effect re-run).
  const transformRef = useRef(transform);
  const ptsRef = useRef(pts);
  const zoomRef = useRef(zoom);
  const onSelectRef = useRef(onSelect);
  useEffect(() => { transformRef.current = transform; }, [transform]);
  useEffect(() => { ptsRef.current = pts; }, [pts]);
  useEffect(() => { zoomRef.current = zoom; }, [zoom]);
  useEffect(() => { onSelectRef.current = onSelect; }, [onSelect]);

  // --- Base layer: grid + non-selected points. Redraws only on data/viewport change. ---
  useEffect(() => {
    const canvas = baseCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = canvasW * dpr;
    const h = canvasH * dpr;
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }
    ctx.save();
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, canvasW, canvasH);

    const { baseScaleX, baseScaleY, centerX, centerY } = transform;
    if (!baseScaleX) { ctx.restore(); return; }

    // Outline ellipse.
    ctx.save();
    ctx.translate(centerX, centerY);
    ctx.scale(baseScaleX * zoom, baseScaleY * zoom);
    ctx.beginPath();
    ctx.ellipse(0, 0, MAX_X, MAX_Y, 0, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(40,120,150,0.05)';
    ctx.fill();
    ctx.lineWidth = 1 / Math.max(baseScaleX * zoom, baseScaleY * zoom);
    ctx.strokeStyle = 'rgba(120,200,220,0.5)';
    ctx.stroke();
    ctx.restore();

    // Static, preprojected MOC masks share the catalog transform and clipping.
    ctx.save();
    ctx.translate(centerX, centerY);
    ctx.scale(baseScaleX * zoom, baseScaleY * zoom);
    ctx.beginPath();
    ctx.ellipse(0, 0, MAX_X, MAX_Y, 0, 0, Math.PI * 2);
    ctx.clip();
    if (footprintComposite) ctx.drawImage(footprintComposite, -MAX_X, -MAX_Y, MAX_X * 2, MAX_Y * 2);
    ctx.restore();

    const worldLine = (segments: number[][], stroke: string, lw = 0.5) => {
      ctx.save();
      ctx.translate(centerX, centerY);
      ctx.scale(baseScaleX * zoom, baseScaleY * zoom);
      ctx.beginPath();
      for (let i = 0; i < segments.length; i++) {
        const [x, y, move] = segments[i] as [number, number, number];
        if (move) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.lineWidth = lw / Math.max(baseScaleX * zoom, baseScaleY * zoom);
      ctx.strokeStyle = stroke;
      ctx.stroke();
      ctx.restore();
    };

    if (zoom > 0.7) {
      for (let raDeg = 0; raDeg < 360; raDeg += 30) {
        const lonDeg = (((raDeg + 180) % 360) - 180) * -1;
        const lon = lonDeg * Math.PI / 180;
        const seg: number[][] = [];
        for (let latDeg = -90; latDeg <= 90; latDeg += 6) {
          const lat = latDeg * Math.PI / 180;
          const theta = solveTheta(lat);
          const x = (2 * Math.SQRT2 / Math.PI) * lon * Math.cos(theta);
          const y = -Math.SQRT2 * Math.sin(theta);
          seg.push([x, y, latDeg === -90 ? 1 : 0]);
        }
        worldLine(seg, 'rgba(255,255,255,0.08)');
      }
      for (const latDeg of [-60, -30, 0, 30, 60]) {
        const lat = latDeg * Math.PI / 180;
        const theta = solveTheta(lat);
        const seg: number[][] = [];
        for (let raDeg = 0; raDeg <= 360; raDeg += 6) {
          const lonDeg = (((raDeg + 180) % 360) - 180) * -1;
          const lon = lonDeg * Math.PI / 180;
          const x = (2 * Math.SQRT2 / Math.PI) * lon * Math.cos(theta);
          const y = -Math.SQRT2 * Math.sin(theta);
          seg.push([x, y, raDeg === 0 ? 1 : 0]);
        }
        worldLine(seg, 'rgba(255,255,255,0.08)');
      }
      if (zoom > 1.2) {
        ctx.save();
        ctx.font = '10px Roboto, sans-serif';
        ctx.fillStyle = 'rgba(255,255,255,0.85)';
        ctx.textAlign = 'center';
        for (let raDeg = 0; raDeg < 360; raDeg += 60) {
          const lonDeg = (((raDeg + 180) % 360) - 180) * -1;
          const lon = lonDeg * Math.PI / 180;
          const x = (2 * Math.SQRT2 / Math.PI) * lon * Math.cos(0);
          const y = -MAX_Y + 0.05;
          const sx = centerX + x * baseScaleX * zoom;
          const sy = centerY + y * baseScaleY * zoom + 10;
          ctx.fillText(`${raDeg}°`, sx, sy);
        }
        ctx.textAlign = 'left';
        for (const latDeg of [-60, 0, 60]) {
          const lat = latDeg * Math.PI / 180;
          const theta = solveTheta(lat);
          const y = -Math.SQRT2 * Math.sin(theta);
          const x = -MAX_X + 0.05;
          const sx = centerX + x * baseScaleX * zoom;
          const sy = centerY + y * baseScaleY * zoom + 3;
          ctx.fillText(`${latDeg}°`, sx, sy);
        }
        ctx.restore();
      }
    }

    // Points (excluding selected).
    ctx.save();
    ctx.translate(centerX, centerY);
    ctx.scale(baseScaleX * zoom, baseScaleY * zoom);

    // The hidden point uses the same cached path, radius and color.
    ctx.fillStyle = 'rgba(90,180,220,0.78)';
    ctx.fill(pointPath);
    ctx.restore();
    ctx.restore();
  }, [canvasW, canvasH, dpr, pts, zoom, transform, selected, footprintComposite, pointPath]);

  // --- Overlay: only the selected star. Redraws every frame for the pulse. ---
  useEffect(() => {
    const canvas = overlayCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = canvasW * dpr;
    const h = canvasH * dpr;
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }

    // Clear the full overlay only when selection/viewport changes. Each pulse
    // then repaints a small region around the star rather than the full canvas.
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const sx = selectedPoint ? transform.centerX + selectedPoint.x * transform.baseScaleX * zoom : 0;
    const sy = selectedPoint ? transform.centerY + selectedPoint.y * transform.baseScaleY * zoom : 0;
    const pointPx = Math.max(0.8, Math.min(2, 12 / Math.sqrt(pts.length || 1)));
    const pulseRadius = Math.max(6, pointPx * Math.pow(zoom, 0.1) * 5.2) * 3.5 + 2;
    const canAnimate = !!selectedPoint && visible && transform.baseScaleX > 0 &&
      sx > -pulseRadius && sx < canvasW + pulseRadius && sy > -pulseRadius && sy < canvasH + pulseRadius;
    let raf = 0;
    let lastDraw = 0;

    const drawOverlay = (now: number) => {
      // Preserve the pulse at 30 fps; no work while off screen.
      if (now - lastDraw < 33) {
        raf = requestAnimationFrame(drawOverlay);
        return;
      }
      lastDraw = now;

      ctx.save();
      ctx.scale(dpr, dpr);
      ctx.clearRect(sx - pulseRadius, sy - pulseRadius, pulseRadius * 2, pulseRadius * 2);

      if (selectedPoint && transform.baseScaleX > 0) {
        const p = selectedPoint;
        const { baseScaleX, baseScaleY, centerX, centerY } = transform;
        const n = pts.length || 1;
        const basePx = Math.max(0.8, Math.min(2.0, 12 / Math.sqrt(n)));
        const basePxAdj = basePx * Math.pow(zoom, 0.1);
        const pxToWorld = 1 / (baseScaleX * zoom);
        const targetPx = Math.max(6, basePxAdj * 5.2);
        const rWorld = targetPx * pxToWorld;

        ctx.translate(centerX, centerY);
        ctx.scale(baseScaleX * zoom, baseScaleY * zoom);

        const t = now * 0.001;
        const tw = 0.55 + 0.45 * 0.5 * (Math.sin(t * 5.0) + Math.sin(t * 3.2 + 1.3));
        const gradOuter = rWorld * (2.6 + 0.3 * Math.sin(t * 2.2));
        const hue = (t * 40) % 360;
        const grad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, gradOuter);
        grad.addColorStop(0, `hsla(${hue}, 95%, 78%, ${(0.85 * tw).toFixed(3)})`);
        grad.addColorStop(0.45, `hsla(${(hue + 30) % 360}, 90%, 60%, ${(0.30 * tw).toFixed(3)})`);
        grad.addColorStop(1, `hsla(${(hue + 60) % 360}, 85%, 40%, 0)`);

        ctx.beginPath();
        ctx.fillStyle = grad;
        ctx.arc(p.x, p.y, gradOuter, 0, Math.PI * 2);
        ctx.fill();

        ctx.beginPath();
        ctx.arc(p.x, p.y, rWorld * 0.6, 0, Math.PI * 2);
        ctx.fillStyle = `hsla(${hue}, 95%, 88%, 0.92)`;
        ctx.fill();

        // Spikes — plain stroke, no compositeOperation 'lighter' (cheaper).
        ctx.strokeStyle = `hsla(${hue}, 95%, 70%, ${(0.55 + 0.35 * Math.sin(t * 4)).toFixed(3)})`;
        ctx.lineWidth = 0.9 / Math.max(baseScaleX * zoom, baseScaleY * zoom);
        const spikeR = rWorld * (3.0 + 0.4 * Math.sin(t * 3.5));
        const spike = (ang: number) => {
          ctx.beginPath();
          ctx.moveTo(p.x - Math.cos(ang) * spikeR, p.y - Math.sin(ang) * spikeR);
          ctx.lineTo(p.x + Math.cos(ang) * spikeR, p.y + Math.sin(ang) * spikeR);
          ctx.stroke();
        };
        spike(0); spike(Math.PI / 2); spike(Math.PI / 4); spike(-Math.PI / 4);
      }
      ctx.restore();

      if (canAnimate) raf = requestAnimationFrame(drawOverlay);
    };

    if (canAnimate) {
      raf = requestAnimationFrame(drawOverlay);
    } else {
      // Clear once when nothing selected.
      ctx.save();
      ctx.scale(dpr, dpr);
      ctx.clearRect(0, 0, canvasW, canvasH);
      ctx.restore();
    }

    return () => { if (raf) cancelAnimationFrame(raf); };
  }, [selected, selectedPoint, pts.length, transform, canvasW, canvasH, dpr, zoom, visible]);

  // Interaction listeners — attached once on mount. Volatile state is read
  // through the refs above so we don't tear down/reattach on every pan.
  useEffect(() => {
    const canvas = overlayCanvasRef.current;
    if (!canvas) return;

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const zoomFactor = Math.exp(-e.deltaY * 0.001);
      setZoom(z => Math.max(0.4, Math.min(10, z * zoomFactor)));
    };
    const onDown = (e: PointerEvent) => {
      isPanningRef.current = true;
      lastPosRef.current = { x: e.clientX, y: e.clientY };
      canvas.setPointerCapture(e.pointerId);
      canvas.style.cursor = 'grabbing';
    };
    let panFrame = 0;
    let pendingX = 0, pendingY = 0;
    const flushPan = () => {
      panFrame = 0;
      const x = pendingX, y = pendingY;
      pendingX = pendingY = 0;
      if (x || y) setPan(p => ({ x: p.x + x, y: p.y + y }));
    };
    const onMove = (e: PointerEvent) => {
      if (!isPanningRef.current) return;
      const dx = e.clientX - lastPosRef.current.x;
      const dy = e.clientY - lastPosRef.current.y;
      lastPosRef.current = { x: e.clientX, y: e.clientY };
      pendingX += dx; pendingY += dy;
      if (!panFrame) panFrame = requestAnimationFrame(flushPan);
    };
    const onUp = (e: PointerEvent) => {
      isPanningRef.current = false;
      if (panFrame) { cancelAnimationFrame(panFrame); flushPan(); }
      try { canvas.releasePointerCapture(e.pointerId); } catch { /* not captured */ }
      canvas.style.cursor = 'grab';
    };
    const onDbl = () => { setZoom(1); setPan({ x: 0, y: 0 }); };
    const onClick = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const { baseScaleX, baseScaleY, centerX, centerY } = transformRef.current;
      const z = zoomRef.current;
      const star = surprisePoint;
      const starX = centerX + star.x * baseScaleX * z;
      const starY = centerY + star.y * baseScaleY * z;
      if (Math.hypot(starX - x, starY - y) < 8) { onSurpriseRef.current(); return; }
      let best: ProjectedPoint | null = null;
      let bestD = 9e9;
      for (const p of ptsRef.current) {
        const sx = centerX + p.x * baseScaleX * z;
        const sy = centerY + p.y * baseScaleY * z;
        const dx = sx - x; const dy = sy - y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 8 && dist < bestD) { bestD = dist; best = p; }
      }
      if (best) onSelectRef.current(best.jname);
    };

    canvas.addEventListener('wheel', onWheel, { passive: false });
    canvas.addEventListener('pointerdown', onDown);
    canvas.addEventListener('pointermove', onMove);
    canvas.addEventListener('pointerup', onUp);
    canvas.addEventListener('pointerleave', onUp);
    canvas.addEventListener('dblclick', onDbl);
    canvas.addEventListener('click', onClick);
    return () => {
      cancelAnimationFrame(panFrame);
      canvas.removeEventListener('wheel', onWheel);
      canvas.removeEventListener('pointerdown', onDown);
      canvas.removeEventListener('pointermove', onMove);
      canvas.removeEventListener('pointerup', onUp);
      canvas.removeEventListener('pointerleave', onUp);
      canvas.removeEventListener('dblclick', onDbl);
      canvas.removeEventListener('click', onClick);
    };
  }, [surprisePoint]);

  const onZoomIn = useCallback(() => setZoom(z => Math.min(z * 1.25, 10)), []);
  const onZoomOut = useCallback(() => setZoom(z => Math.max(z / 1.25, 0.4)), []);
  const onReset = useCallback(() => { setZoom(1); setPan({ x: 0, y: 0 }); }, []);

  return (
    <Paper sx={{ position: 'relative', borderTop: '1px solid', borderBottom: '1px solid', borderColor: 'divider', py: 2 }}>
      <FootprintLayers onImages={setFootprintImages} onOpacity={setFootprintOpacity} />
      <div ref={containerRef} style={{ position: 'relative', width: '100%', maxWidth: 960, aspectRatio: '16 / 9', overflow: 'hidden', margin: '0 auto' }}>
        <canvas
          ref={baseCanvasRef}
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', display: 'block' }}
        />
        <canvas
          ref={overlayCanvasRef}
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', display: 'block', cursor: 'grab' }}
        />
        {!pts.length && !isProjecting && (
          <Typography variant="caption" sx={{ position: 'absolute', top: '50%', left: 0, width: '100%', textAlign: 'center', transform: 'translateY(-50%)', color: 'text.secondary' }}>No RA/DEC available to plot.</Typography>
        )}
        {isProjecting && (
          <Typography variant="caption" sx={{ position: 'absolute', top: '50%', left: 0, width: '100%', textAlign: 'center', transform: 'translateY(-50%)', color: 'text.secondary' }}>Projecting objects...</Typography>
        )}
        <Box sx={{ position: 'absolute', right: 8, bottom: 12, display: 'flex', alignItems: 'center', gap: 0.5, zIndex: 1, bgcolor: 'background.default', borderRadius: 0, p: 0.5 }}>
          <IconButton size="small" aria-label="Zoom in" onClick={onZoomIn}><AddIcon fontSize="small" /></IconButton>
          <IconButton size="small" aria-label="Zoom out" onClick={onZoomOut}><RemoveIcon fontSize="small" /></IconButton>
          <Button size="small" onClick={onReset}>Reset view</Button>
        </Box>
      </div>
    </Paper>
  );
});

SkyMap.displayName = 'SkyMap';
