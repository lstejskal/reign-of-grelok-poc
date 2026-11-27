// Packs the production build (packages/client/dist) into an itch.io-ready zip: release/reign-of-grelok-web.zip.
// Run `npm run package:web` (builds first). Checks itch.io's HTML5 rules: index.html at the zip's top level,
// relative paths only, at most 1000 files, 500 MB unpacked, 200 MB per file, paths up to 240 characters.
// The zip writer is a small hand-made one (Node has deflate and crc32 built in), so no extra dependency is needed.
import { mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { crc32, deflateRawSync } from 'node:zlib';

const root = resolve(import.meta.dirname, '..');
const dist = join(root, 'packages/client/dist');
const outDir = join(root, 'release');
const outFile = join(outDir, 'reign-of-grelok-web.zip');

function listFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    return statSync(full).isDirectory() ? listFiles(full) : [full];
  });
}

const files = listFiles(dist)
  .map((full) => ({ name: relative(dist, full).split('\\').join('/'), data: readFileSync(full) }))
  .sort((a, b) => a.name.localeCompare(b.name));

// itch.io's limits for HTML5 zips (https://itch.io/docs/creators/html5).
const problems: string[] = [];
if (!files.some((f) => f.name === 'index.html')) problems.push('no index.html at the top level (run `npm run build`)');
if (files.length > 1000) problems.push(`${files.length} files (itch.io allows 1000)`);
const total = files.reduce((sum, f) => sum + f.data.length, 0);
if (total > 500 * 1024 * 1024) problems.push(`${(total / 1048576).toFixed(0)} MB unpacked (itch.io allows 500 MB)`);
for (const f of files) {
  if (f.data.length > 200 * 1024 * 1024) problems.push(`${f.name} is over 200 MB`);
  if (f.name.length > 240) problems.push(`${f.name} has a path over 240 characters`);
}
const index = files.find((f) => f.name === 'index.html');
if (index && /(src|href)="\/(?!\/)/.test(index.data.toString('utf8'))) {
  problems.push('index.html uses absolute paths ("/..."); set `base: \'./\'` in vite.config.ts');
}
if (problems.length > 0) {
  console.error(`Cannot package the web build:\n  - ${problems.join('\n  - ')}`);
  process.exit(1);
}

// --- zip writer: local headers + data, then the central directory, then the end record ---
const DOS_TIME = 0; // 00:00:00
const DOS_DATE = (2026 - 1980) << 9 | 1 << 5 | 1; // fixed date, so the same build gives the same zip
const parts: Buffer[] = [];
const central: Buffer[] = [];
let offset = 0;
for (const f of files) {
  const name = Buffer.from(f.name, 'utf8');
  const deflated = deflateRawSync(f.data, { level: 9 });
  const stored = deflated.length >= f.data.length; // already-compressed files (png, mp3) are kept as they are
  const body = stored ? f.data : deflated;
  const crc = crc32(f.data);

  const local = Buffer.alloc(30);
  local.writeUInt32LE(0x04034b50, 0);
  local.writeUInt16LE(20, 4); // version needed
  local.writeUInt16LE(0x0800, 6); // flag: names are UTF-8
  local.writeUInt16LE(stored ? 0 : 8, 8);
  local.writeUInt16LE(DOS_TIME, 10);
  local.writeUInt16LE(DOS_DATE, 12);
  local.writeUInt32LE(crc, 14);
  local.writeUInt32LE(body.length, 18);
  local.writeUInt32LE(f.data.length, 22);
  local.writeUInt16LE(name.length, 26);
  local.writeUInt16LE(0, 28);
  parts.push(local, name, body);

  const entry = Buffer.alloc(46);
  entry.writeUInt32LE(0x02014b50, 0);
  entry.writeUInt16LE(20, 4); // version made by
  entry.writeUInt16LE(20, 6);
  entry.writeUInt16LE(0x0800, 8);
  entry.writeUInt16LE(stored ? 0 : 8, 10);
  entry.writeUInt16LE(DOS_TIME, 12);
  entry.writeUInt16LE(DOS_DATE, 14);
  entry.writeUInt32LE(crc, 16);
  entry.writeUInt32LE(body.length, 20);
  entry.writeUInt32LE(f.data.length, 24);
  entry.writeUInt16LE(name.length, 28);
  entry.writeUInt32LE(offset, 42); // other fields (extra, comment, disk, attributes) stay 0
  central.push(entry, name);

  offset += local.length + name.length + body.length;
}
const centralSize = central.reduce((sum, b) => sum + b.length, 0);
const end = Buffer.alloc(22);
end.writeUInt32LE(0x06054b50, 0);
end.writeUInt16LE(files.length, 8);
end.writeUInt16LE(files.length, 10);
end.writeUInt32LE(centralSize, 12);
end.writeUInt32LE(offset, 16);

mkdirSync(outDir, { recursive: true });
const zip = Buffer.concat([...parts, ...central, end]);
writeFileSync(outFile, zip);
console.log(
  `Wrote ${relative(root, outFile)}: ${files.length} files, ${(total / 1048576).toFixed(1)} MB unpacked, ` +
    `${(zip.length / 1048576).toFixed(1)} MB zipped.`,
);
