// Copy referenced WordPress uploads before redirecting the old domain.
import { createHash } from "node:crypto";
import { mkdir, open, readFile, rename, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const inventory = JSON.parse(await readFile(path.join(root, "data/blog/inventory.json"), "utf8"));
const output = path.join(root, "blog-media");
const manifestPath = path.join(root, "data/blog/media-status.json");
const maxBytes = 32 * 1024 * 1024;
const concurrency = 12;
const attributes = (tag) => Object.fromEntries([...tag.matchAll(/([\w-]+)\s*=\s*(["'])(.*?)\2/gs)].map((m) => [m[1].toLowerCase(), m[3]]));
const decodePath = (value) => {
  try { return decodeURIComponent(value); } catch { return value; }
};

function assetKey(raw) {
  try {
    const url = new URL(raw);
    if (!["lisard.es", "www.lisard.es"].includes(url.hostname.toLowerCase())) return null;
    const pathname = decodePath(url.pathname);
    if (!pathname.startsWith("/wp-content/uploads/")) return null;
    return pathname;
  } catch { return null; }
}

const sources = new Map();
const add = (raw) => {
  const key = assetKey(raw);
  if (key && !sources.has(key)) {
    const extension = path.extname(key).toLowerCase().replace(/[^.a-z0-9]/g, "");
    const hash = createHash("sha1").update(key).digest("hex");
    const local = `/blog-media/${hash.slice(0, 2)}/${hash}${extension || ".bin"}`;
    sources.set(key, { source: `https://lisard.es${encodeURI(key)}`, local });
  }
};

for (const item of inventory.media) {
  add(item.sourceUrl);
  add(item.thumbnailUrl);
}
for (const post of inventory.posts) {
  for (const match of post.contentHtml.matchAll(/<img\b[^>]*>/gis)) {
    const attr = attributes(match[0]);
    add(attr["data-src"] || attr["data-lazy-src"] || attr.src);
  }
  for (const match of post.contentHtml.matchAll(/<a\b[^>]*>/gis)) {
    add(attributes(match[0]).href);
  }
}

let status = {};
try { status = JSON.parse(await readFile(manifestPath, "utf8")); } catch {}
const entries = [...sources.entries()];
const totals = { complete: 0, failed: 0, skipped: 0 };
let cursor = 0;
let processed = 0;
let saveChain = Promise.resolve();

async function save() {
  const ordered = Object.fromEntries(Object.entries(status).sort(([a], [b]) => a.localeCompare(b)));
  await writeFile(manifestPath, `${JSON.stringify(ordered)}\n`);
}

function queueSave() {
  saveChain = saveChain.then(save);
  return saveChain;
}

async function download(key, item) {
  const destination = path.join(root, item.local.slice(1));
  if (status[key]?.state === "complete") {
    try {
      const existing = await stat(destination);
      if (existing.size === status[key].bytes) { totals.skipped += 1; return; }
    } catch {}
  }
  await mkdir(path.dirname(destination), { recursive: true });
  let lastError = "";
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    const temporary = `${destination}.part`;
    try {
      const response = await fetch(item.source, {
        headers: { "User-Agent": "LisardBellodBlogMigration/1.0" },
        signal: AbortSignal.timeout(45_000),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      if ((response.headers.get("content-type") || "").includes("text/html")) throw new Error("HTML returned instead of asset");
      const expected = Number(response.headers.get("content-length") || 0);
      if (expected > maxBytes) throw new Error(`too large: ${expected} bytes`);
      const handle = await open(temporary, "w");
      let bytes = 0;
      try {
        for await (const chunk of response.body) {
          bytes += chunk.length;
          if (bytes > maxBytes) throw new Error(`too large: over ${maxBytes} bytes`);
          await handle.write(chunk);
        }
      } finally { await handle.close(); }
      if (!bytes || (expected && bytes !== expected)) throw new Error(`incomplete: ${bytes}/${expected}`);
      await rm(destination, { force: true });
      await rename(temporary, destination);
      status[key] = { state: "complete", ...item, bytes, type: response.headers.get("content-type") || "" };
      totals.complete += 1;
      return;
    } catch (error) {
      lastError = String(error?.message || error);
      await rm(temporary, { force: true });
      if (attempt < 3) await new Promise((resolve) => setTimeout(resolve, attempt * 900));
    }
  }
  status[key] = { state: "failed", ...item, error: lastError };
  totals.failed += 1;
}

async function worker() {
  while (cursor < entries.length) {
    const [key, item] = entries[cursor++];
    await download(key, item);
    processed += 1;
    if (processed % 100 === 0) {
      await queueSave();
      console.log(`Media ${processed}/${entries.length}: ${JSON.stringify(totals)}`);
    }
  }
}

console.log(`Referenced WordPress uploads: ${entries.length}`);
await Promise.all(Array.from({ length: concurrency }, () => worker()));
await queueSave();
console.log(JSON.stringify({ referenced: entries.length, ...totals, manifestPath }, null, 2));
