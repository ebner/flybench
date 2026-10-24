import { findPattern } from "./patterns";
import { FlyScene, VIEW_NAMES, type ViewName } from "./render/FlyScene";
import { simulate } from "./tying/simulate";

/**
 * Renders one finished fly for scripts/render.ts:
 *   render.html?pattern=<id>&view=<side|top|front|three-quarter|default>&grid=1
 * Sets `data-ready` on <body> when the frame is drawn, or `data-error` on failure.
 */
const params = new URLSearchParams(location.search);
const id = params.get("pattern") ?? "";
const view = (params.get("view") ?? "side") as ViewName;

const pattern = findPattern(id);
if (!pattern || !VIEW_NAMES.includes(view)) {
  document.body.dataset.error = !pattern ? `unknown pattern "${id}"` : `unknown view "${view}"`;
} else {
  // A narrow field of view keeps proportions nearly free of perspective distortion.
  const scene = new FlyScene(document.getElementById("stage")!, { fov: 8, background: "#f4f1ea" });
  const build = simulate(pattern.recipe);
  scene.setBuild(build);
  scene.setView(view);
  scene.setGrid(params.get("grid") === "1");
  scene.setTime(build.duration);
  // Two frames: one to render, one to be sure it has been presented.
  requestAnimationFrame(() => requestAnimationFrame(() => (document.body.dataset.ready = "1")));
}
