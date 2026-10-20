// The home page displays three recent videos per channel, never the full catalog.
// Keep metrics unmerged so live manual corrections use the same rules as videos.html.
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mergeSiteMetrics } from './site-metrics.mjs';

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

// Publish a real snapshot as well as live updates: metrics must remain visible
// when a browser cannot load a module or fetch the latest JSON.
export function buildHomeMetrics(html, data, manual, overrides) {
  const merged = mergeSiteMetrics(data, manual, overrides);
  const number = value => new Intl.NumberFormat('es-ES', { maximumFractionDigits: 0 }).format(value || 0);
  const date = value => new Intl.DateTimeFormat('es-ES', { dateStyle: 'long', timeZone: 'Europe/Madrid' }).format(new Date(value));
  const stats = {
    totalAudience: number(merged.metrics.totalAudience),
    hoursWatched: `${number(Math.round(merged.metrics.hoursWatchedThisYear || 0))}h`,
    videoCount: number(merged.metrics.totalVideos),
    viewsLast365Days: number(merged.metrics.viewsLast365Days),
    lastUpdatedLabel: `Datos actualizados: ${date(merged.meta.lastUpdated)}`,
  };
  for (const [key, value] of Object.entries(stats)) {
    html = html.replace(new RegExp(`(<[^>]+data-stat="${key}"[^>]*>)[^<]*(</[^>]+>)`, 'g'), (_, start, end) => start + value + end);
  }
  const fromStudio = merged.metricSources.viewsLast365Days === 'studio';
  const label = fromStudio ? 'Visualizaciones en los últimos 365 días' : 'Visualizaciones de vídeos del último año';
  const note = fromStudio
    ? 'Dato de YouTube Studio actualizado manualmente, incluyendo vídeos y Shorts.'
    : 'Visitas acumuladas de los vídeos y Shorts publicados en los últimos 365 días.';
  html = html.replace(/(<[^>]+data-metric-label="viewsLast365Days"[^>]*>)[^<]*(<\/[^>]+>)/g, (_, start, end) => start + label + end);
  html = html.replace(/(<[^>]+data-metric-note="viewsLast365Days"[^>]*>)[^<]*(<\/[^>]+>)/g, (_, start, end) => start + note + end);
  return html.replace(/(<[^>]+data-metrics-sync[^>]*>)[^<]*(<\/[^>]+>)/g,
    (_, start, end) => start + `YouTube sincronizado el ${date(merged.metricSources.youtubeUpdatedAt)}.` + end);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const source = JSON.parse(await readFile(new URL('../data/data.json', import.meta.url), 'utf8'));
  const output = `${JSON.stringify(buildHomeData(source))}\n`;
  await writeFile(new URL('../data/home.json', import.meta.url), output, 'utf8');
  const [manual, overrides, html] = await Promise.all([
    readFile(new URL('../data/social-metrics.json', import.meta.url), 'utf8').then(JSON.parse),
    readFile(new URL('../data/metric-overrides.json', import.meta.url), 'utf8').then(JSON.parse),
    readFile(new URL('../index.html', import.meta.url), 'utf8'),
  ]);
  await writeFile(new URL('../index.html', import.meta.url), buildHomeMetrics(html, source, manual, overrides), 'utf8');
  console.log(`Home data generated: ${Buffer.byteLength(output)} bytes.`);
}
