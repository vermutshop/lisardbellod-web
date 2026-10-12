// YouTube's duration alone cannot distinguish a Short from a short normal video.
// The checked IDs come from the public channel's Videos tab, never the Shorts tab.
export function isCatalogVideo(video, confirmedNormalVideos = {}) {
  if (!Number.isFinite(video.durationMinutes) || video.durationMinutes <= 0) return false;
  return video.durationMinutes > 3 ||
    (confirmedNormalVideos[video.channelId] || []).includes(video.id);
}
