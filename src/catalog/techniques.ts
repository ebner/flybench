import { ridesPointUp } from "../tying/hook";
import { MATERIALS, type Archetype } from "../recipe/materials";
import type { Recipe } from "../recipe/schema";

/**
 * Techniques: the things a tyer learns, recognised from recipe steps. Each technique
 * has an explanation for beginners and common mistakes; its page plays a real step
 * from a real pattern, and every step on a pattern page links to its technique.
 */

export interface Technique {
  id: string;
  name: string;
  /** One sentence: what it is and what it is for. */
  summary: string;
  /** How to do it, for someone who hasn't. Blank lines separate paragraphs. */
  how: string;
  mistakes: string[];
}

export const TECHNIQUES: Technique[] = [
  {
    id: "attach-thread",
    name: "Attaching the thread",
    summary: "Starting the thread on a bare hook with a jam knot.",
    how: `Hold the tag end of the thread above and behind the hook, the bobbin below. Lay the thread against the shank and wrap it over itself, away from you, three or four times towards the bend. The turns bind the tag end and lock themselves: this is the jam knot.

Trim the tag end close and you have a firm base to tie onto.`,
    mistakes: ["Wrapping towards you: the turns slip instead of locking.", "Too few turns, so the thread spins round the shank."],
  },
  {
    id: "thread-base",
    name: "Laying a thread base",
    summary: "Touching turns of thread along the shank, so materials grip and the body is smooth.",
    how: `Wrap the thread along the shank in turns that just touch, keeping steady tension. Let the bobbin hang a few centimetres below the hook: a short thread is easier to place.

A smooth base matters: every bump in it shows through a slim body.`,
    mistakes: ["Gaps or overlapping turns, which make a lumpy body.", "Building up thread at one spot."],
  },
  {
    id: "tie-in",
    name: "Tying in a material",
    summary: "Fixing a material to the hook with firm turns of thread: the pinch wrap.",
    how: `Hold the material on top of the shank. Bring the thread up between thumb and material, over the top, and down between finger and material, so the loop closes from above. Pull straight down to tighten.

The material stays on top instead of rolling round the far side. Two or three more turns make it secure.`,
    mistakes: ["Tying in with loose turns, so the material twists round the shank.", "Too many turns, building bulk."],
  },
  {
    id: "tail",
    name: "Tails and tags",
    summary: "A bunch of fibres or yarn tied in at the bend, sticking out behind.",
    how: `Measure the length against the hook before you tie in. Hold the bunch on top of the shank at the start of the bend, make two loose turns, then tighten with a pinch wrap.

Bind the butts down along the shank towards the eye and trim them where the body will cover them, so the body stays even.`,
    mistakes: ["Tails that roll round the far side of the shank.", "Too long: the fly lands unevenly and fish nip the tail."],
  },
  {
    id: "dubbing",
    name: "Dubbing a body",
    summary: "Twisting fur onto the thread and wrapping it to form a fuzzy body.",
    how: `Take a little dubbing, far less than you think, and pull the fibres apart so they lie loosely. Press it onto the thread and twist between thumb and finger in one direction only, so it tightens onto the thread as a slim noodle.

Wrap the noodle forward in touching turns. Add a little more towards the front for a taper.`,
    mistakes: ["Too much dubbing, giving a fat, shapeless body.", "Twisting back and forth, which loosens the noodle again."],
  },
  {
    id: "herl-body",
    name: "Herl bodies",
    summary: "Winding peacock herl to make a bronze-green, fuzzy body.",
    how: `Tie in two or three herls by their tips and wind them forward together in touching turns. For a tougher body, twist them round the thread first, as a rope.

Keep the flue (the fuzz) facing back as you wind, so it stands out.`,
    mistakes: ["Winding single strands: they break easily.", "Crushing the flue with the next turn."],
  },
  {
    id: "ribbing",
    name: "Ribbing",
    summary: "Open turns of wire, tinsel or thread over the body: for segmentation and strength.",
    how: `Tie the rib in at the bend before you make the body. Once the body is done, wind the rib forward in evenly spaced open turns, in the opposite direction to the body if you want it to protect the body.

Tie it off at the front and trim.`,
    mistakes: ["Uneven spacing.", "Winding in the same direction as the body, so the rib sinks into it."],
  },
  {
    id: "wound-body",
    name: "Wound bodies",
    summary: "Bodies of floss, tinsel, chenille or fibres wound in touching turns.",
    how: `Tie the material in at the bend and wind the thread forward to where the body ends. Wind the material forward in touching or slightly overlapping turns, keeping it flat and untwisted.

Tie off where the thread hangs and trim.`,
    mistakes: ["Letting floss or tinsel twist into a cord.", "Gaps between turns."],
  },
  {
    id: "hackle-collar",
    name: "Winding a hackle collar",
    summary: "A hackle wound in close turns behind the eye, so the barbs stand out all round.",
    how: `Tie the hackle in by its stripped stem, shiny side facing you. Take the tip in hackle pliers and wind it forward, each turn just in front of the last, without trapping the barbs already wound.

Tie off with a few tight turns and trim the tip.`,
    mistakes: ["Winding over earlier turns and flattening the barbs.", "A hackle too long or short for the hook: check the barb length first."],
  },
  {
    id: "palmering",
    name: "Palmering",
    summary: "Winding a hackle in open turns along the body, often secured by the rib.",
    how: `A palmered hackle can be wound either way along the body.

Forward: tie the hackle in at the rear of the body and make the body. Wind the hackle forward over it in evenly spaced open turns, then tie it off at the front like a collar.

Back: tie the hackle in at the front of the body, wind it back towards the bend in open turns and hold the tip there with hackle pliers. Then wind the rib forward through the hackle, wiggling it so it traps no barbs. The first turn of rib locks the hackle tip; trim the tip afterwards.`,
    mistakes: ["Trapping barbs under the rib.", "Turns too close, so the hackle hides the body."],
  },
  {
    id: "soft-hackle",
    name: "Soft hackles",
    summary: "One or two turns of a soft feather such as partridge, sweeping back over the body.",
    how: `Prepare the feather by stripping the fluff from its base. Tie it in by the tip or stem and make no more than two turns: soft-hackle flies should look sparse.

Stroke the barbs back as you tie off so they sweep over the body.`,
    mistakes: ["Too many turns, which hides the body and kills the movement.", "Barbs much longer than the hook."],
  },
  {
    id: "parachute",
    name: "Parachute hackles",
    summary: "A hackle wound horizontally round an upright post, so the fly sits low in the film.",
    how: `Tie in the post upright and stiffen its base with a few turns of thread up and down it. Tie the hackle in against the post, then wind it round the post, each turn below the previous one.

Hold the hackle out of the way and tie it off on the shank with a few turns under the barbs.`,
    mistakes: ["A floppy post: the hackle slides off.", "Trapping barbs while tying off."],
  },
  {
    id: "wing-post",
    name: "Upright wings and posts",
    summary: "Wings or a post standing up from the shank, for visibility and silhouette.",
    how: `Tie the wing material in pointing forward over the eye, then lift it upright and put several turns of thread tight in front of it to keep it standing.

For divided wings, separate the two halves and bind them in a V with figure-of-eight turns.`,
    mistakes: ["Wings that lean forward or back.", "Uneven halves on a divided wing."],
  },
  {
    id: "hair-wing",
    name: "Hair wings",
    summary: "A clump of hair tied on top as a wing, flaring as the thread tightens.",
    how: `Cut a small clump, comb out the underfur and even the tips in a hair stacker. Measure, then hold it on top and make two loose turns before pulling tight: the hair flares as the thread bites.

Trim the butts at an angle (or square, for a caddis head) and bind them down.`,
    mistakes: ["Skipping the stacker, so the tips are ragged.", "Too much hair, which won't stay put."],
  },
  {
    id: "feather-wing",
    name: "Feather wings",
    summary: "Whole feathers or quill slips tied on as wings.",
    how: `For slips, cut matching sections from a left and a right quill so they curve the same way. Hold the pair on top of the hook, make a loose turn, and pull straight down so the fibres stack on top of each other.

Whole feathers are tied in by the stem; strip the fluff from the base first.`,
    mistakes: ["Slips that split apart: the loop wasn't pulled straight down.", "Mismatched slips that twist the fly."],
  },
  {
    id: "beard",
    name: "Beards and throats",
    summary: "A small bunch of fibres tied in under the hook, behind the eye.",
    how: `Turn the hook over or reach under it, hold the bunch under the shank and secure it with a pinch wrap. On a wet fly the fibres reach about to the point; a hair throat on a salmon fly is often shorter, about halfway there.`,
    mistakes: ["A beard that slides round to the side.", "Too thick, which unbalances the fly."],
  },
  {
    id: "wing-case",
    name: "Wing cases and shellbacks",
    summary: "A strip pulled forward over the top of the body and tied down.",
    how: `Tie the material in at the rear of the thorax (or the bend for a shellback), lying back. Make the thorax or body, then pull the strip forward over the top, keep it centred and flat, and tie it down at the front with a few firm turns.`,
    mistakes: ["A wing case that slips to one side.", "Pulling so hard the strip splits."],
  },
  {
    id: "bead-head",
    name: "Bead heads",
    summary: "A metal bead slid onto the hook before the thread, for weight and flash.",
    how: `Slide the bead round the bend with the small hole first, up to the eye. Hold it there while you attach the thread behind it, and build a few turns of thread or wire behind the bead to keep it in place.`,
    mistakes: ["Bead put on the wrong way round.", "A bead too big for the hook gape."],
  },
  {
    id: "weighting",
    name: "Weighting",
    summary: "Turns of wire under the body to make the fly sink.",
    how: `Wrap lead-free wire round the bare shank in touching turns over the middle of the shank, then push the turns together and lock them with thread before making the body over them.`,
    mistakes: ["Weight that spins on the shank: lock it with thread.", "Weight too close to the eye, leaving no room for the head."],
  },
  {
    id: "eyes",
    name: "Dumbbell and bead-chain eyes",
    summary: "Eyes tied across the shank with figure-of-eight turns; heavy eyes turn the fly point-up.",
    how: `Place the eyes across the shank about a third of the shank behind the eye. Bind them with figure-of-eight turns in both directions, then a few turns round the base to tighten everything. A drop of glue stops them twisting.`,
    mistakes: ["Eyes too close to the hook eye.", "Eyes that twist round the shank."],
  },
  {
    id: "spinning-hair",
    name: "Spinning and trimming deer hair",
    summary: "Clumps of hollow hair spun round the shank and clipped to a head.",
    how: `Hold a clump of deer hair over the shank, make two loose turns, then pull down hard while letting go: the hair flares and spins round the shank. Push it back tight with your fingers, add the next clump in front, and continue to the eye.

Whip finish, then trim the head to shape with sharp scissors or a razor blade.`,
    mistakes: ["Clumps too big to spin.", "Not packing the clumps, so the head is loose."],
  },
  {
    id: "tie-off",
    name: "Tying off",
    summary: "Securing a wound material at the front with firm thread turns and trimming the waste.",
    how: `Hold the material on top of the shank where the thread hangs and make three or four firm turns over it. Trim the excess close, then cover the cut end with a couple more turns.`,
    mistakes: ["Cutting before the material is secure.", "Leaving a stub that shows."],
  },
  {
    id: "whip-finish",
    name: "Whip finish",
    summary: "The knot that finishes a fly: turns of thread laid over their own loop.",
    how: `By hand or with a whip-finish tool, lay four or five turns of thread over a loop of the thread itself, then pull the loop closed so the turns trap the end. Trim the thread.

A drop of head cement or varnish makes it permanent.`,
    mistakes: ["A big head that crowds the eye.", "Pulling the loop closed before all turns are laid."],
  },
];

