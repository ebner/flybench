# Recipe schema

A fly pattern is one [KDL v2](https://kdl.dev) file in `patterns/`, named after its id
(`patterns/elk-hair-caddis.kdl`). The recipe is the single source of truth: the 3D
model, the animation, the written steps, the materials list and the catalog entry are
all generated from it.

Validation happens in four layers, and errors report the line they came from:

1. **KDL syntax** (`@bgotink/kdl`)
2. **Structure and values**: the Zod schema in `src/recipe/schema.ts`
3. **Tying sense**: `src/recipe/validate.ts`, e.g. a material must be tied in before it is wound
4. **Catalog**: `src/recipe/catalog.ts`: unique ids, file names, variants

`npm test` loads every pattern file and runs all four.

## Units

| Quantity  | Unit                                                              |
|-----------|-------------------------------------------------------------------|
| Positions | Fraction of the shank: `0` = start of the bend, `1` = just behind the eye |
| Lengths   | Multiples of the hook gape                                        |
| Angles    | Degrees                                                           |

So one recipe works at any hook size. The hook size only matters for converting
real-world thread thickness into gape units.

## Example

```kdl
id elk-hair-caddis
name "Elk Hair Caddis"
aliases "EHC"
type dry
imitates caddis
difficulty intermediate
species trout grayling
season may june july august september
origin originator="Al Troth" year=1957 region="Pennsylvania, USA"
description "A buoyant searching caddis."
history """
    Al Troth tied the first Elk Hair Caddis in 1957 …
    """
sources {
    "Wikipedia: Elk Hair Caddis" url="https://en.wikipedia.org/wiki/Elk_Hair_Caddis"
}

hook dry-standard size=14
thread tan size="8/0"

materials {
    rib    gold-wire
    body   dry-fly-dubbing color=tan
    hackle cock-hackle color=brown fibre=0.8
    wing   elk-hair color=bleached
}

steps {
    attach-thread at=0.85
    wrap-thread to=0.0
    tie-in rib
    dub body to=0.75
    tie-in hackle
    wind hackle to=0.05 turns=5      // palmered back to the bend
    wind rib to=0.75 turns=5         // forward through the hackle, trapping its tip
    tie-off rib
    trim hackle                      // the hackle tip at the bend
    tie-in wing length=2.3 angle=27 spread=75
    trim wing leave=0.25             // the hair butts, leaving a short head
    whip-finish
}
```

KDL notes: comments are `//` or `/* */`. Strings that start with a digit or `#`
must be quoted (`size="8/0"`, `color="#c8102e"`). Plain words such as `red`
need no quotes. Multi-line text uses `"""` on its own lines; the indentation of
the closing `"""` is removed. A blank line starts a new paragraph.

## Catalog metadata

| Node          | Form                                              | Required |
|---------------|---------------------------------------------------|----------|
| `id`          | `id red-tag` (lowercase, digits, `-`); must match the file name | yes |
| `name`        | `name "Red Tag"`                                  | yes      |
| `aliases`     | `aliases "Worcestershire Gem" "Worcester Gem"`    | no       |
| `type`        | one of `dry wet nymph emerger midge streamer terrestrial salmon saltwater` | yes |
| `imitates`    | any of `mayfly caddis stonefly chironomid damselfly terrestrial baitfish crustacean attractor` | no |
| `difficulty`  | `beginner`, `intermediate` or `advanced`          | yes      |
| `species`     | any of `trout grayling sea-trout salmon char bass panfish pike` | no |
| `season`      | month names, `january` … `december`              | no       |
| `origin`      | `origin originator="…" year=1957 region="…"` (all optional) | no |
| `description` | one or two sentences for the catalog              | no       |
| `history`     | multi-line text                                   | no       |
| `fishing`     | multi-line text: how and when to fish it          | no       |
| `sources`     | block of `"Title" url="…"` lines (url optional)   | no       |
| `references`  | block of reference photos, see below              | no       |
| `variant-of`  | id of the main pattern                            | with `variant` |
| `variant`     | short variant name, e.g. `"Troth original"`       | with `variant-of` |

### References

Photos of the finished fly, used only to check proportions while authoring
(`npm run refcheck`). They are downloaded to a local cache and never committed or
published, so copyrighted photos are fine to list.

```kdl
references {
    "https://upload.wikimedia.org/…/Elk_Hair_Caddis2.jpg" page="https://commons.wikimedia.org/wiki/File:Elk_Hair_Caddis2.jpg" author="Mike Cline" license="CC BY-SA 4.0" note="Side view in the vise"
}
```

Each line is the direct image URL, plus optional `page`, `author`, `license`, `note`, and
`flip=#true` to mirror a photo whose eye points left (our renders have the eye on the right).

### Variants

A variant is a complete recipe of its own with `variant-of` pointing at the main pattern
(which may not itself be a variant). The app groups a pattern with its variants.

## Hook and thread

| Node     | Form                                  |
|----------|---------------------------------------|
| `hook`   | `hook <model> size=<even 2–24>`       |
| `thread` | `thread <colour> size=<"3/0"…"14/0">` |

Hook models: `dry-standard`.
Thread sizes: `3/0`, `6/0`, `8/0`, `10/0`, `12/0`, `14/0`.

## Colours

Either a named colour: `black`, `white`, `cream`, `red`, `fluo-red`, `brown`, `red-brown`,
`red-game`, `ginger`, `tan`, `grizzly`, `olive`, `grey`, `dun`, `yellow`, `green`, `gold`, `silver`,
`copper`, `bleached`, `elk`, `hares-ear`, `mallard`, `pheasant-tail`.
Or a quoted hex value: `"#c8102e"`.

## Materials

Each material line is `<id> <kind> [properties]`. The id is the material's role in this
recipe (`body`, `wing`), and steps refer to it. The kind comes from the **materials
catalog** (`src/recipe/materials.ts`), which gives every material a stable identity
for search and the inventory.

All materials accept `color` and `label="…"`, which overrides the generated display name.
`color` is required unless the catalog gives a default.

| Kind                | Archetype | Default colour  | Extra properties |
|---------------------|-----------|-----------------|------------------|
| `wool`              | yarn      | –               |                  |
| `peacock-herl`      | herl      | (natural)       | `strands` (1–6, default 3) |
| `cock-hackle`       | hackle    | –               | `fibre`: fibre length in gapes (required) |
| `hares-ear-dubbing` | dubbing   | `hares-ear`     |                  |
| `dry-fly-dubbing`   | dubbing   | –               |                  |
| `gold-wire`         | wire      | `gold`          |                  |
| `copper-wire`       | wire      | `copper`        |                  |
| `silver-wire`       | wire      | `silver`        |                  |
| `rib-thread`        | floss     | –               | `size` (thread size; default the tying thread's) |
| `elk-hair`          | hair      | `elk`           |                  |
| `pheasant-tail`     | fibres    | `pheasant-tail` | `count` (default 6) |
| `mallard-breast`    | feather   | `mallard`       |                  |

The archetype decides how a material behaves and is drawn:

- **dubbing** is spun onto the thread with `dub`, never tied in.
- **hair** is tied in as a clump with `length`; its butts stick forward until trimmed.
- **feather** wings are tied in with `length` and lie over the body like a roof.
- Everything else can be tied in with `length` (tags, tails), or without it and then wound.

## Steps

Steps run in order. The **thread position** is part of the tying state. Only
`attach-thread`, `wrap-thread` and `dub` move it. Tie-ins, tie-offs and the whip finish
happen wherever the thread is, as they do at the vise.

Every step accepts `note="…"`, which is appended to the generated instruction text.

| Step            | Form                                              | Meaning |
|-----------------|---------------------------------------------------|---------|
| `attach-thread` | `attach-thread at=<pos>`                          | Start the thread at `at`. |
| `wrap-thread`   | `wrap-thread to=<pos> [turns=<n>]`                | Move the thread to `to`. Without `turns` it lays touching turns; with `turns` it makes that many open turns. |
| `tie-in`        | `tie-in <material> [length=<gapes>] [angle=<deg>] [spread=<deg>] [width=<gapes>]` | Tie the material in at the thread. With `length`, it sticks out rearward by that much (tag, tail, wing), `angle` degrees above the shank. `spread`: how far round the body a tag, tail or hair wing fans out, in degrees either side of the top (defaults: yarn 35, fibres 15, hair 60). `width`: width of a feather wing (default half its length). Without `length`, a loose end hangs until the material is wound. |
| `dub`           | `dub <material> to=<pos> [turns=<n>]`             | Spin dubbing onto the thread and wrap it to `to`; the thread ends there. |
| `wind`          | `wind <material> to=<pos> turns=<n>`              | Wind the material from its tie-in point to `to`. Forward: it ends at the thread. Rearward (palmering): it ends away from the thread and must be secured (see below). |
| `tie-off`       | `tie-off <material>`                              | Secure a forward-wound material at the thread and trim the excess. |
| `trim`          | `trim <material> [leave=<gapes>]`                 | Cut off what sticks out: the tip of a palmered material, or the butts of a hair clump (`leave` = length of head left standing; default flush). |
| `whip-finish`   | `whip-finish [turns=<n>]`                         | Build the head, whip finish (default 5 turns) and cut the thread. |

### Tying rules (semantic validation)

- `attach-thread` comes first and occurs once.
- A material is tied in once and wound at most once. Dubbing is only used with `dub`.
- Hair and feather wings need a `length`. `angle` needs a `length`. `spread` only applies
  to tags, tails and hair wings tied in with a length; `width` only to feather wings.

### Proportions

Proportions are data in the recipe, never constants in the renderer, so they can be
corrected per pattern. The generated text states them the way a tyer measures: in
fractions of the gape, and for wings by where the tips end ("just past the end of the
bend"). When proportions are taken from reference photos, say so in a comment.
- `wind … to` must differ from the tie-in point. A forward wind may go no further than
  the thread.
- A forward-wound material is tied off in the very next step.
- A rearward-wound (palmered) material must be secured in the very next step, by winding
  another material forward from at or behind its tip, and its tip must be trimmed before
  the whip finish.
- `trim` needs something to trim; `leave` only applies to hair butts.
- `whip-finish` is the last step, and every recipe ends with one.
- Materials have unique ids, and steps refer only to defined materials.
