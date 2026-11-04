/**
 * The materials catalog. Recipes refer to these ids, which gives every material a
 * stable identity for search, the inventory and "tie with what I have".
 *
 * The archetype says how a material behaves and is drawn, and which recipe
 * properties it takes (see ARCHETYPE_PROPS):
 *   yarn      wool, poly yarn (tags, posts, bodies)
 *   herl      peacock herl
 *   hackle    cock, hen, saddle and game-bird hackles (wound; soft ones sweep back)
 *   dubbing   fur and synthetic dubbing (applied with `dub`, never tied in)
 *   wire      metal wire (ribs, wire bodies, weighting)
 *   floss     thread and floss (ribs, bodies)
 *   tinsel    flat and oval tinsel (ribs, bodies)
 *   chenille  chenille (bodies)
 *   hair      elk, deer, calf, bucktail, squirrel (wings, posts, spun heads)
 *   fibres    tail fibres (pheasant tail, hackle fibres, tippets)
 *   biot      goose and turkey biots (forked tails, wings)
 *   marabou   marabou (tails, wings)
 *   cdc       cul de canard (wings)
 *   flash     Krystal Flash, Flashabou
 *   feather   whole feathers or slips as wings (shape: breast, tip, slip), jungle cock eyes
 *   foam      closed-cell foam (backs, wing cases)
 *   bead      beads and cone heads slid onto the hook
 *   eyes      dumbbell and bead-chain eyes
 *   legs      rubber and silicone legs (tied across the shank, or as tails and antennae)
 *   strip     fur on the hide, cut in strips (zonker strips): a tail, and pulled over the back
 *   tubing    braided tubing slid over the body as a sleeve (Mylar tubing)
 */

export const ARCHETYPES = [
  "yarn", "herl", "hackle", "dubbing", "wire", "floss", "tinsel", "chenille", "hair",
  "fibres", "biot", "marabou", "cdc", "flash", "feather", "foam", "bead", "eyes", "legs", "strip", "tubing",
] as const;
export type Archetype = (typeof ARCHETYPES)[number];

/** breast: a roof over the body; tip: a hackle tip; slip: a quill slip; eye: a jungle cock eye. */
export type FeatherShape = "breast" | "tip" | "slip" | "eye";

export interface CatalogMaterial {
  name: string;
  archetype: Archetype;
  /** Named or hex colour used when the recipe gives none. Without it, `color` is required. */
  defaultColor?: string;
  /** Hackles: how far the fibres lean back from upright, in degrees, when wound. */
  sweep?: number;
  /**
   * Hackles: barbs along each mm of the stem, both sides together. A turn carries as many as the
   * stem it takes, so a turn round a thick body carries more than one round a bare shank.
   */
  barbsPerMm?: number;
  /** Feathers: the outline of the wing. */
  shape?: FeatherShape;
  /** Tinsel: oval tinsel is round in section, flat tinsel is a ribbon. */
  oval?: boolean;
  /** Strips pulled over the body (foam, scud back): thickness in gapes. */
  thickness?: number;
  /** Fibres: how many times broader each one is than a hackle fibre (tippet barbs are broad and flat). */
  fibreWidth?: number;
  /** Fibres with flue along them, fluffy like herl (peacock sword). */
  flue?: boolean;
  /** Pulled over loosely (`bubble`), a sparse translucent veil the body shows through (sparkle yarn). */
  veil?: boolean;
  /** Dubbing: how rough it is, from 0 (fine, tight) to 1 (long, spiky guard hairs). Default 0.4. */
  shaggy?: number;
  /** Beads: a cone head, wide at the back and narrow towards the eye. */
  cone?: boolean;
  /** A split shot: crimped onto the shank behind the eye rather than slid on, its eyes painted. */
  shot?: boolean;
  /** Fur strips: how long the fur on the hide is, in mm (a recipe's `fibre` overrides it, in gapes). */
  furMm?: number;
  /** Fur strips: how wide the strip is cut, in mm (a recipe's `mm` overrides it). */
  widthMm?: number;
  /**
   * Hair and hair-like fibres tied in as a bunch with a length: how stiff each hair is, from 0
   * (soft and wispy: a wide, unruly fan of fine, wavy tips, uneven as unstacked hair's are) to
   * 1 (stiff: straight, orderly hairs, their tips level as stacked hair's are, flaring at the
   * tie-in). Softness never bends a bunch down. Without it, a bunch is drawn as straight fibres
   * fanning from the tie-in.
   */
  stiffness?: number;
}

