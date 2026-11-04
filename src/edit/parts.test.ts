import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { loadRecipe } from "../recipe/load";
import type { Recipe } from "../recipe/schema";
import { simulate } from "../tying/simulate";
import { blankFly, PATTERN_FORM, recipeText } from "./own";
import { mulberry32 } from "../render/random";
import {
  addMaterial, addPart, bareHook, blends, compile, kindsFor, MATERIAL_RANGES, materialChoices, newPart, partRange, partsOf, presetFor, PRESETS, rearLimit, removeMaterial, removePart, ROLES, setHow, setMaterial, setPart, startFrom, STYLES, unavailable, waysFor, waysOf, type How, type NumberKey, type NumberRange, type PartsFly, type Preset,
} from "./parts";

describe("a blended bunch in the builder", () => {
  it("keeps its colours only while it is tied as a bunch", () => {
    const tummel = patterns.find((r) => r.id === "tummel-shrimp")!;
    const fly = partsOf(tummel)!;
    expect(compile(fly).recipe.materials.find((m) => m.id === "tail")?.mix).toBe("yellow black");
    const across = { ...fly, parts: fly.parts.map((p) => (p.id === "tail" ? { ...p, side: "across" as const } : p)) };
    const out = compile(across);
    expect(out.recipe.materials.find((m) => m.id === "tail")?.mix).toBeUndefined();
    expect(out.problems.filter((e) => e.rule === "mixOnlyBunch")).toEqual([]);
  });

  it("is not offered on a tail wound on as the body as well (a Pheasant Tail's)", () => {
    const fly = partsOf(patterns.find((r) => r.id === "pheasant-tail-nymph")!)!;
    const tail = fly.parts.find((p) => p.windTo !== undefined)!;
    expect(blends(tail, 0)).toBe(false);
    const mixed = { ...fly, parts: fly.parts.map((p) => (p === tail ? { ...p, mats: p.mats.map((m, i) => (i === 0 ? { ...m, mix: "white" } : m)) } : p)) };
    const out = compile(mixed);
    expect(out.problems.filter((e) => e.rule === "mixOnlyBunch")).toEqual([]);
  });
});

const patterns: Recipe[] = readdirSync(new URL("../../patterns", import.meta.url))
  .filter((f) => f.endsWith(".kdl"))
  .map((f) => {
    const r = loadRecipe(readFileSync(new URL(`../../patterns/${f}`, import.meta.url), "utf8"));
    if (!r.ok) throw new Error(f);
    return r.recipe;
  });

/** What a fly's material pieces are, without the thread (whose moves are worked out again) or what it lies on. */
function pieces(recipe: Recipe): string[] {
  const skip = new Set(["id", "window", "until", "seed", "base", "radius", "strandRadius", "bundleRadius", "thickness", "lift", "post", "covered"]);
  return simulate(recipe)
    .steps.flatMap((s) => s.pieces)
    .filter((p) => p.material !== "thread")
    .map((p) =>
      JSON.stringify(
        Object.fromEntries(
          Object.entries(p)
            .filter(([k]) => !skip.has(k))
            .map(([k, v]) => [k, typeof v === "number" ? Math.round(v * 100) / 100 : v]),
        ),
      ),
    )
    .sort();
}

const meta = (() => {
  const { materials: _m, steps: _s, ...rest } = blankFly("Mine");
  return rest;
})();