const BY_ID = new Map(TECHNIQUES.map((t) => [t.id, t]));

export function technique(id: string): Technique | undefined {
  return BY_ID.get(id);
}

/** The technique a recipe step uses, or null for steps that teach nothing on their own. */
export function stepTechnique(recipe: Recipe, index: number): string | null {
  const step = recipe.steps[index]!;
  const archetype = (id: string): Archetype | undefined => {
    const m = recipe.materials.find((m) => m.id === id);
    return m ? MATERIALS[m.kind].archetype : undefined;
  };
  switch (step.op) {
    case "attach-thread":
      return "attach-thread";
    case "wrap-thread":
      return "thread-base";
    case "slide-bead":
      return "bead-head";
    case "weight":
      return "weighting";
    case "dub":
      return "dubbing";
    case "spin":
      return "spinning-hair";
    case "pull-over":
      return "wing-case";
    case "whip-finish":
      return "whip-finish";
    case "tie-off":
      return "tie-off";
    case "trim": {
      const spun = recipe.steps.some((s) => s.op === "spin" && s.material === step.material);
      if (spun) return "spinning-hair";
      // Hair butts: part of tying in that hair, as a tail or a wing.
      const tieIn = recipe.steps.findIndex((s) => s.op === "tie-in" && s.material === step.material);
      if (archetype(step.material) === "hair" && tieIn >= 0) return stepTechnique(recipe, tieIn);
      // The excess of a strip pulled over the body: a wing case or foam back.
      if (recipe.steps.some((s) => s.op === "pull-over" && s.material === step.material)) return "wing-case";
      // A trimmed hackle (keep), or a palmered hackle's tip: part of how that hackle was wound.
      const wound = recipe.steps.findIndex((s) => s.op === "wind" && s.material === step.material);
      return wound >= 0 ? stepTechnique(recipe, wound) : "palmering";
    }
    case "tie-in": {
      const a = archetype(step.material);
      if (a === "eyes") return "eyes";
      if (step.length === undefined) return "tie-in";
      // Under the shank of a point-up fly is its top: a wing there, not a beard.
      if (step.side === "under") return !ridesPointUp(recipe) ? "beard" : a === "hair" ? "hair-wing" : "tie-in";
      // Legs tied across the shank and extended bodies are tied in like any material.
      if (step.side === "across" || step.extended) return "tie-in";
      if ((step.angle ?? 0) >= 60) return "wing-post";
      // A bunch tied in at the rear is a tail, whatever it is made of.
      if (!step.forward && threadAt(recipe, index) <= 0.5) return "tail";
      if (a === "hair") return "hair-wing";
      if (a === "feather") return "feather-wing";
      // Further forward, anything else (a CDC or marabou wing) is simply tied in on top.
      return "tie-in";
    }
    case "wind": {
      const a = archetype(step.material);
      if (step.around) return "parachute";
      if (a === "hackle") {
        const tiedAt = tieInPosition(recipe, index, step.material);
        // Palmered: wound back towards the bend, or forward over most of the body in open
        // turns (Zulu, Griffith's Gnat); a collar or soft hackle covers a short span.
        if (step.to !== undefined && tiedAt !== null && (step.to < tiedAt || step.to - tiedAt > 0.5)) return "palmering";
        const kind = recipe.materials.find((m) => m.id === step.material)!.kind;
        return ["hen-hackle", "partridge-hackle", "snipe-hackle"].includes(kind) ? "soft-hackle" : "hackle-collar";
      }
      if (a === "herl") return "herl-body";
      // A wire, tinsel or thread wound over an earlier body is a rib.
      if ((a === "wire" || a === "tinsel" || a === "floss") && woundOverBody(recipe, index)) return "ribbing";
      return "wound-body";
    }
  }
}

