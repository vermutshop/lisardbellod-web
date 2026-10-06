import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const origin = "https://lisard.es";
const output = path.resolve("data/blog/inventory.json");
const fields = "id,date,date_gmt,modified,modified_gmt,slug,link,title,featured_media,categories,tags,content,excerpt";

async function fetchJson(url, attempts = 3) {
  let error;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const response = await fetch(url, {
        headers: { "User-Agent": "LisardBlogMigration/1.0" },
        signal: AbortSignal.timeout(45_000),
      });
      if (!response.ok) throw new Error(`${response.status} ${url}`);
      return { data: await response.json(), headers: response.headers };
    } catch (caught) {
      error = caught;
      if (attempt < attempts) await new Promise((resolve) => setTimeout(resolve, attempt * 1500));
    }
  }
  throw error;
}

const postUrl = (page) => `${origin}/wp-json/wp/v2/posts?per_page=100&page=${page}&_fields=${fields}`;
const first = await fetchJson(postUrl(1));
const expected = Number(first.headers.get("x-wp-total"));
const pages = Number(first.headers.get("x-wp-totalpages"));
if (!expected || !pages) throw new Error("WordPress did not provide pagination totals.");

const posts = [...first.data];
for (let page = 2; page <= pages; page += 1) {
  const result = await fetchJson(postUrl(page));
  posts.push(...result.data);
  process.stdout.write(`\rArticles: ${posts.length}/${expected}`);
}
process.stdout.write("\n");
if (posts.length !== expected || new Set(posts.map((post) => post.id)).size !== expected) {
  throw new Error(`Incomplete or duplicate inventory: ${posts.length}/${expected}`);
}

const categories = [];
const firstCategories = await fetchJson(`${origin}/wp-json/wp/v2/categories?per_page=100&page=1`);
categories.push(...firstCategories.data);
const categoryPages = Number(firstCategories.headers.get("x-wp-totalpages"));
for (let page = 2; page <= categoryPages; page += 1) {
  categories.push(...(await fetchJson(`${origin}/wp-json/wp/v2/categories?per_page=100&page=${page}`)).data);
}

const mediaFields = "id,source_url,alt_text";
const mediaUrl = (page) => `${origin}/wp-json/wp/v2/media?per_page=100&page=${page}&_fields=${mediaFields}`;
const firstMedia = await fetchJson(mediaUrl(1));
const expectedMedia = Number(firstMedia.headers.get("x-wp-total"));
const mediaPages = Number(firstMedia.headers.get("x-wp-totalpages"));
const media = [...firstMedia.data];
for (let page = 2; page <= mediaPages; page += 1) {
  media.push(...(await fetchJson(mediaUrl(page))).data);
  process.stdout.write(`\rMedia: ${media.length}/${expectedMedia}`);
}
process.stdout.write("\n");
if (new Set(media.map((item) => item.id)).size !== media.length) {
  throw new Error("Duplicate media IDs in WordPress response.");
}
if (media.length !== expectedMedia) {
  console.warn(`WordPress returned ${media.length} of ${expectedMedia} declared public media records.`);
}

const inventory = {
  source: origin,
  importedAt: new Date().toISOString(),
  expected,
  expectedMedia,
  categories: categories.map(({ id, count, name, slug, parent }) => ({ id, count, name, slug, parent })),
  media: media.map((item) => ({
    id: item.id,
    sourceUrl: item.source_url,
    thumbnailUrl: item.source_url,
    alt: item.alt_text || "",
  })),
  posts: posts.map((post) => ({
    id: post.id,
    url: post.link,
    slug: post.slug,
    title: post.title?.rendered || "",
    published: post.date,
    publishedGmt: post.date_gmt,
    modified: post.modified,
    modifiedGmt: post.modified_gmt,
    featuredMediaId: post.featured_media || null,
    hasInlineImage: /<img\b/i.test(post.content?.rendered || ""),
    categories: post.categories || [],
    tags: post.tags || [],
    contentHtml: post.content?.rendered || "",
    excerptHtml: post.excerpt?.rendered || "",
  })),
};

await mkdir(path.dirname(output), { recursive: true });
await writeFile(output, `${JSON.stringify(inventory)}\n`);
const dates = inventory.posts.map((post) => post.published).sort();
console.log(JSON.stringify({
  output,
  posts: inventory.posts.length,
  categories: inventory.categories.length,
  media: inventory.media.length,
  withFeaturedImage: inventory.posts.filter((post) => post.featuredMediaId).length,
  withoutFeaturedImage: inventory.posts.filter((post) => !post.featuredMediaId).length,
  withoutAnyImage: inventory.posts.filter((post) => !post.featuredMediaId && !post.hasInlineImage).length,
  oldest: dates[0],
  newest: dates.at(-1),
}, null, 2));
