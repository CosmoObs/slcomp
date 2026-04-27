// Web Worker for sky projection calculations.
// Offloads the Mollweide projection from the main thread.

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

const raToLon = (raDeg: number) => {
  const wrapped = ((raDeg + 180) % 360) - 180;
  return -wrapped;
};
const deg2rad = (d: number) => d * Math.PI / 180;

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

const toNum = (v: unknown): number =>
  typeof v === 'number' ? v : typeof v === 'string' ? parseFloat(v) : NaN;

function projectObjects(objects: SkyObject[]): ProjectedPoint[] {
  const result: ProjectedPoint[] = [];
  for (const o of objects) {
    if (!o) continue;
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

declare const self: DedicatedWorkerGlobalScope;

self.onmessage = (e: MessageEvent) => {
  const { objects, requestId } = e.data as { objects: SkyObject[]; requestId: number };
  try {
    const projectedPoints = projectObjects(objects);
    self.postMessage({ requestId, projectedPoints, success: true });
  } catch (error) {
    self.postMessage({
      requestId,
      error: error instanceof Error ? error.message : 'Unknown error',
      success: false
    });
  }
};

export {};
