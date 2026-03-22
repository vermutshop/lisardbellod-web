import fs from "node:fs/promises";
import path from "node:path";

const API_KEY = process.env.YOUTUBE_API_KEY;
const ROOT = process.cwd();
const OUTPUT_PATH = path.join(ROOT, "data", "data.json");
const SOCIAL_METRICS_PATH = path.join(ROOT, "data", "social-metrics.json");
const SEARCH_PAGE_SIZE = 50;
const VIDEO_DETAILS_BATCH_SIZE = 50;
const SHORTS_MAX_DURATION_MINUTES = 3;
const channelIdCache = new Map();
const channelDetailsCache = new Map();

const CHANNELS = [
  {
    url: "https://www.youtube.com/@LisardBellod",
    name: "Lisard Bellod",
    description: "Canal principal con contenido central de la marca personal y sus vídeos más importantes.",
    category: "Principal",
  },
  {
    url: "https://www.youtube.com/@TuPlanZeta",
    name: "Tu Plan Zeta",
    description: "Canal de emprendimiento, ideas, estrategia y construcción de proyectos.",
    category: "Emprendimiento",
  },
  {
    url: "https://www.youtube.com/@Vallsalmon",
    name: "Valls al mon",
    description: "Canal en catalán sobre crítica, gente y comercio desde Valls hacia el mundo.",
    category: "Catalan",
  },
];

const DEFAULT_SOCIAL_METRICS = {
  instagramFollowers: 143,
  tiktokFollowers: 4750,
  youtubeHoursManual: 57191.5,
};

function ensureApiKey() {
  if (!API_KEY) {
    throw new Error("Falta la variable de entorno YOUTUBE_API_KEY.");
  }
}

async function fetchJson(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Error ${response.status} al consultar ${url}`);
  }
  return response.json();
}

async function fetchText(url) {
  const response = await fetch(url, {
    headers: {
      "user-agent": "Mozilla/5.0",
    },
  });
  if (!response.ok) {
    throw new Error(`Error ${response.status} al consultar ${url}`);
  }
  return response.text();
}

async function loadSocialMetrics() {
  try {
    const content = await fs.readFile(SOCIAL_METRICS_PATH, "utf8");
    const parsed = JSON.parse(content);
    return {
      instagramFollowers:
        Number.parseInt(parsed.instagramFollowers, 10) ||
        DEFAULT_SOCIAL_METRICS.instagramFollowers,
      tiktokFollowers:
        Number.parseInt(parsed.tiktokFollowers, 10) ||
        DEFAULT_SOCIAL_METRICS.tiktokFollowers,
      youtubeHoursManual:
        Number.parseFloat(parsed.youtubeHoursManual) ||
        DEFAULT_SOCIAL_METRICS.youtubeHoursManual,
    };
  } catch {
    return DEFAULT_SOCIAL_METRICS;
  }
}

function iso8601DurationToMinutes(duration) {
  const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return 0;
  const [, hours = "0", minutes = "0", seconds = "0"] = match;
  return Number(hours) * 60 + Number(minutes) + Number(seconds) / 60;
}

function toVideoModel(raw, details, channel) {
  return {
    id: raw.id.videoId,
    title: raw.snippet.title,
    description: raw.snippet.description,
    publishedAt: raw.snippet.publishedAt,
    thumbnail:
      raw.snippet.thumbnails.maxres?.url ||
      raw.snippet.thumbnails.high?.url ||
      raw.snippet.thumbnails.medium?.url,
    url: `https://www.youtube.com/watch?v=${raw.id.videoId}`,
    channelId: channel.id,
    channelName: channel.name,
    category: channel.category,
    views: Number(details.statistics?.viewCount || 0),
    durationMinutes: iso8601DurationToMinutes(details.contentDetails?.duration || "PT0M"),
  };
}

async function resolveChannelId(channel) {
  if (channel.id) return channel.id;
  if (channelIdCache.has(channel.url)) return channelIdCache.get(channel.url);
  if (!channel.url) {
    throw new Error(`Falta id o url para el canal ${channel.name}`);
  }

  const html = await fetchText(channel.url);
  const canonicalMatch = html.match(/https:\/\/www\.youtube\.com\/channel\/(UC[\w-]+)/i);
  const externalMatch = html.match(/"externalId":"(UC[\w-]+)"/i);
  const resolvedId = canonicalMatch?.[1] || externalMatch?.[1];

  if (!resolvedId) {
    throw new Error(`No se pudo resolver el channel ID para ${channel.name} desde ${channel.url}`);
  }

  channelIdCache.set(channel.url, resolvedId);
  return resolvedId;
}

