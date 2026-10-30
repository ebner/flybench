import { describe, expect, it } from "vitest";
import { capillaryNormals } from "./capillary";

describe("the capillary ripples' normal map", () => {
  const size = 64;
  const t = capillaryNormals(size);
  const data = t.image.data as Uint8Array;
  const at = (i: number, j: number) => [...data.subarray((j * size + i) * 4, (j * size + i) * 4 + 3)].map((v) => v / 127.5 - 1);

  it("is nearly flat: slopes of a few hundredths", () => {
    for (let k = 0; k < size * size; k += 37) {
      const [x, y, z] = at(k % size, Math.floor(k / size));
      expect(Math.hypot(x!, y!)).toBeLessThan(0.2);
      expect(z!).toBeGreaterThan(0.95);
    }
  });

  it("repeats across its edges", () => {
    // The first column continues the last: neighbouring normals differ little.
    for (let j = 0; j < size; j += 7) {
      const a = at(0, j);
      const b = at(size - 1, j);
      expect(Math.abs(a[0]! - b[0]!)).toBeLessThan(0.05);
    }
  });
});
