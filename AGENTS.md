# AGENTS.md

Guidance for coding agents working in this repository.

## Project

An app that teaches fly tying with animated 3D step-by-step instructions. Every fly
pattern is a **recipe** in KDL (`patterns/*.kdl`). The recipe is the single source of
truth: the 3D model, the animation, the written steps and the materials list are all
generated from it. Adding a fly should mean writing a recipe, not rendering code.
When a new pattern needs a technique the schema can't express, extend the schema and
simulation in a general way rather than special-casing the pattern.

The app is fully static: no backend, everything runs in the browser.

Product decisions and the milestone plan are in [docs/product-plan.md](docs/product-plan.md).
How to research and write a pattern: [docs/authoring-patterns.md](docs/authoring-patterns.md).

## Commands

```sh
pnpm install
pnpm dev           # Vite dev server
pnpm studio        # authoring studio on the dev server (/studio.html)
pnpm test          # Vitest: recipe parsing/validation, simulation
pnpm typecheck
pnpm build         # typecheck + production build into dist/
pnpm render:catalog  # gallery images and material swatches into public/renders/ (commit them)
pnpm render        # finished flies to .cache/renders/ via headless Chromium
pnpm refcheck      # proportion contact sheets against reference photos
pnpm icons         # app icon PNGs from public/icons/*.svg (after logo changes)
```

Run `pnpm test` and `pnpm typecheck` before reporting work as done. Every file in
`patterns/` is loaded by the test suite, so a broken recipe fails the tests.

## Architecture

```
patterns/       recipes (KDL v2)
naturals/       what the patterns imitate (KDL): body, parts, sizes, hatch months by region
docs/           recipe-schema.md: the recipe format reference; authoring-patterns.md: how to
                research, write and check a pattern
src/recipe/     kdl.ts (KDL → plain object + source locations), schema.ts (Zod),
                materials.ts (materials catalog), validate.ts (tying-sense rules),
                load.ts (all three, errors with line numbers), catalog.ts (cross-recipe rules)
src/tying/      hook.ts (hook models, sizes), simulate.ts (recipe → timeline of geometry
                pieces as plain data), describe.ts (instruction text, materials list)
src/render/     three.js: FlyScene (scene = pure function of time), pieces, loose ends, naturals,
                water (the in-the-water view: its own clock, also a pure function of time)
src/catalog/    search and catalog wording, swatch.ts (a material on a bare hook, for its picture),
                pages.ts (every page's title, description and
                static HTML for the build; no React; tested in Node)
src/ui/         React UI (path routing under the base, theme, gallery, pattern page, about)
scripts/        prerender.ts runs after vite build: an HTML file per page, preview pictures
public/renders/ generated gallery images and material swatches (materials/), committed; regenerate
                after recipe/renderer changes
```

- `src/recipe` and `src/tying` must not import three.js or React; they are unit-tested in Node.
- The renderer derives everything from `simulate()` output. `FlyScene.setTime(t)` must show
  exactly the state at `t` with no accumulated state, so scrubbing and replay stay correct.
- Use seeded randomness (`render/random.ts`) so fibres look the same on every render.

## Recipe conventions

- Positions are fractions of the shank: `0` = start of the bend, `1` = just behind the eye
  (or the bead, when there is one).
- Lengths are multiples of the hook gape. World units in the renderer are gapes.
- The thread position is tying state; only `attach-thread`, `wrap-thread`, `dub` and `spin` move it.
  Tie-ins, tie-offs and whip finishes happen at the thread.
- Validation errors must carry a source location (line and column).
- Materials are referenced by catalog kind (`src/recipe/materials.ts`); add a catalog entry
  rather than inventing per-recipe material types. The archetype decides rendering.
- Variants are complete recipes with `variant-of` + `variant`.
- Cite sources for every pattern; where sources disagree, say so in the recipe.
- When authoring or changing a pattern, add `references` (photos of the finished fly) and
  run `pnpm refcheck <id>`. Read `.cache/refcheck/<id>.png`, compare ratios in gape
  units (tail/tag length, wing length, angle and spread, hackle fibre length, body extent
  and thickness, head), and report or fix discrepancies. Several references beat one:
  dressings vary between tyers. Never commit the photos.

## Privacy

The site needs no cookie banner or consent today, and the About page's Privacy section
(`src/ui/About.tsx`, summarised in `src/catalog/pages.ts`) says why. That rests on this
state of the app; keep it true, or re-evaluate:

- No cookies, accounts, analytics, adverts or tracking.
- Nothing loaded from other hosts at runtime: fonts, scripts, images and data are all
  served by the site itself. Links out to sources are fine; loading from them is not.
- Browser storage (`localStorage`) holds only what the visitor asks for: the theme, the
  camera-follow setting, the fly box, the materials inventory and the hatch calendar's
  region (keys `flybench.*`). The
  service worker caches the site's own files for offline use.
- No data leaves the browser; the only server is GitHub Pages, which logs IP addresses.

Stop and ask before adding anything that changes this: analytics (even cookieless),
embedded videos or maps, fonts or scripts from a CDN, error reporting, forms, comments,
sync or accounts, any request to another host, or storage that isn't a visitor's own
choice. Any of these can require consent under the EU ePrivacy rules and GDPR (the
project is run from Sweden), and the About page's Privacy section has to be updated with it.
New `flybench.*` storage keys for features the visitor uses are fine, but list them in
the Privacy section.

## Working agreements

- Work in small increments that can be run and looked at, and stop at each milestone for
  feedback. Don't build ahead of what has been agreed.
- Ask before settling stack or architecture questions: a short set of options with
  trade-offs and a recommendation.
- Fly-tying knowledge (proportions, materials, technique, pattern dressings) must be
  stated as assumptions so the user can correct them. In code, mark such constants with an
  `// Assumption:` comment.
- Keep `README.md` and `docs/recipe-schema.md` up to date with every change.
- Add tests where they earn their keep, especially for parsing and validating recipes.
- Match the surrounding code style; keep comments sparse and about *why*.
- Design: see the header of src/ui/styles.css (herbarium light theme, cyanotype dark theme,
  IM Fell English + Spectral). No all-caps labels, no middle-dot meta strings.
- Commit only when asked.
