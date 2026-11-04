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
| `naturals`    | ids of the naturals it imitates (`naturals/*.kdl`), the main one first, e.g. `naturals mayfly-dun caddis-adult`; leave out for attractors | no |
| `fishes`      | `surface`, `film`, `below` or `deep`: where the fly fishes, for the water view. Leave out to derive it: dry flies and terrestrials float, emergers hang in the film (tail down), weighted flies (a bead, eyes other than mono, weighting, a copper or brass tube) go deep, others fish just under the surface. Streamers and saltwater flies are stripped, salmon flies swung across the current, the rest drift | no |
| `sits`        | `hackle`, `body` or `half`: how a floating fly sits on the film once fished a while, for the realistic water. `hackle`: on its hackle and tail with its belly in the film (a fished fly carries water), the lower fibres through it; `body`: its body half under, in the film, a wing or tail sloping back over it laid down until its tips rest on the water; `half`: six tenths under (a foam body or foam back), sloping wings laid down the same way. Leave out for the default: dry flies ride on their hackle, terrestrials lie with their body in the film, flies that fish in the film float half under. Only for a fly that floats; an emerger given `sits` lies level instead of hanging tail down. Choose it from photos of the fly on the water | no |
| `difficulty`  | `beginner`, `intermediate` or `advanced`          | yes      |
| `species`     | any of `trout grayling sea-trout salmon char bass panfish pike striped-bass bonefish permit` | no |
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
| `bass-bug`           | fine wire, wide gape, straight eye           | TMC 8089              |

