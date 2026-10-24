import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  // Relative asset paths, so the build works from any host or subdirectory.
  base: "./",
  plugins: [react()],
  test: {
    include: ["src/**/*.test.ts"],
  },
});
