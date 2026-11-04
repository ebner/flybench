import type { RecipeError } from "./errors";
import { RULES, type RuleKey, type RuleParams } from "./rules";
import { MATERIALS, WINDABLE, type Archetype } from "./materials";
import type { Recipe } from "./schema";
import { hookModel } from "../tying/hook";

/** Positions closer than this are treated as the same spot on the shank. */
export const POSITION_TOLERANCE = 0.02;

// Assumption: the tips of hair bound back over the body stick out at least this far (gapes)
// behind the last turn, flaring as the turn cinches them.
export const TIPS_PAST_TURN = 0.15;

/** Materials that only make sense sticking out from where they are tied in. */
const NEEDS_LENGTH: readonly Archetype[] = ["hair", "feather", "biot", "marabou", "flash", "legs"];

/** Strands that can be tied across the shank as legs. */
const ACROSS: readonly Archetype[] = ["legs", "hair", "fibres", "biot", "flash"];

/** Materials that can stick out as one solid piece. */
const EXTENDABLE: readonly Archetype[] = ["chenille", "yarn", "foam"];

/** What can come out of the end of a body made on a needle, as its tails. */
const TAILS: readonly Archetype[] = ["hair", "fibres", "biot"];

/** What can be glued along the shank in pads (a crab's body). */
const GLUED: readonly Archetype[] = ["hair", "fibres", "yarn"];

