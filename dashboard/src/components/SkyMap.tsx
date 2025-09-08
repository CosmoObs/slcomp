import React, { useMemo, useRef, useEffect, useState, useCallback, memo } from 'react';
import { Paper, Typography } from '@mui/material';

interface SkyObject { 
  JNAME: string; 
  RA?: number | null; 
  DEC?: number | null; 
  [k:string]: unknown;
}

interface Props {
  objects: SkyObject[];
  height?: number;
  width?: number;
  onSelect: (jname: string)=> void;
  selected: string;
}

interface ProjectedPoint {
  x: number;
  y: number;
  jname: string;
  ra: number;
  dec: number;
}

class SkyProjectionWorker {
  private worker: Worker | null = null;
  private requestId = 0;
  private pendingRequests = new Map<number, (result: ProjectedPoint[]) => void>();

  constructor() {
    try {
      // Primary path: module worker handled by bundler
      this.worker = new Worker(
        new URL('../workers/skyProjectionWorker.ts', import.meta.url),
        { type: 'module' }
      );

      this.worker.onmessage = (e) => {
        const { requestId, projectedPoints, success } = e.data;
        const callback = this.pendingRequests.get(requestId);
        if (callback && success) {
          callback(projectedPoints);
          this.pendingRequests.delete(requestId);
        }
      };
    } catch (error) {
      console.warn('Module Worker not available; falling back to main thread.');
    }
  }