async function fetchChannelDetails(channel) {
  const channelId = await resolveChannelId(channel);
  if (channelDetailsCache.has(channelId)) return channelDetailsCache.get(channelId);
  const url = new URL("https://www.googleapis.com/youtube/v3/channels");
  url.searchParams.set("part", "statistics,contentDetails");
  url.searchParams.set("id", channelId);
  url.searchParams.set("key", API_KEY);

  const json = await fetchJson(url);
  const item = json.items?.[0];
  if (!item) {
    throw new Error(`No se encontraron estadísticas para ${channel.name}`);
  }

  const details = {
    id: channelId,
    subscribers: Number(item.statistics.subscriberCount || 0),
    videos: Number(item.statistics.videoCount || 0),
    views: Number(item.statistics.viewCount || 0),
    uploadsPlaylistId: item.contentDetails?.relatedPlaylists?.uploads,
  };

  channelDetailsCache.set(channelId, details);
  return details;
}

async function fetchChannelUploads(channel, uploadsPlaylistId) {
  const channelId = await resolveChannelId(channel);
  const resolvedChannel = { ...channel, id: channelId };
  const items = [];
  let nextPageToken = "";

  while (true) {
    const playlistUrl = new URL("https://www.googleapis.com/youtube/v3/playlistItems");
    playlistUrl.searchParams.set("part", "snippet,contentDetails");
    playlistUrl.searchParams.set("playlistId", uploadsPlaylistId);
    playlistUrl.searchParams.set("maxResults", String(SEARCH_PAGE_SIZE));
    playlistUrl.searchParams.set("key", API_KEY);
    if (nextPageToken) playlistUrl.searchParams.set("pageToken", nextPageToken);

    const playlistJson = await fetchJson(playlistUrl);
    items.push(
      ...(playlistJson.items || []).filter((item) => item.contentDetails?.videoId && item.snippet?.title !== "Deleted video")
    );
    nextPageToken = playlistJson.nextPageToken || "";
    if (!nextPageToken) break;
  }

  const ids = items.map((item) => item.contentDetails.videoId).filter(Boolean);

  if (!ids.length) return [];

  const detailResponses = await Promise.all(
    Array.from({ length: Math.ceil(ids.length / VIDEO_DETAILS_BATCH_SIZE) }, (_, index) => {
      const batchIds = ids.slice(
        index * VIDEO_DETAILS_BATCH_SIZE,
        (index + 1) * VIDEO_DETAILS_BATCH_SIZE
      );
      const videosUrl = new URL("https://www.googleapis.com/youtube/v3/videos");
      videosUrl.searchParams.set("part", "contentDetails,statistics");
      videosUrl.searchParams.set("id", batchIds.join(","));
      videosUrl.searchParams.set("key", API_KEY);
      return fetchJson(videosUrl);
    })
  );

  const detailsById = new Map(
    detailResponses.flatMap((response) => response.items || []).map((item) => [item.id, item])
  );

  return items
    .map((item) => {
      const raw = {
        id: { videoId: item.contentDetails.videoId },
        snippet: item.snippet,
      };
      return toVideoModel(raw, detailsById.get(item.contentDetails.videoId) || {}, resolvedChannel);
    });
}

async function buildDataset() {
  ensureApiKey();
  const socialMetrics = await loadSocialMetrics();
  const oneYearAgo = new Date();
  oneYearAgo.setDate(oneYearAgo.getDate() - 365);

  const channelPayloads = await Promise.all(
    CHANNELS.map(async (channel) => {
      const stats = await fetchChannelDetails(channel);
      const uploads = await fetchChannelUploads(channel, stats.uploadsPlaylistId);
      const videos = uploads.filter((video) => video.durationMinutes > SHORTS_MAX_DURATION_MINUTES);
      return {
        ...channel,
        ...stats,
        uploads,
        latestVideos: videos.slice(0, 3),
        videos,
      };
    })
  );

  const videos = channelPayloads
    .flatMap((channel) => channel.videos)
    .sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt));
  const uploads = channelPayloads
    .flatMap((channel) => channel.uploads)
    .sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt));

  const totalSubscribers = channelPayloads.reduce((sum, channel) => sum + channel.subscribers, 0);
  const viewsLast365Days = uploads
    .filter((video) => new Date(video.publishedAt) >= oneYearAgo)
    .reduce((sum, video) => sum + video.views, 0);
  return {
    meta: {
      generatedBy: "scripts/fetch-youtube.mjs",
      lastUpdated: new Date().toISOString(),
      regenerationWindowDays: 3,
    },
    metrics: {
      totalAudience:
        totalSubscribers + socialMetrics.instagramFollowers + socialMetrics.tiktokFollowers,
      totalVideos: videos.length,
      hoursWatchedThisYear: socialMetrics.youtubeHoursManual,
      viewsLast365Days,
    },
    socials: {
      instagramFollowers: socialMetrics.instagramFollowers,
      tiktokFollowers: socialMetrics.tiktokFollowers,
    },
    channels: channelPayloads.map(({ videos: ignoredVideos, uploads: ignoredUploads, ...channel }) => channel),
    videos,
  };
}

async function main() {
  const dataset = await buildDataset();
  await fs.mkdir(path.dirname(OUTPUT_PATH), { recursive: true });
  await fs.writeFile(OUTPUT_PATH, `${JSON.stringify(dataset, null, 2)}\n`, "utf8");
  console.log(`Archivo generado en ${OUTPUT_PATH}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