export const MATERIALS = {
  // Yarns
  wool: { name: "wool", archetype: "yarn" },
  "poly-yarn": { name: "poly yarn", archetype: "yarn", defaultColor: "white" },
  // Antron: glittery trilobal fibres, used sparse so the body shows through (LaFontaine's pupae).
  "sparkle-yarn": { name: "sparkle yarn", archetype: "yarn", defaultColor: "#e8dcc0", veil: true },

  // Herls
  "peacock-herl": { name: "peacock herl", archetype: "herl", defaultColor: "#26341a" },
  "ostrich-herl": { name: "ostrich herl", archetype: "herl", defaultColor: "#9a8e7e" },

  // Hackles
  // Assumption (all the barb densities): a cock hackle carries its barbs closest, a saddle hackle
  // a little less close, a hen hackle fewer, and the soft game-bird feathers fewest, their barbs
  // well apart (photos of collars, palmered bodies and spiders).
  "cock-hackle": { name: "cock hackle", archetype: "hackle", sweep: 7, barbsPerMm: 14 },
  "hen-hackle": { name: "hen hackle", archetype: "hackle", sweep: 35, barbsPerMm: 8 },
  "saddle-hackle": { name: "saddle hackle", archetype: "hackle", sweep: 40, barbsPerMm: 10 },
  // Soft game-bird hackles sweep well back over the body (reference photos of spiders).
  "partridge-hackle": { name: "partridge hackle", archetype: "hackle", defaultColor: "partridge", sweep: 65, barbsPerMm: 4.5 },
  "snipe-hackle": { name: "snipe hackle", archetype: "hackle", defaultColor: "snipe", sweep: 65, barbsPerMm: 5 },
  // Assumption: guinea-fowl body feathers are soft, between a hen hackle and partridge.
  "guinea-fowl-hackle": { name: "guinea fowl hackle", archetype: "hackle", defaultColor: "guinea", sweep: 45, barbsPerMm: 6 },
  // The golden pheasant cock's ruddy red flank feather, folded and wound as a hackle (an Usk
  // Grub's tail). Assumption: soft, its long barbs sweeping back like a partridge hackle's.
  "golden-pheasant-flank": { name: "golden pheasant flank feather", archetype: "hackle", defaultColor: "#a8401c", sweep: 60, barbsPerMm: 6 },

  // Dubbing
  // Assumption: hare's mask and seal's fur are the roughest common dubbings, rabbit in between
  // and dry-fly dubbing fine and tight. A picked-out thorax says so with `shaggy` in the recipe.
  "hares-ear-dubbing": { name: "hare's ear dubbing", archetype: "dubbing", defaultColor: "hares-ear", shaggy: 0.6 },
  "dry-fly-dubbing": { name: "dry fly dubbing", archetype: "dubbing", shaggy: 0.15 },
  "rabbit-dubbing": { name: "rabbit dubbing", archetype: "dubbing", shaggy: 0.5 },
  "seals-fur": { name: "seal's fur", archetype: "dubbing", shaggy: 0.6 },
  // Assumption: fox body fur dubbed with its guard hairs in is the roughest of all, long hairs
  // standing out all round (Kärki's Gråräven).
  "fox-dubbing": { name: "fox fur dubbing", archetype: "dubbing", defaultColor: "grey", shaggy: 1 },
  dubbing: { name: "dubbing", archetype: "dubbing" },

  // Wire
  "gold-wire": { name: "gold wire", archetype: "wire", defaultColor: "gold" },
  "copper-wire": { name: "copper wire", archetype: "wire", defaultColor: "copper" },
  "silver-wire": { name: "silver wire", archetype: "wire", defaultColor: "silver" },
  "lead-free-wire": { name: "lead-free wire", archetype: "wire", defaultColor: "lead" },

  // Thread and floss
  "rib-thread": { name: "thread", archetype: "floss" },
  "silk-floss": { name: "silk floss", archetype: "floss" },
  monofilament: { name: "monofilament", archetype: "floss", defaultColor: "clear" },

  // Tinsel
  "flat-tinsel": { name: "flat tinsel", archetype: "tinsel", defaultColor: "silver" },
  "oval-tinsel": { name: "oval tinsel", archetype: "tinsel", defaultColor: "gold", oval: true },

  // Chenille
  chenille: { name: "chenille", archetype: "chenille" },

  // Hair
  // Assumption (all the stiffness values): moose mane and elk are the stiffest, then deer, calf
  // tail (kinky, it stays put), bucktail (stiff at the butt, finer and softer towards the tip),
  // squirrel tail (soft and wispy), fox and craft fur the softest of all.
  "elk-hair": { name: "elk hair", archetype: "hair", defaultColor: "elk", stiffness: 0.85 },
  "deer-hair": { name: "deer hair", archetype: "hair", defaultColor: "deer", stiffness: 0.8 },
  "calf-tail": { name: "calf tail", archetype: "hair", defaultColor: "white", stiffness: 0.7 },
  // Assumption: bucktail is coarse, about one and a half times as thick as elk or deer hair.
  bucktail: { name: "bucktail", archetype: "hair", fibreWidth: 1.5, stiffness: 0.6 },
  "squirrel-tail": { name: "squirrel tail", archetype: "hair", defaultColor: "squirrel", stiffness: 0.35 },
  "moose-mane": { name: "moose mane", archetype: "hair", defaultColor: "moose", stiffness: 0.95 },
  // Assumption: fox guard hair is about half as thick as elk or deer hair.
  "fox-hair": { name: "fox hair", archetype: "hair", fibreWidth: 0.5, stiffness: 0.2 },

  // Fibres
  "pheasant-tail": { name: "pheasant tail fibres", archetype: "fibres", defaultColor: "pheasant-tail" },
  "hackle-fibres": { name: "hackle fibres", archetype: "fibres" },
  // Assumption: tippet barbs are about two and a half times as broad as hackle fibres.
  "golden-pheasant-tippet": { name: "golden pheasant tippet", archetype: "fibres", defaultColor: "tippet", fibreWidth: 2.5 },
  "golden-pheasant-crest": { name: "golden pheasant crest", archetype: "fibres", defaultColor: "crest" },
  // The bronze-green, fluffy fibres of the peacock's sword feather (tails, wings).
  "peacock-sword": { name: "peacock sword", archetype: "fibres", defaultColor: "#4c5a24", flue: true },
  "wood-duck-flank": { name: "wood duck flank", archetype: "fibres", defaultColor: "wood-duck" },
  // Assumption: hare's mask guard hairs and synthetic hair (Ultra Hair) are fairly stiff; craft fur
  // is as soft as fox.
  "hares-mask-guard-hairs": { name: "hare's mask guard hairs", archetype: "fibres", defaultColor: "hares-ear", stiffness: 0.7 },
  "synthetic-hair": { name: "synthetic hair", archetype: "fibres", stiffness: 0.7 },
  // Fine synthetic fur on a backing, long fibres over a soft underfur (streamer wings, crab bodies).
  "craft-fur": { name: "Craft Fur", archetype: "fibres", stiffness: 0.15 },
  "coq-de-leon": { name: "Coq de León fibres", archetype: "fibres", defaultColor: "pardo" },

  // Biots
  "goose-biot": { name: "goose biot", archetype: "biot" },

  // Marabou, CDC, flash
  marabou: { name: "marabou", archetype: "marabou" },
  cdc: { name: "CDC", archetype: "cdc", defaultColor: "dun" },
  "krystal-flash": { name: "Krystal Flash", archetype: "flash", defaultColor: "pearl" },
  flashabou: { name: "Flashabou", archetype: "flash", defaultColor: "silver" },

  // Feathers
  "mallard-breast": { name: "hen mallard breast feather", archetype: "feather", defaultColor: "mallard", shape: "breast" },
  // Teal is tied folded, so it stands on edge over the body like a quill slip.
  "teal-flank": { name: "teal flank feather", archetype: "feather", defaultColor: "teal", shape: "slip" },
  "hackle-tips": { name: "hackle tips", archetype: "feather", shape: "tip" },
  "duck-quill": { name: "duck quill slips", archetype: "feather", defaultColor: "grey", shape: "slip" },
  "starling-quill": { name: "starling quill slips", archetype: "feather", defaultColor: "dun", shape: "slip" },
  "turkey-quill": { name: "turkey quill slip", archetype: "feather", defaultColor: "turkey", shape: "slip" },
  "hen-pheasant-quill": { name: "hen pheasant quill slips", archetype: "feather", defaultColor: "hen-pheasant", shape: "slip" },
  "saddle-feathers": { name: "saddle hackle feathers", archetype: "feather", shape: "tip" },
  // The mallard drake's bronze-brown shoulder feathers: slips or folded fibres as a low roof of a
  // wing (a Mallard and Claret's, a Dunkeld's, the strips over a classic salmon fly's wing).
  "bronze-mallard": { name: "bronze mallard", archetype: "feather", defaultColor: "bronze-mallard", shape: "slip" },
  // The neck feathers ("eyes", "nails") of the grey jungle fowl: small, stiff and round-ended,
  // dark with a row of cream enamel spots down the middle; a pair as cheeks beside a wing.
  "jungle-cock": { name: "jungle cock", archetype: "feather", defaultColor: "#26231f", shape: "eye" },
  // Assumption: the cock's small red body feathers, tied as a pair of cheeks like a hackle tip.
  "golden-pheasant-body": { name: "golden pheasant body feather", archetype: "feather", defaultColor: "red", shape: "tip" },
  // A whole tippet feather from the golden pheasant's cape: a broad orange fan barred black near its
  // end (a General Practitioner's eyes, cut into a V).
  "golden-pheasant-tippet-feather": { name: "golden pheasant tippet feather", archetype: "feather", defaultColor: "tippet", shape: "breast" },

  // Foam
  foam: { name: "foam", archetype: "foam", defaultColor: "black", thickness: 0.09 },
  "scud-back": { name: "scud back", archetype: "foam", thickness: 0.03 },

  // Beads and eyes
  "brass-bead": { name: "brass bead", archetype: "bead", defaultColor: "gold" },
  "tungsten-bead": { name: "tungsten bead", archetype: "bead", defaultColor: "gold" },
  "brass-cone": { name: "brass cone head", archetype: "bead", defaultColor: "gold", cone: true },
  "tungsten-cone": { name: "tungsten cone head", archetype: "bead", defaultColor: "gold", cone: true },
  "split-shot": { name: "split shot", archetype: "bead", defaultColor: "black", shot: true },
  "dumbbell-eyes": { name: "dumbbell eyes", archetype: "eyes", defaultColor: "lead" },
  "bead-chain-eyes": { name: "bead chain eyes", archetype: "eyes", defaultColor: "silver" },
  "mono-eyes": { name: "burnt mono eyes", archetype: "eyes", defaultColor: "black" },

  // Legs
  "rubber-legs": { name: "round rubber legs", archetype: "legs" },
  "silicone-legs": { name: "silicone legs", archetype: "legs" },

  // Strips and tubing
  // Assumption: a zonker strip of rabbit is cut about 3 mm wide (Fly Fishing the Sierra: 1/8"), its
  // fur about 18 mm long (read from photos: it stands a gape or more over the back of a #4).
  "rabbit-strip": { name: "rabbit zonker strip", archetype: "strip", furMm: 18, widthMm: 3 },
  "mylar-tubing": { name: "Mylar tubing", archetype: "tubing", defaultColor: "pearl" },
} satisfies Record<string, CatalogMaterial>;

