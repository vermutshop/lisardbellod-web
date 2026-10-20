import { cp, mkdir, readdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const destination = resolve(process.argv[2] || "dist-server");
await mkdir(destination); // Do not overwrite an existing deployment.
await mkdir(`${destination}/public`);
for (const entry of await readdir(".")) {
  if (/\.(html|png|ico|webmanifest|txt|xml)$/.test(entry) && entry !== "AGENTS.md") {
    await cp(entry, `${destination}/public/${entry}`);
  }
}
for (const directory of ["blog", "blog-assets", "styles", "image", "downloads", "ai", ".well-known"]) {
  await cp(directory, `${destination}/public/${directory}`, { recursive: true });
}
await mkdir(`${destination}/public/data`);
for (const name of ["data", "home", "shop", "social-metrics", "metric-overrides", "youtube-normal-videos"]) {
  await cp(`data/${name}.json`, `${destination}/public/data/${name}.json`);
}
await mkdir(`${destination}/public/scripts`);
for (const name of await readdir("scripts")) {
  // app.js imports this module in the browser on the home and video pages.
  if (name.endsWith(".js") || name === "site-metrics.mjs") {
    await cp(`scripts/${name}`, `${destination}/public/scripts/${name}`);
  }
}
for (const directory of ["api", "deploy"]) {
  await cp(directory, `${destination}/${directory}`, { recursive: true });
}
await mkdir(`${destination}/scripts`);
await cp("scripts/site-metrics.mjs", `${destination}/scripts/site-metrics.mjs`);
await writeFile(`${destination}/package.json`, '{"private":true,"type":"module"}\n');
console.log(`Deployment prepared: ${destination}`);