/** Strands that can be woven as a two-coloured body. */
const WOVEN: readonly Archetype[] = ["chenille", "yarn", "floss"];

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
 *
 * A whip finish part-way through, followed by the thread attached again elsewhere, is allowed
 * (the rear of a Zonker finished at the bend, the front tied with the thread started again at
 * the eye); materials waiting to be pulled over or tied down wait across it.
 *
 * Two strands woven forward (a Bitch Creek's abdomen) are held at the front, where the thread
 * waits or is attached again (weaving is done with the thread cut or parked), and both are tied
 * off there next.
 *
 * Fibres glued along the shank (a crab's body) need no thread, so they can be glued on after the
 * whip finish, and are trimmed to shape like spun hair.
 *
 * Hair folded back and tied down by the thread (a bullet head) trails its tips behind the
 * tie-down; only over such hair can the thread go on past the bend, binding it into an extended
 * body, and there it only winds on or back (the tips may be trimmed meanwhile).
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

  // `sleeved`: tubing tied down at one end, its other end (`at`) still to be tied off.
  type State = "tied-in" | "wound" | "wound-rear" | "secured" | "laid-back" | "sleeved" | "done";
  // `wound`: wound round the hook or a post (not pulled over); `kept`: already trimmed with keep;
  // `hanging`: the step that tied it in without a length, so it waits to be wound or pulled over.
  const materials = new Map<
    string,
    { state: State; at: number; butts: boolean; post?: boolean; wound?: boolean; kept?: boolean; hanging?: number; spun?: boolean; glued?: boolean }
  >();
  let thread: number | null = null;
  let weighted = false;
  let finished = false;
  /** A material that the next step has to tie off or secure. */
  let pending: { material: string; rear: boolean } | null = null;
  /** Woven strands held at `at`, each still to be tied off there. */
  let woven: { at: number; left: string[] } | null = null;
  /**
   * Hair folded back and tied down, its tips trailing loose behind the tie-down until trimmed: where
   * it is tied down and how far back the thread can bind it (shank fractions), its tips still
   * sticking out behind the last turn.
   */
  const trailing = new Map<string, { at: number; reach: number }>();
  // Lengths are in gapes, positions in shank fractions. (With a bead the positions run a little
  // short of the eye, so this is the stricter measure.)
  const shank = hookModel(recipe.hook).shankLength;
  const lengths = new Map<string, number>();
  /** Where each material was tied in (an upright post's place, for a strip parted round it). */
  const postAt = new Map<string, number>();

  recipe.steps.forEach((step, i) => {
    const path = ["steps", i];
    // Trimming after the whip finish is common (heads, hackles), or the thread is started again.
    // (Weaving is done with the thread cut, too, and gluing needs no thread.)
    if (finished && step.op !== "trim" && step.op !== "attach-thread" && step.op !== "weave" && step.op !== "glue") {
      rule("afterWhipFinish", {}, path);
      return;
    }
    if ("material" in step && !archetypes.has(step.material)) {
      rule("unknownMaterial", { m: step.material }, [...path, "material"]);
      return;
    }
    if (step.op === "weave" && !archetypes.has(step.under)) {
      rule("unknownMaterial", { m: step.under }, [...path, "under"]);
      return;
    }
    const archetype = "material" in step ? archetypes.get(step.material)! : null;

    // Woven strands held at the front: the thread attached there again, if it was cut, and both tied off.
    if (woven) {
      const w = woven;
      if (step.op === "attach-thread" && finished) {
        if (Math.abs(step.at - w.at) > POSITION_TOLERANCE) rule("threadForPull", { thread: step.at, to: w.at }, [...path, "at"]);
      } else if (step.op === "tie-off" && w.left.includes(step.material)) {
        w.left = w.left.filter((m) => m !== step.material);
      } else {
        rule("tieOffWoven", { m: w.left[0]! }, path);
        w.left = [];
      }
      if (w.left.length === 0) woven = null;
    }

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
        const laid = end.state === "laid-back";
        if (securing) end.state = laid ? "done" : "secured";
        else rule(laid ? "secureLaidBack" : "securePalmer", { m: p.material }, path);
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
    // Glued on, with no thread: before it is attached, too.
    if (step.op === "glue") {
      if (!GLUED.includes(archetype!)) rule("onlyGlued", { m: step.material }, [...path, "material"]);
      else if (step.to <= step.from + POSITION_TOLERANCE) rule("glueForward", {}, [...path, "to"]);
      else if (materials.has(step.material)) rule("alreadyOnHook", { m: step.material }, [...path, "material"]);
      else materials.set(step.material, { state: "done", at: step.from, butts: true, spun: true, glued: true });
      return;
    }
    if (step.op === "attach-thread") {
      if (thread !== null && !finished) rule("threadAttached", {}, path);
      thread = step.at;
      finished = false;
      return;
    }
    // A body glued on before the thread is trimmed without it, too: to a disc, or cut flat.
    const glued = step.op === "trim" ? materials.get(step.material) : undefined;
    if (thread === null && step.op === "trim" && glued?.glued) {
      if (step.keep === undefined && step.shape !== "disc") rule("gluedDisc", { m: step.material }, [...path, "shape"]);
      if (step.keep === undefined && glued.spun) Object.assign(glued, { butts: false, spun: false });
      else if (step.keep === undefined) rule("nothingToTrim", { m: step.material }, [...path, "material"]);
      return;
    }
    if (thread === null) {
      rule("threadFirst", {}, path);
      return;
    }
    // Past the bend the thread is round nothing but hair: it can only wind on or back from there.
    if (thread < -POSITION_TOLERANCE && step.op !== "wrap-thread" && step.op !== "trim") {
      rule("threadPastBend", {}, path);
      return;
    }


    switch (step.op) {
      case "wrap-thread":
        if (Math.abs(step.to - thread) < POSITION_TOLERANCE) rule("threadThere", {}, [...path, "to"]);
        else if (step.to < -POSITION_TOLERANCE && trailing.size === 0) rule("pastBendHair", {}, [...path, "to"]);
        else if (step.to < thread) {
          // Spiralled back over trailing hair, as far as the hair reaches.
          for (const [m, t] of trailing) {
            if (step.to < t.at - POSITION_TOLERANCE && step.to < t.reach - 0.005) {
              rule("hairTooShort", { m, to: Math.ceil(t.reach * 100) / 100 }, [...path, "to"]);
              break;
            }
          }
        }
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
        else materials.set(step.material, { state: "done", at: thread, butts: true, spun: true });
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
        if (archetype === "tubing") {
          rule("tubingSleeve", {}, [...path, "material"]);
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
        // A strip to be pulled over (foam) is cut to a width, perhaps tapered to a point where it is tied in.
        const strip = step.length === undefined && pulledOver && archetype !== "hair";
        if (step.width !== undefined && archetype !== "feather" && !step.extended && !strip) {
          rule("widthOnly", {}, [...path, "width"]);
        }
        if (step.taper && (step.width === undefined || !strip)) rule("taperOnly", {}, [...path, "taper"]);
        // (Strands tied across fan out from leaning back to leaning forward: a crab's legs.)
        const fans = step.side === "across" ? step.length !== undefined : step.length !== undefined && (step.angle ?? 0) >= 60 && archetype !== "feather";
        if (step.fan !== undefined && !fans) {
          rule("fanOnly", {}, [...path, "fan"]);
        }
        // Without a length, side=under only for a strip pulled over the belly later.
        const pulledLater = recipe.steps.slice(i + 1).some((s) => s.op === "pull-over" && s.material === step.material);
        if (step.side !== undefined && step.length === undefined && archetype !== "eyes" && !(step.side === "under" && pulledLater)) {
          rule("sideOnly", {}, [...path, "side"]);
        }
        if (step.side === "across" && !ACROSS.includes(archetype!)) {
          rule("acrossOnly", {}, [...path, "side"]);
        }
        // Without a length, only a strip that waits over the eye to be folded back (a foam balloon).
        if (step.forward && step.length === undefined && !recipe.steps.slice(i + 1).some((s) => s.op === "pull-over" && s.material === step.material)) {
          rule("forwardNeedsLength", {}, [...path, "forward"]);
        }
        if (step.forward && (step.angle ?? 0) >= 60) rule("forwardUpright", {}, [...path, "angle"]);
        if (step.extended && (!EXTENDABLE.includes(archetype!) || step.length === undefined)) {
          rule("extendedOnly", {}, [...path, "extended"]);
        }
        if (step.tip !== undefined && !step.extended) rule("tipOnly", {}, [...path, "tip"]);
        // A body made beforehand on a needle: bound into segments, its tails tied in at its tip first.
        const made = (["segments", "tails", "tail-length", "tail-spread"] as const).find((k) => step[k] !== undefined);
        if (made && !step.extended) rule("madeBodyOnly", {}, [...path, made]);
        else if (step.tails !== undefined) {
          const tails = archetypes.get(step.tails);
          if (!tails) rule("unknownMaterial", { m: step.tails }, [...path, "tails"]);
          else if (!TAILS.includes(tails)) rule("tailsOnly", { m: step.tails }, [...path, "tails"]);
          else if (materials.has(step.tails) || step.tails === step.material) rule("alreadyTiedIn", { m: step.tails }, [...path, "tails"]);
          else materials.set(step.tails, { state: "done", at: thread, butts: false });
        }
        if (step.extended && (step.tails === undefined ? step["tail-length"] !== undefined || step["tail-spread"] !== undefined : step["tail-length"] === undefined)) {
          rule("tailsLength", {}, [...path, step.tails === undefined ? "tail-length" : "tails"]);
        }
        if (step.length !== undefined) lengths.set(step.material, step.length);
        if (!postAt.has(step.material)) postAt.set(step.material, thread);
        if (materials.has(step.material)) rule("alreadyTiedIn", { m: step.material }, [...path, "material"]);
        else {
          materials.set(step.material, {
            // Eyes, extended bodies and legs across the shank are finished once tied in; the rest
            // of a strip whose extended part is made (a Mohican's foam) may wait to be pulled over.
            state: archetype === "eyes" || (step.extended && !pulledOver) || step.side === "across" ? "done" : "tied-in",
            at: thread,
            // Tied in pointing forward, the butts lie back along the shank under the turns (cut
            // square first, as for a bullet head), with nothing to trim.
            butts: archetype === "hair" && step.side !== "across" && !step.forward,
            hanging: step.length === undefined ? i : undefined,
            // Only an upright bunch makes a post a hackle can be wound round: not a feather
            // pair, an extended body, a fur strip (it sticks out as one piece) or strands tied across.
            post:
              step.length !== undefined &&
              (step.angle ?? 0) >= 60 &&
              archetype !== "feather" &&
              archetype !== "strip" &&
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
        if (step.around !== undefined) {
          // Parted round an upright post it passes on its way forward.
          const post = materials.get(step.around);
          const at = postAt.get(step.around);
          if (!post?.post || at === undefined || step.to <= m.at + POSITION_TOLERANCE || at <= m.at + POSITION_TOLERANCE || at >= step.to - POSITION_TOLERANCE) {
            rule("splitAroundPost", { m: step.material, post: step.around }, [...path, "around"]);
          }
        }
        // Folded back over itself in front of the tie-down as a head: foam pulled forward.
        if (step.fold !== undefined && (archetype !== "foam" || step.to <= m.at + POSITION_TOLERANCE || step.bubble !== undefined || step.around !== undefined)) {
          rule("foldOnly", {}, [...path, "fold"]);
        }
        if (Math.abs(step.to - m.at) <= POSITION_TOLERANCE) {
          rule("pullForward", { m: step.material }, [...path, "to"]);
          m.state = "done";
        } else if (step.to < m.at && Math.abs(step.to - thread) <= POSITION_TOLERANCE) {
          // Folded back from where it is tied in and tied down there by the thread (a foam
          // balloon over a thorax). Hair's tips trail behind the tie-down (a bullet head).
          m.state = "done";
          if (archetype === "hair" && m.hanging === undefined) {
            // As long behind where it was tied in as it was in front.
            trailing.set(step.material, { at: step.to, reach: (m.at * shank - (lengths.get(step.material) ?? 0) + TIPS_PAST_TURN) / shank });
          }
        } else if (step.to < m.at) {
          // Laid back from where it is tied in (a shellback tied in at the eye): its end is held
          // by the next step, a winding forward over it, as a palmered tip is.
          m.at = step.to;
          m.state = "laid-back";
          pending = { material: step.material, rear: true };
        } else {
          // Tied down by the thread, so it ends where the thread is.
          if (Math.abs(step.to - thread) > POSITION_TOLERANCE) {
            rule("threadForPull", { thread, to: step.to }, [...path, "to"]);
          }
          m.state = "done";
        }
        // Foam and fur strips are cut after they are tied down (flush, or leaving a head), and the
        // tips of hair folded back behind where it is bound; other strips are trimmed at once.
        m.butts = archetype === "foam" || archetype === "strip" || trailing.has(step.material);
        break;
      }
      case "weave": {
        const before = errors.length;
        const strands = [[step.material, "material"], [step.under, "under"]] as const;
        for (const [id, key] of strands) {
          const m = materials.get(id);
          if (!WOVEN.includes(archetypes.get(id)!)) rule("onlyWoven", { m: id }, [...path, key]);
          else if (!m || m.state !== "tied-in" || m.hanging === undefined) rule("tieInBeforeWeave", { m: id }, [...path, key]);
        }
        if (step.under === step.material) rule("weaveTwo", {}, [...path, "under"]);
        if (errors.length > before) break;
        const top = materials.get(step.material)!;
        const under = materials.get(step.under)!;
        if (Math.abs(top.at - under.at) > POSITION_TOLERANCE) rule("weaveTogether", { m: step.under }, [...path, "under"]);
        else if (step.to <= Math.max(top.at, under.at) + POSITION_TOLERANCE) rule("weaveForward", {}, [...path, "to"]);
        // With the thread on the hook, it waits where the weave ends.
        else if (!finished && Math.abs(step.to - thread) > POSITION_TOLERANCE) rule("threadForPull", { thread, to: step.to }, [...path, "to"]);
        for (const m of [top, under]) Object.assign(m, { state: "wound", wound: true, at: step.to });
        woven = { at: step.to, left: [step.material, step.under] };
        break;
      }
      case "sleeve": {
        if (archetype !== "tubing") rule("onlyTubing", { m: step.material }, [...path, "material"]);
        else if (Math.abs(step.to - thread) <= POSITION_TOLERANCE) rule("sleeveFromThread", {}, [...path, "to"]);
        else if (materials.has(step.material)) rule("alreadyOnHook", { m: step.material }, [...path, "material"]);
        // Tied down at the thread; the end at `to` waits to be tied off.
        else materials.set(step.material, { state: "sleeved", at: step.to, butts: false });
        break;
      }
      case "tie-off": {
        const m = materials.get(step.material);
        if (m?.state === "sleeved") {
          // The sleeve's other end, tied down where the thread is.
          if (Math.abs(m.at - thread) > POSITION_TOLERANCE) rule("threadForPull", { thread, to: m.at }, [...path, "material"]);
          m.state = "done";
        } else if (!m || m.state !== "wound") rule("windBeforeTieOff", { m: step.material }, [...path, "material"]);
        else m.state = "done";
        break;
      }
      case "trim": {
        const m = materials.get(step.material);
        if (step.keep !== undefined) {
          // Spun hair cut flat on top or underneath (or both), the sides left long, until it is
          // trimmed to a shape.
          if ((archetype === "hair" || m?.glued) && m?.spun) break;
          if (archetype !== "hackle" || m?.state !== "done" || !m.wound) rule("keepOnly", {}, [...path, "keep"]);
          else if (m.kept) rule("alreadyKept", { m: step.material }, [...path, "keep"]);
          else m.kept = true;
          break;
        }
        // Pads laid across the shank can be clipped round into a disc or cut flat, not spun into a head.
        if (m?.glued && m.spun && step.shape !== "disc") rule("gluedDisc", { m: step.material }, [...path, "shape"]);
        // A disc keeps the width hair stands out round the shank: butts lying along it have none.
        if (step.shape === "disc" && !m?.spun) rule("discOnly", {}, [...path, "shape"]);
        if (m?.state === "secured") {
          m.state = "done";
        } else if (m?.butts) {
          m.butts = false;
          m.spun = false;
          trailing.delete(step.material);
        } else {
          rule("nothingToTrim", { m: step.material }, [...path, "material"]);
        }
        if (step.leave !== undefined && archetype !== "hair" && archetype !== "foam" && archetype !== "strip" && !m?.glued) {
          rule("leaveOnly", {}, [...path, "leave"]);
        }
        if (step.shape !== undefined && archetype !== "hair" && !m?.glued) {
          rule("shapeOnly", {}, [...path, "shape"]);
        }
        break;
      }
      case "whip-finish":
        finished = true;
        break;
    }
  });

  if (woven) rule("neverTiedOff", { m: (woven as { left: string[] }).left[0]!, rear: false }, ["steps", recipe.steps.length - 1]);
  if (pending) {
    const p = pending as { material: string; rear: boolean };
    if (materials.get(p.material)?.state === "laid-back") rule("secureLaidBack", { m: p.material }, ["steps", recipe.steps.length - 1]);
    else rule("neverTiedOff", { m: p.material, rear: p.rear }, ["steps", recipe.steps.length - 1]);
  }
  for (const [id, m] of materials) {
    if (m.state === "secured") rule("trimTip", { m: id }, ["steps"]);
    if (m.state === "sleeved") rule("sleeveOpen", { m: id }, ["steps"]);
    if (m.state === "tied-in" && m.hanging !== undefined) {
      rule("neverUsedAfterTieIn", { m: id }, ["steps", m.hanging, "material"]);
    }
  }
  const used = new Set(
    recipe.steps.flatMap((s) => ["material" in s ? s.material : [], "around" in s && s.around ? s.around : [], s.op === "weave" ? s.under : [], s.op === "tie-in" && s.tails ? s.tails : []].flat()),
  );
  recipe.materials.forEach((m, i) => {
    if (!used.has(m.id)) rule("neverUsed", { m: m.id }, ["materials", i, "id"]);
  });
  if (!finished) rule("endWithWhipFinish", {}, ["steps"]);
  if (recipe.sits && !floats(recipe)) rule("sitsFloats", {}, ["sits"]);
  return errors;
}

/** Whether a fly floats, as src/tying/fishing.ts derives where it fishes: dry flies, terrestrials and emergers do. */
export function floats(recipe: Pick<Recipe, "type" | "fishes">): boolean {
  return recipe.fishes ? recipe.fishes === "surface" || recipe.fishes === "film" : ["dry", "terrestrial", "emerger"].includes(recipe.type);
}
