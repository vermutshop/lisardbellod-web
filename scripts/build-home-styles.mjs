// Keep the homepage's first paint independent of stylesheet network requests.
// Edit styles/main.css or styles/home.css; npm run build refreshes this block.
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const file = path.join(root, 'index.html');
const html = readFileSync(file, 'utf8');
const css = ['styles/main.css', 'styles/home.css']
  .map((file) => readFileSync(path.join(root, file), 'utf8').trim()).join('\n');
if (/<\/style/i.test(css)) throw new Error('Unexpected closing style tag in homepage CSS');
const pattern = /<!-- home-styles:start -->[\s\S]*?<!-- home-styles:end -->/;
if (!pattern.test(html)) throw new Error('Homepage styles marker missing');
const block = `<!-- home-styles:start -->\n    <style id="home-styles">\n${css}\n    </style>\n    <!-- home-styles:end -->`;
writeFileSync(file, html.replace(pattern, () => block));
console.log(`Homepage styles: ${Buffer.byteLength(css)} bytes inline`);
