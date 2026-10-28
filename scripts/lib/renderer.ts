import { mkdir, readdir } from "node:fs/promises";
import { dirname } from "node:path";
import { chromium, type Browser, type Page } from "playwright";
import { createServer, type ViteDevServer } from "vite";

export const VIEWS = ["side", "top", "front", "three-quarter", "default"] as const;
export type View = (typeof VIEWS)[number];

export interface RenderOptions {
  pattern: string;
  /** Instead of a pattern: a material swatch, "<kind>:<colour>". */
  swatch?: string;
  view: View;
  grid?: boolean;
  transparent?: boolean;
  fov?: number;
  fit?: "box" | "sphere";
  /** "pictured": as flies are usually photographed (point-up flies point up). Default: as tied. */
  pose?: "tied" | "pictured";
  width?: number;
  height?: number;
}

/** All pattern ids, from the file names in patterns/. */
export async function patternIds(): Promise<string[]> {
  return (await readdir("patterns"))
    .filter((f) => f.endsWith(".kdl"))
    .map((f) => f.replace(/\.kdl$/, ""))
    .sort();
}

/**
 * Renders finished flies with headless Chromium, using the app's own renderer via
 * render.html on a temporary Vite dev server.
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
    // Vulkan reaches the real GPU from headless Chromium (about 50× faster than software
    // rendering). Without a usable Vulkan driver WebGL fails outright rather than falling
    // back, so check, and use the SwiftShader software renderer instead.
    // FLYBENCH_SOFTWARE_RENDER=1 asks for software rendering directly.
    let browser = await chromium.launch({ args: ["--use-angle=vulkan", "--enable-features=Vulkan", "--enable-unsafe-swiftshader"] });
    if (process.env.FLYBENCH_SOFTWARE_RENDER || !(await hasWebGL(browser))) {
      await browser.close();
      console.warn("Rendering in software (SwiftShader), which is much slower.");
      browser = await chromium.launch({ args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
    }
    return new Renderer(server, browser, base);
  }

  /** Opens render.html for a fly and waits until the first frame is drawn. */
  async open(options: RenderOptions): Promise<Page> {
    const page = await this.browser.newPage({ viewport: { width: options.width ?? 1400, height: options.height ?? 900 } });
    const query = new URLSearchParams({
      pattern: options.pattern,
      view: options.view,
      grid: options.grid ? "1" : "0",
      transparent: options.transparent ? "1" : "0",
      fov: String(options.fov ?? 8),
      fit: options.fit ?? "box",
      pose: options.pose ?? "tied",
      ...(options.swatch ? { swatch: options.swatch } : {}),
    });
    await page.goto(`${this.base}render.html?${query}`);
    await page.waitForFunction(() => document.body.dataset.ready || document.body.dataset.error, null, { timeout: 60_000 });
    const error = await page.evaluate(() => document.body.dataset.error);
    if (error) {
      await page.close();
      throw new Error(`${options.swatch ?? options.pattern}: ${error}`);
    }
    return page;
  }

  /** Renders one view to a PNG file. */
  async render(options: RenderOptions & { out: string }): Promise<void> {
    const page = await this.open(options);
    try {
      await mkdir(dirname(options.out), { recursive: true });
      await page.screenshot({ path: options.out, omitBackground: options.transparent });
    } finally {
      await page.close();
    }
  }

  /** Renders `frames` views turning once around the fly; returns PNG buffers. */
  async turntable(options: RenderOptions, frames: number): Promise<Buffer[]> {
    const page = await this.open({ ...options, fit: "sphere" });
    try {
      const shots: Buffer[] = [];
      for (let i = 0; i < frames; i++) {
        await page.evaluate((deg) => window.turnTo!(deg), (360 * i) / frames);
        shots.push(await page.screenshot({ omitBackground: options.transparent }));
      }
      return shots;
    } finally {
      await page.close();
    }
  }

  async stop(): Promise<void> {
    await this.browser.close();
    await this.server.close();
  }
}

/** Whether pages in this browser can create a WebGL 2 context. */
async function hasWebGL(browser: Browser): Promise<boolean> {
  const page = await browser.newPage();
  try {
    return await page.evaluate(() => document.createElement("canvas").getContext("webgl2") !== null);
  } finally {
    await page.close();
  }
}
