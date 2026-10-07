// Build the single public sitemap from all published, tracked HTML.
// Git dates reflect page updates; existing dates survive shallow Vercel clones.
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const site = 'https://lisardbellod.com';
const today = new Date().toISOString().slice(0, 10);
const stateFile = path.join(root, 'data/sitemap-state.json');
const previousState = existsSync(stateFile) ? JSON.parse(readFileSync(stateFile, 'utf8')) : {};
const nextState = {};
const digestCache = new Map();

function git(args) {
  try {
    return execFileSync('git', args, { cwd: root, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 });
  } catch {
    return '';
  }
}

function trackedPages() {
  const tracked = git(['ls-files', '-z', '--', '*.html']).split('\0');
  const newFiles = git(['ls-files', '--others', '--exclude-standard', '-z', '--', '*.html']).split('\0');
  return [...new Set([...tracked, ...newFiles].filter(Boolean))].sort();
}

function previousDates(filename) {
  const result = new Map();
  const source = path.join(root, filename);
  if (!existsSync(source)) return result;
  const xml = readFileSync(source, 'utf8');
  for (const block of xml.matchAll(/<url>([\s\S]*?)<\/url>/g)) {
    const location = block[1].match(/<loc>([^<]+)<\/loc>/)?.[1]?.replaceAll('&amp;', '&');
    const modified = block[1].match(/<lastmod>([^<]+)<\/lastmod>/)?.[1];
    if (location && modified) result.set(location, modified.slice(0, 10));
  }
  return result;
}

function gitDates() {
  const dates = new Map();
  const shallowPath = git(['rev-parse', '--git-path', 'shallow']).trim();
  const shallow = shallowPath && existsSync(path.resolve(root, shallowPath))
    ? new Set(readFileSync(path.resolve(root, shallowPath), 'utf8').trim().split(/\s+/))
    : new Set();
  let currentDate = '';
  let skipCommit = false;
  for (const line of git(['-c', 'core.quotePath=false', 'log', '--format=COMMIT:%H:%cs', '--name-only', 'HEAD']).split('\n')) {
    if (line.startsWith('COMMIT:')) {
      const [, hash, date] = line.split(':');
      currentDate = date;
      skipCommit = shallow.has(hash);
    } else if (line && currentDate && !skipCommit && !dates.has(line)) {
      dates.set(line, currentDate);
    }
  }
  const dirty = [...git(['diff', '--name-only']).split('\n'),
    ...git(['diff', '--cached', '--name-only']).split('\n'),
    ...git(['ls-files', '--others', '--exclude-standard']).split('\n')].filter(Boolean);
  for (const file of dirty) dates.set(file, today);
  return dates;
}

function localAsset(url, canonical) {
  try {
    const parsed = new URL(url, canonical);
    if (parsed.origin !== site) return null;
    const relative = parsed.pathname.slice(1);
    return existsSync(path.join(root, relative)) ? relative : null;
  } catch {
    return null;
  }
}

function dependencies(file, html, canonical) {
  const result = [file];
  for (const match of html.matchAll(/<(?:script|img)\b[^>]*\bsrc=["']([^"']+)["']/gi)) {
    const asset = localAsset(match[1], canonical);
    if (asset) result.push(asset);
  }
  if (result.includes('scripts/app.js')) result.push('scripts/site-metrics.mjs');
  if (['index.html', 'videos.html', 'contacto.html'].includes(file)) {
    result.push('data/data.json', 'data/social-metrics.json', 'data/metric-overrides.json');
  }
  if (file === 'shop.html') result.push('data/shop.json');
  if (file === 'blog/index.html') result.push('blog/search-index.json');
  return result;
}

function fileDigest(file) {
  if (!digestCache.has(file)) {
    digestCache.set(file, existsSync(path.join(root, file))
      ? createHash('sha256').update(readFileSync(path.join(root, file))).digest('hex') : '');
  }
  return digestCache.get(file);
}

function fingerprint(files) {
  const hash = createHash('sha256');
  for (const file of [...new Set(files)].sort()) {
    hash.update(file);
    hash.update(fileDigest(file));
  }
  return hash.digest('hex');
}

function xmlEscape(value) {
  return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;').replaceAll("'", '&apos;');
}

function sitemap(entries) {
  const lines = ['<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'];
  for (const { canonical, lastmod } of entries) {
    lines.push('  <url>', `    <loc>${xmlEscape(canonical)}</loc>`);
    if (lastmod) lines.push(`    <lastmod>${lastmod}</lastmod>`);
    lines.push('  </url>');
  }
  lines.push('</urlset>', '');
  return lines.join('\n');
}

const oldDates = new Map([...previousDates('sitemap.xml'), ...previousDates('blog-sitemap.xml')]);
const dates = gitDates();
const entries = [];
const seen = new Set();

for (const file of trackedPages()) {
  const html = readFileSync(path.join(root, file), 'utf8');
  const robots = html.match(/<meta\s+name=["']robots["']\s+content=["']([^"']+)/i)?.[1] ?? '';
  if (/(?:^|,)\s*noindex\b/i.test(robots)) continue;
  const canonical = html.match(/<link\s+rel=["']canonical["']\s+href=["']([^"']+)/i)?.[1];
  if (!canonical) throw new Error(`Falta canonical en ${file}`);
  if (!canonical.startsWith(`${site}/`)) throw new Error(`Canonical fuera del dominio en ${file}: ${canonical}`);
  if (seen.has(canonical)) throw new Error(`Canonical duplicado: ${canonical}`);
  seen.add(canonical);
  const files = dependencies(file, html, canonical);
  const hash = fingerprint(files);
  const prior = previousState[canonical];
  const previous = prior?.lastmod ?? oldDates.get(canonical);
  const latestGitDate = files.map((item) => dates.get(item)).filter(Boolean).sort().at(-1);
  // On the first run, preserve historical publication/modified dates already
  // recorded in the sitemap. Thereafter a changed page or data dependency gets
  // the actual change date. Stable hashes keep lastmod stable across deploys.
  const lastmod = prior && prior.hash !== hash
    ? [previous, latestGitDate ?? today].filter(Boolean).sort().at(-1)
    : previous ?? latestGitDate ?? today;
  nextState[canonical] = { hash, lastmod };
  entries.push({ canonical, lastmod });
}

entries.sort((a, b) => a.canonical.localeCompare(b.canonical, 'es'));
const output = sitemap(entries);
if (entries.length > 50000 || Buffer.byteLength(output, 'utf8') > 50 * 1024 * 1024) {
  throw new Error('El sitemap supera el límite: hay que dividirlo antes de publicar.');
}
writeFileSync(path.join(root, 'sitemap.xml'), output);
console.log(`sitemap.xml: ${entries.length} URLs`);
writeFileSync(stateFile, JSON.stringify(nextState, null, 2) + '\n');
