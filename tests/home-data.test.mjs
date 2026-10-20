import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import vm from 'node:vm';
import { buildHomeData, buildHomeMetrics } from '../scripts/build-home-data.mjs';
import { mergeSiteMetrics } from '../scripts/site-metrics.mjs';

const readJson = (name) => JSON.parse(readFileSync(new URL(`../data/${name}`, import.meta.url), 'utf8'));
const catalog = readJson('data.json');
const app = readFileSync(new URL('../scripts/app.js', import.meta.url), 'utf8');

// Exercise the actual renderers, capturing their HTML and visible metric labels.
function renderHome(data) {
  const elements = {};
  const element = (selector) => elements[selector] ||= {};
  const context = vm.createContext({
    input: data,
    document: {
      body: { dataset: { page: 'home' } },
      getElementById: element,
      querySelectorAll: (selector) => [element(selector)],
    },
  });
  vm.runInContext(app.slice(0, app.lastIndexOf('\ninit().catch')) + '\nrenderHome(input); renderSharedStats(input); renderFooter(input);', context);
  return elements;
}

test('compact data renders the same homepage and metrics, including runtime corrections', () => {
  const summary = buildHomeData(catalog);
  const fresh = new Date(Date.parse(catalog.meta.lastUpdated) + 60000).toISOString();
  const expired = new Date(Date.parse(catalog.meta.lastUpdated) - 60000).toISOString();
  const scenarios = [
    [null, null],
    [readJson('social-metrics.json'), readJson('metric-overrides.json')],
    [{ instagramFollowers: 0, youtubeHoursManual: 0, updatedAt: fresh }, {
      channels: {
        [catalog.channels[0].id]: { subscribers: { value: 0, updatedAt: fresh } },
        [catalog.channels[1].id]: { subscribers: { value: 999, updatedAt: expired } },
      },
      metrics: { viewsLast365Days: { value: 42, updatedAt: fresh } },
    }],
  ];
  for (const [manual, overrides] of scenarios) {
    const full = mergeSiteMetrics(catalog, manual, overrides);
    const compact = mergeSiteMetrics(summary, manual, overrides);
    assert.deepEqual(renderHome(compact), renderHome(full));
    assert.deepEqual(compact.metrics, full.metrics);
    assert.deepEqual(compact.metricSources, full.metricSources);
    assert.deepEqual(compact.meta, full.meta);
  }
});

test('new syncs and new channels flow into the summary without altering the catalog', () => {
  const source = structuredClone(catalog);
  const newVideo = { ...source.channels[0].latestVideos[0], id: 'new-video', title: 'New video', url: 'https://www.youtube.com/watch?v=new-video' };
  source.channels[0].latestVideos.unshift(newVideo);
  source.channels.push({ id: 'new-channel', name: 'New channel', description: 'Channel description remains visible', subscribers: 0, latestVideos: [] });
  source.meta.lastUpdated = '2027-01-01T10:00:00Z';
  source.metrics.totalVideos += 1;
  const before = structuredClone(source);
  const summary = buildHomeData(source);
  assert.deepEqual(source, before);
  assert.deepEqual(renderHome(mergeSiteMetrics(summary)), renderHome(mergeSiteMetrics(source)));
  assert.equal(summary.channels[0].latestVideos[0].id, 'new-video');
  assert.equal(summary.channels[0].latestVideos.length, 3);
  assert.equal(summary.channels.at(-1).id, 'new-channel');
  assert.equal(summary.meta.lastUpdated, source.meta.lastUpdated);
  assert.equal(summary.metrics.totalVideos, source.metrics.totalVideos);
});

test('generated home asset is current and excludes the heavy catalog payload', () => {
  const generated = readJson('home.json');
  assert.deepEqual(generated, buildHomeData(catalog), 'Run node scripts/build-home-data.mjs after synchronizing YouTube');
  assert.ok(!('videos' in generated));
  assert.ok(generated.channels.every((channel) => channel.latestVideos.every((video) => !('description' in video))));
  const compactBytes = gzipSync(JSON.stringify(generated)).byteLength;
  const fullBytes = gzipSync(JSON.stringify(catalog)).byteLength;
  assert.ok(compactBytes < fullBytes * 0.1, `Home payload ${compactBytes} should stay under 10% of catalog ${fullBytes}`);
});

test('published HTML includes the same metrics as live rendering, including manual zero values', () => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  for (const [manual, overrides] of [
    [readJson('social-metrics.json'), readJson('metric-overrides.json')],
    [{ instagramFollowers: 0, tiktokFollowers: 0, youtubeHoursManual: 0 }, { metrics: { viewsLast365Days: { value: 0 } } }],
    [null, null],
  ]) {
    const output = buildHomeMetrics(html, catalog, manual, overrides);
    const rendered = renderHome(mergeSiteMetrics(catalog, manual, overrides));
    for (const key of ['totalAudience', 'hoursWatched', 'videoCount', 'viewsLast365Days']) {
      const value = output.match(new RegExp(`data-stat="${key}"[^>]*>([^<]+)<`))?.[1];
      assert.equal(value, rendered[`[data-stat="${key}"]`].textContent);
    }
    assert.equal(output.match(/data-metric-label="viewsLast365Days"[^>]*>([^<]+)</)[1], rendered['[data-metric-label="viewsLast365Days"]'].textContent);
    assert.equal(buildHomeMetrics(output, catalog, manual, overrides), output, 'Build must be idempotent');
  }
});

test('failed live updates retain the published snapshot instead of erasing its values', async () => {
  const saved = { textContent: '12.285' };
  const zero = { textContent: '0h' };
  const placeholder = { textContent: '...' };
  const sync = { textContent: '', hasAttribute: () => true };
  const context = {
    document: {
      querySelectorAll: () => [saved, zero, placeholder],
      querySelector: selector => selector === '[data-metrics-sync]' ? sync : saved,
    },
  };
  const failureHandler = app.slice(app.lastIndexOf('\ninit().catch')).replace('init()', 'Promise.reject(new Error("network"))');
  await vm.runInNewContext(failureHandler, context);
  assert.equal(saved.textContent, '12.285');
  assert.equal(zero.textContent, '0h');
  assert.equal(placeholder.textContent, '—');
  assert.match(sync.textContent, /últimas cifras guardadas/);
  const main = { hasAttribute: () => false, insertAdjacentHTML: () => assert.fail('Do not add a data-unavailable notice beside valid saved metrics') };
  context.document.querySelector = selector => selector === '[data-metrics-sync]' ? null : selector === 'main' ? main : saved;
  await vm.runInNewContext(failureHandler, context);
  assert.equal(saved.textContent, '12.285');
});
