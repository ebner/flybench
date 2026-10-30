/**
 * Puts a pattern's or natural's water stills (public/renders/water) beside photos of real flies
 * and insects on and under the water (scripts/water-references.json), to judge the realistic
 * water: contact with the film, dimples and their shadows, wetness, the tippet and knot.
 *
 *   pnpm watercheck adams            a pattern: its stills, its own photos and the groups for how it is fished
 *   pnpm watercheck mayfly-dun       a natural: its stills and its own group
 *   pnpm watercheck adams knot       the stills beside one or more chosen groups
 *
 * Output: .cache/watercheck/<id>.png. Photos are cached in .cache/water-references/ and never
 * leave this machine (see AGENTS.md: the photos are not committed).
 */
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import sharp from "sharp";
import { loadRecipe } from "../src/recipe/load";
import { fishing } from "../src/tying/fishing";

const USER_AGENT = "flybench-watercheck/0.1 (https://github.com/ebner/flybench; authoring tool, images not redistributed)";
const HEIGHT = 340;
const WIDTH = 1800;

interface Reference {
  image: string;
  page: string;
  author: string;
  license: string;
  view: string;
  shows: string;
  compare: string;
}

const [id, ...chosen] = process.argv.slice(2);
if (!id) throw new Error("usage: pnpm watercheck <pattern or natural id> [groups…]");
const references: Record<string, Reference[]> = JSON.parse(await readFile("scripts/water-references.json", "utf8"));

const isPattern = existsSync(`patterns/${id}.kdl`);
const kind = isPattern ? "patterns" : "naturals";
let groups = chosen;
if (groups.length === 0) {
  if (isPattern) {
    const r = loadRecipe(await readFile(`patterns/${id}.kdl`, "utf8"));
    if (!r.ok) throw new Error(`${id}.kdl does not load`);
    const depth = fishing(r.recipe).depth;
    // Its own photos on the water first, when it has some.
    const own = id in references ? [id] : [];
    groups = [...own, ...(depth === "surface" || depth === "film" ? ["dry-above", "dry-below", "tippet-film", "knot"] : ["wet-under", "knot"])];
  } else {
    groups = [id in references ? id : "contact-macro", "contact-macro"];
  }
}

async function fetchPhoto(url: string): Promise<string> {
  const ext = url.match(/\.(jpe?g|png|webp)(?:$|\?)/i)?.[1] ?? "jpg";
  const path = `.cache/water-references/${createHash("sha256").update(url).digest("hex").slice(0, 16)}.${ext}`;
  if (existsSync(path)) return path;
  const response = await fetch(url, { headers: { "User-Agent": USER_AGENT } });
  if (!response.ok) throw new Error(`${url}: HTTP ${response.status}`);
  await mkdir(".cache/water-references", { recursive: true });
  await writeFile(path, Buffer.from(await response.arrayBuffer()));
  return path;
}

/** Images scaled to one height, laid out in rows no wider than WIDTH. */
async function rows(paths: string[]): Promise<{ input: Buffer; top: number; left: number }[][]> {
  const out: { input: Buffer; top: number; left: number }[][] = [[]];
  let x = 0;
  for (const path of paths) {
    const input = await sharp(path).resize({ height: HEIGHT }).png().toBuffer();
    const { width = 0 } = await sharp(input).metadata();
    if (x + width > WIDTH && x > 0) {
      out.push([]);
      x = 0;
    }
    out.at(-1)!.push({ input, top: 0, left: x });
    x += Math.min(width, WIDTH) + 8;
  }
  return out;
}

const stills = ["angler", "below"].map((v) => `public/renders/water/${kind}/${id}/${v}.webp`).filter((p) => existsSync(p));
const photos: string[] = [];
for (const group of [...new Set(groups)]) {
  for (const ref of references[group] ?? []) {
    try {
      photos.push(await fetchPhoto(ref.image));
    } catch (e) {
      console.warn(`${group}: ${e instanceof Error ? e.message : e}`);
    }
  }
}
const all = [...(await rows(stills)), ...(await rows(photos))];
const composite = all.flatMap((row, i) => row.map((c) => ({ ...c, top: i * (HEIGHT + 8) })));
await mkdir(".cache/watercheck", { recursive: true });
const file = `.cache/watercheck/${id}.png`;
await sharp({ create: { width: WIDTH, height: all.length * (HEIGHT + 8), channels: 3, background: "#ffffff" } })
  .composite(composite)
  .png()
  .toFile(file);
console.log(`${file} (${groups.join(", ")}; the stills first)`);
