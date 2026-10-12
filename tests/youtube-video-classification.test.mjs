import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { isCatalogVideo } from '../scripts/youtube-video-classification.mjs';
const registry = JSON.parse(fs.readFileSync(new URL('../data/youtube-normal-videos.json', import.meta.url))).channels;
const channelId = 'UCUaJJERaZmu5_lfJPxT4X8A';
test('keeps a verified 29-second normal video and all videos over three minutes', () => {
  assert.equal(isCatalogVideo({id:'PNFA6pmS464',channelId,durationMinutes:29/60},registry),true);
  assert.equal(isCatalogVideo({id:'another',channelId,durationMinutes:3.01},registry),true);
});
test('does not turn all short uploads or a different channel into normal videos', () => {
  assert.equal(isCatalogVideo({id:'unknown-short',channelId,durationMinutes:2},registry),false);
  assert.equal(isCatalogVideo({id:'PNFA6pmS464',channelId:'other',durationMinutes:2},registry),false);
  assert.equal(isCatalogVideo({id:'unknown-short',channelId,durationMinutes:3},registry),false);
});
test('ignores missing, deleted or invalid duration even for a previously verified ID', () => {
  for (const durationMinutes of [0,-1,NaN,undefined,Infinity]) {
    assert.equal(isCatalogVideo({id:'PNFA6pmS464',channelId,durationMinutes},registry),false);
  }
});
