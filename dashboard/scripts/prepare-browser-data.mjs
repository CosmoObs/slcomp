import { readFile, writeFile, mkdir, rename, rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dataBucket } from '../src/dataBucket.js';

const directory = process.argv[2] || fileURLToPath(new URL('../public/data/', import.meta.url));
const sources = ['database', 'consolidated_database', 'cutouts'];
const shards = Array.from({ length: 256 }, () => Object.create(null));
const objects = new Map();
const domain = {};
const numeric = value => {
  const number = typeof value === 'number' ? value : typeof value === 'string' ? parseFloat(value) : NaN;
  return Number.isNaN(number) ? null : number;
};
for (const source of sources) {
  const rows = JSON.parse(await readFile(`${directory}/${source}.json`, 'utf8'));
  for (const row of rows) {
    if (!row?.JNAME) continue;
    const shard = shards[parseInt(dataBucket(row.JNAME), 16)];
    const detail = shard[row.JNAME] ||= { database: [], consolidated: [], cutouts: [] };
    detail[source === 'consolidated_database' ? 'consolidated' : source].push(row);
    if (source !== 'database') continue;
    let summary = objects.get(row.JNAME);
    if (!summary) {
      summary = { JNAME: row.JNAME, RA: null, DEC: null, z_L: null, z_S: null, recordCount: 0, imageCount: 0 };
      objects.set(row.JNAME, summary);
    }
    summary.recordCount++;
    for (const key of ['RA', 'DEC', 'z_L', 'z_S']) {
      const value = numeric(row[key]);
      if (value === null) continue;
      const range = domain[key] ||= { min: value, max: value };
      range.min = Math.min(range.min, value);
      range.max = Math.max(range.max, value);
      if (summary[key] === null) summary[key] = value;
    }
  }
}
for (const summary of objects.values()) summary.imageCount = shards[parseInt(dataBucket(summary.JNAME), 16)][summary.JNAME].cutouts.length;
const temporary = `${directory}/objects.tmp`;
await rm(temporary, { recursive: true, force: true });
await mkdir(temporary, { recursive: true });
await Promise.all(shards.map((shard, index) => writeFile(`${temporary}/${index.toString(16).padStart(2, '0')}.json`, JSON.stringify(shard))));
await writeFile(`${directory}/catalog.tmp`, JSON.stringify({ objects: Array.from(objects.values()), domain }));
await rm(`${directory}/objects`, { recursive: true, force: true });
await rename(temporary, `${directory}/objects`);
await rename(`${directory}/catalog.tmp`, `${directory}/catalog.json`);
console.log(`Prepared ${objects.size} catalog objects and 256 detail shards.`);
