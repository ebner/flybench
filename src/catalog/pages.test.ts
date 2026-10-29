import { readFileSync, readdirSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { loadRecipe } from "../recipe/load";
import type { Recipe } from "../recipe/schema";
import { pageHtml, sitePages } from "./pages";

const dir = new URL("../../patterns/", import.meta.url);
const recipes = readdirSync(dir)
  .filter((f) => f.endsWith(".kdl"))
  .map((f) => {
    const r = loadRecipe(readFileSync(new URL(f, dir), "utf8"));
    if (!r.ok) throw new Error(f);
    return r.recipe;
  }) as Recipe[];

const TEMPLATE = `<html><head>
    <title>Flybench</title>
    <meta name="description" content="old" />
  </head><body><div id="root"></div></body></html>`;

describe("site pages", () => {
  const pages = sitePages(recipes, "/flybench/");

  it("give every pattern, technique and section its own address", () => {
    const paths = pages.map((p) => p.path);
    expect(new Set(paths).size).toBe(paths.length);
    for (const r of recipes) expect(paths).toContain(`fly/${r.id}/`);
    for (const p of ["", "techniques/", "learn/", "about/", "box/", "materials/"]) expect(paths).toContain(p);
  });

  it("describe each pattern with its steps, materials and sources", () => {
    const adams = pages.find((p) => p.path === "fly/adams/")!;
    expect(adams.title).toBe("Adams, Flybench");
    expect(adams.image).toBe("adams");
    expect(adams.body).toContain("<h2>Steps</h2>");
    expect(adams.body).toContain("<h2>Sources</h2>");
    expect(adams.body).not.toMatch(/reference only/);
  });

  it("write the page's head and content into the app's HTML", () => {
    const adams = pages.find((p) => p.path === "fly/adams/")!;
    const html = pageHtml(TEMPLATE, adams, { url: "https://ebner.github.io", base: "/flybench/", image: "og/adams.jpg" });
    expect(html.match(/<title>/g)).toHaveLength(1);
    expect(html.match(/name="description"/g)).toHaveLength(1);
    expect(html).not.toContain('content="old"');
    expect(html).toContain('<link rel="canonical" href="https://ebner.github.io/flybench/fly/adams/" />');
    expect(html).toContain('content="https://ebner.github.io/flybench/og/adams.jpg"');
    expect(html).toMatch(/<div id="root"><main class="reading"><h1>Adams<\/h1>/);
  });

  it("write a page in another language under its prefix, linking every language's version", () => {
    const adams = pages.find((p) => p.path === "fly/adams/")!;
    const html = pageHtml(TEMPLATE, adams, { url: "https://ebner.github.io", base: "/flybench/", image: "og/adams.jpg", lang: "sv" });
    expect(html).toContain('<link rel="canonical" href="https://ebner.github.io/flybench/sv/fly/adams/" />');
    expect(html).toContain('<link rel="alternate" hreflang="de" href="https://ebner.github.io/flybench/de/fly/adams/" />');
    expect(html).toContain('<link rel="alternate" hreflang="x-default" href="https://ebner.github.io/flybench/fly/adams/" />');
    // The preview picture is the site's, not under the language.
    expect(html).toContain('content="https://ebner.github.io/flybench/og/adams.jpg"');
    expect(html).toMatch(/<html lang="sv">/);
  });

  it("leave out absolute links when the site's address is unknown, and keep personal pages out of search", () => {
    const box = pages.find((p) => p.path === "box/")!;
    const html = pageHtml(TEMPLATE, box, { base: "/" });
    expect(html).not.toContain("canonical");
    expect(html).not.toContain("og:image");
    expect(html).toContain('<meta name="robots" content="noindex" />');
  });
});