export type MaterialKind = keyof typeof MATERIALS;
export const MATERIAL_KINDS = Object.keys(MATERIALS) as [MaterialKind, ...MaterialKind[]];

export function catalogMaterial(kind: MaterialKind): CatalogMaterial {
  return MATERIALS[kind];
}

/** Recipe properties each archetype accepts besides id, kind, color and label. */
export const ARCHETYPE_PROPS: Record<Archetype, readonly string[]> = {
  yarn: [],
  herl: ["strands"],
  hackle: ["fibre", "sweep", "barred"],
  dubbing: ["shaggy"],
  wire: ["mm"],
  floss: ["size"],
  tinsel: [],
  chenille: ["mm"],
  hair: ["count", "mix"],
  fibres: ["count", "barred", "mix"],
  biot: ["count"],
  marabou: ["barred"],
  cdc: ["fibre", "sweep"],
  flash: ["count"],
  feather: ["barred"],
  foam: ["mm"],
  bead: ["mm"],
  eyes: ["mm"],
  legs: ["count"],
  strip: ["fibre", "mm", "tuft"],
  tubing: [],
};

/** Materials that are wound or applied to the shank rather than sticking out. */
export const WINDABLE: readonly Archetype[] = ["yarn", "herl", "hackle", "wire", "floss", "tinsel", "chenille", "fibres", "cdc"];
