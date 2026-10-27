# Product plan

Decisions from the planning interview (2026-10-24). Update this file when they change.

## Goal

A large, browsable catalog of fly patterns, each with an animated 3D tying sequence,
written steps and a materials list. Fully static site: all execution in the browser,
personal data in browser storage (no accounts, no sync).

## Audience and language

- Beginners and experienced tyers, with **layered detail**: concise by default,
  expandable explanations (technique lessons) for beginners.
- English only for now; keep UI strings in one place so translation stays possible.

## Catalog

- **Taxonomy**: one main `type` (dry, wet, nymph, emerger, midge, streamer, terrestrial,
  salmon, saltwater) plus facets: imitates (mayfly, caddis, stonefly, chironomid,
  baitfish, attractor, …), target species, difficulty, season.
- **Search**: instant fuzzy search by name and aliases; by material (one or several);
  "tie with what I have" from the materials inventory (including "one material
  missing"); by hatch / season.
- **Pattern page**: 3D viewer, steps, materials, history & origin, fishing notes,
  variants (linked recipes, viewable in 3D), sources.
- **Techniques**: a library of short 3D technique lessons linked from steps, plus a
  learning path (techniques → flies that use them, easy to hard).

## Personal features (browser storage)

- Favorites / my fly box.
- Materials inventory, which drives "tie with what I have".
- Bench mode: large controls, auto-pause per step, screen kept awake, tap to advance,
  offline once installed (PWA).

## Design

- Visual direction: **field journal**: warm paper tones, serif display type, flies
  presented like specimens on naturalist plates.
- Front page: **the gallery with search** (search box and filter chips on top, fly grid
  below, a small featured fly / start-learning link that doesn't push the grid down).
- Gallery cards: images pre-rendered from recipes at build time; a short pre-rendered
  turntable plays on hover or tap.
- Light and dark themes, following the system, with a toggle.

## Viewer

Auto camera that follows the action (free orbit still possible), material callouts,
hook size switch, deep links to steps.

## Content and tooling

- Recipes are drafted by the agent in batches from published dressings, with sources
  cited and assumptions flagged; the user reviews.
- A local-only authoring studio (dev server page): KDL editor, inline errors, live 3D
  preview, saves to `patterns/`. Not shipped to the public site.
- Hosting: GitHub Pages at flybench.ebner.se, deployed by a workflow on every push to main. Every page has a real
  address and its own prerendered HTML file (title, description, preview picture, text), so
  pages can be shared and found by search engines; the build stays a plain static `dist/`.

## Milestones

1. ✅ Red Tag end to end (viewer, playback, KDL recipes, validation).
2. ✅ Schema: catalog metadata, materials catalog, dubbing, ribbing, palmered hackle, hair and
   feather wings, variants. Patterns: Elk Hair Caddis (+ Troth variant), Europea 12
   (+ tailed variant).
3. ✅ a. Render pipeline (headless renders of finished flies, also for gallery thumbnails)
      and the reference check (contact sheets against reference photos).
   ✅ b. Field-journal design system, gallery front page, search. App name: Flybench
      (flybench.ebner.se).
4. ✅ Pattern page and viewer features (auto camera, callouts, hook size, deep links).
   Engine: curved and long hooks (8 hook models), beads, weighting, tinsel, chenille,
   soft hackles, biots, marabou, CDC, flash, feather pairs, beards, eyes, wing cases,
   parachute posts, spun and trimmed hair.
5. ✅ Techniques library and learning path. Techniques are recognised from recipe steps
   (src/catalog/techniques.ts); the path is computed so each fly adds a few new techniques.
6. ✅ Fly box, materials inventory ("tie with what I have", "one material short"), vise mode
   (big controls, tap to advance, screen kept awake), installable offline PWA.
7. ✅ Authoring studio (`pnpm studio`): KDL editor with problems as you type, live 3D
   preview with a gape grid and step list, new patterns from a template, saves to
   `patterns/` through a dev-server-only endpoint.

Catalog: established patterns of every type, each with sources, reference photos and a
refcheck pass. Scandinavian additions chosen from a survey of flugor.se (see
.cache/research/flugor-se-survey.md when present). Supported since the engine round after milestone 7: doubles and trebles, tubes and
Waddingtons, cone heads, jig hooks (and point-up flies generally), rubber legs, legs tied
across the shank, and extended bodies.
