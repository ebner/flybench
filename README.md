# Fly tying in 3D

Animated, step-by-step 3D fly tying instructions. Each fly is a recipe written in
KDL (`patterns/*.kdl`). The app validates it, simulates the tying sequence and
renders a scrubbable 3D animation together with written steps, a materials list and
the pattern's history, fishing notes and sources. It is a fully static site.

Patterns so far: Red Tag, Elk Hair Caddis (+ Troth original), Europea 12 (+ with tail).
Open one with `#/<id>`, e.g. `http://localhost:5173/#/elk-hair-caddis`.

Product decisions and the milestone plan: [docs/product-plan.md](docs/product-plan.md).

## Run

Requires Node 22 or later.

```sh
npm install
npm run dev        # http://localhost:5173
npm test           # recipe parsing/validation and simulation tests
npm run build      # type-check and production build into dist/
npm run render     # render finished flies to .cache/renders/ (headless Chromium)
npm run refcheck   # contact sheets: render on a gape grid next to reference photos
```

Viewer controls: drag to orbit, scroll or pinch to zoom, right-drag to pan.
Space plays and pauses, ← and → step back and forward. Click a step to play just that step.

## Adding a pattern

Write a new `patterns/<id>.kdl` and it gets picked up automatically. Materials come
from the catalog in `src/recipe/materials.ts`; add new ones there. The test suite
loads every pattern file, so `npm test` reports recipe errors with line numbers.
Problems in pattern files also show in a banner in the dev server. The format is
described in [docs/recipe-schema.md](docs/recipe-schema.md).

To check proportions, list photos of the finished fly under `references` in the recipe
and run `npm run refcheck -- <id>`. It writes `.cache/refcheck/<id>.png`: the fly from
the side on a grid in gape units, the recipe's proportions, and the photos. Read the
ratios off the photos relative to the hook gape and adjust the recipe. The photos stay
in `.cache/` and are never committed.

## Layout

```
patterns/          fly recipes (KDL)
docs/              recipe schema documentation
src/recipe/        KDL → object mapping, Zod schema, materials catalog,
                   semantic and catalog-level validation
src/tying/         hook models and the tying simulation: recipe → timeline of
                   geometry pieces (plain data, no three.js)
src/render/        three.js scene built from the timeline
src/ui/            React shell: viewer, transport, step list, materials
render.html        dev-only page that scripts/ drive to render a finished fly
scripts/           authoring tools: render, refcheck
```

The scene is a pure function of time: `FlyScene.setTime(t)` shows exactly what
the timeline says for `t`, so scrubbing and replaying need no extra state.
