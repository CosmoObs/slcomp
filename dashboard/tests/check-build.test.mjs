import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile, mkdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { execFile } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const run = promisify(execFile);
const checker = fileURLToPath(new URL('../scripts/check-build.mjs', import.meta.url));
const manifestSource = new URL('../public/footprints/manifest.json', import.meta.url);

async function artifact(t) {
  const directory = await mkdtemp(join(tmpdir(), 'slcomp-build-check-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  for (const path of ['data/objects', 'footprints', 'assets']) {
    await mkdir(join(directory, path), { recursive: true });
  }
  await writeFile(join(directory, 'index.html'), '<script src="/slcomp/assets/index.js"></script>');
  await writeFile(join(directory, 'data/catalog.json'), JSON.stringify({ objects: [{ JNAME: 'J0001' }] }));
  await Promise.all(Array.from({ length: 256 }, (_, index) =>
    writeFile(join(directory, 'data/objects', `${index.toString(16).padStart(2, '0')}.json`), '{}')));
  const manifest = JSON.parse(await readFile(manifestSource, 'utf8'));
  await writeFile(join(directory, 'footprints/manifest.json'), JSON.stringify(manifest));
  for (const layer of manifest.layers) {
    for (const key of ['image', 'border']) await writeFile(join(directory, 'footprints', layer[key]), 'asset');
  }
  await writeFile(join(directory, 'slcomp.webp'), 'asset');
  await writeFile(join(directory, 'assets/observatory-test.webp'), 'asset');
  return { directory, manifest };
}

test('build validation accepts the complete footprint set regardless of order', async t => {
  const { directory, manifest } = await artifact(t);
  manifest.layers.reverse();
  await writeFile(join(directory, 'footprints/manifest.json'), JSON.stringify(manifest));
  await run(process.execPath, [checker, directory]);
});

test('build validation rejects missing, duplicate and unexpected footprint IDs', async t => {
  const { directory, manifest } = await artifact(t);
  const variants = [
    manifest.layers.slice(1),
    [...manifest.layers, manifest.layers[0]],
    [{ ...manifest.layers[0], id: 'unexpected' }, ...manifest.layers.slice(1)],
  ];
  for (const layers of variants) {
    await writeFile(join(directory, 'footprints/manifest.json'), JSON.stringify({ ...manifest, layers }));
    await assert.rejects(run(process.execPath, [checker, directory]), error =>
      error.stderr.includes('Footprint manifest must contain exactly the expected 28 layers'));
  }
});

test('build validation rejects a missing overlay file even with a complete manifest', async t => {
  const { directory, manifest } = await artifact(t);
  await rm(join(directory, 'footprints', manifest.layers[0].border));
  await assert.rejects(run(process.execPath, [checker, directory]), error => error.stderr.includes('ENOENT'));
});
