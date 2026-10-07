import test from 'node:test';
import assert from 'node:assert/strict';
import { mergeSiteMetrics, parseMetricValue } from '../scripts/site-metrics.mjs';
const base = { meta: { lastUpdated: '2026-10-07T11:00:00Z' }, channels: [{ id: 'main', subscribers: 6780, views: 2676352 }], socials: { instagramFollowers: 211, tiktokFollowers: 4833 }, metrics: { hoursWatchedThisYear: 64832, viewsLast365Days: 1468763 } };
test('expired channel overrides yield to the next YouTube sync without changing input', () => {
 const before = structuredClone(base);
 const result = mergeSiteMetrics(base, null, { channels: { main: { subscribers: { value: 6168, updatedAt: '2026-08-26T12:00:00Z' } } } });
 assert.equal(result.channels[0].subscribers, 6780);
 assert.equal(result.metrics.totalAudience, 11824);
 assert.equal(result.metricSources.viewsLast365Days, 'public-uploads');
 assert.deepEqual(base, before);
});
test('fresh corrections apply until the next sync; Studio annual figures persist', () => {
 const overrides = { channels: { main: { subscribers: { value: 6800, updatedAt: '2026-10-07T12:00:00Z' } } }, metrics: { viewsLast365Days: { value: 42, updatedAt: '2026-08-26T12:00:00Z' } } };
 const result = mergeSiteMetrics(base, {}, overrides);
 assert.equal(result.channels[0].subscribers, 6800);
 assert.equal(result.meta.lastUpdated, '2026-10-07T12:00:00Z');
 assert.equal(result.metricSources.youtubeUpdatedAt, base.meta.lastUpdated);
 assert.equal(result.metrics.viewsLast365Days, 42);
 assert.equal(result.metricSources.viewsLast365Days, 'studio');
 const next = mergeSiteMetrics({ ...base, meta: {lastUpdated: '2026-10-08T05:00:00Z'} }, {}, overrides);
 assert.equal(next.channels[0].subscribers, 6780);
 assert.equal(next.metrics.viewsLast365Days, 42);
});
test('manual zero values are valid and malformed values use API fallback', () => {
 const result = mergeSiteMetrics(base, { instagramFollowers: 0, tiktokFollowers: null, youtubeHoursManual: 0, updatedAt: '2026-10-07T13:00:00Z' }, {metrics:{viewsLast365Days:{value:0}}});
 assert.equal(result.socials.instagramFollowers, 0);
 assert.equal(result.socials.tiktokFollowers, 4833);
 assert.equal(result.metrics.hoursWatchedThisYear, 0);
 assert.equal(result.metrics.viewsLast365Days, 0);
 assert.equal(result.meta.lastUpdated, '2026-10-07T13:00:00Z');
});
test('Telegram accepts Spanish and English numbers and rejects ambiguous/malformed integer input', () => {
 for (const input of ['6168','6.168','6,168','6 168']) assert.equal(parseMetricValue(input,true),6168);
 for (const input of ['57.304,4','57,304.4','57304.4','57304,4']) assert.equal(parseMetricValue(input,false),57304.4);
 assert.equal(parseMetricValue('0',true),0);
 for (const input of ['1,2','1.2','6..168','-12','1,234,56','hola','','99999999999999999999']) assert.equal(parseMetricValue(input,true),null,input);
});
