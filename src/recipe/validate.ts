import type { RecipeError } from "./errors";
import { MATERIALS, WINDABLE, type Archetype } from "./materials";
import type { Recipe } from "./schema";

/** Positions closer than this are treated as the same spot on the shank. */
export const POSITION_TOLERANCE = 0.02;

/** Materials that only make sense sticking out from where they are tied in. */
const NEEDS_LENGTH: readonly Archetype[] = ["hair", "feather", "biot", "marabou", "flash", "legs"];

/** Strands that can be tied across the shank as legs. */
const ACROSS: readonly Archetype[] = ["legs", "hair", "fibres", "biot", "flash"];

/** Materials that can stick out as one solid piece. */
const EXTENDABLE: readonly Archetype[] = ["chenille", "yarn", "foam"];

/**
 * Checks that the step sequence is something a tyer could actually do.
 *
 * Beads go on before the thread; weighting wire may go on before or after it.
 * Tie-ins, tie-offs and the whip finish happen at the current thread position,
 * which only attach-thread, wrap-thread, dub and spin change.
 *
 * A material wound forward (or round a parachute post) ends at the thread and is
 * tied off in the next step. A material wound rearward (palmered) ends away from the
 * thread; the next step must wind another material forward over its end to secure it
 * (the classic wire rib through a palmered hackle), and its tip is trimmed later.
 */
