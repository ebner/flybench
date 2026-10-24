import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { publishPlugin } from "./scripts/publish-plugin";
import { studioPlugin } from "./scripts/studio-plugin";

export default defineConfig({
  // Where the site lives on its host: "/" by default, "/flybench/" for a GitHub Pages project
  // site (the deploy workflow sets BASE_PATH). Pages have real paths, so assets need an absolute base.
  base: process.env.BASE_PATH ?? "/",
  // The studio plugin only exists on the dev server; the build never includes it. The
  // publish plugin leaves reference photo links out of the built site.
  plugins: [react(), studioPlugin(import.meta.dirname), publishPlugin()],
  test: {
    include: ["src/**/*.test.ts"],
  },
});
