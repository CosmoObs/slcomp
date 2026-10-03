import assert from 'node:assert/strict';
import { readFile, readdir, access } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
const directory = fileURLToPath(new URL('../dist/', import.meta.url));
const html = await readFile(`${directory}/index.html`, 'utf8');
assert.match(html, /\/slcomp\/assets\//, 'Pages asset URLs must retain /slcomp/');
const index = JSON.parse(await readFile(`${directory}/data/catalog.json`));
assert(index.objects.length > 0);
assert.equal((await readdir(`${directory}/data/objects`)).filter(file => file.endsWith('.json')).length, 256);
const dataFiles = await readdir(`${directory}/data`);
for (const source of ['database.json', 'consolidated_database.json', 'cutouts.json']) assert(!dataFiles.includes(source), `Redundant source ${source} must not ship`);
const manifest = JSON.parse(await readFile(`${directory}/footprints/manifest.json`));
for (const layer of manifest.layers) {
  for (const key of ['image', 'border']) {
    assert(layer[key].endsWith('.webp'));
    await access(`${directory}/footprints/${layer[key]}`);
  }
}
await access(`${directory}/slcomp.webp`);
assert((await readdir(`${directory}/assets`)).some(file => /^observatory-.*\.webp$/.test(file)));
console.log(`Verified ${index.objects.length} objects, 256 detail shards, all footprints and lazy WebP photo.`);
