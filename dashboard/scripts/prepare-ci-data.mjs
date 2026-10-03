// Minimal representative catalog for CI; deployment always uses MinIO sources.
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
const directory = fileURLToPath(new URL('../public/data/', import.meta.url));
await mkdir(directory, { recursive: true });
const jname = 'J084317.9+230501.2';
const records = [
  { JNAME: jname, RA: 130.8246, DEC: 23.0837, z_L: 0.3, z_S: 1.1, Reference: 'Example' },
  { JNAME: jname, RA: 130.8246, DEC: 23.0837, z_L: null, z_S: 1.2, Reference: 'Example II' },
  { JNAME: 'J000025.6+283211.9', RA: 0.10646, DEC: 28.53665, z_L: 0.3507, z_S: 1.171 }
];
const files = {
  database: records,
  consolidated_database: [records[0], records[2]],
  cutouts: [{ JNAME: jname, survey: 'Example', band: 'r', file_path: 'example.png' }],
  dictionary: { Example: { JNAME: [jname] }, 'Example II': { JNAME: [jname] } }
};
for (const [name, data] of Object.entries(files)) await writeFile(`${directory}/${name}.json`, JSON.stringify(data));
