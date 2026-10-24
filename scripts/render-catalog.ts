/**
 * Renders the gallery images for every pattern into public/renders/<id>/ (committed):
 *   card.webp   the finished fly on a transparent ground
 *   spin.webp   a turntable: FRAMES views in one row, played on hover
 *
 *   npm run render:catalog            only patterns whose recipe or renderer changed
 *   npm run render:catalog -- --force  everything
 *   npm run render:catalog -- red-tag  just these
 *
 * Whether a pattern is up to date is decided by a hash of its recipe and of the code
 * that produces the images, kept in public/renders/manifest.json.
 */
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { parseArgs } from "node:util";
import sharp from "sharp";
import { patternIds, Renderer } from "./lib/renderer";

export const FRAMES = 24;
const FRAME = { width: 600, height: 400 };
const OUT = "public/renders";
const MANIFEST = `${OUT}/manifest.json`;
/** Code that affects how a finished fly looks. */
const RENDER_SOURCES = ["src/render", "src/tying", "src/recipe/materials.ts", "src/recipe/schema.ts", "scripts/render-catalog.ts"];
const CONCURRENCY = 3;

const { values, positionals } = parseArgs({ allowPositionals: true, options: { force: { type: "boolean", default: false } } });

async function filesUnder(path: string): Promise<string[]> {
  if (path.endsWith(".ts")) return [path];
  const entries = await readdir(path, { withFileTypes: true, recursive: true });
  return entries
    .filter((e) => e.isFile() && !e.name.endsWith(".test.ts"))
    .map((e) => join(e.parentPath, e.name))
    .sort();
}

async function rendererHash(): Promise<string> {
  const hash = createHash("sha256");
  for (const source of RENDER_SOURCES) for (const file of await filesUnder(source)) hash.update(await readFile(file));
  return hash.digest("hex");
}

type Manifest = Record<string, { hash: string; frames: number; width: number; height: number }>;

const manifest: Manifest = existsSync(MANIFEST) ? JSON.parse(await readFile(MANIFEST, "utf8")) : {};
const codeHash = await rendererHash();
const all = await patternIds();
const ids = positionals.length > 0 ? positionals : all;

const todo: { id: string; hash: string }[] = [];
for (const id of ids) {
  const hash = createHash("sha256").update(codeHash).update(await readFile(`patterns/${id}.kdl`)).digest("hex").slice(0, 16);
  if (values.force || manifest[id]?.hash !== hash || !existsSync(`${OUT}/${id}/spin.webp`)) todo.push({ id, hash });
}
// Patterns that no longer exist.
for (const id of Object.keys(manifest)) if (!all.includes(id)) delete manifest[id];

if (todo.length === 0) {
  console.log("All renders are up to date.");
} else {
  const renderer = await Renderer.start();
  try {
    const queue = [...todo];
    await Promise.all(
      Array.from({ length: Math.min(CONCURRENCY, queue.length) }, async () => {
        for (let job = queue.shift(); job; job = queue.shift()) {
          const frames = await renderer.turntable(
            { pattern: job.id, view: "default", transparent: true, fov: 20, ...FRAME },
            FRAMES,
          );
          await mkdir(`${OUT}/${job.id}`, { recursive: true });
          await sharp(frames[0]).webp({ quality: 85, alphaQuality: 90 }).toFile(`${OUT}/${job.id}/card.webp`);
          const half = { width: FRAME.width / 2, height: FRAME.height / 2 };
          const tiles = await Promise.all(frames.map((f) => sharp(f).resize(half).png().toBuffer()));
          await sharp({ create: { width: half.width * FRAMES, height: half.height, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
            .composite(tiles.map((input, i) => ({ input, left: i * half.width, top: 0 })))
            .webp({ quality: 75, alphaQuality: 80 })
            .toFile(`${OUT}/${job.id}/spin.webp`);
          manifest[job.id] = { hash: job.hash, frames: FRAMES, ...half };
          console.log(`${OUT}/${job.id}`);
        }
      }),
    );
  } finally {
    await renderer.stop();
  }
}
await writeFile(MANIFEST, JSON.stringify(Object.fromEntries(Object.entries(manifest).sort()), null, 2) + "\n");
