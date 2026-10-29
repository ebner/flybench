/**
 * Renders the realistic water's stills: every pattern and every natural in the river, path
 * traced, from above (the angler's view) and from below (a trout's), into
 * public/renders/water/ (committed):
 *   patterns/<id>/angler.webp, patterns/<id>/below.webp
 *   naturals/<id>/angler.webp, naturals/<id>/below.webp
 * listed with their versions in water/manifest.json.
 *
 *   pnpm render:water                 only what changed since the last run
 *   pnpm render:water --force         everything
 *   pnpm render:water red-tag ant     just these (patterns or naturals)
 *   pnpm render:water --samples 120   faster, noisier (for a look)
 *
 * Path tracing is slow (tens of seconds a picture on a desktop graphics card), so this is kept
 * apart from render:catalog. The panorama and gravel are the sharper 2k copies in .cache/env/,
 * fetched from Poly Haven (CC0) on the first run.
 */
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { parseArgs } from "node:util";
import sharp from "sharp";
import { patternIds, Renderer } from "./lib/renderer";

const OUT = "public/renders/water";
const MANIFEST = `${OUT}/manifest.json`;
const SIZE = { width: 1200, height: 800 };
const VIEWS = ["angler", "below"] as const;
/** Code that affects how the stills look. */
// This script's own settings that change the pictures (size, views, samples) are hashed below.
const SOURCES = ["src/render", "src/tying", "src/recipe/materials.ts", "src/recipe/schema.ts", "src/recipe/natural.ts", "src/render-page.ts", "render.html", "scripts/lib/renderer.ts", "public/env", "pnpm-lock.yaml"];
const ENV = ".cache/env";
const POLY_HAVEN = "https://dl.polyhaven.org/file/ph-assets";
const DOWNLOADS: Record<string, string> = {
  "blau_river_2k.hdr": `${POLY_HAVEN}/HDRIs/hdr/2k/blau_river_2k.hdr`,
  "clean_pebbles_diff_2k.jpg": `${POLY_HAVEN}/Textures/jpg/2k/clean_pebbles/clean_pebbles_diff_2k.jpg`,
  "clean_pebbles_nor_gl_2k.jpg": `${POLY_HAVEN}/Textures/jpg/2k/clean_pebbles/clean_pebbles_nor_gl_2k.jpg`,
  "clean_pebbles_disp_2k.jpg": `${POLY_HAVEN}/Textures/jpg/2k/clean_pebbles/clean_pebbles_disp_2k.jpg`,
};

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: { force: { type: "boolean", default: false }, samples: { type: "string", default: "300" } },
});

async function filesUnder(path: string): Promise<string[]> {
  if (/\.[a-z]+$/.test(path)) return [path];
  const entries = await readdir(path, { withFileTypes: true, recursive: true });
  return entries
    .filter((e) => e.isFile() && !e.name.endsWith(".test.ts"))
    .map((e) => join(e.parentPath, e.name))
    .sort();
}

async function fetchAssets() {
  await mkdir(ENV, { recursive: true });
  for (const [file, url] of Object.entries(DOWNLOADS)) {
    if (existsSync(`${ENV}/${file}`)) continue;
    console.log(`fetching ${url}`);
    const response = await fetch(url);
    if (!response.ok) throw new Error(`${url}: ${response.status}`);
    await writeFile(`${ENV}/${file}`, Buffer.from(await response.arrayBuffer()));
  }
  if (!existsSync(`${ENV}/gravel-height-2k.png`)) await sharp(`${ENV}/clean_pebbles_disp_2k.jpg`).greyscale().png().toFile(`${ENV}/gravel-height-2k.png`);
}

type Manifest = { patterns: Record<string, string>; naturals: Record<string, string> };
const manifest: Manifest = existsSync(MANIFEST) ? JSON.parse(await readFile(MANIFEST, "utf8")) : { patterns: {}, naturals: {} };
const code = createHash("sha256");
for (const source of SOURCES) for (const file of await filesUnder(source)) code.update(await readFile(file));
code.update(JSON.stringify({ samples: values.samples, size: SIZE, views: VIEWS }));
const codeHash = code.digest("hex");

const patterns = await patternIds();
const naturals = (await readdir("naturals")).filter((f) => f.endsWith(".kdl")).map((f) => f.replace(/\.kdl$/, "")).sort();
const jobs: { kind: "patterns" | "naturals"; id: string; hash: string }[] = [];
for (const [kind, ids, dir] of [["patterns", patterns, "patterns"], ["naturals", naturals, "naturals"]] as const) {
  for (const id of ids) {
    if (positionals.length > 0 && !positionals.includes(id)) continue;
    const hash = createHash("sha256").update(codeHash).update(await readFile(`${dir}/${id}.kdl`)).digest("hex").slice(0, 16);
    const done = VIEWS.every((v) => existsSync(`${OUT}/${kind}/${id}/${v}.webp`));
    if (values.force || manifest[kind][id] !== hash || !done) jobs.push({ kind, id, hash });
  }
  for (const id of Object.keys(manifest[kind])) if (!ids.includes(id)) delete manifest[kind][id];
  // Pictures of patterns and naturals that are gone.
  if (existsSync(`${OUT}/${kind}`)) for (const id of await readdir(`${OUT}/${kind}`)) if (!ids.includes(id)) await rm(`${OUT}/${kind}/${id}`, { recursive: true });
}

const save = () =>
  writeFile(
    MANIFEST,
    JSON.stringify({ patterns: Object.fromEntries(Object.entries(manifest.patterns).sort()), naturals: Object.fromEntries(Object.entries(manifest.naturals).sort()) }, null, 2) + "\n",
  );

if (jobs.length === 0) {
  console.log("All water stills are up to date.");
} else {
  await fetchAssets();
  let renderer = await Renderer.start();
  /** One picture; a lost graphics context (a long frame can trip the driver's watchdog) gets a fresh browser and another try. */
  const still = async (query: Record<string, string>, out: string) => {
    for (let attempt = 1; ; attempt++) {
      try {
        const page = await renderer.openQuery(query, SIZE, 1_800_000);
        try {
          const { image, seconds } = await page.evaluate(() => ({ image: window.waterStill!, seconds: document.body.dataset.seconds }));
          const png = Buffer.from(image.replace(/^data:image\/png;base64,/, ""), "base64");
          await sharp(png).webp({ quality: 80 }).toFile(out);
          console.log(`${out} (${seconds} s)`);
          return;
        } finally {
          await page.close();
        }
      } catch (e) {
        if (attempt >= 3) throw e;
        console.warn(`${out}: ${e instanceof Error ? e.message.split("\n")[0] : e}; starting a new browser`);
        await renderer.stop().catch(() => {});
        renderer = await Renderer.start();
      }
    }
  };
  try {
    for (const job of jobs) {
      await mkdir(`${OUT}/${job.kind}/${job.id}`, { recursive: true });
      for (const view of VIEWS) {
        await still({ [job.kind === "patterns" ? "pattern" : "natural"]: job.id, water: view, samples: values.samples }, `${OUT}/${job.kind}/${job.id}/${view}.webp`);
      }
      manifest[job.kind][job.id] = job.hash;
      // Saved after each, so an interrupted run keeps what it finished.
      await save();
    }
  } finally {
    await renderer.stop();
  }
}
await save();
