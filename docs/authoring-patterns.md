# Authoring patterns

How to add a fly or change one so that it is right: research, recipe, proportion check,
finish. The recipe format itself is in [recipe-schema.md](recipe-schema.md); the rules
every pattern follows are under "Recipe conventions" in [AGENTS.md](../AGENTS.md).

A valid recipe is easy. A good one is one a tyer recognises: the dressing most people tie
today, in the order they tie it, with the proportions you see on real flies. Most of the
work is research and proportions.

## 1. Before you start

- Check `patterns/` for the fly and its relatives. A different hook, bead or a single
  changed material is a **variant** (`variant-of` + `variant`), not a new pattern.
- Read `.cache/research/<id>.md` if it exists (local, gitignored) before researching again.
- Settle the dressing you will tie first; everything else follows from it (see 3).

## 2. Research

Use at least three independent sources, and prefer, in this order: the originator or a
book that quotes them, an established tying site or magazine (with author), a fly
shop's dressing. Forums and copied recipes count only as weak evidence: say so when you
rely on one. Video narration is a fine source; name it as such.

Collect:

- **Origin**: originator, year, place, who it was named for. Disputes are normal; record
  each version and who says it.
- **Type and use**: what it imitates, species, season, how it is fished.
- **Hook**: models and the usual size range.
- **Dressing**: every material, with common substitutes.
- **Tying sequence**: the order of the steps, from a step-by-step source where possible.
  The order matters: it decides which techniques the pattern teaches.
- **Proportions**: anything stated in numbers (tail = shank, hackle 1.5 × gape, wing to the
  end of the tail) with its source.
- **Reference photos**: side views of finished flies, the more tyers the better.

Write it to `.cache/research/<id>.md` with this layout, so the next session can pick it up:

```markdown
# <Name> (<type>)

## Origin
## Type and use
## Hook
## Standard dressing
## Tying sequence (<which source's method>)
## Proportions
| Element | Value | Source |
## Variants
## Fishing notes
## Sources
- <url>: what it was used for.
## Reference photos
1. <direct image url>
   - Page: <url> (<author>, <licence>).
   - Eye left/right, side view or not, anything odd about the fly.
```

Download checks: confirm each photo URL actually returns an image. upload.wikimedia.org
throttles bare user agents; send one with a contact URL.

## 3. Choose the dressing

- Tie the dressing most tyers tie today, unless the pattern is known by its original.
  The other notable dressings go in `history`, or become variants when they are worth
  animating.
- Where sources disagree, choose, say which source you followed in a comment, and mention
  the disagreement in the recipe (in `history`, or a `//` comment if it is about a
  detail).
- Every choice that rests on your judgement rather than a source gets an
  `// Assumption:` comment, so the user can find and correct it.

## 4. Write the recipe

Start from a similar pattern in `patterns/`: copy its structure, not its numbers. Keep
the order of existing recipes: a one-line `//` summary, catalog metadata, `sources`,
`references`, hook and thread, `materials`, `steps`.

### Text

- `description`: one sentence naming the visible materials from back to front, as a tyer
  would describe the fly to another ("An oval gold tag and rib over a black floss body…").
- `history`: a short paragraph of facts with their disagreements, no marketing.
- `fishing`: how, where and when it is fished, in two to four sentences.
- `sources`: `"Site: Title (Author)" url="…"`. Every fact in the text comes from one of them.
- Plain English, British spelling (colour, fibre), as in the existing recipes.

### Hook and materials

- Pick the hook model that matches the hook the sources name (table in recipe-schema.md),
  and a size from the middle of the usual range.
- Use catalog kinds from `src/recipe/materials.ts`. If the material isn't there, add a
  catalog entry with the right archetype; never invent a per-recipe kind.
- Use `label` when the material shown is a stand-in (a mixed throat drawn as one colour)
  or when the name tyers use is more specific than the kind.

### Steps

Translate the tying sequence one action at a time. Positions are fractions of the shank
(`0` bend, `1` eye or bead); lengths are gapes.

Useful landmarks, as used across the existing patterns:

| Where | Position |
|---|---|
| Thread start | 0.85–0.9: leaves room for the head |
| Tail, tag, rib and body tie-ins | 0, after wrapping the thread back |
| Tag | 0–0.06 |
| Body end on a hackled fly | 0.7–0.84, leaving the front for wing, hackle and head |
| Wing on a dry fly | about 0.75 (a quarter of the shank behind the eye) |
| Last tie-off before the whip finish | 0.84–0.92 (0.98 behind a bead) |

Sources give lengths in shank lengths, hook lengths and gapes. Convert with the model's
shank length in gapes (`src/tying/hook.ts`):

| Model | Shank (gapes) |
|---|---|
| `dry-standard` | 2.0 |
| `wet-standard` | 2.1 |
| `nymph-2xl` | 2.8 |
| `dry-3xl-curved` | 3.0 |
| `streamer-4xl` | 4.0 |
| `emerger-curved` | 2.3 |
| `scud-curved` | 1.9 |
| `salmon-up-eye` | 2.7 |
| `salmon-double`, `salmon-treble` | 2.6 |
| `jig` | 1.9 |
| `saltwater-straight` | 2.4 |

So a tail "one shank long" on a dry fly is `length=2.0`; a wing "to the end of the tail"
is the tail length plus the distance from the bend to the wing's tie-in point. Hackle
`fibre` is in gapes too: "1.5 × gape" is `fibre=1.5`.

Use `note="…"` for what the animation can't show but a tyer needs: how many fibres,
which side faces out, "stroked back", "cut at an angle". Keep notes to one short sentence.

If the pattern needs a technique the schema can't express, don't fake it with a
look-alike. Extend the schema, simulation and renderer in a general way, add a test, and
update recipe-schema.md (see AGENTS.md).

## 5. Check proportions

1. Add `references`: two or more side views from different tyers, `flip=#true` for photos
   with the eye on the left, a `note` on what each shows. Photos are never committed.
2. Run `npm run refcheck -- <id>` and read `.cache/refcheck/<id>.png`.
3. Using the gape as the ruler in each photo, compare:
   - tail or tag length, and how high it is cocked;
   - wing length, angle and spread (and whether the tips end where the sources say);
   - hackle fibre length relative to the gape;
   - where the body starts and ends, its thickness and taper;
   - head size and bare eye space.
4. Change the recipe where it is clearly off, say in a comment that the value was read
   from photos, and run refcheck again. Photos disagreeing with each other is normal: aim
   for the middle of them, and note the spread if it is large.
5. Look at the render as a whole, too: something can be within the numbers and still
   look wrong (a wing too dense, a body too smooth). Report that rather than tuning the
   renderer for one fly.

The studio (`npm run studio`) is handy for this loop: it shows the fly on the gape grid
step by step as you edit.

## 6. Finish

- `npm test` and `npm run typecheck` pass.
- `npm run render:catalog`, look at the new image in `public/renders/`, and commit it with
  the recipe.
- If you changed the schema, catalog or engine: update recipe-schema.md and README.md.
- Report back: what you followed, where sources disagree, the `// Assumption:` list, and
  any refcheck discrepancy you left in place, with the reason.
