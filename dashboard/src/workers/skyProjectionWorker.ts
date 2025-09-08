// Web Worker for sky projection calculations
// This offloads the heavy Mollweide projection computation from the main thread

interface SkyObject {
  JNAME: string;
  RA?: number | null;
  DEC?: number | null;
  [k: string]: unknown;
}

interface ProjectedPoint {
  x: number;
  y: number;
  jname: string;
  ra: number;
  dec: number;
}

// Convert RA (deg 0..360) to Mollweide longitude λ (deg -180..180)
const raToLon = (raDeg: number) => {
  const wrapped = ((raDeg + 180) % 360) - 180;
  return -wrapped;
};

const deg2rad = (d: number) => d * Math.PI / 180;

// Solve for theta in Mollweide projection: 2θ + sin 2θ = π sin φ
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

// Project objects to Mollweide coordinates
function projectObjects(objects: SkyObject[]): ProjectedPoint[] {
  const result: ProjectedPoint[] = [];
  
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

// Listen for messages from main thread
self.onmessage = function(e) {
  const { objects, requestId } = e.data;
  
  try {
    const projectedPoints = projectObjects(objects);
    
    // Send result back to main thread
    self.postMessage({
      requestId,
      projectedPoints,
      success: true
    });
  } catch (error) {
    self.postMessage({
      requestId,
      error: error instanceof Error ? error.message : 'Unknown error',
      success: false
    });
  }
};

export {}; // Make this a module
