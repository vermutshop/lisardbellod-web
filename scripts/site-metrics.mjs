// Shared by the public website and the private Telegram editor.
export function metricNumber(value) {
  if (typeof value !== "number" && typeof value !== "string") return null;
  if (typeof value === "string" && !value.trim()) return null;
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : null;
}

export function mergeSiteMetrics(data, manual = {}, overrides = {}) {
  manual ||= {};
  overrides ||= {};
  const syncTime = Date.parse(data.meta?.lastUpdated) || 0;
  const dates = [data.meta?.lastUpdated, manual.updatedAt];
  const channels = (data.channels || []).map((channel) => {
    const result = { ...channel };
    for (const field of ["subscribers", "views"]) {
      const entry = overrides.channels?.[channel.id]?.[field];
      const value = metricNumber(entry?.value);
      // A fresh manual correction lasts until YouTube is synchronised again.
      if (value !== null && (Date.parse(entry?.updatedAt) || 0) > syncTime) {
        result[field] = value;
        dates.push(entry.updatedAt);
      }
    }
    return result;
  });
  const instagramFollowers = metricNumber(manual.instagramFollowers) ?? metricNumber(data.socials?.instagramFollowers) ?? 0;
  const tiktokFollowers = metricNumber(manual.tiktokFollowers) ?? metricNumber(data.socials?.tiktokFollowers) ?? 0;
  const hoursWatchedThisYear = metricNumber(manual.youtubeHoursManual) ?? metricNumber(data.metrics?.hoursWatchedThisYear) ?? 0;
  const annualEntry = overrides.metrics?.viewsLast365Days;
  const annualValue = metricNumber(annualEntry?.value);
  if (annualValue !== null) dates.push(annualEntry.updatedAt);
  const latest = dates.filter((date) => Number.isFinite(Date.parse(date)))
    .sort((a, b) => Date.parse(a) - Date.parse(b)).at(-1);
  return {
    ...data,
    channels,
    meta: { ...data.meta, lastUpdated: latest || data.meta?.lastUpdated },
    socials: { ...data.socials, instagramFollowers, tiktokFollowers },
    metricSources: {
      youtubeUpdatedAt: data.meta?.lastUpdated,
      viewsLast365Days: annualValue === null ? "public-uploads" : "studio",
    },
    metrics: {
      ...data.metrics,
      totalAudience: channels.reduce((sum, channel) => sum + (metricNumber(channel.subscribers) ?? 0), 0)
        + instagramFollowers + tiktokFollowers,
      hoursWatchedThisYear,
      ...(annualValue === null ? {} : { viewsLast365Days: annualValue }),
    },
  };
}

export function parseMetricValue(input, integer) {
  const value = input.trim().replace(/\s/g, "");
  let normalized;
  if (/^\d+$/.test(value)) normalized = value;
  else if (/^\d{1,3}(?:\.\d{3})+(?:,\d{1,2})?$/.test(value)) normalized = value.replaceAll(".", "").replace(",", ".");
  else if (/^\d{1,3}(?:,\d{3})+(?:\.\d{1,2})?$/.test(value)) normalized = value.replaceAll(",", "");
  else if (/^\d+[.,]\d{1,2}$/.test(value)) normalized = value.replace(",", ".");
  else return null;
  const number = Number(normalized);
  if (!Number.isFinite(number) || number > Number.MAX_SAFE_INTEGER || (integer && !Number.isInteger(number))) return null;
  return number;
}
