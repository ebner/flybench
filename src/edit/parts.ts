import { MATERIALS, type Archetype, type MaterialKind } from "../recipe/materials";
import type { Material, Recipe, Step } from "../recipe/schema";

/**
 * A fly as the visitor sees it: parts (a tail, a body, a rib, a hackle, a wing) on a hook, each of
 * a material with a few measurements. `compile` writes the recipe: the tying order, the thread's
 * moves, the tie-ins, windings, tie-offs and trims, so a fly built of parts is always valid.
 */

export const ROLES = ["tail", "body", "rib", "wing", "hackle"] as const;
export type Role = (typeof ROLES)[number];

export interface Part {
  /** Unique in the fly; the recipe's material id. */
  id: string;
  role: Role;
  kind: MaterialKind;
  color?: string;
  /** The material's own settings (a hackle's fibre length, a bunch's count). */
  props?: Record<string, number>;
  /** Along the shank (0 the bend, 1 behind the eye): where a body, rib or hackle starts and ends. */
  from?: number;
  to?: number;
  /** Where a tail or wing is tied in. */
  at?: number;
  /** Gapes a tail or wing sticks out from where it is tied in. */
  length?: number;
  /** Degrees above the shank a tail or wing rises (90 upright). */
  angle?: number;
  /** Degrees to each side of the top a bunch fans out over. */
  spread?: number;
  /** Turns of a wound part; omitted, worked out from its length. */
  turns?: number;
  /** A rib wound the other way round to the body. */
  counter?: boolean;
}

export interface PartsFly {
  /** Everything of the recipe but its materials and steps. */
  meta: Omit<Recipe, "materials" | "steps">;
  parts: Part[];
}

/** What each part may be made of, by archetype. */
export const ROLE_ARCHETYPES: Record<Role, readonly Archetype[]> = {
  tail: ["fibres", "hair", "marabou", "biot", "flash", "yarn"],
  body: ["dubbing", "floss", "herl", "tinsel", "wire", "chenille", "yarn"],
  rib: ["wire", "tinsel", "floss"],
  wing: ["hair", "feather", "cdc", "fibres", "marabou", "flash", "yarn", "biot"],
  hackle: ["hackle"],
};

export const kindsFor = (role: Role): MaterialKind[] =>
  (Object.keys(MATERIALS) as MaterialKind[]).filter((k) => ROLE_ARCHETYPES[role].includes(MATERIALS[k].archetype));

const archetype = (p: Part) => MATERIALS[p.kind].archetype;

/** A wing at this angle or more stands up, tied in before the body as on a Catskill dry. */
const UPRIGHT = 60;

// Assumption: about one turn of a wound body or rib per tenth of the shank, a hackle's five turns
// over a fifth of it; ribs open (five turns over a body).
function turnsOf(p: Part): number {
  if (p.turns) return p.turns;
  const span = Math.max(0.05, (p.to ?? 1) - (p.from ?? 0));
  if (p.role === "rib") return Math.max(3, Math.round(span * 7));
  if (p.role === "hackle") return Math.max(2, Math.round(span * 25));
  return Math.max(3, Math.round(span * 12));
}

