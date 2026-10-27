/**
 * Runs after `vite build`: writes an HTML file for every page of the site into dist/, so
 * each page has its own address, title, description and preview picture, and its content
 * can be read without running the app. Also writes the preview pictures (dist/og/), a 404
 * page, and, when the site's address is known, sitemap.xml and robots.txt.
 *
 *   BASE_PATH  where the site lives on its host ("/" or "/flybench/"), as for vite build
 *   SITE_URL   the host's address ("https://ebner.github.io"); needed for absolute links
 *              in previews, canonical links and the sitemap
 */
import { createHash } from "node:crypto";
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import sharp from "sharp";
import { pageHtml, sitePages, SITE_NAME } from "../src/catalog/pages";
import { formatError } from "../src/recipe/errors";
import { loadRecipe } from "../src/recipe/load";
import { IMAGE_URL, withoutReferences } from "../src/recipe/publish";
import type { Recipe } from "../src/recipe/schema";

const DIST = "dist";
const BASE = process.env.BASE_PATH ?? "/";
const SITE_URL = process.env.SITE_URL?.replace(/\/$/, "");
const PAPER = "#e9e7dd";
const OG = { width: 1200, height: 630 };

async function loadPatterns(): Promise<Recipe[]> {
  const files = (await readdir("patterns")).filter((f) => f.endsWith(".kdl")).sort();
  return Promise.all(
    files.map(async (f) => {
      // The text the site ships, without its reference photos: what the app will load.
      const published = withoutReferences(await readFile(`patterns/${f}`, "utf8"));
      // A reference block hidden some other way (a /* */ or // comment) would still ship.
      const leak = published.match(IMAGE_URL);
      if (leak) throw new Error(`${f}: an image address would be published (${leak[0]}); remove it or put it under references`);
      const result = loadRecipe(published);
      if (!result.ok) throw new Error(`${f}:\n${result.errors.map(formatError).join("\n")}`);
      return result.recipe;
    }),
  );
}

const card = (id: string) => `public/renders/${id}/card.webp`;

/** A pattern's preview picture: its gallery render on paper, at the size link previews use. */
async function patternImage(id: string): Promise<Buffer> {
  const fly = await sharp(card(id)).resize({ height: 600, width: 1100, fit: "inside" }).toBuffer();
  return sharp({ create: { ...OG, channels: 3, background: PAPER } })
    .composite([{ input: fly, gravity: "centre" }])
    .jpeg({ quality: 85 })
    .toBuffer();
}

/** The site's preview picture: six flies from the catalog laid out like a specimen plate. */
async function siteImage(ids: string[]): Promise<Buffer> {
  const cols = 3;
  const w = 360;
  const h = 240;
  const tiles = await Promise.all(
    ids.slice(0, 6).map(async (id, i) => ({
      input: await sharp(card(id)).resize(w, h).toBuffer(),
      left: 30 + (i % cols) * (w + 30),
      top: 45 + Math.floor(i / cols) * (h + 30),
    })),
  );
  return sharp({ create: { ...OG, channels: 3, background: PAPER } }).composite(tiles).jpeg({ quality: 85 }).toBuffer();
}

const recipes = await loadPatterns();
const template = await readFile(`${DIST}/index.html`, "utf8");
const pages = sitePages(recipes, BASE);
const rendered = (id?: string) => (id && existsSync(card(id)) ? id : undefined);

await mkdir(`${DIST}/og`, { recursive: true });
// A spread of types for the site's picture, then any others that have a render.
const plate = ["elk-hair-caddis", "teal-blue-and-silver", "gold-ribbed-hares-ear-nymph", "royal-wulff", "willie-gunn", "klinkhamer-special"];
const siteIds = [...new Set([...plate, ...recipes.map((r) => r.id)])].filter((id) => rendered(id));
await writeFile(`${DIST}/og/site.jpg`, await siteImage(siteIds));
const images = new Set(pages.map((p) => rendered(p.image)).filter((id): id is string => !!id));
for (const id of images) await writeFile(`${DIST}/og/${id}.jpg`, await patternImage(id));

