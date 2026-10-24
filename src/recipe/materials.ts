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
 *   feather   whole feathers or slips as wings (shape: breast, tip, slip)
 *   foam      closed-cell foam (backs, wing cases)
 *   bead      beads slid onto the hook
 *   eyes      dumbbell and bead-chain eyes
 */

export const ARCHETYPES = [
  "yarn", "herl", "hackle", "dubbing", "wire", "floss", "tinsel", "chenille", "hair",
  "fibres", "biot", "marabou", "cdc", "flash", "feather", "foam", "bead", "eyes",
] as const;
export type Archetype = (typeof ARCHETYPES)[number];

export type FeatherShape = "breast" | "tip" | "slip";

export interface CatalogMaterial {
  name: string;
  archetype: Archetype;
  /** Named or hex colour used when the recipe gives none. Without it, `color` is required. */
  defaultColor?: string;
  /** Hackles: how far the fibres lean back from upright, in degrees, when wound. */
  sweep?: number;
  /** Feathers: the outline of the wing. */
  shape?: FeatherShape;
  /** Tinsel: oval tinsel is round in section, flat tinsel is a ribbon. */
  oval?: boolean;
  /** Strips pulled over the body (foam, scud back): thickness in gapes. */
  thickness?: number;
}

export const MATERIALS = {
  // Yarns
  wool: { name: "wool", archetype: "yarn" },
  "poly-yarn": { name: "poly yarn", archetype: "yarn", defaultColor: "white" },

  // Herls
  "peacock-herl": { name: "peacock herl", archetype: "herl", defaultColor: "#26341a" },

  // Hackles
  "cock-hackle": { name: "cock hackle", archetype: "hackle", sweep: 7 },
  "hen-hackle": { name: "hen hackle", archetype: "hackle", sweep: 35 },
  "saddle-hackle": { name: "saddle hackle", archetype: "hackle", sweep: 40 },
  // Soft game-bird hackles sweep well back over the body (reference photos of spiders).
  "partridge-hackle": { name: "partridge hackle", archetype: "hackle", defaultColor: "partridge", sweep: 65 },
  "snipe-hackle": { name: "snipe hackle", archetype: "hackle", defaultColor: "snipe", sweep: 65 },

  // Dubbing
  "hares-ear-dubbing": { name: "hare's ear dubbing", archetype: "dubbing", defaultColor: "hares-ear" },
  "dry-fly-dubbing": { name: "dry fly dubbing", archetype: "dubbing" },
  "rabbit-dubbing": { name: "rabbit dubbing", archetype: "dubbing" },
  "seals-fur": { name: "seal's fur", archetype: "dubbing" },
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
  "elk-hair": { name: "elk hair", archetype: "hair", defaultColor: "elk" },
  "deer-hair": { name: "deer hair", archetype: "hair", defaultColor: "deer" },
  "calf-tail": { name: "calf tail", archetype: "hair", defaultColor: "white" },
  bucktail: { name: "bucktail", archetype: "hair" },
  "squirrel-tail": { name: "squirrel tail", archetype: "hair", defaultColor: "squirrel" },
  "moose-mane": { name: "moose mane", archetype: "hair", defaultColor: "moose" },

  // Fibres
  "pheasant-tail": { name: "pheasant tail fibres", archetype: "fibres", defaultColor: "pheasant-tail" },
  "hackle-fibres": { name: "hackle fibres", archetype: "fibres" },
  "golden-pheasant-tippet": { name: "golden pheasant tippet", archetype: "fibres", defaultColor: "tippet" },
  "golden-pheasant-crest": { name: "golden pheasant crest", archetype: "fibres", defaultColor: "crest" },
  "hares-mask-guard-hairs": { name: "hare's mask guard hairs", archetype: "fibres", defaultColor: "hares-ear" },

  // Biots
  "goose-biot": { name: "goose biot", archetype: "biot" },

  // Marabou, CDC, flash
  marabou: { name: "marabou", archetype: "marabou" },
  cdc: { name: "CDC", archetype: "cdc", defaultColor: "dun" },
  "krystal-flash": { name: "Krystal Flash", archetype: "flash", defaultColor: "pearl" },
  flashabou: { name: "Flashabou", archetype: "flash", defaultColor: "silver" },

  // Feathers
  "mallard-breast": { name: "hen mallard breast feather", archetype: "feather", defaultColor: "mallard", shape: "breast" },
  "teal-flank": { name: "teal flank feather", archetype: "feather", defaultColor: "teal", shape: "breast" },
  "hackle-tips": { name: "hackle tips", archetype: "feather", shape: "tip" },
  "duck-quill": { name: "duck quill slips", archetype: "feather", defaultColor: "grey", shape: "slip" },
  "starling-quill": { name: "starling quill slips", archetype: "feather", defaultColor: "dun", shape: "slip" },
  "turkey-quill": { name: "turkey quill slip", archetype: "feather", defaultColor: "turkey", shape: "slip" },
  "saddle-feathers": { name: "saddle hackle feathers", archetype: "feather", shape: "tip" },

  // Foam
  foam: { name: "foam", archetype: "foam", defaultColor: "black", thickness: 0.09 },
  "scud-back": { name: "scud back", archetype: "foam", thickness: 0.03 },

  // Beads and eyes
  "brass-bead": { name: "brass bead", archetype: "bead", defaultColor: "gold" },
  "tungsten-bead": { name: "tungsten bead", archetype: "bead", defaultColor: "gold" },
  "dumbbell-eyes": { name: "dumbbell eyes", archetype: "eyes", defaultColor: "lead" },
  "bead-chain-eyes": { name: "bead chain eyes", archetype: "eyes", defaultColor: "silver" },
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
  hackle: ["fibre", "sweep"],
  dubbing: [],
  wire: ["mm"],
  floss: ["size"],
  tinsel: [],
  chenille: [],
  hair: [],
  fibres: ["count"],
  biot: ["count"],
  marabou: [],
  cdc: [],
  flash: ["count"],
  feather: [],
  foam: [],
  bead: ["mm"],
  eyes: ["mm"],
};

/** Materials that are wound or applied to the shank rather than sticking out. */
export const WINDABLE: readonly Archetype[] = ["yarn", "herl", "hackle", "wire", "floss", "tinsel", "chenille", "fibres", "cdc"];
