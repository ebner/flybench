import { describe, expect, it } from "vitest";
import { dimpleHeight, RIPPLE_GLSL, rippleHeight, RIPPLES } from "./waves";

describe("the river's ripples", () => {
  it("stay within the sum of their heights, and move with time", () => {
    const most = RIPPLES.reduce((s, r) => s + r.a, 0);
    for (let i = 0; i < 50; i++) expect(Math.abs(rippleHeight(i * 0.7, i * 1.3, i * 0.1))).toBeLessThanOrEqual(most + 1e-9);
    expect(rippleHeight(1, 2, 0)).not.toBeCloseTo(rippleHeight(1, 2, 1), 5);
  });

  it("dent the film under a foot, with a rim round it and nothing far away", () => {
    const d = { x: 0, z: 0, r: 0.12, d: 0.04 };
    expect(dimpleHeight(0, 0, d)).toBeCloseTo(-0.04, 2);
    expect(dimpleHeight(0.22, 0, d)).toBeGreaterThan(0);
    expect(dimpleHeight(1, 0, d)).toBe(0);
  });

  it("are the same in the shader", () => {
    for (const r of RIPPLES) expect(RIPPLE_GLSL).toContain(r.k.toFixed(4));
  });
});
