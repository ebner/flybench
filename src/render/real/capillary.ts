import * as THREE from "three";
import { mulberry32 } from "../random";

/**
 * The surface's finest ripples: capillary waves a few millimetres long that the wind and the
 * current keep on any river, too small for the surface's geometry. A tileable normal map (in
 * tangent space: x along the surface's x, y along its z), built from waves that repeat over the
 * tile, used by the water shader and the path tracer's surface alike.
 */

/** The tile's size in gapes. */
export const CAPILLARY_TILE = 3;

// Assumption: capillary waves 1.5–8 mm long (0.3–1.5 gapes on a #12), their slopes a few
// hundredths: enough to break up reflections into glints and waver the bed, too little to see as waves.
const WAVES = 18;
const SLOPE = 0.035;

/** The map's pixels, worked out once per size (some tens of milliseconds). */
const made = new Map<number, Uint8Array>();

export function capillaryNormals(size = 256): THREE.DataTexture {
  let data = made.get(size);
  if (!data) made.set(size, (data = normals(size)));
  const texture = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.generateMipmaps = true;
  texture.needsUpdate = true;
  return texture;
}

function normals(size: number): Uint8Array {
  const random = mulberry32(1729);
  const waves = Array.from({ length: WAVES }, () => {
    // Whole numbers of waves across the tile, so it repeats.
    const kx = Math.round((random() * 2 - 1) * 9);
    const kz = Math.round((random() * 2 - 1) * 9) || 2;
    const k = Math.hypot(kx, kz);
    // Each wave's steepest slope SLOPE / 3; together, with random phases, about SLOPE.
    return { kx, kz, a: SLOPE / 3 / (2 * Math.PI * Math.max(1, k)), phase: random() * Math.PI * 2 };
  });
  const data = new Uint8Array(size * size * 4);
  for (let j = 0; j < size; j++) {
    for (let i = 0; i < size; i++) {
      const x = i / size;
      const z = j / size;
      let dx = 0;
      let dz = 0;
      for (const w of waves) {
        const c = Math.cos(2 * Math.PI * (w.kx * x + w.kz * z) + w.phase) * 2 * Math.PI * w.a;
        dx += c * w.kx;
        dz += c * w.kz;
      }
      const n = new THREE.Vector3(-dx, -dz, 1).normalize();
      const o = (j * size + i) * 4;
      data[o] = Math.round((n.x * 0.5 + 0.5) * 255);
      data[o + 1] = Math.round((n.y * 0.5 + 0.5) * 255);
      data[o + 2] = Math.round((n.z * 0.5 + 0.5) * 255);
      data[o + 3] = 255;
    }
  }
  return data;
}
