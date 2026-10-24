import { findPattern } from "./patterns";
import { FlyScene, VIEW_NAMES, type ViewName } from "./render/FlyScene";
import { simulate } from "./tying/simulate";

/**
 * Renders one finished fly for the scripts in scripts/:
 *   render.html?pattern=<id>&view=<side|top|front|three-quarter|default>
 *     &grid=1           measuring grid in gapes
 *     &transparent=1    no background
 *     &fov=<degrees>    field of view (default 8: nearly free of perspective)
 *     &fit=sphere       same framing from every angle (turntables)
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
  }
}

const nextFrame = () => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));

const pattern = findPattern(id);
if (!pattern || !VIEW_NAMES.includes(view)) {
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
  scene.setView(view, 0, fit);
  scene.setGrid(params.get("grid") === "1");
  scene.setTime(build.duration);
  window.turnTo = async (degrees) => {
    scene.setView(view, degrees, fit);
    scene.renderNow();
    await nextFrame();
  };
  nextFrame().then(() => (document.body.dataset.ready = "1"));
}
