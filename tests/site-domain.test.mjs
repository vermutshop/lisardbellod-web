import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
const origin = 'https://lisardbellod.com';

test('all published canonical URLs, social metadata and sitemap use the primary domain', () => {
 const files = execFileSync('git',['ls-files','-z','--','*.html'],{encoding:'utf8'}).split('\0').filter(Boolean);
 const canonicalUrls = new Set();
 for (const file of files) {
  const html = readFileSync(file,'utf8');
  assert.ok(!html.includes('www.lisardbellod.com'), `${file}: old domain remains`);
  if (/<meta\s+name=["']robots["']\s+content=["'][^"']*noindex/i.test(html)) continue;
  const canonical = html.match(/<link\s+rel=["']canonical["']\s+href=["']([^"']+)/i)?.[1];
  assert.ok(canonical?.startsWith(origin+'/'), `${file}: missing or incorrect canonical`);
  assert.ok(!canonicalUrls.has(canonical), `${file}: duplicate canonical`);
  canonicalUrls.add(canonical);
  for (const match of html.matchAll(/<meta\s+(?:property|name)=["'](?:og:url|og:image|twitter:image)["']\s+content=["']([^"']+)/gi)) {
   assert.equal(new URL(match[1]).origin,origin, `${file}: social URL`);
  }
  for (const match of html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) JSON.parse(match[1]);
 }
 const xml = readFileSync('sitemap.xml','utf8');
 const locations = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m=>m[1]);
 assert.equal(locations.length,new Set(locations).size);
 assert.deepEqual(new Set(locations),canonicalUrls);
 assert.equal(readFileSync('robots.txt','utf8').match(/^Sitemap: (.+)$/m)?.[1],origin+'/sitemap.xml');
});

test('www redirects permanently to the same path on the apex domain', () => {
 const config=JSON.parse(readFileSync('vercel.json','utf8'));
 const redirect=config.redirects.find(r=>r.has?.some(h=>h.type==='host'&&h.value==='www.lisardbellod.com'));
 assert.equal(redirect.source,'/:path((?!api/telegram-metrics/?$).*)');
 assert.equal(redirect.destination,origin+'/:path*');
 assert.equal(redirect.permanent,true);
});
