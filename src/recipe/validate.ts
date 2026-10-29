import type { RecipeError } from "./errors";
import { RULES, type RuleKey, type RuleParams } from "./rules";
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
  const rule = <K extends RuleKey>(key: K, params: RuleParams<K>, path: (string | number)[]) =>
    errors.push({ message: (RULES[key] as (p: RuleParams<K>) => string)(params), path, rule: key, params: params as Record<string, unknown> });

  const archetypes = new Map<string, Archetype>();
  recipe.materials.forEach((m, i) => {
    if (archetypes.has(m.id)) rule("duplicateMaterial", { m: m.id }, ["materials", i, "id"]);
    archetypes.set(m.id, MATERIALS[m.kind].archetype);
  });

  type State = "tied-in" | "wound" | "wound-rear" | "secured" | "done";
  // `wound`: wound round the hook or a post (not pulled over); `kept`: already trimmed with keep;
  // `hanging`: the step that tied it in without a length, so it waits to be wound or pulled over.
  const materials = new Map<
    string,
    { state: State; at: number; butts: boolean; post?: boolean; wound?: boolean; kept?: boolean; hanging?: number }
  >();
  let thread: number | null = null;
  let weighted = false;
  let finished = false;
  /** A material that the next step has to tie off or secure. */
  let pending: { material: string; rear: boolean } | null = null;

  recipe.steps.forEach((step, i) => {
    const path = ["steps", i];
    // Trimming after the whip finish is common (heads, hackles); nothing else is.
    if (finished && step.op !== "trim") {
      rule("afterWhipFinish", {}, path);
      return;
    }
    if ("material" in step && !archetypes.has(step.material)) {
      rule("unknownMaterial", { m: step.material }, [...path, "material"]);
      return;
    }
    const archetype = "material" in step ? archetypes.get(step.material)! : null;

    // What was just wound comes first: nothing, not even weighting, may come in between.
    if (pending) {
      const p = pending;
      pending = null;
      if (!p.rear && !(step.op === "tie-off" && step.material === p.material)) {
        rule("tieOffNext", { m: p.material }, path);
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
        else rule("securePalmer", { m: p.material }, path);
      }
    }

    // Steps that can come before the thread.
    if (step.op === "slide-bead") {
      if (archetype !== "bead") rule("notABead", { m: step.material }, [...path, "material"]);
      else if (thread !== null) rule("beadBeforeThread", {}, path);
      // A bead can't pass over wire already on the shank.
      else if (weighted) rule("beadBeforeWeight", {}, path);
      else if (materials.has(step.material)) rule("alreadyOnHook", { m: step.material }, path);
      else materials.set(step.material, { state: "done", at: 1, butts: false });
      return;
    }
    if (step.op === "weight") {
      if (archetype !== "wire") rule("weightWithWire", { m: step.material }, [...path, "material"]);
      if (step.to <= step.from + POSITION_TOLERANCE) rule("weightForward", {}, [...path, "to"]);
      if (materials.has(step.material)) rule("alreadyOnHook", { m: step.material }, [...path, "material"]);
      else materials.set(step.material, { state: "done", at: step.from, butts: false });
      weighted = true;
      return;
    }
    if (step.op === "attach-thread") {
      if (thread !== null) rule("threadAttached", {}, path);
      thread = step.at;
      return;
    }
    if (thread === null) {
      rule("threadFirst", {}, path);
      return;
    }


    switch (step.op) {
      case "wrap-thread":
        if (Math.abs(step.to - thread) < POSITION_TOLERANCE) rule("threadThere", {}, [...path, "to"]);
        thread = step.to;
        break;
      case "dub":
        if (archetype !== "dubbing") {
          rule("onlyDubbing", { m: step.material }, [...path, "material"]);
        } else if (Math.abs(step.to - thread) < POSITION_TOLERANCE) {
          rule("threadThere", {}, [...path, "to"]);
        }
        thread = step.to;
        break;
      case "spin":
        if (archetype !== "hair") rule("onlyHairSpun", { m: step.material }, [...path, "material"]);
        else if (step.to <= thread + POSITION_TOLERANCE) rule("spinForward", {}, [...path, "to"]);
        else if (materials.has(step.material)) rule("alreadyOnHook", { m: step.material }, [...path, "material"]);
        else materials.set(step.material, { state: "done", at: thread, butts: true });
        thread = step.to;
        break;
      case "tie-in": {
        if (archetype === "dubbing") {
          rule("dubNotTie", {}, [...path, "material"]);
          break;
        }
        if (archetype === "bead") {
          rule("beadSlides", {}, [...path, "material"]);
          break;
        }
        if (step.forward && archetype === "feather") rule("featherBack", {}, [...path, "forward"]);
        // A feather slip pulled over as a wing case lies on the body instead of sticking out.
        const pulledOver = recipe.steps.slice(i + 1).some((s) => s.op === "pull-over" && s.material === step.material);
        if (NEEDS_LENGTH.includes(archetype!) && step.length === undefined && !(archetype === "feather" && pulledOver)) {
          rule("needsLength", { kind: recipe.materials.find((m) => m.id === step.material)!.kind }, [...path, "material"]);
        }
        if (archetype === "eyes" && step.length !== undefined) rule("eyesNoLength", {}, [...path, "length"]);
        if (step.angle !== undefined && step.length === undefined) {
          rule("angleNeedsLength", {}, [...path, "angle"]);
        }
        if (step.spread !== undefined && step.length === undefined) {
          rule("spreadOnly", {}, [...path, "spread"]);
        }
        if (step.width !== undefined && archetype !== "feather") {
          rule("widthOnly", {}, [...path, "width"]);
        }
        if (step.side !== undefined && step.length === undefined && archetype !== "eyes") {
          rule("sideOnly", {}, [...path, "side"]);
        }
        if (step.side === "across" && !ACROSS.includes(archetype!)) {
          rule("acrossOnly", {}, [...path, "side"]);
        }
        if (step.forward && step.length === undefined) rule("forwardNeedsLength", {}, [...path, "forward"]);
        if (step.forward && (step.angle ?? 0) >= 60) rule("forwardUpright", {}, [...path, "angle"]);
        if (step.extended && (!EXTENDABLE.includes(archetype!) || step.length === undefined)) {
          rule("extendedOnly", {}, [...path, "extended"]);
        }
        if (step.tip !== undefined && !step.extended) rule("tipOnly", {}, [...path, "tip"]);
        if (materials.has(step.material)) rule("alreadyTiedIn", { m: step.material }, [...path, "material"]);
        else {
          materials.set(step.material, {
            // Eyes, extended bodies and legs across the shank are finished once tied in.
            state: archetype === "eyes" || step.extended || step.side === "across" ? "done" : "tied-in",
            at: thread,
            butts: archetype === "hair" && step.side !== "across",
            hanging: step.length === undefined ? i : undefined,
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
          rule("tieInBeforeWind", { m: step.material }, [...path, "material"]);
          break;
        }
        if (m.state !== "tied-in") {
          rule("alreadyWound", { m: step.material }, [...path, "material"]);
          break;
        }
        if (!WINDABLE.includes(archetype!)) {
          rule("cantWind", { kind: recipe.materials.find((m) => m.id === step.material)!.kind }, [...path, "material"]);
          break;
        }
        if ((step.to === undefined) === (step.around === undefined)) {
          rule("toOrAround", {}, path);
          break;
        }
        if (step.counter && step.around !== undefined) {
          rule("counterAlong", {}, [...path, "counter"]);
          break;
        }
        if (step.around !== undefined) {
          const post = materials.get(step.around);
          if (archetype !== "hackle") rule("hackleAroundPost", {}, [...path, "material"]);
          else if (!post?.post) rule("notAPost", { post: step.around }, [...path, "around"]);
          m.state = "wound";
          m.wound = true;
          pending = { material: step.material, rear: false };
          break;
        }
        const to = step.to!;
        if (Math.abs(to - m.at) <= POSITION_TOLERANCE) {
          rule("windFromTieIn", { m: step.material, at: m.at }, [...path, "to"]);
          break;
        }
        const rear = to < m.at;
        // Wound forward, a material ends where the thread is, to be tied off there.
        if (!rear && to > thread + POSITION_TOLERANCE) {
          rule("threadElsewhere", { thread, to }, [...path, "to"]);
        } else if (!rear && to < thread - POSITION_TOLERANCE) {
          rule("windToThread", { thread, to }, [...path, "to"]);
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
          rule("tieInBeforePull", { m: step.material }, [...path, "material"]);
          break;
        }
        if (step.to <= m.at + POSITION_TOLERANCE) rule("pullForward", { m: step.material }, [...path, "to"]);
        // Tied down by the thread, so it ends where the thread is.
        if (Math.abs(step.to - thread) > POSITION_TOLERANCE) {
          rule("threadForPull", { thread, to: step.to }, [...path, "to"]);
        }
        m.state = "done";
        // Foam is cut after it is tied down, flush or leaving a head; other strips are trimmed at once.
        m.butts = archetype === "foam";
        break;
      }
      case "tie-off": {
        const m = materials.get(step.material);
        if (!m || m.state !== "wound") rule("windBeforeTieOff", { m: step.material }, [...path, "material"]);
        else m.state = "done";
        break;
      }
      case "trim": {
        const m = materials.get(step.material);
        if (step.keep !== undefined) {
          if (archetype !== "hackle" || m?.state !== "done" || !m.wound) rule("keepOnly", {}, [...path, "keep"]);
          else if (m.kept) rule("alreadyKept", { m: step.material }, [...path, "keep"]);
          else m.kept = true;
          break;
        }
        if (m?.state === "secured") {
          m.state = "done";
        } else if (m?.butts) {
          m.butts = false;
        } else {
          rule("nothingToTrim", { m: step.material }, [...path, "material"]);
        }
        if (step.leave !== undefined && archetype !== "hair" && archetype !== "foam") {
          rule("leaveOnly", {}, [...path, "leave"]);
        }
        if (step.shape !== undefined && archetype !== "hair") {
          rule("shapeOnly", {}, [...path, "shape"]);
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
    rule("neverTiedOff", { m: p.material, rear: p.rear }, ["steps", recipe.steps.length - 1]);
  }
  for (const [id, m] of materials) {
    if (m.state === "secured") rule("trimTip", { m: id }, ["steps"]);
    if (m.state === "tied-in" && m.hanging !== undefined) {
      rule("neverUsedAfterTieIn", { m: id }, ["steps", m.hanging, "material"]);
    }
  }
  const used = new Set(recipe.steps.flatMap((s) => ["material" in s ? s.material : [], "around" in s && s.around ? s.around : []].flat()));
  recipe.materials.forEach((m, i) => {
    if (!used.has(m.id)) rule("neverUsed", { m: m.id }, ["materials", i, "id"]);
  });
  if (!finished) rule("endWithWhipFinish", {}, ["steps"]);
  return errors;
}
