import { swatchRecipe } from "./catalog/swatch";
import { findNatural } from "./naturals";
import { findPattern } from "./patterns";
import type { MaterialKind } from "./recipe/materials";
import { FlyScene, naturalAlone, naturalFishing, VIEW_NAMES, type ViewName } from "./render/FlyScene";
import { loadRealAssets, siteAssets, type RealAssetUrls } from "./render/real/assets";
import { WATER_LOOKS } from "./render/water";
import { fishing } from "./tying/fishing";
import { ridesPointUp } from "./tying/hook";
import { simulate } from "./tying/simulate";

/**
 * Renders one finished fly for the scripts in scripts/:
 *   render.html?pattern=<id>&view=<side|top|front|three-quarter|default>
 *     &grid=1           measuring grid in gapes
 *     &transparent=1    no background
 *     &fov=<degrees>    field of view (default 8: nearly free of perspective)
 *     &fit=sphere       same framing from every angle (turntables)
 *     &pose=pictured    as flies are usually pictured: point-up flies point up, others as tied
 *   render.html?swatch=<kind>:<colour>&…   a material on a bare hook, framed close (Materials page)
 *   render.html?natural=<id>&…               a natural on its own
 *   render.html?water=<angler|below>&pattern=<id> (or &natural=<id>)&samples=<n>
 *                     the finished fly (or the natural) in the realistic water, path traced with
 *                     n samples (scripts/render-water.ts); &assets=site uses the site's own
 *                     copies of the panorama and gravel instead of the sharper ones in .cache/env
 * Sets `data-ready` on <body> when the frame is drawn, or `data-error` on failure.
 * `window.turnTo(degrees)` turns the view around the vertical axis for turntable frames.
 */
const params = new URLSearchParams(location.search);
const id = params.get("pattern") ?? "";
const view = (params.get("view") ?? "side") as ViewName;
const fit = params.get("fit") === "sphere" ? "sphere" : "box";

declare global {
  interface Window {
    turnTo?: (degrees: number) => Promise<void>;
    /** The path-traced picture as a PNG data address (water stills). */
    waterStill?: string;
  }
}

const nextFrame = () => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));

const waterView = params.get("water");
// Sharper copies for the stills, fetched by scripts/render-water.ts and never served by the site.
const HIRES: RealAssetUrls = {
  sky: "/.cache/env/blau_river_2k.hdr",
  gravel: { color: "/.cache/env/clean_pebbles_diff_2k.jpg", normal: "/.cache/env/clean_pebbles_nor_gl_2k.jpg", height: "/.cache/env/gravel-height-2k.png" },
};

const swatch = params.get("swatch")?.match(/^([a-z-]+):(.+)$/);
const pattern = swatch ? { recipe: swatchRecipe(swatch[1] as MaterialKind, swatch[2]!) } : findPattern(id);
const natural = params.get("natural") ? findNatural(params.get("natural")!) : undefined;
if (waterView === "angler" || waterView === "below") {
  renderInWater(waterView).catch((e: unknown) => (document.body.dataset.error = String(e instanceof Error ? e.stack : e)));
} else if (natural && VIEW_NAMES.includes(view)) {
  // A natural on its own (the Naturals pages' pictures).
  const transparent = params.get("transparent") === "1";
  if (transparent) document.documentElement.style.background = document.body.style.background = "transparent";
  const scene = new FlyScene(document.getElementById("stage")!, { fov: Number(params.get("fov") ?? 8), background: transparent ? null : "#f4f1ea" });
  scene.setNatural(natural);
  scene.setView(view, 0, fit);
  window.turnTo = async (degrees) => {
    scene.setView(view, degrees, fit);
    scene.renderNow();
    await nextFrame();
  };
  nextFrame().then(() => (document.body.dataset.ready = "1"));
} else if (!pattern || !VIEW_NAMES.includes(view)) {
  document.body.dataset.error = !pattern ? `unknown pattern "${id}"` : `unknown view "${view}"`;
} else {
  const transparent = params.get("transparent") === "1";
  if (transparent) document.documentElement.style.background = document.body.style.background = "transparent";
  const scene = new FlyScene(document.getElementById("stage")!, {
    fov: Number(params.get("fov") ?? 8),
    background: transparent ? null : "#f4f1ea",
  });
  const build = simulate(pattern.recipe);
  scene.setBuild(build);
  // Flies that swim point up (jigs, weighted eyes) are usually photographed that way; others as tied.
  if (params.get("pose") === "pictured" && ridesPointUp(pattern.recipe)) scene.setTurnedOver(true);
  scene.setView(view, 0, fit);
  if (swatch) scene.setFraming("dressing");
  scene.setGrid(params.get("grid") === "1");
  scene.setTime(build.duration);
  window.turnTo = async (degrees) => {
    scene.setView(view, degrees, fit);
    scene.renderNow();
    await nextFrame();
  };
  nextFrame().then(() => (document.body.dataset.ready = "1"));
}

/** A fly or a natural in the realistic water, path traced; `data-seconds` says how long it took. */
async function renderInWater(view: "angler" | "below") {
  const real = await loadRealAssets(params.get("assets") === "site" ? siteAssets("/") : HIRES);
  // The viewers' fields of view (the pattern page's, the natural pages'), so exploring live doesn't jump.
  const scene = new FlyScene(document.getElementById("stage")!, { fov: Number(params.get("fov") ?? (natural ? 20 : 32)), background: null });
  if (natural) {
    scene.setNatural(natural, naturalAlone(natural));
    scene.setWater({ fishing: naturalFishing(natural), view, still: true, look: WATER_LOOKS.light, real, detailed: true });
  } else {
    if (!pattern) throw new Error(`unknown pattern "${id}"`);
    const build = simulate(pattern.recipe);
    scene.setBuild(build);
    scene.setTime(build.duration);
    // In the water a point-up fly is shown the way it swims.
    if (ridesPointUp(pattern.recipe)) scene.setTurnedOver(true);
    scene.setWater({ fishing: fishing(pattern.recipe), view, still: true, look: WATER_LOOKS.light, real, detailed: true });
  }
  await nextFrame();
  const { pathTrace } = await import("./render/real/trace");
  const { seconds, image } = await pathTrace(scene.forTracing(), Number(params.get("samples") ?? 300), nextFrame);
  window.waterStill = image;
  document.body.dataset.seconds = String(Math.round(seconds));
  document.body.dataset.ready = "1";
}
