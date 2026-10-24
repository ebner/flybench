import { HOOK_MODELS } from "./hook";
import { MATERIALS } from "../recipe/materials";
import type { Material, Recipe, Step } from "../recipe/schema";

function colorName(color: string): string {
  return color.startsWith("#") ? "" : color.replace(/-/g, " ");
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** Display name: the label, or the colour (if given in the recipe) plus the catalog name. */
export function materialName(m: Material): string {
  if (m.label) return m.label;
  const cat = MATERIALS[m.kind];
  const color = m.color ? colorName(m.color) : "";
  return capitalize(`${color} ${cat.name}`.trim());
}

export interface MaterialsListEntry {
  role: string;
  name: string;
  detail?: string;
}

export function materialsList(recipe: Recipe): MaterialsListEntry[] {
  const hook = HOOK_MODELS[recipe.hook.model];
  return [
    { role: "Hook", name: hook.label, detail: `size ${recipe.hook.size}` },
    { role: "Thread", name: capitalize(`${colorName(recipe.thread.color)} thread`.trim()), detail: recipe.thread.size },
    ...recipe.materials.map((m) => ({
      role: capitalize(m.id.replace(/-/g, " ")),
      name: materialName(m),
      detail:
        m.strands !== undefined
          ? `${m.strands} strand${m.strands === 1 ? "" : "s"}`
          : m.fibre !== undefined
            ? `fibres ${m.fibre}× gape`
            : m.size ?? (m.count !== undefined ? `${m.count} fibres` : undefined),
    })),
  ];
}

export function positionText(s: number): string {
  if (s <= 0.02) return "the start of the bend";
  if (s >= 0.95) return "just behind the eye";
  if (Math.abs(s - 0.5) <= 0.02) return "halfway along the shank";
  return `${Math.round(s * 100)}% of the way along the shank`;
}

const GAPE_WORDS: [number, string][] = [
  [0.25, "a quarter of the gape"],
  [0.5, "half the gape"],
  [0.75, "three quarters of the gape"],
  [1, "the gape"],
  [1.5, "one and a half times the gape"],
  [2, "twice the gape"],
];

/** A length in gapes as a tyer would say it. */
export function gapeText(n: number): string {
  const word = GAPE_WORDS.find(([v]) => Math.abs(v - n) <= 0.05);
  return word ? word[1] : `${n}× the gape`;
}

/** Where tips end, relative to the bend (x in gapes; the bend ends at bendEnd). */
function reachText(tipX: number, bendEnd: number): string | null {
  if (tipX > 0.1) return null;
  if (tipX > -0.15) return "to the start of the bend";
  if (tipX > bendEnd + 0.15) return "over the bend";
  if (tipX > bendEnd - 0.2) return "just past the end of the bend";
  return "well past the bend";
}

/** What the simulation knows about a step that the text needs. */
export interface StepContext {
  /** wind: winding back towards the bend (palmering). */
  rear?: boolean;
  /** wind: the palmered material this wind secures. */
  through?: string;
  /** trim: trimming the tip of a palmered material rather than hair butts. */
  tip?: boolean;
  /** tie-in with a length: where the tips end, and where the bend ends (x in gapes). */
  tipX?: number;
  bendEnd?: number;
}

/** Instruction text for one step, generated from the recipe; the step's note is appended. */
export function stepText(recipe: Recipe, step: Step, ctx: StepContext = {}): string {
  const find = (id: string) => recipe.materials.find((m) => m.id === id);
  const mat = (id: string) => {
    const m = find(id);
    return m ? materialName(m).toLowerCase() : id;
  };
  let text: string;
  switch (step.op) {
    case "attach-thread":
      text = `Attach the thread at ${positionText(step.at)} with a few turns and trim the tag end.`;
      break;
    case "wrap-thread":
      text = step.turns
        ? `Wrap the thread to ${positionText(step.to)} in ${step.turns} open turns.`
        : `Wrap the thread to ${positionText(step.to)} in touching turns.`;
      break;
    case "tie-in": {
      const m = find(step.material);
      const archetype = m ? MATERIALS[m.kind].archetype : null;
      const what =
        archetype === "herl" && m?.strands
          ? `${m.strands} strands of peacock herl`
          : archetype === "hair"
            ? `a clump of ${mat(step.material)}`
            : `the ${mat(step.material)}`;
      if (step.length) {
        const angle = step.angle ? `, angled about ${step.angle}° up from the shank` : "";
        const reach = ctx.tipX !== undefined && ctx.bendEnd !== undefined ? reachText(ctx.tipX, ctx.bendEnd) : null;
        const wing = archetype === "hair" || archetype === "feather";
        const pick = archetype === "feather" && step.width ? `Pick a feather about ${gapeText(step.width)} wide. ` : "";
        const flare = (step.spread ?? 0) >= 60 ? " Let it flare out round the sides of the body." : "";
        text =
          wing && reach
            ? `${pick}Tie in ${what} so the tips reach ${reach} (${gapeText(step.length)} from the tie-in point)${angle}.${flare}`
            : `${pick}Tie in ${what}, leaving ${gapeText(step.length)} sticking out behind${angle}.${flare}`;
      } else {
        text = `Tie in ${what} with a few firm thread turns.`;
      }
      break;
    }
    case "wind":
      if (ctx.rear) {
        text = `Palmer the ${mat(step.material)} back to ${positionText(step.to)} in ${step.turns} open turns.`;
      } else if (ctx.through) {
        text = `Wind the ${mat(step.material)} forward to ${positionText(step.to)} in ${step.turns} turns through the ${mat(ctx.through)}. The first turn traps its tip.`;
      } else {
        text = `Wind the ${mat(step.material)} forward to ${positionText(step.to)} in ${step.turns} turns.`;
      }
      break;
    case "dub":
      text = `Twist a thin noodle of ${mat(step.material)} onto the thread and wrap it forward to ${positionText(step.to)}.`;
      break;
    case "tie-off":
      text = `Tie off the ${mat(step.material)} with a few thread turns and trim the excess.`;
      break;
    case "trim":
      text = ctx.tip
        ? `Trim the tip of the ${mat(step.material)} close to the body.`
        : step.leave
          ? `Trim the butts of the ${mat(step.material)}, leaving a short head ${step.leave}× the gape long.`
          : `Trim the butts of the ${mat(step.material)} flush.`;
      break;
    case "whip-finish":
      text = `Form a small head, whip finish with ${step.turns} turns and cut the thread.`;
      break;
  }
  return step.note ? `${text} ${step.note}` : text;
}

const OP_TITLES: Record<Step["op"], string> = {
  "attach-thread": "Attach thread",
  "wrap-thread": "Wrap thread",
  "tie-in": "Tie in",
  wind: "Wind",
  dub: "Dub",
  "tie-off": "Tie off",
  trim: "Trim",
  "whip-finish": "Whip finish",
};

export function stepTitle(recipe: Recipe, step: Step, ctx: StepContext = {}): string {
  const title = step.op === "wind" && ctx.rear ? "Palmer" : OP_TITLES[step.op];
  if (!("material" in step)) return title;
  const m = recipe.materials.find((m) => m.id === step.material);
  return `${title}: ${m ? materialName(m).toLowerCase() : step.material}`;
}
