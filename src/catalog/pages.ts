/**
 * Every page of the site, as the build writes it to its own HTML file: the title, the
 * description and preview picture for search engines and link previews, and the page's
 * content as plain HTML for readers that don't run the app. The app replaces that content
 * when it starts. Kept free of React and three.js so it runs in Node.
 */
import type { Recipe } from "../recipe/schema";
import { LANGS, langPrefix, type Lang } from "../i18n/lang";
import { localized } from "../i18n/localized";
import { t } from "../i18n/ui";
import { inPageLanguage, naturalInPageLanguage } from "../i18n/prose";
import { materialsList } from "../tying/describe";
import { simulate } from "../tying/simulate";
import { DIFFICULTY_LABELS, factsLine, factsSentence, originLine } from "./describe";
import type { Natural } from "../recipe/natural";
import { GROUP_LABELS, hatchText, imitatedBy, REGION_LABELS, sizeText, STAGE_LABELS } from "./naturals";
import { learningPath, localTechniques, patternsUsing } from "./techniques";

export const SITE_NAME = "Flybench";

/** Words of the pages that the interface doesn't have. */
const WORDS = localized({
  en: {
    title: `${SITE_NAME}: fly patterns to tie, step by step, in 3D`,
    home: (n: number) => `${n} fly patterns, each tied in front of you in 3D, one step at a time, with its materials, history and how to fish it.`,
    howToTie: (name: string) => `How to tie the ${name}, step by step in 3D.`,
    techniques: "The techniques of fly tying, each explained for beginners and shown in 3D on a real pattern.",
    learn: "A learning path through fly tying: each fly adds a few new techniques, starting with the easiest.",
    naturals: "The insects, shrimps and small fish that fly patterns imitate, and when they hatch in your region.",
    about: `${SITE_NAME} is a field guide to tying flies: every pattern tied in 3D, one step at a time, from cited dressings. Open source.`,
    privacy: "No accounts, no cookies and no tracking. Your fly box, materials, tying log and settings stay in your browser. The site is hosted on GitHub Pages, which logs visitors' IP addresses for security.",
    kept: "Kept in your browser.",
  },
  sv: {
    title: `${SITE_NAME}: flugmönster att binda, steg för steg, i 3D`,
    home: (n: number) => `${n} flugmönster, vart och ett bundet framför dig i 3D, ett steg i taget, med sina material, sin historia och hur det fiskas.`,
    howToTie: (name: string) => `Så binder du ${name}, steg för steg i 3D.`,
    techniques: "Flugbindningens tekniker, var och en förklarad för nybörjare och visad i 3D på ett riktigt mönster.",
    learn: "En inlärningsväg genom flugbindningen: varje fluga lägger till några nya tekniker, de lättaste först.",
    naturals: "Insekterna, märlorna och småfisken som flugmönstren imiterar, och när de kläcks där du bor.",
    about: `${SITE_NAME} är en fälthandbok i flugbindning: varje mönster bundet i 3D, ett steg i taget, efter citerade recept. Öppen källkod.`,
    privacy: "Inga konton, inga kakor och ingen spårning. Din flugask, dina material, din bindlogg och dina inställningar stannar i din webbläsare. Webbplatsen ligger på GitHub Pages, som loggar besökarnas IP-adresser av säkerhetsskäl.",
    kept: "Sparas i din webbläsare.",
  },
  de: {
    title: `${SITE_NAME}: Fliegenmuster zum Binden, Schritt für Schritt, in 3D`,
    home: (n: number) => `${n} Fliegenmuster, jedes vor deinen Augen in 3D gebunden, Schritt für Schritt, mit Materialien, Geschichte und wie man es fischt.`,
    howToTie: (name: string) => `So bindest du die ${name}, Schritt für Schritt in 3D.`,
    techniques: "Die Techniken des Fliegenbindens, jede für Anfänger erklärt und in 3D an einem echten Muster gezeigt.",
    learn: "Ein Lernpfad durch das Fliegenbinden: jede Fliege fügt ein paar neue Techniken hinzu, die leichtesten zuerst.",
    naturals: "Die Insekten, Bachflohkrebse und kleinen Fische, die Fliegenmuster imitieren, und wann sie in deiner Region schlüpfen.",
    about: `${SITE_NAME} ist ein Feldführer zum Fliegenbinden: jedes Muster in 3D gebunden, Schritt für Schritt, nach zitierten Rezepten. Open Source.`,
    privacy: "Keine Konten, keine Cookies, kein Tracking. Deine Fliegendose, dein Material, dein Bindetagebuch und deine Einstellungen bleiben in deinem Browser. Die Seite liegt auf GitHub Pages, das die IP-Adressen der Besucher aus Sicherheitsgründen protokolliert.",
    kept: "In deinem Browser gespeichert.",
  },
});

