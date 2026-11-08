import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
const root = new URL('../', import.meta.url);
const order = ['icons.js', 'engine/pipeline.js', 'engine/storage.js', 'content/lessons-dbt.js', 'content/lessons-platform.js', 'content/lessons-production.js', 'content/curriculum.js', 'content/questions.js', 'content/decisions.js', 'content/coding.js', 'app.js'];
const parts = [];
for (const name of order) {
  let source = await readFile(new URL(`src/${name}`, root), 'utf8');
  source = source.replace(/^import\s+.*?from\s+['"][^'"]+['"];\s*$/gm, '');
  source = source.replace(/^export\s+/gm, '');
  parts.push(`// Source: ${name}\n${source}`);
}
const bundle = parts.join('\n\n').replace(/<\/script/gi, '<\\/script');
let css = await readFile(new URL('styles.css', root), 'utf8');
for (const license of ['dmsans-OFL.txt', 'manrope-OFL.txt', 'ibmplexmono-OFL.txt']) {
  const text = await readFile(new URL(`assets/fonts/${license}`, root), 'utf8');
  css += `\n/* Bundled font license: ${license}\n${text.replace(/\*\//g, '* /')}\n*/\n`;
}
for (const match of [...css.matchAll(/url\((\.\/assets\/fonts\/[^)]+)\)/g)]) {
  const data = await readFile(new URL(match[1], root));
  css = css.replace(match[0], `url(data:font/ttf;base64,${data.toString('base64')})`);
}
const favicon = await readFile(new URL('assets/favicon.svg', root));
let html = await readFile(new URL('index.html', root), 'utf8');
html = html.replace('<link rel="stylesheet" href="./styles.css" />', `<style>\n${css}\n</style>`);
html = html.replace('<script type="module" src="./src/app.js"></script>', `<script type="module">\n${bundle}\n</script>`);
html = html.replace('href="./assets/favicon.svg"', `href="data:image/svg+xml;base64,${favicon.toString('base64')}"`);
const output = process.argv[2] ? resolve(process.argv[2]) : new URL('dist/datacraft-standalone.html', root);
await mkdir(new URL('dist/', root), { recursive: true });
await writeFile(output, html);
console.log(`Standalone app written (${Math.round(Buffer.byteLength(html) / 1024)} KB). Open the HTML file directly in a browser.`);
