import { mkdir, cp, rm } from 'node:fs/promises';
const root = new URL('../', import.meta.url);
const out = new URL('dist/', root);
await rm(out, { recursive: true, force: true });
await mkdir(out, { recursive: true });
for (const path of ['index.html', 'styles.css', 'src', 'assets', '.nojekyll']) {
  await cp(new URL(path, root), new URL(path, out), { recursive: true });
}
console.log('Static site built in dist/. No runtime dependencies or secrets required.');
