/**
 * Every page of the site, as the build writes it to its own HTML file: the title, the
 * description and preview picture for search engines and link previews, and the page's
 * content as plain HTML for readers that don't run the app. The app replaces that content
 * when it starts. Kept free of React and three.js so it runs in Node.
 */
import type { Recipe } from "../recipe/schema";
import { materialsList } from "../tying/describe";
import { simulate } from "../tying/simulate";
import { DIFFICULTY_LABELS, factsLine, factsSentence, originLine } from "./describe";
import { learningPath, patternsUsing, TECHNIQUES } from "./techniques";

export const SITE_NAME = "Flybench";
export const SITE_TAGLINE = "Fly patterns to tie, step by step, in 3D";
/** The front page's title. */
export const SITE_TITLE = `${SITE_NAME}: fly patterns to tie, step by step, in 3D`;

export interface Page {
  /** Path relative to the site's base: "" for the front page, "fly/adams/". */
  path: string;
  title: string;
  description: string;
  /** The pattern whose picture previews the page; the site's picture when absent. */
  image?: string;
  /** Pages about the visitor's own things (fly box, materials) are kept out of search results. */
  noindex?: boolean;
  /** The page's content as HTML. */
  body: string;
}

const escape = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const paragraphs = (text: string) =>
  text
    .split(/\n\s*\n/)
    .map((p) => `<p>${escape(p.replace(/\s+/g, " ").trim())}</p>`)
    .join("");

const fullName = (r: Recipe) => (r.variant ? `${r.name} (${r.variant})` : r.name);

export function sitePages(recipes: Recipe[], base: string): Page[] {
  const link = (path: string, text: string) => `<a href="${escape(base + path)}">${escape(text)}</a>`;
  const flyPath = (id: string) => `fly/${encodeURIComponent(id)}/`;
  const byName = [...recipes].sort((a, b) => fullName(a).localeCompare(fullName(b)));
  // Patterns as the gallery counts them: a pattern's variants are versions of it.
  const patterns = recipes.filter((r) => !r.variantOf).length;

  const pages: Page[] = [
    {
      path: "",
      title: SITE_TITLE,
      description: `${patterns} fly patterns, each tied in front of you in 3D, one step at a time, with its materials, history and how to fish it.`,
      body:
        `<main class="gallery"><h1>${escape(SITE_TAGLINE)}</h1>` +
        `<p>Every pattern can be turned, paused and replayed one step at a time.</p><ul>` +
        byName.map((r) => `<li>${link(flyPath(r.id), fullName(r))}: ${escape(factsLine(r))}</li>`).join("") +
        `</ul></main>`,
    },
  ];

  for (const r of recipes) {
    const steps = simulate(r).steps;
    const origin = originLine(r);
    pages.push({
      path: flyPath(r.id),
      title: `${fullName(r)}, ${SITE_NAME}`,
      description: `How to tie the ${fullName(r)}, step by step in 3D. ${r.description ?? factsSentence(r)}`,
      image: r.id,
      body:
        `<main class="reading"><h1>${escape(fullName(r))}</h1>` +
        `<p>${escape(factsSentence(r))} ${escape(DIFFICULTY_LABELS[r.difficulty])}.${origin ? ` ${escape(origin)}.` : ""}</p>` +
        (r.description ? `<p>${escape(r.description)}</p>` : "") +
        `<h2>Materials</h2><ul>` +
        materialsList(r)
          .map((m) => `<li>${escape(m.role)}: ${escape(m.name)}${m.detail ? `, ${escape(m.detail)}` : ""}</li>`)
          .join("") +
        `</ul><h2>Steps</h2><ol>` +
        steps.map((s) => `<li><strong>${escape(s.title)}</strong> ${escape(s.text)}</li>`).join("") +
        `</ol>` +
        (r.history ? `<h2>History</h2>${paragraphs(r.history)}` : "") +
        (r.fishing ? `<h2>Fishing it</h2>${paragraphs(r.fishing)}` : "") +
        (r.sources.length
          ? `<h2>Sources</h2><ul>` +
            r.sources.map((s) => `<li>${s.url ? `<a href="${escape(s.url)}">${escape(s.title)}</a>` : escape(s.title)}</li>`).join("") +
            `</ul>`
          : "") +
        `</main>`,
    });
  }

  pages.push({
    path: "techniques/",
    title: `Techniques, ${SITE_NAME}`,
    description: "The techniques of fly tying, each explained for beginners and shown in 3D on a real pattern.",
    body:
      `<main class="reading"><h1>Techniques</h1><ul>` +
      TECHNIQUES.map((t) => `<li>${link(`technique/${encodeURIComponent(t.id)}/`, t.name)}: ${escape(t.summary)}</li>`).join("") +
      `</ul></main>`,
  });
  for (const t of TECHNIQUES) {
    const using = patternsUsing(recipes, t.id);
    pages.push({
      path: `technique/${encodeURIComponent(t.id)}/`,
      title: `${t.name}, ${SITE_NAME}`,
      description: t.summary,
      image: using[0]?.id,
      body:
        `<main class="reading"><h1>${escape(t.name)}</h1><p>${escape(t.summary)}</p>${paragraphs(t.how)}` +
        (t.mistakes.length ? `<h2>Common mistakes</h2><ul>${t.mistakes.map((m) => `<li>${escape(m)}</li>`).join("")}</ul>` : "") +
        (using.length ? `<h2>Patterns that use it</h2><ul>${using.map((r) => `<li>${link(flyPath(r.id), fullName(r))}</li>`).join("")}</ul>` : "") +
        `</main>`,
    });
  }

  const path = learningPath(recipes);
  pages.push({
    path: "learn/",
    title: `Learn to tie, ${SITE_NAME}`,
    description: "A learning path through fly tying: each fly adds a few new techniques, starting with the easiest.",
    image: path[0]?.recipe.id,
    body:
      `<main class="reading"><h1>Learn to tie, one fly at a time</h1><ol>` +
      path.map((s) => `<li>${link(flyPath(s.recipe.id), fullName(s.recipe))}: ${escape(factsLine(s.recipe))}</li>`).join("") +
      `</ol></main>`,
  });

  pages.push({
    path: "about/",
    title: `About, ${SITE_NAME}`,
    description: `${SITE_NAME} is a field guide to tying flies: every pattern tied in 3D, one step at a time, from cited dressings. Open source.`,
    body:
      `<main class="reading"><h1>About ${SITE_NAME}</h1>` +
      `<p>${SITE_NAME} is a field guide to tying flies. Each of its ${patterns} patterns is tied in front of you in 3D, one step at a time, and comes with its materials, its history and how to fish it.</p>` +
      `<h2>Privacy</h2><p>No accounts, no cookies and no tracking. Your fly box, materials and settings stay in your browser. The site is hosted on GitHub Pages, which logs visitors' IP addresses for security.</p></main>`,
  });

  for (const [path, title] of [
    ["box/", "Fly box"],
    ["materials/", "Your materials"],
  ] as const) {
    pages.push({
      path,
      title: `${title}, ${SITE_NAME}`,
      description: "Kept in your browser.",
      noindex: true,
      body: `<main class="reading"><h1>${escape(title)}</h1></main>`,
    });
  }
  return pages;
}

