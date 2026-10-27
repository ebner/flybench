<img src="public/logo.svg" width="96" alt="The Flybench logo: a dry fly on its hook">

# Flybench

Animated, step-by-step 3D fly tying instructions. Each fly is a recipe written in
KDL (`patterns/*.kdl`). The app validates it, simulates the tying sequence and
renders a scrubbable 3D animation together with written steps, a materials list and
the pattern's history, fishing notes and sources. It is a fully static site.

The front page is the gallery, with a fly of the day and a way in for beginners: search
by name, insect or material, and filter by type, insect, difficulty, fish, season and
materials. Every page has its own address, and so do filtered galleries and pattern steps
(`/?imitates=caddis`, `/fly/elk-hair-caddis/?step=7`). Old `#/` links redirect.

Techniques (`/techniques/`) explain each thing a fly is made of, with a looping 3D
example taken from a real pattern; every step of every pattern links to its technique.
The learning path (`/learn/`) orders the catalog so each fly adds only a few new
techniques.

Personal features live in the browser (no account, no sync): a fly box (`/box/`), a
materials inventory (`/materials/`) that drives "Tie with what I have" in the gallery,
and vise mode on pattern pages for following along at the bench. The built site
installs as an app and works offline after the first visit.

Product decisions and the milestone plan: [docs/product-plan.md](docs/product-plan.md).

## Run

Requires Node 24 or later (`.nvmrc`) and pnpm, in the version `package.json` names under
`packageManager`: `corepack enable` sets it up, or install pnpm and it switches itself.

```sh
pnpm install
pnpm dev           # http://localhost:5173
pnpm studio        # the authoring studio (dev server only), /studio.html
pnpm test          # recipe parsing/validation and simulation tests
pnpm build         # type-check, production build and one HTML file per page into dist/
pnpm render:catalog  # gallery images into public/renders/ (commit them)
pnpm render        # render finished flies to .cache/renders/ (headless Chromium)
pnpm refcheck      # contact sheets: render on a gape grid next to reference photos
pnpm icons         # app icon PNGs from public/icons/*.svg
```

Viewer controls: drag to orbit, scroll or pinch to zoom, right-drag to pan.
Space plays and pauses, ← and → step back and forward. Click a step to play just that step.

Rendering uses the GPU through Vulkan in headless Chromium when there is one, and
falls back to software rendering (much slower) when there isn't.

## Adding a pattern

The easiest way is the authoring studio (`pnpm studio`): pick a pattern or start a new
one, edit its KDL with problems listed as you type (click one to jump to its line), and
watch the fly in 3D on a gape grid, step by step. Save writes to `patterns/`. The studio
exists only on the dev server, which only accepts its requests from this machine; the
built site doesn't include it.

Or write a new `patterns/<id>.kdl` by hand and it gets picked up automatically. Materials come
from the catalog in `src/recipe/materials.ts`; add new ones there. The test suite
loads every pattern file, so `pnpm test` reports recipe errors with line numbers.
Problems in pattern files also show in a banner in the dev server. Then run
`pnpm render:catalog` and commit the images it writes to `public/renders/`; it only
re-renders patterns whose recipe or rendering code changed. The format is
described in [docs/recipe-schema.md](docs/recipe-schema.md), and the authoring procedure
(research, proportions, checks) in [docs/authoring-patterns.md](docs/authoring-patterns.md).

To check proportions, list photos of the finished fly under `references` in the recipe
and run `pnpm refcheck <id>`. It writes `.cache/refcheck/<id>.png`: the fly from
the side on a grid in gape units, the recipe's proportions, and the photos. Read the
ratios off the photos relative to the hook gape and adjust the recipe. The photos stay
in `.cache/` and are never committed, and the build leaves the `references` blocks out
of the published site.

## Layout

```
patterns/          fly recipes (KDL)
docs/              recipe schema documentation
src/recipe/        KDL → object mapping, Zod schema, materials catalog,
                   semantic and catalog-level validation
src/tying/         hook models and the tying simulation: recipe → timeline of
                   geometry pieces (plain data, no three.js)
src/render/        three.js scene built from the timeline
src/catalog/       catalog search and wording, and the site's pages with their titles,
                   descriptions and text for the build (plain logic, tested in Node)
src/ui/            React UI: gallery, pattern page, viewer, theme, routing
src/studio/        the authoring studio (studio.html, dev server only)
public/renders/    rendered gallery images (generated, committed)
public/logo.svg    the logo (also the header mark); favicon.svg is a simplified version
                   for small sizes, and public/icons/*.svg the app icons (pnpm icons)
render.html        dev-only page that scripts/ drive to render a finished fly
scripts/           authoring tools: render, render-catalog, refcheck, the
                   dev-server plugin that lets the studio read and save patterns,
                   the build plugin that leaves reference photos out, and
                   prerender (the HTML file and preview picture for each page)
.github/workflows/ deployment to GitHub Pages
```

The scene is a pure function of time: `FlyScene.setTime(t)` shows exactly what
the timeline says for `t`, so scrubbing and replaying need no extra state.

## Hosting

The site is published at <https://flybench.ebner.se> on GitHub Pages by
`.github/workflows/deploy.yml` on every push to `main`. One-time setup:

- Repository Settings > Pages: Source "GitHub Actions", custom domain `flybench.ebner.se`,
  Enforce HTTPS once the certificate is issued.
- DNS (Cloudflare, ebner.se): a CNAME record `flybench` → `ebner.github.io`, DNS only (not
  proxied), so GitHub can verify the domain and issue the certificate. Verifying `ebner.se`
  under the account's Settings > Pages adds a TXT record and protects the subdomain from takeover.

With a custom domain no CNAME file is needed in the repository; the workflow takes the
address from Pages. `pnpm build` takes two settings from the environment, which the
workflow fills in:

- `BASE_PATH`: where the site lives on its host, `/flybench/` for the project site or `/`
  on a custom domain (default `/`).
- `SITE_URL`: the host's address, for canonical links, link-preview pictures and
  `sitemap.xml`. Without it the build leaves those out.

After `vite build`, `scripts/prerender.ts` writes an HTML file for every page (each
pattern, technique and section) with its own title, description and preview picture, and
the page's text for search engines and readers without JavaScript. The app replaces that
text when it starts. `404.html` covers any other address.

## Licence

The code is MIT ([LICENSE](LICENSE)). The pattern texts, renders, logo and docs are
CC BY 4.0 ([LICENSE-CONTENT.md](LICENSE-CONTENT.md)). Reference photos, cited sources
and the fonts belong to their owners and aren't covered by either.
