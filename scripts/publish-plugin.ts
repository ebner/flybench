import { readFile } from "node:fs/promises";
import type { Plugin } from "vite";
import { withoutReferences } from "../src/recipe/publish";

/**
 * In the production build, pattern files are bundled without their `references` block:
 * the reference photos are for authoring only and are not ours to publish. The dev server
 * keeps them, so refcheck and the studio see the whole recipe.
 */
export function publishPlugin(): Plugin {
  return {
    name: "flybench-publish",
    apply: "build",
    enforce: "pre",
    async load(id) {
      const match = /^(.+\.kdl)\?raw$/.exec(id);
      if (!match?.[1]) return null;
      return `export default ${JSON.stringify(withoutReferences(await readFile(match[1], "utf8")))};`;
    },
  };
}
