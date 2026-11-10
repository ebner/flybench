import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import type { Plugin } from "vite";
import { validateCatalog } from "../src/recipe/catalog";
import { formatError } from "../src/recipe/errors";
import { loadRecipe, locate } from "../src/recipe/load";
import { loadNatural, type Natural } from "../src/recipe/natural";
import { withoutReferences } from "../src/recipe/publish";
import type { Recipe } from "../src/recipe/schema";

const ID = "virtual:flybench/catalog";

/** What the app gets as "virtual:flybench/catalog" (src/patterns.ts, src/naturals.ts). */
export interface CatalogData {
  patterns: { file: string; recipe: Recipe }[];
  /** Problems with pattern files, as "file: message" lines; those patterns are left out. */
  patternErrors: string[];
  naturals: Natural[];
  naturalErrors: string[];
}

/**
 * The patterns and naturals, read and checked here rather than in the browser: the app gets
 * them as data, so a page doesn't parse and validate every recipe before it shows.
 * In the production build the recipes and naturals go without their `references` block: the reference
 * photos are for authoring only and are not ours to publish. The dev server keeps them, so
 * refcheck and the studio see the whole recipe, and reloads the page when a file changes.
 */
export function catalogPlugin(root: string): Plugin {
  let building = false;
  const dirs = [path.join(root, "patterns"), path.join(root, "naturals")];
  return {
    name: "flybench-catalog",
    enforce: "pre",
    config(_, env) {
      building = env.command === "build";
    },
    resolveId(id) {
      return id === ID ? `\0${ID}` : null;
    },
    async load(id) {
      if (id !== `\0${ID}`) return null;
      const data = await readCatalog(root, building, (file) => this.addWatchFile(file));
      return `export default JSON.parse(${JSON.stringify(JSON.stringify(data))});`;
    },
    configureServer(server) {
      const changed = (file: string) => {
        if (!file.endsWith(".kdl") || !dirs.includes(path.dirname(file))) return;
        const module = server.moduleGraph.getModuleById(`\0${ID}`);
        if (!module) return;
        server.moduleGraph.invalidateModule(module);
        server.ws.send({ type: "full-reload" });
      };
      server.watcher.on("add", changed).on("change", changed).on("unlink", changed);
    },
  };
}

export async function readCatalog(root: string, publish: boolean, watch: (file: string) => void = () => {}): Promise<CatalogData> {
  const read = async (dir: string) =>
    Promise.all(
      (await readdir(path.join(root, dir)))
        .filter((f) => f.endsWith(".kdl"))
        .sort()
        .map(async (file) => {
          watch(path.join(root, dir, file));
          return { file, text: await readFile(path.join(root, dir, file), "utf8") };
        }),
    );

  const naturals: Natural[] = [];
  const naturalErrors: string[] = [];
  for (const { file, text } of await read("naturals")) {
    const result = loadNatural(publish ? withoutReferences(text) : text);
    if (result.ok) {
      if (file !== `${result.natural.id}.kdl`) naturalErrors.push(`${file}: file name should match the id: ${result.natural.id}.kdl`);
      naturals.push(result.natural);
    } else naturalErrors.push(...result.errors.map((e) => `${file}: ${formatError(e)}`));
  }

  const patterns: CatalogData["patterns"] = [];
  const patternErrors: string[] = [];
  const texts = new Map<string, string>();
  for (const { file, text: whole } of await read("patterns")) {
    const text = publish ? withoutReferences(whole) : whole;
    texts.set(file, text);
    const result = loadRecipe(text);
    if (result.ok) patterns.push({ file, recipe: result.recipe });
    else patternErrors.push(...result.errors.map((e) => `${file}: ${formatError(e)}`));
  }
  patternErrors.push(
    ...validateCatalog(patterns, new Set(naturals.map((n) => n.id))).map(
      (e) => `${e.file}: ${formatError(locate(texts.get(e.file)!, { message: e.message, path: e.path }))}`,
    ),
  );
  return { patterns, patternErrors, naturals, naturalErrors };
}
