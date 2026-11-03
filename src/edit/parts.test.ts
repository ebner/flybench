import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { loadRecipe } from "../recipe/load";
import type { Recipe } from "../recipe/schema";
import { simulate } from "../tying/simulate";
import { blankFly, recipeText } from "./own";
import { mulberry32 } from "../render/random";
import {
  addMaterial, addPart, bareHook, compile, kindsFor, newPart, partsOf, removeMaterial, removePart, ROLES, setHow, setMaterial, setPart, startFrom, STYLES, unavailable, waysFor, type PartsFly,
} from "./parts";

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
