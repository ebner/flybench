import type { RecipeError } from "./errors";
import { MATERIALS, type Archetype } from "./materials";
import type { Recipe } from "./schema";

/** Positions closer than this are treated as the same spot on the shank. */
export const POSITION_TOLERANCE = 0.02;

/**
 * Checks that the step sequence is something a tyer could actually do.
 *
 * Tie-ins, tie-offs and the whip finish happen at the current thread position,
 * which only attach-thread, wrap-thread and dub change.
 *
 * A material wound forward ends at the thread and is tied off in the next step.
 * A material wound rearward (palmered) ends away from the thread; the next step
 * must wind another material forward over its end to secure it (the classic
 * wire rib through a palmered hackle), and its tip is trimmed later.
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
  const materials = new Map<string, { state: State; at: number; butts: boolean }>();
  let thread: number | null = null;
  let finished = false;
  /** A material that the next step has to tie off or secure. */
  let pending: { material: string; rear: boolean } | null = null;

  recipe.steps.forEach((step, i) => {
    const path = ["steps", i];
    if (finished) {
      err("nothing can follow the whip finish", path);
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
    if ("material" in step && !archetypes.has(step.material)) {
      err(`unknown material "${step.material}"`, [...path, "material"]);
      return;
    }

    if (pending) {
      const p = pending;
      pending = null;
      if (!p.rear && !(step.op === "tie-off" && step.material === p.material)) {
        err(`"${p.material}" was just wound and must be tied off before anything else`, path);
      } else if (p.rear) {
        const end = materials.get(p.material)!;
        const securing =
          step.op === "wind" &&
          step.material !== p.material &&
          (materials.get(step.material)?.at ?? Infinity) <= end.at + POSITION_TOLERANCE;
        if (securing) end.state = "secured";
        else err(`"${p.material}" was palmered back and must be secured by winding another material forward over its tip`, path);
      }
    }

    const archetype = "material" in step ? archetypes.get(step.material)! : null;
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
      case "tie-in": {
        if (archetype === "dubbing") {
          err(`dubbing is applied to the thread with "dub", not tied in`, [...path, "material"]);
          break;
        }
        if ((archetype === "hair" || archetype === "feather") && step.length === undefined) {
          err(`a ${archetype} wing needs a length`, [...path, "material"]);
        }
        if (step.angle !== undefined && step.length === undefined) {
          err("an angle only applies to material tied in with a length", [...path, "angle"]);
        }
        if (step.spread !== undefined && (step.length === undefined || archetype === "feather")) {
          err("spread only applies to tags, tails and hair wings tied in with a length", [...path, "spread"]);
        }
        if (step.width !== undefined && archetype !== "feather") {
          err("width only applies to feather wings", [...path, "width"]);
        }
        if (materials.has(step.material)) err(`"${step.material}" is already tied in`, [...path, "material"]);
        else materials.set(step.material, { state: "tied-in", at: thread, butts: archetype === "hair" });
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
        if (Math.abs(step.to - m.at) <= POSITION_TOLERANCE) {
          err(`"${step.material}" is tied in at ${m.at}; wind it forward or back from there`, [...path, "to"]);
          break;
        }
        const rear = step.to < m.at;
        if (!rear && step.to > thread + POSITION_TOLERANCE) {
          err(`the thread is at ${thread}; move it to ${step.to} or beyond before winding there`, [...path, "to"]);
        }
        m.state = rear ? "wound-rear" : "wound";
        m.at = step.to;
        pending = { material: step.material, rear };
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
        if (m?.state === "secured") {
          m.state = "done";
        } else if (m?.butts) {
          m.butts = false;
        } else {
          err(`there is nothing of "${step.material}" to trim`, [...path, "material"]);
        }
        if (step.leave !== undefined && archetype !== "hair") {
          err("leave only applies to hair butts", [...path, "leave"]);
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
  if (!finished && thread !== null) err("the fly must end with a whip finish", ["steps"]);
  return errors;
}
