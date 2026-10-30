import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { TIPPET_RADIUS, tippetDimples, tippetPath } from "./tippet";

describe("the tippet", () => {
  const level = 0;

  const film = level - TIPPET_RADIUS * 0.6;
  const along = (path: THREE.Vector3[]) => new THREE.CatmullRomCurve3(path, false, "centripetal").getSpacedPoints(800);

  it("comes down from a floating fly to lie in the film, never under it", () => {
    const path = tippetPath(new THREE.Vector3(1.6, 0.4, 0), new THREE.Vector3(1, 0.1, 0).normalize(), level, true);
    for (const p of along(path)) expect(p.y).toBeGreaterThan(film - 0.01);
    expect(path.at(-1)!.y).toBeCloseTo(film, 6);
    // Away from the fly, far out of the picture.
    expect(path.at(-1)!.x).toBeGreaterThan(60);
  });

  it("rises from a sunk fly to the film, never above it", () => {
    const path = tippetPath(new THREE.Vector3(0, -3, 0), new THREE.Vector3(1, 0, 0), level, false);
    for (const p of along(path)) expect(p.y).toBeLessThan(film + 0.01);
  });

  it("rises to the surface from a sunk fly", () => {
    const path = tippetPath(new THREE.Vector3(0, -3, 0), new THREE.Vector3(1, 0, 0), level, false);
    expect(path[0]!.y).toBe(-3);
    const meet = path.findIndex((p) => Math.abs(p.y - level) < 0.05);
    expect(meet).toBeGreaterThan(1);
    // At about 25 degrees: some six gapes along for three up.
    expect(path[meet]!.x).toBeGreaterThan(5);
  });

  it("dents the film along it, near the fly", () => {
    const path = tippetPath(new THREE.Vector3(2, 0.3, 0), new THREE.Vector3(1, 0, 0), level, true);
    const dimples = tippetDimples(path, level, 10);
    expect(dimples).toHaveLength(10);
    for (const d of dimples) expect(d.x).toBeLessThan(10);
  });
});
