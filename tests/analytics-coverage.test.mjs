import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

test('every published HTML page configures GA4 exactly once with the site measurement ID', () => {
  const pages = execFileSync('git', ['ls-files', '-z', '--', '*.html'], { encoding: 'utf8' }).split('\0').filter(Boolean);
  for (const page of pages) {
    const html = readFileSync(page, 'utf8');
    const shared = [...html.matchAll(/<script\b[^>]*src=["'][^"']*\/scripts\/home-analytics\.js(?:\?[^"']*)?["'][^>]*>/g)].length;
    const inline = [...html.matchAll(/gtag\(["']config["']\s*,\s*["']([^"']+)["']/g)];
    assert.equal(shared + inline.length, 1, `${page}: exactly one GA4 configuration`);
    for (const match of inline) assert.equal(match[1], 'G-PH35Q4YGM6', page);
    if (shared) assert.doesNotMatch(html, /googletagmanager\.com\/gtag\/js/, `${page}: no duplicate Google loader`);
  }
});