  // ... rest of class methods ...
}
      console.warn('Web Worker not available, falling back to main thread');
    }
  }

  async projectObjects(objects: SkyObject[]): Promise<ProjectedPoint[]> {
    // Fallback to main thread if worker unavailable or for small datasets
    if (!this.worker || objects.length < 1000) {
      return this.projectObjectsMainThread(objects);
    }

    return new Promise((resolve) => {
      const id = ++this.requestId;
      this.pendingRequests.set(id, resolve);
      this.worker!.postMessage({ objects, requestId: id });
      
      // Timeout fallback
      setTimeout(() => {
        if (this.pendingRequests.has(id)) {
          this.pendingRequests.delete(id);
          resolve(this.projectObjectsMainThread(objects));
        }
      }, 1000);
    });
  }

  private projectObjectsMainThread(objects: SkyObject[]): ProjectedPoint[] {
    const result: ProjectedPoint[] = [];
    const raToLon = (raDeg: number) => {
      const wrapped = ((raDeg + 180) % 360) - 180;
      return -wrapped;
    };
    const deg2rad = (d: number) => d * Math.PI / 180;
    
    function solveTheta(phi: number) {
      const HALF_PI = Math.PI / 2;
      if (Math.abs(Math.abs(phi) - HALF_PI) < 1e-12) {
        return Math.sign(phi) * HALF_PI;
      }
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

    for (const o of objects) {
      if (!o) continue;
      const toNum = (v: any) => typeof v === 'number' ? v : (typeof v === 'string' ? parseFloat(v) : NaN);
      let RA = toNum(o.RA);
      let DEC = toNum(o.DEC);
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

  destroy() {
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
    }
    this.pendingRequests.clear();
  }
}

const workerInstance = new SkyProjectionWorker();

export const SkyMap: React.FC<Props> = memo(({ objects, height=360, width=600, onSelect, selected }) => {
  const padding = 16;
  const canvasRef = useRef<HTMLCanvasElement|null>(null);
  const containerRef = useRef<HTMLDivElement|null>(null);
  const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
  const [canvasW, setCanvasW] = useState<number>(width);
  const [canvasH, setCanvasH] = useState<number>(height-26);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({x:0,y:0});
  const isPanningRef = useRef(false);
  const lastPosRef = useRef({x:0,y:0});
  const [pts, setPts] = useState<ProjectedPoint[]>([]);
  const [isProjecting, setIsProjecting] = useState(false);

  const maxX = 2*Math.SQRT2;
  const maxY = Math.SQRT2;

  // Async projection with worker
  useEffect(() => {
    if (!objects || objects.length === 0) {
      setPts([]);
      return;
    }

    setIsProjecting(true);
    workerInstance.projectObjects(objects).then((projectedPoints) => {
      setPts(projectedPoints);
      setIsProjecting(false);
    });
  }, [objects]);

  // Resize observer to adapt width (fill parent)
  useEffect(()=>{
    if(!containerRef.current) return;
    const ro = new ResizeObserver(entries=>{
      for(const e of entries){
        const w = e.contentRect.width;
        setCanvasW(w);
        setCanvasH(height-26);
      }
    });
    ro.observe(containerRef.current);
    return ()=> ro.disconnect();
  },[height]);

  // Optimized drawing function with requestAnimationFrame throttling
  const drawFrame = useRef<number>();
  const lastDrawTime = useRef<number>(0);
  // When true we already have a frame scheduled / drawing in progress.
  // Start as false so the first schedule actually enqueues a draw.
  const needsRedraw = useRef<boolean>(false);

  const draw = useCallback(()=>{
    const canvas = canvasRef.current; 
    if(!canvas) return;
    const ctx = canvas.getContext('2d'); 
    if(!ctx) return;
    
    const w = canvasW * dpr; 
    const h = canvasH * dpr;
    if(canvas.width !== w || canvas.height !== h){
      canvas.width = w; 
      canvas.height = h;
    }
    
    ctx.save();
    ctx.scale(dpr,dpr);
    ctx.clearRect(0,0,canvasW,canvasH);

    const innerW = canvasW - padding*2;
    const innerH = canvasH - padding*2;
    const baseScaleX = innerW / (maxX*2);
    const baseScaleY = innerH / (maxY*2);
    const centerX = canvasW/2 + pan.x;
    const centerY = canvasH/2 + pan.y;

    // Outline ellipse
    ctx.save();
    ctx.translate(centerX, centerY);
    ctx.scale(baseScaleX*zoom, baseScaleY*zoom);
    ctx.beginPath();
    ctx.ellipse(0,0,maxX,maxY,0,0,Math.PI*2);
    ctx.fillStyle = 'rgba(40,120,150,0.05)';
    ctx.fill();
    ctx.lineWidth = 1/Math.max(baseScaleX*zoom, baseScaleY*zoom);
    ctx.strokeStyle = 'rgba(120,200,220,0.5)';
    ctx.stroke();
    ctx.restore();

    // Helper to draw lines in world space
    const worldLine = (segments: number[][], stroke:string, lw=0.5)=>{
      ctx.save();
      ctx.translate(centerX, centerY);
      ctx.scale(baseScaleX*zoom, baseScaleY*zoom);
      ctx.beginPath();
      for(let i=0;i<segments.length;i++){
        const [x,y,move] = segments[i] as [number,number,number];
        if(move) ctx.moveTo(x,y); else ctx.lineTo(x,y);
      }
      ctx.lineWidth = lw/Math.max(baseScaleX*zoom, baseScaleY*zoom);
      ctx.strokeStyle = stroke;
      ctx.stroke();
      ctx.restore();
    };

    // Only draw grid if zoomed enough (performance optimization)
    if (zoom > 0.7) {
      // RA meridians every 30°
      for(let raDeg=0; raDeg<360; raDeg+=30){
        const lonDeg = (((raDeg + 180) % 360) - 180) * -1; // raToLon inline
        const lon = lonDeg * Math.PI / 180; // deg2rad inline
        const seg: number[][] = [];
        for(let latDeg=-90; latDeg<=90; latDeg+=6){ // Reduced resolution
          const lat = latDeg * Math.PI / 180;
          // Simplified theta calculation for grid lines
          const theta = Math.max(-Math.PI/2, Math.min(Math.PI/2, lat));
          const x = (2*Math.SQRT2/Math.PI) * lon * Math.cos(theta);
          const y = -Math.SQRT2 * Math.sin(theta)
          seg.push([x,y,latDeg===-90?1:0]);
        }
        worldLine(seg,'rgba(255,255,255,0.08)');
      }

      // DEC parallels (reduced set)
      const latLines = [-60,-30,0,30,60];
      for(const latDeg of latLines){
        const lat = latDeg * Math.PI / 180;
        const theta = Math.max(-Math.PI/2, Math.min(Math.PI/2, lat));
        const seg: number[][] = [];
        for(let raDeg=0; raDeg<=360; raDeg+=6){ // Reduced resolution
          const lonDeg = (((raDeg + 180) % 360) - 180) * -1;
          const lon = lonDeg * Math.PI / 180;
          const x = (2*Math.SQRT2/Math.PI) * lon * Math.cos(theta);
          const y = Math.SQRT2 * Math.sin(theta);
          seg.push([x,y,raDeg===0?1:0]);
        }
        worldLine(seg,'rgba(255,255,255,0.08)');
      }

      // Labels (only if zoomed enough)
      if (zoom > 1.2) {
        ctx.save();
        ctx.font = '10px Roboto, sans-serif';
        ctx.fillStyle = 'rgba(255,255,255,0.85)';
        ctx.textAlign = 'center';
        // RA labels (reduced set)
        for(let raDeg=0; raDeg<360; raDeg+=60){
          const lonDeg = (((raDeg + 180) % 360) - 180) * -1;
          const lon = lonDeg * Math.PI / 180;
          const x = (2*Math.SQRT2/Math.PI) * lon * Math.cos(0);
          const y = -maxY + 0.05;
          const sx = centerX + (x * baseScaleX*zoom);
          const sy = centerY + (y * baseScaleY*zoom) + 10;
          ctx.fillText(`${raDeg}°`, sx, sy);
        }
        ctx.textAlign = 'left';
        for(const latDeg of [-60,0,60]){
          const lat = latDeg * Math.PI / 180;
          const theta = Math.max(-Math.PI/2, Math.min(Math.PI/2, lat));
          const y = -Math.SQRT2 * Math.sin(theta);
          const x = -maxX + 0.05;
          const sx = centerX + (x * baseScaleX*zoom);
          const sy = centerY + (y * baseScaleY*zoom) + 3;
          ctx.fillText(`${latDeg}°`, sx, sy);
        }
        ctx.restore();
      }
    }

    // Optimized point rendering with LOD (Level of Detail)
    ctx.save();
    ctx.translate(centerX, centerY);
    ctx.scale(baseScaleX*zoom, baseScaleY*zoom);
    
    const n = pts.length || 1;
    const basePx = Math.max(0.8, Math.min(2.0, 12 / Math.sqrt(n)));
    const selectedMinPx = 6;
    const zoomComp = Math.pow(zoom, 0.1);
    const basePxAdj = basePx * zoomComp;
    const pxToWorld = 1 / (baseScaleX*zoom);

    // Use different rendering strategies based on point count and zoom
    const shouldUseSimpleRender = n > 5000 && zoom < 2;
    
    if (shouldUseSimpleRender) {
      // Simple rendering for many points
      ctx.fillStyle = 'rgba(90,180,220,0.78)';
      ctx.beginPath();
      for(const p of pts){
        if(p.jname === selected) continue;
        const rWorld = basePxAdj * pxToWorld;
        ctx.moveTo(p.x + rWorld, p.y);
        ctx.arc(p.x, p.y, rWorld, 0, Math.PI*2);
      }
      ctx.fill();
    } else {
      // Detailed rendering for fewer points
      for(const p of pts){
        if(p.jname === selected) continue;
        const rWorld = basePxAdj * pxToWorld;
        ctx.beginPath();
        ctx.arc(p.x,p.y, rWorld,0,Math.PI*2);
        ctx.fillStyle = 'rgba(90,180,220,0.78)';
        ctx.strokeStyle = 'rgba(0,0,0,0.45)';
        ctx.lineWidth = 0.3/Math.max(baseScaleX*zoom, baseScaleY*zoom);
        ctx.fill();
        ctx.stroke();
      }
    }

    // Selected point with colorful hue/star animation
    if(selected){
      const p = pts.find(pt=> pt.jname === selected);
      if(p){
        const targetPx = Math.max(selectedMinPx, basePxAdj * 5.2);
        const rWorld = targetPx * pxToWorld;
        const t = performance.now() * 0.001;
        const tw = 0.55 + 0.45 * 0.5 * (Math.sin(t*5.0) + Math.sin(t*3.2 + 1.3));
        const gradOuter = rWorld * (2.8 + 0.4*Math.sin(t*2.2));
        const hue = (t*40) % 360;
        const hue2 = (hue + 25) % 360;
        const hue3 = (hue + 55) % 360;
        const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, gradOuter);
        g.addColorStop(0, `hsla(${hue}, 95%, 78%, ${(0.90*tw).toFixed(3)})`);
        g.addColorStop(0.25, `hsla(${hue2}, 90%, 62%, ${(0.42*tw).toFixed(3)})`);
        g.addColorStop(0.55, `hsla(${hue3}, 85%, 50%, ${(0.18*tw).toFixed(3)})`);
        g.addColorStop(1, `hsla(${hue3}, 85%, 40%, 0)`);
        ctx.save();
        ctx.beginPath();
        ctx.fillStyle = g;
        ctx.arc(p.x,p.y, gradOuter, 0, Math.PI*2);
        ctx.fill();
        ctx.restore();
        // core
        ctx.beginPath();
        ctx.arc(p.x,p.y, rWorld*0.6, 0, Math.PI*2);
        ctx.fillStyle = `hsla(${hue}, 95%, 88%, 0.92)`;
        ctx.fill();
        // spikes
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.strokeStyle = `hsla(${hue}, 95%, 70%, ${(0.55+0.35*Math.sin(t*4)).toFixed(3)})`;
        ctx.lineWidth = 0.9/Math.max(baseScaleX*zoom, baseScaleY*zoom);
        const spikeR = rWorld * (3.2 + 0.5*Math.sin(t*3.5));
        const drawSpike = (ang:number)=>{
          ctx.beginPath();
          ctx.moveTo(p.x - Math.cos(ang)*spikeR, p.y - Math.sin(ang)*spikeR);
          ctx.lineTo(p.x + Math.cos(ang)*spikeR, p.y + Math.sin(ang)*spikeR);
          ctx.stroke();
        };
        drawSpike(0); drawSpike(Math.PI/2); drawSpike(Math.PI/4); drawSpike(-Math.PI/4);
        ctx.restore();
      }
    }
    ctx.restore();
    ctx.restore();
    needsRedraw.current = false;
  },[canvasW, canvasH, dpr, pts, pan, zoom, height, selected]);

  // Throttled redraw
  const scheduleRedraw = useCallback(() => {
    needsRedraw.current = true;
    if (drawFrame.current) cancelAnimationFrame(drawFrame.current);
    drawFrame.current = requestAnimationFrame(() => {
      const now = performance.now();
      if (now - lastDrawTime.current >= 16) { // ~60fps cap
        draw();
        lastDrawTime.current = now;
      } else {
        scheduleRedraw();
      }
    });
  }, [draw]);

  // Animation loop only for selected items
  const animationRef = useRef<number>();
  useEffect(() => {
    if (!selected) {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
        animationRef.current = undefined;
      }
      scheduleRedraw(); // Draw once without animation
      return;
    }
    
    const animate = () => {
      scheduleRedraw();
      animationRef.current = requestAnimationFrame(animate);
    };
    animationRef.current = requestAnimationFrame(animate);
    
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
        animationRef.current = undefined;
      }
    };
  }, [selected, scheduleRedraw]);

  // Trigger redraws on data/state changes
  useEffect(() => scheduleRedraw(), [pts, pan, zoom, canvasW, canvasH, scheduleRedraw]);

  // Cleanup
  useEffect(() => {
    return () => {
      if (drawFrame.current) cancelAnimationFrame(drawFrame.current);
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, []);

  // Interaction handlers
  useEffect(()=>{
    const canvas = canvasRef.current; if(!canvas) return;
    const onWheel = (e:WheelEvent)=>{
      e.preventDefault();
      const delta = e.deltaY; // positive => zoom out
      const zoomFactor = Math.exp(-delta*0.001); // smooth
      setZoom(z=>{
        let nz = z*zoomFactor; if(nz<0.4) nz=0.4; if(nz>10) nz=10; return nz;
      });
    };
    const onDown = (e:PointerEvent)=>{
      isPanningRef.current = true;
      lastPosRef.current = {x:e.clientX, y:e.clientY};
      canvas.setPointerCapture(e.pointerId);
    };
    const onMove = (e:PointerEvent)=>{
      if(!isPanningRef.current) return;
      const dx = e.clientX - lastPosRef.current.x;
      const dy = e.clientY - lastPosRef.current.y;
      lastPosRef.current = {x:e.clientX, y:e.clientY};
      setPan(p=> ({x: p.x + dx, y: p.y + dy}));
    };
    const onUp = (e:PointerEvent)=>{
      isPanningRef.current = false;
      canvas.releasePointerCapture(e.pointerId);
    };
    const onDbl = ()=>{ setZoom(1); setPan({x:0,y:0}); };
    const onClick = (e:MouseEvent)=>{
      // hit test nearest point within 8px
      const rect = canvas.getBoundingClientRect();
      const x = (e.clientX - rect.left);
      const y = (e.clientY - rect.top);
      // Convert each point to screen
      const innerW = canvasW - padding*2;
      const innerH = canvasH - padding*2;
      const baseScaleX = innerW / (maxX*2);
      const baseScaleY = innerH / (maxY*2);
      const centerX = canvasW/2 + pan.x;
      const centerY = canvasH/2 + pan.y;
      let best:any = null; let bestD = 9e9;
      for(const p of pts){
        const sx = centerX + (p.x * baseScaleX*zoom);
        const sy = centerY + (p.y * baseScaleY*zoom);
        const dx = sx - x; const dy = sy - y; const dist = Math.sqrt(dx*dx+dy*dy);
        if(dist < 8 && dist < bestD){ bestD = dist; best = p; }
      }
      if(best){ onSelect(best.jname); }
    };
    canvas.addEventListener('wheel', onWheel, { passive:false });
    canvas.addEventListener('pointerdown', onDown);
    canvas.addEventListener('pointermove', onMove);
    canvas.addEventListener('pointerup', onUp);
    canvas.addEventListener('pointerleave', onUp);
    canvas.addEventListener('dblclick', onDbl);
    canvas.addEventListener('click', onClick);
    return ()=>{
      canvas.removeEventListener('wheel', onWheel as any);
      canvas.removeEventListener('pointerdown', onDown as any);
      canvas.removeEventListener('pointermove', onMove as any);
      canvas.removeEventListener('pointerup', onUp as any);
      canvas.removeEventListener('pointerleave', onUp as any);
      canvas.removeEventListener('dblclick', onDbl as any);
      canvas.removeEventListener('click', onClick as any);
    };
  },[canvasW, canvasH, pts, pan, zoom, onSelect]);

  return (
  <Paper sx={{ p:1, height, minHeight:{ xs:240, sm:height }, position:'relative', background:'rgba(255,255,255,0.02)', border:'1px solid rgba(255,255,255,0.05)', backdropFilter:'blur(4px)', display:'flex', flexDirection:'column' }}>
      <Typography variant="caption" sx={{ pl:1, fontWeight:600, letterSpacing:0.5, mb:0.5 }}>
        Sky — {pts.length} pts | zoom {zoom.toFixed(2)} {isProjecting && '(projecting...)'}
      </Typography>
      <div ref={containerRef} style={{ flex:1, position:'relative' }}>
        <canvas ref={canvasRef} style={{ width:'100%', height:'100%', display:'block', cursor: isPanningRef.current? 'grabbing':'grab' }} />
        {(!pts.length && !isProjecting) && (
          <Typography variant="caption" sx={{ position:'absolute', top:'50%', left:0, width:'100%', textAlign:'center', transform:'translateY(-50%)', color:'text.secondary' }}>No RA/DEC available to plot.</Typography>
        )}
        {isProjecting && (
          <Typography variant="caption" sx={{ position:'absolute', top:'50%', left:0, width:'100%', textAlign:'center', transform:'translateY(-50%)', color:'text.secondary' }}>Projecting objects...</Typography>
        )}
        <div style={{ position:'absolute', right:8, bottom:18, display:'flex', flexDirection:'column', gap:4 }}>
          <button style={{ fontSize:11, padding:'2px 6px', background:'rgba(255,255,255,0.08)', border:'1px solid rgba(255,255,255,0.15)', color:'#fff', borderRadius:4, cursor:'pointer' }} onClick={()=> setZoom(z=> Math.min(z*1.25,10))}>＋</button>
          <button style={{ fontSize:11, padding:'2px 6px', background:'rgba(255,255,255,0.08)', border:'1px solid rgba(255,255,255,0.15)', color:'#fff', borderRadius:4, cursor:'pointer' }} onClick={()=> setZoom(z=> Math.max(z/1.25,0.4))}>－</button>
          <button style={{ fontSize:10, padding:'2px 4px', background:'rgba(255,255,255,0.08)', border:'1px solid rgba(255,255,255,0.15)', color:'#fff', borderRadius:4, cursor:'pointer' }} onClick={()=> { setZoom(1); setPan({x:0,y:0}); }}>reset</button>
        </div>
      </div>
    </Paper>
  );
});

SkyMap.displayName = 'SkyMap';

// Cleanup worker on component unmount
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => {
    workerInstance.destroy();
  });
}
