import { readdir, readFile, stat } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const root = new URL('../', import.meta.url);
const files = [];
async function walk(url) {
  for (const item of await readdir(url, { withFileTypes: true })) {
    if (['node_modules', 'dist', '.git', 'test-results', '.openai'].includes(item.name)) continue;
    const path = new URL(item.name + (item.isDirectory() ? '/' : ''), url);
    if (item.isDirectory()) await walk(path); else files.push(path);
  }
}
await walk(root);
let count = 0;
for (const path of files.filter(p => /\.(?:js|mjs)$/.test(p.pathname))) {
  const result = spawnSync(process.execPath, ['--check', fileURLToPath(path)], { encoding: 'utf8' });
  if (result.status !== 0) throw new Error(result.stderr);
  const source = await readFile(path, 'utf8');
  for (const match of source.matchAll(/(?:from\s+|import\s*)['"](\.[^'"]+)['"]/g)) {
    const target = new URL(match[1], path);
    if (!(await stat(target)).isFile()) throw new Error(`Missing import: ${target.pathname}`);
  }
  count++;
}
const html = await readFile(new URL('index.html', root), 'utf8');
for (const match of html.matchAll(/(?:src|href)="(\.\/[^"#]+)"/g)) await stat(new URL(match[1], root));
console.log(`Checked syntax and local imports in ${count} JavaScript files; entry-point assets exist.`);