/** Where the thread is when step `index` begins. */
function threadAt(recipe: Recipe, index: number): number {
  let thread = 0;
  for (const s of recipe.steps.slice(0, index)) {
    if (s.op === "attach-thread") thread = s.at;
    if (s.op === "wrap-thread" || s.op === "dub" || s.op === "spin") thread = s.to;
  }
  return thread;
}

/** Where the thread was when the material was tied in (shank fraction), or null. */
function tieInPosition(recipe: Recipe, before: number, material: string): number | null {
  let thread: number | null = null;
  for (let i = 0; i < before; i++) {
    const s = recipe.steps[i]!;
    if (s.op === "attach-thread") thread = s.at;
    if (s.op === "wrap-thread" || s.op === "dub" || s.op === "spin") thread = s.to;
    if (s.op === "tie-in" && s.material === material) return thread;
  }
  return null;
}

/** The stretch of shank each wound or dubbed step covers, by step index. */
function bodySpans(recipe: Recipe): Map<number, [number, number]> {
  const spans = new Map<number, [number, number]>();
  let thread = 0;
  recipe.steps.forEach((s, i) => {
    if (s.op === "dub") spans.set(i, [Math.min(thread, s.to), Math.max(thread, s.to)]);
    if (s.op === "wind" && s.to !== undefined) {
      const start = tieInPosition(recipe, i, s.material);
      if (start !== null) spans.set(i, [Math.min(start, s.to), Math.max(start, s.to)]);
    }
    if (s.op === "attach-thread") thread = s.at;
    if (s.op === "wrap-thread" || s.op === "dub" || s.op === "spin") thread = s.to;
  });
  return spans;
}

