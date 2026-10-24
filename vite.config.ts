import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { publishPlugin } from "./scripts/publish-plugin";
import { studioPlugin } from "./scripts/studio-plugin";

export default defineConfig({
  // Relative asset paths, so the build works from any host or subdirectory.
  base: "./",
  // The studio plugin only exists on the dev server; the build never includes it. The
  // publish plugin leaves reference photo links out of the built site.
  plugins: [react(), studioPlugin(import.meta.dirname), publishPlugin()],
  test: {
    include: ["src/**/*.test.ts"],
  },
});