/** The front page's title, in the page's language. */
export const siteTitle = () => WORDS.title;

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

export function sitePages(recipes: Recipe[], base: string, naturals: Natural[] = []): Page[] {
  const link = (path: string, text: string) => `<a href="${escape(base + path)}">${escape(text)}</a>`;
  const flyPath = (id: string) => `fly/${encodeURIComponent(id)}/`;
  const byName = [...recipes].sort((a, b) => fullName(a).localeCompare(fullName(b)));
  // Patterns as the gallery counts them: a pattern's variants are versions of it.
  const patterns = recipes.filter((r) => !r.variantOf).length;

  const pages: Page[] = [
    {
      path: "",
      title: siteTitle(),
      description: WORDS.home(patterns),
      body:
        `<main class="gallery"><h1>${escape(t.gallery.heading)}</h1>` +
        `<p>${escape(t.gallery.intro)}</p><ul>` +
        byName.map((r) => `<li>${link(flyPath(r.id), fullName(r))}: ${escape(factsLine(r))}</li>`).join("") +
        `</ul></main>`,
    },
  ];

  for (const english of recipes) {
    const r = inPageLanguage(english);
    const steps = simulate(r).steps;
    const origin = originLine(r);
    pages.push({
      path: flyPath(r.id),
      title: t.site.titled(fullName(r)),
      description: `${WORDS.howToTie(fullName(r))} ${r.description ?? factsSentence(r)}`,
      image: r.id,
      body:
        `<main class="reading"><h1>${escape(fullName(r))}</h1>` +
        `<p>${escape(factsSentence(r))} ${escape(DIFFICULTY_LABELS[r.difficulty])}.${origin ? ` ${escape(origin)}.` : ""}</p>` +
        (r.description ? `<p>${escape(r.description)}</p>` : "") +
        `<h2>${escape(t.pattern.dressing)}</h2><ul>` +
        materialsList(r)
          .map((m) => `<li>${escape(m.role)}: ${escape(m.name)}${m.detail ? `, ${escape(m.detail)}` : ""}</li>`)
          .join("") +
        `</ul><h2>${escape(t.pattern.steps)}</h2><ol>` +
        steps.map((s) => `<li><strong>${escape(s.title)}</strong> ${escape(s.text)}</li>`).join("") +
        `</ol>` +
        (r.history ? `<h2>${escape(t.pattern.history)}</h2>${paragraphs(r.history)}` : "") +
        (r.fishing ? `<h2>${escape(t.pattern.fishing)}</h2>${paragraphs(r.fishing)}` : "") +
        (r.sources.length
          ? `<h2>${escape(t.pattern.sources)}</h2><ul>` +
            r.sources.map((s) => `<li>${s.url ? `<a href="${escape(s.url)}">${escape(s.title)}</a>` : escape(s.title)}</li>`).join("") +
            `</ul>`
          : "") +
        `</main>`,
    });
  }

  pages.push({
    path: "techniques/",
    title: t.site.titled(t.techniques.title),
    description: WORDS.techniques,
    body:
      `<main class="reading"><h1>${escape(t.techniques.heading)}</h1><ul>` +
      localTechniques().map((x) => `<li>${link(`technique/${encodeURIComponent(x.id)}/`, x.name)}: ${escape(x.summary)}</li>`).join("") +
      `</ul></main>`,
  });
  for (const x of localTechniques()) {
    const using = patternsUsing(recipes, x.id);
    pages.push({
      path: `technique/${encodeURIComponent(x.id)}/`,
      title: t.site.titled(x.name),
      description: x.summary,
      image: using[0]?.id,
      body:
        `<main class="reading"><h1>${escape(x.name)}</h1><p>${escape(x.summary)}</p>${paragraphs(x.how)}` +
        (x.mistakes.length ? `<h2>${escape(t.techniques.mistakes)}</h2><ul>${x.mistakes.map((m) => `<li>${escape(m)}</li>`).join("")}</ul>` : "") +
        (using.length ? `<h2>${escape(t.techniques.using)}</h2><ul>${using.map((r) => `<li>${link(flyPath(r.id), fullName(r))}</li>`).join("")}</ul>` : "") +
        `</main>`,
    });
  }

  const path = learningPath(recipes);
  pages.push({
    path: "learn/",
    title: t.site.titled(t.learn.title),
    description: WORDS.learn,
    image: path[0]?.recipe.id,
    body:
      `<main class="reading"><h1>${escape(t.learn.heading)}</h1><ol>` +
      path.map((s) => `<li>${link(flyPath(s.recipe.id), fullName(s.recipe))}: ${escape(factsLine(s.recipe))}</li>`).join("") +
      `</ol></main>`,
  });

  if (naturals.length) {
    const sorted = naturals.map((n) => naturalInPageLanguage(n)).sort((a, b) => a.name.localeCompare(b.name));
    pages.push({
      path: "naturals/",
      title: t.site.titled(t.naturals.title),
      description: WORDS.naturals,
      body:
        `<main class="reading"><h1>${escape(t.naturals.heading)}</h1><ul>` +
        sorted.map((n) => `<li>${link(`natural/${encodeURIComponent(n.id)}/`, n.name)}: ${escape(n.description)}</li>`).join("") +
        `</ul></main>`,
    });
    for (const n of sorted) {
      const flies = imitatedBy(recipes, n.id);
      pages.push({
        path: `natural/${encodeURIComponent(n.id)}/`,
        title: t.site.titled(n.name),
        description: n.description,
        image: flies[0]?.id,
        body:
          `<main class="reading"><h1>${escape(n.name)}</h1><p>${escape(n.description)}</p>` +
          `<p>${escape(GROUP_LABELS[n.group])}, ${escape(STAGE_LABELS[n.stage])}, ${escape(sizeText(n))}.</p>` +
          (n.hatches.length
            ? `<h2>${escape(t.naturals.hatches)}</h2><ul>${n.hatches.map((h) => `<li>${escape(REGION_LABELS[h.region])}: ${escape(hatchText(h))}</li>`).join("")}</ul>`
            : "") +
          (flies.length ? `<h2>${escape(t.naturals.flies)}</h2><ul>${flies.map((r) => `<li>${link(flyPath(r.id), fullName(r))}</li>`).join("")}</ul>` : "") +
          `</main>`,
      });
    }
  }

  pages.push({
    path: "about/",
    title: t.site.titled(t.about.title),
    description: WORDS.about,
    body:
      `<main class="reading"><h1>${escape(t.about.heading)}</h1>` +
      `<p>${escape(t.about.lede(patterns))}</p>` +
      `<h2>${escape(t.about.privacyHeading)}</h2><p>${escape(WORDS.privacy)}</p>` +
      `<h2>${escape(t.about.whoHeading)}</h2><p><a href="https://github.com/ebner">Hannes Ebner</a></p></main>`,
  });

  pages.push({
    path: "trip/",
    title: t.site.titled(t.trip.title),
    description: t.trip.intro,
    body: `<main class="reading"><h1>${escape(t.trip.heading)}</h1><p>${escape(t.trip.intro)}</p></main>`,
  });

  for (const [path, title] of [
    ["box/", t.box.title],
    ["materials/", t.materials.title],
    ["log/", t.log.title],
  ] as const) {
    pages.push({
      path,
      title: t.site.titled(title),
      description: WORDS.kept,
      noindex: true,
      body: `<main class="reading"><h1>${escape(title)}</h1></main>`,
    });
  }
  return pages;
}

