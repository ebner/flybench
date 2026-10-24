/**
 * The materials catalog. Recipes refer to these ids, which gives every material a
 * stable identity for search, the inventory and "tie with what I have".
 *
 * The archetype says how a material behaves and is drawn, and which recipe
 * properties it takes:
 *   yarn     wool and similar          –
 *   herl     peacock, ostrich herl     strands
 *   hackle   cock/hen hackle feathers  fibre (barb length in gapes, required)
 *   dubbing  fur and synthetic dubbing –        (applied with `dub`, never tied in)
 *   wire     metal wire ribs           –
 *   floss    thread or floss ribs      –
 *   hair     elk, deer hair            –        (tied in as a clump; butts can be trimmed)
 *   fibres   tail fibres               count
 *   feather  whole-feather wings       –
 */

export const ARCHETYPES = ["yarn", "herl", "hackle", "dubbing", "wire", "floss", "hair", "fibres", "feather"] as const;
export type Archetype = (typeof ARCHETYPES)[number];

export interface CatalogMaterial {
  name: string;
  archetype: Archetype;
  /** Named or hex colour used when the recipe gives none. Without it, `color` is required. */
  defaultColor?: string;
}

export const MATERIALS = {
  wool: { name: "wool", archetype: "yarn" },
  "peacock-herl": { name: "peacock herl", archetype: "herl", defaultColor: "#26341a" },
  "cock-hackle": { name: "cock hackle", archetype: "hackle" },
  "hares-ear-dubbing": { name: "hare's ear dubbing", archetype: "dubbing", defaultColor: "hares-ear" },
  "dry-fly-dubbing": { name: "dry fly dubbing", archetype: "dubbing" },
  "gold-wire": { name: "gold wire", archetype: "wire", defaultColor: "gold" },
  "copper-wire": { name: "copper wire", archetype: "wire", defaultColor: "copper" },
  "silver-wire": { name: "silver wire", archetype: "wire", defaultColor: "silver" },
  "rib-thread": { name: "thread", archetype: "floss" },
  "elk-hair": { name: "elk hair", archetype: "hair", defaultColor: "elk" },
  "pheasant-tail": { name: "pheasant tail fibres", archetype: "fibres", defaultColor: "pheasant-tail" },
  "mallard-breast": { name: "hen mallard breast feather", archetype: "feather", defaultColor: "mallard" },
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
  hackle: ["fibre"],
  dubbing: [],
  wire: [],
  floss: ["size"],
  hair: [],
  fibres: ["count"],
  feather: [],
};
