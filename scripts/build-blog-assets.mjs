// Produce deployment-sized assets only for media used by published articles.
import { copyFile, mkdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const root = process.cwd();
const inventory = JSON.parse(await readFile(path.join(root, "data/blog/inventory.json"), "utf8"));
const status = JSON.parse(await readFile(path.join(root, "data/blog/media-status.json"), "utf8"));
const outputManifest = path.join(root, "data/blog/asset-map.json");
const media = new Map(inventory.media.map((item) => [item.id, item]));
const required = new Set();
const attrs = (tag) => Object.fromEntries([...tag.matchAll(/([\w-]+)\s*=\s*(["'])(.*?)\2/gs)].map((m) => [m[1].toLowerCase(), m[3]]));
const decodePath = (value) => { try { return decodeURIComponent(value); } catch { return value; } };
function add(raw) {
  try {
    const url = new URL(raw);
    if (["lisard.es", "www.lisard.es"].includes(url.hostname.toLowerCase()) &&
        decodePath(url.pathname).startsWith("/wp-content/uploads/")) required.add(decodePath(url.pathname));
  } catch {}
}
for (const post of inventory.posts) {
  const featured = media.get(post.featuredMediaId);
  if (featured) add(featured.sourceUrl);
  for (const match of post.contentHtml.matchAll(/<img\b[^>]*>/gis)) {
    const a = attrs(match[0]); add(a["data-src"] || a["data-lazy-src"] || a.src);
  }
  for (const match of post.contentHtml.matchAll(/<a\b[^>]*>/gis)) add(attrs(match[0]).href);
}

const result = {};
const failures = [];
const entries = [...required].sort();
let cursor = 0;
let processed = 0;
let bytes = 0;
const imageExtensions = new Set([".jpg", ".jpeg", ".png", ".webp", ".bmp"]);
async function worker() {
  while (cursor < entries.length) {
    const key = entries[cursor++];
    const source = status[key];
    if (!source || source.state !== "complete") {
      failures.push([key, source?.error || "not downloaded"]);
      continue;
    }
    const original = path.join(root, source.local.slice(1));
    const extension = path.extname(original).toLowerCase();
    let targetUrl = source.local.replace("/blog-media/", "/blog-assets/")
      .replace(/\.[^.\/]+$/, imageExtensions.has(extension) ? ".webp" : extension);
    let target = path.join(root, targetUrl.slice(1));
    try {
      await mkdir(path.dirname(target), { recursive: true });
      if (imageExtensions.has(extension)) {
        try {
          await sharp(original, { failOn: "none" }).rotate().resize({ width: 1600, withoutEnlargement: true })
            .webp({ quality: 78, effort: 4 }).toFile(target);
        } catch {
          targetUrl = source.local.replace("/blog-media/", "/blog-assets/");
          target = path.join(root, targetUrl.slice(1));
          await copyFile(original, target);
        }
      } else {
        await copyFile(original, target);
      }
      const file = await stat(target);
      result[key] = { local: targetUrl, bytes: file.size };
      bytes += file.size;
    } catch (error) {
      failures.push([key, String(error?.message || error)]);
    }
    processed += 1;
    if (processed % 200 === 0) console.log(`Assets ${processed}/${entries.length}; ${(bytes / 1024 / 1024).toFixed(1)} MiB`);
  }
}
await Promise.all(Array.from({ length: 8 }, () => worker()));
await writeFile(outputManifest, `${JSON.stringify(result)}\n`);
await writeFile(path.join(root, "data/blog/asset-failures.json"), `${JSON.stringify(failures, null, 2)}\n`);
console.log(JSON.stringify({ required: entries.length, ready: Object.keys(result).length,
  failed: failures.length, mebibytes: +(bytes / 1024 / 1024).toFixed(1) }));
