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
10. ✅ In the water. (How a fly sits comes from its type and weighting, with `fishes` to
    override, rather than per-material buoyancy; wet fibres clump by archetype. Not done: hair
    clumping into strands, and the fibres moving individually.) A view switch on the pattern page ("In the water", beside "Whole fly")
    with the finished fly in moving water: an animated surface, the surface line seen from
    the side (the fly above as the angler sees it, below as the fish does), the trout's view
    from below (Snell's window, the dimples a dry fly makes in the film), drift and swim
    (a dry fly riding the ripples, a nymph tumbling, a streamer stripped with marabou
    pulsing), and wet materials (darker colours, hair clumping, bubbles in CDC and dubbing).
    Real behaviour drawn in the house style (herbarium and cyanotype palettes); the water is
    a function of time like the rest of the scene; a still-water setting for slow devices
    and reduced motion. How a fly sits in the water comes from its type and its materials'
    buoyancy (new wet properties in the materials catalog), with a recipe override.
11. ✅ Planning and practice. (The trip box suggests from the patterns' species, seasons and
    naturals; water is river, lake or sea coast. The shopping list is on the Fly box page.
    Variations are pictured in the fly box by drawing them in the browser.)
    - Colour playground: change a pattern's colours; the 3D fly, step texts and materials
      list follow; variations can be saved to the fly box.
    - Shopping list: the materials still missing for chosen flies or a fly box, merged
      across patterns, with substitutes, checked against the Materials page.
    - Trip fly box: water, month, species and region give a suggested box of patterns and
      sizes, from the hatch calendar, noting what the materials at hand still lack.
    - Tying log and progress: flies tied (count, size, notes), learning-path progress and
      practised techniques, kept in the browser.
12. ✅ Swedish and German. The whole site, the generated step texts included. (Drafts throughout,
    marked on every Swedish and German page, for the user's review: the interface catalogs, the
    glossaries with their translator notes and sources, the prose of every pattern, natural and
    technique.)
    - A glossary as data (`glossary/*.kdl`): every term per language with its grammar
      (gender, plural and definite forms) and translator notes (preferred term, rejected
      alternatives and why, a source). The step generator and the interface take their
      words from it; tests fail on a missing term or form.
    - Pattern prose (history, how to fish it, step notes) is drafted with the glossary and
      marked as a draft until reviewed; the user reviews Swedish and German. English shows
      where no translation exists.
    - The i18n architecture (decided 2026-10-29, the recommended option of each):
      - Language in the path: English at the root, `/sv/…` and `/de/…`, every page
        prerendered in each with `hreflang` links; a language switch in the header leads to
        the same page in another language. No automatic redirect and nothing stored, so the
        privacy section is unchanged. (Rejected: a stored choice without the address, which
        can't be shared or found.)
      - Interface text in typed message catalogs (`src/i18n/`), no i18n library: a missing
        or mistyped string fails the typecheck. (Rejected: i18next or FormatJS, more bundle
        for plurals the catalogs can say themselves.)
      - Generated text (steps, dressing, facts) from a generator per language sharing the
        step analysis, taking its words and their forms (gender, definite and plural, the
        German cases, adjective endings) from `glossary/*.kdl`.
      - Prose (history, how to fish, notes, technique texts, naturals) in translation files
        beside the originals, marked as drafts until reviewed; English shows where a
        translation is missing.
13. ✅ Photorealistic water and naturals (decided 2026-10-29, the recommended option of each). (Done: `src/render/real/`, `pnpm render:water`; slow devices, data savers, reduced motion and software rendering get the drawn water; the naturals' new anatomy fields are in docs/recipe-schema.md.)
    The "In the water" view and the naturals become photorealistic; the step-by-step fly view
    keeps the herbarium and cyanotype look for teaching. Everything is still generated from
    the recipes: no photos (real insect photos were rejected, so the same-scale overlay on the
    fly keeps working) and no generated images.
    - Both formats: path-traced stills rendered at build time (three-gpu-pathtracer in
      headless Chromium, beside `pnpm render:catalog`) are the first picture; the upgraded
      live 3D takes over when the visitor interacts.
    - Live renderer: photographed CC0 sky and river panoramas (HDRI) served by the site,
      physical materials per archetype (sheen for fur and dubbing, transmission and
      iridescence for wings, a wet gloss, anisotropic tinsel), insect detail from the
      natural's recipe (venation, segment bands, setae), water with Fresnel reflection and
      refraction, Snell's window, the dimples feet and hackle make in the film, caustics on a
      riverbed, depth of field and contact shadows.
    - Moderate cost: about 1–3 MB more download; weak devices and reduced motion keep
      today's stylised view.
    - First a trial: the mayfly dun and the Elk Hair Caddis on water, live against
      path-traced, as screenshots for the user to judge before the full milestone. (Done
      2026-10-29: the path-traced stills came close to photographic, the live view a step
      below; a photoscanned riverbed made the biggest difference, and the naturals' simple
      shapes showed. Decided after it, the recommended option of each: go on with both
      formats; an anatomy upgrade for the naturals from their recipes (segment plates,
      jointed legs, setae, hindwings, compound eyes); CC0 photoscans for the riverbed and sky
      (Poly Haven, compressed, served by the site); two stills per pattern and natural, the
      angler's view and the trout's.)

14. ✅ Fish and insects drawn true to life (decided 2026-10-29). Everything in the natural recipes,
    with sources, as before; values read off photos marked as assumptions.
    - Fish anatomy: body outlines with their own back and belly heights per section; fins with
      base length, height, ray and spine counts, shape (rounded, pointed, forked, truncate) and
      clear membranes; scale size, the lateral line, gill cover and mouth (terminal, upturned,
      underslung); eyes with iris and pupil. Drawn with scale and ray textures and a proper head.
    - New fish: trout and salmon parr, sand eel (tobis), stickleback, herring and sprat fry,
      with hatch months by region, linked to the patterns whose sources say they imitate them
      (sand eel, herring fry; none yet for parr and stickleback).
    - Insects: legs per pair (fore, middle, hind: length, segment proportions, tarsal segments,
      claws and pose, e.g. a male mayfly's long forelegs, a midge's raised ones); each tail its
      own length (Baetis's short middle tail), banded tails, gills and legs; antennae threadlike,
      elbowed (ants), clubbed (beetles) or plumed (male midges), with segments; head and thorax
      plates (pronotum), compound eye size and the turbinate eyes of male Baetis, ocelli; larval
      prolegs and anal hooks (caddis, midge larvae); marks per segment (streaks on segments 7–9,
      rows of dots, rings) as their own entries.
    - Checking: naturals get `references` like patterns (linked, never committed, left out of
      the build) and `pnpm refcheck <natural>` puts the render beside the photos on a grid in body
      lengths; every natural is compared and corrected.
    - Re-rendered: catalog pictures and water stills; translations of the new naturals' prose.
15. ✅ The studio for naturals, with a visual editor. The dev-only studio edits naturals as well as
    patterns: KDL text with live errors, a live 3D preview on the bench and in the realistic
    river, a grid in gapes or body lengths, the reference photos beside it. A form beside the
    text, built from the schema, edits every field with sliders, numbers, menus and colour
    pickers, and writes back into the KDL text without disturbing its comments; the text stays
    the source of truth.
16. ✅ A public fly editor ("Build a fly"). Visitors build their own fly, from scratch or as a copy
    of a pattern: hook and size, thread, materials from the catalog with colours, tying steps
    from a menu with their settings, the 3D fly and the generated steps (in the page's language)
    following as they go, with the tying rules' warnings. Saved only in the browser (a new
    flybench.* key, listed in the Privacy section), shareable as a link that carries the recipe
    itself, and downloadable as a KDL file to contribute to the project.
    Decided 2026-10-29: the link carries the recipe compressed after `#` (never sent to a
    server); the tying rules' messages are translated (sv/de drafts); own flies go in the fly
    box (with its shopping list and trip box), the tying log and a "Your flies" row in the
    gallery, all in this browser only. Milestone 15's form patches the KDL text in place,
    keeping comments and formatting. Milestones 14–16 in that order, each reviewed (Fable and
    Codex), rendered and pushed without stopping.

New storage keys these add (region, tying log, saved variations) are a visitor's own choice;
list them in the About page's Privacy section as they come.
