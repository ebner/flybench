# Product plan

Decisions from the planning interview (2026-10-24). Update this file when they change.

## Goal

A large, browsable catalog of fly patterns, each with an animated 3D tying sequence,
written steps and a materials list. Fully static site: all execution in the browser,
personal data in browser storage (no accounts, no sync).

## Audience and language

- Beginners and experienced tyers, with **layered detail**: concise by default,
  expandable explanations (technique lessons) for beginners.
- English for now; Swedish and German planned (milestone 12), with a glossary that keeps
  fly-tying terms consistent. Keep UI strings in one place so translation stays possible.

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

## Next milestones (planned 2026-10-28)

Agreed with the user in an interview; one milestone at a time, each stopping for feedback.

8. ✅ Quick wins. (Page Down/Up control steps in vise mode only: elsewhere they keep
   scrolling the page, as people expect; arrow keys work everywhere, and most clickers send
   either.)
   - Pedal and remote control: Page Down / Page Up (Bluetooth page-turner pedals,
     presentation clickers) play the next step and go back in vise mode.
   - Share a variation: the address keeps the hook size and (with milestone 11) the colours
     as well as the step.
   - Common mistakes per step: a step shows the mistakes of its technique, extended per
     pattern where sources mention them.
   - Proportion guide: a switchable gape ruler on the pattern page, marking tail, wing,
     hackle and body proportions on the 3D fly.
   - Printable recipe card: the fly, the dressing and numbered steps with small step
     pictures, on one page for patterns of up to about 20 steps (longer ones continue on a
     second).
9. ✅ Naturals. What a pattern imitates, shown in 3D by the same renderer. (25 naturals; the
   burrowing mayfly nymph has no pattern yet. Hatch months marked "Estimate" where no source
   gave them, mostly northern Scandinavia and central Europe.)
   - Natural recipes in KDL (`naturals/*.kdl`), validated like patterns, with cited
     entomology sources: about 25 naturals at group and life-stage level (mayfly nymph,
     emerger, dun, spinner; caddis larva, pupa, adult; stonefly nymph; midge pupa; shrimp;
     ant; beetle; small baitfish…), with size and colour ranges. Patterns refer to them.
   - Shown beside the fly on its page (same scale, with an overlay toggle), in the water
     view (milestone 10), and in a Naturals section: life stages, when they hatch, how to
     fish them, and the patterns that imitate them.
   - Hatch calendar: which naturals are about, month by month, and which flies match. The
     visitor picks a region (e.g. southern Sweden, northern Scandinavia, British Isles,
     central Europe), remembered in the browser; no location prompt. Timings researched
     and cited per region.
10. In the water. A view switch on the pattern page ("In the water", beside "Whole fly")
    with the finished fly in moving water: an animated surface, the surface line seen from
    the side (the fly above as the angler sees it, below as the fish does), the trout's view
    from below (Snell's window, the dimples a dry fly makes in the film), drift and swim
    (a dry fly riding the ripples, a nymph tumbling, a streamer stripped with marabou
    pulsing), and wet materials (darker colours, hair clumping, bubbles in CDC and dubbing).
    Real behaviour drawn in the house style (herbarium and cyanotype palettes); the water is
    a function of time like the rest of the scene; a still-water setting for slow devices
    and reduced motion. How a fly sits in the water comes from its type and its materials'
    buoyancy (new wet properties in the materials catalog), with a recipe override.
11. Planning and practice.
    - Colour playground: change a pattern's colours; the 3D fly, step texts and materials
      list follow; variations can be saved to the fly box.
    - Shopping list: the materials still missing for chosen flies or a fly box, merged
      across patterns, with substitutes, checked against the Materials page.
    - Trip fly box: water, month, species and region give a suggested box of patterns and
      sizes, from the hatch calendar and the materials at hand.
    - Tying log and progress: flies tied (count, size, notes), learning-path progress and
      practised techniques, kept in the browser.
12. Swedish and German. The whole site, the generated step texts included.
    - A glossary as data (`glossary/*.kdl`): every term per language with its grammar
      (gender, plural and definite forms) and translator notes (preferred term, rejected
      alternatives and why, a source). The step generator and the interface take their
      words from it; tests fail on a missing term or form.
    - Pattern prose (history, how to fish it, step notes) is drafted with the glossary and
      marked as a draft until reviewed; the user reviews Swedish and German. English shows
      where no translation exists.
    - The i18n architecture (how texts and the generator are localised, how a language is
      chosen) is to be proposed with options before work starts.

New storage keys these add (region, tying log, saved variations) are a visitor's own choice;
list them in the About page's Privacy section as they come.