/** The recipe of a fly built of parts, and which steps each part's are (for playing them). */
export function compile(fly: PartsFly): { recipe: Recipe; spans: Map<string, [number, number]> } {
  const steps: Step[] = [];
  const spans = new Map<string, [number, number]>();
  let thread: number | null = null;
  const mark = (p: Part) => {
    const i = steps.length - 1;
    const s = spans.get(p.id);
    spans.set(p.id, s ? [s[0], i] : [i, i]);
  };
  const to = (x: number) => {
    const at = round(x);
    if (thread === null) steps.push({ op: "attach-thread", at });
    else if (thread !== at) steps.push({ op: "wrap-thread", to: at });
    thread = at;
  };
  const tieIn = (p: Part, at: number) => {
    to(at);
    const bunch = p.role === "tail" || p.role === "wing";
    steps.push({
      op: "tie-in",
      material: p.id,
      ...(bunch && p.length !== undefined && { length: p.length }),
      ...(bunch && p.angle !== undefined && p.angle > 0 && { angle: p.angle }),
      ...(bunch && p.spread !== undefined && archetype(p) !== "feather" && { spread: p.spread }),
    } as Step);
    mark(p);
    // Hair butts are trimmed off where the bunch is tied in.
    if (bunch && archetype(p) === "hair") {
      steps.push({ op: "trim", material: p.id });
      mark(p);
    }
  };
  const windForward = (p: Part, from: number, end: number) => {
    to(end);
    steps.push({ op: "wind", material: p.id, to: round(end), turns: turnsOf(p), ...(p.counter && { counter: true }) });
    mark(p);
    steps.push({ op: "tie-off", material: p.id });
    mark(p);
    void from;
  };

  const of = (role: Role) => fly.parts.filter((p) => p.role === role);
  const wings = of("wing");
  const bodies = [...of("body")].sort((a, b) => (a.from ?? 0) - (b.from ?? 0));
  const front = bodies.at(-1)?.to ?? 0.7;

  // Upright wings first, then the tail at the bend and the rib where the body starts; the body;
  // the rib over it; wings that lie back over the body; the hackles in front.
  for (const w of wings.filter((w) => (w.angle ?? 0) >= UPRIGHT)) tieIn(w, w.at ?? 0.75);
  for (const t of of("tail")) tieIn(t, t.at ?? 0);
  const ribs = of("rib");
  for (const r of ribs) tieIn(r, r.from ?? bodies[0]?.from ?? 0);
  for (const b of bodies) {
    const from = b.from ?? 0;
    const end = b.to ?? front;
    if (archetype(b) === "dubbing") {
      to(from);
      steps.push({ op: "dub", material: b.id, to: round(end) });
      thread = round(end);
      mark(b);
    } else {
      tieIn(b, from);
      windForward(b, from, end);
    }
  }
  for (const r of ribs) windForward(r, r.from ?? 0, r.to ?? front);
  for (const w of wings.filter((w) => (w.angle ?? 0) < UPRIGHT)) tieIn(w, w.at ?? front);
  for (const h of of("hackle")) {
    const from = h.from ?? front;
    tieIn(h, from);
    windForward(h, from, h.to ?? Math.min(0.95, from + 0.2));
  }
  if (thread === null) to(0.85);
  steps.push({ op: "whip-finish", turns: 5 });

  const materials: Material[] = fly.parts.map((p) => ({ id: p.id, kind: p.kind, ...(p.color && { color: p.color }), ...p.props }) as Material);
  return { recipe: { ...fly.meta, materials, steps } as Recipe, spans };
}

const round = (x: number) => Math.round(Math.min(1, Math.max(0, x)) * 100) / 100;

/** A new part's id: its role, numbered when the fly has one already. */
export function partId(fly: PartsFly, role: Role): string {
  const taken = new Set(fly.parts.map((p) => p.id));
  if (!taken.has(role)) return role;
  let n = 2;
  while (taken.has(`${role}-${n}`)) n++;
  return `${role}-${n}`;
}

/** Proportions a part can be set to at a tap: short, classic and long, as multiples of the classic. */
export const PRESETS = { short: 0.75, classic: 1, long: 1.3 } as const;
export type Preset = keyof typeof PRESETS;

// Assumption: a dry fly's classic proportions (Catskill school, as in the patterns): a tail about
// a shank long (1.7 gapes), the body over the rear seven tenths, upright wings at three quarters
// about 1.8 gapes tall, a collar hackle in front with fibres one and a half gapes.
export const CLASSIC: Record<Role, Partial<Part>> = {
  tail: { at: 0, length: 1.7, angle: 0, spread: 15 },
  body: { from: 0, to: 0.7 },
  rib: { from: 0, to: 0.7 },
  wing: { at: 0.75, length: 1.8, angle: 90, spread: 22 },
  hackle: { from: 0.7, to: 0.9, props: { fibre: 1.5 } },
};

/** A new part of this role and material at classic proportions, its rib along the body. */
export function newPart(fly: PartsFly, role: Role, kind: MaterialKind, color?: string): Part {
  const body = fly.parts.find((p) => p.role === "body");
  const classic = CLASSIC[role];
  const part: Part = { id: partId(fly, role), role, kind, ...(color && { color }), ...structuredClone(classic) };
  if (role === "rib" && body) Object.assign(part, { from: body.from, to: body.to });
  if (MATERIALS[kind].archetype !== "hackle") delete part.props;
  return part;
}

/** Fly styles to start from. The prototype has the classic dry fly. */
export function dryFly(meta: PartsFly["meta"]): PartsFly {
  const fly: PartsFly = { meta: { ...meta, type: "dry", hook: { model: "dry-standard", size: 14 } }, parts: [] };
  const add = (role: Role, kind: MaterialKind, color?: string) => fly.parts.push(newPart(fly, role, kind, color));
  add("wing", "hackle-tips", "grizzly");
  add("tail", "hackle-fibres", "brown");
  add("body", "dry-fly-dubbing", "muskrat");
  add("hackle", "cock-hackle", "brown");
  return fly;
}