export function validateSemantics(recipe: Recipe): RecipeError[] {
  const errors: RecipeError[] = [];
  const err = (message: string, path: (string | number)[]) => errors.push({ message, path });

  const archetypes = new Map<string, Archetype>();
  recipe.materials.forEach((m, i) => {
    if (archetypes.has(m.id)) err(`material "${m.id}" is defined more than once`, ["materials", i, "id"]);
    archetypes.set(m.id, MATERIALS[m.kind].archetype);
  });

  type State = "tied-in" | "wound" | "wound-rear" | "secured" | "done";
  // `wound`: wound round the hook or a post (not pulled over); `kept`: already trimmed with keep.
  const materials = new Map<string, { state: State; at: number; butts: boolean; post?: boolean; wound?: boolean; kept?: boolean }>();
  let thread: number | null = null;
  let finished = false;
  /** A material that the next step has to tie off or secure. */
  let pending: { material: string; rear: boolean } | null = null;

  recipe.steps.forEach((step, i) => {
    const path = ["steps", i];
    // Trimming after the whip finish is common (heads, hackles); nothing else is.
    if (finished && step.op !== "trim") {
      err("nothing but trimming can follow the whip finish", path);
      return;
    }
    if ("material" in step && !archetypes.has(step.material)) {
      err(`unknown material "${step.material}"`, [...path, "material"]);
      return;
    }
    const archetype = "material" in step ? archetypes.get(step.material)! : null;

    // What was just wound comes first: nothing, not even weighting, may come in between.
    if (pending) {
      const p = pending;
      pending = null;
      if (!p.rear && !(step.op === "tie-off" && step.material === p.material)) {
        err(`"${p.material}" was just wound and must be tied off before anything else`, path);
      } else if (p.rear) {
        const end = materials.get(p.material)!;
        // Wound forward from at or behind the palmered tip, and over it.
        const securing =
          step.op === "wind" &&
          step.material !== p.material &&
          (materials.get(step.material)?.at ?? Infinity) <= end.at + POSITION_TOLERANCE &&
          step.to !== undefined &&
          step.to > end.at + POSITION_TOLERANCE;
        if (securing) end.state = "secured";
        else err(`"${p.material}" was palmered back and must be secured by winding another material forward over its tip`, path);
      }
    }

    // Steps that can come before the thread.
    if (step.op === "slide-bead") {
      if (archetype !== "bead") err(`"${step.material}" is not a bead`, [...path, "material"]);
      else if (thread !== null) err("slide the bead on before attaching the thread", path);
      else if (materials.has(step.material)) err(`"${step.material}" is already on the hook`, path);
      else materials.set(step.material, { state: "done", at: 1, butts: false });
      return;
    }
    if (step.op === "weight") {
      if (archetype !== "wire") err(`weighting is done with wire, not "${step.material}"`, [...path, "material"]);
      if (step.to <= step.from + POSITION_TOLERANCE) err("the weighting must run forward from `from` to `to`", [...path, "to"]);
      return;
    }
    if (step.op === "attach-thread") {
      if (thread !== null) err("the thread is already attached", path);
      thread = step.at;
      return;
    }
    if (thread === null) {
      err("the thread must be attached first", path);
      return;
    }


    switch (step.op) {
      case "wrap-thread":
        if (Math.abs(step.to - thread) < POSITION_TOLERANCE) err("the thread is already there", [...path, "to"]);
        thread = step.to;
        break;
      case "dub":
        if (archetype !== "dubbing") {
          err(`only dubbing can be dubbed; tie in "${step.material}" instead`, [...path, "material"]);
        } else if (Math.abs(step.to - thread) < POSITION_TOLERANCE) {
          err("the thread is already there", [...path, "to"]);
        }
        thread = step.to;
        break;
      case "spin":
        if (archetype !== "hair") err(`only hair can be spun, not "${step.material}"`, [...path, "material"]);
        else if (step.to <= thread + POSITION_TOLERANCE) err("spin the hair forward from the thread", [...path, "to"]);
        else materials.set(step.material, { state: "done", at: thread, butts: true });
        thread = step.to;
        break;
      case "tie-in": {
        if (archetype === "dubbing") {
          err(`dubbing is applied to the thread with "dub", not tied in`, [...path, "material"]);
          break;
        }
        if (archetype === "bead") {
          err(`beads go on with "slide-bead" before the thread`, [...path, "material"]);
          break;
        }
        if (step.forward && archetype === "feather") err("feathers are tied in pointing back, not forward", [...path, "forward"]);
        // A feather slip pulled over as a wing case lies on the body instead of sticking out.
        const pulledOver = recipe.steps.slice(i + 1).some((s) => s.op === "pull-over" && s.material === step.material);
        if (NEEDS_LENGTH.includes(archetype!) && step.length === undefined && !(archetype === "feather" && pulledOver)) {
          err(`${MATERIALS[recipe.materials.find((m) => m.id === step.material)!.kind].name} sticks out from where it is tied in, so it needs a length`, [...path, "material"]);
        }
        if (archetype === "eyes" && step.length !== undefined) err("eyes do not take a length", [...path, "length"]);
        if (step.angle !== undefined && step.length === undefined) {
          err("an angle only applies to material tied in with a length", [...path, "angle"]);
        }
        if (step.spread !== undefined && step.length === undefined) {
          err("spread only applies to tags, tails and wings tied in with a length", [...path, "spread"]);
        }
        if (step.width !== undefined && archetype !== "feather") {
          err("width only applies to feather wings", [...path, "width"]);
        }
        if (step.side !== undefined && step.length === undefined && archetype !== "eyes") {
          err("side only applies to tails, beards, wings and eyes", [...path, "side"]);
        }
        if (step.side === "across" && !ACROSS.includes(archetype!)) {
          err("only legs and strands of hair, fibres, biots or flash can be tied across the shank", [...path, "side"]);
        }
        if (step.forward && step.length === undefined) err("forward only applies to material tied in with a length", [...path, "forward"]);
        if (step.forward && (step.angle ?? 0) >= 60) err("a material pointing forward can't also stand upright", [...path, "angle"]);
        if (step.extended && (!EXTENDABLE.includes(archetype!) || step.length === undefined)) {
          err("only chenille, yarn or foam tied in with a length can be extended", [...path, "extended"]);
        }
        if (step.tip !== undefined && !step.extended) err("tip only applies to extended bodies", [...path, "tip"]);
        if (materials.has(step.material)) err(`"${step.material}" is already tied in`, [...path, "material"]);
        else {
          materials.set(step.material, {
            // Eyes, extended bodies and legs across the shank are finished once tied in.
            state: archetype === "eyes" || step.extended || step.side === "across" ? "done" : "tied-in",
            at: thread,
            butts: archetype === "hair" && step.side !== "across",
            // Only an upright bunch makes a post a hackle can be wound round: not a feather
            // pair, an extended body or strands tied across.
            post:
              step.length !== undefined &&
              (step.angle ?? 0) >= 60 &&
              archetype !== "feather" &&
              !step.extended &&
              step.side !== "across",
          });
        }
        break;
      }
      case "wind": {
        const m = materials.get(step.material);
        if (!m) {
          err(`"${step.material}" must be tied in before it can be wound`, [...path, "material"]);
          break;
        }
        if (m.state !== "tied-in") {
          err(`"${step.material}" has already been wound`, [...path, "material"]);
          break;
        }
        if (!WINDABLE.includes(archetype!)) {
          err(`${archetype} can't be wound`, [...path, "material"]);
          break;
        }
        if ((step.to === undefined) === (step.around === undefined)) {
          err("give either `to` (along the shank) or `around` (a parachute post)", path);
        }
        if (step.counter && step.around !== undefined) {
          err("counter applies to winding along the shank, not round a post", [...path, "counter"]);
          break;
        }
        if (step.around !== undefined) {
          const post = materials.get(step.around);
          if (archetype !== "hackle") err("only hackle is wound around a post", [...path, "material"]);
          else if (!post?.post) err(`"${step.around}" must be a bunch tied in upright (angle 60° or more) to be a post`, [...path, "around"]);
          m.state = "wound";
          m.wound = true;
          pending = { material: step.material, rear: false };
          break;
        }
        const to = step.to!;
        if (Math.abs(to - m.at) <= POSITION_TOLERANCE) {
          err(`"${step.material}" is tied in at ${m.at}; wind it forward or back from there`, [...path, "to"]);
          break;
        }
        const rear = to < m.at;
        if (!rear && to > thread + POSITION_TOLERANCE) {
          err(`the thread is at ${thread}; move it to ${to} or beyond before winding there`, [...path, "to"]);
        }
        m.state = rear ? "wound-rear" : "wound";
        m.wound = true;
        m.at = to;
        pending = { material: step.material, rear };
        break;
      }
      case "pull-over": {
        const m = materials.get(step.material);
        if (!m || m.state !== "tied-in") {
          err(`"${step.material}" must be tied in (and not yet used) before it is pulled over`, [...path, "material"]);
          break;
        }
        if (step.to <= m.at + POSITION_TOLERANCE) err(`pull "${step.material}" forward from where it is tied in`, [...path, "to"]);
        // Tied down by the thread, so it ends where the thread is.
        if (Math.abs(step.to - thread) > POSITION_TOLERANCE) {
          err(`the thread is at ${thread}; move it to ${step.to} to tie the material down there`, [...path, "to"]);
        }
        m.state = "done";
        // Foam is cut after it is tied down, flush or leaving a head; other strips are trimmed at once.
        m.butts = archetype === "foam";
        break;
      }
      case "tie-off": {
        const m = materials.get(step.material);
        if (!m || m.state !== "wound") err(`"${step.material}" must be wound forward before it is tied off`, [...path, "material"]);
        else m.state = "done";
        break;
      }
      case "trim": {
        const m = materials.get(step.material);
        if (step.keep !== undefined) {
          if (archetype !== "hackle" || m?.state !== "done" || !m.wound) err("keep only applies to a hackle that has been wound and tied off", [...path, "keep"]);
          else if (m.kept) err(`"${step.material}" has already been trimmed with keep`, [...path, "keep"]);
          else m.kept = true;
          break;
        }
        if (m?.state === "secured") {
          m.state = "done";
        } else if (m?.butts) {
          m.butts = false;
        } else {
          err(`there is nothing of "${step.material}" to trim`, [...path, "material"]);
        }
        if (step.leave !== undefined && archetype !== "hair" && archetype !== "foam") {
          err("leave only applies to hair butts, spun hair and foam backs", [...path, "leave"]);
        }
        if (step.shape !== undefined && archetype !== "hair") {
          err("shape only applies to trimming spun hair or hair butts", [...path, "shape"]);
        }
        break;
      }
      case "whip-finish":
        finished = true;
        break;
    }
  });

  if (pending) {
    const p = pending as { material: string; rear: boolean };
    err(`"${p.material}" is wound but never ${p.rear ? "secured" : "tied off"}`, ["steps", recipe.steps.length - 1]);
  }
  for (const [id, m] of materials) {
    if (m.state === "secured") err(`the tip of "${id}" is still hanging at the bend; trim it`, ["steps"]);
  }
  if (!finished) err("the fly must end with a whip finish", ["steps"]);
  return errors;
}
