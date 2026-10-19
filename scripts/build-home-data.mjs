// The home page displays three recent videos per channel, never the full catalog.
// Keep metrics unmerged so live manual corrections use the same rules as videos.html.
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export function buildHomeData(data) {
  const { videos, channels, ...sharedData } = data;
  return {
    ...sharedData,
    channels: channels.map((channel) => ({
      ...channel,
      latestVideos: channel.latestVideos.slice(0, 3).map(({ description, ...video }) => video),
    })),
  };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const source = JSON.parse(await readFile(new URL('../data/data.json', import.meta.url), 'utf8'));
  const output = `${JSON.stringify(buildHomeData(source))}\n`;
  await writeFile(new URL('../data/home.json', import.meta.url), output, 'utf8');
  console.log(`Home data generated: ${Buffer.byteLength(output)} bytes.`);
}
