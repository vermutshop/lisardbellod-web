import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import vm from 'node:vm';
import { buildHomeData } from '../scripts/build-home-data.mjs';
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
