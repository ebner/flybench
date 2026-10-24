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
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import sharp from "sharp";
import { pageHtml, sitePages, SITE_NAME } from "../src/catalog/pages";
import { formatError } from "../src/recipe/errors";
import { loadRecipe } from "../src/recipe/load";
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
      const result = loadRecipe(await readFile(`patterns/${f}`, "utf8"));
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
