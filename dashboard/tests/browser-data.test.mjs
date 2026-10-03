import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile, mkdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { execFile } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dataBucket } from '../src/dataBucket.js';
const run = promisify(execFile);
const exporter = fileURLToPath(new URL('../scripts/prepare-browser-data.mjs', import.meta.url));

async function fixture(t, files) {
  const directory = await mkdtemp(join(tmpdir(), 'slcomp-browser-data-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  for (const [name, rows] of Object.entries(files)) await writeFile(join(directory, `${name}.json`), JSON.stringify(rows));
  return directory;
}

test('export preserves literature records and source order while deriving first available summaries', async t => {
  const rows = [
    { JNAME: 'J0001', RA: null, DEC: '-20', z_L: '', Grade: 'A', reference: 'first' },
    { JNAME: 'J0002', RA: 0, DEC: 0, z_L: 0 },
    { JNAME: 'J0001', RA: '10.5', DEC: -21, z_L: '0.3', Grade: 'B', reference: 'second' },
    { JNAME: 'J0001', RA: 100, z_L: 2.5, interval: '[1,2]', reference: 'third' }
  ];
  const consolidated = [{ JNAME: 'J0001', value: 'source text' }];
  const cutouts = [{ JNAME: 'J0001', file_path: 'one.png' }, { JNAME: 'J0001', file_path: 'two.jpeg' }];
  const directory = await fixture(t, { database: rows, consolidated_database: consolidated, cutouts });
  await run(process.execPath, [exporter, directory]);
  const catalog = JSON.parse(await readFile(join(directory, 'catalog.json')));
  assert.deepEqual(catalog.objects, [
    { JNAME: 'J0001', RA: 10.5, DEC: -20, z_L: .3, z_S: null, recordCount: 3, imageCount: 2 },
    { JNAME: 'J0002', RA: 0, DEC: 0, z_L: 0, z_S: null, recordCount: 1, imageCount: 0 }
  ]);
  assert.deepEqual(catalog.domain, { RA: { min: 0, max: 100 }, DEC: { min: -21, max: 0 }, z_L: { min: 0, max: 2.5 } });
  const shard = JSON.parse(await readFile(join(directory, 'objects', dataBucket('J0001') + '.json')));
  assert.deepEqual(shard.J0001, { database: [rows[0], rows[2], rows[3]], consolidated, cutouts });
});

test('invalid source data does not overwrite a previously generated catalog', async t => {
  const directory = await fixture(t, { database: [], consolidated_database: [], cutouts: [] });
  await writeFile(join(directory, 'catalog.json'), 'previous index');
  await mkdir(join(directory, 'objects'));
  await writeFile(join(directory, 'objects', '00.json'), 'previous details');
  await writeFile(join(directory, 'cutouts.json'), '{invalid');
  await assert.rejects(run(process.execPath, [exporter, directory]));
  assert.equal(await readFile(join(directory, 'catalog.json'), 'utf8'), 'previous index');
  assert.equal(await readFile(join(directory, 'objects', '00.json'), 'utf8'), 'previous details');
});
