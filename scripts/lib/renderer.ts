import { mkdir, readdir } from "node:fs/promises";
import { dirname } from "node:path";
import { chromium, type Browser } from "playwright";
import { createServer, type ViteDevServer } from "vite";

export const VIEWS = ["side", "top", "front", "three-quarter", "default"] as const;
export type View = (typeof VIEWS)[number];

export interface RenderJob {
  pattern: string;
  view: View;
  grid?: boolean;
  out: string;
  width?: number;
  height?: number;
}

/** All pattern ids, from the file names in patterns/. */
export async function patternIds(): Promise<string[]> {
  return (await readdir("patterns")).filter((f) => f.endsWith(".kdl")).map((f) => f.replace(/\.kdl$/, ""));
}

/**
 * Renders finished flies to PNG files with headless Chromium, using the app's own
 * renderer via render.html on a temporary Vite dev server.
 */
export class Renderer {
  private constructor(
    private server: ViteDevServer,
    private browser: Browser,
    private base: string,
  ) {}

  static async start(): Promise<Renderer> {
    const server = await createServer({ server: { port: 0, host: "127.0.0.1" }, logLevel: "error" });
    await server.listen();
    const base = server.resolvedUrls!.local[0]!;
    // Software WebGL, so rendering works without a GPU.
    const browser = await chromium.launch({ args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
    return new Renderer(server, browser, base);
  }

  async render(job: RenderJob): Promise<void> {
    const page = await this.browser.newPage({ viewport: { width: job.width ?? 1400, height: job.height ?? 900 } });
    try {
      const url = `${this.base}render.html?pattern=${encodeURIComponent(job.pattern)}&view=${job.view}&grid=${job.grid ? 1 : 0}`;
      await page.goto(url);
      await page.waitForFunction(() => document.body.dataset.ready || document.body.dataset.error, null, { timeout: 60_000 });
      const error = await page.evaluate(() => document.body.dataset.error);
      if (error) throw new Error(`${job.pattern}: ${error}`);
      await mkdir(dirname(job.out), { recursive: true });
      await page.screenshot({ path: job.out });
    } finally {
      await page.close();
    }
  }

  async stop(): Promise<void> {
    await this.browser.close();
    await this.server.close();
  }
}
