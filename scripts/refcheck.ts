/**
 * Builds a contact sheet for checking a pattern's proportions against reference photos:
 * the finished fly from the side on a measuring grid (in gapes), the recipe's
 * proportions, and the photos from the recipe's `references` block, mirrored where
 * needed so the eye points right.
 *
 *   pnpm refcheck elk-hair-caddis [more ids…]
 *   pnpm refcheck                    all patterns with references
 *
 * Output: .cache/refcheck/<id>.png. Photos are cached in .cache/references/ and are
 * never committed or published; most are copyrighted.
 *
 * Read ratios off the photos relative to the hook gape (the gap between shank and
 * point), compare them with the recipe, and adjust the recipe where it is off.
 */
import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import sharp from "sharp";
import { formatError } from "../src/recipe/errors";
import { loadRecipe } from "../src/recipe/load";
import type { Recipe } from "../src/recipe/schema";
import { materialName } from "../src/tying/describe";
import { hookModel } from "../src/tying/hook";
import { patternIds, Renderer } from "./lib/renderer";

// Wikimedia throttles anonymous agents; identify the tool and where it comes from.
const USER_AGENT = "flybench-refcheck/0.1 (https://github.com/ebner/flybench; authoring tool, images not redistributed)";
const PHOTO_HEIGHT = 460;
const RENDER_WIDTH = 1050;
const PANEL_WIDTH = 640;
/** Characters per line in the proportions panel at its font size. */
const PANEL_CHARS = 52;

async function loadPattern(id: string): Promise<Recipe> {
  const result = loadRecipe(await readFile(`patterns/${id}.kdl`, "utf8"));
  if (!result.ok) throw new Error(`${id}.kdl:\n${result.errors.map(formatError).join("\n")}`);
  return result.recipe;
}

async function fetchReference(id: string, index: number, url: string): Promise<string> {
  const ext = url.match(/\.(jpe?g|png|webp)(?:$|\?)/i)?.[1] ?? "jpg";
  const path = `.cache/references/${id}/${index + 1}.${ext}`;
  if (existsSync(path)) return path;
  const response = await fetch(url, { headers: { "User-Agent": USER_AGENT } });
  if (!response.ok) throw new Error(`${url}: HTTP ${response.status}`);
  await mkdir(`.cache/references/${id}`, { recursive: true });
  await writeFile(path, Buffer.from(await response.arrayBuffer()));
  return path;
}

/** The proportions the recipe states, in the units a reviewer reads off the grid. */
export function proportions(recipe: Recipe): string[] {
  const name = (id: string) => {
    const m = recipe.materials.find((m) => m.id === id);
    return m ? materialName(m) : id;
  };
  const lines = [`${recipe.name}${recipe.variant ? ` (${recipe.variant})` : ""}`, `hook ${recipe.hook.model} ${recipe.hook.size !== undefined ? `#${recipe.hook.size}` : `${recipe.hook.length} mm`}`, ""];
  let thread = 0;
  for (const step of recipe.steps) {
    if (step.op === "attach-thread") thread = step.at;
    if (step.op === "wrap-thread" || step.op === "dub") thread = step.to;
    if (step.op === "tie-in" && step.length) {
      const extra = [
        step.angle !== undefined && `${step.angle}° up`,
        step.spread !== undefined && `spread ${step.spread}°`,
        step.width !== undefined && `${step.width} wide`,
      ].filter(Boolean);
      lines.push(`${name(step.material)}: ${step.length} gapes from x=${(thread * 2).toFixed(2)}${extra.length ? `, ${extra.join(", ")}` : ""}`);
    }
    if (step.op === "dub") lines.push(`${name(step.material)}: body to ${step.to} of the shank`);
    if (step.op === "wind") {
      lines.push(
        step.around
          ? `${name(step.material)}: ${step.turns} turns round the ${name(step.around).toLowerCase()}`
          : `${name(step.material)}: wound to ${step.to} of the shank, ${step.turns} turns`,
      );
    }
  }
  for (const m of recipe.materials) if (m.fibre) lines.push(`${materialName(m)}: fibres ${m.fibre} gapes`);
  const hook = hookModel(recipe.hook);
  lines.push(
    "",
    "Grid in gapes; x = 0 is the start of the bend.",
    `Shank: ${+hook.shankLength.toFixed(2)} gapes along the shank${hook.shankCurve ? `, curved ${hook.shankCurve}°` : ""} (${recipe.hook.model}).`,
  );
  return lines;
}

function escapeXml(s: string) {
  return s.replace(/[<>&"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;" })[c]!);
}

