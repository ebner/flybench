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
npm install
npm run dev        # Vite dev server
npm run studio     # authoring studio on the dev server (/studio.html)
npm test           # Vitest: recipe parsing/validation, simulation
npm run typecheck
npm run build      # typecheck + production build into dist/
npm run render:catalog  # gallery images into public/renders/ (commit them)
npm run render     # finished flies to .cache/renders/ via headless Chromium
npm run refcheck   # proportion contact sheets against reference photos
npm run icons      # app icon PNGs from public/icons/*.svg (after logo changes)
```

Run `npm test` and `npm run typecheck` before reporting work as done. Every file in
`patterns/` is loaded by the test suite, so a broken recipe fails the tests.

## Architecture

```
patterns/       recipes (KDL v2)
docs/           recipe-schema.md: the recipe format reference; authoring-patterns.md: how to
                research, write and check a pattern
src/recipe/     kdl.ts (KDL → plain object + source locations), schema.ts (Zod),
                materials.ts (materials catalog), validate.ts (tying-sense rules),
                load.ts (all three, errors with line numbers), catalog.ts (cross-recipe rules)
src/tying/      hook.ts (hook models, sizes), simulate.ts (recipe → timeline of geometry
                pieces as plain data), describe.ts (instruction text, materials list)
src/render/     three.js: FlyScene (scene = pure function of time), pieces, loose ends
src/catalog/    search and catalog wording (no React; tested in Node)
src/ui/         React UI (hash routing, theme, gallery, pattern page)
public/renders/ generated gallery images, committed; regenerate after recipe/renderer changes
```

- `src/recipe` and `src/tying` must not import three.js or React; they are unit-tested in Node.
- The renderer derives everything from `simulate()` output. `FlyScene.setTime(t)` must show
  exactly the state at `t` with no accumulated state, so scrubbing and replay stay correct.
- Use seeded randomness (`render/random.ts`) so fibres look the same on every render.

## Recipe conventions

- Positions are fractions of the shank: `0` = start of the bend, `1` = just behind the eye
  (or the bead, when there is one).
- Lengths are multiples of the hook gape. World units in the renderer are gapes.
- The thread position is tying state; only `attach-thread`, `wrap-thread` and `dub` move it.
  Tie-ins, tie-offs and whip finishes happen at the thread.
- Validation errors must carry a source location (line and column).
- Materials are referenced by catalog kind (`src/recipe/materials.ts`); add a catalog entry
  rather than inventing per-recipe material types. The archetype decides rendering.
- Variants are complete recipes with `variant-of` + `variant`.
- Cite sources for every pattern; where sources disagree, say so in the recipe.
- When authoring or changing a pattern, add `references` (photos of the finished fly) and
  run `npm run refcheck -- <id>`. Read `.cache/refcheck/<id>.png`, compare ratios in gape
  units (tail/tag length, wing length, angle and spread, hackle fibre length, body extent
  and thickness, head), and report or fix discrepancies. Several references beat one:
  dressings vary between tyers. Never commit the photos.

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
