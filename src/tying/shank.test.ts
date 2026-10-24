import { describe, expect, it } from "vitest";
import { HOOK_MODELS } from "./hook";
import { bendEndX, hookPath, shankAt } from "./shank";

describe("shank geometry", () => {
  const straight = HOOK_MODELS["dry-standard"];
  const curved = HOOK_MODELS["scud-curved"];

  it("lays a straight shank along +x from the bend", () => {
    expect(shankAt(straight, 0)).toEqual({ p: { x: 0, y: 0 }, t: { x: 1, y: 0 } });
    expect(shankAt(straight, 1.5).p).toEqual({ x: 1.5, y: 0 });
  });

  it("keeps arc length along a curved shank", () => {
    let length = 0;
    const n = 200;
    for (let i = 1; i <= n; i++) {
      const a = shankAt(curved, (curved.shankLength * (i - 1)) / n).p;
      const b = shankAt(curved, (curved.shankLength * i) / n).p;
      length += Math.hypot(b.x - a.x, b.y - a.y);
    }
    expect(length).toBeCloseTo(curved.shankLength, 3);
  });

  it("curves a shank symmetrically, down at both ends", () => {
    const rear = shankAt(curved, 0);
    const middle = shankAt(curved, curved.shankLength / 2);
    const front = shankAt(curved, curved.shankLength);
    expect(middle.t.y).toBeCloseTo(0);
    expect(rear.t.y).toBeGreaterThan(0);
    expect(front.t.y).toBeLessThan(0);
    expect(rear.p.y).toBeCloseTo(front.p.y);
    expect(middle.p.y).toBeGreaterThan(rear.p.y);
  });

  it("continues straight beyond the ends", () => {
    const end = shankAt(curved, curved.shankLength);
    const past = shankAt(curved, curved.shankLength + 0.5);
    expect(past.p.x).toBeCloseTo(end.p.x + 0.5 * end.t.x);
    expect(past.p.y).toBeCloseTo(end.p.y + 0.5 * end.t.y);
  });

  it("makes a gape of one unit on a straight hook", () => {
    const path = hookPath(straight);
    const lowest = Math.min(...path.map((p) => p.y));
    // Wire centre to wire centre is gape + one wire diameter.
    expect(-lowest).toBeCloseTo(1 + 2 * straight.wireRadius, 2);
    expect(bendEndX(straight)).toBeCloseTo(-(0.5 + 2 * straight.wireRadius), 2);
  });
});
