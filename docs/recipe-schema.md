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

`pnpm test` loads every pattern file and runs all four.

## Units

| Quantity  | Unit                                                              |
|-----------|-------------------------------------------------------------------|
| Positions | Fraction of the shank: `0` = start of the bend, `1` = just behind the eye (or just behind the bead, on a beaded fly) |
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
| `species`     | any of `trout grayling sea-trout salmon char bass panfish pike striped-bass bonefish` | no |
| `season`      | month names, `january` … `december`              | no       |
| `origin`      | `origin originator="…" year=1957 region="…"` (all optional) | no |
| `description` | one or two sentences for the catalog              | no       |
| `rides`       | `point-down` or `point-up` (default: `point-up` on jig hooks, `point-down` on the rest) | no |
| `history`     | multi-line text                                   | no       |
| `fishing`     | multi-line text: how and when to fish it          | no       |
| `sources`     | block of `"Title" url="…"` lines (url optional)   | no       |
| `references`  | block of reference photos, see below              | no       |
| `variant-of`  | id of the main pattern                            | with `variant` |
| `variant`     | short variant name, e.g. `"Troth original"`       | with `variant-of` |

### References

Photos of the finished fly, used only to check proportions while authoring
(`pnpm refcheck`). They are downloaded to a local cache and never committed, and the
production build strips the `references` block (`src/recipe/publish.ts`), so copyrighted
photos are fine to list.

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
| `hook`   | `hook <model> size=<even 2–24>`, or for tubes and Waddingtons `hook <model> length=<mm> [treble=<size>]` |
| `thread` | `thread <colour> size=<"3/0"…"14/0">` |

Thread sizes: `3/0`, `6/0`, `8/0`, `10/0`, `12/0`, `14/0`.

| Hook model           | Shape                                       | Like                  |
|----------------------|---------------------------------------------|-----------------------|
| `dry-standard`       | standard shank, fine wire, down eye          | TMC 100               |
| `wet-standard`       | standard shank, heavy wire, down eye         | TMC 3769              |
| `nymph-2xl`          | 2x long shank                               | TMC 5262              |
| `dry-3xl-curved`     | 3x long, gently curved shank (25°)          | TMC 200R              |
| `streamer-4xl`       | 4x long shank                               | TMC 9395              |
| `emerger-curved`     | curved shank (45°)                          | Partridge 15BN        |
| `scud-curved`        | strongly curved shank (75°)                 | TMC 2457              |
| `salmon-up-eye`      | long, heavy, up eye                         | Partridge Bartleet    |
| `salmon-double`      | double: two bends on one up-eyed shank      | Partridge Q, Ahrex HR428 |
| `salmon-treble`      | long-shank treble, up eye                   | Esmond Drury, Ahrex HR490 |
| `jig`                | short shank, eye section bent up 60°        | Hanak 450, Fulling Mill Jig Force |
| `saltwater-straight` | heavy, straight eye                         | Gamakatsu SC15        |

Positions on curved shanks are measured along the curve, so a recipe reads the same on
any hook. A double or treble is dressed on its shank exactly like a single hook.

Tubes and Waddington shanks are dressed like a shank too, with a treble hook behind them
(`treble`, default size 12) in a silicone sleeve or through the Waddington's rear loop.
They are sized by `length` in mm. A tube has no gape, so its unit is four times its outer
diameter, about the gape of a hook of similar size; a Waddington's twisted shank counts as
2 mm wide.

| Tube model       | Outer diameter (assumed) |
|------------------|--------------------------|
| `tube-plastic`   | 3 mm (with liner)        |
| `tube-aluminium` | 3.5 mm                   |
| `tube-copper`    | 3.5 mm                   |
| `tube-brass`     | 3.5 mm                   |
| `tube-needle`    | 1.8 mm                   |
| `waddington`     | 2 mm (twisted wire)      |

A wing tied all round a tube takes `spread=180`.

Flies with dumbbell eyes and flies on jig hooks swim hook point up. Jig hooks imply it; for
other flies say so with `rides point-up` (the default is `point-down`). The steps are always
shown as tied, point down; the viewer offers to turn a point-up fly over, and the gallery
pictures jig flies point up, as they are usually photographed.

## Colours

Either a named colour: `black`, `white`, `cream`, `red`, `fluo-red`, `brown`, `red-brown`,
`red-game`, `ginger`, `tan`, `grizzly`, `olive`, `grey`, `dun`, `yellow`, `green`, `gold`, `silver`,
`copper`, `bleached`, `elk`, `hares-ear`, `mallard`, `pheasant-tail`, `partridge`, `snipe`,
`lead`, `deer`, `squirrel`, `moose`, `tippet`, `crest`, `pearl`, `teal`, `turkey`, `badger`,
`blue-dun`, `purple`, `orange`, `pink`, `claret`, `chartreuse`, `coch`, `muskrat`, `clear`, `blue-black`, `blue`, `pardo`. Barred colours
(`grizzly`, `teal`, `partridge`, `mallard`, `snipe`, `turkey`) are drawn with bars, also across
each fibre of a tail or beard; `tippet` fibres get their black bar and black tip.
Or a quoted hex value: `"#c8102e"`.