A wide-gape hook has a wider gape than a standard hook of the same size (the TMC 8089's is
10.4 mm on a #10, against about 6 mm), so lengths in gapes, and a foam sheet's or a thread's
thickness, are measured by its own gape (`gapeMm` in `src/tying/hook.ts`).

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
pictures every point-up fly point up, as they are usually photographed.

## Colours

Either a named colour: `black`, `white`, `cream`, `red`, `fluo-red`, `fluo-green`, `brown`, `red-brown`,
`red-game`, `ginger`, `tan`, `grizzly`, `olive`, `grey`, `dun`, `yellow`, `green`, `gold`, `silver`,
`copper`, `bleached`, `elk`, `hares-ear`, `mallard`, `pheasant-tail`, `partridge`, `snipe`,
`lead`, `deer`, `squirrel`, `moose`, `tippet`, `crest`, `pearl`, `teal`, `turkey`, `badger`, `furnace`,
`blue-dun`, `purple`, `orange`, `pink`, `claret`, `chartreuse`, `coch`, `muskrat`, `clear`, `blue-black`, `blue`, `pardo`, `bronze-mallard`. Barred colours
(`grizzly`, `teal`, `partridge`, `mallard`, `snipe`, `turkey`, `bronze-mallard`) are drawn with bars, also across
each fibre of a tail or beard; `tippet` fibres get their black bar and black tip, and so does a
whole tippet feather across it. Wound hackles in `badger`, `furnace` or `coch` are drawn with
their black centre.
Or a quoted hex value: `"#c8102e"`.

A dyed grizzly is a colour with `barred=#true` on the material (hackles, fibres, feathers,
marabou): `hackle cock-hackle color=olive barred=#true fibre=1.4` is drawn olive with grizzly's
bars. `barred=#false` draws a barred colour plain. The dressing names the material by its
colour, so give it a `label` ("Grizzly cock hackle dyed olive").

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
| yarn       | `wool`, `poly-yarn`, `sparkle-yarn` (Antron; pulled over loosely with `bubble`, a translucent veil; pulled tight, a solid wing case) | |
| herl       | `peacock-herl`, `ostrich-herl` | `strands` (1–6, default 3; tied in with a length, that many strands stick out, with their flue: a topping) |
| hackle     | `cock-hackle`, `hen-hackle`, `saddle-hackle`, `partridge-hackle`, `snipe-hackle`, `guinea-fowl-hackle`, `golden-pheasant-flank` (folded and wound, an Usk Grub's tail) | `fibre` (required, gapes), `sweep` (degrees the barbs lean back; default from the kind), `barred` |
| dubbing    | `hares-ear-dubbing`, `dry-fly-dubbing`, `rabbit-dubbing`, `seals-fur`, `fox-dubbing`, `dubbing` | `shaggy` (0–1: how rough, from fine and tight to picked out with long guard hairs; default from the kind) |
| wire       | `gold-wire`, `copper-wire`, `silver-wire`, `lead-free-wire` | `mm` (diameter; default fine rib wire, or 0.38 for lead-free) |
| floss      | `rib-thread`, `silk-floss`, `monofilament` | `size` (thread size) |
| tinsel     | `flat-tinsel`, `oval-tinsel` | |
| chenille   | `chenille` | `mm` (diameter as sold; default medium chenille, about a body half the gape thick) |
| hair       | `elk-hair`, `deer-hair`, `calf-tail`, `bucktail`, `squirrel-tail`, `moose-mane`, `fox-hair` | `count` (hairs, up to 200: legs tied across, a few hairs as a tail, or a sparse wing; without it a bunch is a clump that grows with its length), `mix` |
| fibres     | `pheasant-tail`, `hackle-fibres`, `golden-pheasant-tippet`, `golden-pheasant-crest`, `hares-mask-guard-hairs`, `synthetic-hair`, `craft-fur`, `coq-de-leon`, `peacock-sword` (with flue), `wood-duck-flank` | `count`, `barred`, `mix` |
| biot       | `goose-biot` | `count` (default 2) |
| marabou    | `marabou` | `barred` |
| cdc        | `cdc` | `fibre` (gapes: the longest barbs wound, near the butt; default 0.6), `sweep` (degrees they lean back; default 45). Can be wound: barbs lengthen from tip to butt |
| flash      | `krystal-flash`, `flashabou` | `count` |
| feather    | `mallard-breast` (breast), `hackle-tips`, `saddle-feathers`, `golden-pheasant-body` (the cock's small red body feathers, as cheeks) (tip), `golden-pheasant-tippet-feather` (a whole tippet feather, barred black near its end) (breast), `teal-flank` (tied folded, like a slip), `bronze-mallard`, `duck-quill`, `starling-quill`, `turkey-quill`, `hen-pheasant-quill` (slip), `jungle-cock` (eye) | `barred` |
| foam       | `foam`, `scud-back` | `mm` (the sheet's thickness, as sold; drawn that thick pulled over) |
| bead       | `brass-bead`, `tungsten-bead`, `brass-cone`, `tungsten-cone` (cone heads), `split-shot` (crimped behind the eye, painted with eyes) | `mm` (required; a cone's width at the back) |
| eyes       | `dumbbell-eyes`, `bead-chain-eyes`, `mono-eyes` | `mm` (required) |
| legs       | `rubber-legs`, `silicone-legs` | `count` (strands) |
| strip      | `rabbit-strip` (a zonker strip: fur on the hide) | `fibre` (the fur's length, gapes; default 18 mm), `mm` (the strip's width, as sold; default 3), `tuft` (the fur clipped off the hide but for a tuft over this much of its end, gapes: a Morrish Mouse's bare tail) |
| tubing     | `mylar-tubing` (braided, slid over the body, or a piece tied in as a frayed tail) | |

The archetype decides how a material behaves and is drawn:

- **dubbing** is spun onto the thread with `dub`, never tied in.
- **beads** go on with `slide-bead` before the thread; **eyes** are tied in without a length.
- **a blended bunch** (`mix="yellow black"` on hair or fibres): up to three more colours, named or
  hex, mixed evenly through the bunch with its `color`, as a tail or wing of mixed bucktail is,
  rather than laid in layers (for layers, tie in a bunch of each colour, one over the other). The
  dressing names every colour (the material's own shade as "natural" when it has no named
  colour), and the inventory needs each. It shows only in a bunch: tied in with a length (not
  across), spun or glued, or as a needle body's tails; wound, pulled over or tied across it is
  refused, and the builder leaves the blend out when a part is tied that way.
- **jungle cock** eyes are small, round-ended feathers, dark with a row of cream enamel spots, each
  with a buff tip; tied in as a pair with `spread` they sit as cheeks either side of a wing.
- **hair** is tied in as a clump with `length`; its butts stick forward until trimmed. The clump
  leaves the tie-in as one tight bundle at `angle`, its hairs lying over one another so it is
  fullest about two thirds of the way along, and fans out towards the tips: `spread` says how
  far round the body its roots lie and, as before, how far its tips fan out (they now get there
  gradually, not in a straight fan from the tie-in). How it bends comes from the material's
  stiffness in the catalog (also on `craft-fur`, `synthetic-hair` and `hares-mask-guard-hairs`):
  soft hair (squirrel, fox, craft fur) bends down towards the body along its length, lying on it
  over the shank, and its tips are uneven, as unstacked hair's are; stiff hair (elk, deer, moose)
  stays nearly straight, its tips level, and flares at the tie-in. A soft wing therefore wants a
  steeper `angle` than a stiff one to end at the same height. Spun, glued, trimmed and upright
  hair, and hair tied across, are drawn as before. Tied in
  pointing forward (`forward=#true`), its butts lie back along the shank under the turns, cut
  square first, with nothing to trim. Hair can also be spun (`spin`) and trimmed into a head.
- **hair folded back** (a bullet head): tied in pointing forward over the eye, spread all round
  (`spread=180`), and laid back with `pull-over … to=` behind where it is tied in, the thread
  waiting there, it lies all round the shank from the tie-in to the tie-down, as a smooth head.
  It is as long behind where it was tied in as it was in front, so its tips trail back from the
  tie-down. Thread spiralled back over them (`wrap-thread` to a smaller position) binds them
  along the body, and on past the bend (`to` below 0) round nothing but the hair, as an extended
  body; bunches tied in pointing back along there (a tail) are bound inside it and leave it at
  its end. `trim … leave=` then cuts the tips behind the last turn (a Paradrake).
- **strips** (fur on the hide) tied in with a `length` stick out as a flat strip with the fur
  on top leaning back towards its end (a Zonker's or a Bunny Leech's tail); the rest of the strip
  can then be pulled over the back with `pull-over` and tied down in front, lying taut on top of
  the body between the two tie-downs, its fur standing over the back. A strip is trimmed after it
  is tied down, like foam.
- **a strip cut to a width** (`width` on a tie-in without a length, of something pulled over
  later, foam above all) lies flat over the body that wide instead of wrapping round it, its
  edges bending down a little past the body's sides; `taper=#true` cuts it to a point at the end
  tied in, widening to `width` where it is tied down (a Morrish Mouse's back). Foam pulled
  forward can have its end folded back over itself in front of the tie-down (`fold`), doubled as
  a block of a head, and tied down again there.
- **spun hair trimmed to a shape** (`trim … shape=`) is what a material wound on afterwards lies on
  (a Bomber's hackle, tied in at the bend before the hair is spun and palmered forward through the
  clipped body); round, a cigar or a cone, it can be cut closer underneath with `below=<gapes>`,
  reaching that far below the shank against `leave` above it and less at the sides, round about a
  line above the shank (a Bomber's, a third below and two thirds above, clear of the barb).
- **two materials wound together** (`wind … with=<material>`): held side by side and wound as one
  in the same pass, forward or palmered back, the second tied in right after the first at the same
  place (a Claret Bumble's claret and black hackles, palmered together and both held by the rib).
  Wound forward, both are tied off next; palmered, the winding forward that holds one tip holds
  both, and both tips are trimmed.
- **spun hair cut flat** (`trim … keep=`): `keep=sides` cuts it flat on top and underneath,
  `leave` from the shank's axis (default 0.3 gape), leaving the hair at the sides as long as it
  was spun (`spin … length=`); `keep=top` cuts only underneath, `keep=under` only on top, and
  these cuts can follow one another. What is pulled over it later lies on the flat top, coming
  down to the shank at its ends, where the thread ties it down.
- **tubing** is slid over the eye and along the body with `sleeve`, tied down at the thread, and
  its other end tied down later with `tie-off`. It is drawn as a braided tube stretched over what
  is under it, pressing flat the fibres of what it covers. The only other way it goes on is a
  piece tied in with a `length` (a Gotcha's tail): its core pulled out and picked apart, it sticks
  out as a bunch of loose metallic strands, and is then done with (not wound or pulled over).
- **legs** (and strands of hair, fibres, biots or flash) can be tied **across** the shank
  with `side=across`: each strand is bound at its middle and sticks out `length` on both
  sides, leaning back by `angle`. `count` is the number of strands, so the legs per side.
  `fan=<degrees>` fans them fore and aft over that much in all, the rear strand leaning back
  most and the front one forward (a crab's legs, a folded piece of three strands parted).
- **a body glued on** (`glue <material> from= to= [length=]`, hair, synthetic fibres or yarn):
  flattened pads laid across the shank into glue, on top and underneath, their fibres standing
  out `length` to each side and stacked about seven tenths as thick, with no thread, so it can
  come after the whip finish. It is trimmed like spun hair: `trim … shape=disc leave=` clips it
  round in plan as far as the fibres stand out and flat top and bottom `leave` from the shank (a
  crab's body), or `keep` cuts it flat as it does spun hair; the other shapes, made for hair spun
  round the shank, don't apply.
- **chenille, yarn, foam** tied in with a `length` and `extended=#true` stick out as one
  solid piece (an extended body or a caddis larva) instead of a tuft; `tip=<colour>` colours
  its end (a larva's burnt head); `width` is its thickness at the front.
- **a body made on a needle** (a Mohican Mayfly's) is an extended tie-in with `segments=<n>`:
  a strip folded round a needle and bound into that many round segments, the thread pinching a
  waist between each, tapering a little to its end. It is made off the hook and tied on in one
  step, by its front segment. `tails=<material>` names fibres tied in at the needle's tip first
  (hair, fibres or biots; that material has no step of its own), coming out of the body's end
  `tail-length` gapes long and splayed `tail-spread` degrees to each side. The two ends of the
  strip lie forward from the tie-in; a later `pull-over` brings them forward over the thorax
  (with `around=<post>`, one down each side of the wing) and a `trim … leave=` leaves a head.
- **an upright bunch** with `fan=<degrees>` fans out fore and aft along the shank, narrow
  across it (a Mohican's deer-hair wing), instead of standing as a round post; it is still a
  post for a parachute.
- **hair, feather, biot, marabou, flash, legs** stick out from where they are tied in, so
  they need a `length`. The exception is a feather slip that is later pulled over as a
  wing case (turkey on a Hare's Ear).
- **feather** wings: breast feathers lie over the body like a roof; hackle tips and quill
  slips stand on edge. With `spread`, they are a pair turned out to either side (an
  upright divided wing at `angle=90`, or slips along the sides of a wet fly).
- **a feather laid flat** (`flat=#true`, a single feather tied in with a length): any feather lies
  face up over the back (or under the belly, with `side=under`), curving down over the sides,
  rather than on edge, at its `angle`; one tied in further forward is raised just enough to lie
  over those laid flat behind it, like roof tiles (a General Practitioner's shell). `notch=<gapes>`
  cuts a V that deep out of a feather's tip first, leaving two points (its tippet eyes); a
  notched feather is cut square across its broad end, so the points stand at its edges.
- **hair folded back where it is tied in** (a Temple Dog's last wing section): tied in pointing
  forward with a length (`forward=#true`), then `pull-over … to=` the place it was tied in, the
  thread there: it lies back at the angle it stood forward, doubled over its roots, held up by a
  small wall of thread turns in front of it.
- **a cone pushed on last** (a tube fly): on a tube, `slide-bead` may come after the final whip
  finish, the cone pushed onto the liner in front of the tube and held by melting the liner's
  end. It sits in front of the tube rather than taking room on it; after it only trims (or a body
  glued on) may follow.
- Windable materials (yarn, herl, hackle, cdc, wire, floss, tinsel, chenille, fibres) can be
  tied in without a length and then wound, or pulled over (`pull-over`).

## Steps

Steps run in order. The **thread position** is part of the tying state. Only
`attach-thread`, `wrap-thread`, `dub` and `spin` move it. Tie-ins, tie-offs and the whip finish
happen wherever the thread is, as they do at the vise.

Every step accepts `note="…"`, which is appended to the generated instruction text. It can also take
`mistake="…"`: a mistake typical of this step in this pattern, shown first under "Common
mistakes", before the general ones of the step's technique. Cite where it comes from in a comment.

| Step            | Form                                              | Meaning |
|-----------------|---------------------------------------------------|---------|
| `slide-bead`    | `slide-bead <bead>`                               | Before the thread: slide a bead up to the eye. Wraps then stop behind it. On a tube, also after the whip finish: pushed onto the liner in front of the tube (see above). |
| `weight`        | `weight <wire> from=<pos> to=<pos>`               | Wrap weighting wire in touching turns (before or after the thread). |
| `attach-thread` | `attach-thread at=<pos>`                          | Start the thread at `at`. |
| `wrap-thread`   | `wrap-thread to=<pos> [turns=<n>]`                | Move the thread to `to`. Without `turns` it lays touching turns; with `turns` it makes that many open turns. Back over the tips of hair folded back, it binds them down as it goes; `to` below 0 (down to -1, a shank length behind the bend) takes it on past the bend over that hair, as an extended body (see above), and open turns forward again cross the first. |
| `tie-in`        | `tie-in <material> [length=<gapes>] [angle=<deg>] [spread=<deg>] [width=<gapes>] [taper=#true] [fan=<deg>] [side=top\|under\|across] [forward=#true] [extended=#true] [tip=<colour>] [segments=<n>] [tails=<material> tail-length=<gapes> [tail-spread=<deg>]] [flat=#true] [notch=<gapes>]` | Tie the material in at the thread. With `length`, it sticks out rearward by that much (tag, tail, wing), `angle` degrees above the shank; at 60° or more it stands upright (a wing post). `forward=#true` points it forward over the eye instead (antennae, feelers, a front-peeping larva), sloping up at `angle` (a Bomber's wing at 45°). `side=across` ties strands across the shank as legs; `extended=#true` makes chenille, yarn or foam one solid piece (see above). `spread`: how far round the body a bunch fans out, in degrees either side of the top (a bunch of hair leaves the tie-in together and fans out towards its tips; see **hair** above); for feathers, makes a pair. `width`: feather width (default by shape), an extended body's thickness at the front, or how wide a strip to be pulled over is cut (`taper=#true`: to a point at the end tied in; see above). `fan`: an upright bunch, or strands tied across, fanned fore and aft over that many degrees in all. `segments`, `tails`, `tail-length`, `tail-spread`: an extended body made on a needle (see above). `flat`: a feather laid flat over the back; `notch`: a V cut out of a feather's tip (see above). `side=under`: under the shank (beards, throats, under-wings, eyes); without a length, a strip tied in underneath to be pulled over the belly (a sparkle pupa's lower sheath). Without `length`, a loose end hangs until the material is wound or pulled over; with `forward=#true` too, a strip waits sticking out over the eye, to be folded back with `pull-over` (a foam balloon). |
| `dub`           | `dub <material> to=<pos> [turns=<n>]`             | Spin dubbing onto the thread and wrap it to `to`; the thread ends there. `turns` sets how many turns it takes: fewer than the default (about touching) for a slim body, the silk showing through a sparse one. |
| `wind`          | `wind <material> to=<pos> turns=<n> [counter=#true] [with=<material>]` | Wind the material from its tie-in point to `to`. Forward: it ends at the thread. Rearward (palmering): it ends away from the thread and must be secured (see below). `counter=#true` winds it the opposite way round to what is under it (a counter-wound rib). `with` winds a second material together with it in the same pass, side by side (see above). |
| `wind` (parachute) | `wind <hackle> around=<post> turns=<n>`        | Wind a hackle horizontally round the base of an upright post; tie it off next. |
| `pull-over`     | `pull-over <material> to=<pos> [bubble=<gapes>] [wing=<gapes>] [around=<post>] [fold=<gapes>]` | Fold a material tied in at the rear forward over the top of the body (wing case, foam back, shellback) and tie it down at the thread, which must be at `to`. `bubble` leaves it loose, arching that many gapes over the middle of what it covers (a CDC pupa's bubble). `wing` stands the tips of hair pulled forward up in front of the tie-down as a divided wing that long (a Humpy's hump and wings from one bunch). A fur strip tied in with a `length` keeps that much behind as its tail while the rest is pulled over (a Zonker); so does the strip of a body made on a needle, its ends pulled over. `around` parts it round an upright post it passes, one half down each side (a Mohican's foam either side of the wing). `fold`: foam pulled forward, its end folded back over itself in front of the tie-down as a head that long, and tied down again there (a Morrish Mouse's head); a later `trim` cuts what is left of the end at the tie-down. With `to` where hair tied in pointing forward was tied in, fold it back there, held by a wall of thread (see above). With `to` behind where it is tied in, lay it back instead (a shellback tied in at the eye and taken back to the bend): its end is held by the next step, a winding forward over it, as a palmered tip is; or, when the thread is waiting at `to`, the thread ties it down there (a foam balloon folded back over the thorax). |
| `sleeve`        | `sleeve <tubing> to=<pos> [fray=<gapes>]`         | Slide braided tubing over the eye and along the body, so it reaches from the thread to `to`, and tie it down at the thread; its other end is tied down later with `tie-off <tubing>`, with the thread there. `fray` picks its rear end apart into loose strands that long, a short flash tail (a Zonker's). |
| `glue`          | `glue <material> from=<pos> to=<pos> [length=<gapes>]` | Glue pads of hair, synthetic fibres or yarn along the shank from `from` to `to`, laid across it, on top and underneath, standing out `length` (default 0.7) to each side. No thread is needed or moved, so it may follow the whip finish. Trim it to shape with `trim` (`shape=disc` for a crab). |
| `spin`          | `spin <hair> to=<pos> [collar=<gapes>] [length=<gapes>]` | Spin clumps of hair round the shank from the thread forward to `to`; the thread ends there. `collar` leaves the tips of the first clump trailing back. `length`: how far the hair stands out, each clump cut to length first (default 0.7). Trim it into a head with `trim … leave=`, or cut it flat with `trim … keep=`. |
| `weave`         | `weave <top> under=<belly> to=<pos> [turns=<n>]`  | Weave two strands (chenille, yarn or floss) tied in together forward to `to`: `top` crosses back and forth over the top of the shank only, `under` over it and right round underneath, so one colour is the back and the other the belly, meeting along each side in a toothed line (a Bitch Creek's abdomen). `turns` counts the crossings (default one per strand width). The thread is cut for the weave (a `whip-finish` before it, then `attach-thread` at `to`) or parked at `to`; both strands are then tied off there with `tie-off`. |
| `tie-off`       | `tie-off <material>`                              | Secure a forward-wound material at the thread and trim the excess; or tie down a sleeve's other end, or a woven strand's. |
| `trim`          | `trim <material> [leave=<gapes>] [shape=round\|wedge\|cigar\|cone\|disc] [keep=sides\|top\|under] [below=<gapes>]` | Cut off what sticks out: the tip of a palmered material, the butts of a hair clump (`leave` = length left standing; default flush), the tips of hair folded back, behind its tie-down or the last turn over them (`leave` = a flared stub), or spun hair into a head (`leave` = head thickness each side; `shape=wedge` leaves it flat underneath and deepest at the rear, `round` tapers it, `cigar` makes it fullest in the middle and rounded at both ends, for a body, `cone` slim at the tail and full at the front, `disc` round in plan as far as the hair or fibres stand out and flat top and bottom `leave` from the shank, for a crab). Glued fibres are trimmed to a `disc` or cut flat with `keep`. `keep` trims a wound hackle: `sides` cuts it top and bottom, `top` cuts it underneath, `under` clips the top (a flat seat for a wing); spun hair the same way, cut flat `leave` from the shank, the sides left long (see above). `below`: spun hair trimmed round, to a cigar or a cone cut closer underneath, that far below the shank (see above). |
| `whip-finish`   | `whip-finish [turns=<n>]`                         | Build the head, whip finish (default 5 turns) and cut the thread. Part-way through, followed by `attach-thread` elsewhere, it finishes what is tied so far there (a Zonker's rear, finished at the bend before the thread is started again behind the eye). |

A `turns` is at most 100, a recipe has at most 150 steps and 40 materials: far beyond any
pattern, they bound the work of drawing a recipe that arrives in a link. The fly builder
also stops drawing a fly past 600 turns of material or 3000 of thread in all, as the simulation
lays them (touching turns included); the patterns lay at most 115 and 664.

### Tying rules (semantic validation)

- Beads go on before the thread and before any weighting; nothing else but weighting, or a body
  glued on and trimmed, may come before `attach-thread`. On a tube a cone or bead may instead be
  pushed on after the final whip finish, and then only trims (or gluing on) follow it. The thread is attached again only after a whip finish.
- Only tubing is slid on with `sleeve`, and tubing is tied in only with a `length`, as a frayed
  tail; a sleeve reaches from the thread to another place, and its other end is tied down
  (`tie-off`) where the thread is.
- Only chenille, yarn and floss are woven, two different strands tied in at the same place
  without a length and not yet used, forward from where they are tied in. With the thread on the hook, it waits at
  `to`; cut before the weave, it is attached again at `to`. Both strands are tied off next,
  with nothing else in between.
- A material is tied in once and wound at most once. Dubbing is only used with `dub`.
- Hair, feathers, biots, marabou, flash and legs need a `length`; feathers point back (no `forward`). `angle` needs a `length`. `spread` only applies
  to material tied in with a length (tags, tails, wings; for feathers it makes a pair);
  `width` only to feather wings and extended bodies.
- `wind … to` must differ from the tie-in point. A forward wind ends at the thread, where
  the material is then tied off.
- A forward-wound material is tied off in the very next step.
- A rearward-wound (palmered) material must be secured in the very next step, by winding
  another material forward from at or behind its tip, and its tip must be trimmed (before
  or after the whip finish).
- A material wound `with` another is a different, windable material tied in at the same place
  and not yet used; not round a post. Wound forward together, both are tied off in the next two
  steps; palmered together, the one securing winding holds both tips, and each is trimmed.
- `below` only applies to spun hair (or butts spun round) trimmed round, to a cigar or to a cone.
- `trim` needs something to trim; `leave` only applies to hair butts, spun hair, glued fibres, foam
  backs and fur strips. `keep` applies to a hackle wound and tied off (once), or to spun hair or
  glued fibres until they are trimmed to a shape; `shape` to spun hair, glued fibres and hair butts.
  Glued fibres are trimmed only to `shape=disc` or with `keep`; a disc is trimmed only from spun
  hair or glued fibres, not hair butts.
- `flat` only applies to a feather tied in with a length, on its own (no `spread`) and not across;
  `notch` to a feather tied in with a length, less deep than it is long.
- `pull-over` to where it was tied in only folds back hair tied in pointing forward with a length,
  without `bubble`, `wing`, `around` or `fold`, the thread there.
- `width` on a tie-in without a length only applies to a strip pulled over later (not hair), and
  `taper` only to such a strip given a width. `fold` only applies to foam pulled forward, without
  `bubble` or `around`.
- `segments`, `tails`, `tail-length` and `tail-spread` only go with `extended=#true`; tails are
  hair, fibres or biots, not tied in elsewhere, and need a `tail-length`. `fan` only applies to an
  upright bunch (not a feather pair) or to strands tied across.
- `pull-over … around=` parts a strip pulled forward round an upright bunch tied in between
  where the strip is tied in and where it is tied down.
- A parachute hackle needs a post: a bunch tied in upright (`angle` of 60° or more), not a
  feather pair, an extended body, a fur strip or strands tied across.
- `pull-over` needs the material tied in and unused, and, pulled forward, the thread at `to`;
  laid back, the very next step winds another material forward from at or behind its end, or
  the thread waits at `to` and ties it down there.
- The thread goes past the bend (`wrap-thread to` below 0) only over hair folded back and tied
  down there, its tips not yet trimmed; there it only winds on or back (a trim may come
  between), nothing is tied in, off or finished past the bend. Spiralled back over such hair,
  on the shank or past the bend, the thread goes only as far as the hair reaches, its tips
  still sticking out 0.15 gape behind the last turn (the hair is as long behind where it was
  tied in as it was in front).
- Colours mixed into a material (`mix`) need it tied as a bunch: with a length and not across the
  shank, spun or glued; never wound or pulled over.
- Only hair is spun, only wire weights, only beads are slid on. Only hair, fibres and yarn are
  glued, forward from `from` to `to`, once.
- `whip-finish` comes last; only `trim` may follow it (trimming heads and hackles), `glue` (a body
  glued on), or `attach-thread` to
  carry on with the thread started again (with a `weave` in between, when the weave is done with
  the thread cut), and every recipe ends with one.
- Materials have unique ids, and steps refer only to defined materials. Every listed
  material is used, and one tied in without a length is wound or pulled over (otherwise
  it would be left hanging).

Each rule has a key in `src/recipe/rules.ts` (with its English wording for authors); its
error carries the key and its values, so the fly builder says it to visitors in the page's
language (`src/i18n/rules/`). A new rule needs its message in every language there. The
rules about what is left to do (`neverTiedOff`, `sleeveOpen`, `trimTip`, `neverUsedAfterTieIn`,
`neverUsed`, `endWithWhipFinish`) mark a fly as unfinished rather than wrong.

### Visitors' own flies

The fly builder (`/build/`) writes the same recipes, kept in the visitor's browser and
shared as links. Their ids start with `my-`, and their materials' ids are parts the patterns
already use, which the glossaries name in every language. The builder keeps a pattern's whip
finish part-way (the thread brought to where it is finished, if it is moved first) and the
thread started again (a Zonker's, a Bitch Creek's), a sleeve as a part slid over the body, a
woven body as one part of two strands, the top's first, a body made on a needle as an extended
part of its strip and its tails, the strip's ends perhaps pulled over (round a post) and
trimmed, spun hair cut flat (`keep`), a body glued on after the whip finish and clipped, a strip pulled over cut to a width and taper and folded
as a head, two hackles palmered (or wound forward) together, spun hair clipped closer underneath, a thread body's passes with their
open turns, also behind the bend (a Paradrake's binding), a dubbed body's turns, a piece of tubing
tied in as a frayed tail, feathers laid flat over the back or cut into a V, hair folded back where
it is tied in, and a cone pushed onto a tube after the whip finish. A fly the builder can't show
(an unknown material, colour, hook or step) is refused when it is opened from a link or a
file.

### Proportions

Proportions are data in the recipe, never constants in the renderer, so they can be
corrected per pattern. The generated text states them the way a tyer measures: in
fractions of the gape, and for wings by where the tips end ("just past the end of the
bend"); on tubes and Waddingtons, which have no gape, in millimetres. When proportions
are taken from reference photos, say so in a comment.

## Naturals

A natural (`naturals/<id>.kdl`) is something patterns imitate: an insect at one stage of its
life, a shrimp, a small fish. It is described like a pattern so the same renderer can draw
it beside a fly, and it carries the hatch calendar's months. Patterns refer to it by id in
`naturals`.

```kdl
id mayfly-dun
name "Mayfly dun"
group mayfly                 // mayfly caddis stonefly chironomid damselfly terrestrial baitfish crustacean leech
stage dun                    // nymph larva pupa emerger dun spinner adult juvenile
examples "olives (Baetis), blue-winged olive (Serratella)"
description "The newly hatched mayfly: …"
size min=6 max=11            // body length in mm, tails and antennae left out
rides on-surface             // on-surface in-film drifting swimming crawling
sits feet                    // on the surface: feet (the default; belly just over the film), body (two fifths in it), spent (flat in it); legs rest on the film
curve -14                    // degrees the body bends along its length (a shrimp's C: 110)
body {
    // Rear to front; lengths are fractions of the body length and add up to 1.
    abdomen length=0.62 radius=0.055 taper=0.55 segments=10 color="#6b6a34" belly="#c9c39a"
    thorax length=0.27 radius=0.075 taper=0.9 color="#5c5a32"
    head length=0.11 radius=0.055 taper=0.7 color="#4a4428"
}
parts {
    tails count=2 length=1.0 spread=35 color=dun
    wings count=2 shape=upright length=0.95 width=0.5 color=dun clarity=0.25 veins=#true
    legs count=6 length=0.55 color="#6a6040"
    eyes size=0.035 color=black
}
hatches {
    southern-sweden from=april to=october time="midday" note="…"
}
sources {
    "Wikipedia: Mayfly" url="https://en.wikipedia.org/wiki/Mayfly"
}
```

Body sections take `length` and `radius` (fractions of the body length), `taper` (the end's
radius relative to the start's), `segments` (rings), `color` and `belly`, `flatten` (height
over width: below 1 flat like a stonefly nymph, above 1 narrow like a fish or a shrimp),
`translucency` (0–1), `round` (0 a straight taper, 1 egg-shaped), `hairs` (0 smooth – 1 furry)
and `marks` (`bands`, `spots`, `mottle`, `stripe`) drawn in an `ink` colour. A fish's sections
can give `top` and `bottom` instead: half heights above and below the centre line, for an arched
back over a flatter belly. All lengths in `parts` are fractions of the body length:

| Part | Properties |
|---|---|
| `tails` | `count` 1–3, `length`, `spread` (degrees between the outer ones), `color`, `leaf=#true` for flat tail gills, `hairs` (0–1, fringes), `middle` (with three, the middle one's length relative to the outer two), `banded` |
| `wings` | `count` 2 or 4, `shape` (`upright`, `tent`, `flat`, `spent`, `back`), `length`, `width`, `color`, `clarity` (0 opaque – 1 clear), `veins`, `hind` (hind wing length as a fraction of the fore wing's; 0 none), `hairs` (0–1, a caddis's haired wings), `mottle` (colour of darker flecks), `angle` (an upright wing's lean back from straight up; a tent's or flat wing's slope from level) |
| `legs` | `count` (default 6), `length`, `color`, `at` (the body section; default the thorax), `hind` (the last pair's length relative to the rest), `femur` and `tibia` (fractions of the leg; the foot is the rest; defaults 0.38 and 0.34), `hairs` (0–1, swimming fringes), `banded=#true`, `tarsi` (foot segments, 1–5), `claws` (default on), `pose` (`stand`, `forward`, `raised`, `sprawl`, `folded`, `rowing`, `trailing`, `jumping`; default from where the natural is found), `thick`. With `pair` (`fore`, `mid`, `hind`) an entry is one pair of two legs, replacing that pair of an all-pairs entry |
| `antennae` | `length`, `color`, `swept=#true` to lay them back along the body, `shape` (`thread`, `elbowed`, `clubbed`, `plumed`), `segments`, `banded` |
| `gills` | `count` (pairs along the abdomen), `length`, `color`, `shape` (`plate`, `feather`, `tuft`), `banded` |
| `tusks` | `length`, `color` (a burrowing mayfly nymph's mandibles) |
| `wingpads` | `length`, `color` |
| `case` | `material` (`sand`, `gravel`, `plant`), `length`, `radius`, `color` |
| `shuck` | `length`, `color` (an emerger's trailing skin) |
| `eyes` | `size`, `color`; a fish's `iris` and `pupil`; `turbinate` (the colour of a male Baetis's raised upper eyes); `ocelli=#true` |
| `fin` | `kind` (`dorsal`, `caudal`, `pectoral`, `pelvic`, `anal`, `adipose`), `at` (its front end, 0 rear – 1 front), `base` (along the body; a tail fin's root depth) and `height` (out from the body; a tail fin's length), or `size` for both, `rays`, `spines` (the stiff front rays), `shape` (`rounded`, `pointed`, `forked`, `truncate`, `emarginate`), `clarity` (0 opaque – 1 clear between the rays), `spread` (paired fins: degrees out from lying back along the body), `color` |
| `pronotum` | `length`, `width`, `color` (the plate over the front of the thorax) |
| `prolegs` | `count` (pairs), `at` (section; default the abdomen), `where` (`along`, `front`, `rear`), `length`, `hooks=#true` (a caddis larva's anal claws), `color` |
| `mark` | `section`, `kind` (`bands`, `spots`, `streaks`, `rows`, `ring`, `stripe`, `mottle`, `patch`, `bars`), `segments` (`all`, `7` or `7-9`, counted from the section's front), `side` (`top`, `sides`, `under`, `all`), `count` (repeats over the range instead of one a segment, for a fish's marks), `at` (one mark centred there, 0 rear – 1 front of the section), `offset` (shifted by this fraction of its repeat: spots between bars), `color`; as many as needed |
| `horns` | `length`, `color` (a pupa's breathing horns on the thorax) |
| `scales` | `size` (fraction of the body length), `shine` (0 matt – 1 mirror) |
| `lateral-line` | `height` (−1 belly – 1 back), `color` |
| `gill-cover` | `at` (its rear edge), `color` |
| `mouth` | `position` (`terminal`, `superior`, `inferior`), `size` |

`hatches` gives, per region (`southern-sweden`, `northern-scandinavia`, `british-isles`,
`central-europe`, `northern-usa`), the months a natural hatches or is most about (`from`,
`to`; January to December for all year), with an optional `time` of day and `note`. Mark
months that are an estimate rather than a source's in the note ("Estimate: …").

`references` lists photos of the real animal for checking proportions, as for patterns:
`pnpm refcheck <natural>` renders it from the side on a grid in tenths of its body length beside
them. They are never committed and are left out of the build.