const overlap = (a: [number, number], b: [number, number]) => Math.min(a[1], b[1]) - Math.max(a[0], b[0]);

/**
 * Whether a winding is a rib: open turns over an earlier body (dubbing or another wound
 * material), or over a body of thread alone (no other material on that stretch at all,
 * as on a Greenwell's Glory). Bodies beside each other, and dense wire or tinsel bodies,
 * are not ribs.
 */
function woundOverBody(recipe: Recipe, index: number): boolean {
  const spans = bodySpans(recipe);
  const own = spans.get(index);
  const step = recipe.steps[index];
  if (!own || step?.op !== "wind") return false;
  const length = own[1] - own[0];
  const others = [...spans].filter(([i]) => (recipe.steps[i] as { material?: string }).material !== step.material);
  // Over most of an earlier body.
  if (others.some(([i, span]) => i < index && overlap(own, span) >= 0.5 * length)) return true;
  // Over a thread body: long, in open turns, and nothing else ever wound or dubbed there.
  const open = step.turns / Math.max(length, 0.01) < 12;
  return length >= 0.3 && open && others.every(([, span]) => overlap(own, span) <= 0);
}

/** The techniques a pattern uses, in the order they first appear. */
export function patternTechniques(recipe: Recipe): string[] {
  const seen: string[] = [];
  recipe.steps.forEach((_, i) => {
    const t = stepTechnique(recipe, i);
    if (t && !seen.includes(t)) seen.push(t);
  });
  return seen;
}

