import { beforeAll, describe, expect, it } from "vitest";
import { hydrated, loadLanguages, renderPage } from "./entry-server";
import { PATTERNS } from "./patterns";

// The pages built ahead of time are the app's own HTML: the app must draw without a browser.
describe("the app drawn without a browser", () => {
  beforeAll(loadLanguages);

  it("draws the front page whole: header, every pattern's plate with its picture, footer", async () => {
    const html = await renderPage("");
    expect(html).toContain('class="site-header"');
    expect(html).toContain('class="site-footer"');
    expect(html).toContain("<h1");
    const mains = PATTERNS.filter((p) => !p.recipe.variantOf);
    expect(html.match(/<li class="plate">/g)).toHaveLength(mains.length);
    expect(html).toContain("renders/adams/card.webp");
    // Nothing of the visitor's or of the day: those come once the app has taken the page over.
    expect(html).not.toContain("Not rendered yet");
    // In place, not parked at the end for a script to move in.
    expect(html).not.toMatch(/hidden[^>]* id="S:|<template id="B:/);
  });

  it("draws the reading pages in each language, in that language", async () => {
    for (const [path, heading] of [["about/", "About Flybench"], ["sv/about/", "Om Flybench"], ["de/learn/", "Binden lernen"], ["techniques/", "Techniques"], ["naturals/", "Naturals and hatches"]] as const) {
      expect(hydrated(path.replace(/^(sv|de)\//, "")), path).toBe(true);
      const html = await renderPage(path);
      expect(html, path).toContain(heading);
      expect(html, path).toContain('class="site-header"');
    }
  });

  it("draws a pattern's page with its dressing, steps and the gallery picture in the 3D view's place", async () => {
    const html = await renderPage("fly/adams/");
    expect(html).toContain(">Adams</h1>");
    expect(html).toContain('class="viewer-poster"');
    expect(html).toContain("renders/adams/card.webp");
    expect(html).toContain("Whip finish");
    const sv = await renderPage("sv/fly/adams/");
    expect(sv).toContain("Följ"); // the camera follows by default, in Swedish
  });

  it("draws a technique's and a natural's page", async () => {
    expect(await renderPage("technique/whip-finish/")).toContain(">Whip finish</h1>");
    const natural = await renderPage("natural/mayfly-dun/");
    expect(natural).toContain(">Mayfly dun</h1>");
    expect(natural).toContain('class="natural-poster"');
  });

  it("draws the visitor's own pages without saying they are empty", async () => {
    const box = await renderPage("box/");
    expect(box).toContain("Your fly box");
    expect(box).not.toContain("empty-results");
    expect(await renderPage("log/")).not.toContain("Nothing logged");
    expect(await renderPage("materials/")).toContain("Your materials");
    expect(await renderPage("build/")).toContain("Build a fly");
    expect(hydrated("trip/")).toBe(false);
  });

  it("draws the same page the same way twice (what the browser takes over must not vary)", async () => {
    expect(await renderPage("learn/")).toBe(await renderPage("learn/"));
  });
});