## Materials

Each material line is `<id> <kind> [properties]`. The id is the material's role in this
recipe (`body`, `wing`), and steps refer to it. The kind comes from the **materials
catalog** (`src/recipe/materials.ts`), which gives every material a stable identity
for search and the inventory.

All materials accept `color` and `label="…"`, which overrides the generated display name.
`color` is required unless the catalog gives a default.

The catalog lives in `src/recipe/materials.ts`; each entry names its archetype, which decides
how it is drawn and which extra properties it takes:

| Archetype  | Kinds | Extra properties |
|------------|-------|------------------|
| yarn       | `wool`, `poly-yarn` | |
| herl       | `peacock-herl` | `strands` (1–6, default 3) |
| hackle     | `cock-hackle`, `hen-hackle`, `saddle-hackle`, `partridge-hackle`, `snipe-hackle` | `fibre` (required, gapes), `sweep` (degrees the barbs lean back; default from the kind) |
| dubbing    | `hares-ear-dubbing`, `dry-fly-dubbing`, `rabbit-dubbing`, `seals-fur`, `dubbing` | `shaggy` (0–1: how rough, from fine and tight to picked out with long guard hairs; default from the kind) |
| wire       | `gold-wire`, `copper-wire`, `silver-wire`, `lead-free-wire` | `mm` (diameter; default fine rib wire, or 0.38 for lead-free) |
| floss      | `rib-thread`, `silk-floss`, `monofilament` | `size` (thread size) |
| tinsel     | `flat-tinsel`, `oval-tinsel` | |
| chenille   | `chenille` | |
| hair       | `elk-hair`, `deer-hair`, `calf-tail`, `bucktail`, `squirrel-tail`, `moose-mane` | `count` (hairs, for legs tied across) |
| fibres     | `pheasant-tail`, `hackle-fibres`, `golden-pheasant-tippet`, `golden-pheasant-crest`, `hares-mask-guard-hairs`, `synthetic-hair`, `coq-de-leon` | `count` |
| biot       | `goose-biot` | `count` (default 2) |
| marabou    | `marabou` | |
| cdc        | `cdc` | (can be wound: barbs lengthen from tip to butt) |
| flash      | `krystal-flash`, `flashabou` | `count` |
| feather    | `mallard-breast` (breast), `hackle-tips`, `saddle-feathers` (tip), `teal-flank` (tied folded, like a slip), `duck-quill`, `starling-quill`, `turkey-quill` (slip) | |
| foam       | `foam`, `scud-back` | |
| bead       | `brass-bead`, `tungsten-bead`, `brass-cone`, `tungsten-cone` (cone heads) | `mm` (required; a cone's width at the back) |
| eyes       | `dumbbell-eyes`, `bead-chain-eyes`, `mono-eyes` | `mm` (required) |
| legs       | `rubber-legs`, `silicone-legs` | `count` (strands) |

The archetype decides how a material behaves and is drawn:

- **dubbing** is spun onto the thread with `dub`, never tied in.
- **beads** go on with `slide-bead` before the thread; **eyes** are tied in without a length.
- **hair** is tied in as a clump with `length`; its butts stick forward until trimmed. Hair
  can also be spun (`spin`) and trimmed into a head.
- **legs** (and strands of hair, fibres, biots or flash) can be tied **across** the shank
  with `side=across`: each strand is bound at its middle and sticks out `length` on both
  sides, leaning back by `angle`. `count` is the number of strands, so the legs per side.
- **chenille, yarn, foam** tied in with a `length` and `extended=#true` stick out as one
  solid piece (an extended body or a caddis larva) instead of a tuft; `tip=<colour>` colours
  its end (a larva's burnt head).
- **hair, feather, biot, marabou, flash, legs** stick out from where they are tied in, so
  they need a `length`. The exception is a feather slip that is later pulled over as a
  wing case (turkey on a Hare's Ear).
- **feather** wings: breast feathers lie over the body like a roof; hackle tips and quill
  slips stand on edge. With `spread`, they are a pair turned out to either side (an
  upright divided wing at `angle=90`, or slips along the sides of a wet fly).
- Windable materials (yarn, herl, hackle, cdc, wire, floss, tinsel, chenille, fibres) can be
  tied in without a length and then wound, or pulled over (`pull-over`).

## Steps

Steps run in order. The **thread position** is part of the tying state. Only
`attach-thread`, `wrap-thread`, `dub` and `spin` move it. Tie-ins, tie-offs and the whip finish
happen wherever the thread is, as they do at the vise.

Every step accepts `note="…"`, which is appended to the generated instruction text.

| Step            | Form                                              | Meaning |
|-----------------|---------------------------------------------------|---------|
| `slide-bead`    | `slide-bead <bead>`                               | Before the thread: slide a bead up to the eye. Wraps then stop behind it. |
| `weight`        | `weight <wire> from=<pos> to=<pos>`               | Wrap weighting wire in touching turns (before or after the thread). |
| `attach-thread` | `attach-thread at=<pos>`                          | Start the thread at `at`. |
| `wrap-thread`   | `wrap-thread to=<pos> [turns=<n>]`                | Move the thread to `to`. Without `turns` it lays touching turns; with `turns` it makes that many open turns. |
| `tie-in`        | `tie-in <material> [length=<gapes>] [angle=<deg>] [spread=<deg>] [width=<gapes>] [side=top\|under\|across] [forward=#true] [extended=#true] [tip=<colour>]` | Tie the material in at the thread. With `length`, it sticks out rearward by that much (tag, tail, wing), `angle` degrees above the shank; at 60° or more it stands upright (a wing post). `forward=#true` points it forward over the eye instead (antennae, feelers, a front-peeping larva). `side=across` ties strands across the shank as legs; `extended=#true` makes chenille, yarn or foam one solid piece (see above). `spread`: how far round the body a bunch fans out, in degrees either side of the top; for feathers, makes a pair. `width`: feather width (default by shape). `side=under`: under the shank (beards, throats, under-wings, eyes). Without `length`, a loose end hangs until the material is wound or pulled over. |
| `dub`           | `dub <material> to=<pos> [turns=<n>]`             | Spin dubbing onto the thread and wrap it to `to`; the thread ends there. |
| `wind`          | `wind <material> to=<pos> turns=<n> [counter=#true]` | Wind the material from its tie-in point to `to`. Forward: it ends at the thread. Rearward (palmering): it ends away from the thread and must be secured (see below). `counter=#true` winds it the opposite way round to what is under it (a counter-wound rib). |
| `wind` (parachute) | `wind <hackle> around=<post> turns=<n>`        | Wind a hackle horizontally round the base of an upright post; tie it off next. |
| `pull-over`     | `pull-over <material> to=<pos>`                   | Fold a material tied in at the rear forward over the top of the body (wing case, foam back, shellback) and tie it down at the thread, which must be at `to`. |
| `spin`          | `spin <hair> to=<pos> [collar=<gapes>]`           | Spin clumps of hair round the shank from the thread forward to `to`; the thread ends there. `collar` leaves the tips of the first clump trailing back. Trim it into a head with `trim … leave=`. |
| `tie-off`       | `tie-off <material>`                              | Secure a forward-wound material at the thread and trim the excess. |
| `trim`          | `trim <material> [leave=<gapes>] [shape=round\|wedge] [keep=sides\|top\|under]` | Cut off what sticks out: the tip of a palmered material, the butts of a hair clump (`leave` = length left standing; default flush), or spun hair into a head (`leave` = head thickness each side; `shape=wedge` leaves it flat underneath and deepest at the rear, `round` tapers it). `keep` trims a wound hackle: `sides` cuts it top and bottom, `top` cuts it underneath, `under` clips the top (a flat seat for a wing). |
| `whip-finish`   | `whip-finish [turns=<n>]`                         | Build the head, whip finish (default 5 turns) and cut the thread. |

### Tying rules (semantic validation)

- Beads go on before the thread; nothing else but weighting may come before `attach-thread`,
  which occurs once.
- A material is tied in once and wound at most once. Dubbing is only used with `dub`.
- Hair, feathers, biots, marabou, flash and legs need a `length`; feathers point back (no `forward`). `angle` needs a `length`. `spread` only applies
  to material tied in with a length (tags, tails, wings; for feathers it makes a pair);
  `width` only to feather wings.
- `wind … to` must differ from the tie-in point. A forward wind ends at the thread, where
  the material is then tied off.
- A forward-wound material is tied off in the very next step.
- A rearward-wound (palmered) material must be secured in the very next step, by winding
  another material forward from at or behind its tip, and its tip must be trimmed (before
  or after the whip finish).
- `trim` needs something to trim; `leave` only applies to hair butts, spun hair and foam backs.
- A parachute hackle needs a post: a bunch tied in upright (`angle` of 60° or more), not a
  feather pair, an extended body or strands tied across.
- `pull-over` needs the material tied in and unused, and the thread at `to`.
- Only hair is spun, only wire weights, only beads are slid on.
- `whip-finish` comes last; only `trim` may follow it (trimming heads and hackles), and every recipe has one.
- Materials have unique ids, and steps refer only to defined materials. Every listed
  material is used, and one tied in without a length is wound or pulled over (otherwise
  it would be left hanging).

### Proportions

Proportions are data in the recipe, never constants in the renderer, so they can be
corrected per pattern. The generated text states them the way a tyer measures: in
fractions of the gape, and for wings by where the tips end ("just past the end of the
bend"); on tubes and Waddingtons, which have no gape, in millimetres. When proportions
are taken from reference photos, say so in a comment.