for (const page of pages) {
  const id = rendered(page.image);
  const html = pageHtml(template, page, { url: SITE_URL, base: BASE, image: id ? `og/${id}.jpg` : "og/site.jpg" });
  await mkdir(`${DIST}/${page.path}`, { recursive: true });
  await writeFile(`${DIST}/${page.path}index.html`, html);
}

// The final word on reference photos: none of their addresses may be in the built bundle,
// whatever form a block took or whatever happens to the build plugin that strips them.
const photos = (
  await Promise.all(
    (await readdir("patterns")).filter((f) => f.endsWith(".kdl")).map(async (f) => {
      const raw = loadRecipe(await readFile(`patterns/${f}`, "utf8"));
      return raw.ok ? raw.recipe.references.map((r) => r.image) : [];
    }),
  )
).flat();
for (const f of (await readdir(`${DIST}/assets`)).filter((f) => f.endsWith(".js"))) {
  const js = await readFile(`${DIST}/assets/${f}`, "utf8");
  const shipped = photos.find((url) => js.includes(url));
  if (shipped) throw new Error(`dist/assets/${f} contains a reference photo address: ${shipped}`);
}

// The service worker caches the app's own files on install, so the site works offline
// after the first visit; the cache is named after this build's files.
const assets = (await readdir(`${DIST}/assets`)).sort();
const shell = ["./", "./manifest.webmanifest", "./favicon.svg", "./logo.svg", "./renders/manifest.json", ...assets.filter((f) => /\.(js|css)$/.test(f)).map((f) => `./assets/${f}`)];
// Only the Latin subsets: the text is English with some Nordic and Polish names; browsers
// fetch other subsets when a page needs them.
const fonts = assets.filter((f) => /-latin(-ext)?-.*\.woff2$/.test(f)).map((f) => `./assets/${f}`);
const build = createHash("sha256").update([...shell, ...fonts].join("\n")).update(await readFile("public/renders/manifest.json")).digest("hex").slice(0, 12);
const sw = await readFile(`${DIST}/sw.js`, "utf8");
const filled = sw
  .replace('const CACHE = "flybench-dev";', () => `const CACHE = "flybench-${build}";`)
  .replace(/const SHELL = \[[^\]]*\];/, () => `const SHELL = ${JSON.stringify(shell)};`)
  .replace("const FONTS = [];", () => `const FONTS = ${JSON.stringify(fonts)};`);
if (!filled.includes(build) || !filled.includes("./assets/index-") || !filled.includes("woff2")) throw new Error("sw.js: CACHE, SHELL or FONTS not found to fill in");
await writeFile(`${DIST}/sw.js`, filled);

// GitHub Pages serves 404.html for any address without a file; the app shows "not found".
await writeFile(
  `${DIST}/404.html`,
  pageHtml(template, { path: "404.html", title: `Not found, ${SITE_NAME}`, description: "There is nothing at this address.", noindex: true, body: "" }, { base: BASE }),
);

if (SITE_URL) {
  const urls = pages.filter((p) => !p.noindex).map((p) => `  <url><loc>${SITE_URL}${BASE}${p.path}</loc></url>`);
  await writeFile(`${DIST}/sitemap.xml`, `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join("\n")}\n</urlset>\n`);
  // Crawlers only read robots.txt at the root of a host; under a project path it would be ignored.
  if (BASE === "/") await writeFile(`${DIST}/robots.txt`, `User-agent: *\nAllow: /\nSitemap: ${SITE_URL}/sitemap.xml\n`);
}

console.log(`${pages.length} pages, ${images.size + 1} preview pictures${SITE_URL ? ", sitemap" : " (no SITE_URL: no sitemap or absolute links)"}`);
