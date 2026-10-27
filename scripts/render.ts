/**
 * Renders finished flies to PNG.
 *
 *   pnpm render                     all patterns, side view
 *   pnpm render red-tag --view top  one pattern, another view
 *   pnpm render --grid              with the measuring grid (gape units)
 *
 * Output: .cache/renders/<id>/<view>[-grid].png
 */
import { parseArgs } from "node:util";
import { patternIds, Renderer, VIEWS, type View } from "./lib/renderer";

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    view: { type: "string", default: "side" },
    grid: { type: "boolean", default: false },
    out: { type: "string", default: ".cache/renders" },
  },
});

const view = values.view as View;
if (!VIEWS.includes(view)) throw new Error(`--view must be one of: ${VIEWS.join(", ")}`);
const ids = positionals.length > 0 ? positionals : await patternIds();

const renderer = await Renderer.start();
try {
  for (const id of ids) {
    const out = `${values.out}/${id}/${view}${values.grid ? "-grid" : ""}.png`;
    await renderer.render({ pattern: id, view, grid: values.grid, out });
    console.log(out);
  }
} finally {
  await renderer.stop();
}