/**
 * The page's HTML file: the app's index.html with this page's head and content, in `lang`
 * (its path is under that language's prefix), linking the same page in the other languages.
 */
export function pageHtml(template: string, page: Page, site: { url?: string; base: string; image?: string; lang?: Lang }): string {
  const lang = site.lang ?? "en";
  const absolute = (path: string) => (site.url ? site.url.replace(/\/$/, "") + site.base + path : undefined);
  const url = absolute(langPrefix(lang) + page.path);
  const image = site.image && absolute(site.image);
  // Every language's version of the page, by address (absolute when the site's address is known).
  const version = (l: Lang) => absolute(langPrefix(l) + page.path) ?? site.base + langPrefix(l) + page.path;
  const alternates = page.path.endsWith(".html")
    ? []
    : [...LANGS.map((l) => `<link rel="alternate" hreflang="${l}" href="${escape(version(l))}" />`), `<link rel="alternate" hreflang="x-default" href="${escape(version("en"))}" />`];
  const head = [
    `<title>${escape(page.title)}</title>`,
    `<meta name="description" content="${escape(page.description)}" />`,
    page.noindex ? `<meta name="robots" content="noindex" />` : "",
    url ? `<link rel="canonical" href="${escape(url)}" />` : "",
    ...alternates,
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
  return withHead
    .replace(/<html(\s[^>]*)?>/, `<html lang="${lang}">`)
    .replace('<div id="root"></div>', () => `<div id="root">${page.body}</div>`);
}