describe("a fly built of parts", () => {
  it.each(patterns.map((p) => [p.id, p] as const))("reads %s back into parts that tie the same fly", (_id, recipe) => {
    const fly = partsOf(recipe);
    expect(fly).not.toBeNull();
    const { recipe: again, problems } = compile(fly!);
    expect(problems.map((p) => p.message)).toEqual([]);
    expect(pieces(again)).toEqual(pieces(recipe));
    // Every note and common mistake the pattern gives comes through too.
    const notes = (r: Recipe) => r.steps.flatMap((s) => [s.note ?? [], s.mistake ?? []].flat()).sort();
    expect(notes(again)).toEqual(notes(recipe));
  });

  it("starts from a bare hook and adds parts in the order they are tied", () => {
    let fly: PartsFly = bareHook({ ...meta, type: "dry", hook: { model: "dry-standard", size: 14 } });
    const add = (...a: Parameters<typeof addPart> extends [PartsFly, ...infer R] ? R : never) => {
      fly = addPart(fly, ...a).fly;
    };
    add("hackle", "cock-hackle", "brown");
    add("body", "silk-floss", "yellow");
    add("tail", "hackle-fibres", "brown");
    add("rib", "gold-wire");
    add("wing", "hackle-tips", "grizzly");
    const { recipe, problems } = compile(fly);
    expect(problems.map((p) => p.message)).toEqual([]);
    expect(recipe.steps.filter((s) => s.op === "tie-in").map((s) => "material" in s && s.material)).toEqual(["wing", "tail", "rib", "body", "hackle"]);
  });

  it("always ties: any parts, of any of their materials, tied any way they can be", () => {
    const random = mulberry32(7);
    const pick = <T,>(a: readonly T[]) => a[Math.floor(random() * a.length)]!;
    for (let n = 0; n < 400; n++) {
      let fly: PartsFly = bareHook(meta);
      for (const role of ROLES.filter((r) => r !== "other" && random() < 0.4)) {
        const kind = pick(kindsFor(role));
        const ways = waysFor(role, kind).filter((w) => !unavailable(fly, newPart(fly, role, kind), w));
        if (ways.length) fly = addPart(fly, role, kind, undefined, pick(ways)).fly;
      }
      const { problems } = compile(fly);
      expect(problems.map((p) => p.message), fly.parts.map((p) => `${p.role}/${p.how}/${p.mats[0]!.kind}`).join(" ")).toEqual([]);
    }
  });

  const byId = (id: string) => patterns.find((p) => p.id === id)!;

  it("starts every style from its pattern, and ties it", () => {
    for (const id of Object.values(STYLES)) {
      const fly = startFrom(byId(id));
      expect(fly, id).not.toBeNull();
      expect(compile(fly!).problems.map((p) => p.message), id).toEqual([]);
      expect(fly!.parts.every((p) => !p.notes)).toBe(true);
    }
  });

  it("keeps the rib on its body and the hackle at the body's end", () => {
    let fly = startFrom(byId("black-pennell"))!;
    const body = fly.parts.find((p) => p.role === "body")!;
    fly = setPart(fly, body.id, { to: 0.6 });
    expect(fly.parts.find((p) => p.role === "rib")!.to).toBe(0.6);
    expect(compile(fly).problems).toEqual([]);
  });

  it("winds a parachute as a collar when its post is taken away, and a palmered hackle when its rib is", () => {
    let fly = startFrom(byId("parachute-adams"))!;
    fly = removePart(fly, fly.parts.find((p) => p.role === "wing")!.id);
    expect(fly.parts.find((p) => p.role === "hackle")!.how).toBe("wound");
    expect(compile(fly).problems).toEqual([]);
    let caddis = startFrom(byId("elk-hair-caddis"))!;
    caddis = removePart(caddis, caddis.parts.find((p) => p.role === "rib")!.id);
    expect(caddis.parts.find((p) => p.role === "hackle")!.how).toBe("wound");
    expect(compile(caddis).problems).toEqual([]);
  });

  it("mixes materials in a part, each named by its colour", () => {
    let fly = startFrom(byId("grey-duster"))!;
    const hackle = fly.parts.find((p) => p.role === "hackle")!;
    fly = setMaterial(fly, hackle.id, 0, { color: "brown" });
    fly = addMaterial(fly, hackle.id, "cock-hackle", "grizzly");
    expect(fly.parts.find((p) => p.id === hackle.id)!.mats.map((m) => m.id)).toEqual(["hackle-brown", "hackle-grizzly"]);
    const { recipe, problems } = compile(fly);
    expect(problems).toEqual([]);
    expect(recipe.steps.filter((s) => s.op === "wind").map((s) => "material" in s && s.material)).toEqual(["hackle-brown", "hackle-grizzly"]);
  });

  it("still ties after its parts are dragged about within what the handles allow", () => {
    const random = mulberry32(11);
    for (const id of Object.values(STYLES)) {
      let fly = startFrom(byId(id))!;
      for (let n = 0; n < 40; n++) {
        const p = fly.parts[Math.floor(random() * fly.parts.length)]!;
        const u = Math.round(random() * 20) / 20;
        const patch: Partial<typeof p> = {};
        if (p.length !== undefined) patch.length = 0.3 + random() * 4;
        if (p.angle !== undefined) patch.angle = Math.round(random() * 90);
        if (p.how === "wound" || p.how === "dubbed" || p.how === "spun") {
          const start = p.at ?? p.from ?? 0;
          if (random() < 0.5) patch.to = Math.min(1, Math.max(start + 0.05, u));
        }
        fly = setPart(fly, p.id, patch);
      }
      expect(compile(fly).problems.map((p) => p.message), id).toEqual([]);
    }
  });

  it("keeps a binding past the bend as its own action, whatever comes between its passes", () => {
    // The Paradrake with its tips trimmed between the pass back past the bend and the pass forward.
    const para = byId("paradrake");
    const back = para.steps.findIndex((s) => s.op === "wrap-thread" && s.to < 0);
    const trim = para.steps.at(-1)!;
    const steps = [...para.steps.slice(0, back + 1), trim, ...para.steps.slice(back + 1, -1)];
    const variant: Recipe = { ...para, steps };
    const fly = partsOf(variant)!;
    const { recipe: again, problems } = compile(fly);
    expect(problems.map((p) => p.message)).toEqual([]);
    expect(again.steps.map((s) => s.op)).toEqual(variant.steps.map((s) => s.op));
    expect(pieces(again)).toEqual(pieces(variant));
  });

  it("drops no trim on hair tied in pointing forward: its butts lie under the turns", () => {
    let fly = startFrom(byId("adams"))!;
    const { fly: added, part } = addPart(fly, "wing", "elk-hair");
    fly = setPart(added, part.id, { angle: 10, forward: true });
    expect(fly.parts.find((p) => p.id === part.id)!.trim).toBeUndefined();
    fly = setMaterial(fly, part.id, 0, { color: "black" });
    expect(fly.parts.find((p) => p.id === part.id)!.trim).toBeUndefined();
    const { recipe, problems } = compile(fly);
    expect(problems.map((p) => p.message)).toEqual([]);
    expect(() => simulate(recipe)).not.toThrow();
  });

  it("lets the thread go behind the bend only to bind hair folded back there", () => {
    const para = startFrom(byId("paradrake"))!;
    const binding = para.parts.find((p) => p.how === "thread" && (p.to ?? 0) < 0)!;
    expect(rearLimit(para, binding)).toBe(-1);
    expect(rearLimit(para, para.parts.find((p) => p.role === "tail")!)).toBe(0);
    const adams = startFrom(byId("parachute-adams"))!;
    expect(adams.parts.filter((p) => rearLimit(adams, p) < 0)).toEqual([]);
    // Moved within the hair's reach, it still ties.
    expect(compile(setPart(para, binding.id, { to: -0.5 })).problems.map((p) => p.message)).toEqual([]);
  });

  it("palmers a hackle over a body once a rib is there to hold it, one material at a time", () => {
    let fly = addPart(startFrom(byId("adams"))!, "rib", "gold-wire").fly;
    const hackle = fly.parts.find((p) => p.role === "hackle")!;
    expect(unavailable(fly, hackle, "palmered")).toBe("oneMaterial");
    fly = removeMaterial(fly, hackle.id, 1);
    expect(unavailable(fly, fly.parts.find((p) => p.id === hackle.id)!, "palmered")).toBeNull();
    fly = setHow(fly, hackle.id, "palmered");
    expect(compile(fly).problems.map((p) => p.message)).toEqual([]);
  });

  /** The fly as a saved recipe file, read back: what saving and sharing go through. */
  const readsBack = (fly: PartsFly) => {
    const { recipe } = compile(fly);
    const r = loadRecipe(recipeText({ ...recipe, id: "my-fly" }));
    return r.ok ? [] : r.errors.map((e) => e.message);
  };

  it("names mixed materials by named colours or positions, never a hex code or a number", () => {
    let fly = startFrom(byId("grey-duster"))!;
    const hackle = fly.parts.find((p) => p.role === "hackle")!;
    fly = setMaterial(fly, hackle.id, 0, { color: "#ff0000" });
    fly = addMaterial(fly, hackle.id, "cock-hackle", "#00ff00");
    fly = addMaterial(fly, hackle.id, "cock-hackle", "badger");
    const ids = fly.parts.find((p) => p.id === hackle.id)!.mats.map((m) => m.id);
    expect(ids.every((id) => /^[a-z]+(-(front|rear|middle|upper|lower|[a-z-]+))*$/.test(id) && !/\d|#/.test(id))).toBe(true);
    expect(readsBack(fly)).toEqual([]);
  });

  it("gives beads and eyes a size, and mixed-in materials a colour, so the saved fly loads", () => {
    let fly = addPart(startFrom(byId("gold-ribbed-hares-ear-nymph"))!, "bead", "brass-bead").fly;
    fly = addPart(fly, "eyes", "dumbbell-eyes").fly;
    const tail = fly.parts.find((p) => p.role === "tail")!;
    fly = addMaterial(fly, tail.id, "hackle-fibres");
    expect(readsBack(fly)).toEqual([]);
  });

  it("adds a part before the whip finish of a fly trimmed after it", () => {
    const fly = addPart(startFrom(byId("black-ant"))!, "rib", "gold-wire").fly;
    expect(compile(fly).problems.map((p) => p.message)).toEqual([]);
  });

  it("trims a hackle to shape when that is switched on, a palmered one after its tip", () => {
    let fly = startFrom(byId("grey-duster"))!;
    const hackle = fly.parts.find((p) => p.role === "hackle")!;
    fly = setPart(fly, hackle.id, { trim: { keep: "top" } });
    expect(compile(fly).recipe.steps.some((s) => s.op === "trim" && s.keep === "top")).toBe(true);
    let caddis = startFrom(byId("elk-hair-caddis"))!;
    const palmered = caddis.parts.find((p) => p.how === "palmered")!;
    caddis = setPart(caddis, palmered.id, { trim: { keep: "top" } });
    expect(compile(caddis).problems.map((p) => p.message)).toEqual([]);
    expect(partsOf(compile(caddis).recipe)).not.toBeNull();
  });

  it("lays a rib along a thread body however its passes run", () => {
    for (const id of ["f-fly", "snipe-and-purple", "zebra-midge"]) {
      const fly = addPart(startFrom(byId(id))!, "rib", "gold-wire").fly;
      expect(compile(fly).problems.map((p) => p.message), id).toEqual([]);
    }
  });

  it("keeps a palmered hackle tieable when its rib is dragged forward past it", () => {
    let fly = startFrom(byId("elk-hair-caddis"))!;
    fly = setPart(fly, fly.parts.find((p) => p.role === "rib")!.id, { at: 0.8 });
    expect(compile(fly).problems.map((p) => p.message)).toEqual([]);
    expect(partsOf(compile(fly).recipe)).not.toBeNull();
  });

  it("leaves a parachute on its post when the body's end moves", () => {
    let fly = startFrom(byId("parachute-adams"))!;
    const body = fly.parts.find((p) => p.role === "body")!;
    const before = fly.parts.find((p) => p.how === "parachute")!;
    fly = setPart(fly, body.id, { to: 0.5 });
    const after = fly.parts.find((p) => p.how === "parachute")!;
    expect(after.at).toBe(before.at);
    expect(after.to).toBeUndefined();
  });

  it("refuses a mixed-in material the part can't be tied with", () => {
    let fly = startFrom(byId("grey-duster"))!;
    const hackle = fly.parts.find((p) => p.role === "hackle")!;
    fly = addMaterial(fly, hackle.id, "cock-hackle", "grizzly");
    const refused = setMaterial(fly, hackle.id, 1, { kind: "bucktail" });
    expect(refused).toBe(fly);
  });

  it("fits a part's settings to a new material: no hair trim on feathers, a colour where needed, a post that can't carry a parachute", () => {
    let caddis = startFrom(byId("elk-hair-caddis"))!;
    const wing = caddis.parts.find((p) => p.role === "wing")!;
    caddis = setMaterial(caddis, wing.id, 0, { kind: "hackle-tips" });
    expect(readsBack(caddis)).toEqual([]);
    let pennell = startFrom(byId("black-pennell"))!;
    pennell = setMaterial(pennell, pennell.parts.find((p) => p.role === "tail")!.id, 0, { kind: "hackle-fibres" });
    expect(readsBack(pennell)).toEqual([]);
    let para = startFrom(byId("parachute-adams"))!;
    para = setMaterial(para, para.parts.find((p) => p.role === "wing")!.id, 0, { kind: "hackle-tips" });
    expect(para.parts.find((p) => p.role === "hackle")!.how).toBe("wound");
    expect(readsBack(para)).toEqual([]);
  });

  it("leaves a thread body's backward passes as they are when other parts change", () => {
    let fly = startFrom(byId("f-fly"))!;
    const before = JSON.stringify(fly.parts.find((p) => p.how === "thread"));
    fly = setPart(fly, fly.parts.find((p) => p.role === "wing")!.id, { length: 2 });
    expect(JSON.stringify(fly.parts.find((p) => p.how === "thread"))).toBe(before);
  });

  it("keeps a thorax dubbed back from the eye when other parts change", () => {
    let fly = startFrom(byId("balloon-caddis"))!;
    const thorax = () => fly.parts.find((p) => p.role === "thorax")!;
    const before = { from: thorax().from, to: thorax().to };
    fly = setPart(fly, fly.parts.find((p) => p.role === "wing")!.id, { length: 1.8 });
    expect({ from: thorax().from, to: thorax().to }).toEqual(before);
    expect(before.to!).toBeLessThan(before.from!);
  });

  it("ties a strip folded back from the eye down with the thread, wherever the thread waits for it", () => {
    const recipe = byId("balloon-caddis");
    const at = recipe.steps.findIndex((s) => s.op === "pull-over");
    const steps = recipe.steps.map((s) => (s.op === "pull-over" ? { ...s, to: 0.6 } : s));
    steps.splice(at, 0, { op: "wrap-thread", to: 0.6 });
    const moved = { ...recipe, steps };
    const { recipe: again, problems } = compile(partsOf(moved)!);
    expect(problems.map((p) => p.message)).toEqual([]);
    expect(pieces(again)).toEqual(pieces(moved));
  });

  it("keeps a Humpy's hump pulled over, with its tip wing, when its colour changes", () => {
    let fly = startFrom(byId("humpy"))!;
    const hump = fly.parts.find((p) => p.how === "pulled")!;
    expect(hump.tipWing).toBe(2);
    fly = setMaterial(fly, hump.id, 0, { color: "brown" });
    const after = fly.parts.find((p) => p.id === hump.id)!;
    expect(after.how).toBe("pulled");
    expect(after.tipWing).toBe(2);
    expect(compile(fly).problems.map((p) => p.message)).toEqual([]);
  });

  it("names a mix of two-word colours by position, so it reads back", () => {
    let fly = startFrom(byId("grey-duster"))!;
    const hackle = fly.parts.find((p) => p.role === "hackle")!;
    fly = setMaterial(fly, hackle.id, 0, { color: "red-game" });
    fly = addMaterial(fly, hackle.id, "cock-hackle", "fluo-red");
    expect(fly.parts.find((p) => p.id === hackle.id)!.mats.every((m) => !m.id.includes("red"))).toBe(true);
    expect(readsBack(fly)).toEqual([]);
  });

  it("drops settings a new material can't take, trims only a mix's hair, palmers with its rib and keeps a body off the eye", () => {
    let butcher = startFrom(byId("butcher"))!;
    butcher = setMaterial(butcher, butcher.parts.find((p) => p.role === "tail")!.id, 0, { kind: "hackle-fibres" });
    expect(readsBack(butcher)).toEqual([]);
    let adams = startFrom(byId("adams"))!;
    adams = setMaterial(adams, adams.parts.find((p) => p.role === "tail")!.id, 1, { kind: "elk-hair" });
    expect(readsBack(adams)).toEqual([]);
    let glory = startFrom(byId("greenwells-glory"))!;
    glory = setHow(glory, glory.parts.find((p) => p.role === "hackle")!.id, "palmered");
    expect(compile(glory).problems.map((p) => p.message)).toEqual([]);
    let body = startFrom(byId("adams"))!;
    body = setPart(body, body.parts.find((p) => p.role === "body")!.id, { from: 1 });
    expect(compile(body).problems.map((p) => p.message)).toEqual([]);
  });

  it("drops a trim the new material can't take, and keeps parts that follow a body tieable when it is dragged to the bend", () => {
    let beetle = startFrom(byId("foam-beetle"))!;
    beetle = setMaterial(beetle, beetle.parts.find((p) => p.role === "back")!.id, 0, { kind: "turkey-quill" });
    expect(readsBack(beetle)).toEqual([]);
    let caddis = startFrom(byId("elk-hair-caddis"))!;
    caddis = setPart(caddis, caddis.parts.find((p) => p.role === "body")!.id, { to: 0 });
    expect(compile(caddis).problems.map((p) => p.message)).toEqual([]);
    expect(caddis.parts.every((p) => [p.at, p.from, p.to].every((x) => x === undefined || (x >= 0 && x <= 1)))).toBe(true);
  });

  it("keeps a Zonker's tubing as a sleeve, its strip pulled over with its tail, and its rear finished part-way", () => {
    const fly = partsOf(byId("zonker"))!;
    expect(fly.parts.find((p) => p.id === "body")).toMatchObject({ how: "sleeve", at: 0.04, to: 0.9, fray: 1 });
    expect(fly.parts.find((p) => p.id === "wing")).toMatchObject({ how: "pulled", length: 3.8, to: 0.9 });
    expect(fly.restarts).toEqual([expect.objectContaining({ turns: 3, at: 0.9 })]);
    // A part added still ties, and the rear is still finished before the thread is started again.
    const more = addPart(fly, "rib", "silver-wire").fly;
    const { recipe, problems } = compile(more);
    expect(problems.map((p) => p.message)).toEqual([]);
    expect(recipe.steps.filter((s) => s.op === "whip-finish")).toHaveLength(2);
    expect(recipe.steps.filter((s) => s.op === "attach-thread")).toHaveLength(2);
  });

  it("slides a sleeve on over a body wound under it", () => {
    let fly: PartsFly = bareHook({ ...meta, type: "streamer", hook: { model: "streamer-4xl", size: 4 } });
    fly = addPart(fly, "body", "chenille", "white").fly;
    fly = addPart(fly, "body", "mylar-tubing").fly;
    const { recipe, problems } = compile(fly);
    expect(problems.map((p) => p.message)).toEqual([]);
    const ops = recipe.steps.map((s) => `${s.op}${"material" in s ? ` ${s.material}` : ""}`);
    const sleeve = ops.findIndex((o) => o.startsWith("sleeve"));
    expect(sleeve).toBeGreaterThan(ops.indexOf("tie-off body"));
  });

  it("keeps a Bitch Creek's woven abdomen as one part of two strands, its thread cut and attached again", () => {
    const fly = partsOf(byId("bitch-creek"))!;
    const back = fly.parts.find((p) => p.id === "back")!;
    expect(back).toMatchObject({ how: "woven", role: "body", at: 0, to: 0.55 });
    expect(back.mats.map((m) => m.id)).toEqual(["back", "belly"]);
    expect(back.mats[1]!.notes).toEqual({ 0: "On the far side of the shank." });
    // Finished behind the eye, the thread brought there first, and started again where the weave ends.
    expect(fly.restarts).toEqual([expect.objectContaining({ turns: 3, at: 0.55, finishAt: 0.9 })]);
    const { recipe, problems } = compile(addPart(fly, "rib", "copper-wire").fly);
    expect(problems.map((p) => p.message)).toEqual([]);
    expect(recipe.steps.filter((s) => s.op === "weave")).toHaveLength(1);
  });

  it("weaves a body of two strands with the thread parked, and winds it again with one", () => {
    let fly: PartsFly = bareHook({ ...meta, type: "nymph", hook: { model: "nymph-2xl", size: 8 } });
    const added = addPart(fly, "body", "chenille", "black");
    fly = added.fly;
    expect(unavailable(fly, added.part, "woven")).toBe("twoMaterials");
    fly = setHow(addMaterial(fly, added.part.id, "chenille", "orange"), added.part.id, "woven");
    const { recipe, problems } = compile(fly);
    expect(problems.map((p) => p.message)).toEqual([]);
    const ops = recipe.steps.map((s) => s.op);
    expect(ops.slice(ops.indexOf("weave") - 1, ops.indexOf("weave") + 3)).toEqual(["wrap-thread", "weave", "tie-off", "tie-off"]);
    // A third strand isn't woven in; one taken out leaves a wound body.
    expect(addMaterial(fly, added.part.id, "chenille", "red").parts.find((p) => p.id === added.part.id)!.mats).toHaveLength(2);
    expect(removeMaterial(fly, added.part.id, 1).parts.find((p) => p.id === added.part.id)!.how).toBe("wound");
  });
});

describe("a body made on a needle, as parts (a Mohican Mayfly's)", () => {
  const mohican = patterns.find((p) => p.id === "mohican-mayfly")!;
  const fly = () => partsOf(mohican)!;
  const body = (f: PartsFly) => f.parts.find((p) => p.mats[0]!.id === "body")!;
  const clean = (f: PartsFly) => compile(f).problems.map((p) => p.message);

  it("edits the body's foam and its tails, each on its own", () => {
    let f = fly();
    const id = body(f).id;
    f = setMaterial(f, id, 0, { color: "white" });
    expect(body(f).mats[0]).toMatchObject({ color: "white" });
    f = setMaterial(f, id, 1, { props: { count: 2 } });
    expect(body(f).mats[1]!.props).toMatchObject({ count: 2 });
    // Its head trim and thickness are kept.
    expect(body(f)).toMatchObject({ trim: { leave: 0.3 }, width: 0.4, tailLength: 3.3 });
    expect(clean(f)).toEqual([]);
  });

  it("pulls the strip straight over when the wing it parts round is gone", () => {
    const f = removePart(fly(), fly().parts.find((p) => p.mats[0]!.id === "wing")!.id);
    expect(body(f).post).toBeUndefined();
    expect(compile(f).recipe.steps.find((s) => s.op === "pull-over")).not.toHaveProperty("around");
    expect(clean(f)).toEqual([]);
  });

  it("drops the fan, and the parting round it, when the wing is no longer an upright bunch of hair", () => {
    const f0 = fly();
    const wing = f0.parts.find((p) => p.mats[0]!.id === "wing")!;
    const f = setMaterial(f0, wing.id, 0, { kind: "hackle-tips" });
    expect(f.parts.find((p) => p.id === wing.id)!.fan).toBeUndefined();
    expect(body(f).post).toBeUndefined();
    expect(clean(f).filter((m) => /fan|parted/.test(m))).toEqual([]);
    // (A parachute's post stays upright: without the hackle, it can be laid back.)
    const bare = removePart(f0, f0.parts.find((p) => p.how === "parachute")!.id);
    const laid = setPart(bare, wing.id, { angle: 30 });
    expect(laid.parts.find((p) => p.id === wing.id)!.fan).toBeUndefined();
    expect(body(laid).post).toBeUndefined();
    expect(clean(laid)).toEqual([]);
  });

  it("keeps a bubble on the strip pulled over", () => {
    const recipe = { ...mohican, steps: mohican.steps.map((s) => (s.op === "pull-over" ? { ...s, bubble: 0.2 } : s)) } as Recipe;
    const again = compile(partsOf(recipe)!).recipe;
    expect(again.steps.find((s) => s.op === "pull-over")).toMatchObject({ bubble: 0.2, around: "wing" });
  });
});

describe("every choice the builder offers on a copied pattern ties", () => {
  const ids = patterns.map((p) => p.id);
  const problems = (f: PartsFly) => compile(f).problems.map((p) => p.message);
  it.each(ids)("%s: each way to tie, preset and material", (id) => {
    const fly = partsOf(patterns.find((p) => p.id === id)!)!;
    const failures: string[] = [];
    const check = (what: string, f: PartsFly) => {
      const bad = problems(f);
      if (bad.length) failures.push(`${what}: ${bad.join("; ")}`);
    };
    for (const part of fly.parts) {
      // (A thread body has no material to choose.)
      if (!part.mats.length) continue;
      for (const how of waysOf(part)) if (!unavailable(fly, part, how)) check(`${part.id} tied ${how}`, setHow(fly, part.id, how));
      const preset = presetFor(part);
      if (preset) for (const k of Object.keys(PRESETS) as Preset[]) check(`${part.id} ${k}`, setPart(fly, part.id, preset.set(preset.classic * PRESETS[k])));
      part.mats.forEach((_, i) => {
        for (const kind of materialChoices(part, i)) check(`${part.id} material ${i} as ${kind}`, setMaterial(fly, part.id, i, { kind }));
      });
    }
    expect(failures).toEqual([]);
  });

  // Two choices in a row: a material changed, then each way it can be tied.
  it.each(ids)("%s: a material changed, then each way to tie", (id) => {
    const fly = partsOf(patterns.find((p) => p.id === id)!)!;
    const failures: string[] = [];
    for (const part of fly.parts) {
      part.mats.forEach((_, i) => {
        for (const kind of materialChoices(part, i)) {
          const changed = setMaterial(fly, part.id, i, { kind });
          const now = changed.parts.find((p) => p.id === part.id);
          if (!now?.mats.length) continue;
          for (const how of waysOf(now)) {
            if (unavailable(changed, now, how)) continue;
            const bad = problems(setHow(changed, part.id, how));
            if (bad.length) failures.push(`${part.id} material ${i} as ${kind}, tied ${how}: ${bad.join("; ")}`);
          }
        }
      });
    }
    expect(failures).toEqual([]);
  });
});

describe("a needle body's builder choices", () => {
  const mohican = patterns.find((p) => p.id === "mohican-mayfly")!;
  const fly = () => partsOf(mohican)!;
  const body = (f: PartsFly) => f.parts.find((p) => p.mats[0]!.id === "body")!;

  it("offers tail materials for its tails, and only ways the foam can be tied", () => {
    const b = body(fly());
    const tails = materialChoices(b, 1);
    expect(tails).toEqual(expect.arrayContaining(["moose-mane", "goose-biot", "hackle-fibres"]));
    expect(tails).not.toContain("chenille");
    expect(waysOf(b)).toEqual(["extended"]);
    // Of wool, it can be wound too, but not woven: its tails are no second strand.
    const f = setMaterial(fly(), b.id, 0, { kind: "wool", color: "tan" });
    expect(unavailable(f, body(f), "woven")).toBe("twoMaterials");
  });

  it("makes its tails a tail of their own when the body is wound instead", () => {
    let f = fly();
    f = setMaterial(f, body(f).id, 0, { kind: "wool", color: "tan" });
    f = setHow(f, body(f).id, "wound");
    expect(body(f).mats.map((m) => m.kind)).toEqual(["wool"]);
    expect(f.parts.find((p) => p.role === "tail")).toMatchObject({ how: "bunch", mats: [{ kind: "moose-mane" }], length: expect.closeTo(2.3 + 3.3) });
    expect(compile(f).problems.map((p) => p.message)).toEqual([]);
  });

  it("pulls the strip straight over when it no longer passes the wing", () => {
    const f = setPart(fly(), body(fly()).id, { to: 0.5 });
    expect(body(f).post).toBeUndefined();
    expect(compile(f).problems.map((p) => p.message)).toEqual([]);
  });
});

describe("a Morrish Mouse's parts", () => {
  const mouse = patterns.find((r) => r.id === "morrish-mouse")!;
  const fly = partsOf(mouse)!;
  const back = fly.parts.find((p) => p.role === "back")!;

  it("keep the foam's cut, taper and fold, and the hair's flat cut and length", () => {
    expect(back).toMatchObject({ how: "pulled", width: 1.2, taper: true, fold: 0.8 });
    expect(fly.parts.find((p) => p.how === "spun")).toMatchObject({ length: 1.3, trim: { keep: "sides", leave: 0.35 } });
  });

  it("keep the cut when the foam's colour changes, and drop the fold when it is no longer foam", () => {
    const tan = setMaterial(fly, back.id, 0, { color: "tan" });
    expect(tan.parts.find((p) => p.id === back.id)).toMatchObject({ width: 1.2, taper: true, fold: 0.8 });
    const yarn = setMaterial(fly, back.id, 0, { kind: "poly-yarn" });
    const p = yarn.parts.find((x) => x.id === back.id)!;
    expect(p.fold).toBeUndefined();
    expect(compile(yarn).problems).toEqual([]);
  });
});

describe("the builder's number fields", () => {
  const form = PATTERN_FORM;
  const stepField = (op: string, prop: string) => form.find((s) => s.node === "steps")!.items!.find((i) => i.name === op)?.fields.find((f) => f.key === prop);
  const field = (w: NumberRange["writes"]) =>
    w.to === "step"
      ? stepField(w.op, w.prop)
      : w.to === "material"
        ? form.find((s) => s.node === "materials")!.items![0]!.fields.find((f) => f.key === w.prop)
        : form.find((s) => s.key === "hook")!.fields.find((f) => f.key === w.prop);
  const within = (name: string, r: NumberRange) => {
    const f = field(r.writes);
    expect(f, `${name}: ${JSON.stringify(r.writes)} is in the schema`).toBeDefined();
    if (f!.min !== undefined) expect(f!.exclusiveMin ? r.lo > f!.min : r.lo >= f!.min, `${name}: ${r.lo} against the schema's ${f!.min}`).toBe(true);
    if (f!.max !== undefined) expect(f!.exclusiveMax ? r.hi < f!.max : r.hi <= f!.max, `${name}: ${r.hi} against the schema's ${f!.max}`).toBe(true);
    expect(r.lo).toBeLessThanOrEqual(r.hi);
  };
  const HOWS: How[] = ["slide", "weight", "bunch", "wound", "palmered", "parachute", "dubbed", "spun", "glued", "pulled", "extended", "sleeve", "woven", "thread"];
  const KEYS: NumberKey[] = ["length", "angle", "spread", "width", "collar", "fray", "fan", "segments", "tailLength", "tailSpread", "fold"];

  it("stay within what the recipe allows for the value each is written as", () => {
    for (const how of HOWS) for (const key of KEYS) within(`${how} ${key}`, partRange({ how }, key));
    for (const [name, r] of Object.entries(MATERIAL_RANGES)) within(name, r);
  });

  it("write a spun part's length as the spin's", () => {
    expect(partRange({ how: "spun" }, "length").writes).toEqual({ to: "step", op: "spin", prop: "length" });
  });
});

describe("an extended foam body's strip folded as a head", () => {
  it("keeps the fold through the builder both ways", () => {
    const r = loadRecipe(`id test
name "Test"
type dry
difficulty advanced
hook dry-standard size=12
thread tan size="8/0"
materials {
    body foam color=tan mm=1.5
}
steps {
    attach-thread at=0.8
    wrap-thread to=0.2
    tie-in body length=1 extended=#true
    wrap-thread to=0.85
    pull-over body to=0.85 fold=0.8
    whip-finish
}
`);
    if (!r.ok) throw new Error(r.errors.map((e) => e.message).join("\\n"));
    const fly = partsOf(r.recipe)!;
    expect(fly.parts.find((p) => p.id === "body")).toMatchObject({ how: "extended", to: 0.85, fold: 0.8 });
    const back = compile(fly);
    expect(back.problems).toEqual([]);
    expect(back.recipe.steps.find((s) => s.op === "pull-over")).toMatchObject({ fold: 0.8 });
  });
});

describe("a body glued on (a crab)", () => {
  const recipe = (id: string) => {
    const r = loadRecipe(readFileSync(new URL(`../../patterns/${id}.kdl`, import.meta.url), "utf8"));
    if (!r.ok) throw new Error(id);
    return r.recipe;
  };

  it("reads the Raghead Crab's glued body and fanned legs back as parts", () => {
    const fly = partsOf(recipe("raghead-crab"))!;
    expect(fly.parts.find((p) => p.id === "body")).toMatchObject({ how: "glued", from: 0.1, to: 0.75, length: 0.65, trim: { shape: "disc", leave: 0.38 } });
    expect(fly.parts.find((p) => p.id === "legs")).toMatchObject({ how: "bunch", side: "across", fan: 70 });
    expect(compile(fly).problems).toEqual([]);
  });

  it("glues a body on after the whip finish when a part is tied that way", () => {
    const herl = partsOf(recipe("red-tag"))!;
    const body = herl.parts.find((p) => p.role === "body")!;
    const fly = setMaterial(herl, body.id, 0, { kind: "craft-fur", color: "tan" });
    expect(waysOf(fly.parts.find((p) => p.id === body.id)!)).toContain("glued");
    const glued = compile(setHow(fly, body.id, "glued"));
    expect(glued.problems).toEqual([]);
    const ops = glued.recipe.steps.map((s) => s.op);
    expect(ops.indexOf("glue")).toBeGreaterThan(ops.indexOf("whip-finish"));
    expect(glued.recipe.steps.at(-1)).toMatchObject({ op: "trim", shape: "disc" });
  });
});
