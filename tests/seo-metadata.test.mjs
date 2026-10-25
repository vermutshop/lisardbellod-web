import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

// Audit the published HTML, including old posts and every archive page.
// No arbitrary character limits: clarity matters more than a fixed SERP width.
const files = execFileSync('git', ['ls-files', '-z', '--', '*.html'], { encoding: 'utf8' }).split('\0').filter(Boolean);
function attributes(tag) {
  return Object.fromEntries([...tag.matchAll(/([\w:-]+)\s*=\s*(["'])(.*?)\2/g)].map(m => [m[1], m[3]]));
}

test('indexable pages have unique, clean titles and descriptions with complete social previews', () => {
  const titles = new Map(), descriptions = new Map();
  for (const file of files) {
    const source = readFileSync(file, 'utf8');
    const head = source.split('</head>')[0];
    const tags = [...head.matchAll(/<meta\b[^>]*>/g)].map(m => attributes(m[0]));
    const value = key => tags.filter(a => (a.name || a.property) === key).map(a => a.content);
    if (value('robots').some(v => v.includes('noindex'))) continue;
    const titleTags = [...head.matchAll(/<title>([\s\S]*?)<\/title>/g)];
    assert.equal(titleTags.length, 1, `${file}: one title required`);
    const title = titleTags[0][1];
    for (const key of ['description', 'og:title', 'og:description', 'og:image', 'og:url', 'twitter:title', 'twitter:description', 'twitter:image', 'twitter:card']) {
      assert.equal(value(key).length, 1, `${file}: one ${key} required`);
      assert.ok(value(key)[0]?.trim(), `${file}: empty ${key}`);
    }
    const description = value('description')[0];
    for (const [label, text, seen] of [['title', title, titles], ['description', description, descriptions]]) {
      assert.ok(!seen.has(text), `${file}: duplicated ${label} from ${seen.get(text)}`);
      seen.set(text, file);
      assert.doesNotMatch(text, /W10=|\[poll\b|&lt;\/?(?:br|a|img)\b|undefined|\[object Object\]/i, `${file}: legacy payload in ${label}`);
    }
    for (const key of ['og:title', 'twitter:title']) assert.equal(value(key)[0], title, `${file}: inconsistent ${key}`);
    for (const key of ['og:description', 'twitter:description']) assert.equal(value(key)[0], description, `${file}: inconsistent ${key}`);
    for (const key of ['og:image', 'twitter:image']) {
      const url = new URL(value(key)[0]);
      assert.equal(url.origin, 'https://lisardbellod.com', `${file}: local preview image required`);
      assert.ok(existsSync(url.pathname.slice(1)), `${file}: missing ${key} image`);
    }
    assert.equal((source.match(/<h1\b/g) || []).length, 1, `${file}: one H1 required`);
  }
});