/** Wraps lines at word boundaries, indenting continuation lines. */
function wrap(lines: string[], chars: number): string[] {
  return lines.flatMap((line) => {
    const out: string[] = [];
    let current = "";
    for (const word of line.split(" ")) {
      if (current && (current + " " + word).length > chars) {
        out.push(current);
        current = "   " + word;
      } else {
        current = current ? `${current} ${word}` : word;
      }
    }
    out.push(current);
    return out;
  });
}

function textImage(lines: string[], width: number, height: number, size = 22): Buffer {
  const tspans = lines
    .map((l, i) => `<text x="16" y="${32 + i * size * 1.4}" font-size="${size}">${escapeXml(l)}</text>`)
    .join("");
  return Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><rect width="100%" height="100%" fill="#ffffff"/><g font-family="DejaVu Sans, sans-serif" fill="#222">${tspans}</g></svg>`,
  );
}

async function contactSheet(id: string, recipe: Recipe, renderPath: string, photos: string[]): Promise<string> {
  const render = await sharp(renderPath).resize({ width: RENDER_WIDTH }).png().toBuffer();
  const renderHeight = (await sharp(render).metadata()).height!;
  const panel = textImage(wrap(proportions(recipe), PANEL_CHARS), PANEL_WIDTH, renderHeight);

  const tiles: { input: Buffer; left: number; top: number }[] = [
    { input: render, left: 0, top: 0 },
    { input: panel, left: RENDER_WIDTH, top: 0 },
  ];
  let left = 0;
  const captionHeight = 34;
  for (const [i, path] of photos.entries()) {
    const ref = recipe.references[i]!;
    let img = sharp(path).resize({ height: PHOTO_HEIGHT });
    if (ref.flip) img = img.flop();
    const input = await img.png().toBuffer();
    const width = (await sharp(input).metadata()).width!;
    const caption = [`#${i + 1}${ref.flip ? " (mirrored)" : ""}: ${ref.note ?? ""}`.trim(), `${ref.author ?? ""} ${ref.license ?? ""}`.trim()].join(" · ");
    tiles.push({ input, left, top: renderHeight });
    tiles.push({ input: await sharp(textImage([caption], width, captionHeight, 16)).png().toBuffer(), left, top: renderHeight + PHOTO_HEIGHT });
    left += width;
  }

  const width = Math.max(RENDER_WIDTH + PANEL_WIDTH, left);
  const height = renderHeight + (photos.length ? PHOTO_HEIGHT + captionHeight : 0);
  const out = `.cache/refcheck/${id}.png`;
  await mkdir(".cache/refcheck", { recursive: true });
  await sharp({ create: { width, height, channels: 3, background: "#ffffff" } }).composite(tiles).png().toFile(out);
  return out;
}

const requested = process.argv.slice(2);
const ids = requested.length > 0 ? requested : await patternIds();
const renderer = await Renderer.start();
try {
  for (const id of ids) {
    const recipe = await loadPattern(id);
    if (recipe.references.length === 0) {
      if (requested.length > 0) console.warn(`${id}: no references in the recipe`);
      continue;
    }
    const renderPath = `.cache/renders/${id}/side-grid.png`;
    await renderer.render({ pattern: id, view: "side", grid: true, out: renderPath });
    const photos = await Promise.all(recipe.references.map((r, i) => fetchReference(id, i, r.image)));
    console.log(await contactSheet(id, recipe, renderPath, photos));
  }
} finally {
  await renderer.stop();
}
