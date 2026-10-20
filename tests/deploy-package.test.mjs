import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, readdir, rm, access } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, dirname, resolve } from 'node:path';
import { execFileSync } from 'node:child_process';

// Check the deployable output, not only the source tree: a missing dynamic
// import prevents both the video archive and home metrics from rendering.
test('server package includes the browser module dependency graph', async () => {
  const temp = await mkdtemp(join(tmpdir(), 'lisard-package-'));
  const output = join(temp, 'release');
  try {
    execFileSync(process.execPath, ['deploy/package.mjs', output]);
    const publicScripts = join(output, 'public/scripts');
    const pending = (await readdir(publicScripts)).filter(name => name.endsWith('.js')).map(name => join(publicScripts, name));
    const visited = new Set();
    while (pending.length) {
      const file = pending.pop();
      if (visited.has(file)) continue;
      visited.add(file);
      const source = await readFile(file, 'utf8');
      for (const match of source.matchAll(/(?:import\s*\(\s*|from\s+|import\s*)["'](\.[^"']+)["']/g)) {
        const dependency = resolve(dirname(file), match[1]);
        await assert.doesNotReject(access(dependency), `Missing browser dependency ${match[1]} imported by ${file}`);
        pending.push(dependency);
      }
    }
    assert(visited.has(join(publicScripts, 'site-metrics.mjs')));
    const { mergeSiteMetrics } = await import(join(publicScripts, 'site-metrics.mjs'));
    const catalog = JSON.parse(await readFile(join(output, 'public/data/data.json'), 'utf8'));
    const merged = mergeSiteMetrics(catalog, null, null);
    assert(merged.videos.length > 0, 'Packaged video catalog must remain available to the browser');
    await assert.rejects(access(join(publicScripts, 'fetch-youtube.mjs')));
  } finally {
    await rm(temp, { recursive: true, force: true });
  }
});