const DIFFICULTY_RANK = { beginner: 0, intermediate: 1, advanced: 2 };

export interface PathStage {
  recipe: Recipe;
  /** Techniques this pattern adds to what the earlier stages taught. */
  learns: string[];
}

/**
 * A learning path through the catalog: each pattern adds as few new techniques as
 * possible, easier patterns first, until every technique in the catalog is covered.
 */
export function learningPath(recipes: Recipe[]): PathStage[] {
  const mains = recipes.filter((r) => r.variantOf === undefined);
  const known = new Set<string>();
  const stages: PathStage[] = [];
  const remaining = new Set(mains);
  while (remaining.size > 0) {
    let best: { recipe: Recipe; learns: string[]; score: number } | null = null;
    for (const r of remaining) {
      const learns = patternTechniques(r).filter((t) => !known.has(t));
      if (learns.length === 0) continue;
      // Prefer easy patterns that add a few new things at a time.
      const score = DIFFICULTY_RANK[r.difficulty] * 10 + Math.abs(learns.length - 3) + r.steps.length / 100;
      if (!best || score < best.score) best = { recipe: r, learns, score };
    }
    if (!best) break;
    stages.push({ recipe: best.recipe, learns: best.learns });
    best.learns.forEach((t) => known.add(t));
    remaining.delete(best.recipe);
  }
  return stages;
}

/** An example of a technique in the catalog: a pattern and the step that shows it best. */
export function techniqueExample(recipes: Recipe[], id: string): { recipe: Recipe; step: number } | null {
  const candidates = recipes
    .filter((r) => r.variantOf === undefined)
    .sort((a, b) => DIFFICULTY_RANK[a.difficulty] - DIFFICULTY_RANK[b.difficulty] || a.steps.length - b.steps.length);
  for (const recipe of candidates) {
    const step = recipe.steps.findIndex((_, i) => stepTechnique(recipe, i) === id);
    if (step >= 0) return { recipe, step };
  }
  return null;
}

/** Patterns that use a technique. */
export function patternsUsing(recipes: Recipe[], id: string): Recipe[] {
  return recipes.filter((r) => r.variantOf === undefined && patternTechniques(r).includes(id));
}