/** The page's HTML file: the app's index.html with this page's head and content. */
export function pageHtml(template: string, page: Page, site: { url?: string; base: string; image?: string }): string {
  const absolute = (path: string) => (site.url ? site.url.replace(/\/$/, "") + site.base + path : undefined);
  const url = absolute(page.path);
  const image = site.image && absolute(site.image);
  const head = [
    `<title>${escape(page.title)}</title>`,
    `<meta name="description" content="${escape(page.description)}" />`,
    page.noindex ? `<meta name="robots" content="noindex" />` : "",
    url ? `<link rel="canonical" href="${escape(url)}" />` : "",
    `<meta property="og:site_name" content="${SITE_NAME}" />`,
    `<meta property="og:type" content="website" />`,
    `<meta property="og:title" content="${escape(page.title)}" />`,
    `<meta property="og:description" content="${escape(page.description)}" />`,
    url ? `<meta property="og:url" content="${escape(url)}" />` : "",
    image ? `<meta property="og:image" content="${escape(image)}" />` : "",
    image ? `<meta property="og:image:width" content="1200" /><meta property="og:image:height" content="630" />` : "",
    `<meta name="twitter:card" content="${image ? "summary_large_image" : "summary"}" />`,
  ]
    .filter(Boolean)
    .join("\n    ");
  const withHead = template
    .replace(/\s*<meta name="description"[^>]*>/, "")
    .replace(/<title>[^<]*<\/title>/, () => head);
  if (withHead === template) throw new Error("index.html has no <title> to replace");
  return withHead.replace('<div id="root"></div>', () => `<div id="root">${page.body}</div>`);
}
